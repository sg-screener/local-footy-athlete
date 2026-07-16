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
  applyConstraintsToTypedComponents,
  type Constraint,
} from './exposureEngine';
import { buildConstraintPlans } from './constraintPlan';
import {
  buildGenerationConstraintContext,
  isStructuralGenerationConstraint,
} from './generationConstraints';
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
import { deriveScheduleReadiness, type ReadinessSignal } from './readiness';
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
import {
  requireSection18AcceptedWeek,
  type Section18AcceptedWeekCandidate,
} from '../rules/section18AcceptedWeekGateway';
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
  const live = constraints.filter((constraint) => constraintIsLiveOnDate(constraint, date));
  const strongestFatigue = live
    .filter((constraint) => constraint.type === 'fatigue')
    .sort((left, right) => right.severity - left.severity ||
      right.lastUpdatedAt.localeCompare(left.lastUpdatedAt))[0];
  const sorenessByBucket = new Map<string, ActiveConstraint>();
  for (const constraint of live) {
    if (constraint.type !== 'soreness') continue;
    const prior = sorenessByBucket.get(constraint.bucket);
    if (!prior || constraint.severity > prior.severity ||
      (constraint.severity === prior.severity && constraint.lastUpdatedAt > prior.lastUpdatedAt)) {
      sorenessByBucket.set(constraint.bucket, constraint);
    }
  }
  return [
    ...live.filter((constraint) => constraint.type !== 'fatigue' && constraint.type !== 'soreness'),
    ...Array.from(sorenessByBucket.values()),
    ...(strongestFatigue ? [strongestFatigue] : []),
  ];
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

  const componentResult = applyConstraintsToTypedComponents(
    workout,
    engineConstraints,
    {
      equipmentAvailable: availableEquipment
        ? (requirements) => equipmentRequirementsAreAvailable(
            requirements,
            availableEquipment,
          )
        : undefined,
    },
  );
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
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const acceptedContext = require('../store/programStore').useProgramStore.getState()
    .acceptedMaterialContext;
  const readinessSignal = (acceptedContext?.revision > 0
    ? acceptedContext.readinessSignalsByDate
    : useReadinessStore.getState().signalsByDate)?.[weekStart] ?? null;
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

/**
 * Rebuild a target week from its persisted phase clock and Contract v2.
 * The returned candidate deliberately retains the caller's approved contract;
 * deterministic generation may improve placement, but it cannot lower the
 * selected phase targets to make a deficient week pass.
 */
export function buildSection18ProductionFallbackCandidate(args: {
  contract: WeeklyExposureContractV2;
  weekStart: string;
  profile?: OnboardingData | null;
  activeConstraints?: readonly ActiveConstraint[];
}): Section18AcceptedWeekCandidate | null {
  if (!args.profile) return null;
  const weekInBlock = Math.max(1, args.contract.identity.weekInBlock ?? 1);
  const blockStart = addDaysISO(args.weekStart, -7 * (weekInBlock - 1));
  const phaseEntryWeekStartISO = args.contract.identity.phaseEntryWeekStartISO ?? blockStart;
  try {
    // Dynamic loading prevents generation from importing its final persistence
    // boundary. This path is invoked only after the primary candidate fails.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const unknownAnchorCredit = args.contract.source === 'legacy_migration' &&
      args.contract.anchors.some((anchor) => anchor.participation === 'unknown');
    const generated = require('../services/api/generateProgram').generateProgramLocally({
      ...args.profile,
      seasonPhase: args.contract.identity.seasonPhase,
      // Unknown legacy participation cannot be used to reduce app-authored
      // work. Generate the conservative fallback without anchor credit; the
      // accepted resolver restores the persisted fixture/team anchors from
      // Contract v2, still as unknown/uncredited.
      ...(unknownAnchorCredit ? {
        teamTrainingDaysPerWeek: 0,
        teamTrainingDays: [],
        usualGameDay: undefined,
        gameDay: undefined,
      } : {}),
    }, {
      todayISO: blockStart,
      blockNumber: args.contract.identity.blockNumber ?? 1,
      activeConstraints: [...(args.activeConstraints ?? [])],
      previousProgram: null,
      seasonPhaseClock: {
        protocolVersion: 1,
        selectedPhase: args.contract.identity.seasonPhase,
        phaseEntryWeekStartISO,
        // Contract v2 stores resolution provenance rather than the clock's
        // original user/migration provenance. Reconstructing that persisted
        // clock is therefore a deterministic migration, never a new phase
        // change.
        originProvenance: 'deterministic_legacy_migration',
        persistenceProvenance: 'preserved_persisted_state',
      },
    }) as TrainingProgram;
    const target = generated.microcycles.find((microcycle) =>
      microcycle.startDate.slice(0, 10) === args.weekStart.slice(0, 10));
    if (!target) return null;
    let workouts = target.workouts;
    const weekOrder = (dayOfWeek: number): number => dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const isAppCore = (workout: Workout): boolean => {
      const role = workout.section18Evidence?.conditioningRole ?? workout.section18ConditioningRole;
      return role === 'required_core' || role === 'planner_selected_core' || role === 'core';
    };
    if (unknownAnchorCredit) {
      const fixtureDays = new Set(args.contract.anchors
        .filter((anchor) => anchor.kind === 'game' || anchor.kind === 'practice_match')
        .map((anchor) => anchor.dayOfWeek));
      const fixtureDay = Array.from(fixtureDays)[0];
      const distanceBeforeFixture = (dayOfWeek: number): number =>
        fixtureDay === undefined ? 7 : weekOrder(fixtureDay) - weekOrder(dayOfWeek);
      for (const source of workouts.filter((workout) =>
        distanceBeforeFixture(workout.dayOfWeek) < 3)) {
        const hasCore = isAppCore(source);
        if (!hasCore && !source.speedBlock) continue;
        const candidates = workouts
          .filter((workout) => !fixtureDays.has(workout.dayOfWeek))
          .filter((workout) => distanceBeforeFixture(workout.dayOfWeek) >= 3)
          .filter((workout) => !hasCore || !isAppCore(workout))
          .sort((left, right) =>
            Number(classifyVisibleSession(right).contributions.mainStrength > 0) -
              Number(classifyVisibleSession(left).contributions.mainStrength > 0) ||
            left.dayOfWeek - right.dayOfWeek);
        const targetWorkout = candidates[0];
        if (!targetWorkout) continue;
        const mergedId = targetWorkout.id;
        const sourceRows = (source.exercises ?? []).map((exercise, index) => ({
          ...exercise,
          id: `${exercise.id}:legacy-fallback:${targetWorkout.dayOfWeek}:${index}`,
          workoutId: mergedId,
          exerciseOrder: (targetWorkout.exercises?.length ?? 0) + index + 1,
        }));
        workouts = workouts.map((workout) => workout.id === targetWorkout.id
          ? {
              ...workout,
              exercises: [...(workout.exercises ?? []), ...sourceRows],
              ...(hasCore ? {
                hasCombinedConditioning: true,
                attachedConditioningKind: 'component' as const,
                conditioningFlavour: source.conditioningFlavour,
                conditioningCategory: source.conditioningCategory,
                conditioningFeasibility: source.conditioningFeasibility,
                conditioningBlock: source.conditioningBlock,
                section18ConditioningRole: source.section18ConditioningRole,
                section18Evidence: source.section18Evidence,
              } : {}),
              ...(source.speedBlock ? { speedBlock: source.speedBlock } : {}),
            }
          : workout);
      }
    }
    if (args.contract.source === 'legacy_migration') {
      const fixtureDays = new Set(args.contract.anchors
        .filter((anchor) => anchor.kind === 'game' || anchor.kind === 'practice_match')
        .map((anchor) => anchor.dayOfWeek));
      const fixtureDay = Array.from(fixtureDays)[0];
      const safeBeforeFixture = (workout: Workout): boolean => fixtureDay === undefined ||
        weekOrder(fixtureDay) - weekOrder(workout.dayOfWeek) >= 3;
      const hasMainStrength = (workout: Workout): boolean =>
        workout.exercises.some((row) => row.section18Evidence?.role === 'main_strength') ||
        (!!workout.strengthIntent?.effectivePatterns.length &&
          !classifyVisibleSession(workout).anchors.teamTraining &&
          !classifyVisibleSession(workout).anchors.game);
      const selectedMainStrength = args.contract.mainStrength.exposure.plannerSelectionKind === 'core'
        ? args.contract.mainStrength.exposure.plannerSelectedTarget ??
          args.contract.mainStrength.exposure.requiredMinimum
        : args.contract.mainStrength.exposure.requiredMinimum;
      while (workouts.filter(hasMainStrength).length < selectedMainStrength) {
        const source = workouts
          .filter(hasMainStrength)
          .sort((left, right) =>
            (right.strengthIntent?.effectivePatterns.length ?? 0) -
              (left.strengthIntent?.effectivePatterns.length ?? 0) ||
            weekOrder(left.dayOfWeek) - weekOrder(right.dayOfWeek))[0];
        const targetWorkout = workouts
          .filter((workout) => !hasMainStrength(workout))
          .filter((workout) => !fixtureDays.has(workout.dayOfWeek))
          .filter(safeBeforeFixture)
          .sort((left, right) =>
            Number(left.workoutType === 'Rest') - Number(right.workoutType === 'Rest') ||
            weekOrder(left.dayOfWeek) - weekOrder(right.dayOfWeek))[0];
        if (!source || !targetWorkout) break;
        const sourceRows = source.exercises.filter((row) =>
          row.section18Evidence?.role === 'main_strength');
        if (sourceRows.length === 0) break;
        const clonedRows = sourceRows.map((row, index) => ({
          ...row,
          id: `${row.id}:legacy-strength-fallback:${targetWorkout.dayOfWeek}:${index}`,
          workoutId: targetWorkout.id,
          exerciseOrder: targetWorkout.exercises.length + index + 1,
        }));
        workouts = workouts.map((workout) => workout.id === targetWorkout.id
          ? {
              ...workout,
              name: workout.workoutType === 'Rest'
                ? source.name
                : `${workout.name} + Strength`,
              workoutType: workout.conditioningBlock ? 'Mixed' : 'Strength',
              sessionTier: 'core',
              intensity: workout.intensity === 'High' || workout.intensity === 'Maximal'
                ? workout.intensity
                : 'Moderate',
              durationMinutes: workout.durationMinutes + Math.max(30, source.durationMinutes),
              exercises: [...workout.exercises, ...clonedRows],
              strengthIntent: source.strengthIntent,
              strengthPatternContributions: source.strengthPatternContributions,
            }
          : workout);
      }
      const cloneConditioningOnto = (source: Workout, targetWorkout: Workout): Workout => {
        const conditioningIds = new Set(source.conditioningBlock?.options
          .flatMap((option) => option.exerciseIds) ?? []);
        const sourceRows = (source.exercises ?? []).filter((row) =>
          row.section18Evidence?.role === 'conditioning' || conditioningIds.has(row.id));
        const idMap = new Map<string, string>();
        const clonedRows = sourceRows.map((row, index) => {
          const id = `${row.id}:legacy-fallback:${targetWorkout.dayOfWeek}:${index}`;
          idMap.set(row.id, id);
          return {
            ...row,
            id,
            workoutId: targetWorkout.id,
            exerciseOrder: (targetWorkout.exercises?.length ?? 0) + index + 1,
          };
        });
        const conditioningBlock = source.conditioningBlock
          ? {
              ...source.conditioningBlock,
              options: source.conditioningBlock.options.map((option) => ({
                ...option,
                exerciseIds: option.exerciseIds
                  .map((id) => idMap.get(id))
                  .filter((id): id is string => !!id),
              })),
            }
          : undefined;
        return {
          ...targetWorkout,
          workoutType: targetWorkout.workoutType === 'Rest' ? source.workoutType : 'Mixed',
          sessionTier: 'core',
          intensity: targetWorkout.intensity === 'High' || targetWorkout.intensity === 'Maximal' ||
            source.intensity === 'High' || source.intensity === 'Maximal'
            ? 'High'
            : 'Moderate',
          durationMinutes: targetWorkout.durationMinutes + Math.max(15, source.durationMinutes),
          exercises: [...(targetWorkout.exercises ?? []), ...clonedRows],
          hasCombinedConditioning: true,
          attachedConditioningKind: source.attachedConditioningKind ?? 'component',
          conditioningFlavour: source.conditioningFlavour,
          conditioningCategory: source.conditioningCategory,
          conditioningFeasibility: source.conditioningFeasibility,
          conditioningBlock,
          section18ConditioningRole: source.section18ConditioningRole ?? 'planner_selected_core',
          section18Evidence: source.section18Evidence ?? {
            protocolVersion: 1,
            conditioningRole: 'planner_selected_core',
            conditioningStress: 'moderate',
            provenance: 'planner_and_canonical_content',
          },
        };
      };
      const requiredAppCore = Math.max(
        args.contract.conditioning.core.requiredMinimum,
        (args.contract.conditioning.core.plannerSelectionKind === 'core'
          ? args.contract.conditioning.core.plannerSelectedTarget ?? 0
          : 0) - args.contract.anchors.filter((anchor) =>
            anchor.participation === 'normal_unrestricted').length,
      );
      while (workouts.filter(isAppCore).length < requiredAppCore) {
        const source = workouts.filter(isAppCore)
          .sort((left, right) => weekOrder(left.dayOfWeek) - weekOrder(right.dayOfWeek))[0];
        if (!source) break;
        const targetWorkout = workouts
          .filter((workout) => !isAppCore(workout))
          .filter((workout) => !fixtureDays.has(workout.dayOfWeek))
          .filter(safeBeforeFixture)
          .sort((left, right) =>
            Number(left.workoutType === 'Rest') - Number(right.workoutType === 'Rest') ||
            Number(classifyVisibleSession(right).contributions.mainStrength > 0) -
              Number(classifyVisibleSession(left).contributions.mainStrength > 0) ||
            weekOrder(left.dayOfWeek) - weekOrder(right.dayOfWeek))[0];
        if (!targetWorkout) break;
        workouts = workouts.map((workout) => workout.id === targetWorkout.id
          ? cloneConditioningOnto(source, workout)
          : workout);
      }
      const requiredSprint = args.contract.sprintHighSpeed.exposure.requiredMinimum;
      const sprintCount = workouts.filter((workout) => !!workout.speedBlock).length;
      if (sprintCount < requiredSprint) {
        const speedTarget = workouts
          .filter((workout) => !fixtureDays.has(workout.dayOfWeek))
          .filter(safeBeforeFixture)
          .filter((workout) => workout.workoutType !== 'Rest')
          .sort((left, right) =>
            Number(classifyVisibleSession(right).contributions.mainStrength > 0) -
              Number(classifyVisibleSession(left).contributions.mainStrength > 0) ||
            weekOrder(left.dayOfWeek) - weekOrder(right.dayOfWeek))[0];
        if (speedTarget) {
          workouts = workouts.map((workout) => workout.id === speedTarget.id
            ? {
                ...workout,
                speedBlock: {
                  id: `legacy-migration-speed:${args.weekStart}:${workout.dayOfWeek}`,
                  title: 'Acceleration Exposure',
                  label: 'Acceleration',
                  kind: 'true_speed',
                  placement: 'pre_lift',
                  durationMinutes: 12,
                  prescription: '4–6 × 10–20 m controlled accelerations, full walk-back recovery',
                  notes: ['Keep every rep crisp and stop before speed drops.'],
                  counting: {
                    hardExposure: true,
                    mainStrength: false,
                    conditioningCredit: 'none',
                    createsHardDay: true,
                    sprintCodExposure: true,
                  },
                },
              }
            : workout);
        }
      }
    }
    const strengthMaximum = args.contract.mainStrength.exposure.permittedMaximum;
    if (args.contract.source === 'legacy_migration' && strengthMaximum !== null) {
      const strengthDays = workouts
        .filter((workout) => classifyVisibleSession(workout).contributions.mainStrength > 0)
        .sort((left, right) => right.dayOfWeek - left.dayOfWeek);
      const removeDays = new Set(
        strengthDays.slice(strengthMaximum).map((workout) => workout.dayOfWeek),
      );
      workouts = workouts.map((workout) =>
        removeDays.has(workout.dayOfWeek) ? collapseWorkoutToRest(workout) : workout);
    }
    return {
      contract: JSON.parse(JSON.stringify(args.contract)) as WeeklyExposureContractV2,
      workouts,
    };
  } catch {
    return null;
  }
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
      regenerate: () => buildSection18ProductionFallbackCandidate({
        contract: exposureContractV2!,
        weekStart,
        profile: args.profile,
        activeConstraints: args.activeConstraints,
      }),
      safeFallback: () => buildSection18ProductionFallbackCandidate({
        contract: exposureContractV2!,
        weekStart,
        profile: args.profile,
        activeConstraints: args.activeConstraints,
      }),
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
      regenerate: () => buildSection18ProductionFallbackCandidate({
        contract,
        weekStart: validated.weekStart,
        profile: args.profile,
        activeConstraints: args.activeConstraints,
      }),
      safeFallback: () => buildSection18ProductionFallbackCandidate({
        contract,
        weekStart: validated.weekStart,
        profile: args.profile,
        activeConstraints: args.activeConstraints,
      }),
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

function liveValidationContext(
  activeConstraintsOverride?: readonly ActiveConstraint[],
): {
  todayISO: string;
  activeConstraints: ActiveConstraint[];
  profile: OnboardingData;
} {
  // ProgramStore owns the accepted material snapshot. The legacy stores are
  // mirrors used only before the first accepted transaction/hydration.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const accepted = require('../store/programStore').useProgramStore.getState()
    .acceptedMaterialContext;
  const hasAcceptedContext = accepted?.revision > 0;
  const activeById = new Map<string, ActiveConstraint>();
  for (const constraint of activeConstraintsOverride ??
    (hasAcceptedContext ? accepted.activeConstraints : useCoachUpdatesStore.getState().activeConstraints) ?? []) {
    // InjuryEpisodeV1 is composed against AcceptedCompositionBase at the
    // visible boundary. Treating its compatibility constraint as a write
    // validator would destroy the very base resolution needs.
    if (constraint.type !== 'injury') activeById.set(constraint.id, constraint);
  }
  const readinessSignals = hasAcceptedContext
    ? accepted.readinessSignalsByDate
    : useReadinessStore.getState().signalsByDate;
  for (const signal of Object.values(readinessSignals ?? {}) as ReadinessSignal[]) {
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
  const acceptedContext = state.acceptedMaterialContext;
  const signal = (acceptedContext?.revision > 0
    ? acceptedContext.readinessSignalsByDate
    : useReadinessStore.getState().signalsByDate)?.[date] ?? null;
  const gameDates = new Set(
    datedProgramWorkouts
      .filter(({ workout: candidate }) => classifyVisibleSession(candidate).anchors.game)
      .map(({ date: gameDate }) => gameDate),
  );
  if (classifyVisibleSession(workout).anchors.game) gameDates.add(date);
  const markedDays = acceptedContext?.revision > 0
    ? acceptedContext.markedDays
    : useCalendarStore.getState().markedDays ?? {};
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
  options: {
    restoreMissingPlanPatterns?: boolean;
    /**
     * The caller owns an atomic accepted-week transaction that will repair
     * and gate the complete week. Keep per-workout safety canonicalisation,
     * but do not ask the single-date boundary to accept an intentionally
     * incomplete intermediate week.
     */
    deferWeekAcceptance?: boolean;
  } = {},
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
  if (options.deferWeekAcceptance) return validated;
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
      regenerate: () => buildSection18ProductionFallbackCandidate({
        contract: exposureContractV2!,
        weekStart: overlay.weekStart,
        profile: context.profile,
        activeConstraints: context.activeConstraints,
      }),
      safeFallback: () => buildSection18ProductionFallbackCandidate({
        contract: exposureContractV2!,
        weekStart: overlay.weekStart,
        profile: context.profile,
        activeConstraints: context.activeConstraints,
      }),
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
  const projection = stageLiveStoredProgramSafety(liveContext.activeConstraints);
  commitLiveStoredProgramSafetyProjection(projection);
}

export interface LiveStoredProgramSafetyProjection {
  currentProgram: TrainingProgram | null;
  currentMicrocycle: Microcycle | null;
  todayWorkout: Workout | null;
  dateOverrides: Record<string, Workout>;
  overrideContexts: Record<string, import('../types/domain').OverrideContext>;
  weekScopedOverlays: Record<string, WeekScopedWorkoutOverlay>;
}

/**
 * Stage every persisted program surface against a proposed constraint set.
 * This function is intentionally pure with respect to both Zustand stores:
 * callers may commit the returned projection only after every effective week
 * has passed the accepted-week gateway.
 */
export function stageLiveStoredProgramSafety(
  proposedConstraints: readonly ActiveConstraint[],
): LiveStoredProgramSafetyProjection | null {
  const context = liveValidationContext(proposedConstraints);
  const safetyConstraints = context.activeConstraints.filter((constraint) =>
    isStructuralGenerationConstraint(constraint) &&
    constraint.status !== 'resolved' &&
    constraint.type !== 'injury' &&
    constraint.type !== 'missed_session' && constraint.type !== 'preference');
  if (safetyConstraints.length === 0) {
    // Constraint clearing is deliberately conservative. The already-reduced
    // visible program remains untouched until the user explicitly rebuilds.
    return null;
  }
  const programStore = require('../store/programStore');
  const state = programStore.useProgramStore.getState();
  const staged = programStore.canonicaliseHydratedState({
    currentProgram: state.currentProgram,
    currentMicrocycle: state.currentMicrocycle,
    todayWorkout: state.todayWorkout,
    dateOverrides: state.dateOverrides,
    overrideContexts: state.overrideContexts,
    weekScopedOverlays: state.weekScopedOverlays,
  }, {
    programAlreadyAccepted: true,
    activeConstraints: context.activeConstraints,
    profile: context.profile,
    markedDays: state.acceptedMaterialContext.markedDays,
  });
  return {
    currentProgram: staged.currentProgram ?? null,
    currentMicrocycle: staged.currentMicrocycle ?? null,
    todayWorkout: staged.todayWorkout ?? null,
    dateOverrides: staged.dateOverrides ?? {},
    overrideContexts: staged.overrideContexts ?? {},
    weekScopedOverlays: staged.weekScopedOverlays ?? {},
  };
}

/** Commit a previously staged projection through the accepted-state owner. */
export function commitLiveStoredProgramSafetyProjection(
  projection: LiveStoredProgramSafetyProjection | null,
): void {
  if (!projection) return;
  require('../store/acceptedStateTransaction').commitAcceptedStateTransaction({
    reason: 'constraint:live_safety_projection',
    program: projection,
  });
}
