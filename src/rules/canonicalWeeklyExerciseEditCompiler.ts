/** Pure ordered fold of accepted exercise edits over one authored week. */
import type { Workout, WorkoutExercise } from '../types/domain';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import type {
  CanonicalWeeklyExerciseEdit,
  CanonicalWeeklyExerciseEditState,
} from './canonicalWeeklyExerciseEditState';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function safeNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function rowName(row: WorkoutExercise): string {
  return String(row.exercise?.name ?? '');
}

export type CanonicalExerciseEditTargetResolution =
  | { kind: 'found'; index: number; row: WorkoutExercise }
  | { kind: 'ambiguous'; candidates: string[] }
  | { kind: 'not_found' };

export function resolveCanonicalExerciseEditTarget(
  workout: Workout,
  target: { targetComponentId: string | null; targetName: string },
): CanonicalExerciseEditTargetResolution {
  if (target.targetComponentId) {
    const id = String(target.targetComponentId);
    const exact = workout.exercises.findIndex((row) =>
      [row.id, row.exerciseId, row.exercise?.id]
        .filter(Boolean)
        .some((candidate) => String(candidate) === id));
    if (exact >= 0) return { kind: 'found', index: exact, row: workout.exercises[exact]! };
    // A current typed action named an exact component. Falling back to its
    // display name here could edit a different duplicate row after the target
    // disappeared. Name matching exists only for old actions with no id.
    return { kind: 'not_found' };
  }
  const requested = target.targetName.trim().toLowerCase();
  const candidates = workout.exercises.map((row, index) => ({
    index,
    raw: rowName(row).trim().toLowerCase(),
    canonical: canonicalExerciseName(rowName(row)).trim().toLowerCase(),
  }));
  const exact = candidates.filter((candidate) => candidate.raw === requested);
  const canonicalRequested = canonicalExerciseName(target.targetName).trim().toLowerCase();
  const canonical = exact.length === 0
    ? candidates.filter((candidate) => candidate.canonical === canonicalRequested)
    : [];
  const fuzzy = exact.length === 0 && canonical.length === 0
    ? candidates.filter((candidate) => candidate.raw.includes(requested) ||
      candidate.canonical.includes(canonicalRequested))
    : [];
  const matches = exact.length > 0 ? exact : canonical.length > 0 ? canonical : fuzzy;
  if (matches.length === 1) {
    const index = matches[0]!.index;
    return { kind: 'found', index, row: workout.exercises[index]! };
  }
  if (matches.length > 1) {
    return {
      kind: 'ambiguous',
      candidates: matches.map(({ index }) => rowName(workout.exercises[index]!)),
    };
  }
  return { kind: 'not_found' };
}

export function compileCanonicalExerciseEditOnWorkout(
  workout: Workout,
  edit: CanonicalWeeklyExerciseEdit,
): Workout {
  if (edit.kind === 'remove' || ('derivedSource' in edit && edit.derivedSource)) return workout;
  if (edit.kind === 'swap') {
    const target = resolveCanonicalExerciseEditTarget(workout, edit);
    if (target.kind !== 'found') return workout;
    const { index, row: found } = target;
    const replacementId = `ex-coach-${edit.replacement.name.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')}`;
    const prescribedSets = safeNumber(edit.replacement.sets, safeNumber(found.prescribedSets, 3));
    const prescribedRepsMin = safeNumber(
      edit.replacement.repsMin,
      safeNumber(found.prescribedRepsMin, 8),
    );
    const prescribedRepsMax = Math.max(
      prescribedRepsMin,
      safeNumber(edit.replacement.repsMax, safeNumber(found.prescribedRepsMax, prescribedRepsMin)),
    );
    const replacement: WorkoutExercise = {
      ...found,
      exerciseId: replacementId,
      prescribedSets,
      prescribedRepsMin,
      prescribedRepsMax,
      prescribedWeightKg: Number.isFinite(Number(edit.replacement.weight))
        ? Number(edit.replacement.weight)
        : undefined,
      prescriptionType: edit.replacement.prescriptionType ?? found.prescriptionType,
      perSide: edit.replacement.perSide ?? found.perSide,
      restSeconds: edit.replacement.restSeconds ?? found.restSeconds,
      notes: edit.replacement.notes || found.notes,
      substitutedFrom: edit.substitutedFrom,
      unavailableForInjury: undefined,
      exercise: {
        id: replacementId,
        name: edit.replacement.name,
        description: edit.replacement.name,
        exerciseType: 'Compound' as never,
        muscleGroups: [], equipmentRequired: [],
        difficultyLevel: 'Intermediate' as never,
        createdAt: edit.occurredAt, updatedAt: edit.occurredAt,
      },
      updatedAt: edit.occurredAt,
    };
    const exercises = [...workout.exercises];
    exercises[index] = replacement;
    return { ...workout, exercises, updatedAt: edit.occurredAt };
  }

  const name = edit.exercise.name.trim();
  if (!name || workout.exercises.some((row) =>
    canonicalExerciseName(rowName(row)) === canonicalExerciseName(name))) return workout;
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/^-+|-+$/g, '') || 'exercise';
  const exerciseId = `ex-coach-add-${slug}`;
  const prescribedRepsMin = safeNumber(edit.exercise.repsMin, 8);
  const prescribedRepsMax = Math.max(
    prescribedRepsMin,
    safeNumber(edit.exercise.repsMax, 12),
  );
  const exerciseOrder = workout.exercises.reduce(
    (max, row) => Math.max(max, Number.isFinite(row.exerciseOrder) ? row.exerciseOrder : -1),
    -1,
  ) + 1;
  const added: WorkoutExercise = {
    // One date cannot contain the same canonical exercise twice, so date +
    // canonical name is the accepted component identity. It is identical in
    // the live write and at boot; ledger-generated ids are not available until
    // after the live write has landed.
    id: `${exerciseId}-${edit.dateISO}`,
    workoutId: workout.id,
    exerciseId,
    exerciseOrder,
    prescribedSets: safeNumber(edit.exercise.sets, 2),
    prescribedRepsMin,
    prescribedRepsMax,
    prescribedWeightKg: Number.isFinite(Number(edit.exercise.weight))
      ? Number(edit.exercise.weight)
      : 0,
    prescriptionType: edit.exercise.prescriptionType,
    perSide: edit.exercise.perSide,
    restSeconds: safeNumber(edit.exercise.restSeconds, 0),
    notes: edit.exercise.notes,
    exercise: {
      id: exerciseId, name, description: name,
      exerciseType: 'Accessory' as never,
      muscleGroups: [], equipmentRequired: [],
      difficultyLevel: 'Intermediate' as never,
      createdAt: edit.occurredAt, updatedAt: edit.occurredAt,
    },
    createdAt: edit.occurredAt,
    updatedAt: edit.occurredAt,
  };
  return {
    ...workout,
    exercises: [...workout.exercises, added],
    updatedAt: edit.occurredAt,
  };
}

/**
 * Material output deliberately folds Swap/Add only. Remove remains the typed
 * exclusion projection, so restoring it can reveal the exact authored row.
 */
export function compileCanonicalWeeklyExerciseEdits(args: {
  readonly workouts: readonly Workout[];
  readonly state: CanonicalWeeklyExerciseEditState;
}): { workouts: Workout[]; materialDates: string[] } {
  const byDay = new Map(args.workouts.map((workout) => [workout.dayOfWeek, clone(workout)]));
  const materialDates = new Set<string>();
  for (const edit of args.state.edits) {
    if (edit.kind === 'remove' || ('derivedSource' in edit && edit.derivedSource)) continue;
    const dayOfWeek = new Date(`${edit.dateISO}T12:00:00`).getDay();
    const current = byDay.get(dayOfWeek);
    if (!current) continue;
    const next = compileCanonicalExerciseEditOnWorkout(current, edit);
    if (JSON.stringify(next) === JSON.stringify(current)) continue;
    byDay.set(dayOfWeek, next);
    materialDates.add(edit.dateISO);
  }
  return {
    workouts: [...byDay.values()].sort((left, right) => left.dayOfWeek - right.dayOfWeek),
    materialDates: [...materialDates].sort(),
  };
}
