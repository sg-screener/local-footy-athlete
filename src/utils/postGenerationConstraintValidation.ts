/**
 * Final active-constraint safety boundary for persisted program writes.
 *
 * Generation and edit producers still own programming intent. This module only
 * re-applies the existing canonical injury/exposure/equipment rules immediately
 * before a Workout, Microcycle, Program, or week overlay is stored.
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

export interface ActiveConstraintValidationInput {
  workout: Workout | null;
  date: string;
  todayISO: string;
  activeConstraints: readonly ActiveConstraint[];
  profile?: Pick<OnboardingData, 'equipment' | 'trainingLocation'> | null;
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

  if (!input.workout || input.date < input.todayISO) return unchanged(input.workout);
  const powerAlignment = alignPowerBlockToFinalWorkoutContent(input.workout);
  const alignedWorkout = powerAlignment.workout;
  const alignmentRemovedComponents: ActiveConstraintValidationResult['removedComponents'] =
    powerAlignment.action === 'removed' ? ['power'] : [];
  const alignedResult = (): ActiveConstraintValidationResult => ({
    ...unchanged(alignedWorkout),
    changed: powerAlignment.action !== 'unchanged',
    removedComponents: alignmentRemovedComponents,
  });
  const active = liveConstraintsForDate(input.activeConstraints, input.date);
  if (active.length === 0) {
    if (powerAlignment.action === 'removed' && !hasMeaningfulWorkoutContent(alignedWorkout)) {
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
      removedComponents: [
        ...(alignedWorkout.conditioningBlock ? ['conditioning' as const] : []),
        ...(alignedWorkout.speedBlock ? ['speed' as const] : []),
        ...(alignedWorkout.powerBlock || alignmentRemovedComponents.includes('power') ? ['power' as const] : []),
        ...(alignedWorkout.recoveryAddons?.length ? ['recovery_addon' as const] : []),
      ],
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
  const finalPowerAlignment = alignPowerBlockToFinalWorkoutContent(componentResult.workout);
  workout = finalPowerAlignment.workout;
  const finalAlignmentRemovedComponents: ActiveConstraintValidationResult['removedComponents'] =
    finalPowerAlignment.action === 'removed' ? ['power'] : [];
  const removedComponents = Array.from(new Set([
    ...alignmentRemovedComponents,
    ...componentResult.removedComponents,
    ...finalAlignmentRemovedComponents,
  ])) as ActiveConstraintValidationResult['removedComponents'];

  const afterNames = new Set(
    (workout.exercises ?? []).map((row) => row.exercise?.name ?? '').filter(Boolean),
  );
  const removedExerciseNames = Array.from(beforeNames).filter((name) => !afterNames.has(name));
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
    changed: workout !== input.workout,
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

export function validateMicrocycleAgainstActiveConstraints(args: {
  microcycle: Microcycle;
  todayISO: string;
  activeConstraints: readonly ActiveConstraint[];
  profile?: Pick<OnboardingData, 'equipment' | 'trainingLocation'> | null;
}): Microcycle {
  let changed = false;
  const workouts = args.microcycle.workouts.map((workout) => {
    const result = validateWorkoutAgainstActiveConstraints({
      workout,
      date: dateForWorkout(args.microcycle, workout),
      todayISO: args.todayISO,
      activeConstraints: args.activeConstraints,
      profile: args.profile,
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
  profile?: Pick<OnboardingData, 'equipment' | 'trainingLocation'> | null;
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
  profile?: Pick<OnboardingData, 'equipment' | 'trainingLocation'> | null;
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

/** Live-store wrappers used by ProgramStore's four final write primitives. */
export function validateLiveProgramWrite(program: TrainingProgram): TrainingProgram {
  return validateProgramAgainstActiveConstraints({ ...liveValidationContext(), program });
}

export function validateLiveMicrocycleWrite(microcycle: Microcycle): Microcycle {
  return validateMicrocycleAgainstActiveConstraints({ ...liveValidationContext(), microcycle });
}

export function validateLiveWorkoutWrite(date: string, workout: Workout): Workout {
  const context = liveValidationContext();
  const result = validateWorkoutAgainstActiveConstraints({ ...context, date, workout });
  return result.workout ?? collapseWorkoutToRest(workout);
}

export function validateLiveNullableWorkoutWrite(
  date: string,
  workout: Workout | null,
): Workout | null {
  if (!workout) return null;
  const context = liveValidationContext();
  return validateWorkoutAgainstActiveConstraints({ ...context, date, workout }).workout;
}

export function validateLiveWeekOverlayWrite(
  overlay: WeekScopedWorkoutOverlay,
): WeekScopedWorkoutOverlay {
  return validateWeekOverlayAgainstActiveConstraints({
    ...liveValidationContext(),
    overlay,
  });
}
