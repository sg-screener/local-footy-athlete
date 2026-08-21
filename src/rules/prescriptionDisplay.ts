/**
 * THE PRESCRIPTION-DISPLAY LAW — one approved rep target, not a range.
 *
 * Sam's law, `LFA_PROGRAMMING_BIBLE.md:4936` (Section 5, source D9): *"ranges
 * remain the generation source, the athlete sees a single approved rep target,
 * logging assumes it."* His own example at `:770`: **"3x8-12 is written as
 * 3x10"**. Arbitrary midpoint values were superseded on 2026-08-21 by the
 * approved target vocabulary below.
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
 * so the number has to be computed in one place or the two will drift.
 */

/** Sam's complete athlete-visible rep vocabulary. Timed prescriptions bypass this owner. */
export const APPROVED_REP_TARGETS = [3, 4, 5, 6, 8, 10, 15, 20] as const;

/**
 * The single number the athlete is shown for a rep range.
 *
 * Pick the approved target nearest the authored midpoint. Prefer a target that
 * stays inside the authored range; if two are equally close, the lower target
 * wins so formatting never quietly adds volume. A malformed range containing
 * no approved value still snaps to the closest approved target rather than
 * leaking an arbitrary number onto the athlete surface.
 */
export function displayReps(min: number | null | undefined, max: number | null | undefined): number | null {
  const lo = typeof min === 'number' && Number.isFinite(min) && min > 0 ? min : null;
  const hi = typeof max === 'number' && Number.isFinite(max) && max > 0 ? max : null;
  if (lo === null && hi === null) return null;
  const lower = Math.min(lo ?? hi!, hi ?? lo!);
  const upper = Math.max(lo ?? hi!, hi ?? lo!);
  const midpoint = (lower + upper) / 2;
  const insideRange = APPROVED_REP_TARGETS.filter((target) => target >= lower && target <= upper);
  const candidates = insideRange.length > 0 ? insideRange : APPROVED_REP_TARGETS;

  return candidates.reduce((best, target) => {
    const targetDistance = Math.abs(target - midpoint);
    const bestDistance = Math.abs(best - midpoint);
    return targetDistance < bestDistance ? target : best;
  });
}
