import type { LoggedSet, Workout, WorkoutExercise } from '../types/domain';
import { getExerciseTags, type MovementPattern } from '../data/exerciseTags';

export type StrengthLogCompletion = 'full' | 'partial' | 'skipped';

export interface StrengthExercisePerformanceLog {
  exerciseId: string;
  workoutExerciseId: string;
  exerciseName: string;
  prescribedSets: number;
  prescribedRepsMin: number;
  prescribedRepsMax: number;
  weightKg?: number | null;
  completion: StrengthLogCompletion;
  /**
   * ACTUAL performance captured from the workout log (real logged sets),
   * when available. Progression prefers these over the prescribed snapshot;
   * both are omitted when the athlete didn't log per-set detail, in which case
   * progression falls back to the prescribed values above.
   */
  /** Number of sets actually logged/completed for this lift. */
  completedSets?: number;
  /** Representative reps actually achieved (conservative — see builder). */
  actualReps?: number;
}

const MAIN_STRENGTH_MOVEMENTS = new Set<MovementPattern>([
  'squat',
  'lunge',
  'hinge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
]);

const CONDITIONING_NAME_RE =
  /conditioning|interval|run|sprint|bike|row|ski|swim|fartlek|tabata|mas|vo2|zone\s*2|warm-up|cool-down/i;

function isMainStrengthExercise(exercise: WorkoutExercise, index: number): boolean {
  const name = exercise.exercise?.name ?? '';
  if (!name || CONDITIONING_NAME_RE.test(name)) return false;

  const tags = getExerciseTags(name);
  if (tags) {
    return MAIN_STRENGTH_MOVEMENTS.has(tags.movement) && tags.load !== 'low';
  }

  // Fallback for untagged generated exercises: early multi-set rows are
  // usually the main lifts, while later rows are usually accessories.
  return index < 3 && Number(exercise.prescribedSets) >= 2;
}

function resolvedWeightKg(
  exercise: WorkoutExercise,
  weightOverrides: Record<string, number | null> | undefined,
): number | null | undefined {
  const override = weightOverrides?.[exercise.exerciseId];
  if (override !== undefined) return override;
  const prescribed = Number(exercise.prescribedWeightKg);
  if (Number.isFinite(prescribed) && prescribed > 0) return prescribed;
  return undefined;
}

/**
 * Summarise the real logged sets for one lift into (completedSets, actualReps,
 * topWeightKg). `actualReps` is the MINIMUM reps across logged working sets —
 * a conservative "what they actually held" so one strong set never drives
 * over-progression. Returns null when no usable per-set detail was logged.
 */
function summariseLoggedSets(
  loggedSets: LoggedSet[] | undefined,
): { completedSets: number; actualReps?: number; topWeightKg?: number } | null {
  if (!loggedSets || loggedSets.length === 0) return null;
  const repsValues = loggedSets
    .map((s) => (typeof s.actualReps === 'number' ? s.actualReps : undefined))
    .filter((r): r is number => typeof r === 'number' && r > 0);
  const weightValues = loggedSets
    .map((s) => (typeof s.actualWeightKg === 'number' ? s.actualWeightKg : undefined))
    .filter((weight): weight is number => typeof weight === 'number' && weight > 0);
  return {
    completedSets: loggedSets.length,
    actualReps: repsValues.length > 0 ? Math.min(...repsValues) : undefined,
    topWeightKg: weightValues.length > 0 ? Math.max(...weightValues) : undefined,
  };
}

/**
 * Collect the real logged sets for a workout from the workout-log store,
 * keyed by workoutExerciseId, ready to feed `buildStrengthPerformanceLogs`.
 *
 * Only sets belonging to THIS workout's active logging session are trusted
 * (guards against stale sets from a different session). Returns undefined when
 * there is nothing usable — so the caller cleanly falls back to the prescribed
 * snapshot.
 */
export function collectLoggedStrengthSets(
  workout: Workout | null | undefined,
  loggedSets: Map<string, LoggedSet[]> | Record<string, LoggedSet[]> | undefined | null,
  activeWorkoutId?: string | null,
): Record<string, LoggedSet[]> | undefined {
  if (!workout || !loggedSets) return undefined;
  // Stale-session guard: if an active workout is known and it isn't this one,
  // its logged sets don't describe this workout.
  if (activeWorkoutId && activeWorkoutId !== workout.id) return undefined;

  const entries = loggedSets instanceof Map
    ? Array.from(loggedSets.entries())
    : Object.entries(loggedSets);
  const validIds = new Set((workout.exercises ?? []).map((exercise) => exercise.id));

  const record: Record<string, LoggedSet[]> = {};
  for (const [workoutExerciseId, sets] of entries) {
    if (validIds.has(workoutExerciseId) && Array.isArray(sets) && sets.length > 0) {
      record[workoutExerciseId] = sets;
    }
  }
  return Object.keys(record).length > 0 ? record : undefined;
}

export function buildStrengthPerformanceLogs(
  workout: Workout | null | undefined,
  weightOverrides: Record<string, number | null> | undefined,
  completion: StrengthLogCompletion,
  /**
   * Optional real logged sets keyed by workoutExerciseId (from the workout log
   * store). When present, actual completed-set count / reps / top load are
   * captured so progression can prefer them over the prescribed snapshot.
   */
  loggedSetsByWorkoutExerciseId?: Record<string, LoggedSet[]>,
): StrengthExercisePerformanceLog[] {
  if (!workout || (workout.workoutType !== 'Strength' && workout.workoutType !== 'Mixed')) {
    return [];
  }

  return (workout.exercises ?? [])
    .filter((exercise, index) => isMainStrengthExercise(exercise, index))
    .map((exercise) => {
      const logged = summariseLoggedSets(loggedSetsByWorkoutExerciseId?.[exercise.id]);
      const prescribedWeight = resolvedWeightKg(exercise, weightOverrides);
      return {
        exerciseId: exercise.exerciseId,
        workoutExerciseId: exercise.id,
        exerciseName: exercise.exercise?.name ?? exercise.exerciseId,
        prescribedSets: Number(exercise.prescribedSets) || 0,
        prescribedRepsMin: Number(exercise.prescribedRepsMin) || 0,
        prescribedRepsMax: Number(exercise.prescribedRepsMax) || 0,
        // Prefer the real top logged load; fall back to the prescribed snapshot.
        weightKg: logged?.topWeightKg ?? prescribedWeight,
        completion,
        ...(logged ? { completedSets: logged.completedSets } : {}),
        ...(logged?.actualReps !== undefined ? { actualReps: logged.actualReps } : {}),
      };
    });
}
