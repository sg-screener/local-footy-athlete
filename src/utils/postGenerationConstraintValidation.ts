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
import { getWeekInBlock } from './programBlockState';
import { resolveWeekKind } from '../rules/deloadWeekRules';

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
      if (textIsRemovedByConstraints(`${option.title} ${option.description}`, args.constraints)) {
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
  const canonical = finaliseWorkoutAfterMutation(input.workout, {
    ...input.canonicalContext,
    date: input.date,
    profile: input.profile,
    phase: input.canonicalContext?.phase ?? input.profile?.seasonPhase,
  });
  const canonicalRemovedNames = canonical.actions
    .filter((action) => action.kind === 'row_removed' && !!action.item)
    .map((action) => action.item!);
  const canonicalRemovedPower = canonical.actions.some((action) => action.kind === 'power_removed');
  if (input.date < input.todayISO) {
    return {
      ...unchanged(canonical.workout),
      changed: canonical.changed,
      removedExerciseNames: canonicalRemovedNames,
      removedComponents: canonicalRemovedPower ? ['power'] : [],
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
      ...alignmentRemovedComponents,
    ])),
  });
  const active = liveConstraintsForDate(input.activeConstraints, input.date);
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

  const classification = classifyVisibleSession(alignedWorkout);
  if (classification.anchors.game || classification.anchors.teamTraining) {
    return {
      ...alignedResult(),
      preservedAnchor: true,
      activeConstraintIds: active.map((constraint) => constraint.id),
    };
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
            weekInBlock: ((args.microcycle.weekNumber - 1) % 4) + 1,
          }),
        weekKind: args.canonicalContext?.weekKind ?? args.microcycle.weekKind,
        ...gameProximityContext(date, gameDates),
        planIntentValid: !!workout.planEntryId,
        referenceWorkout: workout,
      },
    });
    if (result.changed) changed = true;
    return result.workout ?? collapseWorkoutToRest(workout);
  });
  return changed ? { ...args.microcycle, workouts } : args.microcycle;
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
  const workoutsByDate = Object.fromEntries(
    Object.entries(args.overlay.workoutsByDate).map(([date, workout]) => {
      const result = validateWorkoutAgainstActiveConstraints({ ...args, date, workout });
      if (result.changed) changed = true;
      return [date, result.workout];
    }),
  );
  return changed ? { ...args.overlay, workoutsByDate } : args.overlay;
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
  const blockStart = state.blockState?.blockStartDate ??
    state.currentProgram?.startDate?.slice(0, 10);
  const weekInBlock = blockStart ? getWeekInBlock(blockStart, date) : undefined;
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
    offseasonSubphase: resolveOffseasonSubphase({
      seasonPhase: profile.seasonPhase,
      weekInBlock,
    }),
    weekKind: weekInBlock ? resolveWeekKind(profile.seasonPhase, weekInBlock) : undefined,
    readiness: deriveScheduleReadiness({ onboardingData: profile, signal }),
    ...gameProximityContext(date, Array.from(gameDates)),
    profile,
    planIntentValid,
    referenceWorkout,
  };
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
  return result.workout ?? collapseWorkoutToRest(workout);
}

export function validateLiveNullableWorkoutWrite(
  date: string,
  workout: Workout | null,
): Workout | null {
  if (!workout) return null;
  const context = liveValidationContext();
  return validateWorkoutAgainstActiveConstraints({
    ...context,
    date,
    workout,
    canonicalContext: liveWorkoutCanonicalisationContext(date, workout, context.profile),
  }).workout;
}

export function validateLiveWeekOverlayWrite(
  overlay: WeekScopedWorkoutOverlay,
): WeekScopedWorkoutOverlay {
  const context = liveValidationContext();
  let changed = false;
  const workoutsByDate = Object.fromEntries(
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
  return changed ? { ...overlay, workoutsByDate } : overlay;
}
