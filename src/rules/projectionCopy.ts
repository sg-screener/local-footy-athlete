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
  type SignedCopy,
  type SignedCopyEntry,
} from './signedCopy';
import { STRENGTH_SESSION_VARIANTS } from '../data/strengthSessionVariants';
import { TEAM_ONLY_NAME } from '../utils/sessionNaming';
import { selectableExerciseNames } from '../data/selectableExerciseVocabulary';
import { buildCueText } from '../screens/home/dayWorkoutHelpers';
import { CONDITIONING_SUBSTITUTION_ROW_NAMES } from './conditioningFeasibility';
import {
  CONDITIONING_WARMUP_COPY,
  CONDITIONING_WARMUP_COPY_ID,
  CONDITIONING_WARMUP_ROW_NAME,
} from './conditioningSelection';
import { COACH_REVISION_TEMPLATE_ROW_NAMES } from '../utils/coachRevisionTemplates';

/**
 * Athlete-facing strength session name -> the `part.headline.strength.<id>`
 * entry that carries it. Built from the authored set, never transcribed, so a
 * variant added to `strengthSessionVariants.ts` gets an entry here for free.
 */
export const STRENGTH_HEADLINE_ID_BY_LABEL: ReadonlyMap<string, string> = new Map(
  STRENGTH_SESSION_VARIANTS.map((variant) => [
    variant.label,
    `part.headline.strength.${variant.id}`,
  ]),
);

export const BLOCK_BOUNDARY_LOAD_MOVED_COPY_ID = 'blockBoundary.loadMoved';
export const BLOCK_BOUNDARY_HARD_BLOCK_REDUCED_COPY_ID = 'blockBoundary.hardBlockReduced';
export const MISSED_SESSION_COMMITMENT_QUESTION_COPY_ID = 'blockBoundary.commitmentQuestion';
export const MISSED_SESSION_COMMITMENT_OPTION_COPY_ID = 'blockBoundary.commitmentOption';
export const MISSED_SESSION_COMMITMENT_OPTION_ONE_COPY_ID = 'blockBoundary.commitmentOptionOne';

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
      provenance: 'SIGNED — Sam, 2026-08-16, the approved meaning for the '
        + 'completed-but-very-hard block. Rendered only from a stored '
        + '`hard_block_reduced` row of TrainingProgram.blockBoundaryExplanation, '
        + 'and only when that row says the loads were in fact held and work was '
        + 'in fact reduced. Guard: test:block-two-difficult-missed.',
      text: 'You completed the last block, but it felt very hard and recovery was low, '
        + "so we've kept your training weights and reduced the amount of work in this "
        + 'block. You can change it if needed.',
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
    // ── The conditioning warm-up sentence — SIGNED, Sam 2026-08-05. ──
    // Imported from the emitter rather than transcribed, the same shape
    // `CONDITIONING_SUBSTITUTION_ROW_NAMES` uses below: the words exist once,
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
    {
      id: 'day.refusal.nothing_to_change',
      source: 'sam_ruling',
      provenance: 'NEW — proposed, Batch 6, Task 2. Shown when a day offers nothing to '
        + 'add, move or remove (`DayCapabilities.refusal`).',
      text: "There's nothing to change on this day.",
    },

    // ── The day card's eyebrow, and the drop-downs' meta line. ──
    //
    // UI MERGE SLICE 2, rulings 2 + 5. Sam's ruling 5 removes the "Today" badge
    // from the day screen and folds the same fact into the heading; his own
    // wording for the heading, signed on sight 2026-08-10 (*"yes thats the better
    // heading"*), is `TODAY'S SESSION - MON 10/8`.
    //
    // **THE DATE IS NOT REGISTERED HERE AND THAT IS DELIBERATE.** `MON` and
    // `10/8` are the card's EXISTING values — `day.short` and
    // `shortDayMonthLabel(day.date)`, rendered side by side at the top-left of
    // this same card before this slice. The eyebrow MOVES them; it does not
    // re-format them and it does not author a new date vocabulary. Registering
    // a date template here would create a SECOND way the app says what day it
    // is, which is the defect this module exists to stop.
    {
      id: 'day.card.eyebrow.today',
      source: 'signed_sentence',
      provenance: 'SIGNED — Sam, 2026-08-10, batch 32 of '
        + 'docs/COPY_SHEET_RULINGS_2026-07-30.md: "yes thats the better heading", '
        + 'answering the exact string quoted to him, "TODAY\'S SESSION - MON 10/8".',
      text: "TODAY'S SESSION",
    },
    {
      id: 'day.card.eyebrow.date_separator',
      source: 'signed_sentence',
      provenance: 'SIGNED — Sam, 2026-08-10, batch 32. The hyphen is HIS: the string '
        + 'he read and signed used "-", not the em dash this sheet uses elsewhere, '
        + 'and a signature is over the characters he saw.',
      text: ' - ',
      joiner: true,
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
      provenance: 'SIGNED — Sam, 2026-08-11 in the Codex UI merge task: Renee '
        + '"includes the mobility / warm up on the front review screen". The '
        + 'punctuation and casing follow the reference he asked the app to match.',
      text: 'Mobility / Warm-up',
    },
    {
      id: 'session.team_training.row',
      source: 'sam_ruling',
      provenance: 'SIGNED — Sam, 2026-08-11 in the Codex app task: "in the session '
        + 'view under team training it says club/field session it should just say '
        + 'Club session".',
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
    {
      id: 'day.change_card.heading',
      source: 'sam_ruling',
      provenance: 'NEW — PROPOSED, batch 33, UI merge slice 2, ruling 1. Read out of '
        + 'docs/design/LFA_UI_PROTOTYPE_2026-08-10.html, the prototype Sam signed the '
        + 'direction of. His words for the gap: "there\'s no text above the little '
        + 'buttons like rens said".',
      text: 'Need to make a change?',
    },
    {
      id: 'day.change_card.subline',
      source: 'sam_ruling',
      provenance: 'NEW — PROPOSED, batch 33, UI merge slice 2, ruling 1. The second '
        + 'line of the same panel in the signed prototype.',
      text: 'Update your status to modify your program.',
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

    // ── THE STATUS-UPDATE SHEET'S FIVE ANSWERS. SAM RULED THEM 2026-08-12. ──
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
    // SO THE RENAME STANDS AND `worse` STAYS. Five answers ship. "for now" is
    // his own word and is left as his — it is not read here as a plan to remove
    // it later, and nothing in the code is staged against that reading.
    //
    // THE COUNT IS PART OF THE SET. `test:my-status-modifiers` holds these five
    // ids AND their exact words, so a sixth answer cannot appear, and none of
    // the five can be silently reworded, without him saying so.
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
      provenance: 'REWORDED — Batch 7 (device-pass fix round, 2026-08-01). Was '
        + '"Recovery" (Batch 6, Task 2). Recovery is a charter-deleted type and its '
        + 'authored contents ARE the mobility flows, so the `recovery`-KIND parts '
        + 'that still exist (attached add-ons; athlete-placed legacy recovery '
        + 'sessions no deriver may rebuild) render the word for what their rows '
        + 'are. The part KIND is unchanged — this is a word, not a re-typing.',
      text: 'Mobility',
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
    // ── Conditioning equipment-substitution row names. ──
    //
    // Imported from `conditioningFeasibility.ts`'s own exported list, not
    // transcribed — see that module's `CONDITIONING_SUBSTITUTION_ROW_NAMES`
    // header for why this is a derivation rather than a hand-copied set.
    ...CONDITIONING_SUBSTITUTION_ROW_NAMES.map((name): SignedCopyEntry => ({
      id: exerciseNameCopyId(name),
      source: 'authored_sheet',
      provenance: 'rules/conditioningFeasibility.ts applyResolvedConditioningSubstitution '
        + '— authored equipment-substitution names, already shipping; not selectable '
        + 'generator vocabulary (see module header).',
      text: name,
    })),

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
  for (const name of selectableExerciseNames()) {
    exerciseEntries.push({
      id: exerciseNameCopyId(name),
      source: 'authored_sheet',
      provenance: 'data/selectableExerciseVocabulary.ts selectableExerciseNames() — the '
        + 'locked exercise vocabulary; exercise-name-literal-lock unit.',
      text: name,
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
export function blockBoundaryExplanationSentences(
  program: { blockBoundaryExplanation?: readonly import('./blockBoundaryProgression').BlockBoundaryExplanationRow[] },
): SignedCopy[] {
  const out: SignedCopy[] = [];
  for (const row of program.blockBoundaryExplanation ?? []) {
    // The reduction row leads the stored explanation, so its sentence leads the
    // athlete's list for free — the order is the decision's, not this loop's.
    const sentence = blockBoundaryReducedSentence(row) ?? blockBoundaryLoadMovedSentence(row);
    if (sentence) out.push(sentence);
  }
  return out;
}
