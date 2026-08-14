/**
 * THE COMPOSER — slice B1, checkpoint 1. `composeWeek(inputs) -> ComposedWeek`,
 * a PURE function: no store, no clock, no network, no logging.
 *
 * **WHAT IT REPLACES.** `fallbackExercisesForPlanEntry` (`defaultProgram.ts:1065`)
 * — fifteen hardcoded branches, eleven returning exactly three rows into a
 * five-slot ladder. Written as the COMPLETION path for days the AI omitted, it
 * became the sole author of every composed strength row when R-091 severed the
 * AI. The 2026-08-14 baseline measured what that ships: 126 of 318 laddered days
 * miss Sam's ladder.
 *
 * **SLOTS, THEN ROWS — never rows, then hope.** A day declares which of Sam's
 * slots it owes, the slots the KIT cannot train are dropped (R-083), and each
 * surviving slot is filled from the authorised pools. A row is never selected
 * before the slot that wants it is named, which is the whole difference from a
 * hardcoded list: the list could not say what it was missing.
 *
 * **NO REPAIR.** Nothing here reacts to a later verdict. An unfillable slot is a
 * TYPED, DISCLOSED gap (clause e), never patched by a restore pass, a rotation
 * rewrite or a top-up. Kill criterion 1 of this slice is the composer needing
 * even one post-composition repair to be safe.
 *
 * **NO CONDITIONING** (taken from the existing adapter unchanged), and **NO
 * `history` OR `decisions` INPUT** — both are deliberately absent until the
 * slice that gives each a reader (B2; the authorship slice). A field with no
 * reader is the `canOverride` shape: written nine times, read zero.
 */
import {
  SLOTS_FOR_KIND,
  slotsForExerciseName,
  type SessionSlot,
  type SlotDayKind,
} from './sessionSlotCoverage';
import {
  composedIdentityFor,
  composedRowGapReason,
  composedRowIsLegal,
  type ComposedExerciseIdentity,
} from './composedRowLegality';
import type { MainStrengthPattern, StrengthIntent } from './strengthPatternContributions';
import {
  STRENGTH_POOLS,
  type ComposedDoseCategory,
  type PoolSlotKey,
} from '../data/exercisePoolsStrength';
import { resolveComposedDose, resolveComposedLoad } from './composedDose';
import type { OffseasonSubphase } from './offseasonSubphase';
import type { OnboardingData, SeasonPhase } from '../types/domain';
import { selectableExerciseNames } from '../data/selectableExerciseVocabulary';

// ─── INPUTS. Every field has a reader in CP1, or it does not exist yet. ─────

export interface ComposerPlannedDay {
  readonly dayOfWeek: number;
  /** Is the club running a session on this day? Read by the full-body shape. */
  readonly isTeamDay: boolean;
  readonly planEntryId: string;
  readonly strengthIntent: StrengthIntent;
  /** The planner's own name and tier. Composition never renames a day. */
  readonly name: string;
  readonly workoutType: string;
  readonly sessionTier: string;
}

/** Injury as FACTS, not as an outcome. */
export interface ComposerInjuryInput {
  readonly prohibitedPatterns: readonly MainStrengthPattern[];
  readonly excludedIdentities: readonly string[];
}

export interface ComposerInputs {
  /**
   * The athlete's answers. Read for season phase, experience level AND — since
   * B1-M1-COMPLETION — the base working load, which `estimateStartingWeight`
   * derives from his own strength answers and bodyweight.
   */
  readonly profile: OnboardingData;
  /** Read for the week number that moves selection along the authored order. */
  readonly phaseClock: { readonly weekNumber: number };
  /** B1-M1: the phase the DOSE is resolved against, before authorship. */
  readonly seasonPhase: SeasonPhase;
  readonly offseasonSubphase: OffseasonSubphase | null;
  /** Calendar/fixtures, as the planner resolved them onto days. */
  readonly plannedDays: readonly ComposerPlannedDay[];
  /** Resolved kit tags — the corrected sheet is the oracle, this is its input. */
  readonly kit: readonly string[];
  readonly injuries: ComposerInjuryInput;
  /** Read to stamp the week the composed days belong to. */
  readonly todayISO: string;
}

// ─── OUTPUT ────────────────────────────────────────────────────────────────

export type ComposedRowRole = 'main_strength' | 'strength_accessory';

export interface ComposedRow {
  /** Clause (b): ONE identity for selection, legality, storage and comparison. */
  readonly identity: ComposedExerciseIdentity;
  readonly slot: SessionSlot;
  readonly role: ComposedRowRole;
  readonly mainStrengthPattern: MainStrengthPattern | null;
  /** B1-M1: the typed dose owner (Sam's U-1/U-3/U-4), authored on the pool entry. */
  readonly doseCategory: ComposedDoseCategory;
  readonly sets: number;
  readonly repsMin: number;
  readonly repsMax: number;
  /** Resolved before authorship; U-2's off-season cut is already inside it. */
  readonly load: number;
  readonly qualityLimit?: 'stop_when_speed_or_technique_drops';
}

/** Clause (e): a kit-caused gap — derived from kit + sheet, never from records. */
export interface ComposedGap {
  readonly dayOfWeek: number;
  readonly slot: SessionSlot;
  readonly cause: 'kit';
  readonly wouldNeed: string | null;
  /**
   * SET WHEN THE SLOT WAS DROPPED BUT ITS PATTERN SURVIVED IN THE OTHER PLANE.
   * Sam, 2026-08-14, asked what to do when the opposite pull plane is
   * impossible: *"yes repeat achievable pull plane"*. The repeat is the answer;
   * this field is the disclosure that goes with it, so a repeated plane is never
   * mistaken for the app forgetting the other one.
   */
  readonly repeatedPlaneInstead?: SessionSlot;
}

/**
 * The shape a composed day answers to — **the LADDER OWNER'S own vocabulary, not
 * a second one beside it.** This was `SlotDayKind | 'full_body_a' | 'full_body_b'`
 * while the composer held the full-body lists privately; the two extra members
 * are now `SlotDayKind` members, so `SLOTS_FOR_KIND[kind]` answers for every
 * shape the composer can build and the union cannot drift from the table again.
 */
export type ComposedDayShape = SlotDayKind;

export interface ComposedDay {
  readonly dayOfWeek: number;
  readonly planEntryId: string;
  readonly name: string;
  readonly workoutType: string;
  readonly sessionTier: string;
  readonly kind: ComposedDayShape;
  readonly requiredSlots: readonly SessionSlot[];
  readonly rows: readonly ComposedRow[];
}

/** Clause (d): what the planner asked for, and what composition delivered. */
export interface ComposedSessionCount {
  readonly requested: number;
  readonly composed: number;
  readonly adjustment:
    | null
    | readonly { readonly reason: 'no_trainable_slot_on_this_kit'; readonly dayOfWeek: number }[];
}

export interface ComposedWeek {
  readonly weekStartISO: string;
  readonly days: readonly ComposedDay[];
  readonly gaps: readonly ComposedGap[];
  readonly sessionCount: ComposedSessionCount;
  /** Clause (a)'s input, derived here so ONE deriver serves contract and rows. */
  readonly kitUnachievablePatterns: readonly MainStrengthPattern[];
}

// ─── THE AUTHORISED OPTION SET ─────────────────────────────────────────────

/**
 * WHICH EXERCISES EXIST — `selectableExerciseNames()`, the app's own single
 * owner of pool membership, joined to Sam's ladder slots by
 * `slotsForExerciseName`. **Exactly the denominator `POOL_CENSUS_2026-08-14`
 * measured**, so the composer needs no table of its own; a second table would be
 * a second authority on a derived fact.
 *
 * ⚠ INSERTION ORDER IS KEPT, NEVER SORTED. The pools are authored in Sam's
 * preference order — `Bench Press > Incline Bench > Close Grip Bench` — and
 * alphabetising destroys it. Sorting made week 1 open on a Close Grip Bench.
 */
let candidatesBySlot: Map<SessionSlot, ComposedExerciseIdentity[]> | null = null;

function slotCandidates(slot: SessionSlot): readonly ComposedExerciseIdentity[] {
  if (!candidatesBySlot) {
    const built = new Map<SessionSlot, ComposedExerciseIdentity[]>();
    for (const raw of selectableExerciseNames()) {
      const identity = composedIdentityFor(raw);
      for (const filled of slotsForExerciseName(identity)) {
        const list = built.get(filled) ?? [];
        if (!list.includes(identity)) list.push(identity);
        built.set(filled, list);
      }
    }
    candidatesBySlot = built;
  }
  return candidatesBySlot.get(slot) ?? [];
}

/**
 * The six ladder slots that are also POOL slots. A MAIN LIFT comes from the
 * slot's ANCHOR entries: Sam's pools already separate the lift a day is built
 * around from the work supporting it, and a main lift drawn off the accessory
 * bench opens a full-gym day with a `Scap Push-Up`. The other four ladder slots
 * never carry a main lift.
 */
const POOL_SLOT_FOR_LADDER_SLOT: Partial<Record<SessionSlot, PoolSlotKey>> = {
  squat: 'squat',
  hinge: 'hinge',
  horizontal_push: 'horizontal_push',
  vertical_push: 'vertical_push',
  horizontal_pull: 'horizontal_pull',
  vertical_pull: 'vertical_pull',
};

/**
 * ⚠ ANCHORS FIRST, THEN THE REST — AND THE FALLBACK IS THE WHOLE POINT.
 *
 * A main lift comes off the slot's ANCHOR bench because that is where Sam put
 * the lift a day is built around. **But an anchor list is not the pattern.**
 * Every squat anchor is a barbell lift, so returning anchors alone made the
 * composer declare `squat` KIT-UNACHIEVABLE for a dumbbell athlete who can do a
 * `Goblet Squat`, and for an away athlete who can do a `Bodyweight Squat` —
 * removing a pattern R-083 never removed, and inventing a gap that is not one.
 *
 * The order IS the preference Sam ruled: *"weighted versions remain preferable
 * when the kit allows"*. Anchors are the weighted ones and they come first; the
 * rest of the slot follows and is only reached when no anchor is legal.
 */
/**
 * ⚠ SAM'S WEIGHTED PREFERENCE, EXPRESSED THROUGH THE POOL'S OWN FIELD.
 *
 * *"yes i'd prefer weighted exercises"* (2026-08-14). `PoolEntry.loadRatio` is
 * already the authored answer to "does this carry external load" — `0` means it
 * does not — so the preference needs no new list and no new judgement here.
 * Within each tier the authored order is preserved; only the unloaded entries
 * move to the back. Measured: this is what puts `Goblet Squat` ahead of
 * `Bodyweight Squat` for a dumbbell athlete.
 */
const UNLOADED_POOL_IDENTITIES: ReadonlySet<ComposedExerciseIdentity> = new Set(
  (Object.keys(STRENGTH_POOLS) as PoolSlotKey[]).flatMap((poolSlot) =>
    [...STRENGTH_POOLS[poolSlot].anchor.entries, ...STRENGTH_POOLS[poolSlot].accessory.entries]
      .filter((entry) => entry.loadRatio === 0)
      .map((entry) => composedIdentityFor(entry.name))));

function weightedFirst(
  identities: readonly ComposedExerciseIdentity[],
): ComposedExerciseIdentity[] {
  return [
    ...identities.filter((id) => !UNLOADED_POOL_IDENTITIES.has(id)),
    ...identities.filter((id) => UNLOADED_POOL_IDENTITIES.has(id)),
  ];
}

/**
 * ⚠ A POOL ENTRY IS NOT AUTOMATICALLY A LADDER-SLOT CANDIDATE. The squat pool's
 * accessory bench holds `Walking Lunges`, which fills `single_leg_knee` and not
 * `squat`; taking pool order without this filter offered a lunge as a squat.
 * `slotsForExerciseName` stays the single owner of what fills a slot.
 */
function poolOrderedFor(
  slot: SessionSlot,
  entries: readonly { name: string }[],
): ComposedExerciseIdentity[] {
  const eligible = new Set(slotCandidates(slot));
  return entries.map((entry) => composedIdentityFor(entry.name))
    .filter((id) => eligible.has(id));
}

/**
 * ANCHORS FIRST, THEN THE POOL'S ACCESSORY BENCH, THEN THE REST — and weighted
 * before unloaded inside each. An anchor list is not the pattern: every squat
 * anchor is a barbell lift, so returning anchors alone made the composer call
 * `squat` KIT-UNACHIEVABLE for a dumbbell athlete who can Goblet Squat.
 */
function anchorCandidates(slot: SessionSlot): readonly ComposedExerciseIdentity[] {
  const poolSlot = POOL_SLOT_FOR_LADDER_SLOT[slot];
  if (!poolSlot) return weightedFirst(slotCandidates(slot));
  const pool = STRENGTH_POOLS[poolSlot];
  const ordered = [
    ...poolOrderedFor(slot, pool.anchor.entries),
    ...poolOrderedFor(slot, pool.accessory.entries),
  ];
  const rest = slotCandidates(slot).filter((id) => !ordered.includes(id));
  return weightedFirst([...ordered, ...rest]);
}

/**
 * A SUPPORTING ROW COMES OFF THE ACCESSORY BENCH FIRST. Same reason the main
 * lift comes off the anchors: the pools already carry the distinction, and
 * ignoring it made a full-gym vertical push open on a `Bottoms-Up KB Press`.
 */
function supportCandidates(slot: SessionSlot): readonly ComposedExerciseIdentity[] {
  const poolSlot = POOL_SLOT_FOR_LADDER_SLOT[slot];
  if (!poolSlot) return weightedFirst(slotCandidates(slot));
  const pool = STRENGTH_POOLS[poolSlot];
  const ordered = [
    ...poolOrderedFor(slot, pool.accessory.entries),
    ...poolOrderedFor(slot, pool.anchor.entries),
  ];
  const rest = slotCandidates(slot).filter((id) => !ordered.includes(id));
  return weightedFirst([...ordered, ...rest]);
}

/**
 * The pattern a ladder slot contributes, for ROLE assignment only. Sam's ruling
 * names six patterns that "get the main lift role there"; `accessory_or_core`
 * and `arm_or_shoulder` name none, which is why they are absent rather than
 * mapped to something convenient.
 */
const PATTERN_FOR_SLOT: Partial<Record<SessionSlot, MainStrengthPattern>> = {
  squat: 'squat',
  hinge: 'hinge',
  single_leg_knee: 'single_leg_knee',
  single_leg_hip: 'single_leg_hip',
  horizontal_push: 'push',
  vertical_push: 'push',
  horizontal_pull: 'pull',
  vertical_pull: 'pull',
};

const ALL_SLOTS = Object.keys(PATTERN_FOR_SLOT) as SessionSlot[];

/**
 * PATTERNS THIS KIT CANNOT TRAIN AT ALL — derived from kit + sheet, never from a
 * record of what some past week contained. Clause (a) feeds it to the contract
 * and clause (e) turns the same answer into the athlete's gap: **one deriver,
 * two readers**, because computing it twice is how the contract and the week
 * came to disagree in the first place.
 */
export function kitUnachievablePatterns(
  kit: readonly string[],
): readonly MainStrengthPattern[] {
  const out: MainStrengthPattern[] = [];
  for (const pattern of new Set(Object.values(PATTERN_FOR_SLOT))) {
    if (!pattern) continue;
    const trainable = ALL_SLOTS
      .filter((slot) => PATTERN_FOR_SLOT[slot] === pattern)
      .some((slot) => slotCandidates(slot).some((id) => composedRowIsLegal(id, kit)));
    if (!trainable) out.push(pattern);
  }
  return out;
}

/**
 * ── SAM'S FULL-BODY SHAPE, 2026-08-14, verbatim ───────────────────────────
 *
 * *"either way i'd make them full body sessions. Squat and single leg hip with
 * push and pull + accessories then hinge and single leg knee with push and pull
 * (in opposite plane to earlier in week) + accessories - but the ideal would be
 * to do full body strength on different nights"*
 *
 * **IT APPLIES WHERE THE ATHLETE HAS NO OTHER NIGHT.** The trigger is a TYPED
 * FACT about the plan — every strength day the planner placed is also a club
 * night — not a world, a kit or a phase. An athlete with a free night is not in
 * this case, and his stated ideal (full-body strength on different nights) is
 * approved direction that CP2 does not implement and does not claim.
 *
 * **WHAT IT OVERRULES.** The planner's own answer for this case was upper-only,
 * because every night is a team night and a squat day cannot be placed. Sam has
 * overruled that: the two sessions become full body, and the lower work rides
 * on the club nights with them.
 *
 * **THE TWO SLOT LISTS MOVED TO `sessionSlotCoverage` ON 2026-08-14 AND THIS
 * FILE NOW IMPORTS THEM.** They lived here, privately, which meant the composer
 * knew a ladder the LADDER OWNER did not — so every instrument that asks "which
 * slots does this day owe" judged a composed full-body day against a lower or
 * upper ladder it was never built to satisfy. Measured: 24 of the 28 deficient
 * laddered days in the 180-world sweep were that, and none of them was a missing
 * exercise. Sam's sentence is quoted at the new home, once.
 */

/** The other plane of the same pattern. Used only for the kit-relative fallback. */
const OPPOSITE_PLANE: Partial<Record<SessionSlot, SessionSlot>> = {
  horizontal_push: 'vertical_push',
  vertical_push: 'horizontal_push',
  horizontal_pull: 'vertical_pull',
  vertical_pull: 'horizontal_pull',
};

/**
 * ⚠ THE KIT OUTRANKS THE PLANE PREFERENCE, AND SAM RULED THE FALLBACK HIMSELF.
 *
 * Asked what session B should do when its opposite pull plane cannot be trained
 * on the athlete's kit, he said: *"yes repeat achievable pull plane"*. So the
 * order is: the session's preferred plane if the kit can train it; otherwise the
 * OTHER plane, repeating what the week already used; otherwise nothing, and the
 * pattern is removed and disclosed under R-083/R-090.
 *
 * **NEVER AUTHOR AN ILLEGAL ROW TO MANUFACTURE PLANE VARIETY.** R-083 removes a
 * pattern the kit cannot train; a "variety" that ships a Pull-Up to a bodyweight
 * athlete is the exact defect that ruling exists to stop.
 */
function resolvePlane(
  preferred: SessionSlot,
  kit: readonly string[],
  excluded: ReadonlySet<string>,
): { readonly slot: SessionSlot | null; readonly dropped: readonly SessionSlot[] } {
  const hasLegal = (slot: SessionSlot): boolean =>
    slotCandidates(slot).some((id) => !excluded.has(id) && composedRowIsLegal(id, kit));
  if (hasLegal(preferred)) return { slot: preferred, dropped: [] };
  const other = OPPOSITE_PLANE[preferred];
  if (other && hasLegal(other)) return { slot: other, dropped: [preferred] };
  return { slot: null, dropped: other ? [preferred, other] : [preferred] };
}

/**
 * IS THIS PLANNED DAY A STRENGTH DAY THE COMPOSER OWNS?
 *
 * **The question `composedDayKind !== null` used to answer, and can no longer.**
 * A `full_body` day now returns null there — because A-versus-B is the WEEK's
 * choice, not the day's — so using that null as "not a strength day" silently
 * dropped every full-body day out of the week AND out of
 * `sessionCount.requested`. The two questions were always different; only the
 * full-body case made the difference visible.
 */
function composedDayIsStrength(intent: StrengthIntent): boolean {
  return intent.archetype === 'full_body' || composedDayKind(intent) !== null;
}

/** The planner's strength days, in order. One definition, three readers below. */
function composedStrengthDays(
  plannedDays: readonly ComposerPlannedDay[],
): readonly ComposerPlannedDay[] {
  return plannedDays.filter((day) => composedDayIsStrength(day.strengthIntent));
}

/**
 * DOES THIS WEEK TAKE SAM'S FULL-BODY A/B SHAPE? Decided once for the WEEK,
 * because A and B alternate and a day cannot know which it is.
 *
 * **THERE ARE TWO RULINGS BEHIND THIS AND IT USED TO ENFORCE ONLY ONE.**
 *
 *  1. **Every strength night is a club night** (Sam, 2026-08-14): *"either way
 *     i'd make them full body sessions"*. The athlete has no free night, so the
 *     lower work rides on the club nights.
 *  2. **THE WEEK HAS ONLY TWO STRENGTH SESSIONS** — Bible `:94`, verbatim: *"if
 *     can only do 2 strength sessions should be 2 x full body and those sessions
 *     should be pretty solid"*. **This one was missing**, and it is not
 *     conditional on the club: a two-session athlete with two FREE nights got
 *     whatever split the planner happened to name, which is the case `:94`
 *     answers directly.
 *
 * THE UNION, NOT A REPLACEMENT. Restricting to (2) would regress a three-session
 * week whose every night is a club night, which (1) already covers; enforcing
 * only (1) is what left `:94` unread. Both are Sam's and both are cited.
 */
export function composedWeekIsFullBodyOnClubNights(
  plannedDays: readonly ComposerPlannedDay[],
): boolean {
  const strengthDays = composedStrengthDays(plannedDays);
  if (strengthDays.length === 0) return false;
  // Bible `:94` — two strength sessions are two full-body sessions.
  if (strengthDays.length === 2) return true;
  return strengthDays.every((day) => day.isTeamDay);
}

// ─── THE AUTHORED DOSE — transcribed, not invented ─────────────────────────

/**
 * ⚠ THE EXISTING AUTHORED DOSES, POSITION FOR POSITION, from
 * `fallbackExercisesForPlanEntry`'s combined branches (`defaultProgram.ts:1186-1224`).
 * Composition changes WHICH exercises a day carries, not how hard they are:
 * **the authored dose bounds progression**, and rewriting it to something tidier
 * would be a dose change nobody ordered in a slice about composition.
 */
const LOWER_DOSE = [[3, 5, 8], [2, 8, 10], [3, 8, 12], [2, 8, 12], [2, 8, 12]] as const;
const UPPER_DOSE = [[3, 5, 8], [3, 8, 10], [2, 8, 10], [2, 8, 12], [2, 12, 15]] as const;

/**
 * ⚠ THE FULL-BODY DOSE IS BY SLOT, NOT BY POSITION, because this shape carries
 * FOUR main lifts and a position ladder would taper the fourth into an
 * accessory. Bible `:94` on exactly this athlete: *"if can only do 2 strength
 * sessions should be 2 x full body and those sessions should be pretty solid"* —
 * so the main lifts open at the same 3 x 5-8 every other composed main lift gets.
 *
 * **REGULAR LOADS (Sam, 2026-08-14: "no just make it regular loads").** Nothing
 * here asks whether the day is a club night. The dose a full-body session gets
 * on a team night is the dose it would get on any other night, and the cell
 * `regular loads: a club night does not reduce the dose` holds that by
 * composing the same day both ways and comparing.
 */
const FULL_BODY_DOSE: Partial<Record<SessionSlot, readonly [number, number, number]>> = {
  squat: [3, 5, 8],
  hinge: [3, 5, 8],
  single_leg_hip: [3, 8, 12],
  single_leg_knee: [3, 8, 12],
  horizontal_push: [3, 8, 10],
  vertical_push: [3, 8, 10],
  horizontal_pull: [3, 8, 10],
  vertical_pull: [3, 8, 10],
  accessory_or_core: [2, 10, 15],
};

function doseFor(
  kind: ComposedDayShape,
  slot: SessionSlot,
  position: number,
): readonly [number, number, number] {
  if (kind === 'full_body_a' || kind === 'full_body_b') {
    return FULL_BODY_DOSE[slot] ?? [2, 10, 15];
  }
  const ladder = kind === 'lower' ? LOWER_DOSE : UPPER_DOSE;
  return ladder[Math.min(position, ladder.length - 1)];
}

/**
 * A day's ladder comes from the plan's TYPED intent, never from its NAME.
 * `slotDayKindFor` reads a name, which is right for an oracle judging weeks it
 * did not build; the composer has the plan's own answer in hand.
 *
 * ⚠ **IT NO LONGER ANSWERS FOR `full_body`, AND THAT LINE WAS 44 OF THE 60
 * REFUSALS.** `archetype === 'full_body'` returned `'lower'` — so a day the
 * planner had explicitly asked to cover **squat, hinge, push AND pull** was given
 * the five-slot LOWER ladder, and the push and pull it asked for were never
 * selected. Nothing repaired it and nothing had to: the week then genuinely
 * trained no push or no pull, and `validateGeneratedWeek` refused it correctly.
 *
 * Executed receipt, `Pre-season/3d/club/Full Gym/w1`: two planner days, both
 * `archetype=full_body plannedPatterns=[squat,hinge,push,pull]`, both composed
 * `kind=lower`, week refused
 * `required_safe_patterns_present:push|required_safe_patterns_present:pull|pattern_balance:2`
 * on a FULL GYM — Bench Press and Pull-Ups legal and unselected.
 *
 * A full-body day's shape is a decision about the WEEK (A or B, and they
 * alternate), so it cannot be answered by a function looking at one day's
 * intent. `composeWeek` owns that choice; this returns null and says why.
 */
export function composedDayKind(intent: StrengthIntent): SlotDayKind | null {
  const planned = intent.plannedPatterns ?? [];
  if (intent.archetype === 'full_body') return null;   // the WEEK decides A vs B
  if (intent.archetype === 'lower') return 'lower';
  if (intent.archetype !== 'upper') return null;
  const hasPush = planned.includes('push');
  const hasPull = planned.includes('pull');
  if (hasPush && hasPull) return 'upper_full';
  if (hasPush) return 'upper_split_push';
  if (hasPull) return 'upper_split_pull';
  return null;
}

function mondayISO(dateISO: string): string {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

// ─── COMPOSE ───────────────────────────────────────────────────────────────

export function composeWeek(inputs: ComposerInputs): ComposedWeek {
  const excluded = new Set(inputs.injuries.excludedIdentities.map(composedIdentityFor));
  const prohibited = new Set(inputs.injuries.prohibitedPatterns);
  const days: ComposedDay[] = [];
  const gaps: ComposedGap[] = [];
  const adjustment: { reason: 'no_trainable_slot_on_this_kit'; dayOfWeek: number }[] = [];
  // Variety is a property of the WEEK: a day repeating last night's lift is the
  // shape Bible `:227` names to avoid.
  const usedThisWeek = new Set<ComposedExerciseIdentity>();
  // Week 1 takes the authored first choice; later weeks walk the same order.
  const step = Math.max(0, inputs.phaseClock.weekNumber - 1);
  // Sam's full-body shape, decided once for the WEEK — see its own docstring.
  const fullBody = composedWeekIsFullBodyOnClubNights(inputs.plannedDays);
  // ── WHICH SHAPE THE WEEK'S FIRST FULL-BODY DAY TAKES — R-089, AND IT IS
  //    DECIDED BY PARITY ──────────────────────────────────────────────────────
  //
  // A leads with a SQUAT, B with the matching HINGE, and they alternate. So over
  // F full-body days, starting at A gives `ceil(F/2)` squats and `floor(F/2)`
  // hinges — **lawful only when F is EVEN.** An ODD number of full-body days
  // starting at A always ends the week one squat ahead of its hinges, and every
  // ordinary `lower` day contributes one of each, so it cannot absorb the excess.
  //
  // MEASURED, and this arm is here because the fix above CAUSED it: teaching the
  // composer to honour a planner-declared `full_body` day took R-089 from 0 to 10
  // unmatched-squat weeks — `Off-season/4d`, one lower day (`sq1/hi1`) plus ONE
  // full-body day, which took A and made the week `sq2/hi1`. Both census arms,
  // including the content arm that reads only the rows, caught it.
  //
  // ⚠ SAM'S ORDER IS PRESERVED WHERE HE STATED IT. His sentence is *"Squat and
  // single leg hip … THEN hinge and single leg knee"* — A first — and he stated it
  // for the TWO-session athlete. F=2 is even, so that case still opens on A. The
  // odd case is one he never enumerated, and starting it on B is R-089 (a ruling
  // he DID make) deciding it, not this composer inventing a preference.
  // ⚠ **AND AN ODD COUNT CANNOT SATISFY R-089 AT ALL — PROVED, NOT ASSUMED.**
  //
  // A adds `squat + single_leg_hip`; B adds `hinge + single_leg_knee`. R-089 is
  // TWO directional rules (`squat <= hinge` AND `single_leg_knee <=
  // single_leg_hip`) and Sam's shapes CROSS the pairs — A takes the squat with the
  // single-leg HIP, B the hinge with the single-leg KNEE. So over an odd number of
  // full-body days, starting on A leaves a squat unmatched and starting on B
  // leaves a single-leg knee unmatched. **Enumerated over lower-day counts 0-2 and
  // full-body counts 1-3: every odd case violates under BOTH starting shapes, and
  // ordinary `lower` days cannot absorb it because each contributes one of all
  // four.** Measured live, both ways: starting odd weeks on A gave 10 unmatched
  // squats; starting them on B gave 22 unmatched single-leg knees.
  //
  // A LONE FULL-BODY DAY IS A CASE SAM HAS NOT RULED. His sentence is about the
  // athlete with TWO sessions — it names a PAIR that covers the lower ladder
  // between them, and five slots cannot cover it alone. Picking a third shape here
  // would be this composer writing product law, so the week keeps the planner's
  // ordinary answer and **refuses with its exact typed blocker** instead. The
  // question is in the boundary report, for Sam, with the two candidate answers.
  const fullBodyDayCount = composedStrengthDays(inputs.plannedDays).filter(
    (day) => fullBody || day.strengthIntent.archetype === 'full_body').length;
  const fullBodyPairsUp = fullBodyDayCount > 0 && fullBodyDayCount % 2 === 0;
  let fullBodyIndex = 0;

  for (const planned of inputs.plannedDays) {
    if (!composedDayIsStrength(planned.strengthIntent)) continue;
    // ── WHICH LADDER THIS DAY OWES ──────────────────────────────────────────
    //
    // A day is full body when the WEEK takes Sam's A/B shape, **or when the
    // planner declared that day `full_body` itself.** The second arm is the one
    // that was missing: `composedDayKind` answered `'lower'` for a `full_body`
    // archetype, so a day asked to cover squat, hinge, push AND pull got the
    // five-slot lower ladder and its push and pull were never selected. 44 of
    // the 60 refusals in the 180-world sweep were that one line.
    //
    // A AND B ALTERNATE ACROSS THE WEEK'S FULL-BODY DAYS, which is what keeps
    // R-089 whole: A leads with a squat, B with the matching hinge. The index
    // therefore advances on full-body days ONLY — advancing it on every strength
    // day would let a lower day between two full-body days flip both to A.
    const isFullBodyDay = fullBodyPairsUp
      && (fullBody || planned.strengthIntent.archetype === 'full_body');
    // An UNPAIRED full-body day keeps the ladder it had before this unit — the
    // lower five — because no shape it could take satisfies R-089 (see above).
    // That is the honest answer and it is why those worlds still refuse: the
    // refusal names the missing push or pull, which is exactly the open question.
    const ordinaryKind = composedDayKind(planned.strengthIntent) ?? 'lower';
    const kind: ComposedDayShape = isFullBodyDay
      ? (fullBodyIndex % 2 === 0 ? 'full_body_a' : 'full_body_b')
      : ordinaryKind;
    if (isFullBodyDay) fullBodyIndex += 1;
    const required: SessionSlot[] = [];
    const rows: ComposedRow[] = [];
    // A pattern is main-lifted ONCE per day. Sam: "any push pull hinge squat
    // single leg knee single leg hip get the main lift role there" — with guard
    // (d): the day's FIRST row of a planned pattern takes the role, and a
    // supplementary row of the same pattern stays an accessory.
    const patternHasItsMainLift = new Set<MainStrengthPattern>();
    // ⚠ THE FULL-BODY SHAPE DECLARES ITS OWN PATTERNS. The plan's answer for
    // this case was upper-only and Sam has overruled it, so asking the plan
    // which patterns the day carries would re-impose the ruling he replaced —
    // and every lower row would come out an accessory.
    // ONE TABLE ANSWERS FOR EVERY SHAPE. This was a three-arm conditional over
    // two private constants plus the table; both constants now live IN the table.
    const shapeSlots = SLOTS_FOR_KIND[kind];
    // ⚠ THE TEST IS THE DAY, NOT THE WEEK. Both of these read `fullBody` — the
    // WEEK-level flag — so a day the PLANNER declared `full_body` in an otherwise
    // ordinary week took the else arm: its lower rows came out accessories
    // (no main lift for squat or hinge) and its planes never fell back on the
    // kit. `isFullBodyDay` is the answer to the question both were asking.
    const plannedPatterns = new Set(
      isFullBodyDay
        ? shapeSlots.map((slot) => PATTERN_FOR_SLOT[slot]).filter(Boolean) as MainStrengthPattern[]
        : planned.strengthIntent.plannedPatterns ?? []);

    for (const declaredSlot of shapeSlots) {
      // The kit outranks the plane preference, and Sam ruled the fallback.
      const planeChoice = isFullBodyDay && OPPOSITE_PLANE[declaredSlot]
        ? resolvePlane(declaredSlot, inputs.kit, excluded)
        : null;
      if (planeChoice) {
        for (const droppedSlot of planeChoice.dropped) {
          gaps.push({
            dayOfWeek: planned.dayOfWeek,
            slot: droppedSlot,
            cause: 'kit',
            wouldNeed: slotCandidates(droppedSlot).length > 0
              ? composedRowGapReason(slotCandidates(droppedSlot)[0], inputs.kit)
              : null,
            ...(planeChoice.slot ? { repeatedPlaneInstead: planeChoice.slot } : {}),
          });
        }
        if (!planeChoice.slot) continue;
      }
      const slot = planeChoice?.slot ?? declaredSlot;
      const pattern = PATTERN_FOR_SLOT[slot] ?? null;
      if (pattern && prohibited.has(pattern)) continue;   // safety, not kit
      const isMainLift = !!pattern
        && plannedPatterns.has(pattern)
        && !patternHasItsMainLift.has(pattern);
      const pool = isMainLift ? anchorCandidates(slot) : supportCandidates(slot);
      const legal = pool.filter((id) => !excluded.has(id) && composedRowIsLegal(id, inputs.kit));
      if (legal.length === 0) {
        // `resolvePlane` has already disclosed a plane it could not fill, so a
        // second gap for the same slot would double-count the same fact.
        if (!planeChoice) {
          gaps.push({
            dayOfWeek: planned.dayOfWeek,
            slot,
            cause: 'kit',
            wouldNeed: pool.length > 0 ? composedRowGapReason(pool[0], inputs.kit) : null,
          });
        }
        continue;
      }
      required.push(slot);
      const fresh = legal.filter((id) => !usedThisWeek.has(id));
      const choices = fresh.length > 0 ? fresh : legal;
      const identity = choices[step % choices.length];
      usedThisWeek.add(identity);
      // ── B1-M1: THE DOSE IS RESOLVED HERE, NOT DOWNSTREAM ────────────────
      // `doseFor` is the composer's authored fallback band; where a ruling
      // owns the row — a main lift's phase scheme, U-1's loaded band, U-3's
      // unloaded compounds, U-4's ballistic swings — the ruling wins.
      const authoredFallback = doseFor(kind, slot, rows.length);
      const dose = resolveComposedDose({
        identity,
        isMainLift,
        poolSlot: POOL_SLOT_FOR_LADDER_SLOT[slot] ?? null,
        seasonPhase: inputs.seasonPhase,
        offseasonSubphase: inputs.offseasonSubphase,
        authoredFallback,
      });
      if (isMainLift && pattern) patternHasItsMainLift.add(pattern);
      rows.push({
        identity,
        slot,
        role: isMainLift ? 'main_strength' : 'strength_accessory',
        mainStrengthPattern: isMainLift ? pattern : null,
        doseCategory: dose.category,
        sets: dose.sets,
        repsMin: dose.repsMin,
        repsMax: dose.repsMax,
        // U-2 applies exactly once, here, before authorship. The composer emits
        // no starting load of its own, so the cut has nothing to stack onto.
        // THE FINAL LOAD, DERIVED FROM THE BASE — base working load x one
        // governed multiplier, recomputed from the base rather than adjusted in
        // place, so the derivation is naturally non-stacking.
        load: resolveComposedLoad({
          identity,
          isMainLift,
          poolSlot: POOL_SLOT_FOR_LADDER_SLOT[slot] ?? null,
          seasonPhase: inputs.seasonPhase,
          offseasonSubphase: inputs.offseasonSubphase,
          profile: inputs.profile,
          kit: inputs.kit,
        }),
        ...(dose.qualityLimit ? { qualityLimit: dose.qualityLimit } : {}),
      });
    }

    if (rows.length === 0) {
      // Clause (d): requested, and nothing lawful could fill it. Said out loud
      // with a typed reason rather than silently dropped.
      adjustment.push({ reason: 'no_trainable_slot_on_this_kit', dayOfWeek: planned.dayOfWeek });
      continue;
    }
    days.push({
      dayOfWeek: planned.dayOfWeek,
      planEntryId: planned.planEntryId,
      name: planned.name,
      workoutType: planned.workoutType,
      sessionTier: planned.sessionTier,
      kind,
      requiredSlots: required,
      rows,
    });
  }

  return {
    weekStartISO: mondayISO(inputs.todayISO),
    days,
    gaps,
    sessionCount: {
      // Clause (d) counts what the PLANNER asked for. `composedDayKind !== null`
      // stopped being that question when `full_body` started returning null.
      requested: composedStrengthDays(inputs.plannedDays).length,
      composed: days.length,
      adjustment: adjustment.length > 0 ? adjustment : null,
    },
    kitUnachievablePatterns: kitUnachievablePatterns(inputs.kit),
  };
}
