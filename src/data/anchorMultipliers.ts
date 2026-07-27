/**
 * Anchor multipliers — Sam-authored ladders, 2026-07-28.
 *
 * These convert an onboarding strength answer into the anchor 1RM that EVERY
 * load ratio multiplies:
 *
 *     anchor 1RM     = bodyweight × multiplier      ← this file
 *     working weight = anchor 1RM × exercise ratio  ← EXERCISE_LOAD_MAP
 *
 * So they sit upstream of all 77 ratios: an error here moves every suggested
 * weight in the app at once. They were unauthored until Sam ruled them, and six
 * of the thirteen rows moved — notably the whole bench floor, which had been
 * resting on the app's own 0.65 rather than on anything he had said.
 *
 * PROVENANCE: `ruling_anchor`. The verbatim ruling sentences live below and
 * `anchorMultiplierTests` asserts each is still present in the attributed
 * document AND still states the shipped numbers, so code and ruling cannot
 * drift apart in either direction.
 */

import type { SquatStrength, BenchStrength } from '../types/domain';

export const ANCHOR_MULTIPLIER_RULING = {
  ruledOn: '2026-07-28',
  where: 'docs/PROVENANCE_INVENTORY_2026-07-28.md',
  squatAnchor:
    'Squat ladder: I don\'t squat 0.5 · Less than bodyweight 0.75 · Around bodyweight 1.0 · '
    + '1.5x bodyweight 1.5 · 2x bodyweight+ 2.0 · Not sure = the "Less than bodyweight" value, '
    + 'tied — if less-than ever changes, Not-sure follows it.',
  benchAnchor:
    'Bench ladder: I don\'t bench 0.5 · Less than bodyweight 0.75 · Around bodyweight 1.0 · '
    + '1.25x bodyweight 1.25 · 1.5x bodyweight+ 1.5 · Not sure = tied to "Less than bodyweight", '
    + 'same rule.',
  fallbackAnchor: 'Missing bodyweight: FAIL LOUD, no default.',
} as const;

/**
 * The answered rungs. "Not sure" is deliberately absent — it is not an answer
 * about strength, it is the absence of one, and Sam tied it to the lowest
 * confident rung rather than giving it a number of its own.
 */
const SQUAT_LADDER = {
  "I don't squat": 0.5,
  'Less than bodyweight': 0.75,
  'Around bodyweight': 1.0,
  '1.5x bodyweight': 1.5,
  '2x bodyweight+': 2.0,
} as const;

const BENCH_LADDER = {
  "I don't bench": 0.5,
  'Less than bodyweight': 0.75,
  'Around bodyweight': 1.0,
  '1.25x bodyweight': 1.25,
  '1.5x bodyweight+': 1.5,
} as const;

/**
 * THE TIE. Sam: *"Not sure = the 'Less than bodyweight' value, tied — if
 * less-than ever changes, Not-sure follows it."*
 *
 * Written as a REFERENCE, never as a second 0.75. A copied literal would satisfy
 * every equality test forever and break the actual rule the first time
 * "Less than bodyweight" moved — the same one-fact-two-representations problem
 * this codebase has paid for repeatedly. `anchorMultiplierTests` asserts no
 * numeric literal is written for "Not sure" at all.
 */
export const SQUAT_ANCHOR_MULTIPLIERS: Record<SquatStrength, number> = {
  ...SQUAT_LADDER,
  'Not sure': SQUAT_LADDER['Less than bodyweight'],
};

export const BENCH_ANCHOR_MULTIPLIERS: Record<BenchStrength, number> = {
  ...BENCH_LADDER,
  'Not sure': BENCH_LADDER['Less than bodyweight'],
};
