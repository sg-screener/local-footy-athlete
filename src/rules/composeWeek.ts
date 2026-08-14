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
import { STRENGTH_POOLS, type PoolSlotKey } from '../data/exercisePoolsStrength';
import { selectableExerciseNames } from '../data/selectableExerciseVocabulary';

// ─── INPUTS. Every field has a reader in CP1, or it does not exist yet. ─────

export interface ComposerPlannedDay {
  readonly dayOfWeek: number;
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
  /** The athlete's answers. Read for season phase and experience level. */
  readonly profile: { readonly seasonPhase?: string; readonly experienceLevel?: string };
  /** Read for the week number that moves selection along the authored order. */
  readonly phaseClock: { readonly weekNumber: number };
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
  readonly sets: number;
  readonly repsMin: number;
  readonly repsMax: number;
}

/** Clause (e): a kit-caused gap — derived from kit + sheet, never from records. */
export interface ComposedGap {
  readonly dayOfWeek: number;
  readonly slot: SessionSlot;
  readonly cause: 'kit';
  readonly wouldNeed: string | null;
}

export interface ComposedDay {
  readonly dayOfWeek: number;
  readonly planEntryId: string;
  readonly name: string;
  readonly workoutType: string;
  readonly sessionTier: string;
  readonly kind: SlotDayKind;
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

function anchorCandidates(slot: SessionSlot): readonly ComposedExerciseIdentity[] {
  const poolSlot = POOL_SLOT_FOR_LADDER_SLOT[slot];
  if (!poolSlot) return slotCandidates(slot);
  const anchors = STRENGTH_POOLS[poolSlot].anchor.entries
    .map((entry) => composedIdentityFor(entry.name));
  return anchors.length > 0 ? anchors : slotCandidates(slot);
}

/**
 * A SUPPORTING ROW COMES OFF THE ACCESSORY BENCH FIRST. Same reason the main
 * lift comes off the anchors: the pools already carry the distinction, and
 * ignoring it made a full-gym vertical push open on a `Bottoms-Up KB Press`.
 * The four ladder slots with no pool slot fall back to the census join.
 */
function supportCandidates(slot: SessionSlot): readonly ComposedExerciseIdentity[] {
  const poolSlot = POOL_SLOT_FOR_LADDER_SLOT[slot];
  if (!poolSlot) return slotCandidates(slot);
  const pool = STRENGTH_POOLS[poolSlot];
  return [...pool.accessory.entries, ...pool.anchor.entries]
    .map((entry) => composedIdentityFor(entry.name));
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

function doseFor(kind: SlotDayKind, position: number): readonly [number, number, number] {
  const ladder = kind === 'lower' ? LOWER_DOSE : UPPER_DOSE;
  return ladder[Math.min(position, ladder.length - 1)];
}

/**
 * A day's ladder comes from the plan's TYPED intent, never from its NAME.
 * `slotDayKindFor` reads a name, which is right for an oracle judging weeks it
 * did not build; the composer has the plan's own answer in hand.
 */
export function composedDayKind(intent: StrengthIntent): SlotDayKind | null {
  const planned = intent.plannedPatterns ?? [];
  if (intent.archetype === 'lower' || intent.archetype === 'full_body') return 'lower';
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

  for (const planned of inputs.plannedDays) {
    const kind = composedDayKind(planned.strengthIntent);
    if (!kind) continue;
    const required: SessionSlot[] = [];
    const rows: ComposedRow[] = [];
    // A pattern is main-lifted ONCE per day. Sam: "any push pull hinge squat
    // single leg knee single leg hip get the main lift role there" — with guard
    // (d): the day's FIRST row of a planned pattern takes the role, and a
    // supplementary row of the same pattern stays an accessory.
    const patternHasItsMainLift = new Set<MainStrengthPattern>();
    const plannedPatterns = new Set(planned.strengthIntent.plannedPatterns ?? []);

    for (const slot of SLOTS_FOR_KIND[kind]) {
      const pattern = PATTERN_FOR_SLOT[slot] ?? null;
      if (pattern && prohibited.has(pattern)) continue;   // safety, not kit
      const isMainLift = !!pattern
        && plannedPatterns.has(pattern)
        && !patternHasItsMainLift.has(pattern);
      const pool = isMainLift ? anchorCandidates(slot) : supportCandidates(slot);
      const legal = pool.filter((id) => !excluded.has(id) && composedRowIsLegal(id, inputs.kit));
      if (legal.length === 0) {
        gaps.push({
          dayOfWeek: planned.dayOfWeek,
          slot,
          cause: 'kit',
          wouldNeed: pool.length > 0 ? composedRowGapReason(pool[0], inputs.kit) : null,
        });
        continue;
      }
      required.push(slot);
      const fresh = legal.filter((id) => !usedThisWeek.has(id));
      const choices = fresh.length > 0 ? fresh : legal;
      const identity = choices[step % choices.length];
      usedThisWeek.add(identity);
      const [sets, repsMin, repsMax] = doseFor(kind, rows.length);
      if (isMainLift && pattern) patternHasItsMainLift.add(pattern);
      rows.push({
        identity,
        slot,
        role: isMainLift ? 'main_strength' : 'strength_accessory',
        mainStrengthPattern: isMainLift ? pattern : null,
        sets,
        repsMin,
        repsMax,
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
      requested: inputs.plannedDays.filter(
        (planned) => composedDayKind(planned.strengthIntent) !== null).length,
      composed: days.length,
      adjustment: adjustment.length > 0 ? adjustment : null,
    },
    kitUnachievablePatterns: kitUnachievablePatterns(inputs.kit),
  };
}
