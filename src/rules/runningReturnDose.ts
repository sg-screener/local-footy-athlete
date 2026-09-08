import type { Workout, WorkoutExercise } from '../types/domain';

/** R-393: one authored prescription for the compiler and every display. */
export const RUNNING_RETURN_DOSE_COPY = {
  1: {
    work: '20 m controlled run-through',
    reps: '{reps}',
    recovery: 'Walk back and recover fully',
    intensity: 'Smooth and controlled; no maximal sprinting or sharp cutting. Stop if symptoms return.',
  },
  2: {
    work: '20 m efforts',
    reps: '{reps} total — {straightReps} faster straight efforts, then 2 with a controlled change of direction',
    recovery: 'Walk back and recover fully',
    intensity: 'Build speed without straining; control each turn. Stop if symptoms return.',
  },
} as const;

export function runningReturnPrescription(stage: 1 | 2, reps: number): string {
  const copy = RUNNING_RETURN_DOSE_COPY[stage];
  const count = copy.reps.replace('{reps}', String(reps)).replace('{straightReps}', String(Math.max(1, reps - 2)));
  return `Work: ${copy.work}\nReps: ${count}\nRecovery: ${copy.recovery}\nIntensity: ${copy.intensity}`;
}

/** Only a compiler-owned returning field row uses the return prescription. */
export function runningReturnStageForRow(
  workout: Partial<Workout> | null | undefined,
  row: Partial<WorkoutExercise>,
): 1 | 2 | null {
  if (!workout?.runningReturnStage || row.athleteAdditionId
    || row.exercise?.name !== '20 m Acceleration Reps') return null;
  const speed = workout.speedBlock;
  const option = workout.conditioningBlock?.options.find(candidate => candidate.exerciseIds.includes(row.id ?? ''));
  const running = speed?.exerciseIds?.includes(row.id ?? '') && (!speed.modality || speed.modality === 'run')
    || option?.modality === 'running';
  return running ? workout.runningReturnStage : null;
}
