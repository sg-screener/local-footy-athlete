/**
 * Final canonicalisation and active-constraint boundary for program writes.
 *
 * Generation and edit producers still own programming intent. This module
 * converts their output to the canonical workout shape, applies the existing
 * injury/exposure/equipment rules, then canonicalises the surviving content
 * again immediately before storage.
 */

import type {
  Microcycle,
  OnboardingData,
  TrainingProgram,
  WeekScopedWorkoutOverlay,
  Workout,
} from '../types/domain';
import type {
  ActiveConstraint,
  ActiveInjuryConstraint,
} from '../store/coachUpdatesStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useProfileStore } from '../store/profileStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCalendarStore } from '../store/calendarStore';
import { classifyVisibleSession } from '../rules/sessionClassificationAdapter';
import { applyInjuryFilterToWorkout } from './injuryWorkoutFilter';
import {
  applyConstraintsToSession,
  scoreExerciseAgainstConstraints,
  type Constraint,
} from './exposureEngine';
import { buildConstraintPlans } from './constraintPlan';
import { buildGenerationConstraintContext } from './generationConstraints';
import {
  equipmentRequirementsAreAvailable,
  resolveEquipmentAvailability,
} from './equipmentAvailability';
import {
  buildReadinessActiveConstraints,
  constraintAppliesToDate,
} from './readinessConstraints';
import {
  collapseWorkoutToRest,
  hasMeaningfulWorkoutContent,
} from './workoutContent';
import { todayISOLocal } from './appDate';
import { alignPowerBlockToFinalWorkoutContent } from '../rules/powerBlockContentAlignment';
import {
  finaliseWorkoutAfterMutation,
  type WorkoutCanonicalisationContext,
} from './workoutCanonicalisation';
import { resolveOffseasonSubphase } from '../rules/offseasonSubphase';
import { deriveScheduleReadiness } from './readiness';
import { selectMicrocycleForDate } from './programBlockState';
import { resolveSeasonPhaseClock } from '../rules/seasonPhaseClock';
import {
  evaluateEffectiveWeekExposureContract,
  type WeeklyExposureContract,
} from '../rules/weeklyExposureContract';
import {
  buildWeeklyExposureContract,
  resolveRestrictedMainStrengthPatterns,
} from '../rules/weeklyExposureContractBuilders';
import { resolvePreseasonSubphase } from '../rules/preseasonSubphase';
import { resolveTrainingAgePolicy } from '../rules/trainingAgePolicy';
import { resolveEquipmentCapabilities } from './equipmentAvailability';
import {
  migrateLegacyWeeklyExposureContractV2,
  type WeeklyExposureContractV2,
} from '../rules/weeklyExposureContractV2';
import { applyGenerationSafetyToSection18Contract } from '../rules/section18SafetyPolicy';
import { finaliseSection18SafetyWeek } from '../rules/section18SafetyFinaliser';
import { requireSection18AcceptedWeek } from '../rules/section18AcceptedWeekGateway';
import { resolveConditioningSubstitutionPolicy } from '../rules/conditioningFeasibility';

export interface ActiveConstraintValidationInput {
  workout: Workout | null;
  date: string;
  todayISO: string;
  activeConstraints: readonly ActiveConstraint[];
  profile?: OnboardingData | null;
  canonicalContext?: WorkoutCanonicalisationContext;
}

export interface ActiveConstraintValidationResult {
  workout: Workout | null;
  changed: boolean;
  collapsedToRest: boolean;
  preservedAnchor: boolean;
  activeConstraintIds: string[];
  removedExerciseNames: string[];
  removedComponents: Array<'conditioning' | 'speed' | 'power' | 'recovery_addon'>;
}

function dateOnly(value: string | undefined): string | undefined {
  return value?.slice(0, 10);
}

function addDaysISO(dateISO: string, days: number): string {
  const [year, month, day] = dateISO.slice(0, 10).split('-').map(Number);
  const value = new Date(year, month - 1, day + days, 12, 0, 0, 0);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function uniquePatterns<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function constraintIsLiveOnDate(constraint: ActiveConstraint, date: string): boolean {
  if (constraint.status === 'resolved') return false;
  const start = dateOnly(constraint.startDate);
  if (start && start > date) return false;
  return constraintAppliesToDate(constraint, date);
}

function liveConstraintsForDate(
  constraints: readonly ActiveConstraint[],
  date: string,
): ActiveConstraint[] {
  return constraints.filter((constraint) => constraintIsLiveOnDate(constraint, date));
}

function isRecoveryWorkout(workout: Workout): boolean {
  return workout.workoutType === 'Recovery' ||
    workout.sessionTier === 'recovery' ||
    /\brecovery\b/i.test(workout.name ?? '');
}

function isGlobalHardStop(
  constraints: readonly ActiveConstraint[],
  date: string,
): boolean {
  if (constraints.some((constraint) =>
    constraint.type === 'injury' && constraint.seriousSymptoms === true)) {
    return true;
  }
  return buildGenerationConstraintContext({
    activeConstraints: constraints,
    todayISO: date,
  })?.readiness?.fullPause === true;
}

function engineConstraintsFor(
  constraints: readonly ActiveConstraint[],
): Constraint[] {
  return buildConstraintPlans([...constraints]).map((plan) => plan.constraint);
}

function textIsRemovedByConstraints(
  text: string,
  constraints: readonly Constraint[],
): boolean {
  return !!text.trim() &&
    scoreExerciseAgainstConstraints(text, [...constraints]).decision === 'remove';
}

function speedBlockExposureText(workout: Workout): string {
  const block = workout.speedBlock;
  if (!block) return '';
  const typedExposure = block.kind === 'cod'
    ? 'sprint acceleration change of direction agility'
    : 'sprint acceleration high speed running';
  return `${typedExposure} ${block.title} ${block.label} ${block.prescription}`;
}

function applyTypedComponentValidation(args: {
  workout: Workout;
  constraints: readonly Constraint[];
  availableEquipment: readonly import('../data/exercisePools').EquipmentTag[] | null;
}): {
  workout: Workout;
  removedComponents: ActiveConstraintValidationResult['removedComponents'];
} {
  let workout = args.workout;
  const removedComponents: ActiveConstraintValidationResult['removedComponents'] = [];

  if (
    workout.speedBlock &&
    textIsRemovedByConstraints(speedBlockExposureText(workout), args.constraints)
  ) {
    workout = { ...workout, speedBlock: undefined };
    removedComponents.push('speed');
  }

  if (workout.powerBlock) {
    const typedPowerExposure = workout.powerBlock.family === 'lower'
      ? 'plyometric explosive lower jump'
      : 'explosive push';
    const options = workout.powerBlock.options.filter((option) =>
      !textIsRemovedByConstraints(`${typedPowerExposure} ${option.name}`, args.constraints) &&
      (!args.availableEquipment || equipmentRequirementsAreAvailable(
        option.equipmentRequired,
        args.availableEquipment,
      )),
    );
    if (options.length !== workout.powerBlock.options.length) {
      workout = options.length > 0
        ? { ...workout, powerBlock: { ...workout.powerBlock, options } }
        : { ...workout, powerBlock: undefined };
      if (options.length === 0) removedComponents.push('power');
    }
  }

  if (workout.recoveryAddons?.length) {
    const addons = workout.recoveryAddons
      .map((addon) => ({
        ...addon,
        exercises: addon.exercises.filter((exercise) =>
          !textIsRemovedByConstraints(exercise.name, args.constraints)),
      }))
      .filter((addon) => addon.exercises.length > 0);
    if (
      addons.length !== workout.recoveryAddons.length ||
      addons.some((addon, index) =>
        addon.exercises.length !== workout.recoveryAddons![index]?.exercises.length)
    ) {
      workout = { ...workout, recoveryAddons: addons.length > 0 ? addons : undefined };
      if (addons.length === 0) removedComponents.push('recovery_addon');
    }
  }

  if (workout.conditioningBlock) {
    const availableRowIds = new Set((workout.exercises ?? []).map((row) => row.id));
    const removeRowIds = new Set<string>();
    const options = workout.conditioningBlock.options.flatMap((option) => {
      const displayText = `${option.title} ${option.description}`;
      const typedModality = (option as typeof option & { modality?: string }).modality;
      const isRunning = typedModality === 'running' || /\b(?:run|running|jog)\b/i.test(displayText);
      const typedExposure = workout.conditioningBlock?.intent === 'high-intensity'
        ? isRunning
          ? 'hard running sprint high speed running repeat efforts'
          : 'hard off-feet conditioning repeat efforts'
        : workout.conditioningBlock?.intent === 'tempo'
          ? isRunning ? 'tempo running' : 'off-feet tempo conditioning'
          : isRunning ? 'easy aerobic running' : 'easy off-feet aerobic conditioning';
      // Typed modality/intent owns exposure. Copy remains supporting context,
      // so a generic title such as "Running intervals" cannot hide hard
      // running from an active lower-limb restriction.
      if (textIsRemovedByConstraints(`${typedExposure} ${displayText}`, args.constraints)) {
        for (const id of option.exerciseIds) removeRowIds.add(id);
        return [];
      }
      const exerciseIds = option.exerciseIds.filter((id) => availableRowIds.has(id));
      if (option.exerciseIds.length > 0 && exerciseIds.length === 0) return [];
      return [{ ...option, exerciseIds }];
    });

    const exercises = (workout.exercises ?? []).filter((row) => !removeRowIds.has(row.id));
    if (
      options.length !== workout.conditioningBlock.options.length ||
      exercises.length !== (workout.exercises ?? []).length
    ) {
      workout = options.length > 0
        ? {
            ...workout,
            exercises,
            conditioningBlock: { ...workout.conditioningBlock, options },
          }
        : {
            ...workout,
            exercises,
            hasCombinedConditioning: false,
            attachedConditioningKind: undefined,
            conditioningFlavour: undefined,
            conditioningCategory: undefined,
            conditioningBlock: undefined,
            coachAddedConditioningLabel: undefined,
          };
      if (options.length === 0) removedComponents.push('conditioning');
    }
  }

  return { workout, removedComponents };
}

/**
 * Validate one candidate workout. Null means the final pass removed every
 * meaningful component; callers with non-null storage schemas use the shared
 * Rest-shell helper before committing.
 */
export function validateWorkoutAgainstActiveConstraints(
  input: ActiveConstraintValidationInput,
): ActiveConstraintValidationResult {
  const unchanged = (workout: Workout | null): ActiveConstraintValidationResult => ({
    workout,
    changed: false,
    collapsedToRest: false,
    preservedAnchor: false,
    activeConstraintIds: [],
    removedExerciseNames: [],
    removedComponents: [],
  });

  if (!input.workout) return unchanged(input.workout);
  const active = input.date < input.todayISO
    ? []
    : liveConstraintsForDate(input.activeConstraints, input.date);
  const generationContext = buildGenerationConstraintContext({
    activeConstraints: active,
    todayISO: input.date,
  });
  const prohibitedPatterns = Array.from(resolveRestrictedMainStrengthPatterns({
    activeInjuries: generationContext?.injuries,
    profileInjuries: input.profile?.injuries,
  }));
  const lowerBodyRestriction = prohibitedPatterns.includes('squat') ||
    prohibitedPatterns.includes('hinge');
  const readinessPowerBlocked = generationContext?.readiness?.tier === 'moderate_reduction' ||
    generationContext?.readiness?.tier === 'major_reduction' ||
    generationContext?.readiness?.tier === 'full_pause';
  const canonical = finaliseWorkoutAfterMutation(input.workout, {
    ...input.canonicalContext,
    date: input.date,
    profile: input.profile,
    phase: input.canonicalContext?.phase ?? input.profile?.seasonPhase,
    prohibitedStrengthPatterns: uniquePatterns([
      ...(input.canonicalContext?.prohibitedStrengthPatterns ?? []),
      ...prohibitedPatterns,
    ]),
    prohibitPower: input.canonicalContext?.prohibitPower === true || readinessPowerBlocked,
    prohibitSprintHighSpeed: input.canonicalContext?.prohibitSprintHighSpeed === true ||
      lowerBodyRestriction || generationContext?.readiness?.avoidSprint === true,
  });
  const canonicalRemovedNames = canonical.actions
    .filter((action) => action.kind === 'row_removed' && !!action.item)
    .map((action) => action.item!);
  const canonicalRemovedPower = canonical.actions.some((action) => action.kind === 'power_removed');
  const canonicalRemovedSpeed = canonical.actions.some((action) =>
    action.reason === 'section18_safety_sprint_blocked');
  if (input.date < input.todayISO) {
    return {
      ...unchanged(canonical.workout),
      changed: canonical.changed,
      removedExerciseNames: canonicalRemovedNames,
      removedComponents: [
        ...(canonicalRemovedPower ? ['power' as const] : []),
        ...(canonicalRemovedSpeed ? ['speed' as const] : []),
      ],
    };
  }
  const powerAlignment = alignPowerBlockToFinalWorkoutContent(canonical.workout);
  const alignedWorkout = powerAlignment.workout;
  const alignmentRemovedComponents: ActiveConstraintValidationResult['removedComponents'] =
    powerAlignment.action === 'removed' ? ['power'] : [];
  const alignedResult = (): ActiveConstraintValidationResult => ({
    ...unchanged(alignedWorkout),
    changed: canonical.changed || powerAlignment.action !== 'unchanged',
    removedExerciseNames: canonicalRemovedNames,
    removedComponents: Array.from(new Set([
      ...(canonicalRemovedPower ? ['power' as const] : []),
      ...(canonicalRemovedSpeed ? ['speed' as const] : []),
      ...alignmentRemovedComponents,
    ])),
  });
  if (active.length === 0) {
    if (!hasMeaningfulWorkoutContent(alignedWorkout)) {
      return {
        ...alignedResult(),
        workout: null,
        collapsedToRest: true,
      };
    }
    return alignedResult();
  }

  if (isGlobalHardStop(active, input.date) && !isRecoveryWorkout(alignedWorkout)) {
    return {
      workout: null,
      changed: true,
      collapsedToRest: true,
      preservedAnchor: false,
      activeConstraintIds: active.map((constraint) => constraint.id),
      removedExerciseNames: (alignedWorkout.exercises ?? [])
        .map((row) => row.exercise?.name ?? '')
        .filter(Boolean),
      removedComponents: Array.from(new Set([
        ...(canonicalRemovedPower ? ['power' as const] : []),
        ...(alignedWorkout.conditioningBlock ? ['conditioning' as const] : []),
        ...(alignedWorkout.speedBlock ? ['speed' as const] : []),
        ...(alignedWorkout.powerBlock || alignmentRemovedComponents.includes('power') ? ['power' as const] : []),
        ...(alignedWorkout.recoveryAddons?.length ? ['recovery_addon' as const] : []),
      ])),
    };
  }

  const classification = classifyVisibleSession(alignedWorkout);
  if (classification.anchors.game || classification.anchors.teamTraining) {
    return {
      ...alignedResult(),
      preservedAnchor: true,
      activeConstraintIds: active.map((constraint) => constraint.id),
    };
  }

  let workout = alignedWorkout;
  const beforeNames = new Set(
    (workout.exercises ?? []).map((row) => row.exercise?.name ?? '').filter(Boolean),
  );

  for (const injury of active.filter(
    (constraint): constraint is ActiveInjuryConstraint =>
      constraint.type === 'injury' && !!constraint.bucket,
  )) {
    workout = applyInjuryFilterToWorkout(workout, {
      bodyPart: injury.bodyPart,
      bucket: injury.bucket,
      severity: injury.severity,
      status: injury.status,
    });
  }

  const engineConstraints = engineConstraintsFor(active);
  if (engineConstraints.length > 0) {
    const applied = applyConstraintsToSession(workout, engineConstraints);
    if (applied.applied) workout = applied.workout;
  }

  const hasEquipmentConstraint = active.some((constraint) => constraint.type === 'equipment');
  const availableEquipment = hasEquipmentConstraint
    ? resolveEquipmentAvailability(input.profile, active, input.date)
    : null;
  if (availableEquipment) {
    const exercises = (workout.exercises ?? []).filter((row) =>
      equipmentRequirementsAreAvailable(
        row.exercise?.equipmentRequired,
        availableEquipment,
      ));
    if (exercises.length !== (workout.exercises ?? []).length) {
      workout = { ...workout, exercises };
    }
  }

  const componentResult = applyTypedComponentValidation({
    workout,
    constraints: engineConstraints,
    availableEquipment,
  });
  // Constraints are allowed to remove planned work. Re-run the same shape
  // canonicaliser afterwards, but never restore content that safety just
  // removed. This keeps type/name/components honest without fighting injury,
  // readiness or equipment policy.
  const postConstraintCanonical = finaliseWorkoutAfterMutation(componentResult.workout, {
    ...input.canonicalContext,
    date: input.date,
    profile: input.profile,
    phase: input.canonicalContext?.phase ?? input.profile?.seasonPhase,
    restoreMissingPlanPatterns: false,
  });
  workout = postConstraintCanonical.workout;
  const postCanonicalRemovedNames = postConstraintCanonical.actions
    .filter((action) => action.kind === 'row_removed' && !!action.item)
    .map((action) => action.item!);
  const postCanonicalRemovedPower = postConstraintCanonical.actions.some(
    (action) => action.kind === 'power_removed',
  );
  const removedComponents = Array.from(new Set([
    ...(canonicalRemovedPower ? ['power' as const] : []),
    ...(canonicalRemovedSpeed ? ['speed' as const] : []),
    ...alignmentRemovedComponents,
    ...componentResult.removedComponents,
    ...(postCanonicalRemovedPower ? ['power' as const] : []),
  ])) as ActiveConstraintValidationResult['removedComponents'];

  const afterNames = new Set(
    (workout.exercises ?? []).map((row) => row.exercise?.name ?? '').filter(Boolean),
  );
  const removedExerciseNames = Array.from(new Set([
    ...canonicalRemovedNames,
    ...postCanonicalRemovedNames,
    ...Array.from(beforeNames).filter((name) => !afterNames.has(name)),
  ]));
  if (!hasMeaningfulWorkoutContent(workout)) {
    return {
      workout: null,
      changed: true,
      collapsedToRest: true,
      preservedAnchor: false,
      activeConstraintIds: active.map((constraint) => constraint.id),
      removedExerciseNames,
      removedComponents,
    };
  }

  return {
    workout,
    changed: canonical.changed || postConstraintCanonical.changed || workout !== canonical.workout,
    collapsedToRest: false,
    preservedAnchor: false,
    activeConstraintIds: active.map((constraint) => constraint.id),
    removedExerciseNames,
    removedComponents,
  };
}

export function validateWeekAgainstActiveConstraints<T extends { date: string; workout: Workout | null }>(
  args: Omit<ActiveConstraintValidationInput, 'date' | 'workout'> & { days: readonly T[] },
): T[] {
  return args.days.map((day) => ({
    ...day,
    workout: validateWorkoutAgainstActiveConstraints({
      ...args,
      date: day.date,
      workout: day.workout,
    }).workout,
  }));
}

function dateForWorkout(microcycle: Microcycle, workout: Workout): string {
  const start = microcycle.startDate.slice(0, 10);
  const startDow = new Date(`${start}T12:00:00`).getDay();
  const offset = (workout.dayOfWeek - startDow + 7) % 7;
  return addDaysISO(start, offset);
}

const EXPOSURE_DAY_NUMBERS: Readonly<Record<string, number>> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function reResolveContractForActiveConstraints(args: {
  contract: WeeklyExposureContract;
  microcycle: Microcycle;
  activeConstraints: readonly ActiveConstraint[];
  profile?: OnboardingData | null;
  teamTrainingDayNumbers?: readonly number[];
  hasGame?: boolean;
  gameDay?: number | null;
}): WeeklyExposureContract {
  const profile = args.profile;
  if (!profile) return args.contract;
  const teamTrainingDayNumbers = args.teamTrainingDayNumbers
    ? Array.from(new Set(args.teamTrainingDayNumbers)).sort((a, b) => a - b)
    : args.contract.anchors.teamTrainingDays;
  const hasGame = args.hasGame ?? args.contract.anchors.gameDay !== null;
  const gameDay = hasGame
    ? args.gameDay !== undefined ? args.gameDay : args.contract.anchors.gameDay
    : null;
  const anchorsChanged =
    JSON.stringify(teamTrainingDayNumbers) !==
      JSON.stringify([...args.contract.anchors.teamTrainingDays].sort((a, b) => a - b)) ||
    hasGame !== (args.contract.anchors.gameDay !== null) ||
    gameDay !== args.contract.anchors.gameDay;
  if (args.activeConstraints.length === 0 && !anchorsChanged) return args.contract;
  const weekStart = args.microcycle.startDate.slice(0, 10);
  const generationContext = buildGenerationConstraintContext({
    activeConstraints: args.activeConstraints,
    todayISO: weekStart,
    periodEndISO: args.microcycle.endDate.slice(0, 10),
  });

  const selected = new Set<number>();
  for (const day of profile.preferredTrainingDays ?? []) {
    const number = EXPOSURE_DAY_NUMBERS[day];
    if (number !== undefined) selected.add(number);
  }
  const hasDeclaredAvailability = selected.size > 0;
  for (const day of teamTrainingDayNumbers) selected.add(day);
  // Legacy profiles may not retain preferred weekdays. Their generated
  // microcycle is the best available record of the declared schedulable set;
  // this only supplies availability, never achieved exposure.
  if (!hasDeclaredAvailability) {
    for (const workout of args.microcycle.workouts) selected.add(workout.dayOfWeek);
  }

  const equipment = resolveEquipmentCapabilities(
    profile,
    args.activeConstraints,
    weekStart,
  );
  const substitutionPolicy = resolveConditioningSubstitutionPolicy({
    phase: args.contract.identity.phase,
    equipment,
    profile,
    generationConstraints: generationContext,
  });
  const readinessSignal = useReadinessStore.getState().signalsByDate?.[weekStart] ?? null;
  const readiness = profile.conditioningLevel || profile.recentTrainingLoad
    ? deriveScheduleReadiness({ onboardingData: profile, signal: readinessSignal })
    : args.contract.strength.targetCount >= args.contract.strength.preferred.max
      ? 'high'
      : 'medium';
  const subphase = args.contract.identity.subphase;
  const offseasonSubphase =
    subphase === 'early_offseason' ||
    subphase === 'mid_offseason' ||
    subphase === 'late_offseason'
      ? subphase
      : null;
  const preseasonSubphase =
    subphase === 'early_preseason' ||
    subphase === 'mid_preseason' ||
    subphase === 'late_preseason'
      ? subphase
      : null;
  return buildWeeklyExposureContract({
    seasonPhase: args.contract.identity.phase,
    readiness,
    selectedDayNumbers: Array.from(selected),
    teamTrainingDayNumbers,
    hasGame,
    gameDay,
    weekKind: args.contract.identity.weekKind,
    offseasonSubphase: resolveOffseasonSubphase({
      seasonPhase: args.contract.identity.phase,
      explicitSubphase: offseasonSubphase,
    }),
    preseasonSubphase: resolvePreseasonSubphase({
      seasonPhase: args.contract.identity.phase,
      explicitSubphase: preseasonSubphase,
    }),
    activeReadinessTier: generationContext?.readiness?.tier,
    maxStrengthSessions: profile.experienceLevel
      ? resolveTrainingAgePolicy(profile.experienceLevel).maxCoreSessions
      : null,
    appConditioningFeasible: substitutionPolicy.appConditioningFeasible ?? undefined,
    attemptedConditioningSubstitutions: substitutionPolicy.consideredSubstitutions,
    profileInjuries: profile.injuries,
    activeInjuries: generationContext?.injuries,
    byeMode: args.contract.identity.mode === 'in_season_bye_recovery'
      ? 'recovery'
      : args.contract.identity.mode === 'in_season_bye_build'
        ? 'build'
        : undefined,
  });
}

function assertEffectiveMicrocycleExposure(microcycle: Microcycle): void {
  if (!microcycle.exposureContract) return;
  const validation = evaluateEffectiveWeekExposureContract(
    microcycle.exposureContract,
    microcycle.workouts,
    microcycle.startDate.slice(0, 10),
  );
  if (validation.accepted) return;
  const detail = validation.unresolvedShortfalls
    .map((entry) => `${entry.code}:${entry.domain ?? 'safety'}=${JSON.stringify(entry.actual)}`)
    .join(', ');
  throw new Error(`Final effective-week exposure contract unresolved (${detail})`);
}

function resolveLiveDateMutationExposure(args: {
  date: string;
  workout: Workout;
  context: ReturnType<typeof liveValidationContext>;
}): { weekStart: string; contract: WeeklyExposureContract } | null {
  const state = require('../store/programStore').useProgramStore.getState();
  const microcycle = selectMicrocycleForDate(
    state.currentProgram,
    state.currentMicrocycle,
    args.date,
  );
  const v2Overlay = state.weekScopedOverlays?.[
    addDaysISO(args.date, -((new Date(`${args.date}T12:00:00`).getDay() + 6) % 7))
  ] as WeekScopedWorkoutOverlay | undefined;
  if (microcycle?.exposureContractV2 || v2Overlay?.exposureContractV2) {
    // Contract v2 was already enforced by finaliseLiveDateCandidateAgainstWeek.
    // The legacy ledger cannot represent stacked same-day credits and must
    // not become a second, contradictory commit authority.
    return null;
  }
  if (!microcycle?.exposureContract) return null;
  const weekStart = addDaysISO(args.date, -((new Date(`${args.date}T12:00:00`).getDay() + 6) % 7));
  const overlay = state.weekScopedOverlays?.[weekStart] as WeekScopedWorkoutOverlay | undefined;
  const contract = state.exposureContractsByWeek?.[weekStart] ??
    overlay?.exposureContract ?? microcycle.exposureContract;
  const workouts: Workout[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = addDaysISO(weekStart, offset);
    const dow = new Date(`${date}T12:00:00`).getDay();
    const hasOverlayEntry = !!overlay && Object.prototype.hasOwnProperty.call(
      overlay.workoutsByDate,
      date,
    );
    const workout = date === args.date
      ? args.workout
      : state.dateOverrides?.[date] ?? (
          hasOverlayEntry
            ? overlay!.workoutsByDate[date]
            : microcycle.workouts.find((candidate: Workout) => candidate.dayOfWeek === dow) ?? null
        );
    if (workout) workouts.push(workout);
  }
  const editedDay = new Date(`${args.date}T12:00:00`).getDay();
  const editedClassification = classifyVisibleSession(args.workout);
  const originalGameDay = contract.anchors.gameDay;
  const explicitlyChangedGameAnchor =
    editedClassification.anchors.game || editedDay === originalGameDay;
  const resolvedGameDay = editedClassification.anchors.game
    ? editedDay
    : explicitlyChangedGameAnchor
      ? null
      : originalGameDay;
  let resolvedContract = reResolveContractForActiveConstraints({
    contract,
    microcycle,
    activeConstraints: args.context.activeConstraints,
    profile: args.context.profile,
    teamTrainingDayNumbers: workouts
      .filter((candidate) => classifyVisibleSession(candidate).anchors.teamTraining)
      .map((candidate) => candidate.dayOfWeek),
    hasGame: resolvedGameDay !== null,
    gameDay: resolvedGameDay,
  });
  const validation = evaluateEffectiveWeekExposureContract(
    resolvedContract,
    workouts,
    weekStart,
  );
  if (!validation.accepted) {
    const detail = validation.unresolvedShortfalls
      .map((entry) => `${entry.code}:${entry.domain ?? 'safety'}=${JSON.stringify(entry.actual)}`)
      .join(', ');
    throw new Error(`Final effective-week exposure contract unresolved (${detail})`);
  }
  return { weekStart, contract: resolvedContract };
}

function isoDayDiff(date: string, gameDate: string): number {
  const [dy, dm, dd] = date.slice(0, 10).split('-').map(Number);
  const [gy, gm, gd] = gameDate.slice(0, 10).split('-').map(Number);
  return Math.round(
    (Date.UTC(dy, dm - 1, dd) - Date.UTC(gy, gm - 1, gd)) / 86_400_000,
  );
}

function gameProximityContext(
  date: string,
  gameDates: readonly string[],
): Pick<WorkoutCanonicalisationContext, 'hasGame' | 'gOffset'> {
  const offsets = gameDates.map((gameDate) => isoDayDiff(date, gameDate))
    .filter((offset) => offset >= -6 && offset <= 1)
    .sort((a, b) => Math.abs(a) - Math.abs(b));
  return offsets.length > 0
    ? { hasGame: true, gOffset: offsets[0] }
    : { hasGame: false };
}

export function validateMicrocycleAgainstActiveConstraints(args: {
  microcycle: Microcycle;
  todayISO: string;
  activeConstraints: readonly ActiveConstraint[];
  profile?: OnboardingData | null;
  canonicalContext?: WorkoutCanonicalisationContext;
}): Microcycle {
  let changed = false;
  const weekStart = args.microcycle.startDate.slice(0, 10);
  const generationContext = buildGenerationConstraintContext({
    activeConstraints: args.activeConstraints,
    todayISO: weekStart,
    periodEndISO: args.microcycle.endDate.slice(0, 10),
  });
  const forceFullPause = args.activeConstraints.some((constraint) =>
    constraint.type === 'injury' && constraint.status !== 'resolved' &&
    constraint.seriousSymptoms === true);
  let exposureContractV2: WeeklyExposureContractV2 | undefined =
    args.microcycle.exposureContractV2 ?? (
      args.microcycle.exposureContract
        ? migrateLegacyWeeklyExposureContractV2(args.microcycle.exposureContract, {
            blockNumber: args.microcycle.miniCycleNumber,
            weekInBlock: ((Math.max(1, args.microcycle.weekNumber) - 1) % 4) + 1,
            globalWeek: args.microcycle.weekNumber,
          })
        : undefined
    );
  if (exposureContractV2) {
    exposureContractV2 = applyGenerationSafetyToSection18Contract({
      contract: exposureContractV2,
      generationConstraints: generationContext,
      forceFullPause,
    });
  }
  const datedWorkouts = args.microcycle.workouts.map((workout) => ({
    date: dateForWorkout(args.microcycle, workout),
    workout,
  }));
  const gameDates = datedWorkouts
    .filter(({ workout }) => classifyVisibleSession(workout).anchors.game)
    .map(({ date }) => date);
  const workouts = args.microcycle.workouts.map((workout) => {
    const date = dateForWorkout(args.microcycle, workout);
    const result = validateWorkoutAgainstActiveConstraints({
      workout,
      date,
      todayISO: args.todayISO,
      activeConstraints: args.activeConstraints,
      profile: args.profile,
      canonicalContext: {
        ...args.canonicalContext,
        phase: args.canonicalContext?.phase ?? args.profile?.seasonPhase,
        offseasonSubphase: args.canonicalContext?.offseasonSubphase ??
          resolveOffseasonSubphase({
            seasonPhase: args.profile?.seasonPhase,
            explicitSubphase: exposureContractV2?.identity.declaredSubphase === 'early_offseason' ||
              exposureContractV2?.identity.declaredSubphase === 'mid_offseason' ||
              exposureContractV2?.identity.declaredSubphase === 'late_offseason'
              ? exposureContractV2.identity.declaredSubphase
              : null,
          }),
        weekKind: args.canonicalContext?.weekKind ?? args.microcycle.weekKind,
        ...gameProximityContext(date, gameDates),
        planIntentValid: !!workout.planEntryId,
        referenceWorkout: workout,
        prohibitedStrengthPatterns: exposureContractV2?.safety.prohibitedPatterns,
        prohibitPower: exposureContractV2?.safety.prohibitedPower,
        prohibitSprintHighSpeed: exposureContractV2?.safety.prohibitedSprintHighSpeed,
      },
    });
    if (result.changed) changed = true;
    return result.workout ?? collapseWorkoutToRest(workout);
  });
  let exposureContract = args.microcycle.exposureContract
    ? reResolveContractForActiveConstraints({
        contract: args.microcycle.exposureContract,
        microcycle: args.microcycle,
        activeConstraints: args.activeConstraints,
        profile: args.profile,
        teamTrainingDayNumbers: workouts
          .filter((workout) => classifyVisibleSession(workout).anchors.teamTraining)
          .map((workout) => workout.dayOfWeek),
      })
    : undefined;
  let safetyWorkouts = workouts;
  if (exposureContractV2) {
    const safety = finaliseSection18SafetyWeek({
      contract: exposureContractV2,
      workouts,
      weekStart,
      canonicalContext: {
        ...args.canonicalContext,
        phase: args.canonicalContext?.phase ?? args.profile?.seasonPhase,
        weekKind: args.canonicalContext?.weekKind ?? args.microcycle.weekKind,
        profile: args.profile,
      },
    });
    safetyWorkouts = safety.workouts;
    exposureContractV2 = safety.contract;
    const accepted = requireSection18AcceptedWeek({
      contract: exposureContractV2,
      workouts: safetyWorkouts,
      weekStart,
      profile: args.profile,
    });
    safetyWorkouts = accepted.canonicalWorkouts;
    exposureContractV2 = accepted.contract;
  }
  const contractChanged = (
    exposureContract !== args.microcycle.exposureContract &&
    JSON.stringify(exposureContract) !== JSON.stringify(args.microcycle.exposureContract)
  ) || JSON.stringify(exposureContractV2) !== JSON.stringify(args.microcycle.exposureContractV2);
  const workoutsChanged = JSON.stringify(safetyWorkouts) !== JSON.stringify(args.microcycle.workouts);
  const validated = changed || contractChanged || workoutsChanged
    ? { ...args.microcycle, workouts: safetyWorkouts, exposureContract, exposureContractV2 }
    : args.microcycle;
  if (!validated.exposureContractV2) assertEffectiveMicrocycleExposure(validated);
  return validated;
}

export function validateProgramAgainstActiveConstraints(args: {
  program: TrainingProgram;
  todayISO: string;
  activeConstraints: readonly ActiveConstraint[];
  profile?: OnboardingData | null;
}): TrainingProgram {
  let changed = false;
  const microcycles = args.program.microcycles.map((microcycle) => {
    const validated = validateMicrocycleAgainstActiveConstraints({ ...args, microcycle });
    if (validated !== microcycle) changed = true;
    return validated;
  });
  return changed ? { ...args.program, microcycles } : args.program;
}

export function validateWeekOverlayAgainstActiveConstraints(args: {
  overlay: WeekScopedWorkoutOverlay;
  todayISO: string;
  activeConstraints: readonly ActiveConstraint[];
  profile?: OnboardingData | null;
  canonicalContext?: WorkoutCanonicalisationContext;
}): WeekScopedWorkoutOverlay {
  let changed = false;
  let workoutsByDate = Object.fromEntries(
    Object.entries(args.overlay.workoutsByDate).map(([date, workout]) => {
      const result = validateWorkoutAgainstActiveConstraints({ ...args, date, workout });
      if (result.changed) changed = true;
      return [date, result.workout];
    }),
  );
  let validated = changed ? { ...args.overlay, workoutsByDate } : args.overlay;
  const contract = validated.exposureContractV2 ?? (
    validated.exposureContract
      ? migrateLegacyWeeklyExposureContractV2(validated.exposureContract)
      : undefined
  );
  if (contract) {
    const accepted = requireSection18AcceptedWeek({
      contract,
      workouts: Object.values(workoutsByDate).filter((workout): workout is Workout => !!workout),
      weekStart: validated.weekStart,
      profile: args.profile,
    });
    const byDay = new Map(accepted.canonicalWorkouts.map((workout) => [workout.dayOfWeek, workout]));
    workoutsByDate = Object.fromEntries(
      Object.keys(workoutsByDate).map((date) => {
        const day = new Date(`${date}T12:00:00`).getDay();
        return [date, byDay.get(day) ?? null];
      }),
    );
    validated = {
      ...validated,
      exposureContractV2: accepted.contract,
      workoutsByDate,
    };
  }
  return validated;
}

function liveValidationContext(): {
  todayISO: string;
  activeConstraints: ActiveConstraint[];
  profile: OnboardingData;
} {
  const activeById = new Map<string, ActiveConstraint>();
  for (const constraint of useCoachUpdatesStore.getState().activeConstraints ?? []) {
    activeById.set(constraint.id, constraint);
  }
  for (const signal of Object.values(useReadinessStore.getState().signalsByDate ?? {})) {
    for (const constraint of buildReadinessActiveConstraints(signal)) {
      activeById.set(constraint.id, constraint);
    }
  }
  return {
    todayISO: todayISOLocal(),
    activeConstraints: Array.from(activeById.values()),
    profile: useProfileStore.getState().onboardingData,
  };
}

function liveWorkoutCanonicalisationContext(
  date: string,
  workout: Workout,
  profile: OnboardingData,
): WorkoutCanonicalisationContext {
  // Dynamic access avoids making ProgramStore statically import itself through
  // this final write module.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const state = require('../store/programStore').useProgramStore.getState();
  const datedProgramWorkouts: Array<{ date: string; workout: Workout }> =
    (state.currentProgram?.microcycles ?? []).flatMap((microcycle: Microcycle) =>
      (microcycle.workouts ?? []).map((candidate) => ({
        date: dateForWorkout(microcycle, candidate),
        workout: candidate,
      })),
    );
  const allProgramWorkouts = datedProgramWorkouts.map(({ workout: candidate }) => candidate);
  const referenceWorkout = workout.planEntryId
    ? allProgramWorkouts.find((candidate) => candidate.planEntryId === workout.planEntryId) ?? null
    : null;
  const planIntentValid = !!workout.planEntryId && !!referenceWorkout;
  const phaseResolution = resolveSeasonPhaseClock({
    selectedPhase: profile.seasonPhase ?? 'Pre-season',
    targetWeekStartISO: date,
    persistedClock: state.currentProgram?.seasonPhaseClock,
    legacyProgram: state.currentProgram,
  });
  const signal = useReadinessStore.getState().signalsByDate?.[date] ?? null;
  const gameDates = new Set(
    datedProgramWorkouts
      .filter(({ workout: candidate }) => classifyVisibleSession(candidate).anchors.game)
      .map(({ date: gameDate }) => gameDate),
  );
  if (classifyVisibleSession(workout).anchors.game) gameDates.add(date);
  const markedDays = useCalendarStore.getState().markedDays ?? {};
  for (const [markedDate, kind] of Object.entries(markedDays)) {
    if (kind === 'game') gameDates.add(markedDate);
  }
  const usualGameDay = profile.usualGameDay ??
    (profile.gameDay !== 'Varies' ? profile.gameDay : undefined);
  if (profile.seasonPhase === 'In-season' && usualGameDay) {
    const dayNumbers: Record<string, number> = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
      Thursday: 4, Friday: 5, Saturday: 6,
    };
    const dateDow = new Date(`${date.slice(0, 10)}T12:00:00`).getDay();
    const monday = addDaysISO(date, -((dateDow + 6) % 7));
    const virtualGameDate = addDaysISO(monday, (dayNumbers[usualGameDay] + 6) % 7);
    const sunday = addDaysISO(monday, 6);
    const explicitGameThisWeek = Array.from(gameDates).some((gameDate) =>
      gameDate >= monday && gameDate <= sunday,
    );
    if (!explicitGameThisWeek && !['noGame', 'rest'].includes(markedDays[virtualGameDate])) {
      gameDates.add(virtualGameDate);
    }
  }
  return {
    date,
    phase: profile.seasonPhase,
    offseasonSubphase: phaseResolution.offseasonSubphase,
    weekKind: phaseResolution.weekKind,
    readiness: deriveScheduleReadiness({ onboardingData: profile, signal }),
    ...gameProximityContext(date, Array.from(gameDates)),
    profile,
    planIntentValid,
    referenceWorkout,
  };
}

function finaliseLiveDateCandidateAgainstWeek(args: {
  date: string;
  workout: Workout;
  context: ReturnType<typeof liveValidationContext>;
}): Workout {
  const state = require('../store/programStore').useProgramStore.getState();
  const microcycle = selectMicrocycleForDate(
    state.currentProgram,
    state.currentMicrocycle,
    args.date,
  );
  if (
    !microcycle ||
    args.date < microcycle.startDate.slice(0, 10) ||
    args.date > microcycle.endDate.slice(0, 10)
  ) {
    // A future override outside the currently materialised block has no
    // approved target-week contract yet. Preserve it for the rebuild/rollover
    // path, which composes and gates it once that target week exists; never
    // validate it against the nearest/current microcycle by accident.
    return args.workout;
  }
  const weekStart = addDaysISO(
    args.date,
    -((new Date(`${args.date}T12:00:00`).getDay() + 6) % 7),
  );
  const overlay = state.weekScopedOverlays?.[weekStart] as WeekScopedWorkoutOverlay | undefined;
  let contract = overlay?.exposureContractV2 ?? microcycle.exposureContractV2 ?? (
    microcycle.exposureContract
      ? migrateLegacyWeeklyExposureContractV2(microcycle.exposureContract, {
          blockNumber: microcycle.miniCycleNumber,
          weekInBlock: ((Math.max(1, microcycle.weekNumber) - 1) % 4) + 1,
          globalWeek: microcycle.weekNumber,
        })
      : null
  );
  if (!contract) return args.workout;
  const generationContext = buildGenerationConstraintContext({
    activeConstraints: args.context.activeConstraints,
    todayISO: weekStart,
    periodEndISO: addDaysISO(weekStart, 6),
  });
  contract = applyGenerationSafetyToSection18Contract({
    contract,
    generationConstraints: generationContext,
    forceFullPause: args.context.activeConstraints.some((constraint) =>
      constraint.type === 'injury' && constraint.status !== 'resolved' &&
      constraint.seriousSymptoms === true),
  });

  const workouts: Workout[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = addDaysISO(weekStart, offset);
    if (date === args.date) continue;
    const manual = state.dateOverrides?.[date] as Workout | undefined;
    const hasOverlayEntry = !!overlay && Object.prototype.hasOwnProperty.call(
      overlay.workoutsByDate,
      date,
    );
    const dow = new Date(`${date}T12:00:00`).getDay();
    const workout = manual ?? (
      hasOverlayEntry
        ? overlay!.workoutsByDate[date]
        : microcycle.workouts.find((candidate: Workout) => candidate.dayOfWeek === dow) ?? null
    );
    if (workout) workouts.push(workout);
  }
  // The candidate is deliberately last: an explicit edit may not displace
  // already-authorised sessions to bypass a safety frequency ceiling.
  workouts.push(args.workout);
  const accepted = requireSection18AcceptedWeek({
    contract,
    workouts,
    weekStart,
    profile: args.context.profile,
    // A single-date store primitive cannot atomically persist repairs to
    // other dates. Reject cross-day repair needs; week/overlay writers can
    // use the full deterministic repair loop.
    maxRepairAttempts: 1,
  });
  return [...accepted.canonicalWorkouts].reverse().find((workout) => workout.id === args.workout.id) ??
    [...accepted.canonicalWorkouts].reverse().find((workout) => workout.dayOfWeek === args.workout.dayOfWeek) ??
    collapseWorkoutToRest(args.workout);
}

/** Live-store wrappers used by ProgramStore's four final write primitives. */
export function validateLiveProgramWrite(program: TrainingProgram): TrainingProgram {
  return validateProgramAgainstActiveConstraints({ ...liveValidationContext(), program });
}

export function validateLiveMicrocycleWrite(microcycle: Microcycle): Microcycle {
  return validateMicrocycleAgainstActiveConstraints({ ...liveValidationContext(), microcycle });
}

export function validateLiveWorkoutWrite(
  date: string,
  workout: Workout,
  options: { restoreMissingPlanPatterns?: boolean } = {},
): Workout {
  const context = liveValidationContext();
  const result = validateWorkoutAgainstActiveConstraints({
    ...context,
    date,
    workout,
    canonicalContext: {
      ...liveWorkoutCanonicalisationContext(date, workout, context.profile),
      restoreMissingPlanPatterns: options.restoreMissingPlanPatterns,
    },
  });
  const validated = result.workout ?? collapseWorkoutToRest(workout);
  return finaliseLiveDateCandidateAgainstWeek({ date, workout: validated, context });
}

/** Resolve and validate the contract owned by an explicit date override. */
export function resolveLiveDateMutationExposureContract(
  date: string,
  workout: Workout,
): { weekStart: string; contract: WeeklyExposureContract } | null {
  return resolveLiveDateMutationExposure({
    date,
    workout,
    context: liveValidationContext(),
  });
}

export function resolveLiveEditedWeekExposureContract(
  weekStart: string,
): { weekStart: string; contract: WeeklyExposureContract } | null {
  const state = require('../store/programStore').useProgramStore.getState();
  const weekEnd = addDaysISO(weekStart, 6);
  const dates = Object.keys(state.dateOverrides ?? {})
    .filter((date) => date >= weekStart && date <= weekEnd)
    .sort();
  const date = dates[dates.length - 1];
  const workout = date ? state.dateOverrides[date] as Workout | undefined : undefined;
  if (!date || !workout) return null;
  return resolveLiveDateMutationExposure({
    date,
    workout,
    context: liveValidationContext(),
  });
}

export function validateLiveNullableWorkoutWrite(
  date: string,
  workout: Workout | null,
): Workout | null {
  if (!workout) return null;
  const state = require('../store/programStore').useProgramStore.getState();
  const storedCandidates: Workout[] = [
    ...(state.currentProgram?.microcycles.flatMap((microcycle: Microcycle) => microcycle.workouts) ?? []),
    ...(state.currentMicrocycle?.workouts ?? []),
    ...Object.values(state.dateOverrides ?? {}) as Workout[],
    ...Object.values(state.weekScopedOverlays ?? {}).flatMap((overlay) =>
      Object.values((overlay as WeekScopedWorkoutOverlay).workoutsByDate)
        .filter((candidate): candidate is Workout => !!candidate)),
  ];
  if (storedCandidates.some((candidate) =>
    candidate.id === workout.id && JSON.stringify(candidate) === JSON.stringify(workout))) {
    // todayWorkout is a cache/reference when it points at content already
    // accepted on another persisted surface. Re-evaluating it against the
    // machine's current date would invent a different target week (notably in
    // fixed-date rebuild and rollover flows).
    return workout;
  }
  const context = liveValidationContext();
  const validated = validateWorkoutAgainstActiveConstraints({
    ...context,
    date,
    workout,
    canonicalContext: liveWorkoutCanonicalisationContext(date, workout, context.profile),
  }).workout;
  return validated
    ? finaliseLiveDateCandidateAgainstWeek({ date, workout: validated, context })
    : null;
}

export function validateLiveWeekOverlayWrite(
  overlay: WeekScopedWorkoutOverlay,
): WeekScopedWorkoutOverlay {
  const context = liveValidationContext();
  let changed = false;
  let workoutsByDate = Object.fromEntries(
    Object.entries(overlay.workoutsByDate).map(([date, workout]) => {
      if (!workout) return [date, null];
      const result = validateWorkoutAgainstActiveConstraints({
        ...context,
        date,
        workout,
        canonicalContext: liveWorkoutCanonicalisationContext(date, workout, context.profile),
      });
      if (result.changed) changed = true;
      return [date, result.workout];
    }),
  );
  let validatedOverlay = changed ? { ...overlay, workoutsByDate } : overlay;
  const state = require('../store/programStore').useProgramStore.getState();
  const baseMicrocycle = (state.currentProgram?.microcycles ?? []).find(
    (microcycle: Microcycle) =>
      overlay.weekStart >= microcycle.startDate.slice(0, 10) &&
      overlay.weekStart <= microcycle.endDate.slice(0, 10),
  ) ?? (
    state.currentMicrocycle &&
    overlay.weekStart >= state.currentMicrocycle.startDate.slice(0, 10) &&
    overlay.weekStart <= state.currentMicrocycle.endDate.slice(0, 10)
      ? state.currentMicrocycle
      : null
  );
  const exposureContract = state.exposureContractsByWeek?.[overlay.weekStart] ??
    validatedOverlay.exposureContract ?? baseMicrocycle?.exposureContract;
  const persistedExposureContractV2 = validatedOverlay.exposureContractV2 ??
    baseMicrocycle?.exposureContractV2;
  if (!exposureContract && !persistedExposureContractV2) return validatedOverlay;

  let effectiveWorkouts: Workout[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = addDaysISO(overlay.weekStart, offset);
    const manual = state.dateOverrides?.[date] as Workout | undefined;
    const hasOverlayEntry = Object.prototype.hasOwnProperty.call(workoutsByDate, date);
    const dow = new Date(`${date}T12:00:00`).getDay();
    const workout = manual ?? (
      hasOverlayEntry
        ? workoutsByDate[date]
        : baseMicrocycle?.workouts.find((candidate: Workout) => candidate.dayOfWeek === dow) ?? null
    );
    if (workout) effectiveWorkouts.push(workout);
  }
  let exposureContractV2 = persistedExposureContractV2 ?? (
    exposureContract ? migrateLegacyWeeklyExposureContractV2(exposureContract) : undefined
  );
  const generationContext = buildGenerationConstraintContext({
    activeConstraints: context.activeConstraints,
    todayISO: overlay.weekStart,
    periodEndISO: overlay.weekEnd,
  });
  if (exposureContractV2) {
    exposureContractV2 = applyGenerationSafetyToSection18Contract({
      contract: exposureContractV2,
      generationConstraints: generationContext,
      forceFullPause: context.activeConstraints.some((constraint) =>
        constraint.type === 'injury' && constraint.status !== 'resolved' &&
        constraint.seriousSymptoms === true),
    });
    const accepted = requireSection18AcceptedWeek({
      contract: exposureContractV2,
      workouts: effectiveWorkouts,
      weekStart: overlay.weekStart,
      profile: context.profile,
    });
    const beforeSafety = effectiveWorkouts;
    effectiveWorkouts = accepted.canonicalWorkouts;
    const safeByDay = new Map(effectiveWorkouts.map((workout) => [workout.dayOfWeek, workout]));
    for (let offset = 0; offset < 7; offset++) {
      const date = addDaysISO(overlay.weekStart, offset);
      const dow = new Date(`${date}T12:00:00`).getDay();
      const before = beforeSafety.find((workout) => workout.dayOfWeek === dow) ?? null;
      const after = safeByDay.get(dow) ?? null;
      if (
        Object.prototype.hasOwnProperty.call(workoutsByDate, date) ||
        JSON.stringify(before) !== JSON.stringify(after)
      ) {
        workoutsByDate[date] = after;
      }
    }
    validatedOverlay = {
      ...validatedOverlay,
      workoutsByDate,
      exposureContractV2: accepted.contract,
    };
  }
  if (!exposureContract || !!persistedExposureContractV2) return validatedOverlay;
  const targetMicrocycle: Microcycle = {
    ...(baseMicrocycle ?? {
      id: validatedOverlay.id,
      programId: state.currentProgram?.id ?? 'overlay-program',
      weekNumber: 1,
      miniCycleNumber: 1,
      intensityMultiplier: 1,
      startDate: `${overlay.weekStart}T12:00:00.000Z`,
      endDate: `${overlay.weekEnd}T12:00:00.000Z`,
      workouts: [],
      createdAt: validatedOverlay.createdAt,
      updatedAt: validatedOverlay.updatedAt,
    }),
    exposureContract,
    workouts: effectiveWorkouts,
  };
  const explicitWeekEdits = Object.entries(state.dateOverrides ?? {})
    .filter(([date]) => date >= overlay.weekStart && date <= overlay.weekEnd) as Array<[string, Workout]>;
  const explicitGameEdit = explicitWeekEdits.find(([, workout]) =>
    classifyVisibleSession(workout).anchors.game,
  );
  const originalGameDate = exposureContract.anchors.gameDay === null
    ? null
    : addDaysISO(overlay.weekStart, (exposureContract.anchors.gameDay + 6) % 7);
  const explicitlyRemovedOriginalGame = !!originalGameDate &&
    Object.prototype.hasOwnProperty.call(state.dateOverrides ?? {}, originalGameDate);
  const targetGameDay = explicitGameEdit
    ? new Date(`${explicitGameEdit[0]}T12:00:00`).getDay()
    : explicitlyRemovedOriginalGame
      ? null
      : exposureContract.anchors.gameDay;
  const resolvedContract = reResolveContractForActiveConstraints({
    contract: exposureContract,
    microcycle: targetMicrocycle,
    activeConstraints: context.activeConstraints,
    profile: context.profile,
    teamTrainingDayNumbers: effectiveWorkouts
      .filter((workout) => classifyVisibleSession(workout).anchors.teamTraining)
      .map((workout) => workout.dayOfWeek),
    hasGame: targetGameDay !== null,
    gameDay: targetGameDay,
  });
  const validation = evaluateEffectiveWeekExposureContract(
    resolvedContract,
    effectiveWorkouts,
    overlay.weekStart,
  );
  if (!validation.accepted) {
    assertEffectiveMicrocycleExposure({
      ...targetMicrocycle,
      exposureContract: resolvedContract,
    });
  }
  validatedOverlay = {
    ...validatedOverlay,
    exposureContract: resolvedContract,
  };
  return validatedOverlay;
}

/**
 * Active-constraint mutations are themselves write paths. Re-run the same
 * safety boundary over every persisted program surface after the constraint
 * store changes so later hydration/edit flows cannot start from stale unsafe
 * content.
 */
export function revalidateLiveStoredProgramSafety(): void {
  const liveContext = liveValidationContext();
  if (!liveContext.activeConstraints.some((constraint) =>
    constraint.status !== 'resolved' &&
    constraint.type !== 'missed_session' && constraint.type !== 'preference')) {
    // Clearing a constraint never restores training content. Persisted Contract
    // v2 already keeps the reduction conservative until an explicit rebuild;
    // there is no new safety restriction to project on this mutation.
    return;
  }
  const programStore = require('../store/programStore').useProgramStore;
  const state = programStore.getState();
  const currentProgram = state.currentProgram
    ? validateLiveProgramWrite(state.currentProgram)
    : null;
  const currentMicrocycle = state.currentMicrocycle
    ? validateLiveMicrocycleWrite(state.currentMicrocycle)
    : null;
  programStore.setState({ currentProgram, currentMicrocycle });

  const weekScopedOverlays = Object.fromEntries(
    Object.entries(state.weekScopedOverlays ?? {}).map(([weekStart, overlay]) => [
      weekStart,
      validateLiveWeekOverlayWrite(overlay as WeekScopedWorkoutOverlay),
    ]),
  );
  const dateOverrides = Object.fromEntries(
    Object.entries(state.dateOverrides ?? {}).map(([date, workout]) => [
      date,
      validateLiveWorkoutWrite(date, workout as Workout, { restoreMissingPlanPatterns: false }),
    ]),
  );
  const todayWorkout = state.todayWorkout
    ? validateLiveNullableWorkoutWrite(todayISOLocal(), state.todayWorkout)
    : null;
  programStore.setState({ weekScopedOverlays, dateOverrides, todayWorkout });
}
