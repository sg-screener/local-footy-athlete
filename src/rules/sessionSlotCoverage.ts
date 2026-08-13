/**
 * SAM'S SLOT LAW — a session is the right size when its PATTERNS are covered.
 *
 * HIS RULING, 2026-08-13, verbatim:
 *   *"because the number of exercises is not important the total work being done
 *   evenly across the body is"*
 *   *"lower body strength should have a hinge, a squat, an single leg knee, a
 *   single leg hip, and accessory and/or some core"*
 *   *"and upper body strength day should have push pull on the horizontal, push
 *   pull on the vertical then should arm work or accessory work for the
 *   shoulders"*
 *   *"then you can throw power and stuff in there"*
 *
 * AND IT WAS ALREADY HIS BIBLE, `:227`, in fill order: *"heavy squat pattern ->
 * heavy hinge pattern -> single-leg knee-dominant -> single-leg hip-dominant ->
 * accessories. An athlete is better served by a squat and a hinge than by two
 * squats."* He said *"i thought this would have been explained by now"* — it had
 * been, and nothing read it. Registry R-014, census C7.
 *
 * WHY THIS IS A SEPARATE MODULE AND NOT A COUNTER. `SESSION_SIZE_FLOOR` asks
 * HOW MANY. He has ruled that question void: the count is a proxy, and a proxy
 * cannot tell a five-row session with two squats and no hinge from a five-row
 * session that covers the body. This asks WHICH, which is the thing he actually
 * cares about.
 *
 * PURE, AND READS THE SAME ORACLE THE REST OF THE APP READS. `getExerciseTags`
 * is the one pattern authority; it canonicalises names as of 2026-08-13, which
 * is what makes this buildable at all — before that, a Romanian Deadlift
 * resolved to NOTHING and a "no hinge" finding would have fired on a session
 * that had one.
 *
 * WHAT IT DOES NOT DO: it does not compose, reorder or repair a session. It
 * NAMES what is missing. The composer is the next unit and this is its oracle.
 */

import { getExerciseTags } from '../data/exerciseTags';
import type { WorkoutExercise } from '../types/domain';
import { participatesInCounting } from './sessionRowCounting';
import type { MainStrengthPattern } from './strengthPatternContributions';

/** The slots Sam named, in his fill order. */
export type SessionSlot =
  | 'squat'
  | 'hinge'
  | 'single_leg_knee'
  | 'single_leg_hip'
  | 'accessory_or_core'
  | 'horizontal_push'
  | 'horizontal_pull'
  | 'vertical_push'
  | 'vertical_pull'
  | 'arm_or_shoulder';

/** Which slot list a day answers to. Power is never a slot — it rides on top. */
export type SlotDayKind = 'lower' | 'upper_full' | 'upper_split_push' | 'upper_split_pull';

export const LOWER_SLOTS: readonly SessionSlot[] = [
  'squat', 'hinge', 'single_leg_knee', 'single_leg_hip', 'accessory_or_core',
];

/** A full upper day: both planes, both directions, plus arm/shoulder work. */
export const UPPER_FULL_SLOTS: readonly SessionSlot[] = [
  'horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'arm_or_shoulder',
];

/**
 * A push-ONLY or pull-ONLY day. His words: *"if you upper body pull or upper
 * body push then it just becomes horizontal movement, vertical movement, more
 * arm work, more accessory work"* — so the DIRECTION collapses and the two
 * PLANES remain. Expressed as "a horizontal and a vertical of that direction".
 *
 * **⚠ THERE ARE TWO OF THESE, AND HAVING ONE WAS A DEFECT IN THIS ORACLE.**
 * `UPPER_SPLIT_SLOTS` used to be a single constant holding the PUSH direction,
 * so a pull-only day was judged against push slots and **could never cover its
 * ladder**. Measured 2026-08-13 over 5 worlds x 4 weeks: every single
 * `Upper Pull` day reported `missing: [horizontal_push, vertical_push,
 * arm_or_shoulder]` — 12 of the 20 misses in the whole sweep were this bug, not
 * the app.
 *
 * **THE DOCSTRING ABOVE WAS ALREADY RIGHT — *"of that direction"* — and the
 * constant did not implement it.** R-014's own row records the same shape once
 * already: *"a day named 'Lower Hinge' appeared to contain NO hinge … the day
 * was fine and my instrument was not."* An oracle is a claim too, and a composer
 * built on this one would have tried to add bench press to a pull day.
 */
export const UPPER_SPLIT_PUSH_SLOTS: readonly SessionSlot[] = [
  'horizontal_push', 'vertical_push', 'arm_or_shoulder',
];

export const UPPER_SPLIT_PULL_SLOTS: readonly SessionSlot[] = [
  'horizontal_pull', 'vertical_pull', 'arm_or_shoulder',
];

export const SLOTS_FOR_KIND: Readonly<Record<SlotDayKind, readonly SessionSlot[]>> = {
  lower: LOWER_SLOTS,
  upper_full: UPPER_FULL_SLOTS,
  upper_split_push: UPPER_SPLIT_PUSH_SLOTS,
  upper_split_pull: UPPER_SPLIT_PULL_SLOTS,
};

/**
 * THE PATTERNS A DAY'S OWN LADDER ADMITS, given the patterns its PLAN named.
 *
 * **`intendedPatterns` names the day's MAIN LIFT, never its whole content.** A
 * plan entry that says `squat` is naming what the day is BUILT AROUND; Sam's
 * ladder for that same day then asks for a hinge, a single-leg knee, a single-leg
 * hip and an accessory. **So a row whose pattern COMPLETES the day's ladder is
 * not drift — it is the ladder.**
 *
 * WHY THIS EXISTS: `workoutCanonicalisation`'s `main_pattern_drift` guard
 * removed any main row whose pattern the plan had not named, which deleted the
 * hinge out of every fallback-built lower day — measured, exactly one line in the
 * away suite: `DRIFT-DROP "Deadlift" pattern=hinge intended=[squat]
 * workout="Lower Squat"`. `:227` and the drift guard were in direct
 * contradiction and the guard was winning, against *"an athlete is better served
 * by a squat and a hinge than by two squats."*
 *
 * **THIS IS NOT A SQUAT/HINGE SPECIAL CASE, and it was ordered not to be.** It
 * reads the SAME three ladders above that everything else in this file reads, so
 * the day kind decides:
 *
 * | day kind | derived from the plan's patterns | admits |
 * | --- | --- | --- |
 * | lower      | any of squat/hinge   | squat + hinge |
 * | upper full | BOTH push and pull   | push + pull |
 * | upper split| exactly one of them  | that direction ONLY |
 *
 * Only the lower row changes any behaviour today — the two upper rows already
 * admit exactly what they intend. That is the general rule landing on the one
 * place the census said it bites, and if Sam ever rules an upper ladder that
 * admits both directions, this follows him without another edit.
 *
 * **THE GUARD IS NOT WEAKENED WHERE IT EARNS ITS KEEP.** A bench press on a
 * squat day is still drift and still removed: `push` is in neither the lower
 * ladder nor a lower day's admission. What stops being drift is only work that
 * the day's own ladder was always asking for.
 *
 * A MIXED DAY takes the union of the halves it names — a day intending
 * `squat + push` admits the whole lower ladder and push, but NOT pull, because
 * its upper half is a split.
 */
export function patternsCompletingLadder(
  intended: Iterable<MainStrengthPattern>,
): ReadonlySet<MainStrengthPattern> {
  const named = new Set<MainStrengthPattern>(intended);
  const admitted = new Set<MainStrengthPattern>(named);
  if (named.size === 0) return admitted;
  // THE LOWER LADDER IS INDIVISIBLE. `LOWER_SLOTS` opens with squat AND hinge,
  // and its two single-leg slots are filled by rows that classify as one or the
  // other, so naming either half of a lower day names the whole ladder.
  if (named.has('squat') || named.has('hinge')) {
    admitted.add('squat');
    admitted.add('hinge');
  }
  // THE UPPER LADDER SPLITS, AND THAT IS SAM'S WORDING, NOT A SIMPLIFICATION:
  // *"if you upper body pull or upper body push then it just becomes horizontal
  // movement, vertical movement, more arm work"* — the DIRECTION collapses and
  // only the planes remain. So a push-only day never admits a pull, and the full
  // upper day needs no help because it already names both.
  return admitted;
}

/**
 * Which slots one row can fill. A row may fill MORE THAN ONE — a single-leg RDL
 * is both a hinge and a single-leg hip, and Sam's own example of a single-arm
 * press is deliberately two things at once (*"so you get some pushing and core
 * in at the same time"*). Returning a SET rather than one answer is what lets a
 * five-row session cover five slots.
 */
export function slotsFilledByRow(row: WorkoutExercise): readonly SessionSlot[] {
  // Power, conditioning, team training and mobility are not strength slots.
  // They are exempt from counting for the same reason they cannot fill a slot.
  if (!participatesInCounting(row)) return [];
  const name = row.exercise?.name;
  if (!name) return [];
  const tag = getExerciseTags(name);
  if (!tag) return [];
  const out: SessionSlot[] = [];
  const unilateral = tag.unilateral === true;

  // ⚠ A UNILATERAL LIFT FILLS ITS SINGLE-LEG SLOT AND NOT THE BILATERAL ONE.
  //
  // FOUND BY USING THIS RULE ON SAM'S OWN FILL ORDER. The first version had a
  // unilateral hinge fill BOTH `hinge` and `single_leg_hip`, so a day built
  // exactly to `:227` — heavy hinge, squat, single-leg knee, single-leg RDL,
  // accessory — reported `duplicated: [hinge]`. It flagged his own prescription.
  //
  // The model was self-contradictory: his list REQUIRES a heavy hinge AND a
  // single-leg hip lift, and a single-leg hip lift IS a hinge. Counting the
  // overlap as a duplicate made the two requirements impossible to satisfy at
  // once. It also let a day with ONLY a single-leg RDL claim the heavy-hinge
  // slot, which his fill order plainly separates.
  switch (tag.movement) {
    case 'squat':
      if (unilateral) out.push('single_leg_knee');
      else out.push('squat');
      break;
    case 'lunge':
      // A lunge IS the single-leg knee-dominant slot — that is what the pattern
      // means. It is not a bilateral squat and never fills the squat slot.
      out.push('single_leg_knee');
      break;
    case 'hinge':
      if (unilateral) out.push('single_leg_hip');
      else out.push('hinge');
      break;
    case 'horizontal_push': out.push('horizontal_push'); break;
    case 'horizontal_pull': out.push('horizontal_pull'); break;
    case 'vertical_push': out.push('vertical_push'); break;
    case 'vertical_pull': out.push('vertical_pull'); break;
    case 'isolation_upper': out.push('arm_or_shoulder'); break;
    case 'isolation_lower':
    case 'core':
    case 'carry':
      out.push('accessory_or_core');
      break;
    default:
      break;
  }
  return out;
}

export interface SlotCoverage {
  readonly kind: SlotDayKind;
  readonly required: readonly SessionSlot[];
  readonly filled: readonly SessionSlot[];
  readonly missing: readonly SessionSlot[];
  /** Slots filled by MORE THAN ONE row — his "better served by a squat and a
   *  hinge than by two squats" is exactly a duplicate in one slot. */
  readonly duplicated: readonly SessionSlot[];
}

/** Which of the day's slots are covered, which are missing, which are doubled. */
export function sessionSlotCoverage(
  rows: readonly WorkoutExercise[],
  kind: SlotDayKind,
): SlotCoverage {
  const required = SLOTS_FOR_KIND[kind];
  const counts = new Map<SessionSlot, number>();
  for (const row of rows) {
    for (const slot of slotsFilledByRow(row)) {
      counts.set(slot, (counts.get(slot) ?? 0) + 1);
    }
  }
  const filled = required.filter((slot) => (counts.get(slot) ?? 0) > 0);
  const missing = required.filter((slot) => (counts.get(slot) ?? 0) === 0);
  // A duplicate only matters on a slot the day is trying to fill; two accessory
  // rows are normal and are not what his sentence is about.
  const duplicated = required.filter((slot) =>
    slot !== 'accessory_or_core' && slot !== 'arm_or_shoulder' && (counts.get(slot) ?? 0) > 1);
  return { kind, required, filled, missing, duplicated };
}

/**
 * WHICH SLOT LIST A DAY ANSWERS TO — DELEGATED, NEVER RE-INFERRED.
 *
 * `sessionNaming.inferStrengthMovementPatterns` is this app's ONE owner of
 * "what movement is this session about". The first cut of this module matched
 * `/lower/` and `/upper/` in the test itself, which would have been a SECOND
 * representation of a question already answered — the exact defect the coach
 * rules call out ("how many representations of the user request exist?").
 *
 * THE MAPPING IS HIS SENTENCE, NOT A HEURISTIC:
 *   squat or hinge          -> a LOWER day, and his five lower slots apply
 *   push AND pull           -> a FULL upper day, both planes both directions
 *   push XOR pull           -> a SPLIT day; *"if you upper body pull or upper
 *                              body push then it just becomes horizontal
 *                              movement, vertical movement, more arm work"*
 *
 * ⚠ AND THE OWNER HAS A GAP I AM NOT PAPERING OVER. It returns NOTHING for
 * "Upper Body Strength" and "Full Body Strength" — two of Sam's own seven signed
 * strength sessions (Bible §20.5). Those days therefore get NO slot list and are
 * not judged. Adding a regex here to catch them would put the second
 * representation back; the fix belongs in the owner, and it is named in the
 * registry rather than hidden behind a local patch.
 */
export function slotDayKindFor(sessionText: string | undefined): SlotDayKind | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { inferStrengthMovementPatterns } = require('../utils/sessionNaming') as {
    inferStrengthMovementPatterns: (text: string | undefined) => readonly string[];
  };
  const patterns = inferStrengthMovementPatterns(sessionText);
  if (patterns.includes('squat') || patterns.includes('hinge')) return 'lower';
  const push = patterns.includes('push');
  const pull = patterns.includes('pull');
  if (push && pull) return 'upper_full';
  // THE DIRECTION IS CARRIED, NOT DISCARDED. It was already known here and
  // thrown away, which is what made every pull day unsatisfiable.
  if (push) return 'upper_split_push';
  if (pull) return 'upper_split_pull';
  return null;
}
