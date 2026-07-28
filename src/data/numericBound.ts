/**
 * Numeric bound — the MECHANISM, with no authored numbers in it.
 *
 * Split out of `onboardingNumericBounds` when the 2km time trial joined the
 * registry. The reason is ownership, not tidiness: the 2km owner
 * (`twoKmTimeTrial`) holds every 2km number Sam ruled — the accepted range, the
 * skip defaults, the MAS multiplier — and the registry has to be able to list
 * that range without the two files importing each other in a circle.
 *
 * So the layering points one way:
 *
 *     numericBound  <-  twoKmTimeTrial  <-  onboardingNumericBounds
 *     (mechanism)       (2km numbers)       (the lookup surface)
 *
 * Nothing authored lives here. If you are adding a number, you are in the wrong
 * file.
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
  /**
   * Render a bound value the way the athlete typed it, e.g. 300 -> "5:00".
   *
   * A stored unit and a spoken unit are not always the same. A 2km time is
   * STORED in seconds because that is what arithmetic wants, and SPOKEN in
   * min:sec because that is what the athlete entered — telling someone who
   * typed 20:00 that the limit is "900" asks them to do arithmetic to
   * understand a refusal. Omitted where the two coincide, as they do for kg
   * and cm.
   */
  readonly format?: (value: number) => string;
}

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
 * Accept a value against a bound, or refuse it with something actionable.
 *
 * Refusal never carries a suggested value. Offering one is a clamp wearing a
 * question mark — the athlete taps accept and the app's number becomes theirs.
 */
export function validateAgainstBound(
  bound: NumericBound,
  value: number,
): MeasurementValidation {
  if (!Number.isFinite(value)) {
    return { ok: false, message: `Enter your ${bound.noun} in ${bound.unit}.` };
  }
  if (value < bound.min || value > bound.max) {
    // Spoken in the athlete's units when the bound says how, stored units
    // otherwise. `30 and 200 kg` and `5:00 and 15:00` both read as English.
    const range = bound.format
      ? `${bound.format(bound.min)} and ${bound.format(bound.max)}`
      : `${bound.min} and ${bound.max} ${bound.unit}`;
    return {
      ok: false,
      message: `That ${bound.noun} looks off. Enter a ${bound.noun} between ${range}.`,
    };
  }
  return { ok: true };
}
