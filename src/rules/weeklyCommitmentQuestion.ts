/**
 * THE MISSED-SESSION QUESTION — "is the weekly commitment unrealistic?"
 *
 * The approved contract, verbatim: *"One disrupted week does not redesign the
 * program. When the athlete completes less than roughly 75 percent of required
 * sessions across the block, ask whether the weekly commitment is unrealistic.
 * ... Rebuild only after the athlete confirms. Do not shame them, cram missed
 * work into later days or silently reduce the plan."*
 *
 * ## ⚠ THE QUESTION IS DERIVED. ONLY THE ANSWER IS STORED.
 *
 * `docs/NORTH_STAR.md`: **store only decisions, derive everything else.** The
 * ask is a function of facts the app already persists — the logged sessions and
 * the commitment the block was built on — so storing it would be storing a
 * derivation, and a stored derivation is a derivation that can go stale against
 * the facts underneath it. It survives reload because it is RECOMPUTED, which is
 * a stronger guarantee than persistence: a question re-derived from the same
 * facts cannot come back different, and a question whose facts changed cannot
 * come back wrong.
 *
 * The ANSWER is an athlete decision and goes where every athlete decision goes —
 * one appended `weekly_commitment_answer` entry on the decision ledger. **No new
 * persisted key is created by this unit**, so `test:persisted-inputs-schema`'s
 * four-class property is untouched.
 *
 * ## THERE IS NO SEPARATE "ONE DISRUPTED WEEK" RULE, AND THAT IS DELIBERATE
 *
 * The contract's first sentence and its threshold are ONE mechanism, not two:
 * with the whole block as the denominator, a single empty week out of four is
 * `9/12` — exactly 75%, which is not BELOW 75%, so it cannot ask. *"One
 * disrupted week does not redesign the program"* is what choosing the
 * block-length denominator BUYS. A second explicit `disruptedWeeks >= 2`
 * condition would be a branch that never binds — decoration a mutation would
 * delete with no cell moving — so the property is guarded directly instead, by
 * driving a single empty week and proving no ask.
 *
 * ## WHAT IT REFUSES TO DO
 *
 * It reduces nothing, moves nothing and rebuilds nothing. It returns a QUESTION.
 * Clause 6 of the mission — *"the existing commitment remains unchanged until
 * the athlete confirms"* — is true here by construction: this module has no
 * writer at all.
 */

import type { DayOfWeek, OnboardingData } from '../types/domain';
import type { SessionFeedback } from '../store/programStore';
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import { QUALIFYING_COMPLETION_RATIO } from './blockBoundaryProgression';

/**
 * THE SAME 75% IN BOTH DIRECTIONS, AND IT IS THE SAME CONSTANT.
 *
 * The contract states one threshold and gives it two consequences: below it the
 * app does not progress, and below it the app asks. Two constants holding one
 * number is how they come to disagree, so this is an alias of the progression
 * owner's, not a copy of it.
 */
export const COMMITMENT_QUESTION_THRESHOLD = QUALIFYING_COMPLETION_RATIO;

/**
 * What the block actually recorded, as an attendance question.
 *
 * ⚠ **SEPARATE FROM `readBlockHistory`, ON PURPOSE.** That reads the block to
 * decide how to PROGRESS and counts only sessions carrying strength work.
 * Attendance is a different question with a different denominator: every
 * session the block asked for, whatever kind it was. One function answering
 * both is the two-questions-one-predicate defect this repo has paid for twice.
 */
export interface BlockAttendance {
  /** Sessions the athlete marked fully complete inside the block window. */
  completedSessions: number;
  /** Sessions the block asked for — `sessionsPerWeek × weeks`. */
  requiredSessions: number;
  sessionsPerWeek: number;
  weeks: number;
  /** `completedSessions / requiredSessions`, or 0 when nothing was required. */
  ratio: number;
  belowThreshold: boolean;
}

export function readBlockAttendance(args: {
  feedbackByDate: Readonly<Record<string, SessionFeedback>>;
  /** Inclusive block window. */
  blockStartISO: string;
  blockEndISO: string;
  /** The commitment the block was BUILT on — the denominator's authority. */
  sessionsPerWeek: number;
  weeks: number;
}): BlockAttendance {
  const { feedbackByDate, blockStartISO, blockEndISO, sessionsPerWeek, weeks } = args;

  let completedSessions = 0;
  for (const [dateStr, feedback] of Object.entries(feedbackByDate)) {
    if (dateStr < blockStartISO || dateStr > blockEndISO) continue;
    // ⚠ 'full' ONLY. A `partial` session is real work, but the app does not know
    // WHICH work was done — the contract's standing no-inference rule — and
    // counting it would let a block of half-sessions read as full attendance.
    // A `skipped` session is the very thing being counted against.
    if (feedback.completion === 'full') completedSessions++;
  }

  const requiredSessions = Math.max(0, Math.round(sessionsPerWeek * weeks));
  const ratio = requiredSessions > 0 ? completedSessions / requiredSessions : 0;

  return {
    completedSessions,
    requiredSessions,
    sessionsPerWeek,
    weeks,
    ratio,
    // STRICTLY BELOW. "Less than roughly 75 percent" — an athlete who hits the
    // line exactly has met it, and that equality is what makes one empty week
    // of four a non-event.
    belowThreshold: requiredSessions > 0 && ratio < COMMITMENT_QUESTION_THRESHOLD,
  };
}

/**
 * The question, when there is one.
 *
 * `numbersToShow` are what the athlete's sentence says — a WEEKLY average, not a
 * block total, because the contract's own example is weekly (*"about two of your
 * four planned sessions"*) and an athlete does not think in blocks.
 */
export interface WeeklyCommitmentQuestion {
  /** Which block's attendance raised it. Also what an answer is recorded against. */
  forBlockNumber: number;
  attendance: BlockAttendance;
  /** Rounded weekly completions — the `[completed]` in the sentence. */
  completedPerWeek: number;
  /** The commitment — the `[planned]` in the sentence. */
  plannedPerWeek: number;
  /**
   * The smaller weekly session counts the athlete may choose, largest first.
   * Empty means there is nothing legal to offer, and then there is NO question:
   * asking a question whose every answer is refused is worse than not asking.
   */
  options: readonly number[];
}

/** Why no question was raised. Returned so a caller can say which gate closed. */
export type WeeklyCommitmentQuestionRefusal =
  | 'attendance_met'
  | 'already_answered_for_this_block'
  | 'no_legal_smaller_commitment'
  | 'nothing_required';

export type WeeklyCommitmentQuestionOutcome =
  | { ask: true; question: WeeklyCommitmentQuestion }
  | { ask: false; refusal: WeeklyCommitmentQuestionRefusal };

/**
 * Is a smaller weekly commitment one this athlete's phase, gym and schedule can
 * actually carry?
 *
 * ⚠ **INJECTED, BECAUSE THE ANSWER IS THE WEEK VALIDATOR'S AND NOT THIS
 * MODULE'S.** The app already has exactly one authority on whether a commitment
 * produces a legal week — generation, which REFUSES with
 * `GeneratedWeekRefusedError` (`sprint_high_speed_required_minimum`,
 * `main_strength_permitted_maximum`, `required_safe_patterns_present`, and the
 * rest). A phase/gym table written here would be a SECOND authority, free to
 * disagree with the first, and the athlete would find out by choosing an option
 * that then refused to build.
 *
 * `commitmentLegality` in `weeklyCommitmentLegality.ts` is the production
 * default and it asks generation.
 */
export type CommitmentLegalityProbe = (sessionsPerWeek: number) => boolean;

export function decideWeeklyCommitmentQuestion(args: {
  attendance: BlockAttendance;
  forBlockNumber: number;
  /** The whole ledger. Read for a prior answer to THIS block, and nothing else. */
  ledgerEntries: readonly DecisionLedgerEntry[];
  isCommitmentLegal: CommitmentLegalityProbe;
}): WeeklyCommitmentQuestionOutcome {
  const { attendance, forBlockNumber, ledgerEntries, isCommitmentLegal } = args;

  if (attendance.requiredSessions === 0) return { ask: false, refusal: 'nothing_required' };
  if (!attendance.belowThreshold) return { ask: false, refusal: 'attendance_met' };

  // ASKED AND ANSWERED IS ASKED AND ANSWERED — including a DECLINE.
  // Clause 8: declining keeps the existing commitment. An app that re-asks the
  // next time the screen is drawn has not accepted the answer, it has nagged.
  if (answerForBlock(ledgerEntries, forBlockNumber) !== null) {
    return { ask: false, refusal: 'already_answered_for_this_block' };
  }

  const options: number[] = [];
  for (let count = attendance.sessionsPerWeek - 1; count >= 1; count--) {
    if (isCommitmentLegal(count)) options.push(count);
  }
  if (options.length === 0) return { ask: false, refusal: 'no_legal_smaller_commitment' };

  return {
    ask: true,
    question: {
      forBlockNumber,
      attendance,
      // "about" is the contract's own word and is what licenses the rounding.
      completedPerWeek: attendance.weeks > 0
        ? Math.round(attendance.completedSessions / attendance.weeks)
        : 0,
      plannedPerWeek: attendance.sessionsPerWeek,
      options,
    },
  };
}

/**
 * The athlete's recorded answer for one block, or `null` if they have not
 * answered. Reads the ledger; writes nothing.
 */
export function answerForBlock(
  ledgerEntries: readonly DecisionLedgerEntry[],
  forBlockNumber: number,
): { kind: 'confirmed'; sessionsPerWeek: number; trainingDays: DayOfWeek[] }
  | { kind: 'declined' }
  | null {
  // LAST ANSWER WINS. The ledger is append-only, so a change of mind is a second
  // entry, never an edit of the first.
  for (let index = ledgerEntries.length - 1; index >= 0; index--) {
    const decision = ledgerEntries[index].decision;
    if (decision.kind !== 'weekly_commitment_answer') continue;
    if (decision.forBlockNumber !== forBlockNumber) continue;
    return decision.answer;
  }
  return null;
}

/** A frequency answer preserves the separately recorded equipment-access days. */
export function commitmentPatchFor(args: {
  profile: Pick<OnboardingData, 'preferredTrainingDays'>;
  sessionsPerWeek: number;
  weekOrder: readonly DayOfWeek[];
  /** Compatibility input from existing callers; never grants equipment access. */
  availableDays?: readonly DayOfWeek[];
}): { preferredTrainingDays: DayOfWeek[]; trainingDaysPerWeek: number } {
  const { profile, sessionsPerWeek, weekOrder } = args;
  const ordered = [...(profile.preferredTrainingDays ?? [])].sort(
    (a, b) => weekOrder.indexOf(a) - weekOrder.indexOf(b),
  );
  return { preferredTrainingDays: ordered, trainingDaysPerWeek: sessionsPerWeek };
}
