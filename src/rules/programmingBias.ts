/**
 * Deterministic role + goal programming bias.
 *
 * PURPOSE
 * -------
 * The athlete's football role and training goals should *nudge* deterministic
 * programming by a small amount (~5–15%) — never override it. This module is a
 * pure, side-effect-free helper that maps (role, goals, phase) → a small bias
 * vector plus an optional conditioning-category preference used to re-order the
 * (already gate-filtered) conditioning category priority list.
 *
 * SAFETY MODEL (why this is safe to consume)
 * ------------------------------------------
 *  - Bias is SMALL. Every numeric output is clamped to ±`MAX_BIAS` (15%).
 *  - Bias is PHASE-SCALED. Off-season expresses the most bias, pre-season less,
 *    in-season the least (`PHASE_SCALE`). `phaseAdjustedWeight` exposes the
 *    global scalar so consumers can see how much bias is live this phase.
 *  - The ONLY thing wired into session selection is
 *    `conditioningCategoryPreference`, and it is applied by
 *    `applyConditioningCategoryBias` which RE-ORDERS an existing list — it can
 *    never ADD a category. Because the engine filters categories through the
 *    injury / readiness / deload / cap gates BEFORE the re-order, those gates
 *    always win: a category the gate removed can never be re-introduced by bias.
 *  - The conditioning-category preference is GOAL-driven, not role-driven. A
 *    default athlete (no goals, no explicit role) gets an EMPTY preference, so
 *    the re-order is an identity no-op and existing rotation behaviour is
 *    untouched. Role only modulates the *exposed* bias magnitudes.
 *  - Beginner policy dampens all bias and zeroes aggressive (speed) bias.
 *  - Equipment constraints live in exercise selection and are never touched
 *    here — bias only expresses category *preference*, not equipment choice.
 */

import type { SeasonPhase } from '../types/domain';
import { getProgrammingRoleBias } from '../utils/roleBuckets';
import type { OffseasonConditioningCategory } from './offseasonSubphasePolicy';

export type BiasConditioningCategory = OffseasonConditioningCategory;

export interface ProgrammingBiasInputs {
  /** Raw athlete role/position (normalised internally). Undefined => no role
   *  contribution — role is treated as "not provided", never as a default. */
  role?: unknown;
  /** Raw goal tokens (onboarding labels/ids or free text). */
  goals?: readonly string[] | null;
  /** Season phase — drives how much bias is expressed. */
  phase: SeasonPhase;
  /** When true (new/beginner training age), aggressive bias is suppressed. */
  isBeginner?: boolean;
}

export interface ProgrammingBias {
  /** Preference nudge toward strength/heavy work (−0.15..+0.15). */
  strengthBias: number;
  /** Preference nudge toward aerobic/running conditioning (−0.15..+0.15). */
  conditioningBias: number;
  /** Preference nudge toward speed/acceleration work (−0.15..+0.15). */
  speedBias: number;
  /** Preference nudge toward prehab / recovery add-ons (−0.15..+0.15). */
  recoveryAddonBias: number;
  /** Preference nudge toward accessory / hypertrophy volume (−0.15..+0.15). */
  accessoryBias: number;
  /** Global phase scalar in [0,1] applied to every bias (off > pre > in). */
  phaseAdjustedWeight: number;
  /** Optional per-category weight used to re-order the conditioning priority
   *  list. Empty when there is no goal-driven conditioning direction. */
  conditioningCategoryPreference: Partial<Record<BiasConditioningCategory, number>>;
  /** Human-readable reasons, for tests/debug/coach transparency. */
  notes: string[];
}

/** Largest magnitude any single bias output can reach. */
const MAX_BIAS = 0.15;
/** A single unit of raw emphasis (+1) maps to ~10% before phase scaling. */
const BASE_UNIT = 0.1;
/** Phase scaling: off-season expresses more bias, in-season the least. */
const PHASE_SCALE: Record<SeasonPhase, number> = {
  'Off-season': 1,
  'Pre-season': 0.6,
  'In-season': 0.3,
};
/** Beginners: dampen everything, and zero aggressive (speed) bias. */
const BEGINNER_SCALE = 0.3;

type Emphasis = {
  strength: number;
  conditioning: number;
  speed: number;
  recovery: number;
  accessory: number;
};

const ZERO_EMPHASIS: Emphasis = {
  strength: 0,
  conditioning: 0,
  speed: 0,
  recovery: 0,
  accessory: 0,
};

function addEmphasis(base: Emphasis, delta: Partial<Emphasis>): Emphasis {
  return {
    strength: base.strength + (delta.strength ?? 0),
    conditioning: base.conditioning + (delta.conditioning ?? 0),
    speed: base.speed + (delta.speed ?? 0),
    recovery: base.recovery + (delta.recovery ?? 0),
    accessory: base.accessory + (delta.accessory ?? 0),
  };
}

function clampBias(value: number): number {
  if (value > MAX_BIAS) return MAX_BIAS;
  if (value < -MAX_BIAS) return -MAX_BIAS;
  // Avoid −0 and round to a stable 4dp so tests are deterministic.
  return Math.round(value * 1e4) / 1e4 || 0;
}

/** Normalise a free-text goal token to a lowercase, separator-collapsed key. */
function normaliseGoalKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[+/_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function roleHasContent(role: unknown): boolean {
  return String(role ?? '').trim().length > 0;
}

/** Role emphasis (exposed magnitudes only — role never drives category order). */
function roleEmphasis(role: unknown): { emphasis: Emphasis; note: string | null } {
  if (!roleHasContent(role)) return { emphasis: ZERO_EMPHASIS, note: null };
  // getProgrammingRoleBias collapses high_forward_back → outside_runner and
  // returns the default bucket for unknown input; we only reach here when a
  // role was explicitly provided.
  const bias = getProgrammingRoleBias(role);
  switch (bias) {
    case 'inside_mid':
      return {
        emphasis: { ...ZERO_EMPHASIS, conditioning: 0.75, recovery: 0.25 },
        note: 'Inside-mid role: slight aerobic/running-capacity lean',
      };
    case 'outside_runner':
      return {
        emphasis: { ...ZERO_EMPHASIS, speed: 0.75, conditioning: 0.5 },
        note: 'Outside/high role: slight speed + running lean',
      };
    case 'key_position_ruck_tall':
      return {
        emphasis: { ...ZERO_EMPHASIS, strength: 0.75, accessory: 0.5 },
        note: 'Key-position/ruck role: slight strength + accessory lean',
      };
    case 'small_forward_back':
      return {
        emphasis: { ...ZERO_EMPHASIS, speed: 0.5, recovery: 0.25 },
        note: 'Small forward/back role: slight speed + durability lean',
      };
    default:
      return { emphasis: ZERO_EMPHASIS, note: null };
  }
}

type GoalDirection = 'aerobic' | 'speed' | null;

/** Map one goal token to an emphasis delta + optional conditioning direction. */
function goalEmphasis(key: string): { emphasis: Partial<Emphasis>; direction: GoalDirection; note: string | null } {
  const has = (...needles: string[]) => needles.some((n) => key.includes(n));

  // Durability / injury resilience — trunk/adductor/calf/hamstring/recovery lean.
  if (has('injury', 'durab', 'resilien', 'prehab', 'robust', 'bulletproof', 'stay healthy')) {
    return { emphasis: { recovery: 1 }, direction: null, note: 'Durability goal: recovery/prehab lean' };
  }
  // Freshness — freshness-first, low intensity, no hard bias.
  if (has('fresh', 'recover', 'feel good')) {
    return { emphasis: { recovery: 0.5 }, direction: null, note: 'Freshness goal: light recovery lean' };
  }
  // Explosiveness / power — some strength + some speed.
  if (has('power', 'explos')) {
    return { emphasis: { strength: 0.5, speed: 0.5 }, direction: 'speed', note: 'Power goal: strength + speed lean' };
  }
  // Speed / acceleration — aggressive; gate + beginner policy still govern.
  if (has('speed', 'accel', 'quick', 'faster', 'fast', 'pace', 'top end', 'burst')) {
    return { emphasis: { speed: 1 }, direction: 'speed', note: 'Speed goal: acceleration lean (gate still governs)' };
  }
  // Aerobic / endurance — clearly aerobic; drives the category re-order.
  if (has('aerobic', 'endurance', 'engine', 'cardio', 'running capacity', 'gas tank', 'tempo', 'stamina')) {
    return { emphasis: { conditioning: 1, recovery: 0.25 }, direction: 'aerobic', note: 'Aerobic goal: running-capacity lean' };
  }
  // Size / muscle — accessory/hypertrophy lean (mostly off-season).
  if (has('muscle', 'size', 'mass', 'hypertroph', 'bigger', 'build')) {
    return { emphasis: { strength: 0.5, accessory: 1 }, direction: null, note: 'Size goal: strength + accessory lean' };
  }
  // Strength — heavy work lean.
  if (has('strong', 'strength')) {
    // "Get stronger & fitter" also mentions fitness — add a light conditioning
    // lean but NO aerobic direction (generic "fitter" is not clearly aerobic).
    const fitness = has('fit', 'fitter', 'condition');
    return {
      emphasis: fitness ? { strength: 1, accessory: 0.25, conditioning: 0.5 } : { strength: 1, accessory: 0.25 },
      direction: null,
      note: fitness ? 'Strength+fitness goal: strength lean, light conditioning' : 'Strength goal: strength lean',
    };
  }
  // General "fitter/fitness" without strength — light balanced conditioning.
  if (has('fit', 'fitter', 'condition')) {
    return { emphasis: { conditioning: 0.5 }, direction: null, note: 'Fitness goal: light conditioning lean' };
  }
  // Performance-flavoured goals — tiny balanced lean, no direction.
  if (has('senior', 'dominate', 'elite', 'compete', 'perform', 'best')) {
    return { emphasis: { strength: 0.25, speed: 0.25 }, direction: null, note: 'Performance goal: tiny balanced lean' };
  }
  // Consistency / general fitness / other — neutral.
  return { emphasis: {}, direction: null, note: null };
}

/**
 * Compute the deterministic role + goal programming bias.
 *
 * The result is a small, phase-scaled preference vector. The only field the
 * engine consumes for selection is `conditioningCategoryPreference` (via
 * `applyConditioningCategoryBias`); the rest are exposed for transparency,
 * tests, and future consumers.
 */
export function computeProgrammingBias(inputs: ProgrammingBiasInputs): ProgrammingBias {
  const { role, goals, phase, isBeginner = false } = inputs;
  const phaseScale = PHASE_SCALE[phase] ?? PHASE_SCALE['Pre-season'];
  const beginnerScale = isBeginner ? BEGINNER_SCALE : 1;
  const phaseAdjustedWeight = Math.round(phaseScale * beginnerScale * 1e4) / 1e4;

  const notes: string[] = [];

  // ── Accumulate raw emphasis from role + goals ──
  let emphasis: Emphasis = ZERO_EMPHASIS;

  const { emphasis: rEmph, note: rNote } = roleEmphasis(role);
  emphasis = addEmphasis(emphasis, rEmph);
  if (rNote) notes.push(rNote);

  let aerobicDirection = false;
  let speedDirection = false;

  for (const raw of goals ?? []) {
    const key = normaliseGoalKey(raw);
    if (!key) continue;
    const { emphasis: gEmph, direction, note } = goalEmphasis(key);
    emphasis = addEmphasis(emphasis, gEmph);
    if (note) notes.push(note);
    if (direction === 'aerobic') aerobicDirection = true;
    if (direction === 'speed') speedDirection = true;
  }

  // ── Beginner policy: aggressive bias is suppressed entirely ──
  if (isBeginner) {
    emphasis = { ...emphasis, speed: 0 };
    speedDirection = false;
    notes.push('Beginner policy: aggressive (speed) bias suppressed');
  }

  // ── Convert raw emphasis → clamped, phase-scaled bias numbers ──
  const toBias = (raw: number) => clampBias(raw * BASE_UNIT * phaseScale * beginnerScale);

  const strengthBias = toBias(emphasis.strength);
  const conditioningBias = toBias(emphasis.conditioning);
  const speedBias = toBias(emphasis.speed);
  const recoveryAddonBias = toBias(emphasis.recovery);
  const accessoryBias = toBias(emphasis.accessory);

  // ── Conditioning-category preference (goal-driven; empty by default) ──
  // Weights only order categories relative to each other; magnitude is not
  // consumed beyond ordering. Aerobic and speed directions are independent so
  // an athlete who wants both gets both leaned up (still gate-limited).
  const conditioningCategoryPreference: Partial<Record<BiasConditioningCategory, number>> = {};
  if (aerobicDirection) {
    conditioningCategoryPreference.aerobic_base = 2;
    conditioningCategoryPreference.tempo = 1;
    notes.push('Conditioning preference: aerobic_base > tempo (where phase/gate allow)');
  }
  if (speedDirection) {
    // Sprint is the strongest speed expression but is owned by the sprint gate;
    // re-ordering only affects categories the gate already permitted.
    conditioningCategoryPreference.sprint = (conditioningCategoryPreference.sprint ?? 0) + 2;
    conditioningCategoryPreference.vo2 = (conditioningCategoryPreference.vo2 ?? 0) + 1;
    notes.push('Conditioning preference: sprint/vo2 leaned up (gate still governs)');
  }

  if (notes.length === 0) notes.push('No role/goal bias — balanced default');

  return {
    strengthBias,
    conditioningBias,
    speedBias,
    recoveryAddonBias,
    accessoryBias,
    phaseAdjustedWeight,
    conditioningCategoryPreference,
    notes,
  };
}

/**
 * Re-order a conditioning category priority list by a bias preference.
 *
 * This is a STABLE re-order: categories are sorted by descending preference
 * weight, and ties preserve the original order. It NEVER adds or removes a
 * category — so any category already filtered out by the injury / readiness /
 * deload / cap gates stays out, and an empty preference is an identity no-op.
 */
export function applyConditioningCategoryBias<T extends BiasConditioningCategory>(
  ordered: readonly T[],
  preference: Partial<Record<BiasConditioningCategory, number>>,
): T[] {
  if (ordered.length <= 1) return [...ordered];
  const keys = Object.keys(preference);
  if (keys.length === 0) return [...ordered];
  return ordered
    .map((cat, index) => ({ cat, index, weight: preference[cat] ?? 0 }))
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .map((entry) => entry.cat);
}
