/**
 * THE LADDER'S THIRD RUNG — *"would you like to add one session each week?"*
 *
 * The approved contract: *"3. Add another session only when phase, schedule and
 * gym availability permit it, **and after athlete confirmation**"*, reached only
 * when *"everything consistently easy: load first, sets second, then consider
 * another session."*
 *
 * ## ⚠ IT NEVER ADDS A SESSION. IT CANNOT.
 *
 * This module returns a QUESTION, exactly as `weeklyCommitmentQuestion` does for
 * the shrinking direction, and it imports nothing that can write a program.
 * *"Do not silently add a session"* is structural here rather than a branch
 * somebody has to remember not to take.
 *
 * ## ⚠ THE ANSWER RIDES THE EXISTING `weekly_commitment_answer` ENTRY
 *
 * There is ONE question in this app of the form *"how many sessions a week"*,
 * asked in two directions, and one canonical answer to it per block. Minting a
 * second ledger kind would give the app two records of one decision and two
 * places to look before re-asking — and *"declining must not repeatedly ask
 * during the same block"* is exactly a question about where you look.
 *
 * The two directions cannot collide: the shrinking question fires only when
 * attendance is BELOW 75%, and this one only when the block QUALIFIES, which
 * requires attendance at or above it. **No block can raise both.**
 *
 * ## ⚠ "ONLY AFTER LOAD AND SET PROGRESSION" IS STRUCTURAL, NOT A GATE
 *
 * The order names TWO ways to reach this rung: the smaller ones are
 * *unavailable* (nothing left to raise) or *insufficient* (they were raised and
 * the athlete still found the block easy). **Both must open the offer**, so a
 * gate testing which of the two happened cannot decide anything — and a gate
 * demanding that the smaller rungs LANDED is worse than decoration: it locks out
 * the exact athlete the word *unavailable* was written for.
 *
 * ⚠ **THAT GATE WAS BUILT AND REMOVED, AND A MEASUREMENT IS WHY.** A clubless
 * off-season athlete on two gym days is authored at **16 main/secondary sets in
 * every session** — the WC-030 ceiling exactly — so the set rung has nowhere to
 * go, and the block's every load reads `history_held`. That athlete finds the
 * block easy, has three free days, and generation builds their three-day week:
 * they are the contract's "unavailable" case in a real generated world, and the
 * gate refused them.
 *
 * What makes the ORDER true is not a gate. This question is derived from a
 * STORED block in which the boundary has already decided load and sets, so the
 * two smaller rungs have been answered before the third is ever put.
 *
 * ## ⚠ THE LEGALITY ANSWER IS GENERATION'S
 *
 * `commitmentLegalityProbe` builds the week at the candidate count and reports
 * whether it refused. That is already the app's only authority on *"can this
 * athlete train this often"* and it is count-agnostic, so the growing direction
 * uses it unchanged. A phase/gym table here would be a second authority free to
 * disagree, and the athlete would find out by accepting an offer that then
 * refused to build.
 *
 * ## WHAT "GYM AVAILABILITY PERMITS IT" READS
 *
 * `availableTrainingDays` below, from facts the athlete gave onboarding: the
 * days they did not pick, minus team training, minus the game day, minus every
 * active `unavailable_day` availability constraint. **A day the athlete told the
 * app they cannot train is not availability**, and offering a fourth session
 * with nowhere legal to put it is an offer the app cannot honour.
 */

import type { DayOfWeek, OnboardingData } from '../types/domain';
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import type { BlockHistorySignal } from './blockBoundaryProgression';
import { answerForBlock, type CommitmentLegalityProbe } from './weeklyCommitmentQuestion';
import { storedGameAnchor } from './gameAnchor';

/** *"one additional weekly session"* — the contract's number, and the only one. */
export const EXTRA_SESSION_STEP = 1;

export interface ExtraSessionOffer {
  /** Which block's training earned it. Also what an answer is recorded against. */
  forBlockNumber: number;
  /** What the athlete trains now. */
  currentSessionsPerWeek: number;
  /** What accepting would make it — always `current + 1`. */
  offeredSessionsPerWeek: number;
  /** The day set accepting would write. Proven buildable by the probe. */
  trainingDays: readonly DayOfWeek[];
}

/**
 * Why no offer was made. Returned rather than collapsed to `null` so a caller —
 * and a guard — can say which gate closed.
 */
export type ExtraSessionOfferRefusal =
  /** The block was not completed and well-recovered enough to progress at all. */
  | 'block_did_not_qualify'
  /** The athlete found it hard, or said nothing. Only "consistently easy" asks. */
  | 'not_consistently_easy'
  /** Asked and answered for this block — including a decline. */
  | 'already_answered_for_this_block'
  /** Every day the athlete has is already committed. */
  | 'no_available_day'
  /** Generation refuses the larger week for this athlete. */
  | 'no_legal_larger_commitment';

export type ExtraSessionOfferOutcome =
  | { offer: true; question: ExtraSessionOffer }
  | { offer: false; refusal: ExtraSessionOfferRefusal };

/**
 * The days this athlete could train on and has not committed.
 *
 * Reads only recorded onboarding facts. Nothing here is inferred from how the
 * athlete has behaved — *"gym availability"* is something they told the app, not
 * something it can deduce from attendance.
 */
export function availableTrainingDays(args: {
  profile: OnboardingData;
  weekOrder: readonly DayOfWeek[];
}): DayOfWeek[] {
  const { profile, weekOrder } = args;
  const taken = new Set<DayOfWeek>();
  const gameDay = storedGameAnchor(profile);
  if (gameDay) taken.add(gameDay);

  // ⚠ AN INACTIVE OR EXPIRED CONSTRAINT IS NOT A CONSTRAINT, AND `active`
  // DEFAULTS TO TRUE. `ProgramAvailabilityConstraint.active` is optional and the
  // rest of the app treats a missing flag as live, so a constraint written
  // before the flag existed must still block the day.
  for (const constraint of profile.availabilityConstraints ?? []) {
    if (constraint.kind !== 'unavailable_day') continue;
    if (constraint.active === false) continue;
    if (constraint.dayOfWeek) taken.add(constraint.dayOfWeek);
  }

  return weekOrder.filter((day) => (profile.preferredTrainingDays ?? []).includes(day) && !taken.has(day));
}

export function decideExtraSessionOffer(args: {
  history: BlockHistorySignal;
  forBlockNumber: number;
  profile: OnboardingData;
  weekOrder: readonly DayOfWeek[];
  ledgerEntries: readonly DecisionLedgerEntry[];
  isCommitmentLegal: CommitmentLegalityProbe;
  /** The day set the block was built on. */
  currentSessionsPerWeek: number;
  /**
   * The day set a `sessionsPerWeek` would write, as `commitmentPatchFor` builds
   * it. Injected so this module never becomes a second author of a schedule.
   */
  patchFor: (sessionsPerWeek: number) => { preferredTrainingDays: DayOfWeek[] };
}): ExtraSessionOfferOutcome {
  const {
    history, forBlockNumber, profile, weekOrder, ledgerEntries,
    isCommitmentLegal, currentSessionsPerWeek, patchFor,
  } = args;

  // ── THE GATES, IN THE CONTRACT'S ORDER ──
  //
  // *"When training is being completed and recovery is good"*. This also carries
  // the low-readiness refusal: `qualifies` requires `recoveryVerdict === 'good'`,
  // and a very-hard block cannot have one, so *"do not add sessions in this
  // state"* is enforced here rather than by a second check no world could reach.
  if (!history.qualifies) return { offer: false, refusal: 'block_did_not_qualify' };

  // *"everything consistently easy"* — NOT merely "good". `hard` is a legal,
  // well-recovered answer that buys load and a set; it does not buy a training
  // day. Conditioning must not have been hard either: adding a session to an
  // athlete who is already struggling with the running is the contract's
  // *"a difficult required quality must remain achievable"* read backwards.
  const conditioningNotHard = history.byQuality.conditioning !== 'very_hard'
    && (history.byQuality.conditioningAnswerDays === 0 || history.byQuality.conditioningEasy);
  if (!history.byQuality.strengthEasy || !conditioningNotHard) {
    return { offer: false, refusal: 'not_consistently_easy' };
  }

  // ASKED AND ANSWERED IS ASKED AND ANSWERED — including a decline. An app that
  // re-offers on the next redraw has not accepted the answer, it has nagged.
  if (answerForBlock(ledgerEntries, forBlockNumber) !== null) {
    return { offer: false, refusal: 'already_answered_for_this_block' };
  }

  const offeredSessionsPerWeek = currentSessionsPerWeek + EXTRA_SESSION_STEP;
  const trainingDays = patchFor(offeredSessionsPerWeek).preferredTrainingDays;
  // Equipment access can exceed the requested frequency; it may never be invented.
  if (trainingDays.length < offeredSessionsPerWeek) {
    return { offer: false, refusal: 'no_available_day' };
  }
  if (!isCommitmentLegal(offeredSessionsPerWeek)) {
    return { offer: false, refusal: 'no_legal_larger_commitment' };
  }

  return {
    offer: true,
    question: {
      forBlockNumber,
      currentSessionsPerWeek,
      offeredSessionsPerWeek,
      trainingDays,
    },
  };
}
