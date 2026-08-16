/**
 * THE DOOR THE MISSED-SESSION QUESTION'S ANSWER GOES THROUGH.
 *
 * Two answers, two behaviours, and the asymmetry is the contract's:
 *
 *   CONFIRM  → one canonical commitment fact is written and the program is
 *              rebuilt through the CURRENT scheduler.
 *   DECLINE  → the answer is recorded and NOTHING ELSE HAPPENS. The existing
 *              commitment stands, byte for byte.
 *
 * ## ⚠ IT REBUILDS THROUGH THE EXISTING TRANSACTION. THERE IS NO SECOND PATH.
 *
 * `commitProfileProgramTransaction({ kind: 'profile_setup', patch })` is already
 * the app's one owner of "apply a profile change and rebuild the program on it"
 * — it takes the accepted-state revision, applies the patch, regenerates and
 * commits the surfaces atomically. A rebuild written here would be a second
 * rebuild path, free to disagree with the first about override sweeps, accepted
 * revisions and coach mutations. **The confirmation supplies a patch; it does
 * not know how to rebuild.**
 *
 * ## THE ORDER, AND WHY IT IS THIS ONE
 *
 * The transaction runs FIRST; the ledger entry is appended only if it succeeded.
 *
 * The two failure modes are not symmetric. A ledger entry with no rebuild would
 * leave the question ANSWERED and the programme UNCHANGED — the app would have
 * recorded a commitment it never honoured, and the athlete would never be asked
 * again. A rebuild with no ledger entry leaves the athlete on their new,
 * correctly built commitment and merely liable to be asked once more. **The
 * second is annoying; the first is a lie**, so the write that can lie goes last.
 */

import type { DayOfWeek, OnboardingData } from '../types/domain';
import { appendDecisionEntry } from './decisionLedgerStore';
import {
  commitProfileProgramTransaction,
  type ProfileProgramTransactionResult,
} from './profileProgramTransaction';
import { commitmentPatchFor } from '../rules/weeklyCommitmentQuestion';
import { DAYS_OF_WEEK } from '../rules/gameAnchor';

export const WEEKLY_COMMITMENT_SOURCE_SURFACE = 'missed_session_commitment_question';
/**
 * The GROWING direction's surface. Same door, same transaction, same ledger
 * entry — a different surface name, so the receipt says which card the athlete
 * actually tapped.
 */
export const EXTRA_SESSION_SOURCE_SURFACE = 'extra_session_offer';

export interface ConfirmWeeklyCommitmentResult extends ProfileProgramTransactionResult {
  /** The commitment that was written, absent when nothing was. */
  committed?: { sessionsPerWeek: number; trainingDays: DayOfWeek[] };
}

export async function confirmWeeklyCommitment(args: {
  forBlockNumber: number;
  sessionsPerWeek: number;
  profile: Pick<OnboardingData, 'preferredTrainingDays'>;
  todayISO: string;
  weekOrder?: readonly DayOfWeek[];
  expectedAcceptedRevision?: number;
  /**
   * The days the athlete could train and has not committed. Present only when
   * the answer GROWS the commitment; `commitmentPatchFor` ignores it otherwise,
   * so the missed-session caller is unaffected by not passing it.
   */
  availableDays?: readonly DayOfWeek[];
  /** Which card was tapped. Defaults to the missed-session question. */
  sourceSurface?: string;
}): Promise<ConfirmWeeklyCommitmentResult> {
  const { forBlockNumber, sessionsPerWeek, profile, todayISO } = args;
  const patch = commitmentPatchFor({
    profile,
    sessionsPerWeek,
    weekOrder: args.weekOrder ?? DAYS_OF_WEEK,
    ...(args.availableDays !== undefined ? { availableDays: args.availableDays } : {}),
  });

  const outcome = await commitProfileProgramTransaction({
    change: { kind: 'profile_setup', patch },
    todayISO,
    sourceSurface: args.sourceSurface ?? WEEKLY_COMMITMENT_SOURCE_SURFACE,
    ...(args.expectedAcceptedRevision !== undefined
      ? { expectedAcceptedRevision: args.expectedAcceptedRevision }
      : {}),
  });
  if (!outcome.ok) return outcome;

  appendDecisionEntry({
    decision: {
      kind: 'weekly_commitment_answer',
      forBlockNumber,
      answer: {
        kind: 'confirmed',
        sessionsPerWeek,
        // THE DAYS THAT WERE ACTUALLY WRITTEN, not the count that was asked for.
        // Recording the request rather than the result is how a ledger comes to
        // describe a decision the app did not make.
        trainingDays: patch.preferredTrainingDays,
      },
    },
    provenance: 'athlete_tap',
    writer: 'weekly_commitment_door',
  });

  return {
    ...outcome,
    committed: { sessionsPerWeek, trainingDays: patch.preferredTrainingDays },
  };
}

/**
 * The athlete said no.
 *
 * ⚠ **IT TOUCHES NO PROGRAM STATE AT ALL, AND HAS NO WAY TO.** Clause 8 —
 * *"declining/dismissing keeps the existing commitment"* — is held by this
 * function importing nothing that can write a program, not by a branch that
 * chooses not to.
 */
export function declineWeeklyCommitment(args: { forBlockNumber: number }): void {
  appendDecisionEntry({
    decision: {
      kind: 'weekly_commitment_answer',
      forBlockNumber: args.forBlockNumber,
      answer: { kind: 'declined' },
    },
    provenance: 'athlete_tap',
    writer: 'weekly_commitment_door',
  });
}

/**
 * The athlete has read the block-boundary notice.
 *
 * ⚠ **NO PROGRAM WRITE, AND NO WAY TO MAKE ONE.** *"Dismissing it does not alter
 * the program"* is held by this function importing nothing that can write one —
 * the same construction the decline above uses.
 */
export function acknowledgeBlockBoundaryNotice(args: { forBlockNumber: number }): void {
  appendDecisionEntry({
    decision: {
      kind: 'block_boundary_notice_acknowledged',
      forBlockNumber: args.forBlockNumber,
    },
    provenance: 'athlete_tap',
    writer: 'weekly_commitment_door',
  });
}
