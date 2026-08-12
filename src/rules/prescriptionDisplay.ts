/**
 * THE PRESCRIPTION-DISPLAY LAW — one middle number, not a range.
 *
 * Sam's law, `LFA_PROGRAMMING_BIBLE.md:4936` (Section 5, source D9): *"ranges
 * remain the generation source, the athlete sees a single middle number, logging
 * assumes it."* His own example at `:770`: **"3x8-12 is written as 3x10"**. It
 * supersedes the older top-of-range vs floor-of-range question — he closed that
 * by choosing the middle.
 *
 * ## What the app did instead
 *
 * `formatStrengthSetsReps` rendered `3 × 8-10` and the athlete picked a number
 * themselves — **the exact ambiguity the law was written to end** — while the
 * journal scored their load against a midpoint they were never shown. Census A3,
 * `docs/RULINGS_NOT_IN_THE_APP_2026-08-13.md`, reached independently by two
 * auditors.
 *
 * ## Why this is its own owner
 *
 * The law binds two surfaces — what the athlete READS and what logging ASSUMES —
 * so the number has to be computed in one place or the two will drift. The
 * journal's own `midpointReps` is deliberately UNROUNDED because it is doing
 * arithmetic over load; this returns the number a human is shown, which must be
 * whole. **They agree on the midpoint and differ only in rounding, and that
 * difference is stated rather than left to be discovered.**
 */

/** The single number the athlete is shown for a rep range. Whole, always. */
export function displayReps(min: number | null | undefined, max: number | null | undefined): number | null {
  const lo = typeof min === 'number' && Number.isFinite(min) && min > 0 ? min : null;
  const hi = typeof max === 'number' && Number.isFinite(max) && max > 0 ? max : null;
  if (lo === null && hi === null) return null;
  if (lo === null) return hi;
  if (hi === null) return lo;
  // Round HALF UP so an 8-11 range reads 10 rather than 9 — the athlete is shown
  // the more demanding of two equally-central numbers, which matches his
  // "3x8-12 -> 3x10" example sitting at the true middle.
  return Math.round((lo + hi) / 2);
}
