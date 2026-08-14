/**
 * Strength Exercise Pools — Deterministic cross-cycle variation.
 *
 * Each of the four MVP strength patterns (squat, hinge, upper push, upper pull)
 * has an anchor pool and an accessory pool. The anchor is the primary compound
 * lift; accessories are the paired secondary/unilateral/isolation work.
 *
 * ROTATION CADENCE:
 *   Anchor    → rotates per mini-cycle (3-4 week block). Stays fixed within
 *               a block so progression (load × reps) runs uninterrupted.
 *   Accessory → rotates per microcycle (week-within-block). Introduces
 *               variation without disturbing the anchor's loading cycle.
 *
 * PROGRESSION TRANSFER:
 *   When the anchor rotates from A to B, B inherits A's exposure history
 *   via a load ratio (loadRatio = fraction of the slot's reference
 *   exercise's 1RM). Example: Back Squat = 1.00, Front Squat = 0.85 →
 *   if the athlete worked up to 100 kg Back Squat last block, Front Squat
 *   this block starts prescribed at 85 kg.
 *
 *   Load ratios are approximate powerlifting heuristics. They only seed
 *   the first exposure of a rotated exercise; thereafter normal progression
 *   takes over.
 *
 * INDEX MAP:
 *   classifyPoolSlot(name)     → { slot, role } | null
 *   selectPoolEntry(pool, ctx) → PoolEntry
 *   getSlotSiblings(slot, role)→ PoolEntry[]
 *   applyPoolRotation(name, ctx, previousByRole?) → string (rewritten name)
 */

import { EXERCISE_TAGS, type MovementPattern, type InjuryKey } from './exerciseTags';
import type { EquipmentTag } from './exercisePools';
import type { ConditioningEquipmentModality } from '../types/domain';
import type { ExperienceLevel, WeekKind } from '../types/domain';
import type { OffseasonSubphase } from '../rules/offseasonSubphase';
import { equipmentClassFor, type EquipmentClass } from '../utils/loadEstimation';
// AVAILABILITY, which is a different question from LOAD. Pure data, no cycle.
import {
  equipmentRequiredFor,
  exerciseIsAvailableWith,
} from './exerciseEquipmentRequirement';
import {
  resolveTrainingAgePolicy,
  type TrainingAgePoolSlot,
} from '../rules/trainingAgePolicy';

// ─── Types ───

export type PoolSlotKey =
  | 'squat'
  | 'hinge'
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'carry'
  | 'isolation_upper'
  | 'isolation_lower'
  | 'plyo';
export type PoolRole = 'anchor' | 'accessory';

/**
 * THE TYPED DOSE CATEGORIES. Sam's U-1 (verbatim, 2026-08-14) split isolation
 * accessories from single-leg/compound work; U-3 and U-4 are seat-drafted
 * wording he approved, covering unloaded compounds and ballistic strength work.
 */
export type ComposedDoseCategory =
  | 'main_lift'
  | 'loaded_lower_secondary_compound'
  | 'isolation_accessory'
  | 'unloaded_lower_compound'
  | 'ballistic_strength';

export interface PoolEntry {
  /** Must match an EXERCISE_TAGS key (or be resolvable by findOrCreateExercise). */
  name: string;
  /**
   * MUSCLE SUB-GROUP INSIDE THE SLOT — ROTATION MAY NOT CROSS IT.
   *
   * **A pool slot answers "what movement is this"; a group answers "what does it
   * TRAIN". Rotation is variety WITHIN a group, never across one.** Before this
   * field the blocks below existed only as COMMENTS — `// Bicep block`,
   * `// Tricep block`, `// Shoulder / trap block` — while `selectPoolEntry`
   * picked by `cycleIndex % entries.length` across the whole flat list, so the
   * labels were decoration and rotation ignored them.
   *
   * MEASURED, 2026-08-13, what that shipped: `Bicep Curls | Tricep Pushdowns`
   * rotating to `Bicep Curl (Barbell) | Bicep Curl (Dumbbell) | Hammer Curl` —
   * three bicep curls and NO TRICEPS. Sam's *"an athlete is better served by a
   * squat and a hinge than by two squats"* (`:227`) in arm form.
   *
   * OPTIONAL BY DESIGN: a slot whose entries are all one thing (every squat
   * anchor is a squat) needs no groups, and leaving it undefined keeps the
   * existing whole-slot rotation. Only slots that MIX muscle groups need it.
   */
  group?: string;
  /**
   * ⚠ THE PRESCRIPTION'S OWNER — Sam's U-1/U-3/U-4 rulings, 2026-08-14.
   *
   * **`group` + `loadRatio` are NOT sufficient and the census proved it.**
   * `Kettlebell Swings` shares `bilateral_hinge` with `Hip Thrusts` and is
   * ballistic; `loadRatio: 0` says a row carries no external load but says
   * nothing about its programming intent; and pool role `accessory` conflates
   * secondary compounds, unloaded compounds and special movements. So the
   * category is AUTHORED here, on the entry, where the rest of the exercise's
   * authored meaning already lives.
   *
   * Omitted = the entry is a main lift when used as one and otherwise takes its
   * slot's ordinary secondary band; `resolveComposedDose` is the single reader.
   */
  doseCategory?: ComposedDoseCategory;
  /**
   * Load ratio relative to the slot's reference exercise.
   *   squat            ref: Back Squat       → 1.00
   *   hinge            ref: Deadlift         → 1.00
   *   horizontal_push  ref: Bench Press      → 1.00
   *   vertical_push    ref: Overhead Press   → 1.00
   *   horizontal_pull  ref: Barbell Row      → 1.00
   *   vertical_pull    ref: Pull-Ups         → 1.00 (bodyweight-denominated)
   *
   * 0 = bodyweight (no external load).
   *
   * Cross-slot transfers are intentionally blocked — Bench Press and
   * Overhead Press don't share a 1RM ratio in practice, so rotation
   * across the horizontal/vertical boundary deliberately re-seeds the
   * new anchor rather than transferring load. Within-slot transfers
   * (Bench → Incline Bench) still work normally.
   */
  loadRatio: number;
}

export interface PoolDefinition {
  slot: PoolSlotKey;
  role: PoolRole;
  entries: PoolEntry[];
}

export interface RotationContext {
  /** 1-based mini-cycle / 3-4 week block index. */
  miniCycleNumber: number;
  /** 1-based week-within-block (1..4). Optional; only drives accessory rotation. */
  weekInBlock?: number;
  /** Monday ISO date for this generated week. Optional; drives date-based conditioning variety. */
  weekStartISO?: string;
  /** Build vs generated deload week. Optional for backwards-compatible rotation-only callers. */
  weekKind?: WeekKind;
  /** Week-level generation intensity multiplier. Optional for rotation-only callers. */
  intensityMultiplier?: number;
  /**
   * Which door opened this deload, when it was not the scheduled one. The
   * scheduled door is phase-gated by D16; the readiness and illness doors are
   * not, and in-season they are the ONLY way a week deloads. Absent means the
   * scheduled door (or no deload at all).
   */
  deloadDoor?: 'readiness' | 'illness';
  /**
   * The READINESS deload's rolling window (R-035), when that is the door.
   * ABSENT MEANS EVERY DAY — the illness door deloads while the fact is active
   * (R-036), not for seven days, so a missing window must never narrow a week.
   */
  readinessDeloadWindow?: { startISO: string; endISO: string };
  /** Canonical phase-clock identity; never inferred from mini-cycle fields. */
  offseasonSubphase?: OffseasonSubphase;
}

// ─── Per-Athlete Overrides (Refinement 3) ───

/**
 * Per-athlete overrides applied at the rotation seam.
 *
 * Folds into `selectPoolEntryAvoiding` as a filter + bias layer before the
 * rotation walk:
 *
 *   Pool entries
 *      ↓ filter-out: name ∈ excluded                (hard exclude)
 *      ↓ filter-out: tag.injury[k] === 'avoid'       (any k ∈ activeInjuries)
 *      ↓ deprioritize: tag.injury[k] === 'caution'  (stable sort after 'good')
 *      ↓ bias: entries ∈ pinned float to rotation-start
 *      ↓ rotation walk (existing mc / weekInBlock index + avoid set)
 *
 * If the filter pipeline empties the pool, the rotation falls through to
 * the raw pool unchanged — overrides are bias, not a second system. The
 * fall-through logs a structured line (slot, pool size, exclusion count,
 * injury-filter count) so operators can see which prefs became unusable.
 *
 * When `AthletePoolPrefs` is absent from a call, behaviour is identical
 * to the refinement-2 baseline (no filter, no bias). All existing tests
 * continue to pass unchanged.
 *
 * Conflict resolution:
 *   - `excluded` ∩ `pinned` → exclusion wins (pinned ignored for the overlap).
 *     This keeps the filter pipeline order-independent: exclusion is always
 *     evaluated before pin-bias.
 *
 * Scope:
 *   - Structural only — no UX layer for editing prefs; athletes get the
 *     empty default `{ excluded: [], pinned: [] }` until a coach / screen
 *     writes to the separate `athletePreferencesStore`.
 */
export interface AthletePoolPrefs {
  /** Exercises the athlete never wants to see. Hard exclude. */
  excluded: readonly string[];
  /** Exercises the athlete prefers — bias rotation to pick them when the slot comes up. */
  pinned: readonly string[];
  /**
   * Currently avoiding injury regions. Distinct from `UserProfile.injuryHistory`
   * (historical, free-text). Mutates often; lives in a separate store.
   */
  activeInjuries?: readonly InjuryKey[];
  /** Canonical equipment tags available for this generated week/session. */
  availableEquipment?: readonly EquipmentTag[];
  /** Exact conditioning-machine capabilities resolved with the same constraints. */
  conditioningModalities?: readonly ConditioningEquipmentModality[];
  /** Profile training age used to keep deterministic pool choices learnable. */
  experienceLevel?: ExperienceLevel;
}

// ─── Movement Pattern → Slot Map ───

/**
 * Which logical pool slot owns a given movement pattern.
 *   squat + lunge        → squat slot (lunges are squat-session accessories)
 *   hinge                → hinge slot
 *   horizontal_push      → horizontal_push slot (bench press family)
 *   vertical_push        → vertical_push slot (overhead press family)
 *   horizontal_pull      → horizontal_pull slot (row family)
 *   vertical_pull        → vertical_pull slot (pull-up / pulldown family)
 *   carry                → carry slot
 *   isolation_upper      → isolation_upper slot (grab-bag variation pool)
 *   isolation_lower      → isolation_lower slot (rehab/prehab/tissue, accessory-only)
 *   plyo                 → plyo slot
 *
 * Upper push/pull are split along the horizontal/vertical axis so
 * rotation respects biomechanical boundaries — Bench Press never
 * rotates to Overhead Press, Pull-Ups never rotates to Barbell Row.
 * The engine still emits one `push` or `pull` allocation per week;
 * AI-proposed exercise names route to whichever sub-slot they belong
 * to (Option A sub-pattern selection — no mc alternation forced).
 *
 * Patterns not listed (core, conditioning) are not managed by the pool
 * system — they pass through unchanged.
 */
const PATTERN_TO_SLOT: Partial<Record<MovementPattern, PoolSlotKey>> = {
  squat: 'squat',
  lunge: 'squat',
  hinge: 'hinge',
  horizontal_push: 'horizontal_push',
  vertical_push: 'vertical_push',
  horizontal_pull: 'horizontal_pull',
  vertical_pull: 'vertical_pull',
  carry: 'carry',
  isolation_upper: 'isolation_upper',
  isolation_lower: 'isolation_lower',
  plyo: 'plyo',
};

export function patternToSlot(pattern: MovementPattern): PoolSlotKey | null {
  return PATTERN_TO_SLOT[pattern] ?? null;
}

// ─── Pool Definitions ───

/**
 * The 4 MVP strength pools. Each slot defines an anchor pool (bilateral
 * compound, moderate/high load) and an accessory pool (unilateral /
 * lower-load / variant).
 *
 * To expand past MVP: add new slots here, update PATTERN_TO_SLOT if
 * new movement patterns are involved.
 */
export const STRENGTH_POOLS: Record<PoolSlotKey, {
  anchor: PoolDefinition;
  accessory: PoolDefinition;
}> = {
  squat: {
    anchor: {
      slot: 'squat', role: 'anchor', entries: [
        { name: 'Back Squat',  loadRatio: 1.00 },
        { name: 'Front Squat', loadRatio: 0.85 },
        { name: 'Box Squat',   loadRatio: 0.95 },
        // Sam ruled 2026-07-25: 1.2 x Box Squat, derived from Box Squat's own
        // 0.95 — a higher box is a shorter range, so heavier, not lighter.
        { name: 'High Box Squat', loadRatio: 1.14 },
      ],
    },
    accessory: {
      // ── R-080: A LUNGE MAY NOT ROTATE INTO A SQUAT ──────────────────────
      //
      // **Sam, 2026-08-13, on a bodyweight leg day printing the same squat
      // twice: *"Bodyweight leg day gets more single-leg knee work"*.**
      //
      // THIS SLOT MIXED TWO OF HIS OWN LADDER SLOTS. `:227` names `squat` and
      // `single_leg_knee` as SEPARATE things a lower day owes, and this one pool
      // held both — so `applyPoolRotation` turned single-leg work into a
      // bilateral squat. Measured, bodyweight off-season:
      //
      //     ROT Reverse Lunges -> Bodyweight Squat  [squat/accessory]
      //     ROT Back Squat     -> Bodyweight Squat  [squat/accessory]
      //
      // **Two rows became the SAME squat, and one of them had been a lunge.**
      // The day shipped `Bodyweight Squat · … · Bodyweight Squat · … · Back
      // Squat` — three squat-pattern rows, no single-leg knee work, which is the
      // exact slot his own ladder was missing most (8 of 44 days in the sweep).
      //
      // THE GROUPS ARE HIS LADDER, NOT A NEW OPINION, and they reuse the
      // `PoolEntry.group` rule already built for the arm/shoulder pool: rotation
      // varies WITHIN a group and never across one. A lunge now rotates to
      // another single-leg knee movement, and the squat stays a squat.
      slot: 'squat', role: 'accessory', entries: [
        { name: 'Walking Lunges', doseCategory: 'loaded_lower_secondary_compound',         loadRatio: 0.45, group: 'single_leg_knee' },
        { name: 'Bulgarian Split Squats', doseCategory: 'loaded_lower_secondary_compound', loadRatio: 0.40, group: 'single_leg_knee' },
        { name: 'Reverse Lunges', doseCategory: 'loaded_lower_secondary_compound',         loadRatio: 0.45, group: 'single_leg_knee' },
        { name: 'Step Ups', doseCategory: 'loaded_lower_secondary_compound',               loadRatio: 0.40, group: 'single_leg_knee' },
        { name: 'Single-Leg Leg Press', doseCategory: 'loaded_lower_secondary_compound',   loadRatio: 0.50, group: 'single_leg_knee' },
        { name: 'Single-Leg Squat (to Box)', doseCategory: 'loaded_lower_secondary_compound', loadRatio: 0.30, group: 'single_leg_knee' },
        { name: 'Goblet Squat', doseCategory: 'loaded_lower_secondary_compound',           loadRatio: 0.35, group: 'bilateral_squat' },
        { name: 'Leg Press', doseCategory: 'loaded_lower_secondary_compound',             loadRatio: 0.90, group: 'bilateral_squat' },
        { name: 'Bodyweight Squat', doseCategory: 'unloaded_lower_compound',       loadRatio: 0.00, group: 'bilateral_squat' },
      ],
    },
  },
  hinge: {
    anchor: {
      slot: 'hinge', role: 'anchor', entries: [
        { name: 'Deadlift',          loadRatio: 1.00 },
        { name: 'Trap Bar Deadlift', loadRatio: 1.05 },
        { name: 'RDLs',              loadRatio: 0.80 },
      ],
    },
    accessory: {
      // ── R-080'S SIBLING SLOT, AND IT HAD THE IDENTICAL DEFECT ────────────
      //
      // R-080 split the SQUAT accessory pool above because rotation was turning
      // a lunge into a bilateral squat. **This pool held the same mixture one
      // slot over and nobody looked**: `Single-Leg RDL` is Sam's `single_leg_hip`
      // slot, and `Hip Thrusts` / `Kettlebell Swings` / `Glute Bridge` are
      // bilateral hinges. Ungrouped, rotation swapped freely between them.
      //
      // **MEASURED 2026-08-13, and it is why fixing the fallbacks alone did
      // nothing.** The squat-led and hinge-led ladders have emitted
      // `Single-Leg RDL` since they were corrected, and the shipped day reads:
      //
      //     ROT Single-Leg RDL -> Hip Thrusts        [hinge/accessory]
      //     ROT Single-Leg RDL -> Kettlebell Swings  [hinge/accessory]
      //     ROT Single-Leg RDL -> Glute Bridge       [hinge/accessory]
      //
      // Across 6 worlds x 4 weeks that was **20 days missing `single_leg_hip`
      // and 22 days reporting a DOUBLED `hinge`** — one defect wearing two
      // numbers, and the single commonest deficiency in the whole corpus. The
      // composer put the row in and the rotation took it straight back out.
      //
      // **THE NARROWING IS REAL AND IS STATED, NOT FOUND LATER:** the app owns
      // exactly ONE single-leg hip lift in this pool, so that group cannot
      // rotate at all today. `Single-Leg Hip Thrust` exists but is tagged
      // `isolation_lower`, so it fills accessory/core and not this slot —
      // re-tagging it to buy variety here would move a row every other reader
      // sees, which is R-076's mistake. A repeated Single-Leg RDL is a smaller
      // wrong than a lost slot; more variety is a content unit, not this one.
      slot: 'hinge', role: 'accessory', entries: [
        { name: 'Single-Leg RDL', doseCategory: 'loaded_lower_secondary_compound',    loadRatio: 0.45, group: 'single_leg_hip' },
        { name: 'Hip Thrusts', doseCategory: 'loaded_lower_secondary_compound',       loadRatio: 1.10, group: 'bilateral_hinge' },
        { name: 'Kettlebell Swings', doseCategory: 'ballistic_strength', loadRatio: 0.35, group: 'bilateral_hinge' },
        // Sam ruled 2026-07-25: bodyweight-with-optional. loadRatio 0 means no
        // progression transfer to or from its hinge siblings, which is the
        // honest reading of a lift with no prescribed load.
        { name: 'Glute Bridge', doseCategory: 'unloaded_lower_compound',      loadRatio: 0.00, group: 'bilateral_hinge' },
      ],
    },
  },
  // ─── Upper split: horizontal vs vertical ───
  //
  // Apr 2026 refinement. Previously `upper_push` and `upper_pull` lumped
  // horizontal + vertical variants together, so rotation could swap
  // Bench Press for Overhead Press or Pull-Ups for Barbell Row — a
  // biomechanically meaningless swap that also broke load-ratio
  // transfer (1RMs don't track across those axes). The split gives
  // each sub-pattern its own rotation cycle. AI drives sub-pattern
  // selection today (Option A in pool-refinements-design.md): whichever
  // sub-pattern the AI names is the one that rotates for that session.
  horizontal_push: {
    anchor: {
      slot: 'horizontal_push', role: 'anchor', entries: [
        { name: 'Bench Press',      loadRatio: 1.00 },
        { name: 'Incline Bench',    loadRatio: 0.85 },
        { name: 'Close Grip Bench', loadRatio: 0.90 },
      ],
    },
    accessory: {
      slot: 'horizontal_push', role: 'accessory', entries: [
        { name: 'DB Bench Press',  loadRatio: 0.80 },
        { name: 'Incline DB Bench', loadRatio: 0.70 },
        { name: 'Push-ups',        loadRatio: 0.00 },
        { name: 'Dips',            loadRatio: 0.60 },
        { name: 'Single-Arm DB Bench Press', loadRatio: 0.35 },
        // Sam's locked list (2026-07-24) pools the Bible's pressing injury-swap
        // rather than leaving it reachable by substitution only. Ratio mirrors
        // Single-Arm DB Bench Press exactly; confirmed unchanged 2026-07-25.
        { name: 'Single-Arm DB Floor Press', loadRatio: 0.35 },
        // 'Speed Bench' is NOT here on purpose: it classifies as `power`, and
        // the power policy strips power rows from coach-built strength content
        // (workoutCanonicalisation.ts:572). Pooled here it silently deleted the
        // athlete's accessory whenever rotation selected it. Its cue, video and
        // tags ship; placement is owned by the queued power-pool unit
        // (docs/POWER_EXERCISE_POOL_SPEC_2026-07-23.md), with Kneeling/Lateral Jump.
      ],
    },
  },
  vertical_push: {
    anchor: {
      slot: 'vertical_push', role: 'anchor', entries: [
        { name: 'Overhead Press', loadRatio: 1.00 },
        { name: 'Landmine Press', loadRatio: 0.70 },
      ],
    },
    accessory: {
      slot: 'vertical_push', role: 'accessory', entries: [
        { name: 'DB Shoulder Press',                        loadRatio: 0.55 },
        { name: 'Seated DB Press',                          loadRatio: 0.55 },
        { name: 'Half-Kneeling Single-Arm Overhead Press',  loadRatio: 0.35 },
        { name: 'Explosive Landmine Press',                 loadRatio: 0.00 },
        { name: 'Z-Press',                                  loadRatio: 0.60 },
      ],
    },
  },
  horizontal_pull: {
    anchor: {
      slot: 'horizontal_pull', role: 'anchor', entries: [
        { name: 'Barbell Row',         loadRatio: 1.00 },
        { name: 'Chest Supported Row', loadRatio: 0.85 },
        { name: 'Single-Arm DB Row',   loadRatio: 0.60 },
      ],
    },
    accessory: {
      // ── R-076: SHOULDER WORK IS NOT A ROW ────────────────────────────
      //
      // **Sam, 2026-08-13: *"face pull is shoulder work for sure"*.** A pool
      // slot is an INTERCHANGEABILITY claim — `applyPoolRotation` swaps freely
      // within (slot, role) — and filing a face pull beside `Seated Cable Row`
      // claimed the two are substitutes. They are not.
      //
      // WHAT IT SHIPPED, measured 3 worlds x 3 weeks before the move: closing an
      // unrelated name-lookup miss let rotation act on this membership, and a
      // pull day went `Pull-Ups | Barbell Row | Face Pulls` ->
      // `Pull-Ups | Barbell Row | Seated Cable Row` — two rows and NO shoulder
      // work. That swap was refuted and backed out (`faa69c2f`) and this row is
      // why it happened.
      //
      // REAR DELT FLY AND BAND PULL-APART MOVED WITH IT, and that is a decision
      // worth naming: **Sam ruled the face pull by name**, but his sentence is
      // about the class, and those two are rear-delt work by any reading. Moving
      // one and leaving its two siblings would have left the identical defect
      // under two other names.
      //
      // SEATED CABLE ROW STAYS — it is a genuine horizontal pull, and it is now
      // the only accessory in this slot. That is a real narrowing of rotation
      // variety here, stated rather than discovered later: there are few
      // horizontal-pull accessories that are not shoulder work.
      slot: 'horizontal_pull', role: 'accessory', entries: [
        { name: 'Seated Cable Row',        loadRatio: 0.90 },
        // REFILLED FROM THE LOCKED VOCABULARY, NOT INVENTED. R-076 took three of
        // this slot's four accessories to the shoulder group, leaving one — and
        // `test:pools` caught it immediately ("accessory has >=3 entries (got 1)"),
        // which is the pool-integrity cell doing exactly its job. Exercise names
        // may never be authored by an agent, so these two are EXISTING
        // `EXERCISE_TAGS` entries tagged `horizontal_pull` that no pool had
        // claimed yet. Both are genuine rows, which is the whole point.
        { name: 'Chest-Supported DB Row',  loadRatio: 0.60 },
        // Bodyweight: loadRatio 0, the same no-progression-transfer convention
        // used by plyo and isolation_lower.
        { name: 'Inverted Row (Bodyweight)', loadRatio: 0 },
      ],
    },
  },
  vertical_pull: {
    anchor: {
      slot: 'vertical_pull', role: 'anchor', entries: [
        { name: 'Pull-Ups', loadRatio: 1.00 },
        { name: 'Chin-Ups', loadRatio: 1.00 },
      ],
    },
    accessory: {
      slot: 'vertical_pull', role: 'accessory', entries: [
        { name: 'Lat Pulldown',            loadRatio: 0.80 },
        { name: 'Neutral-Grip Pulldown',   loadRatio: 0.80 },
        { name: 'Single-Arm Lat Pulldown', loadRatio: 0.40 },
        { name: 'Single-Arm Pulldown',   loadRatio: 0.50 },
      ],
    },
  },
  // ─── Expansion slots ───
  //
  // carry / isolation_upper / plyo follow the same anchor/accessory shape
  // as the MVP four, but with pattern-specific adaptations:
  //   - plyo is all bodyweight (loadRatio 0) — rotation is variational
  //     only; progression transfer is a no-op (see normalizeLoadAcrossSiblings
  //     bodyweight guard).
  //   - carry loadRatios are relative to Farmer Carry (bilateral) as the
  //     slot reference. Unilateral variants use ~0.5-0.6 per hand.
  //   - isolation_upper is a grab-bag variation pool spanning bicep /
  //     tricep / shoulder / trap. The anchor entries carry intra-block
  //     progression (Shrugs, Skull Crushers — the moderate-load items);
  //     the accessory pool is strictly for variety — loadRatios are
  //     nominal since cross-muscle load transfer isn't physically
  //     meaningful, but the infrastructure still cleans up duplicates
  //     and guarantees rotation.
  carry: {
    // Four carries, split 2/2 so BOTH roles rotate (Sam, 2026-07-24). The
    // 2026-07-23 cue changeset's carry deletion had left one stranded
    // accessory that could never rotate.
    // Heavy two-handed carries anchor; lighter unilateral/overhead carries are
    // the accessory. Load transfer only applies within a role, so the split
    // also decides which carries share a load reference.
    anchor: {
      slot: 'carry', role: 'anchor', entries: [
        { name: 'Farmer Carry',   loadRatio: 1.00 },
        // Bear-hug/sandbag carries usually cap out before farmer handles, so
        // use ~75% of Farmer Carry as the carry-slot load reference.
        { name: 'Bear Carry',     loadRatio: 0.75 },
      ],
    },
    accessory: {
      slot: 'carry', role: 'accessory', entries: [
        { name: 'Suitcase Carry', loadRatio: 0.60 },
        { name: 'Overhead Carry', loadRatio: 0.55 },
      ],
    },
  },
  isolation_upper: {
    anchor: {
      slot: 'isolation_upper', role: 'anchor', entries: [
        { name: 'Shrugs',         loadRatio: 1.00 },
        { name: 'Skull Crushers', loadRatio: 0.35 },
      ],
    },
    accessory: {
      slot: 'isolation_upper', role: 'accessory', entries: [
        // Bicep block
        { name: 'Bicep Curl (Barbell)',   loadRatio: 0.25, group: 'bicep' },
        { name: 'Bicep Curl (Dumbbell)',  loadRatio: 0.20, group: 'bicep' },
        { name: 'Hammer Curl',            loadRatio: 0.20, group: 'bicep' },
        { name: 'Incline Dumbbell Curl',  loadRatio: 0.18, group: 'bicep' },
        { name: 'Lying Dumbbell Curl',    loadRatio: 0.18, group: 'bicep' },
        { name: 'Banded Bicep Curl',      loadRatio: 0.15, group: 'bicep' },
        { name: 'Concentration Curl',     loadRatio: 0.15, group: 'bicep' },
        // Tricep block
        { name: 'Tricep Pushdown',           loadRatio: 0.30, group: 'tricep' },
        { name: 'Banded Tricep Pushdown',    loadRatio: 0.20, group: 'tricep' },
        { name: 'Overhead Tricep Extension', loadRatio: 0.25, group: 'tricep' },
        { name: 'Dumbbell Skull Crusher',    loadRatio: 0.25, group: 'tricep' },
        { name: 'Dumbbell Kickback',         loadRatio: 0.15, group: 'tricep' },
        { name: 'Tricep Circuit (Dirty 30)', loadRatio: 0.20, group: 'tricep' },
        // Shoulder / trap block
        { name: 'Lateral Raise',    loadRatio: 0.20, group: 'shoulder' },
        { name: 'Incline Y Raise',  loadRatio: 0.15, group: 'shoulder' },
        { name: 'Single-Arm Shrug', loadRatio: 0.60, group: 'shoulder' },
        // R-076, Sam 2026-08-13: "face pull is shoulder work for sure". Moved
        // here from horizontal_pull/accessory, with its two rear-delt siblings.
        { name: 'Face Pull',        loadRatio: 0.20, group: 'shoulder' },
        { name: 'Rear Delt Fly',    loadRatio: 0.15, group: 'shoulder' },
        { name: 'Band Pull-Apart',  loadRatio: 0.10, group: 'shoulder' },
        // Same ruling, same reasoning: a cable face pull is a face pull.
        { name: 'Cable Face Pull',  loadRatio: 0.20, group: 'shoulder' },
      ],
    },
  },
  // isolation_lower: rehab / prehab / tissue-work pool.
  //
  //   - Accessory-only by design. The anchor pool is INTENTIONALLY EMPTY —
  //     these movements (nordic lower, leg extension, calf / tib raises, etc.)
  //     don't carry load-progression the way a squat/hinge anchor does,
  //     and treating them as anchors would seed phantom "progression
  //     transfer" trends. Empty anchor is tolerated by selectPoolEntry
  //     / selectPoolEntryAvoiding callers via a length-0 guard upstream
  //     (applyPoolRotation never invokes rotation for anchor role on
  //     iso_lower because classifyPoolSlot resolves every iso_lower
  //     tagged exercise to role='accessory').
  //
  //   - All loadRatio=0 (no progression transfer; same convention as plyo).
  //     normalizeLoadAcrossSiblings returns input unchanged when either
  //     ratio is 0 (bodyweight guard).
  //
  //   - Rotation order groups: hamstring (Nordic Lower / Hamstring Curl) →
  //     quad (Leg Extension) → calf/ankle (Calf Raises / Tib Raises) →
  //     glute/posterior (Single-Leg Hip Thrust / Back Extension). Intra-session
  //     avoidance spreads multiple AI suggestions across muscle groups cleanly.
  //     The adductor group left this slot when Sam's locked-list changeset
  //     (2026-07-24) retired the Adductor Machine; groin work is now owned by
  //     GROIN_ADDUCTORS_POOL (Copenhagens, Groin Squeeze, Cossack, Lateral Lunge).
  isolation_lower: {
    anchor: {
      slot: 'isolation_lower', role: 'anchor', entries: [],
    },
    accessory: {
      slot: 'isolation_lower', role: 'accessory', entries: [
        // Hamstring block
        { name: 'Nordic Lower',    loadRatio: 0, group: 'hamstring' },
        { name: 'Hamstring Curl',  loadRatio: 0, group: 'hamstring' },
        // Quad block
        { name: 'Leg Extension',   loadRatio: 0, group: 'quad' },
        // Calf / ankle block
        { name: 'Calf Raises',     loadRatio: 0, group: 'calf' },
        { name: 'Tib Raises',       loadRatio: 0, group: 'calf' },
        // Glute / posterior block — Sam's locked-list additions (2026-07-24),
        // which also replaced the retired Adductor Machine in this slot.
        { name: 'Single-Leg Hip Thrust', loadRatio: 0, group: 'glute' },
        { name: 'Back Extension',        loadRatio: 0, group: 'glute' },
      ],
    },
  },
  plyo: {
    anchor: {
      slot: 'plyo', role: 'anchor', entries: [
        { name: 'Box Jumps',   loadRatio: 0 },
        { name: 'Broad Jumps', loadRatio: 0 },
        { name: 'Jump Squats', loadRatio: 0 },
      ],
    },
    accessory: {
      slot: 'plyo', role: 'accessory', entries: [
        { name: 'Lateral Bounds', loadRatio: 0 },
        { name: 'Depth Jumps',    loadRatio: 0 },
      ],
    },
  },
};

// ─── Classification ───

/**
 * Classify an exercise name into its (slot, role).
 *
 * Resolution order:
 *   1. Explicit pool membership (findPoolEntry) — the pool definitions
 *      are the authoritative source of role. An exercise listed in a
 *      pool wins over tag-based heuristics (e.g. DB Bench Press is
 *      tagged load='moderate' but lives in the accessory pool).
 *   2. Tag-based fallback for AI-suggested exercises not in any pool:
 *      lunge / low-load → accessory, otherwise anchor.
 *
 * Returns null if the exercise is not in EXERCISE_TAGS AND not in any
 * pool, or if its movement pattern isn't managed by any pool slot
 * (carry, core, plyo, isolation_upper, conditioning).
 */
export function classifyPoolSlot(
  exerciseName: string,
): { slot: PoolSlotKey; role: PoolRole } | null {
  // 1. Explicit pool membership wins
  const fromPool = findPoolEntry(exerciseName);
  if (fromPool) return { slot: fromPool.slot, role: fromPool.role };

  // 2. Fall back to tag-based heuristic
  const tags = EXERCISE_TAGS[exerciseName];
  if (!tags) return null;

  const slot = PATTERN_TO_SLOT[tags.movement];
  if (!slot) return null;

  // Isolation patterns (upper / lower) are ALWAYS accessories. Nordic Lower
  // is tagged high-fatigue/high-doms but is structurally a rehab/prehab
  // isolation tool, not an anchor. Forcing accessory here prevents any
  // future iso entry from accidentally being mis-classified by the
  // load heuristic.
  if (tags.movement === 'isolation_upper' || tags.movement === 'isolation_lower') {
    return { slot, role: 'accessory' };
  }

  const role: PoolRole =
    tags.movement === 'lunge' ? 'accessory'
    : tags.load === 'low'     ? 'accessory'
    :                           'anchor';

  return { slot, role };
}

/** Return the pool definition for a (slot, role) pair. */
export function getPool(
  slot: PoolSlotKey,
  role: PoolRole,
): PoolDefinition {
  return STRENGTH_POOLS[slot][role];
}

/** Return the sibling entries in the same (slot, role). */
export function getSlotSiblings(
  slot: PoolSlotKey,
  role: PoolRole,
): PoolEntry[] {
  return STRENGTH_POOLS[slot][role].entries;
}

/**
 * Look up a pool entry by exercise name. Returns the entry + its slot/role
 * if the exercise is in any pool, else null.
 */
export function findPoolEntry(
  exerciseName: string,
): { entry: PoolEntry; slot: PoolSlotKey; role: PoolRole } | null {
  for (const slot of Object.keys(STRENGTH_POOLS) as PoolSlotKey[]) {
    for (const role of ['anchor', 'accessory'] as PoolRole[]) {
      const pool = STRENGTH_POOLS[slot][role];
      const entry = pool.entries.find(e => e.name === exerciseName);
      if (entry) return { entry, slot, role };
    }
  }
  return null;
}

// ─── Rotation ───

/**
 * Pick the active pool entry for a rotation context.
 *
 * Anchor cadence:    miniCycleNumber (mod pool length)
 * Accessory cadence: miniCycleNumber + weekInBlock (combined index;
 *                    each week within a block picks a different
 *                    accessory, and the cycle continues across blocks)
 *
 * `previousEntryName` (optional) enforces no back-to-back repetition:
 * if the selected entry matches previous, bump to the next entry in
 * the pool (cyclically). Only applies when the pool has >1 entry.
 */
export function selectPoolEntry(
  pool: PoolDefinition,
  ctx: RotationContext,
  previousEntryName?: string,
): PoolEntry {
  if (pool.entries.length === 0) {
    throw new Error(`Pool ${pool.slot}/${pool.role} has no entries`);
  }
  if (pool.entries.length === 1) return pool.entries[0];

  const base = pool.role === 'anchor'
    ? Math.max(0, ctx.miniCycleNumber - 1)
    : Math.max(0, ctx.miniCycleNumber - 1) * 4
      + Math.max(0, (ctx.weekInBlock ?? 1) - 1);

  let idx = ((base % pool.entries.length) + pool.entries.length) % pool.entries.length;
  let pick = pool.entries[idx];

  if (previousEntryName && pick.name === previousEntryName) {
    idx = (idx + 1) % pool.entries.length;
    pick = pool.entries[idx];
  }

  return pick;
}

/**
 * Walk an ordered entry list, starting at the rotation-indexed position,
 * and return the first entry whose name isn't in `avoid`. Shared helper
 * for `selectPoolEntryAvoiding` — lets the effective (filtered + biased)
 * entry list reuse the same rotation arithmetic as the raw pool.
 *
 * If every entry is avoided, falls back to the rotation-indexed entry
 * (duplicate unavoidable, but deterministic).
 */
function walkEntries(
  entries: readonly PoolEntry[],
  role: PoolRole,
  ctx: RotationContext,
  avoid: ReadonlySet<string>,
): PoolEntry {
  const len = entries.length;
  const base = role === 'anchor'
    ? Math.max(0, ctx.miniCycleNumber - 1)
    : Math.max(0, ctx.miniCycleNumber - 1) * 4
      + Math.max(0, (ctx.weekInBlock ?? 1) - 1);
  const startIdx = ((base % len) + len) % len;

  for (let offset = 0; offset < len; offset++) {
    const idx = (startIdx + offset) % len;
    const pick = entries[idx];
    if (!avoid.has(pick.name)) return pick;
  }
  // Every entry is avoided — fall back to the rotation pick.
  return entries[startIdx];
}

/**
 * Apply athlete prefs (exclusion / injury-avoid filter, caution
 * deprioritization, pin-bias) to a raw pool, producing the effective
 * ordered entry list that rotation walks.
 *
 * Filter pipeline (order matters — exclusion wins all conflicts):
 *   1. Drop entries whose name is in `excluded`.
 *   2. Drop entries whose `EXERCISE_TAGS[name].injury[k] === 'avoid'`
 *      for any `k ∈ activeInjuries`. Entries without tags are kept.
 *   3. Stable-sort remaining entries: 'good' (or no-injury-match) first,
 *      'caution' entries last. Preserves original relative order inside
 *      each group so the mc rotation pattern still holds.
 *   4. Stable-sort: pinned entries first, non-pinned after. Pinned
 *      entries land at rotation-start (first pick wins).
 *
 * Since `excluded` is applied in step 1, any name in both `excluded` and
 * `pinned` is already gone before pin-bias runs — exclusion wins.
 *
 * Returns the effective list plus breakdown counts for the fallback log.
 */
function applyPrefsToPool(
  pool: PoolDefinition,
  prefs: AthletePoolPrefs,
): {
  effective: PoolEntry[];
  excludedCount: number;
  injuryCount: number;
  equipmentCount: number;
} {
  const excludedSet = new Set(prefs.excluded);
  const activeInjuries = prefs.activeInjuries ?? [];

  let excludedCount = 0;
  let injuryCount = 0;
  let equipmentCount = 0;

  const kept: PoolEntry[] = [];
  for (const entry of pool.entries) {
    if (excludedSet.has(entry.name)) {
      excludedCount++;
      continue;
    }
    if (activeInjuries.length > 0) {
      const tag = EXERCISE_TAGS[entry.name];
      if (tag) {
        const hasAvoid = activeInjuries.some((k) => tag.injury[k] === 'avoid');
        if (hasAvoid) {
          injuryCount++;
          continue;
        }
      }
    }
    if (!entryAllowedByEquipment(entry, prefs.availableEquipment)) {
      equipmentCount++;
      continue;
    }
    kept.push(entry);
  }

  // Stable sort — 'good'/no-match first, 'caution' last.
  // (Array.prototype.sort is stable in ES2019+, so original rotation
  // order is preserved inside each group.)
  const withCautionLast =
    activeInjuries.length > 0
      ? [...kept].sort((a, b) => {
          const aCaution = isCautionFor(a.name, activeInjuries);
          const bCaution = isCautionFor(b.name, activeInjuries);
          if (aCaution === bCaution) return 0;
          return aCaution ? 1 : -1;
        })
      : kept;

  // Stable sort — pinned first.
  const pinSet = new Set(prefs.pinned);
  const effective =
    pinSet.size > 0
      ? [...withCautionLast].sort((a, b) => {
          const aPinned = pinSet.has(a.name);
          const bPinned = pinSet.has(b.name);
          if (aPinned === bPinned) return 0;
          return aPinned ? -1 : 1;
        })
      : withCautionLast;

  return { effective, excludedCount, injuryCount, equipmentCount };
}

function isCautionFor(name: string, activeInjuries: readonly InjuryKey[]): boolean {
  const tag = EXERCISE_TAGS[name];
  if (!tag) return false;
  return activeInjuries.some((k) => tag.injury[k] === 'caution');
}

function equipmentClassesForTags(
  tags: readonly EquipmentTag[] | undefined,
): ReadonlySet<EquipmentClass> | null {
  if (!tags || tags.length === 0) return null;
  const out = new Set<EquipmentClass>();
  for (const tag of tags) {
    if (tag === 'bodyweight') out.add('bodyweight');
    else if (tag === 'dumbbells') out.add('dumbbell');
    else if (tag === 'barbell') out.add('barbell');
    else if (tag === 'cables') out.add('cable');
    else if (tag === 'machine') out.add('machine');
    else if (tag === 'kettlebell') out.add('kettlebell');
  }
  return out;
}

function entryAllowedByEquipment(
  entry: PoolEntry,
  availableEquipment: readonly EquipmentTag[] | undefined,
): boolean {
  return exerciseAllowedByEquipment(entry.name, availableEquipment);
}

/**
 * CAN THIS ATHLETE PERFORM THIS LIFT AT ALL?
 *
 * Extracted from `entryAllowedByEquipment` (which now calls it) so callers
 * OUTSIDE the pools can ask the same question of a bare NAME — the canonicaliser
 * restores rows from a hardcoded table and had no way to ask it.
 *
 * **R-083 (Sam, 2026-08-13) is why it is public:** *"ya can't do much with
 * overhead pushing or pull or even horizontal pulling without equipment - i
 * can't account for everyone and if they want to train properly they'll sign up
 * to a gym"*. A pattern a kit cannot train is REMOVED, not substituted — and
 * removing needs a legality test, where substituting only needed a pool.
 *
 * Unknown equipment class and unknown kit both answer TRUE: this refuses only
 * what it can prove is impossible.
 */
export function exerciseAllowedByEquipment(
  name: string,
  availableEquipment: readonly EquipmentTag[] | undefined,
): boolean {
  // ── SAM'S AVAILABILITY ANSWER OUTRANKS THE LOAD CLASSIFIER ────────────────
  //
  // `equipmentClassFor` answers **"what does this lift LOAD with"**. Asked
  // "can this athlete do it", it is wrong in BOTH directions at once, and on
  // exactly the exercises R-083 names: a `Pull-Up` carries no load and needs a
  // BAR, so it classed `bodyweight` and sailed through; `Walking Lunges` is
  // classed `dumbbell` and was refused, though it is still a walking lunge
  // without them. **That is one field answering two questions, and it is why
  // the second site dropped the single-leg slot while keeping the pull-up.**
  //
  // `exerciseIsAvailableWith` reads Sam's authored sheet, plus the small set of
  // movements he has ruled performable unloaded. Where he has answered, HIS
  // ANSWER DECIDES and the load classifier is not consulted at all.
  if (equipmentRequiredFor(name) !== null) {
    return exerciseIsAvailableWith(name, availableEquipment);
  }

  // Not on his sheet: fall back to the load classifier, which is the only
  // signal left. It stays wrong in the ways described above, and the fix is a
  // sheet row, not a cleverer inference here.
  const allowed = equipmentClassesForTags(availableEquipment);
  if (!allowed) return true;
  const klass = equipmentClassFor(name);
  if (!klass) return true;
  return klass === 'bodyweight' || allowed.has(klass);
}

function entriesAllowedByEquipment(
  pool: PoolDefinition,
  prefs: AthletePoolPrefs | undefined,
): PoolEntry[] {
  if (!prefs?.availableEquipment?.length) return pool.entries;
  return pool.entries.filter((entry) =>
    entryAllowedByEquipment(entry, prefs.availableEquipment),
  );
}

function siblingRole(role: PoolRole): PoolRole {
  return role === 'anchor' ? 'accessory' : 'anchor';
}

function trainingAgePoolForSlot(
  slot: PoolSlotKey,
  prefs: AthletePoolPrefs | undefined,
): PoolDefinition | null {
  const policy = resolveTrainingAgePolicy(prefs?.experienceLevel);
  if (policy.level !== 'new') return null;
  const priority = policy.exercisePriority[slot as TrainingAgePoolSlot];
  if (!priority?.length) return null;

  // New athletes keep one stable curriculum across the block. Using one
  // synthetic anchor pool also lets main and secondary rows share the same
  // within-session avoidance set, so they cannot collapse to duplicates.
  return {
    slot,
    role: 'anchor',
    entries: priority.map((name) => ({ name, loadRatio: 0 })),
  };
}

/**
 * WHY A SLOT CAME BACK EMPTY.
 *
 * ONE MEMBER TODAY, AND THAT IS DELIBERATE. Only the EQUIPMENT cause refuses
 * (R-083); exclusion and injury still fall through to the raw pool, which is the
 * pre-existing "Option 2" policy and is NOT in this change's scope. The type is
 * a union of one so that adding the other two later is a widening the compiler
 * walks the callers through, rather than a boolean quietly changing meaning.
 */
export type PoolRefusalCause = 'equipment';

/**
 * THE ANSWER A POOL MAY GIVE, AND "NOTHING" IS ONE OF THEM.
 *
 * R-083 (Sam, 2026-08-13): *"ya can't do much with overhead pushing or pull or
 * even horizontal pulling without equipment - i can't account for everyone and
 * if they want to train properly they'll sign up to a gym"*. **A pattern a kit
 * cannot train is REMOVED, not substituted** — so "no legal entry" has to be
 * REPRESENTABLE. It was not: the filter emptied the pool, a warning was logged,
 * and the RAW pool was walked anyway, which is how a bodyweight-only athlete was
 * handed Pull-Ups, Barbell Row, Face Pull, Overhead Press and Lateral Raise.
 *
 * A union rather than `null` because the caller has to say WHY the row is gone,
 * and because the compiler then refuses to let a caller ignore the refusal.
 */
export type PoolSelection =
  | { readonly kind: 'entry'; readonly entry: PoolEntry }
  | {
      readonly kind: 'refused';
      readonly slot: PoolSlotKey;
      readonly role: PoolRole;
      readonly cause: PoolRefusalCause;
      readonly counts: {
        readonly excluded: number;
        readonly injury: number;
        readonly equipment: number;
      };
    };

/**
 * Same as selectPoolEntry, but skips entries whose names appear in `avoid`.
 * Used to prevent duplicate picks when multiple AI-suggested exercises in a
 * single session all map to the same (slot, role).
 *
 * Walks the pool starting from the rotation-indexed entry; if it's in
 * `avoid`, advances cyclically until an unused entry is found. If every
 * entry is avoided (pool smaller than concurrent uses), falls back to
 * the rotation-indexed entry.
 *
 * `prefs` (optional): athlete overrides. When present, the pool is
 * filtered/biased by `applyPrefsToPool` before the rotation walk.
 *
 * ── WHEN THE KIT EMPTIES THE POOL, THE SLOT IS REFUSED (R-083) ─────────────
 *
 * It used to fall through to the RAW pool ("Option 2" in
 * `docs/pool-refinements-design.md`, written before R-083 existed). For the
 * EQUIPMENT filter that policy prescribes a lift the athlete physically cannot
 * do, which is the whole of Sam's ruling: *"i can't account for everyone and if
 * they want to train properly they'll sign up to a gym"* — a pattern the kit
 * cannot train is REMOVED, not substituted.
 *
 * THE TEST IS "COULD THE KIT ALONE HAVE EMPTIED IT", NOT "WAS THE POOL EMPTY".
 * Asking whether the equipment COUNT is non-zero would refuse a slot that an
 * exclusion emptied and equipment merely trimmed — a different fact with a
 * different owner. Asked this way the refusal is exactly the impossible case.
 *
 * EXCLUSION AND INJURY STILL FALL THROUGH, unchanged, log and all. Neither is
 * in this change's scope: both re-prescribe something the athlete asked not to
 * have rather than something they cannot do, and neither has a ruling behind a
 * refusal yet.
 */
export function selectPoolEntryAvoiding(
  pool: PoolDefinition,
  ctx: RotationContext,
  avoid: ReadonlySet<string>,
  prefs?: AthletePoolPrefs,
): PoolSelection {
  if (pool.entries.length === 0) {
    throw new Error(`Pool ${pool.slot}/${pool.role} has no entries`);
  }
  if (pool.entries.length === 1) return { kind: 'entry', entry: pool.entries[0] };

  if (prefs) {
    const { effective, excludedCount, injuryCount, equipmentCount } = applyPrefsToPool(pool, prefs);
    if (effective.length === 0) {
      const kitCanTrainNothingHere = pool.entries.every(
        (entry) => !entryAllowedByEquipment(entry, prefs.availableEquipment),
      );
      if (kitCanTrainNothingHere) {
        // eslint-disable-next-line no-console
        console.warn(
          `[pool-slot-refused] slot=${pool.slot} role=${pool.role} cause=equipment ` +
            `— no exercise in this pool is possible on this athlete's kit`,
        );
        return {
          kind: 'refused',
          slot: pool.slot,
          role: pool.role,
          cause: 'equipment',
          counts: { excluded: excludedCount, injury: injuryCount, equipment: equipmentCount },
        };
      }
      // Fall through to raw pool; surface why via structured log so an
      // operator can see which prefs collapsed the slot.
      // eslint-disable-next-line no-console
      console.warn(
        `[pool-override-fallback] slot=${pool.slot} filtered=0 → using raw pool ` +
          `(excluded=${excludedCount}, injury=${injuryCount}, equipment=${equipmentCount})`,
      );
      return { kind: 'entry', entry: walkEntries(pool.entries, pool.role, ctx, avoid) };
    }
    return { kind: 'entry', entry: walkEntries(effective, pool.role, ctx, avoid) };
  }

  return { kind: 'entry', entry: walkEntries(pool.entries, pool.role, ctx, avoid) };
}

/**
 * Apply pool rotation to an AI-suggested exercise name.
 *
 * If the suggested exercise maps to a managed (slot, role), rewrite it
 * to the rotation-selected variant for the given context. Otherwise
 * return the name unchanged.
 *
 * `usedInSession` (optional): a map `${slot}:${role}` → Set<name> that the
 * caller mutates to track pool selections already used within a single
 * session. Prevents the same pool pick from being produced twice when
 * the AI proposes multiple exercises in the same (slot, role).
 *
 * `prefs` (optional): per-athlete pool overrides (exclusion / pinning /
 * active-injury filter). Threaded into `selectPoolEntryAvoiding`. When
 * undefined (or every pref field is empty), behaviour is identical to
 * the refinement-2 baseline.
 *
 * Note: if an athlete has excluded the AI's original `suggestedName`
 * itself, the rotation walk still picks a valid sibling from the
 * filtered pool — excluded names can't be returned because they were
 * dropped before the walk.
 *
 * **RETURNS AN OUTCOME, NOT A NAME (R-083).** When every entry the athlete's
 * kit, exclusions or live injuries leave is gone, there IS no name, and the
 * caller must remove the row rather than write one. See `PoolSelection`.
 */
export type PoolRotationOutcome =
  | { readonly kind: 'name'; readonly name: string }
  | {
      readonly kind: 'refused';
      /** What the producer asked for, so the removal can name it. */
      readonly suggestedName: string;
      readonly slot: PoolSlotKey;
      readonly role: PoolRole;
      readonly cause: PoolRefusalCause;
    };

export function applyPoolRotation(
  suggestedName: string,
  ctx: RotationContext,
  usedInSession?: Map<string, Set<string>>,
  prefs?: AthletePoolPrefs,
): PoolRotationOutcome {
  const unchanged: PoolRotationOutcome = { kind: 'name', name: suggestedName };
  const classification = classifyPoolSlot(suggestedName);
  if (!classification) return unchanged;

  const { slot, role } = classification;
  let selectedRole = role;
  let pool = getPool(slot, role);
  const trainingAgePool = trainingAgePoolForSlot(slot, prefs);
  if (trainingAgePool) {
    pool = trainingAgePool;
    selectedRole = trainingAgePool.role;
  }
  // Defensive: pool shape allows empty entries for accessory-only slots
  // (e.g. isolation_lower.anchor is []). classifyPoolSlot's guards should
  // prevent routing here, but fall through untouched if we ever do land
  // on an empty pool rather than throwing.
  if (pool.entries.length === 0) return unchanged;

  // ── ROTATION MAY NOT CROSS A MUSCLE GROUP ────────────────────────────────
  //
  // A slot says what MOVEMENT this is; `PoolEntry.group` says what it TRAINS.
  // `isolation_upper/accessory` holds biceps, triceps and shoulders in one list,
  // and `selectPoolEntry` picks by `cycleIndex % entries.length` across all of
  // it — so a tricep pushdown could rotate into a bicep curl. Measured shipping
  // `Bicep Curl (Barbell) | Bicep Curl (Dumbbell) | Hammer Curl`: three curls,
  // no triceps, which is `:227`'s "two squats" in arm form.
  //
  // NARROW BY DESIGN. Only entries that DECLARE a group are constrained, and
  // only when the suggested exercise has one — a slot whose entries are all the
  // same thing (every squat anchor is a squat) is untouched, and an exercise
  // that is not in any pool still rotates exactly as before.
  const suggestedGroup = findPoolEntry(suggestedName)?.entry.group;
  const fullPool = pool;
  if (suggestedGroup) {
    const sameGroup = pool.entries.filter((entry) => entry.group === suggestedGroup);
    if (sameGroup.length > 0) pool = { ...pool, entries: sameGroup };
  }
  if (
    prefs?.availableEquipment?.length &&
    entriesAllowedByEquipment(pool, prefs).length === 0
  ) {
    const fallbackRole = siblingRole(role);
    const fallbackPool = getPool(slot, fallbackRole);
    if (
      fallbackPool.entries.length > 0 &&
      entriesAllowedByEquipment(fallbackPool, prefs).length > 0
    ) {
      // eslint-disable-next-line no-console
      console.warn(
        `[pool-equipment-role-fallback] slot=${slot} role=${role} filtered=0 by equipment ` +
          `→ using ${fallbackRole}`,
      );
      pool = fallbackPool;
      selectedRole = fallbackRole;
    }
  }

  const key = `${slot}:${selectedRole}`;

  let avoid: Set<string>;
  if (usedInSession) {
    avoid = usedInSession.get(key) ?? new Set<string>();
  } else {
    avoid = new Set<string>();
  }

  // ── ROTATION STAYS IN ITS GROUP; AVOIDANCE MAY LEAVE IT ──────────────────
  //
  // TWO DIFFERENT JOBS SHARE THIS FUNCTION AND THEY WANT OPPOSITE THINGS, which
  // is why the first version of the group rule broke a real behaviour:
  //
  //   ROTATION — vary ONE exercise across cycles. Crossing a group here is the
  //     defect: a tricep pushdown must not become a bicep curl.
  //   AVOIDANCE — a session suggested the same exercise more than once, and the
  //     picks must differ. Crossing a group here is the FEATURE: three
  //     `isolation_lower` rows should come back hamstring / quad / calf, not the
  //     same muscle twice.
  //
  // So the group narrows the pool for the ordinary pick, and is RELEASED only
  // when every in-group candidate is already used in this session. A cell holds
  // each half — rotation never leaves its group across 12 cycles, and three
  // Nordic Lower suggestions still resolve to three distinct picks.
  let selection = selectPoolEntryAvoiding(pool, ctx, avoid, prefs);
  // A GROUP-NARROWED POOL THAT REFUSES IS NOT THE SLOT REFUSING. The narrowing
  // is this function's own doing (one muscle group out of a mixed slot), so a
  // refusal there must re-ask the whole slot before it becomes the athlete's
  // answer — otherwise "no legal tricep row" would delete a legal bicep row too.
  if (
    (selection.kind === 'refused' || avoid.has(selection.entry.name)) &&
    suggestedGroup &&
    fullPool.entries.length > pool.entries.length
  ) {
    selection = selectPoolEntryAvoiding(fullPool, ctx, avoid, prefs);
  }
  if (selection.kind === 'refused') {
    return {
      kind: 'refused',
      suggestedName,
      slot: selection.slot,
      role: selection.role,
      cause: selection.cause,
    };
  }
  const pick = selection.entry;

  if (usedInSession) {
    const existing = usedInSession.get(key);
    if (existing) {
      existing.add(pick.name);
    } else {
      usedInSession.set(key, new Set([pick.name]));
    }
  }

  return { kind: 'name', name: pick.name };
}

// ─── Load Ratio Normalization (progression transfer) ───

/**
 * Translate a load prescribed/performed under `fromName` to an equivalent
 * load under `toName`. Used when rotation swaps anchors mid-program.
 *
 * If either exercise isn't in any pool, or they're in different slots,
 * returns the input load unchanged.
 *
 * Example: Back Squat 100 kg → Front Squat ≈ 85 kg
 *   fromRatio = 1.00, toRatio = 0.85 → 100 × (0.85 / 1.00) = 85
 */
export function normalizeLoadAcrossSiblings(
  loadKg: number,
  fromName: string,
  toName: string,
): number {
  if (fromName === toName) return loadKg;
  const from = findPoolEntry(fromName);
  const to = findPoolEntry(toName);
  if (!from || !to) return loadKg;
  if (from.slot !== to.slot || from.role !== to.role) return loadKg;
  if (from.entry.loadRatio <= 0 || to.entry.loadRatio <= 0) {
    // Bodyweight or zero-ratio: no translation, treat as fresh exposure
    return loadKg;
  }
  return loadKg * (to.entry.loadRatio / from.entry.loadRatio);
}
