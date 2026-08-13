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

import { getExerciseTags, getAllTaggedExercises } from '../data/exerciseTags';
import { exerciseAllowedByEquipment } from '../data/exercisePoolsStrength';
import type { EquipmentTag } from '../data/exercisePools';
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
/**
 * WHICH LADDER A DAY ANSWERS TO, FROM ITS PLAN'S PATTERNS.
 *
 * The name-based `slotDayKindFor` reads a session TITLE; this reads the typed
 * plan intent, which is what the canonicaliser already has in hand. Same mapping,
 * same three ladders — a second heuristic here would be a second representation
 * of a question the plan has already answered.
 *
 * A MIXED day (lower AND upper patterns named) returns null: it answers to no
 * single ladder, and guessing one would let a real defect through under the
 * wrong rule. Callers treat null as "no ladder", which keeps the previous
 * behaviour rather than inventing one.
 */
export function slotDayKindForPatterns(
  intended: Iterable<MainStrengthPattern>,
): SlotDayKind | null {
  const named = new Set<MainStrengthPattern>(intended);
  if (named.size === 0) return null;
  const lower = named.has('squat') || named.has('hinge');
  const push = named.has('push');
  const pull = named.has('pull');
  if (lower && (push || pull)) return null;
  if (lower) return 'lower';
  if (push && pull) return 'upper_full';
  if (push) return 'upper_split_push';
  if (pull) return 'upper_split_pull';
  return null;
}

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
/**
 * Is this upper row an ACCESSORY in the app's own pools, not the day's anchor?
 *
 * ⚠ CANONICALISES FIRST, AND THAT IS NOT OPTIONAL — THIRD SIGHTING OF THE SAME
 * DEFECT IN ONE DAY. `classifyPoolSlot` is an EXACT-NAME lookup: the pool holds
 * `Face Pull` and the generator ships `Face Pulls`, so it returns `null` and the
 * row silently reads as "not an accessory". R-014 recorded this shape for
 * `getExerciseTags` (151 rows resolving to nothing) and that one has since been
 * fixed AT the lookup; `classifyPoolSlot` has the same hole and has NOT been.
 *
 * FIXED HERE RATHER THAN THERE, DELIBERATELY. Fixing `classifyPoolSlot` itself
 * is the better fix and is named as the next unit in `docs/STATUS_TERMINAL.md` —
 * but it feeds rotation and scoring, so turning its `null`s into answers changes
 * generated output and owes a corpus measurement this unit has not taken. A
 * local normalise is honest and has zero blast radius; a shared one taken blind
 * is how two fixes were already spent on layers not in the chain.
 */
function isUpperAccessory(name: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { classifyPoolSlot } = require('../data/exercisePoolsStrength') as {
    classifyPoolSlot: (n: string) => { slot: string; role: string } | null;
  };
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { canonicalExerciseName } = require('../utils/exerciseCanonicalisation') as {
    canonicalExerciseName: (raw: string) => string;
  };
  const direct = classifyPoolSlot(name);
  if (direct) return direct.role === 'accessory';
  return classifyPoolSlot(canonicalExerciseName(name))?.role === 'accessory';
}

export function slotsFilledByRow(row: WorkoutExercise): readonly SessionSlot[] {
  // Power, conditioning, team training and mobility are not strength slots.
  // They are exempt from counting for the same reason they cannot fill a slot.
  if (!participatesInCounting(row)) return [];
  const name = row.exercise?.name;
  if (!name) return [];
  return slotsForExerciseName(name);
}

/**
 * WHICH SLOTS THIS EXERCISE *NAME* CAN FILL — the tag half of `slotsFilledByRow`,
 * with the row-participation guards left behind.
 *
 * **Extracted 2026-08-13 (R-084) rather than copied.** `slotIsTrainableOnKit`
 * has to ask this question of a bare NAME out of the tag table, where there is
 * no row to guard. Duplicating the switch would have made a SECOND definition of
 * "what fills a slot", and this repo has already paid for one predicate growing
 * uncounted copies in other modules — the two answers would drift and the oracle
 * would disagree with its own availability test.
 */
export function slotsForExerciseName(name: string): readonly SessionSlot[] {
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
    // ── AN UPPER *ACCESSORY* IS ALSO HIS "ARM WORK OR ACCESSORY WORK" ───────
    //
    // Sam's split-day sentence is *"horizontal movement, vertical movement, more
    // arm work, more accessory work"* — so an upper day's third row is EXPECTED
    // to be accessory work, and it does not stop being a pull because of it.
    //
    // MEASURED 2026-08-13, and the day the oracle was wrong about is the app's
    // own pull day: `Pull-Ups + Barbell Row + Face Pulls` came back
    // `missing: [arm_or_shoulder], duplicated: [horizontal_pull]` — 12 times
    // across the sweep. **That day is fine.** It has a vertical, a horizontal and
    // shoulder accessory work, which is his sentence exactly.
    //
    // THE DISCRIMINATOR IS NOT A NEW OPINION — the pools already hold it.
    // `Barbell Row` is horizontal_pull **anchor**; `Face Pull` is horizontal_pull
    // **accessory**, sitting in the same list as `Rear Delt Fly` and
    // `Band Pull-Apart`. The app has always considered them the same kind of
    // thing; this rule reads that answer instead of inventing a second one.
    //
    // AND THE TAG IS DELIBERATELY NOT TOUCHED. Retagging `Face Pull` as
    // `isolation_upper` would change every reader — the pools, the scorer, the
    // injury filters — to fix one oracle. The row genuinely IS a horizontal pull;
    // it is ALSO shoulder work. Returning both is the honest answer, and it is
    // what `sessionSlotCoverage`'s assignment step is for.
    case 'horizontal_push':
    case 'horizontal_pull':
    case 'vertical_push':
    case 'vertical_pull': {
      const plane = tag.movement as SessionSlot;
      out.push(plane);
      if (isUpperAccessory(name)) out.push('arm_or_shoulder');
      break;
    }
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

/**
 * CAN THIS KIT TRAIN THIS SLOT AT ALL?
 *
 * **R-084 (Sam, 2026-08-13):** *"single leg hip thrust is an accessory"*, and
 * with it — *"leave it, they need a gym for that. Stop flagging the single-leg
 * hip slot as missing on a bodyweight kit — R-083 says that pattern is simply
 * unavailable, not a defect. And the single-leg hip pool being one exercise is
 * intentional: it's meant to repeat."*
 *
 * **DERIVED, NOT DECLARED.** It does not know the words "single leg hip". It
 * asks whether ANY tagged exercise that fills the slot is legal on the kit, so
 * the day Sam authors a bodyweight single-leg hip lift the exemption disappears
 * on its own, and a kit missing a rack stops owing whatever the rack was for.
 * **A hardcoded `if (slot === 'single_leg_hip' && bodyweight)` would have been
 * one line and would have gone stale the moment the pool changed** — the shape
 * this repo keeps paying for.
 *
 * **UNKNOWN KIT ANSWERS TRUE**, matching `exerciseAllowedByEquipment`: this
 * excuses only what it can PROVE the athlete cannot perform.
 */
export function slotIsTrainableOnKit(
  slot: SessionSlot,
  availableEquipment: readonly EquipmentTag[] | undefined,
): boolean {
  if (!availableEquipment) return true;
  return getAllTaggedExercises().some((name) =>
    slotsForExerciseName(name).includes(slot)
    && exerciseAllowedByEquipment(name, availableEquipment));
}

export interface SlotCoverage {
  readonly kind: SlotDayKind;
  readonly required: readonly SessionSlot[];
  readonly filled: readonly SessionSlot[];
  readonly missing: readonly SessionSlot[];
  /** Slots filled by MORE THAN ONE row — his "better served by a squat and a
   *  hinge than by two squats" is exactly a duplicate in one slot. */
  readonly duplicated: readonly SessionSlot[];
  /**
   * Slots this athlete's KIT cannot train at all (R-084 / R-083). Empty unless
   * `availableEquipment` is supplied.
   *
   * **NAMED, NOT SILENTLY DROPPED.** Sam's answer is *"they need a gym for
   * that"* — an honest "unavailable" and a quiet zero are the same number and
   * very different facts, and a slot that vanished without a word is how a real
   * composer gap would hide behind this exemption.
   */
  readonly unavailable: readonly SessionSlot[];
}

/**
 * Which of the day's slots are covered, which are missing, which are doubled.
 *
 * `availableEquipment` is OPTIONAL and omitting it preserves the previous
 * answer exactly — every existing caller passes two arguments.
 */
export function sessionSlotCoverage(
  rows: readonly WorkoutExercise[],
  kind: SlotDayKind,
  availableEquipment?: readonly EquipmentTag[],
): SlotCoverage {
  const declared = SLOTS_FOR_KIND[kind];
  // R-084: a slot the kit cannot train is not owed, so it is removed from the
  // requirement BEFORE assignment rather than subtracted from `missing` after —
  // otherwise it would still soak up a row in the matching step.
  const unavailable = declared.filter((slot) => !slotIsTrainableOnKit(slot, availableEquipment));
  const required = declared.filter((slot) => !unavailable.includes(slot));

  // ── IT ASSIGNS, IT DOES NOT TALLY ────────────────────────────────────────
  //
  // A row may fill more than one slot, and a TALLY cannot SPEND it on the slot
  // the day actually needs — it credits every slot the row could fill and then
  // calls the overlap a duplicate. That is how `Pull-Ups + Barbell Row + Face
  // Pulls` read as "missing arm work AND doubled horizontal pull" when it is a
  // complete day: the face pull was counted as a second row rather than spent as
  // the accessory.
  //
  // EXACT MATCHING, NOT GREEDY, AND THE CHOICE IS DELIBERATE. Greedy is
  // order-dependent — feed the same day's rows in a different order and it
  // answers differently — and this oracle has already been wrong twice in one
  // day. With at most 5 slots and a handful of rows, an augmenting-path search
  // is small and exact, so the answer cannot depend on row order.
  const candidates = rows.map((row) => {
    const slots = new Set(slotsFilledByRow(row));
    return required.filter((slot) => slots.has(slot));
  });
  const rowForSlot = new Map<SessionSlot, number>();
  const slotForRow = new Map<number, SessionSlot>();
  const assign = (slot: SessionSlot, seen: Set<number>): boolean => {
    for (let index = 0; index < candidates.length; index += 1) {
      if (!candidates[index].includes(slot) || seen.has(index)) continue;
      seen.add(index);
      const held = slotForRow.get(index);
      if (held === undefined || assign(held, seen)) {
        rowForSlot.set(slot, index);
        slotForRow.set(index, slot);
        return true;
      }
    }
    return false;
  };
  for (const slot of required) assign(slot, new Set<number>());

  const filled = required.filter((slot) => rowForSlot.has(slot));
  const missing = required.filter((slot) => !rowForSlot.has(slot));

  // A DUPLICATE IS A ROW WITH NOWHERE ELSE TO GO — his "two squats" shape. Two
  // rows that can ONLY fill the same required slot is the honest reading: a
  // second back squat has no other home, whereas a face pull does and is not a
  // duplicate of the row. Accessory and arm slots are exempt as before, because
  // two accessory rows are normal and are not what his sentence is about.
  const onlySlotCounts = new Map<SessionSlot, number>();
  for (const slots of candidates) {
    if (slots.length !== 1) continue;
    onlySlotCounts.set(slots[0], (onlySlotCounts.get(slots[0]) ?? 0) + 1);
  }
  const duplicated = required.filter((slot) =>
    slot !== 'accessory_or_core' && slot !== 'arm_or_shoulder'
    && (onlySlotCounts.get(slot) ?? 0) > 1);
  return { kind, required, filled, missing, duplicated, unavailable };
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
 * ⚠ THE GAP THAT WAS DECLARED HERE IS NOW CLOSED, AND IT WAS BIGGER THAN THE
 * DECLARATION SAID. This docstring recorded that the text owner returns NOTHING
 * for "Upper Body Strength" and "Full Body Strength". **Measured 2026-08-13 over
 * 6 generated worlds x 4 weeks: 46 of 94 strength days answered to no ladder,
 * and the commonest unjudged name was `Lower Body Strength` — 20 days — which
 * the declaration never mentioned.** A declared gap is a claim too, and this one
 * under-counted itself by the largest single name.
 *
 * THE FIX IS A DELEGATION, NOT THE REGEX THIS DOCSTRING REFUSED. Those three
 * strings are not vague prose: they are three of the seven rows in
 * `data/strengthSessionVariants.ts`, the authored set, and each states its own
 * `plannedPatterns`. So the AUTHORED SET ANSWERS FIRST and the text probes serve
 * only the names it does not hold (`Team Training + Upper Push`, engine focus
 * strings). No second representation is created: one owner answers for canonical
 * labels, the other for prose, and neither guesses at the other's job.
 *
 * ⚠ `Full Body Strength` IS STILL NOT JUDGED, AND THAT IS HONEST. Its authored
 * patterns are squat + push + pull, which is a MIXED day, and
 * `slotDayKindForPatterns` returns null for mixed by rule. **Sam has ruled a
 * lower ladder and an upper ladder; he has never ruled a full-body one**, and
 * inventing one here would be this seat writing product law. It stays unjudged
 * and is named as a question, not filled in.
 */
export function slotDayKindFor(sessionText: string | undefined): SlotDayKind | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { strengthVariantByLabel } = require('../data/strengthSessionVariants') as {
    strengthVariantByLabel: (label: string | undefined) => { plannedPatterns: readonly string[] } | null;
  };
  const authored = strengthVariantByLabel(sessionText?.trim());
  if (authored) {
    return slotDayKindForPatterns(authored.plannedPatterns as Iterable<MainStrengthPattern>);
  }
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
