/**
 * Power exercise pool + pure selector.
 *
 * SOURCE OF TRUTH: `docs/POWER_EXERCISE_POOL_SPEC_2026-07-23.md`
 * (Sam's decisions, APPROVED design input). Invariants in
 * `powerExercisePoolTests`.
 *
 * ── Why this exists ──
 *
 * The program builder used to hardcode exercise IDENTITY: lower -> Vertical
 * Jump, or Pogo Hops when reduced; upper -> Explosive Push-up. Adding Sam's four
 * new entries by extending that conditional would deepen exactly the shape the
 * exercise-name literal sweep exists to catch. So identity selection is a typed
 * POOL plus a pure selector here in the rules layer, and the row builder
 * consumes the result.
 *
 * ── Ownership split (unchanged law) ──
 *
 *   `decidePowerPrimer` (policy)  WHETHER power happens, and the DOSE
 *                                 (sets / repsMin / repsMax / primer vs
 *                                 contrast / reduced). Untouched by this file.
 *   `selectPowerExercise` (here)  WHICH exercise. Identity only.
 *   `buildPowerRow`               renders the selection as a row.
 *
 * That split is why no entry below carries sets or reps, and why the selector
 * returns identity with no dose fields: a pool entry that carried a dose would
 * give the app two answers to "how many reps", and the tests fail if one
 * appears (spec rule 6).
 *
 * ── Experience gating ──
 *
 * ONE ladder — `TrainingAgeLevel`, owned by `experienceCrosswalk`. Each entry
 * declares `minTrainingAge` on it. This SUBSUMES the policy's boolean
 * `isBeginner`/`experienced` pair for the purpose of exercise selection: the
 * selector reads the ladder directly rather than adding a third
 * representation. The policy keeps those booleans for its own dose decisions.
 *
 * ── WIRED ──
 *
 * `buildPowerRow` (in `defaultProgram.ts`) calls `selectPowerExercise` for every
 * power row it builds, and the pool is one of the selectability sources, so its
 * names carry curated cues and demo videos like any other exercise. The
 * `power_pool_pending` exemption that once waived cue+video+pool for these
 * names is gone — Sam authored the missing cues.
 *
 * (This header said "NOT WIRED — nothing calls this yet" long after wiring; it
 * was corrected when power became a row, 2026-07-28.)
 *
 * The athlete override (spec rule 2 / invariant P8) is ruled into execution
 * order step 5, where the per-session controls (+ / - / swap / move) get
 * designed once — a power-only affordance would be the special case Sam
 * rejected. Diagnose findings are attached to the Step 5 queue in
 * `docs/SAM_EXECUTION_ORDER_2026-07-25.md`.
 */

import type { SeasonPhase } from '../types/domain';
import {
  TRAINING_AGE_LEVELS,
  meetsTrainingAgeMinimum,
  type TrainingAgeLevel,
} from './experienceCrosswalk';
import type { PowerFamily, PowerKind } from './powerPrimerPolicy';

/* ── Entries ── */

/** Phases an entry may be prescribed in. */
export type PowerPhaseGate = 'all_phases' | 'off_and_pre_season_only';

/**
 * One pool entry. Identity, gates and equipment ONLY — never a dose.
 *
 * `cue` is Sam's authored intent from the spec table, kept for provenance and
 * for whoever authors the curated cues. It is NOT a rendering channel: rows
 * render `EXERCISE_CUES`, and adding a second cue source here would recreate
 * the `block.notes` bypass this pool is meant to help retire.
 */
export interface PowerPoolEntry {
  readonly name: string;
  readonly family: PowerFamily;
  /** Equipment the entry needs. Empty = bodyweight. */
  readonly equipmentRequired: readonly string[];
  /** Minimum ladder level, or null when there is no experience bar. */
  readonly minTrainingAge: TrainingAgeLevel | null;
  readonly phaseGate: PowerPhaseGate;
  /**
   * True when the entry is familiar / low-impact enough for in-season use.
   * In-season power is a small primer (the policy already restricts the dose);
   * this is the impact gate the pool adds on top.
   */
  readonly inSeasonSafe: boolean;
  /**
   * Reserved for the reduced (niggle) slot takeover rather than ordinary
   * selection. Pogo Hops is never an ordinary pick.
   */
  readonly reducedTakeoverOnly: boolean;
  /** Sam's authored cue intent, from the spec table. Provenance, not rendering. */
  readonly authoredCueIntent: string;
}

/** The exercise that takes over the lower slot on a reduced (niggle) day. */
export const POWER_POOL_REDUCED_TAKEOVER = 'Pogo Hops';

/**
 * Sam's pool. The first three are existing behaviour turned into data; the last
 * four are his 2026-07-23 additions.
 */
export const POWER_EXERCISE_POOL: readonly PowerPoolEntry[] = [
  {
    name: 'Vertical Jump',
    family: 'lower',
    equipmentRequired: [],
    minTrainingAge: null,
    phaseGate: 'all_phases',
    inSeasonSafe: true,
    reducedTakeoverOnly: false,
    authoredCueIntent: 'Every rep fast and sharp. Stop if reps get slow.',
  },
  {
    name: 'Pogo Hops',
    family: 'lower',
    equipmentRequired: [],
    minTrainingAge: null,
    phaseGate: 'all_phases',
    inSeasonSafe: true,
    // "ONLY when reduced (lower niggle) — takes over the slot".
    reducedTakeoverOnly: true,
    authoredCueIntent: 'Short, springy contacts. Keep it light.',
  },
  {
    name: 'Explosive Push-up',
    family: 'upper',
    equipmentRequired: [],
    minTrainingAge: null,
    phaseGate: 'all_phases',
    inSeasonSafe: true,
    reducedTakeoverOnly: false,
    authoredCueIntent: 'Push hard enough to leave the floor. Land soft.',
  },
  {
    name: 'Depth Jumps',
    family: 'lower',
    equipmentRequired: ['Box'],
    minTrainingAge: 'developing',
    phaseGate: 'off_and_pre_season_only',
    inSeasonSafe: false,
    reducedTakeoverOnly: false,
    authoredCueIntent: 'Step off box, absorb force and explode into vertical jump',
  },
  {
    name: 'Lateral Jump',
    family: 'lower',
    equipmentRequired: [],
    // "no training-age minimum (beginner friendly)".
    minTrainingAge: null,
    phaseGate: 'all_phases',
    inSeasonSafe: true,
    reducedTakeoverOnly: false,
    authoredCueIntent: 'Jump sideways off one leg, land on two',
  },
  {
    name: 'Lateral Bounds',
    family: 'lower',
    equipmentRequired: [],
    minTrainingAge: 'developing',
    phaseGate: 'off_and_pre_season_only',
    inSeasonSafe: false,
    reducedTakeoverOnly: false,
    authoredCueIntent:
      'Jump sideways off one leg, land on the other leg straight into next bound; can do while moving forward',
  },
  {
    name: 'Kneeling Jump',
    family: 'lower',
    // Sam's words: "consistent or advanced".
    equipmentRequired: [],
    minTrainingAge: 'consistent',
    phaseGate: 'off_and_pre_season_only',
    inSeasonSafe: false,
    reducedTakeoverOnly: false,
    authoredCueIntent: 'Start on knees, explode up to feet in one smooth motion',
  },
];

/* ── Selection ── */

export interface PowerSelectionContext {
  readonly family: PowerFamily;
  readonly phase: SeasonPhase;
  /** The athlete's level on the one ladder. */
  readonly trainingAge: TrainingAgeLevel;
  /** Policy's reduced flag — a mild same-region niggle. */
  readonly reduced: boolean;
  /** Equipment the athlete has. Matched case-insensitively. */
  readonly availableEquipment: readonly string[];
  /**
   * Training-block identity. The pick is stable for this value and rotates when
   * it changes, which is what makes the choice the same every week within a
   * block and different across blocks.
   */
  readonly blockId: string;
  /**
   * Primer or contrast. Carried for call-site clarity only: contrast draws from
   * the SAME pool with the same block-stable pick (spec rule 5), so it must not
   * change the outcome.
   */
  readonly kind?: PowerKind;
}

function hasEquipment(
  entry: PowerPoolEntry,
  available: readonly string[],
): boolean {
  if (entry.equipmentRequired.length === 0) return true;
  const owned = new Set(available.map((item) => item.trim().toLowerCase()));
  // Requirements resolve through the SAME mapper the availability check uses,
  // so an authored string like 'Box' meets the athlete's `plyo_box` answer.
  // The literal comparison this replaces could never match a resolved tag,
  // which kept Depth Jumps unselectable for every athlete until Sam's audit
  // ruling (2026-07-31) made the box askable.
  return entry.equipmentRequired.every((needed) => {
    if (owned.has(needed.trim().toLowerCase())) return true;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { equipmentTagsForRequirement } = require('../utils/equipmentAvailability');
    const tags = equipmentTagsForRequirement(needed) as readonly string[] | null;
    return !!tags && tags.some((tag) => owned.has(tag));
  });
}

/**
 * Every entry the athlete may be given, in pool order.
 *
 * Excludes the reduced-takeover entry: on a reduced day the takeover is applied
 * by `selectPowerExercise` rather than competing for an ordinary slot.
 */
export function eligiblePowerExercises(
  context: PowerSelectionContext,
): readonly PowerPoolEntry[] {
  return POWER_EXERCISE_POOL.filter((entry) => {
    if (entry.family !== context.family) return false;
    if (entry.reducedTakeoverOnly) return false;
    if (context.phase === 'In-season' && !entry.inSeasonSafe) return false;
    if (entry.phaseGate === 'off_and_pre_season_only' && context.phase === 'In-season') {
      return false;
    }
    if (
      entry.minTrainingAge !== null &&
      !meetsTrainingAgeMinimum(context.trainingAge, entry.minTrainingAge)
    ) {
      return false;
    }
    return hasEquipment(entry, context.availableEquipment);
  });
}

/**
 * A small, stable hash of the block identity and the cell it is picking for.
 *
 * Deterministic on purpose — no `Math.random`, no date. Two athletes in the same
 * cell and block get the same pick, and the same athlete gets the same pick all
 * block long. FNV-1a because it is short, dependency-free and spreads adjacent
 * block ids (`block-1`, `block-2`) across different buckets, which is what makes
 * rotation actually rotate.
 */
function rotationHash(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * WHICH power exercise this session gets. Pure and deterministic.
 *
 * Returns null only when the cell genuinely has no eligible entry; the tests
 * assert that never happens for a real (family, phase, experience) cell, even
 * with zero equipment.
 *
 * Note what is NOT an input: the week, the date, and `kind`. The pick must be
 * identical every week inside a block, and contrast must not prefer a different
 * exercise from the primer.
 */
export function selectPowerExercise(
  context: PowerSelectionContext,
): PowerPoolEntry | null {
  // Rule 3: reduced hands the lower slot to Pogo Hops, whatever else is
  // eligible. It is the SLOT rule, not a per-exercise one, so it applies across
  // every level and phase — but only to the family that carries the niggle.
  if (context.reduced && context.family === 'lower') {
    const takeover = POWER_EXERCISE_POOL.find(
      (entry) => entry.name === POWER_POOL_REDUCED_TAKEOVER,
    );
    if (takeover) return takeover;
  }

  const eligible = eligiblePowerExercises(context);
  if (eligible.length === 0) return null;
  if (eligible.length === 1) return eligible[0];

  // Rotate on block identity plus the cell, so a phase or experience change
  // does not silently keep an athlete on the same movement forever.
  const seed = `${context.blockId}|${context.family}|${context.phase}|${context.trainingAge}`;
  return eligible[rotationHash(seed) % eligible.length];
}

/** Whether a name is in the pool at all — for wiring-time reconciliation. */
export function isPowerPoolExercise(name: string): boolean {
  return POWER_EXERCISE_POOL.some((entry) => entry.name === name);
}

/** Every ladder level, re-exported so callers need not reach past this module. */
export const POWER_POOL_LADDER = TRAINING_AGE_LEVELS;
