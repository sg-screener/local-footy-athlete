/**
 * WEAK-POINT FOCUS — the athlete's stated weakness, mapped to what the Bible says.
 *
 * SAM'S RULING, 2026-07-30 (`docs/WEAK_POINT_SHEET_2026-07-30.md`):
 *
 *   READING A — DEFINITELY NOT B. "A stated weakness changes WHAT FILLS the week —
 *   exercise and template selection — never counts, never distributions. The phase
 *   tables alone own structure. The existing testingBias mechanism is the vehicle: bind
 *   it to the §1 mapping table and gate its direction against :105 in the same commit,
 *   so A cannot drift from the line it implements."
 *
 * THE LINE IT IMPLEMENTS, verbatim (`BIBLE_ANCHOR weak_point_off_season_focus`):
 *
 *   `:105` — "Weak point work: KEY thing in off season is working on weakness - may be
 *   mobility and injury prevention, or strength and size, or conditioning, or speed.
 *   What the user said is their weakness is the focus here. If they don't really say they
 *   have a weakness then strength and size should be prioritised early, then building
 *   work capacity, then increasing speed and intensity as we get closer to pre season."
 *
 * SO THIS MODULE IS THE BINDING, and it exists as data rather than as a switch inside
 * the bias because the direction is the part Sam signs. `weakPointFocusTests` asserts
 * every answer maps to one of the four categories the line names, and asserts the bias
 * LEANS in that direction — which is the "cannot drift" half of his instruction.
 *
 * WHY THE BIAS NEEDED BINDING AT ALL. `rules/testingBias.ts` already read
 * `biggestLimitation`, and its originating commit is `3d13477 "Add deterministic testing
 * bias"` — a subject line, no body, no ruling cited, no changeset. By this repo's own
 * provenance standard that direction table was UNAUTHORED, and two of the seven answers
 * (`Size`, `Power & explosiveness`) fell through its switch to no lean at all.
 */

import type { BiggestLimitation } from '../types/domain';

/**
 * The four categories `:105` names, and one more the line does not answer.
 *
 * `unresolved` is not a fifth category of weakness — it is the honest state of an answer
 * Sam has not ruled on. Nothing leans on it, and the gate requires it to be DECLARED
 * rather than merely absent, so an unanswered question cannot read as an answered one.
 */
export type WeakPointFocus =
  | 'mobility_and_injury_prevention'
  | 'strength_and_size'
  | 'conditioning'
  | 'speed'
  /**
   * THE FIFTH CATEGORY (Sam's ruling, 2026-07-30). "Power & explosiveness" is its own
   * weakness and is NEVER grouped with speed.
   *
   * His words: "should focus more on power and accelerations" — so the lean targets the
   * authored power pool and primer picks AND acceleration-flavoured speed work,
   * ACCELERATIONS SPECIFICALLY, not top-speed. That distinction is the whole reason it
   * is not the speed category: the speed lean pulls toward maximum velocity, and this
   * one pulls toward getting there.
   *
   * The first draft of the mapping had it `unresolved` pending a search of the authored
   * record. The search found nothing, the question went back, and this is the answer.
   */
  | 'power_and_acceleration'
  | 'unresolved';

/**
 * Every onboarding answer, mapped to the `:105` category it belongs to.
 *
 * SEVEN ANSWERS, FOUR CATEGORIES. The mapping is Sam's line read literally: "may be
 * mobility and injury prevention, or strength and size, or conditioning, or speed."
 *
 * `Power & explosiveness` is DEFERRED and therefore `unresolved`. Sam believed it had
 * been ruled before; the authored record was searched — every doc in `docs/` and
 * `artifacts/`, the Bible, and the git provenance of the bias itself — and NO prior
 * ruling on the seven answers exists. Grouping it with speed would have been a guess
 * dressed as a citation, and this file's whole purpose is to stop that.
 */
// BIBLE_ANCHOR: weak_point_off_season_focus
export const WEAK_POINT_FOCUS_BY_ANSWER:
  Readonly<Record<BiggestLimitation, WeakPointFocus>> = {
  Mobility: 'mobility_and_injury_prevention',
  'Injury history': 'mobility_and_injury_prevention',
  Strength: 'strength_and_size',
  Size: 'strength_and_size',
  Endurance: 'conditioning',
  Speed: 'speed',
  // RULED 2026-07-30 as its own category, after the search of the authored record found
  // no prior ruling and the question went back. Never grouped with speed.
  'Power & explosiveness': 'power_and_acceleration',
};

export function weakPointFocusFor(
  answer: BiggestLimitation | null | undefined,
): WeakPointFocus | null {
  if (!answer) return null;
  return WEAK_POINT_FOCUS_BY_ANSWER[answer] ?? null;
}

/**
 * WHICH WAY EACH CATEGORY LEANS. The gate's subject.
 *
 * These are DIRECTIONS, not magnitudes: reading A changes what fills the week, and the
 * amplitude stays where it already was (`testingBias`'s 0.1 cap, phase-scaled). Naming
 * the direction separately from the number is what makes "the bias leans the way `:105`
 * says" a checkable sentence rather than a hopeful one.
 */
export interface WeakPointLean {
  /** Aerobic/tempo conditioning template preference. */
  readonly aerobic: boolean;
  /** Sprint and speed-quality preference — pulls toward maximum velocity. */
  readonly speed: boolean;
  /** Strength accessory and support preference. */
  readonly accessory: boolean;
  /** Recovery / prehab add-on and mobility preference. */
  readonly recovery: boolean;
  /**
   * The authored power pool and primer picks.
   *
   * Reaches `powerPrimerPolicy` through the same `powerGoalNudge` a role/goal signal
   * uses — a nudge toward contrast power, never a force, and never a count.
   */
  readonly power: boolean;
  /**
   * ACCELERATION-flavoured speed work, as distinct from top-speed.
   *
   * The late-off-season speed templates PROGRESS from accelerations toward build-ups
   * ("smooth build-ups, not all-out" — position 3). An acceleration lean holds the
   * selection on the acceleration templates instead of progressing off them, which is
   * Sam's "accelerations specifically, not top-speed" expressed at the only place the
   * app makes that choice.
   */
  readonly acceleration: boolean;
}

export const WEAK_POINT_LEAN: Readonly<Record<WeakPointFocus, WeakPointLean>> = {
  mobility_and_injury_prevention: {
    aerobic: false, speed: false, accessory: true, recovery: true,
    power: false, acceleration: false,
  },
  strength_and_size: {
    aerobic: false, speed: false, accessory: true, recovery: false,
    power: false, acceleration: false,
  },
  conditioning: {
    aerobic: true, speed: false, accessory: false, recovery: false,
    power: false, acceleration: false,
  },
  // SPEED pulls toward maximum velocity. POWER pulls toward accelerating. Sam ruled them
  // separate, and the two rows below are what "separate" means in code: neither sets the
  // other's flag, so no consumer can collapse them back.
  speed: {
    aerobic: false, speed: true, accessory: false, recovery: false,
    power: false, acceleration: false,
  },
  power_and_acceleration: {
    aerobic: false, speed: false, accessory: false, recovery: false,
    power: true, acceleration: true,
  },
  // Nothing leans on an unruled answer. The value stays because a future seventh answer
  // may arrive before its ruling does, and this is where it waits honestly.
  unresolved: {
    aerobic: false, speed: false, accessory: false, recovery: false,
    power: false, acceleration: false,
  },
};

/**
 * Does a stated weakness lean the OPTIONAL top-ups? (Sam's ruling 3.)
 *
 *   "YES — mobility/injury-history weakness leans the OPTIONAL top-ups (N2 firms to 2,
 *    placed early; N1 threshold moves to <4 of 6). Optional tier only; required work
 *    untouched — consistent with A."
 *
 * Optional tier only is what keeps this inside reading A: the top-ups are optional work
 * the need computation places, so leaning them changes what fills the week and not what
 * the week requires. The phase tables are untouched by anything in this module.
 */
export function weakPointLeansOptionalTopUps(focus: WeakPointFocus | null): boolean {
  return focus === 'mobility_and_injury_prevention';
}

/** N1's threshold under a mobility/injury-history weakness: below FOUR of the six. */
export const WEAK_POINT_ACCESSORY_REGION_THRESHOLD = 4;

/** Does this weakness nudge the authored power primer? (Sam's ruling 0.) */
export function weakPointNudgesPower(focus: WeakPointFocus | null): boolean {
  return focus !== null && WEAK_POINT_LEAN[focus].power;
}

/** Does this weakness hold speed selection on ACCELERATIONS? (Sam's ruling 0.) */
export function weakPointPrefersAcceleration(focus: WeakPointFocus | null): boolean {
  return focus !== null && WEAK_POINT_LEAN[focus].acceleration;
}
