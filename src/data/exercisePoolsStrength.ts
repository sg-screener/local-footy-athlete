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
import type { ExperienceLevel, WeekKind } from '../types/domain';
import { EXERCISE_LOAD_MAP, type EquipmentClass } from '../utils/loadEstimation';
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

export interface PoolEntry {
  /** Must match an EXERCISE_TAGS key (or be resolvable by findOrCreateExercise). */
  name: string;
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
      ],
    },
    accessory: {
      slot: 'squat', role: 'accessory', entries: [
        { name: 'Walking Lunges',         loadRatio: 0.45 },
        { name: 'Bulgarian Split Squats', loadRatio: 0.40 },
        { name: 'Reverse Lunges',         loadRatio: 0.45 },
        { name: 'Step Ups',               loadRatio: 0.40 },
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
      slot: 'hinge', role: 'accessory', entries: [
        { name: 'Single-Leg RDL',    loadRatio: 0.45 },
        { name: 'Hip Thrusts',       loadRatio: 1.10 },
        { name: 'Kettlebell Swings', loadRatio: 0.35 },
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
      slot: 'horizontal_pull', role: 'accessory', entries: [
        { name: 'Seated Cable Row', loadRatio: 0.90 },
        { name: 'Face Pull',        loadRatio: 0.20 },
        { name: 'Rear Delt Fly',    loadRatio: 0.15 },
        { name: 'Band Pull-Apart',  loadRatio: 0.10 },
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
        { name: 'Straight-Arm Pulldown',   loadRatio: 0.50 },
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
    anchor: {
      slot: 'carry', role: 'anchor', entries: [
        { name: 'Farmer Carry',   loadRatio: 1.00 },
        // Bear-hug/sandbag carries usually cap out before farmer handles, so
        // use ~75% of Farmer Carry as the carry-slot load reference.
        { name: 'Bear Carry',     loadRatio: 0.75 },
        { name: 'Overhead Carry', loadRatio: 0.55 },
      ],
    },
    accessory: {
      slot: 'carry', role: 'accessory', entries: [
        { name: 'Suitcase Carry', loadRatio: 0.60 },
        { name: 'Zercher Carry',  loadRatio: 0.55 },
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
        { name: 'Bicep Curl (Barbell)',   loadRatio: 0.25 },
        { name: 'Bicep Curl (Dumbbell)',  loadRatio: 0.20 },
        { name: 'Hammer Curl',            loadRatio: 0.20 },
        { name: 'Incline Dumbbell Curl',  loadRatio: 0.18 },
        { name: 'Lying Dumbbell Curl',    loadRatio: 0.18 },
        { name: 'Banded Bicep Curl',      loadRatio: 0.15 },
        { name: 'Concentration Curl',     loadRatio: 0.15 },
        // Tricep block
        { name: 'Tricep Pushdown',           loadRatio: 0.30 },
        { name: 'Banded Tricep Pushdown',    loadRatio: 0.20 },
        { name: 'Overhead Tricep Extension', loadRatio: 0.25 },
        { name: 'Dumbbell Skull Crusher',    loadRatio: 0.25 },
        { name: 'Dumbbell Kickback',         loadRatio: 0.15 },
        { name: 'Tricep Circuit (Dirty 30)', loadRatio: 0.20 },
        // Shoulder / trap block
        { name: 'Lateral Raise',    loadRatio: 0.20 },
        { name: 'Incline Y Raise',  loadRatio: 0.15 },
        { name: 'Single-Arm Shrug', loadRatio: 0.60 },
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
  //   - Rotation order groups: hamstring (Nordic Lower) →
  //     quad (Leg Extension) → calf/ankle (Calf Raises / Tib Raise) →
  //     adductor (Adductor Machine). Intra-session avoidance spreads
  //     multiple AI suggestions across muscle groups cleanly.
  isolation_lower: {
    anchor: {
      slot: 'isolation_lower', role: 'anchor', entries: [],
    },
    accessory: {
      slot: 'isolation_lower', role: 'accessory', entries: [
        // Hamstring block
        { name: 'Nordic Lower',    loadRatio: 0 },
        // Quad block
        { name: 'Leg Extension',   loadRatio: 0 },
        // Calf / ankle block
        { name: 'Calf Raises',     loadRatio: 0 },
        { name: 'Tib Raise',       loadRatio: 0 },
        // Adductor block
        { name: 'Adductor Machine', loadRatio: 0 },
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
  const allowed = equipmentClassesForTags(availableEquipment);
  if (!allowed) return true;
  const klass = EXERCISE_LOAD_MAP[entry.name]?.equipment;
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
 * When the filter empties the pool, logs a structured line and falls
 * through to the raw pool (Option 2 from the design doc).
 */
export function selectPoolEntryAvoiding(
  pool: PoolDefinition,
  ctx: RotationContext,
  avoid: ReadonlySet<string>,
  prefs?: AthletePoolPrefs,
): PoolEntry {
  if (pool.entries.length === 0) {
    throw new Error(`Pool ${pool.slot}/${pool.role} has no entries`);
  }
  if (pool.entries.length === 1) return pool.entries[0];

  if (prefs) {
    const { effective, excludedCount, injuryCount, equipmentCount } = applyPrefsToPool(pool, prefs);
    if (effective.length === 0) {
      // Fall through to raw pool; surface why via structured log so an
      // operator can see which prefs collapsed the slot.
      // eslint-disable-next-line no-console
      console.warn(
        `[pool-override-fallback] slot=${pool.slot} filtered=0 → using raw pool ` +
          `(excluded=${excludedCount}, injury=${injuryCount}, equipment=${equipmentCount})`,
      );
    } else {
      return walkEntries(effective, pool.role, ctx, avoid);
    }
  }

  return walkEntries(pool.entries, pool.role, ctx, avoid);
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
 */
export function applyPoolRotation(
  suggestedName: string,
  ctx: RotationContext,
  usedInSession?: Map<string, Set<string>>,
  prefs?: AthletePoolPrefs,
): string {
  const classification = classifyPoolSlot(suggestedName);
  if (!classification) return suggestedName;

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
  if (pool.entries.length === 0) return suggestedName;
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

  const pick = selectPoolEntryAvoiding(pool, ctx, avoid, prefs);

  if (usedInSession) {
    const existing = usedInSession.get(key);
    if (existing) {
      existing.add(pick.name);
    } else {
      usedInSession.set(key, new Set([pick.name]));
    }
  }

  return pick.name;
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
