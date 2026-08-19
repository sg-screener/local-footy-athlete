/**
 * DRIVING THE COACH'S WEEKLY-COMMITMENT CONVERSATION FROM A SUITE.
 *
 * R-105 moved the missed-session question and the extra-session offer off the
 * Program surface into the Coach tab. The suites that held them were driving
 * `deriveBlockBoundaryPrompts`; they drive the new owner through here.
 *
 * ⚠ **IT CALLS `coachWeeklyCommitmentInputs`, THE PRODUCTION ASSEMBLY.** A shim
 * that rebuilt those arguments by hand would be testing its own assembly — the
 * shape that has cost this repo a whole measurement before (`AN UNDER-FED STATE
 * ANSWERS "NO"`). Everything below is either a store read or a value the caller
 * already has.
 */

import {
  coachWeeklyCommitmentInputs,
} from '../../screens/coach/useCoachWeeklyCommitment';
import {
  deriveWeeklyCommitmentConversation,
  type CommitmentConversation,
  type CommitmentConversationOutcome,
} from '../../rules/weeklyCommitmentConversation';
import type { OnboardingData, TrainingProgram } from '../../types/domain';
import type { AcceptedBlockRecord, SessionFeedback } from '../../store/programStore';
import type { DecisionLedgerEntry } from '../../types/decisionLedger';

export interface ConversationForArgs {
  program: TrainingProgram | null | undefined;
  blockNumber: number | null;
  blockStartISO: string | null;
  todayISO: string;
  feedback: Readonly<Record<string, SessionFeedback>>;
  profile: OnboardingData | null | undefined;
  ledgerEntries?: readonly DecisionLedgerEntry[];
  /**
   * ⚠ REQUIRED, and the omission is the defect this move closed. On `main` the
   * only production caller never passed it, so the completion denominator was 0
   * and the extra-session offer could not reach one athlete.
   */
  acceptedBlocks: Readonly<Record<string, AcceptedBlockRecord>>;
}

export function conversationFor(args: ConversationForArgs): CommitmentConversationOutcome {
  return deriveWeeklyCommitmentConversation(coachWeeklyCommitmentInputs({
    currentProgram: args.program ?? null,
    blockNumber: args.blockNumber,
    blockStartISO: args.blockStartISO,
    sessionFeedback: args.feedback,
    acceptedBlocks: args.acceptedBlocks,
    onboardingData: args.profile ?? null,
    ledgerEntries: args.ledgerEntries ?? [],
    todayISO: args.todayISO,
  }));
}

/** The conversation, or `null`. Convenience over the outcome's two fields. */
export function conversationOrNull(args: ConversationForArgs): CommitmentConversation | null {
  return conversationFor(args).value;
}

/** Only the shrinking direction, so a cell can say WHICH question it means. */
export function smallerWeekQuestion(args: ConversationForArgs): CommitmentConversation | null {
  const value = conversationOrNull(args);
  return value && value.direction === 'smaller_week' ? value : null;
}

/** Only the growing direction. */
export function extraSessionOffer(args: ConversationForArgs): CommitmentConversation | null {
  const value = conversationOrNull(args);
  return value && value.direction === 'extra_session' ? value : null;
}
