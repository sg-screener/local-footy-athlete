/**
 * D17 — the top-of-session Mobility & Prehab flow: menus, counts and dosing.
 *
 * SOURCE OF TRUTH: `docs/PROGRAMMING_DESIGN_SESSION_2026-07-23.md` §D17
 * (Sam, AUTHORED 2026-07-27, the final authoring item in the programming
 * system). Held to that section by `muscleExperienceEqualityTests`.
 *
 * This is NOT the recovery-day flow. `mobilityFlowTemplates.ts` owns the
 * recovery add-on flows, which are focus-tagged and phase-suited and attach to
 * recovery days. D17 is the collapsed flow that sits at the TOP of a training
 * session (D13), composed per day type from the exercise pools.
 *
 * The COUNTS ARE LAW. Sam authored how many of each category a day gets; the
 * app chooses which specific exercises fill those slots, rotating for variety.
 * A layer that changes a count is changing Sam's programming, not rendering it.
 *
 * NOT WIRED YET: nothing composes a flow from this. Stage B consumes it.
 */

import type { MuscleGroup } from './muscleExperienceMetadata';

/* ── Day types ── */

/**
 * The day shapes that carry a flow. Resolution is ordered — a lower day that
 * is also a hinge day takes the hinge menu, not the general lower one.
 */
export type FlowDayType =
  | 'lower_general'
  | 'lower_squat'
  | 'lower_hinge'
  | 'upper'
  | 'full_body';

/**
 * Which menu wins when a day matches more than one. Sam: "hinge rule > squat
 * rule > general lower". Upper and full-body are unambiguous, so they are not
 * part of the precedence chain.
 */
export const FLOW_RESOLUTION_ORDER: readonly FlowDayType[] = [
  'lower_hinge',
  'lower_squat',
  'lower_general',
];

/* ── Slot categories ── */

/** A category of flow work. Each resolves to pools/muscle tags at selection time. */
export type FlowSlotCategory =
  | 'hip_mobility'
  | 'hamstring_or_low_back_mobility'
  | 'shoulder_mobility'
  | 'upper_body_mobility'
  | 'hip_prehab'
  | 'knee_prehab'
  | 'hamstring_prehab'
  | 'shoulder_prehab';

/** Whether a category is mobility work or prehab work — this picks the dose. */
export type FlowCategoryKind = 'mobility' | 'prehab';

export const FLOW_CATEGORY_KIND: Readonly<Record<FlowSlotCategory, FlowCategoryKind>> = {
  hip_mobility: 'mobility',
  hamstring_or_low_back_mobility: 'mobility',
  shoulder_mobility: 'mobility',
  upper_body_mobility: 'mobility',
  hip_prehab: 'prehab',
  knee_prehab: 'prehab',
  hamstring_prehab: 'prehab',
  shoulder_prehab: 'prehab',
};

/* ── The menus ── */

export interface FlowSlot {
  readonly category: FlowSlotCategory;
  /** How many items of this category the day gets. Sam's count — law. */
  readonly count: number;
}

export interface SessionFlowMenu {
  readonly dayType: FlowDayType;
  readonly slots: readonly FlowSlot[];
}

/**
 * Sam's authored menus. Every day lands on four flow items.
 */
export const SESSION_FLOW_MENUS: readonly SessionFlowMenu[] = [
  {
    dayType: 'lower_general',
    slots: [
      { category: 'hip_mobility', count: 2 },
      { category: 'hip_prehab', count: 2 },
    ],
  },
  {
    dayType: 'lower_squat',
    slots: [
      { category: 'hip_mobility', count: 2 },
      { category: 'hip_prehab', count: 1 },
      { category: 'knee_prehab', count: 1 },
    ],
  },
  {
    dayType: 'lower_hinge',
    slots: [
      { category: 'hip_mobility', count: 1 },
      { category: 'hamstring_or_low_back_mobility', count: 1 },
      { category: 'hip_prehab', count: 1 },
      { category: 'hamstring_prehab', count: 1 },
    ],
  },
  {
    dayType: 'upper',
    slots: [
      { category: 'shoulder_mobility', count: 1 },
      { category: 'upper_body_mobility', count: 1 },
      { category: 'shoulder_prehab', count: 2 },
    ],
  },
  {
    dayType: 'full_body',
    slots: [
      { category: 'hip_mobility', count: 1 },
      { category: 'shoulder_mobility', count: 1 },
      { category: 'hip_prehab', count: 1 },
      { category: 'shoulder_prehab', count: 1 },
    ],
  },
];

/* ── Dosing ── */

/**
 * The universal flow dose (Sam, 2026-07-27). It "covers most things"; an
 * exercise whose curated prescription differs — a hold-based prehab, say —
 * keeps its curated dose. `curatedDoseWins` records that precedence so no
 * layer has to guess which authority is higher.
 */
export const FLOW_DOSING = {
  mobility: {
    sets: 2,
    secondsLow: 30,
    secondsHigh: 60,
    /** Per side where the movement is one-sided. */
    perSideWhereApplicable: true,
  },
  prehab: {
    sets: 2,
    repsLow: 10,
    repsHigh: 20,
  },
  /** A curated per-exercise prescription overrides the universal dose above. */
  curatedDoseWins: true,
} as const;

/* ── Category resolution ── */

export interface FlowCategoryMapping {
  /** Authored metadata pools this category draws from. */
  readonly pools: readonly string[];
  /**
   * Named exercises Sam also permits in this warm-up slot without moving their
   * catalogue ownership. Equipment, injury and experience filters still apply.
   */
  readonly alsoEligibleExercises?: readonly string[];
  /** Muscle tags that additionally qualify an exercise for this category. */
  readonly muscleGroups: readonly MuscleGroup[];
  /** Sam's own description of the category, from D17. */
  readonly authoredDescription: string;
}

/**
 * How each category resolves against the muscle metadata, per Sam's D17
 * mapping: "hip prehab = groin/adductor + hip/glute entries; knee prehab = the
 * TKE/Spanish-squat/step-down crew; hamstring prehab = hamstring-targeted
 * entries from Lower prehab;
 * shoulder prehab = shoulder-health pool; upper mobility =
 * t-spine/lat/chest/dead-hang."
 *
 * Pools are named from `MUSCLE_METADATA_POOLS`; the equality suite fails if a
 * pool named here is not a real authored pool.
 */
export const FLOW_CATEGORY_MUSCLE_MAPPING: Readonly<
  Record<FlowSlotCategory, FlowCategoryMapping>
> = {
  hip_mobility: {
    pools: ['Mobility'],
    muscleGroups: ['Hips', 'Glutes'],
    authoredDescription: 'Hip mobility work.',
  },
  hamstring_or_low_back_mobility: {
    pools: ['Mobility'],
    muscleGroups: ['Hamstrings', 'Low back'],
    authoredDescription: 'Hamstring-or-low-back mobility — the hinge-day second mobility slot.',
  },
  shoulder_mobility: {
    pools: ['Mobility'],
    muscleGroups: ['Shoulders'],
    authoredDescription: 'Shoulder mobility work.',
  },
  upper_body_mobility: {
    pools: ['Mobility'],
    muscleGroups: ['Upper back', 'Lats', 'Chest'],
    authoredDescription: 'Upper-body mobility: t-spine / lat / chest / dead-hang.',
  },
  hip_prehab: {
    pools: ['Groin / adductors', 'Lower prehab'],
    muscleGroups: ['Groin', 'Hips', 'Glutes', 'Hip flexors'],
    authoredDescription: 'Hip prehab: groin/adductor plus hip/glute entries.',
  },
  knee_prehab: {
    pools: ['Lower prehab'],
    muscleGroups: ['Knee', 'Quads'],
    authoredDescription: 'Knee prehab: the TKE / Spanish-squat / step-down crew.',
  },
  hamstring_prehab: {
    pools: ['Lower prehab'],
    muscleGroups: ['Hamstrings'],
    authoredDescription: 'Hamstring prehab: hamstring-targeted entries from Lower prehab.',
  },
  shoulder_prehab: {
    pools: ['Shoulder health'],
    alsoEligibleExercises: [
      'Incline Y Raise',
      'Face Pull',
      'Cable Face Pull',
      'Rear Delt Fly',
      'Band Pull-Apart',
    ],
    muscleGroups: ['Shoulders'],
    authoredDescription: 'Shoulder prehab: the shoulder-health pool plus the ruled rear-shoulder warm-up choices.',
  },
};

/* ── Standing constraints ── */

/**
 * The flow is NEVER load-bearing (D13). The app assumes athletes skip it, so
 * any prehab that actually matters lives in the session itself. A layer that
 * lets the flow carry required work has broken this.
 */
export const FLOW_IS_NEVER_LOAD_BEARING = true;

/** Day kinds that carry no flow at all in v1. */
export const DAY_KINDS_WITHOUT_FLOW: readonly string[] = ['conditioning_only', 'recovery'];

/** The menu for a day type, or null when that day carries no flow. */
export function flowMenuFor(dayType: FlowDayType): SessionFlowMenu | null {
  return SESSION_FLOW_MENUS.find((menu) => menu.dayType === dayType) ?? null;
}

/**
 * Resolve which menu a lower day takes, honouring Sam's precedence:
 * hinge > squat > general lower.
 */
export function resolveLowerDayMenu(traits: {
  readonly isHinge: boolean;
  readonly isSquat: boolean;
}): SessionFlowMenu {
  if (traits.isHinge) return flowMenuFor('lower_hinge') as SessionFlowMenu;
  if (traits.isSquat) return flowMenuFor('lower_squat') as SessionFlowMenu;
  return flowMenuFor('lower_general') as SessionFlowMenu;
}
