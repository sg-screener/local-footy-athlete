/**
 * THE "HOW MANY SESSIONS A WEEK" CONVERSATION — ONE OWNER, AND IT BELONGS TO
 * THE COACH.
 *
 * ## R-105, SAM'S WORDS, 2026-08-19
 *
 * *"This should not be popping up on the main page - it should show up in the
 * coaches chat with a notification"* — said while looking at the completion
 * shortfall offer (*"You have been completing about 0 of your 5 planned
 * sessions. Would a smaller weekly program fit your life better?"*) rendered
 * inline on the Program screen.
 *
 * The ruling records WHY it is not a preference: `docs/UNDO_SURFACE_RULING_
 * 2026-08-09.md` already has Sam's architecture in his own words — *"the coach
 * should be its own tab and the athlete just talks to it when it wants to change
 * something"* — so **a multiple-choice program negotiation on the Day page is a
 * second change-interface beside the recorded one**, which is exactly what that
 * ruling killed the standing bar and the confirm sheet for.
 *
 * ## WHAT MOVED, AND FROM WHERE (`EVERY REMOVAL NAMES WHERE THE BEHAVIOUR WENT`)
 *
 * `deriveCommitment` and `deriveExtraSession` were private functions inside
 * `screens/home/useBlockBoundaryPrompts.ts`, the PROGRAM surface's hook. They
 * are here, unchanged in what they decide, plus the preview. That hook keeps
 * exactly one prompt — the block-boundary notice, which is a NOTICE about a
 * decision already taken and not a negotiation — and no longer knows this
 * conversation exists.
 *
 * **The move is what makes the ruling structural.** Leaving the derivation on
 * the Program hook and merely not rendering it there would leave the Program
 * surface holding a live offer one JSX line away from returning.
 *
 * ## ⚠ IT IS STILL DERIVED. THE ANSWER IS STILL THE ONLY THING STORED
 *
 * R-099: *"THE QUESTION IS DERIVED; ONLY THE ANSWER IS STORED."* Moving the
 * question to a different surface does not change what kind of thing it is, and
 * **the notification is derived with it** — there is no "unread offer" record,
 * no badge counter and no expiry job. The Coach tab shows a notification exactly
 * when this function returns a conversation, which is exactly while the facts
 * support one and the ledger holds no answer. Close and reopen the app and the
 * same facts produce the same answer, which is stronger than persisting it.
 *
 * ## ⚠ ONE QUESTION, TWO DIRECTIONS, ONE LEDGER ENTRY
 *
 * The shrinking question fires only BELOW 75% attendance and the growing offer
 * only when the block QUALIFIES, which requires at or above it, so **no block
 * can raise both**. Both answers ride the single `weekly_commitment_answer`
 * entry — a second kind would give the app two records of one decision and two
 * places to look before re-asking, and *"declining must not repeatedly ask"* is
 * precisely a question about where you look.
 *
 * ## L14 — DOMAIN PURITY, AND WHY THE BUILDERS ARE INJECTED
 *
 * This module imports no store, no transaction and no generator. Both expensive
 * answers — *is this commitment legal* and *what would the week become* — are
 * INJECTED as functions. That is not ceremony: it is what lets a guard drive the
 * whole conversation without a React tree, and what stops this file from
 * becoming a second author of either answer.
 */

import type {
  DayOfWeek,
  OnboardingData,
  TrainingProgram,
} from '../types/domain';
import type { SessionFeedback } from '../store/programStore';
import type { AcceptedBlockRecord } from '../store/programStore';
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import { readBlockHistory } from './blockBoundaryProgression';
import {
  availableTrainingDays,
  decideExtraSessionOffer,
  type ExtraSessionOffer,
  type ExtraSessionOfferRefusal,
} from './extraSessionOffer';
import {
  commitmentPatchFor,
  decideWeeklyCommitmentQuestion,
  readBlockAttendance,
  type CommitmentLegalityProbe,
  type WeeklyCommitmentQuestion,
  type WeeklyCommitmentQuestionRefusal,
} from './weeklyCommitmentQuestion';
import { previousBlockBoundsISO, WEEKS_PER_BLOCK } from '../utils/programBlockState';
import {
  extraSessionOfferAcceptLabel,
  extraSessionOfferDeclineLabel,
  extraSessionOfferSentence,
  missedSessionCommitmentDeclineLabel,
  missedSessionCommitmentOptionLabel,
  missedSessionCommitmentQuestionSentence,
} from './projectionCopy';
import type { SignedCopy } from './signedCopy';
import {
  commitmentChangePreview,
  type CommitmentChangePreview,
  type CommitmentPreviewRefusal,
} from './commitmentChangePreview';

/** Which way the conversation goes. The two can never both be live. */
export type CommitmentDirection = 'smaller_week' | 'extra_session';

export interface CommitmentConversationOption {
  readonly sessionsPerWeek: number;
  readonly label: SignedCopy;
}

export interface CommitmentConversation {
  readonly direction: CommitmentDirection;
  /** Which block's training raised it. What an answer is recorded against. */
  readonly forBlockNumber: number;
  /** Sam's signed opening sentence, already rendered. */
  readonly sentence: SignedCopy;
  /** What the athlete may say yes to. Every count proven buildable. */
  readonly options: readonly CommitmentConversationOption[];
  readonly declineLabel: SignedCopy;
  /**
   * THE MEASURED SITUATION, so the coach explains rather than asserts.
   * Present for the shrinking direction, which is the one about attendance.
   */
  readonly attendance: WeeklyCommitmentQuestion['attendance'] | null;
  /** The growing direction's typed offer, when that is the direction. */
  readonly offer: ExtraSessionOffer | null;
  /**
   * WHAT ACCEPTING ACTUALLY DOES, read off the program acceptance publishes.
   * `null` with a refusal beside it when no preview could be taken; never a
   * guess, and never silently absent.
   */
  readonly preview: CommitmentChangePreview | null;
  readonly previewRefusal: CommitmentPreviewRefusal | null;
}

/** Every reason there is no conversation. Returned so a guard can name the gate. */
export type CommitmentConversationRefusal =
  | 'no_profile'
  | 'no_program'
  | 'no_block'
  | 'first_block'
  | 'no_commitment'
  /**
   * ⚠ **THE REBUILD ADDS NOTHING, SO THERE IS NOTHING TO OFFER.**
   *
   * MEASURED 2026-08-20 on a real walked athlete — in-season, Saturday game,
   * club Tuesday and Thursday, gym Monday/Wednesday/Friday. Every gate above
   * opened: the block qualified, the athlete had free days, and the legality
   * probe said a four-day commitment builds. **It builds the IDENTICAL WEEK.**
   * Monday and Wednesday strength, Friday held as G-1, Saturday the game,
   * Sunday rest — with `preferredTrainingDays` reading Mon/Wed/Fri/**Sun** and
   * `trainingDaysPerWeek` reading 4. Proven at three layers in one run: the
   * patch, the next profile, and a DIRECT `generateProgramLocally` call on it.
   *
   * So `commitmentLegalityProbe` does not answer this question. It asks *"does a
   * program exist at this count"* — which is the right question for *"could you
   * train this often"* and the wrong one for *"will this session appear"*. An
   * offer gated on it alone is a promise the scheduler does not keep, and the
   * athlete finds out by accepting: the false-Done class L6 calls a release
   * blocker.
   *
   * **THE REBUILD IS THE GATE.** There is no offer unless the program acceptance
   * would publish actually differs from the one the athlete is on. That is one
   * authority instead of two, and it makes *"acceptance matches the preview"*
   * true by construction rather than by a cell.
   */
  | 'extra_session_rebuild_adds_nothing'
  | { smaller: WeeklyCommitmentQuestionRefusal; extra: ExtraSessionOfferRefusal };

/**
 * ⚠ **ONE SHAPE, NOT A DISCRIMINATED UNION — see `commitmentChangePreview` for
 * the measured reason.** This repo compiles without `strictNullChecks`, so
 * TypeScript refuses to narrow the FALSE arm of a boolean-discriminated union
 * and every caller would have to write `'refusal' in outcome` to read a refusal.
 *
 * Exactly one of the two is non-null, always.
 */
export interface CommitmentConversationOutcome {
  readonly value: CommitmentConversation | null;
  readonly refusal: CommitmentConversationRefusal | null;
}

export interface CommitmentConversationInput {
  readonly currentProgram: TrainingProgram | null | undefined;
  readonly blockNumber: number | null | undefined;
  /** Monday the CURRENT block started on — the attendance window's right edge. */
  readonly blockStartISO: string | null | undefined;
  readonly todayISO: string;
  readonly sessionFeedback: Readonly<Record<string, SessionFeedback>>;
  readonly onboardingData: OnboardingData | null | undefined;
  readonly ledgerEntries: readonly DecisionLedgerEntry[];
  readonly weekOrder: readonly DayOfWeek[];
  /**
   * ⚠ **WHAT EACH ACCEPTED BLOCK REQUIRED, AND IT IS NOT OPTIONAL HERE.**
   *
   * On `main @ 9f081efa` this was an optional input that NO production caller
   * supplied: `useHomeScreen` never passed it, so the completion denominator
   * was `?? 0`, `readBlockHistory`'s `requiredStrengthSessions > 0` failed, and
   * **the extra-session offer could not reach a single athlete.** A reader with
   * no writer. It is REQUIRED on this interface so the same omission is a type
   * error rather than a silent nothing.
   */
  readonly acceptedBlocks: Readonly<Record<string, AcceptedBlockRecord>>;
  /** Asks GENERATION whether a commitment is legal. Never a table. */
  readonly isCommitmentLegal: CommitmentLegalityProbe;
  /**
   * THE PROGRAM ACCEPTING WOULD PUBLISH, for one candidate count.
   *
   * Injected, and it must be `profileProgramCandidateBase` reached through the
   * same patch the door applies — see `commitmentChangePreview`'s header for the
   * 11-of-20 measurement that says why a preview may not be predicted.
   *
   * Called at most ONCE, and only after an offer is already live, so an athlete
   * who was never going to be asked pays nothing for it.
   */
  readonly candidateProgramFor: (sessionsPerWeek: number) => TrainingProgram | null;
}

export function deriveWeeklyCommitmentConversation(
  input: CommitmentConversationInput,
): CommitmentConversationOutcome {
  const {
    currentProgram, blockNumber, blockStartISO, todayISO, sessionFeedback,
    onboardingData, ledgerEntries, weekOrder, acceptedBlocks,
    isCommitmentLegal, candidateProgramFor,
  } = input;

  if (!onboardingData) return { value: null, refusal: 'no_profile' };
  if (!currentProgram) return { value: null, refusal: 'no_program' };
  if (typeof blockNumber !== 'number' || !blockStartISO) {
    return { value: null, refusal: 'no_block' };
  }
  // BLOCK 1 HAS NO PREVIOUS BLOCK — no attendance to count and none to find easy.
  if (blockNumber < 2) return { value: null, refusal: 'first_block' };

  const currentSessionsPerWeek = onboardingData.trainingDaysPerWeek ?? 0;
  if (!(currentSessionsPerWeek > 0)) return { value: null, refusal: 'no_commitment' };

  // ⚠ ONE WINDOW, read by BOTH directions and by the boundary decision itself.
  // An athlete progressed off one window and asked off another is being told two
  // stories about the same four weeks.
  const previous = previousBlockBoundsISO(blockStartISO);
  const forBlockNumber = blockNumber - 1;

  // ── THE SHRINKING DIRECTION ──
  const attendance = readBlockAttendance({
    feedbackByDate: sessionFeedback,
    blockStartISO: previous.startISO,
    blockEndISO: previous.endISO,
    sessionsPerWeek: currentSessionsPerWeek,
    weeks: WEEKS_PER_BLOCK,
  });
  const smaller = decideWeeklyCommitmentQuestion({
    attendance,
    forBlockNumber,
    ledgerEntries,
    isCommitmentLegal,
  });
  if (smaller.ask) {
    return {
      refusal: null,
      value: {
        direction: 'smaller_week',
        forBlockNumber,
        sentence: missedSessionCommitmentQuestionSentence(smaller.question),
        options: smaller.question.options.map((sessionsPerWeek) => ({
          sessionsPerWeek,
          label: missedSessionCommitmentOptionLabel(sessionsPerWeek),
        })),
        declineLabel: missedSessionCommitmentDeclineLabel(),
        attendance: smaller.question.attendance,
        offer: null,
        // ⚠ NO PREVIEW ON THIS DIRECTION, AND IT IS A COST DECISION STATED
        // RATHER THAN AN OVERSIGHT. Up to five options means up to five real
        // generations on a redraw. Mission B's requirement is the OPTIONAL
        // SESSION's preview, which is a single count. Named in NOT COVERED.
        preview: null,
        previewRefusal: null,
      },
    };
  }

  // ── THE GROWING DIRECTION ──
  const history = readBlockHistory({
    feedbackByDate: sessionFeedback,
    blockStartISO: previous.startISO,
    blockEndISO: previous.endISO,
    // NO FALLBACK, by ruling. An absent record means there is no accepted
    // previous block to measure against and the gate is correctly unreachable.
    requiredStrengthDates: acceptedBlocks[previous.startISO]?.requiredStrengthDates,
    requiredStrengthSessions:
      acceptedBlocks[previous.startISO]?.requiredStrengthSessions ?? 0,
  });
  const extra = decideExtraSessionOffer({
    history,
    forBlockNumber,
    profile: onboardingData,
    weekOrder,
    ledgerEntries,
    isCommitmentLegal,
    currentSessionsPerWeek,
    patchFor: (sessionsPerWeek) => commitmentPatchFor({
      profile: onboardingData,
      sessionsPerWeek,
      weekOrder,
      availableDays: availableTrainingDays({ profile: onboardingData, weekOrder }),
    }),
  });
  if (!extra.offer) {
    // `'refusal' in x` rather than reading it off the narrowed false arm: this
    // repo compiles without `strictNullChecks`, which does not narrow that arm.
    return {
      value: null,
      refusal: {
        smaller: 'refusal' in smaller ? smaller.refusal : 'attendance_met',
        extra: 'refusal' in extra ? extra.refusal : 'block_did_not_qualify',
      },
    };
  }

  // ⚠ THE ONLY BUILD, AND IT HAPPENS AFTER EVERY CHEAP GATE HAS OPENED.
  const candidate = candidateProgramFor(extra.question.offeredSessionsPerWeek);
  const preview = commitmentChangePreview({
    current: currentProgram,
    candidate,
    todayISO,
    weekOrder,
  });

  // ── THE REBUILD IS THE LAST GATE, AND IT IS THE ONE THAT MATTERS ──
  //
  // See `extra_session_rebuild_adds_nothing` above for the measurement. A
  // preview that finds nothing changed is not a missing preview — it is the
  // app saying it cannot honour the offer, and an offer the app cannot honour
  // must not be put. **This is also what makes "the preview equals what
  // acceptance produces" structural: there is no offer without a preview, and
  // the preview is built by the function acceptance builds with.**
  if (preview.value === null) {
    return { value: null, refusal: 'extra_session_rebuild_adds_nothing' };
  }

  return {
    refusal: null,
    value: {
      direction: 'extra_session',
      forBlockNumber,
      sentence: extraSessionOfferSentence(extra.question),
      options: [{
        sessionsPerWeek: extra.question.offeredSessionsPerWeek,
        label: extraSessionOfferAcceptLabel(),
      }],
      declineLabel: extraSessionOfferDeclineLabel(),
      attendance: null,
      offer: extra.question,
      // NEVER NULL ON A LIVE OFFER — the gate above returned already if it were.
      // The field stays so the type cannot silently start carrying a null
      // preview, and a cell asserts the pair.
      preview: preview.value,
      previewRefusal: preview.refusal,
    },
  };
}
