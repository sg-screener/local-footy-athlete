import { reductionExplanationCoversWeek } from './blockBoundaryProgression';
/**
 * PROJECTION COPY — the words `project()` is allowed to say.
 *
 * `project()` (`projectVisibleWeek.ts`) raises `UnsignedCopyError` for any day or
 * part whose headline has no entry here — that is the whole point of the branded
 * `SignedCopy` type (`signedCopy.ts`). This module is where the entries come
 * from, registered once at import time so `project()` never has to invent a word.
 *
 * REUSE FIRST. Sam's ruling 2 (`signedCopy.ts` header) is "trace to an authored
 * source, or Sam rules the gap" — and the global constraint on this unit is to
 * keep the new-wording batch small. So most of what is registered here is not
 * new: it traces to vocabulary that is ALREADY shipping —
 *
 *   - the seven strength session names (`data/strengthSessionVariants.ts`,
 *     pinned verbatim by `strengthSessionVariantTests` B3) — `canonicalStrengthLabel`
 *     has been putting these on session cards for months;
 *   - `TEAM_ONLY_NAME` (`sessionNaming.ts`) — the team-day naming constant every
 *     combined-day name already leads with;
 *   - every name in the locked exercise vocabulary
 *     (`selectableExerciseVocabulary.ts`) — the exercise-name-literal-lock unit
 *     already proved these are the only names a builder may emit;
 *   - the authored cue for each of those names, where one exists
 *     (`dayWorkoutHelpers.buildCueText`) — the cue-reconciliation unit's sheet.
 *
 * A SMALL, HONEST NEW BATCH remains — day-kind headlines, the day refusal
 * sentence, generic part-kind fallbacks for kinds with no existing specific
 * name (conditioning/recovery/power/speed/support/game), and prescription
 * templates for the two dominant row shapes (sets×reps, duration). Every one of
 * these is listed in
 * `docs/COPY_SHEET_RULINGS_2026-07-30.md` under "Batch 6 — buttons/UI unit"
 * / "Proposed by Task 2 (projection headlines)", PROPOSED and awaiting Sam —
 * the transitional rule the file's own header states: a string may ship
 * PROPOSED, and it may never ship unlisted.
 *
 * SCOPE NOTE ON CONDITIONING/MOBILITY/GUNSHOW/PREHAB. The brief that shaped this
 * unit named `CATEGORY_COPY` (`utils/planChangeProducer.ts:192-241`) as a reuse
 * source for these. It was not used: `CATEGORY_COPY` labels the ADD-menu's
 * categories, not an identity a placed session's own component carries, and
 * nothing typed on a `Workout` reliably says "this conditioning session is the
 * light-flush kind" versus "the hard-interval kind" without inventing a new
 * classifier — which is exactly the fourth-naming-authority failure this unit
 * exists to prevent.
 *
 * CORRECTED 2026-08-01 (the confident-comment lesson, again): this header used
 * to claim gunshow/prehab/mobility "resolve correctly through the strength
 * path" via `resolveSessionDisplayName`'s name pass-through. Measured false —
 * `partHeadline` deliberately omits `name`/`focus` and hardcodes
 * `tier: 'core'`, so the pass-through guards can never fire from `project()`
 * and all three rendered the generic kind fallback, which is exactly what Sam
 * saw on the combined device pass (fail 2). The honest resolution is TYPED:
 * the builder stamps `composedOptionalKind` and the
 * `part.headline.optional.<kind>` entries below carry the charter words.
 * Conditioning keeps the honest, generic treatment until Stage B wires the 55
 * signed doses.
 */

import {
  registerSignedCopy,
  signedCopy,
  joinSignedCopy,
  type SignedCopy,
  type SignedCopyEntry,
} from './signedCopy';
import { STRENGTH_SESSION_VARIANTS } from '../data/strengthSessionVariants';
import {
  INJURY_ADJUSTED_SESSION_NAME,
  TEAM_ONLY_NAME,
} from '../utils/sessionNaming';
import { selectableExerciseNames } from '../data/selectableExerciseVocabulary';
import { buildCueText } from '../screens/home/dayWorkoutHelpers';
import {
  CONDITIONING_WARMUP_COPY,
  CONDITIONING_WARMUP_COPY_ID,
  CONDITIONING_WARMUP_ROW_NAME,
  conditioningVisibleDoseFor,
} from './conditioningSelection';
import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';
import { conditioningDisplayTitleForName } from './conditioningDisplay';
import { FEMALE_SLOTS_FOR_KIND, SLOTS_FOR_KIND } from './sessionSlotCoverage';
import type { GeneratedWeekClauseId } from './generatedWeekContract';
import { EQUIPMENT_TAG_LABELS } from './equipmentVocabulary';
import { COACH_REVISION_TEMPLATE_ROW_NAMES } from '../utils/coachRevisionTemplates';

/**
 * Athlete-facing strength session name -> the `part.headline.strength.<id>`
 * entry that carries it. Built from the authored set, never transcribed, so a
 * variant added to `strengthSessionVariants.ts` gets an entry here for free.
 */
export const STRENGTH_HEADLINE_ID_BY_LABEL: ReadonlyMap<string, string> = new Map<string, string>([
  ...STRENGTH_SESSION_VARIANTS.map((variant): [string, string] => [
    variant.label,
    `part.headline.strength.${variant.id}`,
  ]),
  [INJURY_ADJUSTED_SESSION_NAME, 'part.headline.strength.injury_adjusted'],
]);

export const BLOCK_BOUNDARY_LOAD_MOVED_COPY_ID = 'blockBoundary.loadMoved';
export const BLOCK_BOUNDARY_HARD_BLOCK_REDUCED_COPY_ID = 'blockBoundary.hardBlockReduced';
export const MISSED_SESSION_COMMITMENT_QUESTION_COPY_ID = 'blockBoundary.commitmentQuestion';
export const MISSED_SESSION_COMMITMENT_OPTION_COPY_ID = 'blockBoundary.commitmentOption';
export const MISSED_SESSION_COMMITMENT_OPTION_ONE_COPY_ID = 'blockBoundary.commitmentOptionOne';
export const MISSED_SESSION_COMMITMENT_DECLINE_COPY_ID = 'blockBoundary.commitmentDecline';
/** R-105 — the coach's notification that the conversation is waiting. */
export const COMMITMENT_CONVERSATION_NOTICE_COPY_ID = 'coach.commitment.notice';
/** R-105/R-106 — how the previewed change arrives on the day. */
export const COMMITMENT_PREVIEW_NEW_DAY_COPY_ID = 'coach.commitment.previewNewDay';
export const COMMITMENT_PREVIEW_COMBINED_DAY_COPY_ID = 'coach.commitment.previewCombinedDay';
export const COMMITMENT_PREVIEW_UNAVAILABLE_COPY_ID = 'coach.commitment.previewUnavailable';
/** R-105 — what the coach says once the athlete has answered. */
export const COMMITMENT_CONFIRMED_COPY_ID = 'coach.commitment.confirmed';
export const COMMITMENT_DECLINED_COPY_ID = 'coach.commitment.declined';
export const COMMITMENT_FAILED_COPY_ID = 'coach.commitment.failed';
/** The calendar, signed so it can be a parameter of a signed sentence. */
export const SHORT_DATE_COPY_ID = 'day.date.short';
export function dayNameCopyId(day: import('../types/domain').DayOfWeek): string {
  return `day.name.${day}`;
}
/** A session component's athlete-facing name. `part.headline.<kind>`, reused. */
export function sessionComponentCopyId(kind: string): string {
  // Mobility already has an authored headline. Its component kind is not the
  // optional-session namespace used by that entry; reuse it, not new copy.
  if (kind === 'mobility') return 'part.headline.optional.mobility';
  return `part.headline.${kind}`;
}
export const EXTRA_SESSION_OFFER_COPY_ID = 'blockBoundary.extraSessionOffer';
export const EXTRA_SESSION_OFFER_ACCEPT_COPY_ID = 'blockBoundary.extraSessionAccept';
export const EXTRA_SESSION_OFFER_DECLINE_COPY_ID = 'blockBoundary.extraSessionDecline';

const EXERCISE_NAME_PREFIX = 'exercise.name.';
const EXERCISE_CUE_PREFIX = 'exercise.cue.';

/** Canonical exercise names that also carry a registered cue entry. */
const NAMES_WITH_CUE = new Set<string>();

export function exerciseNameCopyId(canonicalName: string): string {
  return `${EXERCISE_NAME_PREFIX}${canonicalName}`;
}

/** `null` when the name has no authored cue — matches `buildCueText`'s own `null`. */
export function exerciseCueCopyId(canonicalName: string): string | null {
  return NAMES_WITH_CUE.has(canonicalName) ? `${EXERCISE_CUE_PREFIX}${canonicalName}` : null;
}

/**
 * THE AUTHORED DOSE VALUES, AS SIGNED COPY.
 *
 * `SignedCopyParam` is `number | SignedCopy` and says why in one line: *"never a
 * bare string"*. A dose value — `4 min hard`, `3 × 8 min, or 4 × 6 min`,
 * `≈8–11 min (work ≈20 s)` — is athlete-facing text, so it goes through the
 * sheet like every other word rather than being smuggled in as a parameter.
 *
 * Registered in BULK off `data/conditioningTemplates.ts` for the same reason the
 * exercise vocabulary is: the authored sheet is the source, and a hand-picked
 * subset of it would be a second, smaller vocabulary that drifts. Four fields ×
 * every shippable template.
 */
const DOSE_VALUE_PREFIX = 'row.dose.value.';

export type ConditioningDoseField = 'work' | 'rest' | 'sets_rounds' | 'total_time';

/** One ordered owner for the four athlete-visible dose labels. */
export const CONDITIONING_DOSE_COPY_LINES: readonly (
  readonly [ConditioningDoseField, string]
)[] = [
  ['work', 'row.dose.work'],
  ['rest', 'row.dose.rest'],
  ['sets_rounds', 'row.dose.sets_rounds'],
  ['total_time', 'row.dose.total_time'],
];

/** `null` when the name is not the authored template vocabulary's. */
export function conditioningDoseValueCopyId(
  templateName: string,
  field: ConditioningDoseField,
  modality?: import('../types/domain').ConditioningOption['modality'],
): string | null {
  const suffix = modality ? modality === 'running' ? '.running' : modality === 'row' || modality === 'ski' ? '.' + modality : '.machine' : '';
  return DOSE_VALUES_REGISTERED.has(`${templateName} ${field}${suffix}`)
    ? `${DOSE_VALUE_PREFIX}${field}.${templateName}${suffix}`
    : null;
}

/**
 * THE MIDDLE LINE OF A REFUSAL, ONE PER TYPED CLAUSE.
 *
 * A `Record` over the CLOSED `GeneratedWeekClauseId` union on purpose: a clause
 * added to `generatedWeekContract.ts` breaks this file until its sentence is
 * written, which is the only way "do not collapse different causes into one
 * generic message" survives contact with a future clause.
 */
const REFUSAL_CLAUSE_COPY: Readonly<Record<GeneratedWeekClauseId, string>> = {
  main_strength_required_minimum: 'There aren\'t enough gym days in your week to fit the lifting this phase needs.',
  main_strength_planner_selected_target: 'Your week can\'t fit the number of lifting sessions this phase of your season is built around.',
  main_strength_permitted_maximum: 'You\'ve asked for more lifting days than is safe to program in one week.',
  required_safe_patterns_present: 'Your kit can\'t cover one of the basic lifting movements a week has to include.',
  pattern_balance: 'Your week comes out lopsided — one kind of lift would get far more work than its opposite.',
  prohibited_patterns_absent: 'A lift your week needs is one your injury or your settings currently rule out.',
  core_conditioning_required_minimum: 'There aren\'t enough days left for the running this phase needs, once your club nights and game are in.',
  sprint_high_speed_required_minimum: 'There\'s no night left in your week that can carry the sprint work this phase needs.',
  full_rest_required_minimum: 'Your week has no room for the full rest days you\'re owed.',
  hard_day_permitted_maximum: 'Your week works out with more hard days than is safe, once your club nights and game are counted.',
  training_paused_means_no_training: 'Your training is paused, so there\'s nothing to build until you start it again.',
  prohibited_power_absent: 'The explosive work your week needs is currently ruled out by your injury or your settings.',
  prohibited_sprint_absent: 'Your week needs sprint work, and sprinting is currently ruled out for you.',
  row_role_is_declared: 'Something in your setup produced a session the app can\'t read properly, so it won\'t guess at it.',
};

const DOSE_VALUES_REGISTERED = new Set<string>();

/**
 * THE SLOT AND THE KIT, IN THE ATHLETE'S WORDS — the value halves of a gap
 * sentence.
 *
 * `ComposedGapNotice` on the day screen already says these words today
 * (`slotWordFor`: the slot id with its underscores turned into spaces; the
 * equipment tag verbatim), so this is a TRACE of shipping copy, not a new
 * batch. They are registered one per value because `SignedCopyParam` forbids a
 * bare string, and enumerated from the AUTHORED vocabularies rather than from
 * whatever a gap happens to carry — a slot added to `SessionSlot` gets an entry
 * by being added to the union.
 */
const GAP_SLOT_PREFIX = 'day.gap.slot.';
const GAP_NEED_PREFIX = 'day.gap.need.';

const GAP_SLOTS_REGISTERED = new Set<string>();
const GAP_NEEDS_REGISTERED = new Set<string>();

/** `null` when the value is not one of the authored ones — see `gapCopy`. */
export function gapSlotCopyId(slot: string): string | null {
  return GAP_SLOTS_REGISTERED.has(slot) ? `${GAP_SLOT_PREFIX}${slot}` : null;
}

export function gapNeedCopyId(need: string): string | null {
  return GAP_NEEDS_REGISTERED.has(need) ? `${GAP_NEED_PREFIX}${need}` : null;
}

let didRegister = false;

/**
 * Register every projection copy entry. Safe to call more than once — the
 * underlying registry is idempotent for identical content
 * (`registerSignedCopy` only throws when an id is re-registered with
 * DIFFERENT text) — but the bulk exercise-vocabulary pass is real work, so a
 * module-level guard keeps repeat calls (e.g. from a test file that also
 * imports `projectVisibleWeek.ts`) cheap.
 */
export function registerProjectionCopy(): void {
  if (didRegister) return;
  didRegister = true;

  registerSignedCopy([
    // ── THE BLOCK-BOUNDARY LOAD SENTENCE — SIGNED, Sam 2026-08-16. ──
    //
    // His words, verbatim and unedited:
    //   "You completed enough of the last block and reported good recovery, so
    //    [exercise] has moved from [old weight] to [new weight]. You can change
    //    it if needed."
    //
    // ⚠ THE ONLY THING ADDED TO HIS SENTENCE IS THE UNIT `kg`. His brackets say
    // "[old weight]", and a weight rendered without its unit ("moved from 100 to
    // 102.5") is not the sentence he approved. `kg` is the app's unit
    // everywhere and is authored here rather than concatenated at a call site,
    // because a call site choosing it would be a call site authoring words —
    // the exact hole `SignedCopy` exists to close. **If he wants the unit
    // elsewhere or absent, it changes HERE and nowhere else.**
    //
    // ⚠ IT CLAIMS COMPLETION AND RECOVERY, AND NOTHING ABOUT REPS OR SETS.
    // "completed enough of the last block" is the 75% completion gate and
    // "reported good recovery" is the answered soreness/feeling — both are
    // recorded facts. The approved contract forbids claiming to know which reps
    // were done, and this sentence does not.
    {
      id: BLOCK_BOUNDARY_LOAD_MOVED_COPY_ID,
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-16, block two product close. Rendered only '
        + 'from a stored `history_progressed` row of '
        + 'TrainingProgram.blockBoundaryExplanation, so the sentence and the '
        + 'prescription it describes cannot drift. Guard: test:block-two-progression.',
      text: 'You completed enough of the last block and reported good recovery, so '
        + '{exercise} has moved from {oldWeight} kg to {newWeight} kg. '
        + 'You can change it if needed.',
    },
    // ── THE VERY-HARD BLOCK SENTENCE — SIGNED, Sam 2026-08-16. ──
    //
    // His approved wording for the completed-but-very-hard path, verbatim and
    // unedited, with no unit and no placeholder to argue about:
    //   "You completed the last block, but it felt very hard and recovery was
    //    low, so we've kept your training weights and reduced the amount of
    //    work in this block. You can change it if needed."
    //
    // ⚠ IT MAKES TWO FACTUAL CLAIMS AND BOTH ARE CHECKED BEFORE IT RENDERS.
    // "kept your training weights" is `BlockBoundaryReductionExplanationRow
    // .loadsHeld`, read off the load decisions the SAME boundary stored;
    // "reduced the amount of work" is a non-empty `setsReduced` /
    // `hardConditioningReplaced`. `blockBoundaryReducedSentence` returns null
    // when either is untrue, so the app cannot tell an athlete it held their
    // weights on a block where it raised one.
    //
    // ⚠ IT CLAIMS NOTHING ABOUT REPS OR SETS COMPLETED. "You completed the last
    // block" is the logged session count; "it felt very hard and recovery was
    // low" is the recorded effort and soreness answers. The approved contract's
    // standing ban is on claiming which reps were done, and this sentence does
    // not go near it.
    {
      id: BLOCK_BOUNDARY_HARD_BLOCK_REDUCED_COPY_ID,
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-16; duration corrected by Sam 2026-09-07 to one week. The approved meaning for the '
        + 'completed-but-very-hard block. Rendered only from a stored '
        + '`hard_block_reduced` row of TrainingProgram.blockBoundaryExplanation, '
        + 'and only when that row says the loads were in fact held and work was '
        + 'in fact reduced. Guard: test:block-two-difficult-missed.',
      text: 'You completed the last block, but it felt very hard and recovery was low, '
        + "so we've kept your training weights and reduced the amount of work in this "
        + 'week. You can change it if needed.',
    },
    // ── THE MISSED-SESSION QUESTION — SIGNED, Sam 2026-08-16. ──
    //
    // His approved wording for the attendance path, verbatim:
    //   "You have been completing about [completed] of your [planned] planned
    //    sessions. Would a smaller weekly program fit your life better?"
    //
    // ⚠ BOTH BRACKETS ARE WEEKLY NUMBERS, NOT BLOCK TOTALS. The contract's own
    // example is "about two of your four planned sessions" — four is a weekly
    // commitment, not a block's worth. `completedPerWeek` is the block's
    // completions divided by its weeks and rounded, which is what "about"
    // licenses; `plannedPerWeek` is the commitment the block was built on.
    //
    // ⚠ IT ASKS; IT DOES NOT JUDGE. The contract: *"Do not shame them."* The
    // sentence states two counts and offers a change — there is no "only", no
    // "just", and no second sentence about consistency.
    {
      id: MISSED_SESSION_COMMITMENT_QUESTION_COPY_ID,
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-16, the approved wording for the '
        + 'below-threshold attendance question. Rendered only from a DERIVED '
        + '`WeeklyCommitmentQuestion` whose numbers are the logged sessions and '
        + 'the commitment the block was built on. Guard: '
        + 'test:block-two-difficult-missed.',
      text: 'You have been completing about {completed} of your {planned} planned '
        + 'sessions. Would a smaller weekly program fit your life better?',
    },
    // The offered answers. A COUNT is a derived number, not a new word — the
    // shape is authored here so no surface concatenates "sessions" itself.
    {
      id: MISSED_SESSION_COMMITMENT_OPTION_COPY_ID,
      source: 'derived_number',
      provenance: 'NEW — PROPOSED, 2026-08-16, beside the signed question. The '
        + 'noun is the question\'s own ("planned sessions"); only the number is '
        + 'data. A surface that built this string itself would be a surface '
        + 'authoring words.',
      text: '{count} sessions a week',
    },
    {
      id: MISSED_SESSION_COMMITMENT_OPTION_ONE_COPY_ID,
      source: 'derived_number',
      provenance: 'NEW — PROPOSED, 2026-08-16. The singular half. An option '
        + 'reading "1 sessions a week" is an option that lies, and one session '
        + 'a week is a legal answer for an athlete who has been completing none.',
      text: '{count} session a week',
    },
    // ⚠ ALREADY SHIPPING, AND IT WAS UNSIGNED. `BlockBoundaryCards.tsx` wrote
    // the literal string "Keep it as is" into the card's decline chip, so the
    // one control that must never be mistaken for the accept path was the one
    // athlete-facing string on that card with no provenance. It is REGISTERED
    // here as what already ships, not invented; the words are unchanged.
    {
      id: MISSED_SESSION_COMMITMENT_DECLINE_COPY_ID,
      source: 'derived_number',
      provenance: 'CAPTURED — the string this card has been shipping since '
        + '2026-08-16, lifted out of `BlockBoundaryCards.tsx` where it was an '
        + 'inline literal. NOT a new sentence and NOT a re-wording. Flagged for '
        + "Sam's sign-off in the finish-coach-product question table.",
      text: 'Keep it as is',
    },
    // ── THE CALENDAR, SIGNED ──
    //
    // ⚠ **REGISTERED BECAUSE `SignedCopyParam` IS `number | SignedCopy` AND THAT
    // REFUSAL IS THE POINT.** A raw string parameter would let any surface post
    // unsigned words into the middle of a signed sentence, which is the whole
    // thing the sheet exists to stop. A weekday name and a d/m date are calendar
    // facts rather than authored copy, so these entries CAPTURE the format the
    // app already uses — they do not choose one.
    //
    // ⚠ **`day.date.short` MUST AGREE WITH `shortDayMonthLabel`**, which calls
    // itself the single owner of the d/m display rule. Two formatters is the
    // rival-authority defect, so `test:coach-weekly-reduction` pins them equal
    // over a walk of dates rather than trusting the two strings to stay the
    // same. If they ever diverge, that cell reds.
    {
      id: SHORT_DATE_COPY_ID,
      source: 'derived_number',
      provenance: 'CAPTURED 2026-08-20 (seat finish-coach-product). The format is '
        + "`shortDayMonthLabel`'s, not a new choice; both are day/month, no "
        + 'padding, AU order. Pinned equal to it by a cell.',
      text: '{day}/{month}',
    },
    ...(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      .map((day) => ({
        id: `day.name.${day}`,
        source: 'derived_number' as const,
        provenance: 'CAPTURED 2026-08-20 (seat finish-coach-product). A weekday name '
          + 'is a calendar fact. Registered only so it can be a parameter of a '
          + 'signed sentence, which `SignedCopyParam` requires; the words are '
          + "English's, not this file's.",
        text: day,
      }))),
    // ── THE THREE SESSION COMPONENT KINDS WITH NO NAME YET ──
    //
    // `part.headline.<kind>` already names strength, conditioning, recovery,
    // power, speed, support and team_training. These three complete the set so
    // `sessionComponentName` cannot meet a kind it has no signed word for — and
    // it THROWS rather than falling back, so an eleventh kind is a loud gap for
    // Sam rather than a silent blank in a sentence.
    {
      id: 'part.headline.finisher',
      source: 'derived_number',
      provenance: 'CAPTURED 2026-08-20 (seat finish-coach-product) from '
        + "`utils/sessionComponents.ts`, where this component's athlete-facing "
        + 'label already ships unsigned. Word unchanged, capitalised to match its '
        + 'six siblings above.',
      text: 'Finisher',
    },
    {
      id: 'part.headline.recovery_addon',
      source: 'derived_number',
      provenance: 'CAPTURED 2026-08-20 (seat finish-coach-product) from '
        + '`utils/sessionComponents.ts`. Uses the same word `part.headline.recovery` '
        + 'was REWORDED to in Batch 7 — the add-on\'s rows ARE mobility flows, and '
        + 'two names for one kind of work is what that rewording fixed.',
      text: 'Mobility',
    },
    {
      id: 'part.headline.session',
      source: 'derived_number',
      provenance: 'CAPTURED 2026-08-20 (seat finish-coach-product) from '
        + "`utils/sessionComponents.ts`'s last-resort component. Capitalised to "
        + 'match its siblings.',
      text: 'Session',
    },
    // ── R-105 — THE COACH'S NOTIFICATION ──
    //
    // Sam ruled the conversation moves to the coach chat AND that its arrival is
    // announced by a notification. He did not give words for the notification,
    // and the ruling says in as many words that what the notification IS must
    // not be invented. So this is the smallest honest thing: it names the coach
    // and states that there is something to decide. PROPOSED, in the question
    // table, and it does not claim anything about the program.
    {
      id: COMMITMENT_CONVERSATION_NOTICE_COPY_ID,
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-20, approving all seven of the coach sentences '
        + 'this unit proposed, AS WRITTEN. The words are unchanged from the '
        + 'draft he read. R-105 rules THAT there is a '
        + 'notification and deliberately does not rule what it says; this is the '
        + 'wording he then approved. Claim-free by construction: it announces a '
        + 'question and never an outcome.',
      text: 'Your coach has something to ask about your week.',
    },
    // ── R-105 + R-106 — THE PREVIEW LINES ──
    //
    // ⚠ THESE DESCRIBE; THEY DO NOT ADVISE. Every value is read off the program
    // acceptance publishes. R-106 is why the second one exists at all: a day
    // that gains a component is ONE training day with TWO components, and a
    // sentence calling it a new training day would be counting it twice.
    {
      id: COMMITMENT_PREVIEW_NEW_DAY_COPY_ID,
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-20, approving all seven of the coach sentences '
        + 'this unit proposed, AS WRITTEN. The words are unchanged from the '
        + 'draft he read. Only the day name, the date and '
        + 'the component list are data; all three are copied from the regenerated '
        + 'program, never predicted. R-106: this is the arm for a day the athlete '
        + 'does not currently train on.',
      text: '{day} {date} becomes a new training day: {components}.',
    },
    {
      id: COMMITMENT_PREVIEW_COMBINED_DAY_COPY_ID,
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-20, approving all seven of the coach sentences '
        + 'this unit proposed, AS WRITTEN. The words are unchanged from the '
        + 'draft he read. R-106, verbatim: '
        + '"do not call it two training days". This arm fires when the athlete '
        + 'already trains that day and the work joins it.',
      text: '{day} {date} keeps one training day and adds {added} to it: {components}.',
    },
    {
      id: COMMITMENT_PREVIEW_UNAVAILABLE_COPY_ID,
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-20, approving all seven of the coach sentences '
        + 'this unit proposed, AS WRITTEN. The words are unchanged from the '
        + 'draft he read. The honest floor. A preview that '
        + 'could not be taken says so; it never falls back to describing the '
        + 'CURRENT week, which is the exact defect that got `codex/finish-product` '
        + 'rejected (11 of 20 previews wrong).',
      text: 'I could not build the changed week to show you, so I will not guess at it.',
    },
    // ── R-105 — AFTER THE ANSWER ──
    //
    // ⚠ **THE CONFIRMATION IS GATED ON THE TRANSACTION, NOT ON THE TAP.**
    // `commitProfileProgramTransaction` returns `ok` AND `changedProgram`, and
    // this sentence may only be spoken when both are true. A coach that says
    // "your program is rebuilt" because a button was pressed is the false-Done
    // class (L6), and it is the exact incident `verifiedCoachCommunication` was
    // built for.
    {
      id: COMMITMENT_CONFIRMED_COPY_ID,
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-20, approving all seven of the coach sentences '
        + 'this unit proposed, AS WRITTEN. The words are unchanged from the '
        + 'draft he read. Only the count is data, and it is '
        + 'the count the door REPORTS it committed, never the count that was '
        + 'tapped. Spoken only when the transaction returned ok AND '
        + 'changedProgram.',
      text: 'Done. Your program is rebuilt around {count} sessions a week.',
    },
    {
      id: COMMITMENT_DECLINED_COPY_ID,
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-20, approving all seven of the coach sentences '
        + 'this unit proposed, AS WRITTEN. The words are unchanged from the '
        + 'draft he read. It claims nothing happened, and '
        + 'nothing did: `declineWeeklyCommitment` imports nothing that can write '
        + 'a program. It also states that the question is finished, which is what '
        + 'the ledger entry makes true.',
      text: 'No problem — I have left your week as it is, and I will not ask again this block.',
    },
    {
      id: COMMITMENT_FAILED_COPY_ID,
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-20, approving all seven of the coach sentences '
        + 'this unit proposed, AS WRITTEN. The words are unchanged from the '
        + 'draft he read. The honest floor when the '
        + 'transaction refuses. It says the plan is untouched, which the '
        + 'transaction guarantees by rolling back — never "try again", which '
        + 'would be advice this module has no basis for.',
      text: 'I could not rebuild your program just now, so nothing has changed.',
    },
    // ── THE EXTRA-SESSION OFFER — SIGNED, and the words are the ORDER'S. ──
    //
    // Sam's instruction for this unit gives the sentence and both buttons
    // verbatim, so nothing here is proposed. It is registered rather than
    // inlined for the same reason every other athlete sentence is: a surface
    // that builds this string itself is a surface authoring words.
    //
    // ⚠ IT OFFERS; IT DOES NOT ANNOUNCE. The contract's *"Do not silently add a
    // session"* is why the sentence ends in a question mark and why the card
    // cannot render without two buttons beside it.
    {
      id: EXTRA_SESSION_OFFER_COPY_ID,
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-16, given verbatim in the Block Two '
        + 'progression-ladder order. Rendered only from a DERIVED '
        + '`ExtraSessionOffer` whose legality was proven by generation. '
        + 'Guard: test:block-two-ladder.',
      text: 'You\u2019ve been completing your training consistently and recovering '
        + 'well. Your schedule allows another session. Would you like to add one '
        + 'session each week?',
    },
    {
      id: EXTRA_SESSION_OFFER_ACCEPT_COPY_ID,
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-16, verbatim button label.',
      text: 'Add one session',
    },
    {
      id: EXTRA_SESSION_OFFER_DECLINE_COPY_ID,
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-16, verbatim button label.',
      text: 'Keep my current schedule',
    },
    // ── The conditioning warm-up sentence — SIGNED, Sam 2026-08-05. ──
    // Imported from the emitter rather than transcribed: the words exist once,
    // so what ships on the row and what the sheet registers cannot drift.
    {
      id: CONDITIONING_WARMUP_COPY_ID,
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-05, ruling 4 of '
        + 'docs/SWITCHOVER_PARKED_RULINGS_2026-08-05.md. Closes the bare `Warm-up` '
        + 'row the Stage B switchover shipped and declared. Richer per-quality '
        + 'warm-up copy is a future signing batch, not a code decision.',
      text: CONDITIONING_WARMUP_COPY,
    },
    {
      // The row's NAME, which the projection resolves separately from its
      // prescription. Not a new word: it is the first word of the sentence
      // Sam signed above, and it names the row that sentence describes.
      id: exerciseNameCopyId(CONDITIONING_WARMUP_ROW_NAME),
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-05, ruling 4 of '
        + 'docs/SWITCHOVER_PARKED_RULINGS_2026-08-05.md — the row named by the '
        + 'signed warm-up sentence registered beside it.',
      text: CONDITIONING_WARMUP_ROW_NAME,
    },

    // ── Day headlines — NEW, proposed (Batch 6 / Task 2). ──
    {
      id: 'day.headline.training',
      source: 'sam_ruling',
      provenance: 'NEW — proposed, docs/COPY_SHEET_RULINGS_2026-07-30.md Batch 6, '
        + 'Task 2. A day whose kind is `training` and has no more specific name yet '
        + '(the day headline names the KIND per ruling 3, not the content — parts carry '
        + 'their own headlines).',
      text: 'Training Day',
    },
    {
      id: 'day.headline.rest',
      source: 'sam_ruling',
      provenance: 'NEW — proposed, Batch 6, Task 2.',
      text: 'Rest Day',
    },
    {
      id: 'day.headline.game',
      source: 'sam_ruling',
      provenance: 'NEW — proposed, Batch 6, Task 2.',
      text: 'Game Day',
    },
    {
      id: 'day.headline.practice_match',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-07-31, closing docs/COPY_SHEET_RULINGS_2026-07-30.md '
        + '§6-IV-4: a practice/trial fixture day reads "Practice Match", not "Game Day". '
        + 'LABEL ONLY. `dayIsFixture` keeps its week-shape behaviour, the day KIND stays '
        + '`game`, and every capability with it — this is a second WORD for one kind of '
        + 'day, never a second kind. Selected by the same typed `workoutType` set '
        + '`dayIsFixture` already reads, so the label and the week shape cannot come to '
        + 'disagree about which days are fixtures.',
      text: 'Practice Match',
    },
    // ── WHY THIS DAY IS EMPTY — R-379, Sam 2026-09-05. ──
    //
    // *"put it on the day … it should replace fresh up, adapt go again - when
    // it's needed"*. These REPLACE the rest card's standing subline on a day the
    // app deliberately emptied; an ordinary rest day keeps "Freshen up. Adapt.
    // Go again." Sam approved this set on sight (*"they'll do"*) with the note
    // that he will correct them once he has seen them on the phone.
    //
    // ⚠ **NO EM DASHES.** Sam, same message, verbatim: *"it should not include
    // any fuckign M dashes"*. `test:rest-day-reason` reds on the character.
    {
      id: 'day.rest.reason.injury',
      source: 'sam_ruling',
      provenance: 'Sam approved this replacement in the scopebridge task on 2026-09-06 '
        + '("yep approve"). R-379; applies to any injury that closes the session (R-378).',
      text: 'No session today while you recover from injury.',
    },
    {
      id: 'day.rest.reason.game_proximity',
      source: 'sam_ruling',
      provenance: 'Sam approved this replacement in the scopebridge task on 2026-09-06 '
        + '("yep approve"). R-379; does not assume a particular game or next training date.',
      text: 'Kept clear to help you stay fresh for your game.',
    },
    {
      id: 'day.rest.reason.fatigue',
      source: 'sam_ruling',
      provenance: 'Sam approved this sentence in the scopebridge task on 2026-09-06 '
        + '("yep approve"). Explains a session emptied by the existing dated fatigue policy.',
      text: 'No session today. Take the day to recover.',
    },
    {
      id: 'day.rest.reason.illness',
      source: 'sam_ruling',
      provenance: 'SIGNED ON SIGHT 2026-09-05, R-379.',
      text: 'Nothing today while you shake this off.',
    },
    {
      id: 'day.rest.reason.away',
      source: 'sam_ruling',
      provenance: 'SIGNED ON SIGHT 2026-09-05, R-379.',
      text: 'No session while you are away.',
    },
    {
      id: 'day.rest.reason.deload',
      source: 'sam_ruling',
      provenance: 'SIGNED ON SIGHT 2026-09-05, R-379.',
      text: 'Lighter week. Today stays clear.',
    },
    {
      id: 'day.rest.default',
      source: 'sam_ruling',
      provenance: 'LIFTED OUT OF `HomeScreenV2` 2026-09-05, R-379. It was a bare '
        + 'literal in the day card while every neighbouring string went through '
        + '`signedCopy` — so the one line the athlete reads on every rest day was '
        + 'the one line no copy gate could see. Words unchanged.',
      text: 'Freshen up. Adapt. Go again.',
    },
    {
      id: 'day.refusal.nothing_to_change',
      source: 'sam_ruling',
      provenance: 'NEW — proposed, Batch 6, Task 2. Shown when a day offers nothing to '
        + 'add, move or remove (`DayCapabilities.refusal`).',
      text: "There's nothing to change on this day.",
    },

    // ── The day card's eyebrow — WITHDRAWN 2026-08-22, and the rows go with it ──
    //
    // Batch 32 registered "TODAY'S SESSION" and its " - " separator for the day
    // card's eyebrow (ruling 5: the badge became words). Sam removed the eyebrow
    // AND the card's own date on 2026-08-22 — *"the date is now between the
    // arrows at the top of screen - so that can be removed and the title of the
    // session ... can take its place"* — so nothing renders these two rows.
    //
    // **A SIGNED ROW WITH NO RENDERER IS NOT ARCHIVE, IT IS A TRAP.** The next
    // surface that needs an eyebrow would find a signed string waiting and ship
    // it as though Sam had just approved it, when what he did was take it off
    // the screen. The withdrawal is recorded where withdrawals are read — batch
    // 32 of `docs/COPY_SHEET_RULINGS_2026-07-30.md`, whose WITHDRAWN form
    // `test:copy-rulings-binding` asserts is ABSENT from the app.
    //
    // ── AND AN EYEBROW IS BACK, 2026-08-27, WITH DIFFERENT WORDS ──
    //
    // Sam, against his template: *"a little 'today's focus' in lime green should
    // sit above it too like the image"*. **THIS DOES NOT UN-WITHDRAW BATCH 32.**
    // "TODAY'S SESSION" stays gone and stays asserted absent; what he approved
    // today is "TODAY'S FOCUS", a different string doing a different job — it
    // labels the WORK, where the old one labelled the DAY and then repeated the
    // date the arrows already carry.
    //
    // ⚠ **IT SAYS THE SAME THING ON EVERY DAY, AND THAT IS SAM'S CALL.** The
    // first build branched on `day.isToday` and showed a neutral "SESSION FOCUS"
    // on a day the athlete had walked to, on the reasoning that announcing
    // "today" on Saturday is the surface lying. He was told that and ruled
    // against it the same morning — *"session focus should be 'today's focus'"*.
    // ONE ROW, ONE STRING, EVERY DAY. The branch and the second row are gone
    // rather than left dark.
    {
      id: 'day.card.focus_eyebrow',
      source: 'sam_ruling',
      provenance: 'NEW — Sam, 2026-08-27, reading his template beside the live day '
        + 'card: "a little \'today\'s focus\' in lime green should sit above it too '
        + 'like the image", then "session focus should be \'today\'s focus\'" when '
        + 'shown the two-form version. Above the day card title, on any day that has '
        + 'a session.',
      text: "TODAY'S FOCUS",
    },
    // The drop-down row's meta line. `derived_number`: the SHAPE is authored,
    // the count is data — the same treatment the prescription templates below
    // get. PROPOSED, not signed: Sam signed the eyebrow, not this.
    {
      id: 'day.part.exercise_count',
      source: 'derived_number',
      provenance: 'NEW — PROPOSED, batch 33, UI merge slice 2. Her prototype\'s meta '
        + 'line under each collapsed part reads "4 exercises"; the word "exercises" is '
        + 'already this app\'s own (the day-detail screen says it), the number is the '
        + 'part\'s own row count.',
      text: '{count} exercises',
    },
    {
      id: 'day.part.exercise_count_one',
      source: 'derived_number',
      provenance: 'NEW — PROPOSED, batch 33, UI merge slice 2. The singular half. A '
        + 'template that can render "1 exercises" is a template that lies, and a part '
        + 'holding exactly one row is common (a power component with one exercise is '
        + 'the exhibit that made Sam rule on the day title).',
      text: '{count} exercise',
    },
    {
      id: 'day.part.mobility_warmup',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-31: change "mobility / warm up" to '
        + '"movement prep" while standalone Mobility sessions retain their name.',
      text: 'Movement Prep',
    },
    {
      id: 'session.team_training.row',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-11 in the Codex app task: "in the session '
        + 'view under team training it says club/field session it should just say '
        + 'Club session".',
      /* ⚠ **NOT RENAMED ON 2026-08-22, AND THAT IS DELIBERATE.** Sam's answer
         that day ("Team training", not "Club training") was about the FEEDBACK
         POP-UPS' header and questions. This row is a different ruling he made
         by name on 2026-08-11 — *"in the session view under team training it
         says club/field session it should just say Club session"* — and it is
         held by a law-registry row that quotes the words. A settled ruling is
         not re-decided as a side effect of a consistency pass; it is raised. */
      text: 'Club session',
    },

    // ── The change card, ruling 1. ──
    //
    // PROPOSED, batch 33. These two sentences are HER prototype's, and the
    // governing rule of the merge is HER STRUCTURE, HIS STYLE — so the panel is
    // adopted and the wording goes to Sam rather than being adopted with it.
    // They ship PROPOSED under this file's transitional rule (a string may ship
    // PROPOSED; it may never ship unlisted), because the alternative is his
    // FIRST bullet staying unbuilt while one signature is waited on.
    // ── Club training's own box and the session view's words (Sam, 2026-08-22). ──
    // SIGNED: every one of these is a phrase Sam typed in chat while building
    // the two-form split. Registered so the extraction ratchet stops counting
    // them as words nobody authored.
    {
      id: 'day.club_training.title',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-22: "I want to put team training in its own '
        + 'box on day view ... this box on day view should have title Team Training as it is".',
      text: 'Team Training',
    },
    {
      id: 'day.club_training.solo_helper',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-24: "Team training solo view on Day view '
        + 'needs a subtitle i.e. Have fun at training!".',
      text: 'Have fun at training!',
    },
    {
      id: 'day.club_training.status_label',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-22: "next to the icon it should say '
        + '\'Session status\'".',
      text: 'Session status',
    },
    {
      id: 'day.club_training.status_unlogged',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-22: "under that it should \'not logged yet\' '
        + 'or \'logged\' based on it\'s status".',
      text: 'Not logged yet',
    },
    {
      id: 'day.club_training.status_logged',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-22, the other half of the same sentence.',
      text: 'Logged',
    },
    {
      id: 'day.club_training.status_skipped',
      source: 'sam_ruling',
      provenance: 'SIGNED — the third state the same control can hold. Sam ruled a '
        + 'skip is never a tick (2026-08-22), so it needs its own word.',
      text: 'Skipped',
    },
    {
      id: 'day.club_training.log_action',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-21: "Add a \'log training\' button on the day '
        + 'view next to the \'team training\'".',
      text: 'Log training',
    },
    {
      id: 'day.club_training.view_action',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-22: "Once the session is logged it should say '
        + '\'view summary\'".',
      text: 'View summary',
    },
    {
      id: 'session.select_all',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-22: "maybe just \'select all\' with the check '
        + 'box in line with the other check boxes of the session".',
      text: 'Select all',
    },
    {
      id: 'session.change_card.subline',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-22: "\'Need to make a change\' box subtitle '
        + 'changed to \'Update today\'s session using the buttons below\'". The session '
        + 'screen\'s own wording; the day card keeps day.change_card.subline.',
      text: 'Update today\'s session using the buttons below',
    },
    {
      id: 'session.change_card.heading',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-211 superseding R-209: the '
        + 'active-session options sheet asks “What do you want to change?”.',
      text: 'What do you want to change?',
    },
    {
      id: 'session.options.injury.label',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-209: first active-session option.',
      text: 'Something hurts',
    },
    {
      id: 'session.options.injury.subline',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-211: injury-option explanation.',
      text: 'Adjust around pain or a niggle',
    },
    {
      id: 'session.options.equipment.label',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-209: second active-session option.',
      text: 'Equipment changed',
    },
    {
      id: 'session.options.equipment.subline',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-211: equipment-option explanation.',
      text: 'Tell us what’s missing',
    },
    /* The two `session.options.add.*` strings are DEREGISTERED — Sam,
     * 2026-08-25 (R-217): the section plus *"will replace the 'add an exercise'
     * option in the 3 dot menu"*. A signed string with no surface is copy the
     * next build finds, trusts as ruled, and puts back on a menu he cleared. */
    /* `week.board.banner` is DEREGISTERED — Sam, 2026-08-31: the Week editor
     * does not need a Sessions / games heading above the board. Keeping an
     * unmounted signed row would leave stale copy available to be remounted. */
    {
      id: 'week.board.save',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-26, R-245: the athlete explicitly '
        + 'finishes a changed Manage Week visit.',
      text: 'Save changes',
    },
    {
      id: 'week.board.saved',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-26, R-245: briefly confirm before '
        + 'returning to the ordinary Week view.',
      text: 'Changes saved',
    },
    {
      id: 'week.board.pastMoveRefusal',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-30, R-275: only the prompted unlogged past item moves.',
      text: 'Only the unlogged session in this prompt can move out of the past.',
    },
    {
      id: 'week.board.add.title',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-26, R-244: the board plus asks what '
        + 'belongs on the chosen day.',
      text: 'Add to this day',
    },
    {
      id: 'week.board.add.training.label',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-26, R-244: the training branch keeps '
        + 'the existing session-add pathway.',
      text: 'Training session',
    },
    {
      id: 'week.board.add.training.subline',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-26, R-244: training choice scope.',
      text: 'Strength, conditioning or optional work',
    },
    {
      id: 'week.board.add.game.label',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-26, R-244: game branch label.',
      text: 'Game',
    },
    {
      id: 'week.board.add.game.subline',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-26, R-244: fixture precedence is '
        + 'made explicit before the athlete chooses it.',
      text: 'Replaces anything already on this day',
    },
    {
      id: 'session.quick_add.label',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-217, his words: "a \'quick add\' '
        + 'feature that allows the athlete to add an exercise to that section". '
        + 'Spoken only — the control is a plus glyph, so this is what a screen '
        + 'reader announces beside the section name.',
      text: 'Quick add',
    },
    {
      id: 'session.equipment.eyebrow',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-212: equipment-sheet category.',
      text: 'Equipment',
    },
    {
      id: 'session.equipment.heading',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-212: equipment-sheet question.',
      text: 'What do you have today?',
    },
    {
      id: 'session.equipment.description',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-212: equipment-sheet instruction.',
      text: 'Untick anything you don’t have. We’ll adjust affected exercises around what’s available.',
    },
    {
      id: 'session.equipment.affected.plural',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-212: four-or-more equipment impact count.',
      text: 'exercises affected',
    },
    {
      id: 'session.equipment.update_action',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-212: equipment-sheet primary action.',
      text: 'Update session',
    },
    {
      id: 'session.log_action',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-22: "this finish session button should be '
        + '\'log session\'".',
      text: 'Log session',
    },
    {
      /* THE ONE DAY THE NAVIGATOR NAMES IN WORDS RATHER THAN IN NUMBERS.
         Sam, 2026-08-22: *"make it say 'today' in between the arrows at the top
         for todays date ... tomorrow will be unchanged ie. SUN 23/8 or yesterday
         would still say FRI 21/8"*. The DATE is not registered here and that is
         deliberate — `SAT 22/8` is the day's own two values, formatted the way
         this screen already formats a date. Registering a date template would
         be a second way the app says what day it is. */
      id: 'day.navigator.today',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-22: "it should just say today", for the '
        + 'day navigator\'s label when the day being viewed is today. It is also '
        + 'what a screen reader says there, from this same row.',
      text: 'Today',
    },
    {
      id: 'day.navigator.return_to_today',
      source: 'sam_ruling',
      provenance: 'SIGNED — the day navigator Sam ordered on 2026-08-21 ("a daily '
        + 'toggle following the same ui padding ... as the weekly view"). The week '
        + 'navigator already offers the way back; the day one says it the same way.',
      text: 'Return to today',
    },
    /* ── THE CLUB FORM'S OWN TITLE PAIR — RETIRED 2026-08-22 ──
       `day.club_training.form_title` ("Club training") and
       `day.club_training.form_subtitle` ("How did it go?") were this one form's
       header. Both jobs are now done by rows every form shares:
       `feedback.sheet.label_team_training` carries the name Sam chose, and
       `feedback.sheet.question` carries the heading all three ask. A per-form
       copy of a shared sentence is three places for one question to drift. */
    {
      id: 'session.clear_all',
      source: 'sam_ruling',
      provenance: 'SIGNED — the other half of the Select all control Sam ruled on '
        + '2026-08-22: the row un-ticks as well as ticks, so it needs the opposite word.',
      text: 'Clear all',
    },
    /* ── THE THREE FEEDBACK FORMS SHARE ONE HEADER AND ONE BUTTON ──
       Sam, 2026-08-22: *"can you make sure that the team training feedback,
       game feedback, and programmed session feedback pop ups are all the same
       style, fonts, and generally consistent"*, and on the two open questions:
       the button says "Save & Finish" on all three, and the thing is called
       TEAM training, not club training.

       ONE QUESTION FOR ALL THREE FORMS. Each sheet's header is a small label
       naming what is being logged, over this one heading — so the heading is
       one row, not three that can drift apart. The labels are the three rows
       below it. */
    /* ── THE MISSED-SESSION NOTICE — SAM, 2026-08-22 ──
       *"Notifications at top of screen above or below active modifiers: Did you
       do Thursday X and Y? i.e. Did you do Thursday strength? little
       notification. 'Yes, log it' ... or 'no, skip it' and the session is
       skipped. Also should be Did you complete team training yesterday?"*

       ONE SENTENCE PER DOOR, because the three doors are three different acts:
       a gym session is DONE, a club night is COMPLETED, a game is PLAYED. The
       weekday is a parameter, not part of the sentence — `day.name.<Weekday>`
       has been a signed row since 2026-08-20 for exactly this, and `{session}`
       is filled with the day's own bucket word, which is signed copy too. No
       surface composes a character of this. */
    {
      id: 'missed.prompt.session',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-22, verbatim shape: "Did you do Thursday '
        + 'strength?". The weekday and the session word are parameters.',
      text: 'Did you do {weekday} {session}?',
    },
    {
      id: 'missed.prompt.team_training',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-22, verbatim shape: "Did you complete team '
        + 'training yesterday?". The app says which day rather than "yesterday", '
        + 'because the notice can be about any past day of the week.',
      text: 'Did you complete {weekday} team training?',
    },
    {
      id: 'missed.prompt.game',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-22 ruled games are chased too ("any session '
        + 'that is skipped including games"). The verb is the one his own game form '
        + 'already uses — a game is played, not done.',
      text: 'Did you play the {weekday} game?',
    },
    {
      id: 'missed.prompt.yes',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-22, verbatim.',
      text: 'Yes, log it',
    },
    {
      id: 'missed.prompt.no',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-22, verbatim.',
      text: 'No, skip it',
    },
    {
      id: 'missed.prompt.move',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-30, R-275, verbatim.',
      text: 'No, move it',
    },
    {
      id: 'readiness.fatigue.noted',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-31, physical-device correction to R-275, verbatim.',
      text: 'You should be okay to train as planned, but if you start feeling flatter, let me know and we’ll pull things back.',
    },
    {
      id: 'readiness.fatigue.lighter',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-30, R-275: pretty flat slightly reduces today.',
      text: 'Today’s session is slightly reduced.',
    },
    {
      id: 'readiness.fatigue.rest',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-30, R-275: absolutely cooked means no session today.',
      text: 'You’re resting today.',
    },
    {
      id: 'readiness.fatigue.sequence',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-30, R-275: exact notice plus the derived effect.',
      text: 'That’s two tired days in a row. The rest of this week is deloaded.',
    },
    {
      id: 'feedback.sheet.question',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-21 wording ("How did it go?"), promoted on '
        + '2026-08-22 to the one heading all three feedback pop-ups share.',
      text: 'How did it go?',
    },
    {
      id: 'feedback.sheet.label_team_training',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-22, choosing "Team training" over "Club '
        + 'training" so one thing has one name: the day card already says it.',
      text: 'Team training',
    },
    {
      id: 'feedback.sheet.label_game',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-22. The label names what is being logged, in '
        + 'the same shape as the other two. Supersedes the old eyebrow + title pair.',
      text: 'Game',
    },
    {
      id: 'feedback.sheet.label_session',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-22. Same shape as the other two; the session '
        + 'form used to author its own heading in the screen, unsigned.',
      text: 'Session',
    },
    {
      id: 'feedback.save_action',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-22, asked which of the three words the forms '
        + 'should share and chose this one, the session form\'s own label. The two it '
        + 'supersedes are recorded in batch 18-b-i-A of the copy sheet; naming them '
        + 'here would keep a retired string alive in a file the gate reads.',
      text: 'Save & Finish',
    },
    {
      id: 'session.club_training.completion_question',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-21 ruled the club form asks three things, the '
        + 'first being whether they got there at all.',
      /* "Team", not "club" — Sam, 2026-08-22. The form said club in its header
         and in this question, then team in the two below it. */
      text: 'Did you get to team training?',
    },
    {
      id: 'day.change_card.heading',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-195: “Not feeling 100%?”',
      text: 'Not feeling 100%?',
    },
    {
      id: 'day.change_card.subline',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-195/R-200: “Tell us what’s changed '
        + 'and we’ll adjust today.”',
      text: 'Tell us what’s changed and we’ll adjust today.',
    },
    // The three status tiles' second lines — Sam, 2026-08-27, matching his
    // template's square boxes. Each one says what tapping it DOES, which is why
    // the card's own sub-line drops out of that shape: it would say it twice.
    {
      id: 'day.change_card.tired_detail',
      source: 'sam_ruling',
      provenance: 'NEW — from Sam\'s template screenshot, 2026-08-27: "the not '
        + 'feeling 100% box … should match the template with the new square boxes". '
        + 'The words are the template\'s own.',
      text: 'Take it easier while you improve',
    },
    {
      id: 'day.change_card.sick_detail',
      source: 'sam_ruling',
      provenance: 'NEW — from Sam\'s template screenshot, 2026-08-27, beside the '
        + 'thermometer.',
      text: 'Adjust training while you recover',
    },
    {
      id: 'day.change_card.injured_detail',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-31, R-278: the Injury tile says '
        + '“Adapt training around your injury”. This personal wording supersedes '
        + 'the template\'s “an injury”.',
      text: 'Adapt training around your injury',
    },
    {
      id: 'day.plan_options.accessibility_label',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-196: put a compact three-dot '
        + 'plan-options control on the programmed session card.',
      text: 'Plan options',
    },
    {
      id: 'week.edit_sheet.title',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-205 superseding R-201: the '
        + 'sheet opened by the Week dots is headed “Adjust this week”.',
      text: 'Adjust this week',
    },
    {
      id: 'week.edit_sheet.question',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-201 correction: the first '
        + 'weekly-adjustment step asks “What do you want to change?”.',
      text: 'What do you want to change?',
    },
    {
      id: 'week.edit_sheet.away.label',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-202: Away option label.',
      text: 'I’m going away',
    },
    {
      id: 'week.edit_sheet.away.subline',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-204: Away option explanation.',
      text: 'Adjust around travel or time away',
    },
    {
      id: 'week.edit_sheet.manage_sessions.label',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-26, R-244: sessions and games now '
        + 'share one Week management surface.',
      text: 'Manage week',
    },
    {
      id: 'week.edit_sheet.manage_sessions.subline',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-26, R-244: the single management '
        + 'surface covers everything planned on the week.',
      text: 'Add, move or remove what’s planned',
    },
    /* ⚠ **THE SIX `week.edit_sheet.session_action.*` STRINGS ARE DEREGISTERED
     * — R-218 FINAL SLICE.** They were the nested *"Add a session / Move a
     * session / Remove a session"* screen (R-206), which the board replaced:
     * the athlete taps the bin ON the session or drags the box, so nothing is
     * left to choose from a list first. A signed string with no surface is copy
     * the next build finds, trusts as ruled, and puts back on a screen Sam
     * cleared. */
    {
      id: 'day.add_session.action',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-196: when no programmed-session '
        + 'card exists, retain a visible direct doorway for adding one. '
        + 'REWORDED by Sam the same day (R-219), VERBATIM: "this should say '
        + '\'add optional session\'". Anything the athlete puts on a rest day '
        + 'is optional work — the word is the athlete\'s own reminder that the '
        + 'rest day was the programmed answer.',
      text: 'Add optional session',
    },
    {
      id: 'plan_change.add_to_session',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-197: rename the first plan-change '
        + 'option from “Add this session” to “Add to this session”.',
      text: 'Add to this session',
    },
    {
      id: 'plan_change.session_options',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-199: the popup opened by the '
        + 'programmed-session dots is headed “Session options”.',
      text: 'Session options',
    },
    {
      id: 'plan_change.remove_session',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-25, R-198: rename the destructive '
        + 'plan-change action to “Remove session”.',
      text: 'Remove session',
    },
    {
      id: 'plan_change.remove_to_rest',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-26: when the day has one session, '
        + 'explain removal as “Remove it — day becomes rest”.',
      text: 'Remove it — day becomes rest',
    },
    {
      id: 'plan_change.remove_pick_session',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-26: when the day has two sessions, '
        + 'the Remove row says “Pick a session to remove”.',
      text: 'Pick a session to remove',
    },

    // ── The injury review's two section headings, R-124. ──
    //
    // SIGNED BY SAM, 2026-08-21, on the screenshots: *"Keep those two
    // headings."* They were the last two athlete-visible strings this unit
    // added that nobody had authored, and they put `test:signed-copy-extraction`
    // one over its ceiling. His words, verbatim, now with a source.
    {
      id: 'injury_review.paused_heading',
      source: 'sam_ruling',
      provenance: 'SIGNED, Sam 2026-08-21, R-124: "Keep those two headings." The '
        + 'area is appended by the caller and is the athlete\'s own answer, so the '
        + 'AUTHORED half ends at "YOUR" — a signed template may never take a free '
        + 'word through its slot, which is the whole point of the branded type.',
      text: 'PAUSED — YOUR',
    },
    {
      id: 'injury_review.added_heading',
      source: 'sam_ruling',
      provenance: 'SIGNED, Sam 2026-08-21, R-124: "Keep those two headings."',
      text: 'ADDED INSTEAD',
    },

    // ── The active-modifiers strip, rulings 4, 7 and 9. ──
    //
    // PROPOSED, batch 34. Her prototype's two lines, read out of
    // docs/design/LFA_UI_PROTOTYPE_2026-08-10.html. Sam excused the strip's
    // ABSENCE on the day screen — *"that's not built yet so fair enough"* — he
    // did not sign its words, and the governing rule is her structure, HIS
    // style. They ship PROPOSED and join batch 33 in one signing.
    {
      id: 'modifiers.strip.count',
      source: 'derived_number',
      provenance: 'NEW — PROPOSED, batch 34, UI merge slice 3. Her prototype\'s '
        + '`dayModifierNotification` reads "2 active modifiers"; the number is the '
        + 'length of the list the strip opens, never a separately-counted value.',
      text: '{count} active modifiers',
    },
    {
      id: 'modifiers.strip.count_one',
      source: 'derived_number',
      provenance: 'NEW — PROPOSED, batch 34. The singular half. A strip that can '
        + 'render "1 active modifiers" is a strip that lies, and exactly one active '
        + 'modifier is the commonest non-zero case.',
      text: '{count} active modifier',
    },
    {
      id: 'modifiers.strip.subline',
      source: 'sam_ruling',
      provenance: 'NEW — PROPOSED, batch 34. The strip\'s second line in the signed '
        + 'prototype. It states a FACT about the program, not a verdict on the '
        + 'athlete — the same limit the Monday notification was held to.',
      text: 'Currently impacting your program',
    },
    {
      id: 'modifiers.strip.none',
      source: 'sam_ruling',
      provenance: 'SIGNED ON SIGHT, 2026-08-11. Sam ruled that My Status is '
        + 'always available from Coach, including the zero state, and supplied '
        + 'the meaning: "no modifiers currently impacting".',
      text: 'No modifiers currently impacting your program.',
    },
    // ── THE LAST FOUR, SIGNED 2026-08-13 (SEAT_INBOX item 23). ──
    //
    // Sam: *"i'd rather them shortened"*, then ***"signed"***. These close the
    // gap item 22(a) left open — with one correction the measurement forced:
    // it was FOUR phrases, not the three every doc said. `excluded` and
    // `pinned` share one builder and are OPPOSITES, so one phrase for both
    // would have been false every second time it rendered.
    //
    // TWO KINDS STILL HAVE NO PHRASE ON PURPOSE: soreness (its own sentence
    // names the body part) and the generated programme-effect notes.
    {
      id: 'modifiers.effect.exercise_preference_applied',
      source: 'signed_sentence',
      provenance: 'SIGNED 2026-08-13, SEAT_INBOX item 23 — Sam\'s word was '
        + '"signed" on these four, verbatim. Shown for an exercise preference — avoid, preferred alternative, or an added focus.',
      text: 'Exercise preference applied',
    },
    {
      id: 'modifiers.effect.exercise_removed',
      source: 'signed_sentence',
      provenance: 'SIGNED 2026-08-13, SEAT_INBOX item 23 — Sam\'s word was '
        + '"signed" on these four, verbatim. Shown for an EXCLUDED exercise, which is taken out.',
      text: 'Exercise removed',
    },
    {
      id: 'modifiers.effect.exercise_prioritised',
      source: 'signed_sentence',
      provenance: 'SIGNED 2026-08-13, SEAT_INBOX item 23 — Sam\'s word was '
        + '"signed" on these four, verbatim. Shown for a PINNED exercise, which is asked for more often.',
      text: 'Exercise prioritised',
    },
    {
      id: 'modifiers.effect.conditioning_swapped',
      source: 'signed_sentence',
      provenance: 'SIGNED 2026-08-13, SEAT_INBOX item 23 — Sam\'s word was '
        + '"signed" on these four, verbatim. Shown for a conditioning modality swap, e.g. bike for run.',
      text: 'Conditioning swapped',
    },
    // ── THE MODIFIER SHEET'S RIGHT-HAND COLUMN — SAM'S EIGHT, 2026-08-13. ──
    //
    // SIGNED VERBATIM. He wrote these as a list in SEAT_INBOX item 22(a),
    // one short phrase per modifier kind, to sit opposite the modifier's name
    // in his prototype's two-column row. They say what the app DID, never what
    // is wrong with the athlete.
    //
    // THERE IS NO NINTH FOR TIME CAPS, ON PURPOSE. Sam: "i've taken out time
    // caps for now" — that modifier renders no row at all.
    {
      id: 'modifiers.effect.volume_adjusted',
      source: 'signed_sentence',
      provenance: 'SIGNED 2026-08-13, SEAT_INBOX item 22(a) — Sam\'s own list, '
        + 'verbatim. Shown for tired / cooked.',
      text: 'Training volume adjusted',
    },
    {
      id: 'modifiers.effect.training_eased',
      source: 'signed_sentence',
      provenance: 'SIGNED 2026-08-13, SEAT_INBOX item 22(a) — Sam\'s own list, '
        + 'verbatim. Shown for sick.',
      text: 'Training eased back',
    },
    {
      id: 'modifiers.effect.exercises_swapped',
      source: 'signed_sentence',
      provenance: 'SIGNED 2026-08-13, SEAT_INBOX item 22(a) — Sam\'s own list, '
        + 'verbatim. Shown for injury being worked around.',
      text: 'Exercises swapped out',
    },
    {
      id: 'modifiers.effect.training_paused',
      source: 'signed_sentence',
      provenance: 'SIGNED 2026-08-13, SEAT_INBOX item 22(a) — Sam\'s own list, '
        + 'verbatim. Shown for injury at the paused tier.',
      text: 'Training paused',
    },
    {
      id: 'modifiers.effect.exercises_substituted',
      source: 'signed_sentence',
      provenance: 'SIGNED 2026-08-13, SEAT_INBOX item 22(a) — Sam\'s own list, '
        + 'verbatim. Shown for equipment missing.',
      text: 'Exercises substituted',
    },
    {
      id: 'modifiers.effect.sessions_moved',
      source: 'signed_sentence',
      provenance: 'SIGNED 2026-08-13, SEAT_INBOX item 22(a) — Sam\'s own list, '
        + 'verbatim. Shown for a day the athlete cannot train.',
      text: 'Sessions moved',
    },
    {
      id: 'modifiers.effect.club_sessions_off',
      source: 'authored_sheet',
      provenance: 'PROPOSED 2026-08-13, copy sheet batch 34 — SEAT_INBOX item '
        + '28. Sam ruled the BEHAVIOUR ("yes clear team training and games '
        + 'while away") and owes the words. Shown for an away/travel span.',
      text: 'Team training and games off',
    },
    {
      id: 'modifiers.effect.planned_lighter',
      source: 'signed_sentence',
      provenance: 'SIGNED 2026-08-13, SEAT_INBOX item 22(a) — Sam\'s own list, '
        + 'verbatim. Shown for a deload.',
      text: 'Planned lighter week',
    },
    {
      id: 'modifiers.effect.week_rebuilt',
      source: 'signed_sentence',
      provenance: 'SIGNED 2026-08-13, SEAT_INBOX item 22(a) — Sam\'s own list, '
        + 'verbatim. Shown for a game moved.',
      text: 'Week rebuilt around the game',
    },
    // ── The modifier SHEET, Sam's own prototype, ruled 2026-08-13. ──
    //
    // SIGNED ON SIGHT. He sent the prototype screen, asked whether tapping the
    // notice opened "something like this", and answered his own question with
    // *"add the popup"*. These five strings are read VERBATIM off that screen —
    // his words, not a paraphrase of them, which is what `signed_sentence`
    // means and why the provenance can cite an image rather than a doc.
    //
    // THE SHEET LISTS AND IT DOES NOT ACT. Its two controls go to My Status or
    // dismiss; every control that CHANGES a modifier still lives on My Status
    // alone, which is what cell [5] of `test:program-tab-read-only-modifiers`
    // keeps true.
    {
      id: 'modifiers.sheet.title',
      source: 'signed_sentence',
      provenance: 'SIGNED ON SIGHT, 2026-08-13. Sam\'s prototype screen, the '
        + 'sheet\'s headline, verbatim. It names what happened to the SESSION, '
        + 'not what is wrong with the athlete.',
      text: 'Your session has been modified',
    },
    {
      id: 'modifiers.sheet.body',
      source: 'signed_sentence',
      provenance: 'SIGNED ON SIGHT, 2026-08-13. The sheet\'s second line on the '
        + 'same prototype screen, verbatim.',
      text: 'The following modifiers are currently impacting your programming.',
    },
    {
      id: 'modifiers.sheet.footer',
      source: 'signed_sentence',
      provenance: 'SIGNED ON SIGHT, 2026-08-13. The line above the buttons on '
        + 'the same screen, verbatim. It says where changes are MADE, which is '
        + 'the sheet stating its own read-only limit to the athlete.',
      text: 'Visit Coach to make changes or update your status.',
    },
    {
      id: 'modifiers.sheet.go',
      source: 'signed_sentence',
      provenance: 'SIGNED ON SIGHT, 2026-08-13. The primary button, verbatim. '
        + 'Stored sentence-case and uppercased by the STYLE, like every other '
        + 'button in this app — the prototype\'s capitals are a typeface '
        + 'decision, not different words.',
      text: 'Go to my status',
    },
    {
      id: 'modifiers.sheet.dismiss',
      source: 'signed_sentence',
      provenance: 'SIGNED ON SIGHT, 2026-08-13. The secondary control, verbatim. '
        + 'It is the half that makes the sheet acceptable on the day screen: the '
        + 'athlete can read what changed and get on with the session.',
      text: 'Not now',
    },
    {
      id: 'phase.review.title',
      source: 'sam_ruling',
      provenance: 'SIGNED ON SIGHT, 2026-08-11. Sam supplied Renee\'s season '
        + 'review sheet and asked that Review open this chooser before any phase '
        + 'change. This is its exact title.',
      text: 'Review season phase',
    },
    {
      id: 'phase.review.body',
      source: 'sam_ruling',
      provenance: 'SIGNED ON SIGHT, 2026-08-11. Exact explanatory sentence on '
        + 'the Renee reference Sam supplied for the phase chooser.',
      text: 'Your season phase changes the priorities, load and progression used across your program.',
    },
    {
      id: 'phase.review.confirm',
      source: 'sam_ruling',
      provenance: 'SIGNED ON SIGHT, 2026-08-11. Exact action on the Renee phase '
        + 'chooser Sam supplied; in this app it advances to the retained questions.',
      text: 'Confirm phase',
    },
    {
      id: 'phase.shift.build.duration',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-26, R-247: phase rebuild timing copy.',
      text: 'Takes up to 20 seconds',
    },
    {
      id: 'phase.offseason.finish.title',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-26, R-247: exact white calendar title.',
      text: 'Select the date of your last game',
    },
    {
      id: 'phase.shift.complete.title',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-26, R-247: phase rebuild completion.',
      text: 'Your program is ready',
    },
    {
      id: 'phase.shift.complete.body',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-26, R-247: phase rebuild completion.',
      text: 'Your program has been rebuilt for your new season phase.',
    },
    {
      id: 'phase.shift.complete.action',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-26, R-247: explicit completion exit.',
      text: 'Done',
    },
    {
      id: 'modifiers.strip.week',
      source: 'sam_ruling',
      provenance: 'SIGNED ON SIGHT, 2026-08-11. Sam compared the built week '
        + 'against the signed prototype and called out that its active-modifier '
        + 'line was absent. This is the exact one-line week wording visible in '
        + 'the reference he supplied; its number is the list length.',
      text: '{count} active modifiers impacting program',
    },
    {
      id: 'modifiers.strip.week_one',
      source: 'sam_ruling',
      provenance: 'SIGNED ON SIGHT, 2026-08-11. Singular half of the same week '
        + 'line; the visual tape reaches one modifier by acting.',
      text: '{count} active modifier impacting program',
    },

    // ── The coach page's status screen, ruling 9. PROPOSED, batch 34. ──
    {
      id: 'coach.status.title',
      source: 'sam_ruling',
      provenance: 'NEW — PROPOSED, batch 34, UI merge slice 3. Ruling 9 names the '
        + 'surface "my status"; Title Case here matches the Coach tab\'s own h1 rather '
        + 'than her prototype\'s casing.',
      text: 'My status',
    },
    {
      id: 'coach.status.empty',
      source: 'sam_ruling',
      provenance: 'NEW — PROPOSED, batch 34. Shown when nothing is shaping the '
        + 'program. It states a fact and makes no claim about whether that is good — '
        + 'the same limit every observation surface in this app is held to.',
      text: 'Nothing is changing your program right now.',
    },

    // WITHDRAWN 2026-08-12 — 'coach.status.actions_not_yet', which read
    // "Change this on your program screen for now."
    //
    // It captioned the seven dimmed modifier controls on My Status. SEAT_INBOX
    // item 8 (a) made all eight live, so there is nothing left for it to
    // explain — and (b) retires it IN THE SAME COMMIT because a caption that
    // outlived its dimming would be pointing athletes away from a control that
    // works.
    //
    // IT WAS ALREADY WRONG BEFORE IT WAS OBSOLETE. `HomeScreenV2` stopped
    // rendering the modifier list at the UI merge, so "your program screen" had
    // nothing on it: an athlete who followed the sentence found an empty room
    // and no way back. That is the finding, not a footnote.

    // ── THE STATUS-UPDATE VOCABULARY. SAM RULED IT 2026-08-12. ───────────────
    //
    // He read the sheet on the simulator the moment it went live on My Status,
    // and he ruled it TWICE. Both messages are recorded, because the second
    // reverses the first and a reversal kept only in a chat log is a reversal
    // the next reader undoes.
    //
    //   FIRST: *"Drop 'Worse' from that sheet — four options only: I'm good
    //   now, Still not right, Still pretty sick, Still cooked. And change
    //   'Still sick' to 'Still pretty sick'."*
    //
    //   THEN: *"actually keep worse for now"*.
    //
    // SO THE RENAME STANDS AND `worse` STAYS IN THE VOCABULARY. "for now" is
    // his own word and is left as his — it is not read here as a plan to remove
    // it later, and nothing in the code is staged against that reading.
    //
    // PHYSICAL CORRECTION, 2026-08-31: these are not five universal buttons.
    // A cooked fact must not ask whether the athlete is "still sick" when they
    // never reported illness. `activeCoachNotes.statusUpdateOptionsForNote`
    // filters this vocabulary from the accepted fact's typed readiness family.
    //
    // THE COUNT IS PART OF THE SET. `test:my-status-modifiers` holds these five
    // ids AND their exact words, so a sixth vocabulary item cannot appear, and
    // none of the five can be silently reworded, without him saying so. The
    // same suite separately guards which subset each readiness family receives.
    //
    // THEY ARE SIGNED RATHER THAN EDITED IN PLACE because that is what this
    // repo does with a ruled athlete-facing string: all five were inline
    // literals in `HomeScreenV2` for months — unsigned, and therefore
    // attributable to nobody, which is how "Still sick" reached his screen with
    // no record of who chose it. His ruling is what gives them a source.
    {
      id: 'status_update.good_now',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-12, verbatim in the ruling above. '
        + 'Pre-existing wording he kept unchanged.',
      text: "I'm good now",
    },
    {
      id: 'status_update.still_not_right',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-12, verbatim in the ruling above. '
        + 'Pre-existing wording he kept unchanged.',
      text: 'Still not right',
    },
    {
      id: 'status_update.still_pretty_sick',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-12. HE CHANGED THIS ONE: it read '
        + '"Still sick" and he renamed it to "Still pretty sick" in the same '
        + 'message that dropped "Worse".',
      text: 'Still pretty sick',
    },
    {
      id: 'status_update.still_cooked',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-12, verbatim in the ruling above. '
        + 'Pre-existing wording he kept unchanged.',
      text: 'Still cooked',
    },
    {
      id: 'status_update.worse',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-12, and the ONLY row here with a '
        + 'reversal in its history: his first message dropped this option, his '
        + 'second said "actually keep worse for now". It ships. The row exists '
        + 'so the next reader finds the reversal beside the word rather than '
        + 're-applying the instruction that was withdrawn.',
      text: 'Worse',
    },

    // ── The one separator. ──
    {
      id: 'copy.joiner.plus',
      source: 'signed_sentence',
      provenance: 'SIGNED — Sam, 2026-08-08, verbatim in the compound-bucket ruling '
        + '(docs/WEEK_ROW_COMPOUND_BUCKET_RULING_2026-08-08.md §3): "on weekly view it '
        + 'should say whatever the bucket is that day i.e. Strength or strength + '
        + 'conditioning". The " + " is HIS, quoted from that sentence, not a format '
        + 'chosen here. It is the ONLY thing `joinSignedCopy` will put between two '
        + 'signed strings, which is what stops a surface picking its own separator — '
        + 'and a surface was: `DayWorkoutScreenV2` joined its subtitle on a `\' + \'` '
        + 'literal until this batch retired that line.',
      text: ' + ',
      joiner: true,
    },

    // ── Part-kind headlines — generic fallbacks. ──
    //
    // Used when a part's kind has no specific-name resolution (power, speed,
    // support, recovery, game — no existing signed name at this granularity) or
    // when the specific resolution below does not match one of the pinned
    // strength names (see module header, "SCOPE NOTE").
    {
      id: 'part.headline.strength',
      source: 'sam_ruling',
      provenance: 'NEW — proposed, Batch 6, Task 2. Fallback only: the specific path '
        + '(below) resolves the seven pinned strength names for the common case.',
      text: 'Strength',
    },
    {
      id: 'part.headline.conditioning',
      source: 'sam_ruling',
      provenance: 'NEW — proposed, Batch 6, Task 2. See module header "SCOPE NOTE" for '
        + 'why this stays generic rather than reaching for a specific conditioning '
        + 'identity in this unit.',
      text: 'Conditioning',
    },
    {
      id: 'part.headline.recovery',
      source: 'sam_ruling',
      provenance: 'RESTORED to "Recovery" on 2026-08-23. It read "Recovery" (Batch 6), '
        + 'was REWORDED to "Mobility" (Batch 7, 2026-08-01) on the reasoning that '
        + '"Recovery is a charter-deleted type and its authored contents ARE the '
        + 'mobility flows", and THAT PREMISE DIED on 2026-08-21 when Sam ruled '
        + '"there should be a specific mobility day and a specific recovery day" and '
        + 'Recovery was rebuilt with its own authored recipe (2 tissue quality, 3 '
        + 'mobility, 1 easy cardio, 1 breathing reset). Its contents are no longer '
        + '"the mobility flows", so the word that described them is no longer true. '
        + 'FOUND BY SAM ON GLASS, 2026-08-23: adding Recovery and adding Mobility '
        + 'both produced a card titled "Mobility" — and the Recovery one wore a '
        + 'RECOVERY badge under a Mobility title, two words for one session '
        + 'contradicting each other. The part KIND is unchanged; this is a word.',
      text: 'Recovery',
    },
    {
      id: 'part.headline.power',
      source: 'sam_ruling',
      provenance: 'NEW — proposed, Batch 6, Task 2.',
      text: 'Power',
    },
    {
      id: 'part.headline.speed',
      source: 'sam_ruling',
      provenance: 'NEW — proposed, Batch 6, Task 2.',
      text: 'Speed',
    },
    {
      id: 'part.headline.support',
      source: 'sam_ruling',
      provenance: 'NEW — proposed, Batch 6, Task 2.',
      text: 'Midline Work',
    },
    {
      id: 'part.headline.game',
      source: 'sam_ruling',
      provenance: 'NEW — proposed, Batch 6, Task 2; REACHABLE since Task 6. It was '
        + 'registered defensively because no mapping produced a `game`-kind part; '
        + '`partKind` now converts a fixture\'s last-resort `session` placeholder, so '
        + 'a game day\'s part is named for what it is instead of reading "Strength".',
      text: 'Game Day',
    },
    // ── Charter optional-type part headlines (Batch 7, PROPOSED 2026-08-01). ──
    //
    // Selected by the workout's typed `composedOptionalKind` (stamped by
    // `sessionBuilder.finaliseDerivedSession`), never by name. The words are
    // the Add-menu's own signed labels (Batch 5 `CATEGORY_COPY` "Gunshow" /
    // "Mobility"; ruling 6-IV-1 "Accessories") — a part named for the door the
    // athlete tapped, no invention.
    {
      id: 'part.headline.optional.gunshow',
      source: 'sam_ruling',
      provenance: 'PROPOSED — Batch 7 (device-pass fix round, 2026-08-01). Reuses the '
        + 'signed Add-menu label (CATEGORY_COPY.gunshow, Batch 5).',
      text: 'Gunshow',
    },
    {
      id: 'part.headline.optional.prehab',
      source: 'sam_ruling',
      provenance: 'PROPOSED — Batch 7 (device-pass fix round, 2026-08-01). Reuses the '
        + 'fifth-row label Sam signed 2026-07-31 (ruling 6-IV-1): the CATEGORY ID '
        + 'stays `prehab`, the athlete\'s word is "Accessories".',
      text: 'Accessories',
    },
    {
      id: 'part.headline.optional.primer',
      source: 'sam_ruling',
      provenance: 'NEW — R-129 (Sam, 2026-08-23). Reuses the Add-menu label he '
        + 'chose for the door (CATEGORY_COPY.primer), so the part is named for the '
        + 'row the athlete tapped. Selected by the typed `composedOptionalKind`, '
        + 'never by name; without this row a Primer part reads the honest-generic '
        + '"Strength".',
      text: 'Primer',
    },
    {
      id: 'part.headline.optional.mobility',
      source: 'sam_ruling',
      provenance: 'PROPOSED — Batch 7 (device-pass fix round, 2026-08-01). Reuses the '
        + 'signed Add-menu label (CATEGORY_COPY.mobility, Batch 5). Also retires a '
        + 'deleted-type word: an added Mobility session used to read "Recovery".',
      text: 'Mobility',
    },
    {
      id: 'part.headline.team_training',
      source: 'authored_sheet',
      provenance: 'utils/sessionNaming.ts TEAM_ONLY_NAME — the pre-existing team-day '
        + 'naming constant every combined-day name already leads with; already shipping.',
      text: TEAM_ONLY_NAME,
    },

    // ── Row prescription templates. ──
    //
    // `derived_number`: the SHAPE is authored (and already shipping — it mirrors
    // `dayWorkoutHelpers.formatStrengthSetsReps` / `formatRecoveryPrescription`
    // verbatim), the numbers are data. Covers the two dominant row shapes
    // (sets×reps, duration); distance/tempo/per-side rows fall through to the
    // `unspecified` placeholder below rather than inventing a shape for them —
    // recorded as a deviation in the task report.
    {
      id: 'row.prescription.sets_reps',
      source: 'derived_number',
      provenance: 'Mirrors dayWorkoutHelpers.formatStrengthSetsReps\'s equal-min/max '
        + 'shape, already shipping on the day-detail screen.',
      text: '{sets} × {reps}',
    },
    {
      id: 'row.prescription.sets_reps_range',
      source: 'derived_number',
      provenance: 'Mirrors dayWorkoutHelpers.formatStrengthSetsReps\'s range shape.',
      text: '{sets} × {min}-{max}',
    },
    // A DISTANCE row — today the Primer's authored accelerations alone (R-129:
    // "3 accelerations for 15m"). Mirrors formatLowLoadSetsReps's metre shape,
    // already shipping on the session screen; without this id the row fell into
    // `sets_reps` and read "3 × 15" — a rep count in distance's clothing — on
    // every week-row expansion.
    {
      id: 'row.prescription.sets_distance',
      source: 'derived_number',
      provenance: 'Mirrors dayWorkoutHelpers.formatLowLoadSetsReps\'s metre shape, '
        + 'shipping on the session screen since R-129 round 6.',
      text: '{sets} × {metres}m',
    },
    // ── WHEN THE APP CANNOT BUILD A WEEK AT ALL — Sam, 2026-08-17. ──
    //
    // His structure, verbatim, and it is three lines with a fixed first and
    // last:
    //
    //     "We couldn't build a safe week from your current setup.
    //      [Plain-language explanation of the exact typed refusal.]
    //      Update the relevant answer and try again."
    //
    // **THE MIDDLE LINE IS ONE SENTENCE PER TYPED CLAUSE, AND THEY ARE NOT
    // INTERCHANGEABLE.** Sam: *"The second line must come from the existing
    // typed refusal reason — do not invent new refusal logic or collapse
    // different causes into one generic message."* `GeneratedWeekClauseId` is a
    // CLOSED union of fourteen, so there are fourteen entries below and the type
    // system is what keeps them complete: `REFUSAL_CLAUSE_COPY` is a
    // `Record<GeneratedWeekClauseId, string>`, so a clause added to the contract
    // fails the build here until somebody writes its sentence.
    //
    // **NO NEW REFUSAL LOGIC WAS WRITTEN.** Nothing here decides whether to
    // refuse, what to measure, or which clause failed. The contract already
    // decided all three and carries the finding; this is the sentence for a
    // decision that has already been made.
    //
    // Each sentence is the clause's own authored `requirement` said in the
    // athlete's words, and it names WHAT THE ATHLETE CAN CHANGE, because the
    // third line tells them to go and change something and a line that does not
    // say what would be a dead end.
    {
      id: 'week.refusal.lead',
      source: 'sam_ruling',
      provenance: "Sam, 2026-08-17, verbatim first line of the refusal structure he "
        + 'specified.',
      text: "We couldn't build a safe week from your current setup.",
    },
    {
      id: 'week.refusal.fix',
      source: 'sam_ruling',
      provenance: 'Sam, 2026-08-17, verbatim third line of the same structure.',
      text: 'Update the relevant answer and try again.',
    },

    // ── The middle line, one per typed clause. ──
    {
      id: 'week.refusal.clause.main_strength_required_minimum',
      source: 'sam_ruling',
      provenance: "Sam's 2026-08-17 structure, middle line. The athlete's wording of "
        + "generatedWeekContract.ts clause 'main_strength_required_minimum' — its authored requirement "
        + 'said in plain words, naming what the athlete can change.',
      text: REFUSAL_CLAUSE_COPY.main_strength_required_minimum,
    },
    {
      id: 'week.refusal.clause.main_strength_planner_selected_target',
      source: 'sam_ruling',
      provenance: "Sam's 2026-08-17 structure, middle line. The athlete's wording of "
        + "generatedWeekContract.ts clause 'main_strength_planner_selected_target' — its authored requirement "
        + 'said in plain words, naming what the athlete can change.',
      text: REFUSAL_CLAUSE_COPY.main_strength_planner_selected_target,
    },
    {
      id: 'week.refusal.clause.main_strength_permitted_maximum',
      source: 'sam_ruling',
      provenance: "Sam's 2026-08-17 structure, middle line. The athlete's wording of "
        + "generatedWeekContract.ts clause 'main_strength_permitted_maximum' — its authored requirement "
        + 'said in plain words, naming what the athlete can change.',
      text: REFUSAL_CLAUSE_COPY.main_strength_permitted_maximum,
    },
    {
      id: 'week.refusal.clause.required_safe_patterns_present',
      source: 'sam_ruling',
      provenance: "Sam's 2026-08-17 structure, middle line. The athlete's wording of "
        + "generatedWeekContract.ts clause 'required_safe_patterns_present' — its authored requirement "
        + 'said in plain words, naming what the athlete can change.',
      text: REFUSAL_CLAUSE_COPY.required_safe_patterns_present,
    },
    {
      id: 'week.refusal.clause.pattern_balance',
      source: 'sam_ruling',
      provenance: "Sam's 2026-08-17 structure, middle line. The athlete's wording of "
        + "generatedWeekContract.ts clause 'pattern_balance' — its authored requirement "
        + 'said in plain words, naming what the athlete can change.',
      text: REFUSAL_CLAUSE_COPY.pattern_balance,
    },
    {
      id: 'week.refusal.clause.prohibited_patterns_absent',
      source: 'sam_ruling',
      provenance: "Sam's 2026-08-17 structure, middle line. The athlete's wording of "
        + "generatedWeekContract.ts clause 'prohibited_patterns_absent' — its authored requirement "
        + 'said in plain words, naming what the athlete can change.',
      text: REFUSAL_CLAUSE_COPY.prohibited_patterns_absent,
    },
    {
      id: 'week.refusal.clause.core_conditioning_required_minimum',
      source: 'sam_ruling',
      provenance: "Sam's 2026-08-17 structure, middle line. The athlete's wording of "
        + "generatedWeekContract.ts clause 'core_conditioning_required_minimum' — its authored requirement "
        + 'said in plain words, naming what the athlete can change.',
      text: REFUSAL_CLAUSE_COPY.core_conditioning_required_minimum,
    },
    {
      id: 'week.refusal.clause.sprint_high_speed_required_minimum',
      source: 'sam_ruling',
      provenance: "Sam's 2026-08-17 structure, middle line. The athlete's wording of "
        + "generatedWeekContract.ts clause 'sprint_high_speed_required_minimum' — its authored requirement "
        + 'said in plain words, naming what the athlete can change.',
      text: REFUSAL_CLAUSE_COPY.sprint_high_speed_required_minimum,
    },
    {
      id: 'week.refusal.clause.full_rest_required_minimum',
      source: 'sam_ruling',
      provenance: "Sam's 2026-08-17 structure, middle line. The athlete's wording of "
        + "generatedWeekContract.ts clause 'full_rest_required_minimum' — its authored requirement "
        + 'said in plain words, naming what the athlete can change.',
      text: REFUSAL_CLAUSE_COPY.full_rest_required_minimum,
    },
    {
      id: 'week.refusal.clause.hard_day_permitted_maximum',
      source: 'sam_ruling',
      provenance: "Sam's 2026-08-17 structure, middle line. The athlete's wording of "
        + "generatedWeekContract.ts clause 'hard_day_permitted_maximum' — its authored requirement "
        + 'said in plain words, naming what the athlete can change.',
      text: REFUSAL_CLAUSE_COPY.hard_day_permitted_maximum,
    },
    {
      id: 'week.refusal.clause.training_paused_means_no_training',
      source: 'sam_ruling',
      provenance: "Sam's 2026-08-17 structure, middle line. The athlete's wording of "
        + "generatedWeekContract.ts clause 'training_paused_means_no_training' — its authored requirement "
        + 'said in plain words, naming what the athlete can change.',
      text: REFUSAL_CLAUSE_COPY.training_paused_means_no_training,
    },
    {
      id: 'week.refusal.clause.prohibited_power_absent',
      source: 'sam_ruling',
      provenance: "Sam's 2026-08-17 structure, middle line. The athlete's wording of "
        + "generatedWeekContract.ts clause 'prohibited_power_absent' — its authored requirement "
        + 'said in plain words, naming what the athlete can change.',
      text: REFUSAL_CLAUSE_COPY.prohibited_power_absent,
    },
    {
      id: 'week.refusal.clause.prohibited_sprint_absent',
      source: 'sam_ruling',
      provenance: "Sam's 2026-08-17 structure, middle line. The athlete's wording of "
        + "generatedWeekContract.ts clause 'prohibited_sprint_absent' — its authored requirement "
        + 'said in plain words, naming what the athlete can change.',
      text: REFUSAL_CLAUSE_COPY.prohibited_sprint_absent,
    },
    {
      id: 'week.refusal.clause.row_role_is_declared',
      source: 'sam_ruling',
      provenance: "Sam's 2026-08-17 structure, middle line. The athlete's wording of "
        + "generatedWeekContract.ts clause 'row_role_is_declared' — its authored requirement "
        + 'said in plain words, naming what the athlete can change.',
      text: REFUSAL_CLAUSE_COPY.row_role_is_declared,
    },

    // ── WHAT THE KIT COULD NOT TRAIN — Sam's surface 4, 2026-08-17. ──
    //
    // *"Typed equipment/kit gaps carried by the program must be visible and
    // understandable to the athlete."* The gap is already TYPED and already
    // STORED: `Workout.composedGaps` (`ComposedGap[]`), written by
    // `materialiseComposedWeek` and carried through `assembleAuthoredWeek`'s
    // enumerated field list. It already had a reader too — `ComposedGapNotice`
    // on `DayWorkoutScreenV2` — but `project()` did not carry it, so the ONE
    // CANONICAL PROJECTION was blind to a gap the day screen was showing. Every
    // other surface, the week view and the printed weeks included, could not
    // see it at all.
    //
    // THE WORDS ARE THE SCREEN'S, TRANSCRIBED, NOT REWRITTEN. Four sentences,
    // matching `ComposedGapNotice`'s four branches exactly, so wiring the
    // projection cannot change what an athlete already reads. `authored_sheet`
    // rather than a new batch for that reason.
    //
    // THE TWO CAUSES STAY APART, which is `ComposedGap`'s own law: a KIT gap is
    // fixed by getting equipment, an EXCLUSION gap only by the athlete
    // restoring what they took out, and the file's header records the day the
    // app told an athlete who had banned every row that their equipment was the
    // problem.
    {
      id: 'day.gap.already_on_day',
      source: 'sam_ruling',
      provenance: 'docs/STATUS_INTAKE.md — proposed disclosure for the authorized duplicate-exercise fix, 2026-08-28.',
      text: 'No extra {slot} today — the available exercises are already in this session.',
    },
    {
      id: 'day.gap.kit_with_need',
      source: 'authored_sheet',
      provenance: 'screens/home/DayWorkoutScreenV2.tsx ComposedGapNotice — the kit '
        + 'branch with a named requirement, already shipping on the day screen.',
      text: 'No {slot} today — that would need {need}.',
    },
    {
      id: 'day.gap.kit',
      source: 'authored_sheet',
      provenance: 'ComposedGapNotice — the kit branch with no named requirement.',
      text: 'No {slot} today — your kit can\'t train it.',
    },
    {
      id: 'day.gap.exclusion',
      source: 'authored_sheet',
      provenance: 'ComposedGapNotice — the exclusion branch with no nameable rows.',
      text: 'No {slot} today — everything that trains it is currently left out.',
    },
    {
      id: 'day.gap.exclusion_named',
      source: 'authored_sheet',
      provenance: 'ComposedGapNotice — the exclusion branch that names what the '
        + 'athlete left out, including its Restore instruction.',
      text: 'No {slot} today — you\'ve left {names} out. Restore it in My Status '
        + 'to get this back.',
    },

    // ── The authored conditioning dose. ──
    //
    // Sam, 2026-08-17: conditioning shows work, rest, rounds and useful
    // duration, each on its own line. `derived_number` for the same reason the
    // prescriptions above are: the LABEL is authored here, the value is Sam's
    // own string off `data/conditioningTemplates.ts` — `workPeriod`,
    // `restPeriod`, `setsRounds`, `totalSessionTime`, handed over by
    // `conditioningSelection.conditioningVisibleDoseFor` without rewriting.
    //
    // "Sets:" rather than "Rounds:" deliberately, and it is not a preference:
    // `composeConditioningRows` already writes `Sets: ${template.setsRounds}`
    // into the row's notes, and the authored value reads "4 reps" / "3 × 8 min,
    // or 4 × 6 min". "Rounds: 4 reps" would be the projection re-authoring the
    // sheet to fit a label. One word, one owner, and the emitter had it first.
    {
      id: 'row.dose.work',
      source: 'derived_number',
      provenance: 'Mirrors conditioningSelection.composeConditioningRows\'s '
        + '`Work: ${doseLineForDisplay(template.workPeriod)}` note line, already shipping.',
      text: 'Work: {value}',
    },
    {
      id: 'row.dose.rest',
      source: 'derived_number',
      provenance: 'Mirrors composeConditioningRows\'s `Rest: ...` note line.',
      text: 'Rest: {value}',
    },
    {
      id: 'row.dose.sets_rounds',
      source: 'derived_number',
      provenance: 'Mirrors composeConditioningRows\'s `Sets: ${template.setsRounds}` '
        + 'note line, label included.',
      text: 'Sets: {value}',
    },
    {
      id: 'row.dose.total_time',
      source: 'derived_number',
      provenance: 'ConditioningTemplate.totalSessionTime, verbatim — the "useful '
        + 'duration" of Sam\'s 2026-08-17 order. The label is this sheet\'s; the '
        + 'authored string already carries its own ≈ and its work-time aside.',
      text: 'Takes about: {value}',
    },
    {
      id: 'row.prescription.duration_seconds',
      source: 'derived_number',
      provenance: 'Mirrors dayWorkoutHelpers.formatRecoveryPrescription\'s '
        + 'sub-60-second duration shape.',
      text: '{seconds}s',
    },
    {
      id: 'row.prescription.duration_seconds_range',
      source: 'derived_number',
      provenance: 'Mirrors dayWorkoutHelpers.formatRecoveryPrescription\'s '
        + 'sub-60-second duration range shape.',
      text: '{min}-{max}s',
    },
    {
      id: 'row.prescription.duration_minutes',
      source: 'derived_number',
      provenance: 'Mirrors dayWorkoutHelpers.formatRecoveryPrescription\'s '
        + 'duration_minutes shape.',
      text: '{minutes} min',
    },
    {
      id: 'row.prescription.duration_minutes_range',
      source: 'derived_number',
      provenance: 'Mirrors dayWorkoutHelpers.formatRecoveryPrescription\'s '
        + 'duration_minutes range shape.',
      text: '{min}-{max} min',
    },
    {
      id: 'row.prescription.unspecified',
      source: 'sam_ruling',
      provenance: 'NEW — proposed, Batch 6, Task 2. Fallback for prescription shapes '
        + 'not yet covered (distance, tempo, per-side) — a scope limitation, not an '
        + 'invented number.',
      text: 'See session',
    },
    // ── Template-registry row names. ──
    //
    // TASK 6. `project()` threw on the athlete's day-detail screen the moment he
    // added anything from the add menu: every row a template places carries a
    // name from `coachRevisionTemplates.ts`, and none of them were in the sheet.
    // That registry is the authored source — "the ONLY source of addable content
    // ... template-derived, never free-form" — and the list is DERIVED from its
    // own emitter (see `COACH_REVISION_TEMPLATE_ROW_NAMES`), so a template Sam
    // adds is signed without a second edit here.
    ...COACH_REVISION_TEMPLATE_ROW_NAMES.map((name): SignedCopyEntry => ({
      id: exerciseNameCopyId(name),
      source: 'authored_sheet',
      provenance: 'utils/coachRevisionTemplates.ts — the addable-content registry '
        + '(template labels + the recovery-flow rows). Already shipping: these are '
        + 'the words the add menu offers and the day shows after the add.',
      text: name,
    })),

    // ── The seven pinned strength session names. ──
    ...STRENGTH_SESSION_VARIANTS.map((variant): SignedCopyEntry => ({
      id: `part.headline.strength.${variant.id}`,
      source: 'authored_sheet',
      provenance: 'data/strengthSessionVariants.ts, mirroring utils/sessionNaming.ts '
        + 'canonicalStrengthLabel — pinned verbatim by strengthSessionVariantTests B3 '
        + '("the seven names are PINNED... athlete-visible and were all shipping before '
        + 'the authored set existed"). Not proposed: already shipping.',
      text: variant.label,
    })),
    {
      id: 'part.headline.strength.injury_adjusted',
      source: 'sam_ruling',
      provenance: 'R-289 (Sam, 2026-08-31): use "Injury-Adjusted Session" when '
        + 'the original session movement patterns have all been replaced. The '
        + 'typed planned/effective pattern ledger and injury-adjustment record '
        + 'decide this; row-name inference does not.',
      text: INJURY_ADJUSTED_SESSION_NAME,
    },
  ]);

  // ── Bulk: the locked exercise vocabulary, and its authored cues. ──
  //
  // `VisibleRow.name` and `.cue` are `SignedCopy`, so a row cannot carry an
  // exercise name or cue that was not registered. Names are already a locked,
  // authored vocabulary (exercise-name-literal-lock unit: a builder may only
  // emit a name from this set) and cues are the authored cue sheet
  // (cue-reconciliation unit) — this is a trace, not an invention, registered in
  // bulk because the vocabulary is the source, not a hand-picked subset of it.
  const exerciseEntries: SignedCopyEntry[] = [];
  /**
   * ⚠ **ONE EXERCISE NAME REGISTERED BY RULING RATHER THAN BY POOL MEMBERSHIP,
   * AND THE REASON MATTERS.**
   *
   * R-129 authors *"3 accelerations for 15m at 90%"* as a row of the Primer.
   * `Acceleration` is Sam's own word and is not in any of the four selectable
   * pools, so the bulk trace below cannot reach it and the athlete's screen threw
   * a render error the moment a Primer was opened — caught on Sam's phone
   * 2026-08-23, by him, with twenty green cells behind it.
   *
   * **IT IS DELIBERATELY *NOT* ADDED TO `POWER_EXERCISE_POOL`**, which was the
   * obvious fix and is the wrong one: that pool is one of the four SELECTABLE
   * systems, so a running acceleration would immediately become eligible for the
   * power slot inside ordinary gym strength sessions. The Primer names this row
   * by authorship, not by selection, so its NAME needs provenance and its pool
   * membership does not exist to be granted.
   *
   * If it should ever become selectable, that is a generation change with a
   * scenario report, not an edit here.
   */
  exerciseEntries.push({
    id: exerciseNameCopyId('Acceleration'),
    source: 'sam_ruling',
    provenance: 'R-129 (Sam, 2026-08-23): "optional 3 accelerations for 15m at 90%". '
      + 'Authored BY NAME on utils/sessionBuilder.ts SESSION_SLOTS.primer; not a '
      + 'member of any selectable pool, and not to be made one without a '
      + 'generation ruling.',
    text: 'Acceleration',
  });
  for (const template of CONDITIONING_TEMPLATES) {
    for (const section of template.sections ?? []) {
      NAMES_WITH_CUE.add(section.name);
      exerciseEntries.push({
        id: exerciseNameCopyId(section.name),
        source: 'sam_ruling',
        provenance: 'R-331 (Sam, 2026-09-02): one combined Change of Direction session with three exact visible sections.',
        text: section.name,
      });
      exerciseEntries.push({
        id: `${EXERCISE_CUE_PREFIX}${section.name}`,
        source: 'sam_ruling',
        provenance: 'R-331 (Sam, 2026-09-02): exact cue attached to its matching Change of Direction section.',
        text: section.cue,
      });
    }
  }
  for (const name of selectableExerciseNames()) {
    exerciseEntries.push({
      id: exerciseNameCopyId(name),
      source: 'authored_sheet',
      provenance: 'data/selectableExerciseVocabulary.ts selectableExerciseNames() — the '
        + 'locked exercise vocabulary; exercise-name-literal-lock unit.',
      text: conditioningDisplayTitleForName(name),
    });
    const cue = buildCueText(name);
    if (cue) {
      NAMES_WITH_CUE.add(name);
      exerciseEntries.push({
        id: exerciseCueCopyId(name)!,
        source: 'authored_sheet',
        provenance: 'screens/home/dayWorkoutHelpers.ts buildCueText — the authored cue '
          + 'sheet; cue-reconciliation unit.',
        text: cue,
      });
    }
  }
  registerSignedCopy(exerciseEntries);

  // ── The authored conditioning dose values. ──
  //
  // Sam's 2026-08-17 order, surface 1. Every string here is one authored field
  // of `data/conditioningTemplates.ts`, fetched through the EMITTER's own
  // accessor so the sheet cannot disagree with the row notes the composer
  // writes from the same fields. A trace, not an invention — the same shape as
  // the exercise vocabulary above.
  const doseEntries: SignedCopyEntry[] = [];
  const conditioningDoseNames = CONDITIONING_TEMPLATES.flatMap((template) => [
    template.name,
    ...(template.sections?.map((section) => section.name) ?? []),
  ]);
  for (const name of conditioningDoseNames) for (const modality of [undefined, 'running', 'bike', 'row', 'ski'] as const) {
    const suffix = modality ? modality === 'running' ? '.running' : modality === 'row' || modality === 'ski' ? '.' + modality : '.machine' : '';
    const dose = conditioningVisibleDoseFor(name, modality);
    if (!dose) continue;
    const fields: readonly (readonly [ConditioningDoseField, string])[] = [
      ['work', dose.work],
      ['rest', dose.rest],
      ['sets_rounds', dose.setsRounds],
      ['total_time', dose.totalSessionTime],
    ];
    for (const [field, text] of fields) {
      if (!text.trim()) continue;
      DOSE_VALUES_REGISTERED.add(`${dose.templateName} ${field}${suffix}`);
      doseEntries.push({
        id: `${DOSE_VALUE_PREFIX}${field}.${dose.templateName}${suffix}`,
        source: 'authored_sheet',
        provenance: 'data/conditioningTemplates.ts — the authored dose sheet, read '
          + 'through conditioningSelection.conditioningVisibleDoseFor so the value '
          + 'is normalised exactly as composeConditioningRows normalises it.',
        text,
      });
    }
  }
  registerSignedCopy(doseEntries);

  /* A filled dose line contains authored WORDS, not only a numeric placeholder.
   * Register every finite sheet-derived combination so runtime provenance can
   * recognise the complete rendered line without widening SignedCopy's global
   * placeholder rule back to arbitrary text. */
  const renderedDoseEntries: SignedCopyEntry[] = [];
  for (const templateName of conditioningDoseNames) for (const modality of [undefined, 'running', 'bike', 'row', 'ski'] as const) {
    const suffix = modality ? modality === 'running' ? '.running' : modality === 'row' || modality === 'ski' ? '.' + modality : '.machine' : '';
    for (const [field, labelId] of CONDITIONING_DOSE_COPY_LINES) {
      const valueId = conditioningDoseValueCopyId(templateName, field, modality);
      if (!valueId) continue;
      renderedDoseEntries.push({
        id: `row.dose.rendered.${field}.${templateName}${suffix}`,
        source: 'authored_sheet',
        provenance: 'Finite rendered conditioning dose: the registered label filled '
          + 'with the registered authored template value; no open text placeholder.',
        text: signedCopy(labelId, { value: signedCopy(valueId) }),
      });
    }
  }
  registerSignedCopy(renderedDoseEntries);

  // ── Gap slot and kit words. ──
  //
  // Enumerated from the AUTHORED slot union via `WEEKLY_COVERAGE_SET` plus every
  // per-kind ladder, so the set is the slot vocabulary itself rather than a
  // transcription of it. The equipment words come from the askable equipment
  // vocabulary — the same list the athlete answered.
  const gapEntries: SignedCopyEntry[] = [];
  // R-130a: both paths' tables — the female lists carry two slots the male
  // ones never declare (`midline`, `lower_accessory`), and a female gap notice
  // must have its words on the sheet like any other.
  const slots = new Set<string>([
    ...Object.values(SLOTS_FOR_KIND).flatMap((list) => [...list]),
    ...Object.values(FEMALE_SLOTS_FOR_KIND).flatMap((list) => [...list]),
  ]);
  for (const slot of slots) {
    GAP_SLOTS_REGISTERED.add(slot);
    gapEntries.push({
      id: `${GAP_SLOT_PREFIX}${slot}`,
      source: 'authored_sheet',
      provenance: 'rules/sessionSlotCoverage.ts SessionSlot — the slots Sam named, '
        + 'rendered exactly as DayWorkoutScreenV2\'s slotWordFor already renders them.',
      text: slot.replace(/_/g, ' '),
    });
  }
  // THE AUTHORED LABEL, NOT THE RAW TAG. `EQUIPMENT_TAG_LABELS` is the
  // vocabulary the athlete ANSWERED with, so "that would need a cable machine"
  // rather than "that would need machine". `ComposedGapNotice` prints the raw
  // tag today; this reads better and is the one Sam asked to be understandable.
  // The divergence is real and is declared in the mission report rather than
  // hidden — it ends when the day screen consumes the projection, which is the
  // deletion this module has always been heading for.
  for (const [tag, label] of Object.entries(EQUIPMENT_TAG_LABELS)) {
    GAP_NEEDS_REGISTERED.add(tag);
    gapEntries.push({
      id: `${GAP_NEED_PREFIX}${tag}`,
      source: 'authored_sheet',
      provenance: 'rules/equipmentVocabulary.ts EQUIPMENT_TAG_LABELS — the authored '
        + 'label for each askable tag, the words the athlete answered with.',
      text: String(label),
    });
  }
  registerSignedCopy(gapEntries);
}


/**
 * THE ATHLETE'S SENTENCE FOR ONE BLOCK-BOUNDARY LOAD CHANGE.
 *
 * Renders Sam's signed sentence from a STORED explanation row — never from a
 * fresh derivation. That is the whole point: the row travelled with the
 * prescription through storage and reload, so the words and the number the
 * athlete reads came out of the same decision.
 *
 * Returns `null` for every row that is not a load INCREASE. A held load, an
 * authored estimate, a blank and a bodyweight default are not "moved from X to
 * Y", and the signed sentence must not be stretched over them — that would be a
 * call site authoring meaning it was not given.
 */
/**
 * THE MISSED-SESSION QUESTION AS THE ATHLETE READS IT.
 *
 * Rendered from the DERIVED question, never from a stored one — the numbers and
 * the sentence come out of the same read of the same facts, so they cannot drift
 * the way a stored sentence and a live count can.
 */
export function missedSessionCommitmentQuestionSentence(
  question: import('./weeklyCommitmentQuestion').WeeklyCommitmentQuestion,
): SignedCopy {
  registerProjectionCopy();
  return signedCopy(MISSED_SESSION_COMMITMENT_QUESTION_COPY_ID, {
    completed: question.completedPerWeek,
    planned: question.plannedPerWeek,
  });
}

/** One offered answer. Singular and plural are two entries, never one with an `s`. */
export function missedSessionCommitmentOptionLabel(count: number): SignedCopy {
  registerProjectionCopy();
  return signedCopy(
    count === 1
      ? MISSED_SESSION_COMMITMENT_OPTION_ONE_COPY_ID
      : MISSED_SESSION_COMMITMENT_OPTION_COPY_ID,
    { count },
  );
}

/**
 * THE EXTRA-SESSION OFFER AS THE ATHLETE READS IT.
 *
 * Takes the derived offer rather than no argument at all, so a surface cannot
 * render Sam's *"your schedule allows another session"* in a world where the
 * legality probe never said it did.
 */
export function extraSessionOfferSentence(
  _offer: import('./extraSessionOffer').ExtraSessionOffer,
): SignedCopy {
  registerProjectionCopy();
  return signedCopy(EXTRA_SESSION_OFFER_COPY_ID);
}

export function extraSessionOfferAcceptLabel(): SignedCopy {
  registerProjectionCopy();
  return signedCopy(EXTRA_SESSION_OFFER_ACCEPT_COPY_ID);
}

export function extraSessionOfferDeclineLabel(): SignedCopy {
  registerProjectionCopy();
  return signedCopy(EXTRA_SESSION_OFFER_DECLINE_COPY_ID);
}

/** *"Keep it as is"* — the shrinking direction's decline chip. */
export function missedSessionCommitmentDeclineLabel(): SignedCopy {
  registerProjectionCopy();
  return signedCopy(MISSED_SESSION_COMMITMENT_DECLINE_COPY_ID);
}

/** R-105's notification line. Announces a question; claims nothing. */
export function commitmentConversationNoticeSentence(): SignedCopy {
  registerProjectionCopy();
  return signedCopy(COMMITMENT_CONVERSATION_NOTICE_COPY_ID);
}

/**
 * A WEEKDAY NAME AND A DATE, AS SIGNED VALUES.
 *
 * `SignedCopyParam` is `number | SignedCopy` — a raw string cannot be a
 * parameter of a signed sentence, and that refusal is what stops a surface
 * posting unsigned words into the middle of one. These two are how a calendar
 * fact becomes a legal parameter.
 */
export function dayNameCopy(day: import('../types/domain').DayOfWeek): SignedCopy {
  registerProjectionCopy();
  return signedCopy(dayNameCopyId(day));
}

export function shortDateCopy(dateISO: string): SignedCopy {
  registerProjectionCopy();
  const [, month, day] = dateISO.slice(0, 10).split('-').map(Number);
  return signedCopy(SHORT_DATE_COPY_ID, { day, month });
}

/**
 * A SESSION COMPONENT'S NAME.
 *
 * ⚠ **IT THROWS ON AN UNKNOWN KIND, AND THAT IS DELIBERATE.** `signedCopy`
 * refuses rather than falling back, because a fallback would be a second source
 * of athlete-facing words. An eleventh `SessionComponentKind` therefore arrives
 * as a loud gap for Sam at the moment it is first rendered, not as a blank in
 * the middle of a sentence.
 */
export function sessionComponentName(kind: string): SignedCopy {
  registerProjectionCopy();
  return signedCopy(sessionComponentCopyId(kind));
}

/**
 * ONE PREVIEWED DAY, AS THE ATHLETE READS IT.
 *
 * ⚠ **THE ARM IS CHOSEN BY THE PREVIEW'S OWN `arrival`, NOT BY THIS FUNCTION.**
 * R-106 decides which sentence is true of a day, and that decision was already
 * taken by `commitmentChangePreview` against the regenerated program. A copy
 * function that re-decided it would be a second reader of the same fact.
 *
 * ⚠ **THE COMPONENT LIST IS JOINED BY `joinSignedCopy`, WITH SAM'S OWN " + ".**
 * `copy.joiner.plus` is the separator he gave in the compound-bucket ruling —
 * *"whatever the bucket is that day i.e. Strength or strength + conditioning"* —
 * and it is the app's one way to name a day made of two kinds of work. A
 * `.join()` here would be this file picking a separator, which is the exact
 * thing `joinSignedCopy` exists to refuse.
 */
export function commitmentPreviewDaySentence(
  day: import('./commitmentChangePreview').CommitmentPreviewDay,
): SignedCopy {
  registerProjectionCopy();
  const components = joinSignedCopy(
    day.components.map((kind) => sessionComponentName(kind)),
    'copy.joiner.plus',
  );
  if (day.arrival === 'new_training_date') {
    return signedCopy(COMMITMENT_PREVIEW_NEW_DAY_COPY_ID, {
      day: dayNameCopy(day.dayOfWeek),
      date: shortDateCopy(day.dateISO),
      components,
    });
  }
  // WHAT IS BEING ADDED, not what the day now holds — the athlete already knows
  // the rest. Set difference against the day's own recorded prior components, so
  // this cannot drift from what the preview measured against the rebuilt week.
  const existing = new Set(day.existingComponents);
  const addedKinds = day.components.filter((kind) => !existing.has(kind));
  return signedCopy(COMMITMENT_PREVIEW_COMBINED_DAY_COPY_ID, {
    day: dayNameCopy(day.dayOfWeek),
    date: shortDateCopy(day.dateISO),
    // A day whose components all already existed but whose CONTENT changed
    // reports the whole list rather than an empty one — an empty "adds" clause
    // would read as the app adding nothing while it rebuilt the day.
    added: joinSignedCopy(
      (addedKinds.length > 0 ? addedKinds : day.components)
        .map((kind) => sessionComponentName(kind)),
      'copy.joiner.plus',
    ),
    components,
  });
}

/** The honest floor when no preview could be built. Never a fallback description. */
export function commitmentPreviewUnavailableSentence(): SignedCopy {
  registerProjectionCopy();
  return signedCopy(COMMITMENT_PREVIEW_UNAVAILABLE_COPY_ID);
}

/**
 * *"Done."* — and the count is the DOOR's, not the tap's.
 *
 * `confirmWeeklyCommitment` returns `committed.sessionsPerWeek`, which is what
 * was actually written. Rendering the requested count instead is how a receipt
 * comes to describe a decision the app did not make.
 */
export function commitmentConfirmedSentence(committedSessionsPerWeek: number): SignedCopy {
  registerProjectionCopy();
  return signedCopy(COMMITMENT_CONFIRMED_COPY_ID, { count: committedSessionsPerWeek });
}

/** *"No problem"* — the decline, which changed nothing and says so. */
export function commitmentDeclinedSentence(): SignedCopy {
  registerProjectionCopy();
  return signedCopy(COMMITMENT_DECLINED_COPY_ID);
}

/** The transaction refused. The plan is untouched, because it rolled back. */
export function commitmentFailedSentence(): SignedCopy {
  registerProjectionCopy();
  return signedCopy(COMMITMENT_FAILED_COPY_ID);
}

export function blockBoundaryReducedSentence(
  row: import('./blockBoundaryProgression').BlockBoundaryExplanationRow,
): SignedCopy | null {
  registerProjectionCopy();
  if (row.kind !== 'hard_block_reduced') return null;
  // ⚠ THE SENTENCE'S OWN CLAIMS, CHECKED AGAINST THE STORED ROW.
  // A signed sentence is not a licence to say it in a world where it is false.
  // "kept your training weights" and "reduced the amount of work" are both
  // assertions about what this boundary DID, and the row is the only witness.
  if (!row.loadsHeld) return null;
  if (row.setsReduced.length === 0 && row.hardConditioningReplaced.length === 0) return null;
  return signedCopy(BLOCK_BOUNDARY_HARD_BLOCK_REDUCED_COPY_ID);
}

export function blockBoundaryLoadMovedSentence(
  row: import('./blockBoundaryProgression').BlockBoundaryExplanationRow,
): SignedCopy | null {
  // The sheet is registered lazily by `registerProjectionCopy`, and the exercise
  // NAME entries are registered there too — so a caller that reaches this
  // function before any projection has run would throw `unsigned_athlete_copy`
  // on a name that is perfectly legal. Registration is idempotent.
  registerProjectionCopy();
  if (row.kind !== 'history_progressed') return null;
  if (typeof row.previousLoadKg !== 'number' || typeof row.nextLoadKg !== 'number') return null;
  return signedCopy(BLOCK_BOUNDARY_LOAD_MOVED_COPY_ID, {
    exercise: signedCopy(exerciseNameCopyId(row.exerciseName)),
    oldWeight: row.previousLoadKg,
    newWeight: row.nextLoadKg,
  });
}

/**
 * Every block-boundary sentence for a stored program, in the explanation's own
 * order. Empty when the block changed no loads — which is a real answer and the
 * correct one for a first block or an athlete without qualifying history.
 */
/**
 * A REFUSED WEEK, IN THE ATHLETE'S WORDS — Sam's three lines, 2026-08-17.
 *
 *     We couldn't build a safe week from your current setup.
 *     <the exact typed refusal, in plain words>
 *     Update the relevant answer and try again.
 *
 * ## IT EXPLAINS A DECISION; IT DOES NOT MAKE ONE
 *
 * The input is the BLOCKING findings the contract already produced. Nothing here
 * decides whether to refuse, re-measures a week, or infers a cause. Sam's
 * boundary was explicit — *"do not invent new refusal logic"* — so a finding
 * arrives already typed and this hands back its sentence.
 *
 * ## EVERY BLOCKING CAUSE GETS ITS OWN LINE
 *
 * *"Do not collapse different causes into one generic message."* A week that
 * broke two clauses says both, in the order the contract found them, deduplicated
 * by clause so one clause failing on three days is still one sentence — that is
 * one CAUSE reported once, not two causes merged.
 *
 * ## `disclosed_gap` FINDINGS ARE NOT REFUSALS AND ARE NOT SHOWN HERE
 *
 * A disclosable clause fails without refusing the week (R-083: a pattern the kit
 * cannot train is not owed) and is already the athlete's business through
 * `VisibleDay.gaps`. Only `severity: 'blocking'` reaches this.
 *
 * Returns `[]` for no blocking findings — which never happens on a real
 * `GeneratedWeekRefusedError`, and if it ever did, the caller must treat an empty
 * list as "still refused, no words" rather than as success. `weekRefusalIsSpeakable`
 * below is that check, exported so a surface cannot forget it.
 */
export function weekRefusalSentences(
  findings: readonly { clause: string; severity: string }[],
): SignedCopy[] {
  registerProjectionCopy();
  const blocking = findings.filter((finding) => finding.severity === 'blocking');
  const seen = new Set<string>();
  const causes: string[] = [];
  for (const finding of blocking) {
    const clause = String(finding.clause);
    if (seen.has(clause)) continue;
    seen.add(clause);
    if (clause in REFUSAL_CLAUSE_COPY) causes.push(clause);
  }
  if (causes.length === 0) return [];
  return [
    signedCopy('week.refusal.lead'),
    ...causes.map((clause) => signedCopy(`week.refusal.clause.${clause}`)),
    signedCopy('week.refusal.fix'),
  ];
}

/**
 * CAN THIS REFUSAL BE SPOKEN? — the check that stops a refused week rendering
 * as an empty successful one.
 *
 * Sam, 2026-08-17: *"Guard that a typed refusal produces visible text and that
 * no refused week is presented as an empty successful program."* The second half
 * is the dangerous one: a caught refusal with nothing to say and no week to show
 * looks EXACTLY like a week with no sessions in it, and an athlete would read
 * "rest day, rest day, rest day" instead of "we could not build this".
 *
 * A surface that catches `GeneratedWeekRefusedError` asks this. `false` means the
 * app has a refusal it has no words for — a copy gap, loud, never a blank week.
 */
export function weekRefusalIsSpeakable(
  findings: readonly { clause: string; severity: string }[],
): boolean {
  return weekRefusalSentences(findings).length > 0;
}

export function blockBoundaryExplanationSentences(
  program: { blockBoundaryExplanation?: readonly import('./blockBoundaryProgression').BlockBoundaryExplanationRow[]; microcycles?: readonly { startDate?: string }[] },
  weekStartISO?: string,
): SignedCopy[] {
  const out: SignedCopy[] = [];
  for (const row of program.blockBoundaryExplanation ?? []) {
    if (row.kind === 'hard_block_reduced' && weekStartISO &&
      !reductionExplanationCoversWeek(row, weekStartISO, program.microcycles?.[0]?.startDate)) continue;
    // The reduction row leads the stored explanation, so its sentence leads the
    // athlete's list for free — the order is the decision's, not this loop's.
    // R-343's bodyweight_progressed row carries NO sentence (Sam, 2026-09-02:
    // the card's "BW + 2.5 kg" is the athlete's fact; a sentence nobody could
    // see was deleted rather than wired).
    const sentence = blockBoundaryReducedSentence(row) ?? blockBoundaryLoadMovedSentence(row);
    if (sentence) out.push(sentence);
  }
  return out;
}
