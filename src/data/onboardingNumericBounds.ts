/**
 * Onboarding numeric bounds — Sam-authored, 2026-07-28.
 *
 * WHY THESE EXIST. Onboarding validated numeric answers with `> 0` and nothing
 * else: no upper bound, no `maxLength`, no schema validator anywhere in the app.
 * Bodyweight is not a record field — it is the FIRST TERM of the anchor chain
 * (`anchor 1RM = bodyweight x multiplier`), and all 77 load ratios multiply it.
 * A typed 5000 produced a 4100 kg Back Squat card, and "800" for "80" is one
 * keystroke on a numeric keypad with no length limit.
 *
 * Both failure directions were silent, in different ways. Too high propagated
 * faithfully into an absurd prescription. Too low was CLAMPED — not by any
 * judgement about the athlete, but by `MIN_WEIGHTS.barbell` happening to catch
 * it, so a 3 kg athlete received a plausible-looking 20 kg card. That second one
 * is the harder to notice: nonsense in, sane-looking number out.
 *
 * WHY REFUSE RATHER THAN CLAMP. A clamp substitutes the app's number for the
 * athlete's and then proceeds as though they had agreed to it. That is the same
 * defect class as the render-truth "BW", where the least-informed state was also
 * the most confident one. An answer nobody can interpret has exactly one honest
 * response: ask again.
 *
 * PROVENANCE. These are `ruling_anchor` values. Each carries the verbatim
 * sentence from Sam's ruling, and `onboardingNumericBoundsTests` asserts that
 * sentence is still present in the attributed document AND still states the
 * numbers — so the code and the ruling cannot drift apart in either direction.
 */

import {
  validateAgainstBound,
  type BoundAttribution,
  type MeasurementValidation,
  type NumericBound,
} from './numericBound';
import { TWO_KM_SECONDS_BOUND } from './twoKmTimeTrial';

// The mechanism moved to `numericBound` when the 2km time trial joined this
// registry: the 2km owner holds every 2km number Sam ruled, and the two files
// cannot import each other in a circle. Re-exported so existing importers of
// these types keep working and there is still one name for each.
export type { BoundAttribution, MeasurementValidation, NumericBound };

const RULING: BoundAttribution = {
  ruledOn: '2026-07-28',
  where: 'docs/PROVENANCE_INVENTORY_2026-07-28.md',
};

export const ONBOARDING_NUMERIC_BOUNDS = {
  weightKg: {
    min: 30,
    max: 200,
    unit: 'kg',
    noun: 'weight',
    anchor: 'Bodyweight accepted range 30–200 kg.',
    attribution: RULING,
  },
  heightCm: {
    min: 100,
    max: 230,
    unit: 'cm',
    noun: 'height',
    // Height is DATA QUALITY ONLY — Sam scoped it off the load path. Nothing in
    // load estimation reads it, and a gate asserts that stays true.
    anchor: 'Height accepted range 100–230 cm.',
    attribution: RULING,
  },
  // Owned by `twoKmTimeTrial`, listed here. The 2km range is one of several
  // numbers Sam ruled together (range, skip defaults, MAS multiplier) and they
  // belong to one another; splitting the range off into this file would put
  // half a ruling in each of two places.
  twoKmSeconds: TWO_KM_SECONDS_BOUND,
} as const satisfies Record<string, NumericBound>;

export type OnboardingMeasurementField = keyof typeof ONBOARDING_NUMERIC_BOUNDS;

/**
 * Accept a measurement, or refuse it with something the athlete can act on.
 *
 * The refusal itself is built by `validateAgainstBound` — one implementation,
 * so bodyweight, height and the 2km time cannot come to disagree about what a
 * refusal sounds like. This function is the field-name lookup in front of it.
 *
 * Refusal never carries a suggested value. Offering one is a clamp wearing a
 * question mark — the athlete taps accept and the app's number becomes theirs.
 */
export function validateOnboardingMeasurement(
  field: OnboardingMeasurementField,
  value: number,
): MeasurementValidation {
  return validateAgainstBound(ONBOARDING_NUMERIC_BOUNDS[field], value);
}
