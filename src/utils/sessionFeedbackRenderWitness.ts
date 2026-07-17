import type { TrainingProgram, Workout, WorkoutExercise } from '../types/domain';
import type { SessionOutcomeTransactionReceipt } from '../types/sessionOutcome';

export interface FutureProgressionRenderTarget {
  sourceDate: string;
  sourceSessionId: string;
  sourceExerciseId: string | null;
  targetDate: string;
  targetSessionId: string;
  targetExerciseId: string | null;
}

function dateForWorkout(weekStartISO: string, workout: Workout): string {
  const monday = new Date(`${weekStartISO.slice(0, 10)}T12:00:00`);
  const offset = (workout.dayOfWeek + 6) % 7;
  monday.setDate(monday.getDate() + offset);
  return [
    monday.getFullYear(),
    String(monday.getMonth() + 1).padStart(2, '0'),
    String(monday.getDate()).padStart(2, '0'),
  ].join('-');
}

function exerciseIdentity(exercise: WorkoutExercise | null | undefined): string | null {
  if (!exercise) return null;
  return exercise.exerciseId || exercise.id || null;
}

/**
 * Resolve the exact already-programmed session that can consume a persisted
 * feedback fact. This is a read-only UI identity projection; progression
 * policy and mutation remain owned by the programming engine.
 */
export function deriveFutureProgressionRenderTarget(args: {
  program: TrainingProgram | null;
  receipt: SessionOutcomeTransactionReceipt;
}): FutureProgressionRenderTarget | null {
  const program = args.program;
  if (!program) return null;
  const sourceWorkout = program.microcycles
    .flatMap((microcycle) => microcycle.workouts)
    .find((workout) =>
      workout.id === args.receipt.sessionIdentity.workoutId ||
      (!!args.receipt.sessionIdentity.planEntryId &&
        workout.planEntryId === args.receipt.sessionIdentity.planEntryId));
  if (!sourceWorkout) return null;

  const future = program.microcycles
    .flatMap((microcycle) => microcycle.workouts.map((workout) => ({
      date: dateForWorkout(microcycle.startDate, workout),
      workout,
    })))
    .filter((entry) => entry.date > args.receipt.date)
    .sort((left, right) => left.date.localeCompare(right.date));
  const sourceExercises = sourceWorkout.exercises.filter((row) => row.prescribedSets > 0);
  for (const sourceExercise of sourceExercises) {
    const target = future.flatMap((entry) => entry.workout.exercises.map((exercise) => ({
      ...entry,
      exercise,
    }))).find((entry) =>
      entry.exercise.exerciseId === sourceExercise.exerciseId ||
      (!!entry.exercise.exercise?.name &&
        entry.exercise.exercise.name === sourceExercise.exercise?.name));
    if (target) {
      return {
        sourceDate: args.receipt.date,
        sourceSessionId: sourceWorkout.id,
        sourceExerciseId: exerciseIdentity(sourceExercise),
        targetDate: target.date,
        targetSessionId: target.workout.id,
        targetExerciseId: exerciseIdentity(target.exercise),
      };
    }
  }

  const sameSessionTarget = future.find((entry) =>
    entry.workout.dayOfWeek === sourceWorkout.dayOfWeek &&
    entry.workout.exercises.some((exercise) => exercise.prescribedSets > 0));
  const fallback = sameSessionTarget ?? future.find((entry) =>
    entry.workout.exercises.some((exercise) => exercise.prescribedSets > 0));
  if (!fallback) return null;
  return {
    sourceDate: args.receipt.date,
    sourceSessionId: sourceWorkout.id,
    sourceExerciseId: exerciseIdentity(sourceExercises[0]),
    targetDate: fallback.date,
    targetSessionId: fallback.workout.id,
    targetExerciseId: exerciseIdentity(
      fallback.workout.exercises.find((exercise) => exercise.prescribedSets > 0)!,
    ),
  };
}
