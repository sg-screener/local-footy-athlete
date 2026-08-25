/**
 * The club-training log's Save decision, as one pure owner.
 *
 * Launch audit 2026-08-25, finding #9: the panel showed "90" in the minutes
 * box (a placeholder styled like a value), the form looked complete, and Save
 * & Finish sat disabled saying nothing — tapped three times on the simulator
 * before the cause was read out of the source. The profile setup sheet had
 * already stated the law for this class: *"A disabled Save always says why.
 * A control that is off for an unstated reason is the same failure as one
 * that is on and inert"* (`profileSetupChange.ts`), with typed reasons and
 * plain athlete-facing sentences. This module is that same shape for the
 * club-training panel, extracted so the enable rule and its explanation can
 * never drift apart from each other or from a copied condition in the
 * component.
 *
 * Guard: sessionFeedbackFormTests — the decision cells.
 */

import type { FeedbackCompletion } from '../types/sessionOutcome';
import { parseSessionDurationMinutes } from './sessionDuration';
import { isSessionEffortRating } from '../utils/sessionFeedbackForm';

export type ClubTrainingSaveBlockReason =
  | 'completion_unanswered'
  | 'minutes_unanswered'
  | 'effort_unanswered'
  | 'not_recordable';

export interface ClubTrainingFeedbackDecision {
  canSave: boolean;
  /** Every unmet requirement, first is the one the athlete should fix next. */
  blockedBy: ClubTrainingSaveBlockReason[];
}

export function clubTrainingFeedbackDecision(args: {
  completion: FeedbackCompletion | null;
  minutesText: string;
  effort: number | null;
  recordableRefusal: { message: string } | null;
}): ClubTrainingFeedbackDecision {
  const blockedBy: ClubTrainingSaveBlockReason[] = [];
  if (args.recordableRefusal) blockedBy.push('not_recordable');
  if (args.completion === null) {
    blockedBy.push('completion_unanswered');
    return { canSave: false, blockedBy };
  }
  // A SKIP NEEDS NO NUMBERS. "I did not go" is a complete answer — demanding a
  // duration for it is the coupling the panel's own comment forbids.
  if (args.completion === 'skipped') {
    return { canSave: blockedBy.length === 0, blockedBy };
  }
  if (!parseSessionDurationMinutes(args.minutesText).valid) {
    blockedBy.push('minutes_unanswered');
  }
  if (!isSessionEffortRating(args.effort)) {
    blockedBy.push('effort_unanswered');
  }
  return { canSave: blockedBy.length === 0, blockedBy };
}

/** Athlete-facing explanation for a Save that is unavailable. */
export function clubTrainingSaveBlockCopy(
  reason: ClubTrainingSaveBlockReason,
  refusalMessage?: string,
): string {
  switch (reason) {
    case 'completion_unanswered':
      return 'Pick how much of training you did.';
    case 'minutes_unanswered':
      return 'Add how many minutes you trained.';
    case 'effort_unanswered':
      return 'Slide how hard training felt.';
    case 'not_recordable':
      return refusalMessage ?? 'This session can’t be logged right now.';
  }
}
