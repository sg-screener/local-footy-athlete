/**
 * injuryReintroduction.ts — staged injury return (Bible §8 "General severity
 * rules" + per-area severity ladders).
 *
 * When an athlete improves from a severe/limiting injury, the app must NOT
 * instantly restore full training. Reintroduction is staged: relax the
 * restriction by roughly one severity band at a time, so the highest-risk
 * affected work (sprint, Nordics, deep-knee, plyos, heavy pressing, …) is
 * reintroduced LAST.
 *
 * MECHANISM — one lever, no parallel injury system
 * ------------------------------------------------
 * The whole injury pipeline already keys its restrictions off a single 1-10
 * severity (`severityToTier`, `classifyExerciseRiskForBucket`, the Bible band
 * flags). Reintroduction therefore just computes an *effective* severity that
 * decays gradually toward the reported severity instead of snapping to it:
 *
 *   effective = report is NOT an improvement (current >= prior)  → current
 *               improving (current < prior)                      → max(current, prior - STEP)
 *
 * with STEP = 2 (one Bible band). Feeding this effective severity into the
 * EXISTING gates keeps the previous band's risky-work exclusions in place for
 * one more step:
 *
 *   8-10 → 6-7 : effective 6-7 (strict)  → risky affected work stays OUT
 *   6-7  → 4-5 : effective 4-5 (relaxed) → controlled affected work returns,
 *                                          high-risk triggers still removed
 *   4-5  → 1-3 : effective 1-3 (light)   → mostly normal, avoid exact trigger
 *
 * SAFETY: this only ever RAISES the effective severity relative to the reported
 * value (never lowers it), so it can only keep restrictions ON longer — it can
 * never weaken a red-flag hard stop, and when there is no prior/peak severity
 * (a fresh injury, or any legacy caller) it is an exact no-op.
 */

/** One Bible severity band ≈ 2 points. A downgrade relaxes at most this much. */
export const REINTRODUCTION_STEP = 2;

export interface ReintroductionInput {
  /** The newly-reported severity (1-10, or 0 = cleared). */
  currentSeverity: number;
  /**
   * The recent PEAK / previous severity for this injury, if known. Undefined
   * when there is no history (fresh injury) — then no staging is applied.
   */
  priorSeverity?: number | null;
}

function clampSeverity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(10, Math.max(0, Math.round(value)));
}

/**
 * True when the athlete is improving from a higher recent severity and the
 * staged effective severity is above the reported value (i.e. reintroduction
 * is holding some restriction back).
 */
export function isReintroducing(input: ReintroductionInput): boolean {
  const current = clampSeverity(input.currentSeverity);
  const prior = input.priorSeverity == null ? null : clampSeverity(input.priorSeverity);
  if (prior == null || current <= 0) return false;
  return current < prior && stageReintroductionSeverity(input) > current;
}

/**
 * The severity the restriction pipeline should actually use. Never below the
 * reported severity; at most one band below the recent peak while improving.
 */
export function stageReintroductionSeverity(input: ReintroductionInput): number {
  const current = clampSeverity(input.currentSeverity);
  // A cleared injury (0) is genuinely cleared — reintroduction never resurrects
  // a restriction from nothing. Recent-history caution is expressed elsewhere
  // (the injury is removed from active constraints on clear).
  if (current <= 0) return 0;

  const prior = input.priorSeverity == null ? null : clampSeverity(input.priorSeverity);
  if (prior == null || prior <= current) return current; // fresh / worsening / stable

  // Improving: relax by at most one band from the recent peak.
  return Math.max(current, prior - REINTRODUCTION_STEP);
}
