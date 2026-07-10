/**
 * Deterministic role + goal programming bias.
 *
 * PURPOSE
 * -------
 * The athlete's football role and training goals should *nudge* deterministic
 * programming by a small amount (~5–15%) — never override it. This module is a
 * pure, side-effect-free helper that maps (role, goals, phase) → a small bias
 * vector plus bounded preferences used to re-order already-safe conditioning
 * categories and recovery add-on recommendations.
 *
 * SAFETY MODEL (why this is safe to consume)
 * ------------------------------------------
 *  - Bias is SMALL. Every numeric output is clamped to ±`MAX_BIAS` (15%).
 *  - Bias is PHASE-SCALED. Off-season expresses the most bias, pre-season less,
 *    in-season the least (`PHASE_SCALE`). The global scalar is retained only
 *    inside the explicitly debug-only observability object.
 *  - `conditioningCategoryPreference` is applied by
 *    `applyConditioningCategoryBias` which RE-ORDERS an existing list — it can
 *    never ADD a category. Because the engine filters categories through the
 *    injury / readiness / deload / cap gates BEFORE the re-order, those gates
 *    always win: a category the gate removed can never be re-introduced by bias.
 *  - Role and goal preferences are phase-scaled and bounded. A default athlete
 *    gets empty preferences, so all re-order helpers are identity no-ops.
 *  - Beginner policy dampens all bias and zeroes aggressive (speed) bias.
 *  - Equipment constraints live in exercise selection and are never touched
 *    here — bias only expresses category *preference*, not equipment choice.
 */

import type { SeasonPhase } from '../types/domain';
import { getProgrammingRoleBias } from '../utils/roleBuckets';
import type { OffseasonConditioningCategory } from './offseasonSubphasePolicy';
import type { RecoveryAddonFocusArea } from './recoveryAddonCoverage';

export type BiasConditioningCategory = OffseasonConditioningCategory;
export type RecoveryAddonFocusPreference = Partial<Record<RecoveryAddonFocusArea, number>>;

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
  /** Preference nudge toward speed/acceleration work (−0.15..+0.15). */
  speedBias: number;
  /** Bounded weights used to re-order an already-safe conditioning list. */
  conditioningCategoryPreference: Partial<Record<BiasConditioningCategory, number>>;
  /** Bounded weights used to re-order already-safe recovery add-on coverage. */
  recoveryAddonFocusPreference: RecoveryAddonFocusPreference;
  /** Observability only. No programming consumer reads these fields. */
  debug: {
    phaseAdjustedWeight: number;
    reasons: string[];
  };
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

type ConditioningDirection = 'aerobic' | 'speed' | null;
type SupportDirection = 'durability' | 'freshness' | 'strength_support' | null;

interface BiasDirection {
  emphasis: Emphasis;
  conditioningDirection: ConditioningDirection;
  supportDirection: SupportDirection;
  note: string | null;
}

/** Role emphasis plus the safe lists it may nudge. */
function roleEmphasis(role: unknown): BiasDirection {
  if (!roleHasContent(role)) {
    return {
      emphasis: ZERO_EMPHASIS,
      conditioningDirection: null,
      supportDirection: null,
      note: null,
    };
  }
  // getProgrammingRoleBias collapses high_forward_back → outside_runner and
  // returns the default bucket for unknown input; we only reach here when a
  // role was explicitly provided.
  const bias = getProgrammingRoleBias(role);
  switch (bias) {
    case 'inside_mid':
      return {
        emphasis: { ...ZERO_EMPHASIS, conditioning: 0.75, recovery: 0.25 },
        conditioningDirection: 'aerobic',
        supportDirection: 'durability',
        note: 'Inside-mid role: slight aerobic/running-capacity lean',
      };
    case 'outside_runner':
      return {
        emphasis: { ...ZERO_EMPHASIS, speed: 0.75, conditioning: 0.5 },
        conditioningDirection: 'speed',
        supportDirection: null,
        note: 'Outside/high role: slight speed + running lean',
      };
    case 'key_position_ruck_tall':
      return {
        emphasis: { ...ZERO_EMPHASIS, strength: 0.75, accessory: 0.5 },
        conditioningDirection: null,
        supportDirection: 'strength_support',
        note: 'Key-position/ruck role: slight strength + accessory lean',
      };
    case 'small_forward_back':
      return {
        emphasis: { ...ZERO_EMPHASIS, speed: 0.5, recovery: 0.25 },
        conditioningDirection: 'speed',
        supportDirection: 'durability',
        note: 'Small forward/back role: slight speed + durability lean',
      };
    default:
      return {
        emphasis: ZERO_EMPHASIS,
        conditioningDirection: null,
        supportDirection: null,
        note: null,
      };
  }
}

/** Map one goal token to an emphasis delta + optional conditioning direction. */
function goalEmphasis(key: string): Omit<BiasDirection, 'emphasis'> & { emphasis: Partial<Emphasis> } {
  const has = (...needles: string[]) => needles.some((n) => key.includes(n));

  // Durability / injury resilience — trunk/adductor/calf/hamstring/recovery lean.
  if (has('injury', 'durab', 'resilien', 'prehab', 'robust', 'bulletproof', 'stay healthy')) {
    return { emphasis: { recovery: 1 }, conditioningDirection: null, supportDirection: 'durability', note: 'Durability goal: recovery/prehab lean' };
  }
  // Freshness — freshness-first, low intensity, no hard bias.
  if (has('fresh', 'recover', 'feel good')) {
    return { emphasis: { recovery: 0.5 }, conditioningDirection: null, supportDirection: 'freshness', note: 'Freshness goal: light recovery lean' };
  }
  // Explosiveness / power — some strength + some speed.
  if (has('power', 'explos')) {
    return { emphasis: { strength: 0.5, speed: 0.5 }, conditioningDirection: 'speed', supportDirection: 'strength_support', note: 'Power goal: strength + speed lean' };
  }
  // Speed / acceleration — aggressive; gate + beginner policy still govern.
  if (has('speed', 'accel', 'quick', 'faster', 'fast', 'pace', 'top end', 'burst')) {
    return { emphasis: { speed: 1 }, conditioningDirection: 'speed', supportDirection: null, note: 'Speed goal: acceleration lean (gate still governs)' };
  }
  // Aerobic / endurance — clearly aerobic; drives the category re-order.
  if (has('aerobic', 'endurance', 'engine', 'cardio', 'running capacity', 'gas tank', 'tempo', 'stamina')) {
    return { emphasis: { conditioning: 1, recovery: 0.25 }, conditioningDirection: 'aerobic', supportDirection: 'freshness', note: 'Aerobic goal: running-capacity lean' };
  }
  // Size / muscle — accessory/hypertrophy lean (mostly off-season).
  if (has('muscle', 'size', 'mass', 'hypertroph', 'bigger', 'build')) {
    return { emphasis: { strength: 0.5, accessory: 1 }, conditioningDirection: null, supportDirection: 'strength_support', note: 'Size goal: strength + accessory lean' };
  }
  // Strength — heavy work lean.
  if (has('strong', 'strength')) {
    // Generic "fitter" is not clearly aerobic, so strength+fitness remains a
    // strength nudge with balanced conditioning rather than inventing a mode.
    const fitness = has('fit', 'fitter', 'condition');
    return {
      emphasis: { strength: 1, accessory: 0.25 },
      conditioningDirection: null,
      supportDirection: 'strength_support',
      note: fitness ? 'Strength+fitness goal: strength lean, balanced conditioning' : 'Strength goal: strength lean',
    };
  }
  // General "fitter/fitness" without strength — light balanced conditioning.
  if (has('fit', 'fitter', 'condition')) {
    return { emphasis: {}, conditioningDirection: null, supportDirection: null, note: 'General fitness goal: balanced default' };
  }
  // Performance-flavoured goals — tiny balanced lean, no direction.
  if (has('senior', 'dominate', 'elite', 'compete', 'perform', 'best')) {
    return { emphasis: { strength: 0.25, speed: 0.25 }, conditioningDirection: null, supportDirection: null, note: 'Performance goal: tiny balanced lean' };
  }
  // Consistency / general fitness / other — neutral.
  return { emphasis: {}, conditioningDirection: null, supportDirection: null, note: null };
}

/**
 * Compute the deterministic role + goal programming bias.
 *
 * The result contains only active decision inputs plus an explicitly debug-only
 * observability object. Numeric preference weights are percentages (0..0.15).
 */
export function computeProgrammingBias(inputs: ProgrammingBiasInputs): ProgrammingBias {
  const { role, goals, phase, isBeginner = false } = inputs;
  const phaseScale = PHASE_SCALE[phase] ?? PHASE_SCALE['Pre-season'];
  const beginnerScale = isBeginner ? BEGINNER_SCALE : 1;
  const phaseAdjustedWeight = Math.round(phaseScale * beginnerScale * 1e4) / 1e4;

  const notes: string[] = [];

  // ── Accumulate raw emphasis from role + goals ──
  let emphasis: Emphasis = ZERO_EMPHASIS;

  const {
    emphasis: rEmph,
    conditioningDirection: roleConditioningDirection,
    supportDirection: roleSupportDirection,
    note: rNote,
  } = roleEmphasis(role);
  emphasis = addEmphasis(emphasis, rEmph);
  if (rNote) notes.push(rNote);

  let aerobicDirection = roleConditioningDirection === 'aerobic';
  let speedDirection = roleConditioningDirection === 'speed';
  const supportDirections = new Set<Exclude<SupportDirection, null>>();
  if (roleSupportDirection) supportDirections.add(roleSupportDirection);

  for (const raw of goals ?? []) {
    const key = normaliseGoalKey(raw);
    if (!key) continue;
    const {
      emphasis: gEmph,
      conditioningDirection,
      supportDirection,
      note,
    } = goalEmphasis(key);
    emphasis = addEmphasis(emphasis, gEmph);
    if (note) notes.push(note);
    if (conditioningDirection === 'aerobic') aerobicDirection = true;
    if (conditioningDirection === 'speed') speedDirection = true;
    if (supportDirection) supportDirections.add(supportDirection);
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
  // Weights retain the phase-scaled 0..15% magnitude. The consumer treats them
  // as a bounded score nudge, never as permission to add a category.
  const conditioningCategoryPreference: Partial<Record<BiasConditioningCategory, number>> = {};
  if (aerobicDirection && conditioningBias > 0) {
    conditioningCategoryPreference.aerobic_base = conditioningBias;
    conditioningCategoryPreference.tempo = clampBias(conditioningBias * 0.5);
    notes.push('Conditioning preference: aerobic_base > tempo (where phase/gate allow)');
  }
  if (speedDirection && speedBias > 0) {
    // Sprint is the strongest speed expression but is owned by the sprint gate;
    // re-ordering only affects categories the gate already permitted.
    conditioningCategoryPreference.sprint = Math.max(
      conditioningCategoryPreference.sprint ?? 0,
      speedBias,
    );
    conditioningCategoryPreference.vo2 = Math.max(
      conditioningCategoryPreference.vo2 ?? 0,
      clampBias(speedBias * 0.5),
    );
    notes.push('Conditioning preference: sprint/vo2 leaned up (gate still governs)');
  }

  const recoveryAddonFocusPreference: RecoveryAddonFocusPreference = {};
  const addFocuses = (focuses: readonly RecoveryAddonFocusArea[], weight: number): void => {
    for (const focus of focuses) {
      recoveryAddonFocusPreference[focus] = Math.max(
        recoveryAddonFocusPreference[focus] ?? 0,
        weight,
      );
    }
  };
  if (supportDirections.has('durability') && recoveryAddonBias > 0) {
    addFocuses(
      ['trunk_core', 'adductors_groin', 'calves_tib_ankles', 'hamstring_light_prehab'],
      recoveryAddonBias,
    );
  }
  if (supportDirections.has('freshness') && recoveryAddonBias > 0) {
    addFocuses(['mobility_reset', 'trunk_core'], recoveryAddonBias);
  }
  if (supportDirections.has('strength_support') && accessoryBias > 0) {
    addFocuses(['carries', 'shoulder_scap', 'trunk_core'], accessoryBias);
  }

  if (notes.length === 0) notes.push('No role/goal bias — balanced default');

  return {
    strengthBias,
    speedBias,
    conditioningCategoryPreference,
    recoveryAddonFocusPreference,
    debug: {
      phaseAdjustedWeight,
      reasons: notes,
    },
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
  const BIAS_ORDER_SCALE = 35;
  return ordered
    .map((cat, index) => ({
      cat,
      index,
      score: index - (preference[cat] ?? 0) * BIAS_ORDER_SCALE,
    }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((entry) => entry.cat);
}
