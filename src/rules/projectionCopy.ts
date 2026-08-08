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
