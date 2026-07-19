import type {
  Microcycle,
  TrainingProgram,
  WeekScopedWorkoutOverlay,
  Workout,
  WorkoutType,
} from '../types/domain';
import { normalizeStrengthPatterns } from '../rules/strengthPatternContributions';
import {
  normalizeAcceptedMaterialContext,
  type AcceptedCompositionBaseV1,
  type AcceptedMaterialContext,
  type AcceptedProgramSurfaceSnapshot,
  type AcceptedProfileSnapshotV1,
} from './acceptedStateColdStart';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sameStrings(
  left: readonly string[] | null | undefined,
  right: readonly string[] | null | undefined,
): boolean {
  return (left ?? []).join('|') === (right ?? []).join('|');
}

function typedComponentPresence(workout: Workout): {
  hasStrength: boolean;
  hasConditioning: boolean;
} {
  const hasStrength = (workout.strengthIntent?.effectivePatterns.length ?? 0) > 0 ||
    (workout.exercises ?? []).some((row) =>
      row.section18Evidence?.role === 'main_strength');
  const conditioningRole = workout.section18Evidence?.conditioningRole;
  const hasConditioning = !!workout.conditioningBlock?.options.length ||
    (workout.exercises ?? []).some((row) => row.section18Evidence?.role === 'conditioning') ||
    (conditioningRole !== undefined && conditioningRole !== 'none' &&
      conditioningRole !== 'legacy_unknown') ||
    (workout.section18ConditioningRole !== undefined &&
      workout.section18ConditioningRole !== 'none' &&
      workout.section18ConditioningRole !== 'legacy_unknown');
  return { hasStrength, hasConditioning };
}

/**
 * Repair only non-authoritative workout projections.
 *
 * Typed intent, component blocks and typed exercise evidence decide the
 * compatibility scalar values. Prescriptions, rows, identities, provenance,
 * placement and source facts are never rewritten here.
 */
export function projectHydratedWorkoutDerivedFields(workout: Workout): Workout {
  const { hasStrength, hasConditioning } = typedComponentPresence(workout);
  const protectedAnchorIdentity = workout.workoutType === 'Team Training' ||
    workout.workoutType === 'Game';
  let workoutType: WorkoutType = workout.workoutType;
  if (!protectedAnchorIdentity) {
    if (hasStrength && hasConditioning) workoutType = 'Mixed';
    else if (hasStrength) workoutType = 'Strength';
    else if (hasConditioning && workout.sessionTier !== 'recovery' && (
      workout.workoutType === 'Strength' || workout.workoutType === 'Mixed' ||
      workout.workoutType === 'Conditioning' || workout.workoutType === 'Rest' ||
      workout.workoutType === 'Recovery'
    )) workoutType = 'Conditioning';
  }
  const strengthPatternContributions = workout.strengthIntent
    ? normalizeStrengthPatterns(workout.strengthIntent.plannedPatterns)
    : undefined;
  const hasCombinedConditioning = hasStrength && hasConditioning;
  if (workoutType === workout.workoutType &&
    workout.hasCombinedConditioning === hasCombinedConditioning &&
    sameStrings(workout.strengthPatternContributions, strengthPatternContributions)) {
    return workout;
  }
  return {
    ...workout,
    workoutType,
    hasCombinedConditioning,
    strengthPatternContributions,
  };
}

function projectMicrocycle(microcycle: Microcycle): Microcycle {
  let changed = false;
  const workouts = (microcycle.workouts ?? []).map((workout) => {
    const projected = projectHydratedWorkoutDerivedFields(workout);
    if (projected !== workout) changed = true;
    return projected;
  });
  return changed ? { ...microcycle, workouts } : microcycle;
}

function projectProgram(program: TrainingProgram): TrainingProgram {
  let changed = false;
  const microcycles = (program.microcycles ?? []).map((microcycle) => {
    const projected = projectMicrocycle(microcycle);
    if (projected !== microcycle) changed = true;
    return projected;
  });
  return changed ? { ...program, microcycles } : program;
}

function projectWorkoutMap<T extends Record<string, Workout>>(
  value: T,
): T {
  let changed = false;
  const entries = Object.entries(value).map(([key, workout]) => {
    const projected = projectHydratedWorkoutDerivedFields(workout);
    if (projected !== workout) changed = true;
    return [key, projected];
  });
  return changed ? Object.fromEntries(entries) as T : value;
}

function projectOverlay(overlay: WeekScopedWorkoutOverlay): WeekScopedWorkoutOverlay {
  let changed = false;
  const workoutsByDate = Object.fromEntries(
    Object.entries(overlay.workoutsByDate ?? {}).map(([date, workout]) => {
      if (!workout) return [date, workout];
      const projected = projectHydratedWorkoutDerivedFields(workout);
      if (projected !== workout) changed = true;
      return [date, projected];
    }),
  );
  return changed ? { ...overlay, workoutsByDate } : overlay;
}

function projectOverlayMap<T extends Record<string, WeekScopedWorkoutOverlay>>(
  value: T,
): T {
  let changed = false;
  const entries = Object.entries(value).map(([key, overlay]) => {
    const projected = projectOverlay(overlay);
    if (projected !== overlay) changed = true;
    return [key, projected];
  });
  return changed ? Object.fromEntries(entries) as T : value;
}

export function projectAcceptedProgramSurfaceDerivedFields<
  T extends Partial<AcceptedProgramSurfaceSnapshot>,
>(value: T): T {
  const currentProgram = value.currentProgram
    ? projectProgram(value.currentProgram)
    : value.currentProgram;
  const currentMicrocycle = value.currentMicrocycle
    ? projectMicrocycle(value.currentMicrocycle)
    : value.currentMicrocycle;
  const todayWorkout = value.todayWorkout
    ? projectHydratedWorkoutDerivedFields(value.todayWorkout)
    : value.todayWorkout;
  const dateOverrides = value.dateOverrides
    ? projectWorkoutMap(value.dateOverrides)
    : value.dateOverrides;
  const weekScopedOverlays = value.weekScopedOverlays
    ? projectOverlayMap(value.weekScopedOverlays)
    : value.weekScopedOverlays;
  if (currentProgram === value.currentProgram &&
    currentMicrocycle === value.currentMicrocycle &&
    todayWorkout === value.todayWorkout &&
    dateOverrides === value.dateOverrides &&
    weekScopedOverlays === value.weekScopedOverlays) {
    return value;
  }
  return {
    ...value,
    currentProgram,
    currentMicrocycle,
    todayWorkout,
    dateOverrides,
    weekScopedOverlays,
  };
}

/** Preserve canonical authorities while rebuilding compatibility mirrors. */
export function projectAcceptedMaterialContextDerivedFields(
  value: Partial<AcceptedMaterialContext> | null | undefined,
): AcceptedMaterialContext {
  const normalized = normalizeAcceptedMaterialContext(value);
  if (!value || !isRecord(value)) return normalized;
  const rawBase = isRecord(value.acceptedCompositionBase) &&
    isRecord(value.acceptedCompositionBase.surfaces)
    ? value.acceptedCompositionBase as unknown as AcceptedCompositionBaseV1
    : null;
  const acceptedCompositionBase = rawBase
    ? {
        ...rawBase,
        surfaces: projectAcceptedProgramSurfaceDerivedFields(rawBase.surfaces),
      }
    : normalized.acceptedCompositionBase;
  const acceptedProfileSnapshot = isRecord(value.acceptedProfileSnapshot)
    ? value.acceptedProfileSnapshot as unknown as AcceptedProfileSnapshotV1
    : normalized.acceptedProfileSnapshot;
  return {
    ...normalized,
    temporarySourceFacts: Array.isArray(value.temporarySourceFacts)
      ? value.temporarySourceFacts
      : normalized.temporarySourceFacts,
    acceptedCompositionBase,
    acceptedProfileSnapshot,
  };
}

export function projectHydratedStateDerivedFields<T extends Record<string, unknown>>(
  value: T,
): T {
  const surfaces = projectAcceptedProgramSurfaceDerivedFields(
    value as unknown as Partial<AcceptedProgramSurfaceSnapshot>,
  ) as unknown as T;
  if (!isRecord(value.acceptedMaterialContext)) return surfaces;
  const acceptedMaterialContext = projectAcceptedMaterialContextDerivedFields(
    value.acceptedMaterialContext as Partial<AcceptedMaterialContext>,
  );
  return {
    ...surfaces,
    acceptedMaterialContext,
  };
}
