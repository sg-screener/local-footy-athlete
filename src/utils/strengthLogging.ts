import type { Workout, WorkoutExercise } from '../types/domain';
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

export function buildStrengthPerformanceLogs(
  workout: Workout | null | undefined,
  weightOverrides: Record<string, number | null> | undefined,
  completion: StrengthLogCompletion,
): StrengthExercisePerformanceLog[] {
  if (!workout || (workout.workoutType !== 'Strength' && workout.workoutType !== 'Mixed')) {
    return [];
  }

  return (workout.exercises ?? [])
    .filter((exercise, index) => isMainStrengthExercise(exercise, index))
    .map((exercise) => ({
      exerciseId: exercise.exerciseId,
      workoutExerciseId: exercise.id,
      exerciseName: exercise.exercise?.name ?? exercise.exerciseId,
      prescribedSets: Number(exercise.prescribedSets) || 0,
      prescribedRepsMin: Number(exercise.prescribedRepsMin) || 0,
      prescribedRepsMax: Number(exercise.prescribedRepsMax) || 0,
      weightKg: resolvedWeightKg(exercise, weightOverrides),
      completion,
    }));
}
