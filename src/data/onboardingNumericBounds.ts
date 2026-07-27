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

/** Where a ruling lives, so a citation can be checked rather than trusted. */
export interface BoundAttribution {
  /** ISO date of the ruling. */
  readonly ruledOn: string;
  /** Repo-relative path to the document recording it. Must exist. */
  readonly where: string;
}

export interface NumericBound {
  /** Inclusive floor. */
  readonly min: number;
  /** Inclusive ceiling. */
  readonly max: number;
  /** Unit as the athlete sees it, used to build the re-ask message. */
  readonly unit: string;
  /** Plain noun for the re-ask message — never the field name. */
  readonly noun: string;
  /** Verbatim sentence from the ruling. Must contain the numbers it justifies. */
  readonly anchor: string;
  readonly attribution: BoundAttribution;
}

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
} as const satisfies Record<string, NumericBound>;

export type OnboardingMeasurementField = keyof typeof ONBOARDING_NUMERIC_BOUNDS;

/**
 * Deliberately a single shape rather than a discriminated union: this repo does
 * not enable `strict`, so `strictNullChecks` is off and TypeScript will not
 * narrow `{ ok: true } | { ok: false; message: string }` on the discriminant.
 * A union that does not narrow buys nothing and costs every caller a cast.
 * `message` is present exactly when `ok` is false.
 */
export interface MeasurementValidation {
  readonly ok: boolean;
  readonly message?: string;
}

/**
 * Accept a measurement, or refuse it with something the athlete can act on.
 *
 * Refusal never carries a suggested value. Offering one is a clamp wearing a
 * question mark — the athlete taps accept and the app's number becomes theirs.
 */
export function validateOnboardingMeasurement(
  field: OnboardingMeasurementField,
  value: number,
): MeasurementValidation {
  const bound = ONBOARDING_NUMERIC_BOUNDS[field];

  if (!Number.isFinite(value)) {
    return { ok: false, message: `Enter your ${bound.noun} in ${bound.unit}.` };
  }
  if (value < bound.min || value > bound.max) {
    return {
      ok: false,
      message: `That ${bound.noun} looks off. Enter a ${bound.noun} between `
        + `${bound.min} and ${bound.max} ${bound.unit}.`,
    };
  }
  return { ok: true };
}
