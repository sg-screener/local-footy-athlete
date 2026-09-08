/** Historical input adapter for legacy logging diagnostics, not an app dose owner. */
import type {SessionFeedback,FeedbackCompletion} from '../../store/programStore';
import type {WorkoutExercise} from '../../types/domain';
import type {ConditioningProgressionInput} from '../../utils/conditioningProgressionRules';
import {sessionEffortFromFeedback} from '../../rules/effortScale';
function conditioningComponentCompletion(feedback: SessionFeedback): FeedbackCompletion | null {
  const component = feedback.components?.find((entry) => entry.kind === 'conditioning')
    ?? feedback.components?.find((entry) => entry.kind === 'finisher');
  if (component) return component.completion;
  if (feedback.conditioning) return feedback.completion;
  return null;
}

function completionQualityFromFeedback(
  completion: FeedbackCompletion | null,
): ConditioningProgressionInput['completionQuality'] {
  if (completion === 'skipped') return 'failed';
  if (completion === 'partial') return 'partial';
  return 'full';
}

function primaryConditioningRow(exercises: WorkoutExercise[]): WorkoutExercise | null {
  const workRows = exercises.filter((exercise) => {
    const name = `${exercise.exercise?.name ?? ''} ${exercise.notes ?? ''}`.toLowerCase();
    return !/\bwarm-?up\b|\bcool\s*down\b|\beasy\b/.test(name);
  });
  return workRows.sort((a, b) => {
    const aScore = a.prescribedSets + (a.restSeconds > 0 ? 1 : 0);
    const bScore = b.prescribedSets + (b.restSeconds > 0 ? 1 : 0);
    return bScore - aScore;
  })[0] ?? exercises[0] ?? null;
}

export function deriveConditioningProgressionInputOverrides(args: {
  feedback: SessionFeedback | null;
  exercises: WorkoutExercise[];
  baseDuration: number;
}): Partial<ConditioningProgressionInput> {
  const { feedback, exercises, baseDuration } = args;
  if (!feedback) return {};

  const completion = conditioningComponentCompletion(feedback);
  const conditioningLog = feedback.conditioning;
  const primaryRow = primaryConditioningRow(exercises);
  const rpe = conditioningLog?.rpe ?? sessionEffortFromFeedback(feedback);

  return {
    hasRecentFeedback: true,
    completionQuality: completionQualityFromFeedback(completion),
    recentRPE: rpe ?? 6,
    currentReps: conditioningLog?.roundsCompleted ?? conditioningLog?.intervalsCompleted ?? primaryRow?.prescribedRepsMax ?? 6,
    currentIntervals: conditioningLog?.intervalsCompleted ?? conditioningLog?.roundsCompleted ?? primaryRow?.prescribedSets ?? 4,
    currentDuration: conditioningLog?.totalTimeMinutes ?? baseDuration,
    currentRest: primaryRow?.restSeconds ?? 60,
  };
}

