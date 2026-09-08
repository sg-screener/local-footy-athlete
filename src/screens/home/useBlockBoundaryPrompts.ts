/**
 * THE ONE BLOCK-BOUNDARY PROMPT THE PROGRAM SURFACE STILL DRAWS.
 *
 * The reduced week's stored explanation, until acknowledged or expired.
 *
 * ## ⚠ WHAT LEFT THIS FILE, AND WHERE IT WENT — R-105
 *
 * **Sam, 2026-08-19, looking at the Program screen in a simulator screenshot:**
 * *"This should not be popping up on the main page - it should show up in the
 * coaches chat with a notification"*.
 *
 * Two of the three prompts moved out on 2026-08-20:
 *
 * - the missed-session commitment question (`deriveCommitment`), and
 * - the extra-session offer (`deriveExtraSession`),
 *
 * to **`src/rules/weeklyCommitmentConversation.ts`**, reached by the Coach tab
 * through `src/screens/coach/useCoachWeeklyCommitment.ts`. What they DECIDE is
 * unchanged, line for line; what changed is which surface owns the
 * conversation. `docs/UNDO_SURFACE_RULING_2026-08-09.md` already recorded Sam's
 * architecture — *"the coach should be its own tab and the athlete just talks to
 * it when it wants to change something"* — so a multiple-choice program
 * negotiation on the Day page was a **second change-interface beside the
 * recorded one**.
 *
 * **THE DERIVATION MOVED, NOT JUST THE RENDER.** Leaving it here and merely not
 * drawing it would leave the Program surface holding a live offer one JSX line
 * away from returning, which is not what a ruling is for.
 *
 * ## WHY THE NOTICE STAYS
 *
 * It is a NOTICE about a decision the app has already taken and already
 * applied — not a negotiation, and nothing about it asks the athlete to choose.
 * R-105's subject is *"a surface that asks the athlete to renegotiate their
 * week"*, and this is not one.
 *
 * ## ⚠ IT DERIVES. IT HAS NO WRITER AND CANNOT ACQUIRE ONE BY ACCIDENT.
 *
 * The notice is a function of the stored program's own `blockBoundaryExplanation`
 * and the decision ledger. Nothing here writes; the acknowledgement goes through
 * `store/weeklyCommitmentAnswer.ts`, which is the only module that does.
 */

import { useMemo } from 'react';
import type { TrainingProgram } from '../../types/domain';
import type { DecisionLedgerEntry } from '../../types/decisionLedger';
import {
  isReductionExplanationRow,
  reductionExplanationCoversWeek,
  type BlockBoundaryReductionExplanationRow,
} from '../../rules/blockBoundaryProgression';
import { blockBoundaryReducedSentence } from '../../rules/projectionCopy';
import type { SignedCopy } from '../../rules/signedCopy';

export interface BlockBoundaryNoticeModel {
  forBlockNumber: number;
  /** Sam's signed sentence, rendered from the STORED row. */
  sentence: SignedCopy;
  /** The stored row itself, so the card can show what actually changed. */
  row: BlockBoundaryReductionExplanationRow;
}

export interface BlockBoundaryPrompts {
  notice: BlockBoundaryNoticeModel | null;
}

export interface BlockBoundaryPromptInputs {
  currentProgram: TrainingProgram | null | undefined;
  blockNumber: number | null | undefined;
  ledgerEntries: readonly DecisionLedgerEntry[];
  weekStartISO: string;
}

/**
 * Pure — the hook below is `useMemo` over this and nothing else, so every cell
 * that drives the prompt drives the same code the screen does.
 */
export function deriveBlockBoundaryPrompts(
  input: BlockBoundaryPromptInputs,
): BlockBoundaryPrompts {
  const { currentProgram, blockNumber, ledgerEntries, weekStartISO } = input;
  return { notice: deriveNotice(currentProgram, blockNumber, ledgerEntries, weekStartISO) };
}

function deriveNotice(
  program: TrainingProgram | null | undefined,
  blockNumber: number | null | undefined,
  ledgerEntries: readonly DecisionLedgerEntry[],
  weekStartISO: string,
): BlockBoundaryNoticeModel | null {
  if (!program || typeof blockNumber !== 'number') return null;
  const row = (program.blockBoundaryExplanation ?? []).find(isReductionExplanationRow);
  if (!row || !reductionExplanationCoversWeek(row, weekStartISO, program.microcycles[0]?.startDate)) return null;
  // ⚠ ACKNOWLEDGEMENT IS READ OFF THE LEDGER, NOT OFF LOCAL STATE.
  // "It survives reload until acknowledged" is the requirement, and a
  // `useState` dismissal satisfies the first half of that sentence and breaks
  // the second: the card would come back on every relaunch forever.
  if (acknowledged(ledgerEntries, blockNumber)) return null;
  const sentence = blockBoundaryReducedSentence(row);
  // The sentence refuses to render when the stored row does not support its two
  // claims. NO ROW MEANS NO CARD — a card with a changed programme and no
  // explanation is worse than no card.
  if (!sentence) return null;
  return { forBlockNumber: blockNumber, sentence, row };
}

export function acknowledged(
  ledgerEntries: readonly DecisionLedgerEntry[],
  forBlockNumber: number,
): boolean {
  return ledgerEntries.some((entry) =>
    entry.decision.kind === 'block_boundary_notice_acknowledged'
    && entry.decision.forBlockNumber === forBlockNumber);
}

export function useBlockBoundaryPrompts(
  input: BlockBoundaryPromptInputs,
): BlockBoundaryPrompts {
  const { currentProgram, blockNumber, ledgerEntries, weekStartISO } = input;
  return useMemo(
    () => deriveBlockBoundaryPrompts({ currentProgram, blockNumber, ledgerEntries, weekStartISO }),
    [currentProgram, blockNumber, ledgerEntries, weekStartISO],
  );
}
