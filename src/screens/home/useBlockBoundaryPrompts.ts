/**
 * THE TWO BLOCK-BOUNDARY PROMPTS THE PROGRAM SURFACE DRAWS.
 *
 *   1. the very-hard block's stored explanation, until the athlete reads it;
 *   2. the missed-session commitment question, when block attendance is below
 *      the approved threshold.
 *
 * ## ⚠ IT DERIVES. IT HAS NO WRITER AND CANNOT ACQUIRE ONE BY ACCIDENT.
 *
 * Both prompts are functions of facts already persisted — the stored program's
 * own `blockBoundaryExplanation`, the logged sessions, the athlete's commitment,
 * and the decision ledger. Nothing here writes; the answers go through
 * `store/weeklyCommitmentAnswer.ts`, which is the only module that does.
 *
 * That is what makes *"nothing changes before confirmation"* and *"dismissing it
 * does not alter the program"* structural rather than a branch someone has to
 * remember not to take.
 *
 * ## WHY A SEPARATE HOOK AND NOT MORE OF `useHomeScreen`
 *
 * `useHomeScreen` is already sixteen hundred lines and owns the whole week. Both
 * prompts share one question — *"which block just ended, and what did the
 * athlete do in it"* — and giving that its own module means the guards can drive
 * the derivation without mounting the screen, and the screen gains two values
 * rather than two hundred lines.
 */

import { useMemo } from 'react';
import type { DayOfWeek, OnboardingData, TrainingProgram } from '../../types/domain';
import type { SessionFeedback } from '../../store/programStore';
import type { DecisionLedgerEntry } from '../../types/decisionLedger';
import {
  isReductionExplanationRow,
  readBlockHistory,
  type BlockBoundaryReductionExplanationRow,
} from '../../rules/blockBoundaryProgression';
import {
  availableTrainingDays,
  decideExtraSessionOffer,
  type ExtraSessionOffer,
} from '../../rules/extraSessionOffer';
import {
  commitmentPatchFor,
  decideWeeklyCommitmentQuestion,
  readBlockAttendance,
  type WeeklyCommitmentQuestion,
} from '../../rules/weeklyCommitmentQuestion';
import { commitmentLegalityProbe } from '../../rules/weeklyCommitmentLegality';
import { previousBlockBoundsISO, WEEKS_PER_BLOCK } from '../../utils/programBlockState';
import {
  blockBoundaryReducedSentence,
  extraSessionOfferAcceptLabel,
  extraSessionOfferDeclineLabel,
  extraSessionOfferSentence,
  missedSessionCommitmentOptionLabel,
  missedSessionCommitmentQuestionSentence,
} from '../../rules/projectionCopy';
import type { SignedCopy } from '../../rules/signedCopy';

export interface BlockBoundaryNoticeModel {
  forBlockNumber: number;
  /** Sam's signed sentence, rendered from the STORED row. */
  sentence: SignedCopy;
  /** The stored row itself, so the card can show what actually changed. */
  row: BlockBoundaryReductionExplanationRow;
}

export interface WeeklyCommitmentPromptModel {
  question: WeeklyCommitmentQuestion;
  sentence: SignedCopy;
  options: readonly { sessionsPerWeek: number; label: SignedCopy }[];
}

/**
 * THE EXTRA-SESSION OFFER, READY TO DRAW.
 *
 * Every word is signed and the count has been proven buildable by generation, so
 * the card cannot offer a week the app would then refuse.
 */
export interface ExtraSessionOfferModel {
  offer: ExtraSessionOffer;
  sentence: SignedCopy;
  acceptLabel: SignedCopy;
  declineLabel: SignedCopy;
}

export interface BlockBoundaryPrompts {
  notice: BlockBoundaryNoticeModel | null;
  commitment: WeeklyCommitmentPromptModel | null;
  extraSession: ExtraSessionOfferModel | null;
}

export interface BlockBoundaryPromptInputs {
  currentProgram: TrainingProgram | null | undefined;
  blockNumber: number | null | undefined;
  /** Monday the CURRENT block started on — the window's right-hand edge. */
  blockStartISO: string | null | undefined;
  sessionFeedback: Readonly<Record<string, SessionFeedback>>;
  onboardingData: OnboardingData | null | undefined;
  ledgerEntries: readonly DecisionLedgerEntry[];
  weekOrder: readonly DayOfWeek[];
}

/**
 * Pure — the hook below is `useMemo` over this and nothing else, so every cell
 * that drives the prompts drives the same code the screen does.
 */
export function deriveBlockBoundaryPrompts(
  input: BlockBoundaryPromptInputs,
): BlockBoundaryPrompts {
  const {
    currentProgram, blockNumber, blockStartISO, sessionFeedback,
    onboardingData, ledgerEntries,
  } = input;

  return {
    notice: deriveNotice(currentProgram, blockNumber, ledgerEntries),
    commitment: deriveCommitment({
      blockNumber, blockStartISO, sessionFeedback, onboardingData, ledgerEntries,
    }),
    extraSession: deriveExtraSession({
      currentProgram, blockNumber, blockStartISO, sessionFeedback,
      onboardingData, ledgerEntries, weekOrder: input.weekOrder,
    }),
  };
}

/**
 * THE THIRD RUNG'S CARD.
 *
 * ⚠ **THE ATTENDANCE QUESTION AND THIS ONE CANNOT BOTH APPEAR.** That one fires
 * below 75% completion, this one requires `history.qualifies`, which requires at
 * or above it. They share the `weekly_commitment_answer` ledger entry precisely
 * because they are two directions of one question.
 */
function deriveExtraSession(args: {
  currentProgram: TrainingProgram | null | undefined;
  blockNumber: number | null | undefined;
  blockStartISO: string | null | undefined;
  sessionFeedback: Readonly<Record<string, SessionFeedback>>;
  onboardingData: OnboardingData | null | undefined;
  ledgerEntries: readonly DecisionLedgerEntry[];
  weekOrder: readonly DayOfWeek[];
}): ExtraSessionOfferModel | null {
  const {
    currentProgram, blockNumber, blockStartISO, sessionFeedback,
    onboardingData, ledgerEntries, weekOrder,
  } = args;
  if (!onboardingData || !currentProgram) return null;
  if (typeof blockNumber !== 'number' || !blockStartISO) return null;
  // BLOCK 1 HAS NO PREVIOUS BLOCK TO HAVE FOUND EASY.
  if (blockNumber < 2) return null;

  const currentSessionsPerWeek = onboardingData.trainingDaysPerWeek ?? 0;
  if (!(currentSessionsPerWeek > 0)) return null;

  // ⚠ THE SAME WINDOW THE BOUNDARY DECISION READ — `previousBlockBoundsISO` has
  // one owner so an athlete progressed off one window and offered off another is
  // not being told two stories about the same four weeks.
  const previous = previousBlockBoundsISO(blockStartISO);
  const history = readBlockHistory({
    feedbackByDate: sessionFeedback,
    blockStartISO: previous.startISO,
    blockEndISO: previous.endISO,
    requiredStrengthSessions: currentSessionsPerWeek * WEEKS_PER_BLOCK,
  });

  // ⚠ **AVAILABILITY IS READ INSIDE THE CLOSURES, NOT BEFORE THEM.**
  // `test:block-two-screen-delivery` holds a real cost property — *"an athlete
  // who was never going to be asked must not pay for the legality probe"* — and
  // its instrument counts reads of the profile's `preferredTrainingDays`.
  // Computing the free days up here read that field for every athlete on every
  // redraw, including the ones the very first gate refuses, and reddened two of
  // its cells. Both of these are closures: nothing runs until the gates pass.
  const outcome = decideExtraSessionOffer({
    history,
    forBlockNumber: blockNumber - 1,
    profile: onboardingData,
    weekOrder,
    ledgerEntries,
    isCommitmentLegal: (sessionsPerWeek) => commitmentLegalityProbe({
      profile: onboardingData,
      blockStartISO,
      blockNumber,
      weekOrder,
      availableDays: availableTrainingDays({ profile: onboardingData, weekOrder }),
    })(sessionsPerWeek),
    currentSessionsPerWeek,
    patchFor: (sessionsPerWeek) => commitmentPatchFor({
      profile: onboardingData,
      sessionsPerWeek,
      weekOrder,
      availableDays: availableTrainingDays({ profile: onboardingData, weekOrder }),
    }),
  });
  if (!outcome.offer) return null;

  return {
    offer: outcome.question,
    sentence: extraSessionOfferSentence(outcome.question),
    acceptLabel: extraSessionOfferAcceptLabel(),
    declineLabel: extraSessionOfferDeclineLabel(),
  };
}

function deriveNotice(
  program: TrainingProgram | null | undefined,
  blockNumber: number | null | undefined,
  ledgerEntries: readonly DecisionLedgerEntry[],
): BlockBoundaryNoticeModel | null {
  if (!program || typeof blockNumber !== 'number') return null;
  const row = (program.blockBoundaryExplanation ?? []).find(isReductionExplanationRow);
  if (!row) return null;
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

function deriveCommitment(args: {
  blockNumber: number | null | undefined;
  blockStartISO: string | null | undefined;
  sessionFeedback: Readonly<Record<string, SessionFeedback>>;
  onboardingData: OnboardingData | null | undefined;
  ledgerEntries: readonly DecisionLedgerEntry[];
}): WeeklyCommitmentPromptModel | null {
  const { blockNumber, blockStartISO, sessionFeedback, onboardingData, ledgerEntries } = args;
  if (!onboardingData || typeof blockNumber !== 'number' || !blockStartISO) return null;
  // BLOCK 1 HAS NO PREVIOUS BLOCK TO COUNT. Asking an athlete about attendance
  // in a block that has not happened is the app inventing a history.
  if (blockNumber < 2) return null;

  const sessionsPerWeek = onboardingData.trainingDaysPerWeek ?? 0;
  if (!(sessionsPerWeek > 0)) return null;

  // ⚠ THE SAME WINDOW THE BOUNDARY DECISION READ. `previousBlockBoundsISO` has
  // exactly one owner for exactly this reason — an athlete progressed off one
  // window and questioned off another is being told two different stories about
  // the same four weeks.
  const previous = previousBlockBoundsISO(blockStartISO);
  const attendance = readBlockAttendance({
    feedbackByDate: sessionFeedback,
    blockStartISO: previous.startISO,
    blockEndISO: previous.endISO,
    sessionsPerWeek,
    weeks: WEEKS_PER_BLOCK,
  });
  const forBlockNumber = blockNumber - 1;

  // ⚠ NO PRE-FILTER HERE, AND A MUTATION RUN IS WHY.
  // This function used to short-circuit on `attendance.belowThreshold` and on an
  // existing answer, "so the athlete does not pay for the legality probe".
  // **Both lines were decoration.** `decideWeeklyCommitmentQuestion` owns both
  // gates and returns before it ever CALLS the probe — constructing the probe is
  // a closure, not a build — so deleting them changed no answer and no cost, and
  // two mutations survived unnoticed. A branch that can be deleted with no
  // consequence is the defect this repo names outright, so it is deleted. The
  // gates are guarded where they live, in `test:block-two-difficult-missed`.
  const outcome = decideWeeklyCommitmentQuestion({
    attendance,
    forBlockNumber,
    ledgerEntries,
    isCommitmentLegal: commitmentLegalityProbe({
      profile: onboardingData,
      blockStartISO,
      blockNumber,
    }),
  });
  if (!outcome.ask) return null;

  return {
    question: outcome.question,
    sentence: missedSessionCommitmentQuestionSentence(outcome.question),
    options: outcome.question.options.map((sessionsPerWeekOption) => ({
      sessionsPerWeek: sessionsPerWeekOption,
      label: missedSessionCommitmentOptionLabel(sessionsPerWeekOption),
    })),
  };
}

export function useBlockBoundaryPrompts(
  input: BlockBoundaryPromptInputs,
): BlockBoundaryPrompts {
  const {
    currentProgram, blockNumber, blockStartISO, sessionFeedback,
    onboardingData, ledgerEntries, weekOrder,
  } = input;
  return useMemo(
    () => deriveBlockBoundaryPrompts({
      currentProgram, blockNumber, blockStartISO, sessionFeedback,
      onboardingData, ledgerEntries, weekOrder,
    }),
    [currentProgram, blockNumber, blockStartISO, sessionFeedback,
      onboardingData, ledgerEntries, weekOrder],
  );
}
