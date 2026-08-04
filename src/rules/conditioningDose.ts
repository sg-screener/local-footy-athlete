/**
 * ONE parse of an authored conditioning dose string. The single ingress.
 *
 * WHY THIS EXISTS. `data/conditioningTemplates.ts` is a typed projection of
 * Sam's signed workbook, and it keeps every dose as a STRING on purpose — its
 * own header says so: "≈2 s (10 m)", "45–60 s walk-back (full recovery)" and
 * "4–6 × 60 s / 2 min" carry ranges, approximations and qualifiers that no
 * numeric type models without discarding authored meaning. That decision is
 * correct and is not revisited here.
 *
 * But generation has to build rows, and rows need numbers. Without one owner
 * for that step, every consumer writes its own regex — which is how a repo
 * ends up with several answers to "how long is the work period?", differing in
 * the corner Sam actually cares about. This module is that owner: **the only
 * place an authored dose string becomes a number.**
 *
 * ## What it will and will not do
 *
 * - It reads the **governing** quantity — the one the dose leads with.
 *   `≈2 s (10 m)` is a TWO SECOND effort described as ten metres; the parse
 *   returns 2 s and keeps the parenthetical as authored detail.
 * - It **refuses** rather than guesses. `Maximal — sets should mirror each
 *   other` has no governing quantity, and the refusal is a typed result a
 *   caller must handle, never a silent zero or a default. A dose the app
 *   cannot read is a dose the app must not invent.
 * - It **never replaces the authored string**. `raw` travels with every parse,
 *   and the athlete-visible words stay the signed ones. This module answers
 *   "how many seconds?", never "what does the athlete read?".
 *
 * L14: pure. No store, no clock, no React.
 */

/** The units the authored sheet actually leads with. */
export type ConditioningDoseUnit =
  | 'seconds'
  | 'minutes'
  | 'metres'
  | 'reps'
  | 'rounds'
  | 'sets'
  /** Sam's MAS shape: a BLOCK is a run of rounds with rest between blocks. */
  | 'blocks'
  | 'calories';

export interface ConditioningDoseQuantity {
  /** Low end of the authored range; equal to `max` when the dose is a single value. */
  readonly min: number;
  readonly max: number;
  readonly unit: ConditioningDoseUnit;
  /** The authored string opened with `≈` or `~` — the dose is nominal, not exact. */
  readonly approximate: boolean;
  /** The authored string, verbatim. The athlete-visible truth never leaves it. */
  readonly raw: string;
}

export type ConditioningDoseParse =
  | { readonly ok: true; readonly quantity: ConditioningDoseQuantity }
  | { readonly ok: false; readonly raw: string; readonly reason: DoseRefusal };

/**
 * Why a dose did not yield a number. Typed, because a caller's correct response
 * differs: `no_leading_quantity` is normal for a qualitative intensity cell,
 * while `unknown_unit` means the sheet grew a shape this owner has not been
 * taught and is a build-time question, not a runtime fallback.
 */
export type DoseRefusal =
  | 'empty'
  | 'no_leading_quantity'
  | 'unknown_unit'
  /**
   * An `N × M unit` composition ("3 × 8 min, or 4 × 6 min"). The leading number
   * is a count whose unit is only implied by the term after the ×, and this
   * owner deliberately does not reduce a composition to one quantity — doing so
   * would silently pick which half of Sam's authored shape survives. Refused
   * with its own reason so a caller can read the composition from the sheet
   * rather than treating it as an unreadable dose.
   */
  | 'composite_dose';

/**
 * Unit words as the sheet writes them, longest-first so `min` cannot be
 * matched inside `minutes` and `sec` cannot shadow `s`.
 */
const UNIT_WORDS: ReadonlyArray<readonly [RegExp, ConditioningDoseUnit]> = [
  [/^minutes?\b/i, 'minutes'],
  [/^mins?\b/i, 'minutes'],
  [/^seconds?\b/i, 'seconds'],
  [/^secs?\b/i, 'seconds'],
  [/^s\b/i, 'seconds'],
  [/^metres?\b/i, 'metres'],
  [/^m\b/i, 'metres'],
  [/^reps?\b/i, 'reps'],
  [/^rounds?\b/i, 'rounds'],
  [/^sets?\b/i, 'sets'],
  [/^blocks?\b/i, 'blocks'],
  [/^cals?\b/i, 'calories'],
  [/^calories\b/i, 'calories'],
];

/**
 * The sheet uses a true en dash for ranges and a multiplication sign for
 * set×rep shapes. Normalising them here — rather than in each caller's regex —
 * is half the reason this owner exists: a caller matching a hyphen silently
 * fails on every ranged dose Sam authored.
 */
function normalise(text: string): string {
  return text
    .replace(/[‒–—―]/g, '-')
    .replace(/[×✕]/g, 'x')
    .replace(/≈/g, '~')
    .trim();
}

/**
 * Read the governing quantity out of an authored dose string.
 *
 * The leading number (or range) plus the unit word that follows it. Anything
 * after that — parenthetical distances, recovery qualifiers, framework notes —
 * is authored detail this function deliberately does not interpret.
 */
export function parseConditioningDose(text: string | null | undefined): ConditioningDoseParse {
  const raw = String(text ?? '');
  const normalised = normalise(raw);
  if (!normalised) return { ok: false, raw, reason: 'empty' };

  const approximate = /^[~]/.test(normalised);
  const body = normalised.replace(/^[~\s]+/, '');

  // A leading number, optionally a range, optionally approximate on the high
  // end too ("90 s-2 min" is a range across units and is deliberately NOT
  // treated as one — the governing unit is the first).
  const match = /^(\d+(?:\.\d+)?)\s*(?:-\s*[~]?\s*(\d+(?:\.\d+)?))?\s*(.*)$/.exec(body);
  if (!match) return { ok: false, raw, reason: 'no_leading_quantity' };

  const min = Number(match[1]);
  const tail = match[3] ?? '';
  const unit = UNIT_WORDS.find(([pattern]) => pattern.test(tail))?.[1];
  if (!unit) {
    // `2 blocks x 5 rounds` DOES lead with a unit and parses above. What lands
    // here is `3 x 8 min` — a bare count whose unit only the term after the ×
    // supplies. That is a composition, not an unreadable unit, and the two are
    // kept apart so an unknown unit stays a build-time question about the sheet.
    return { ok: false, raw, reason: /^x\b/i.test(tail) ? 'composite_dose' : 'unknown_unit' };
  }

  // A range whose high end carries a DIFFERENT unit ("90 s-2 min") is not a
  // range in one unit, and coercing it would understate the dose. The governing
  // low end is returned and the high end stays authored detail.
  const maxCandidate = match[2] === undefined ? min : Number(match[2]);
  const highUnitTail = match[2] === undefined
    ? null
    : /^\d+(?:\.\d+)?\s*(.*)$/.exec(
        body.slice(body.indexOf(match[2], match[1].length)))?.[1] ?? null;
  const highUnit = highUnitTail === null
    ? unit
    : UNIT_WORDS.find(([pattern]) => pattern.test(highUnitTail))?.[1] ?? unit;
  const max = highUnit === unit ? maxCandidate : min;

  return {
    ok: true,
    quantity: { min, max: Math.max(min, max), unit, approximate, raw },
  };
}

/**
 * Seconds, for a time-unit quantity. Returns null for a non-time unit rather
 * than inventing a conversion — metres are not seconds without a speed, and
 * the speed is the athlete's, not this module's.
 */
export function doseSeconds(
  quantity: ConditioningDoseQuantity,
): { min: number; max: number } | null {
  if (quantity.unit === 'seconds') return { min: quantity.min, max: quantity.max };
  if (quantity.unit === 'minutes') return { min: quantity.min * 60, max: quantity.max * 60 };
  return null;
}

/**
 * The midpoint a builder uses when it must commit to ONE number.
 *
 * Separated from the parse so the range survives everywhere else: a caller that
 * needs a single value asks for one explicitly, and the fact that it collapsed
 * an authored range is visible at the call site rather than buried in the parse.
 */
export function doseMidpoint(quantity: ConditioningDoseQuantity): number {
  return (quantity.min + quantity.max) / 2;
}
