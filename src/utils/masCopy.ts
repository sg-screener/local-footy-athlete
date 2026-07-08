/**
 * MAS copy + intensity helpers.
 *
 * Single source of truth for:
 *   1. MAS-based work-interval intensity prescription
 *   2. Athlete-facing MAS fallback explanation
 *
 * Rule (MAS intensity by work-interval length):
 *   • Work interval ≤ 30s  → 110% MAS
 *   • Work interval  > 30s → 100% MAS
 *
 * Examples:
 *   • MAS 15:15           → 15s work → 110% MAS
 *   • 20s efforts         → 110% MAS
 *   • 30s efforts         → 110% MAS
 *   • 40s efforts         → 100% MAS
 *   • 1 min reps          → 100% MAS
 *   • 2 min / 4 min reps  → 100% MAS
 *
 * Athletes who don't know their MAS should be able to supply a recent
 * 2km or 3km time-trial time and the coach will derive their target
 * distance per rep. Keep the fallback note on every MAS description.
 */

/** Percentage of MAS for a given work-interval length (in seconds). */
export function masIntensityForWorkSeconds(workSeconds: number): 100 | 110 {
  return workSeconds <= 30 ? 110 : 100;
}

/** Formatted label, e.g. "110% MAS" or "100% MAS". */
export function masIntensityLabel(workSeconds: number): string {
  return `${masIntensityForWorkSeconds(workSeconds)}% MAS`;
}

/**
 * Athlete-friendly fallback note for any MAS-prescribed session.
 * Most athletes won't know what MAS means or what their MAS number is,
 * so every MAS session must carry this line.
 */
export const MAS_FALLBACK_NOTE =
  "Don't know MAS? Send your 2km or 3km time trial.";

/**
 * Build a full MAS intensity + fallback block for pasting into a
 * session description.
 *
 * @param workSeconds  length of a single work interval
 * @param opts.includeGloss  when true, adds a one-line gloss of what
 *   MAS means (Maximum Aerobic Speed). Off by default so we don't
 *   bloat descriptions — the fallback line is usually enough.
 */
export function masIntensityBlock(
  workSeconds: number,
  opts: { includeGloss?: boolean } = {},
): string {
  const pace = `Target pace: ${masIntensityLabel(workSeconds)} on each work interval.`;
  const gloss = opts.includeGloss
    ? '\n(MAS = Maximum Aerobic Speed - the slowest pace that maxes out your aerobic system.)'
    : '';
  return `${pace}${gloss}\n${MAS_FALLBACK_NOTE}`;
}

// ───────────────────────────────────────────────────────────────────────
// MAS distance calculator
//
// Used by the in-app coach (and any future UI) to convert a recent
// time-trial result + work-interval length into a target distance per
// rep. This is the SAME calculation the AI coach is told to use, so the
// app never disagrees with itself.
//
// Formula:
//   MAS (km/h) ≈ TT_distance_km ÷ TT_time_hours
//   speed (m/s) = MAS_kmh ÷ 3.6
//   distance per rep = speed (m/s) × intensity_multiplier × work_seconds
//   intensity_multiplier = 1.10 for ≤30s reps, 1.00 for >30s reps
// ───────────────────────────────────────────────────────────────────────

/** Convert MAS in km/h to m/s. */
export function masKmhToMs(masKmh: number): number {
  return masKmh / 3.6;
}

/**
 * Estimate MAS (km/h) from a time-trial.
 * Conservative estimate — actual MAS is typically 1-3% higher than TT
 * average pace because TTs are run slightly above MAS, but for athlete-
 * facing distance prescription the difference is well within the ±2-3m
 * range we hand out anyway.
 */
export function estimateMasFromTimeTrial(
  distanceKm: number,
  timeSeconds: number,
): number {
  if (distanceKm <= 0 || timeSeconds <= 0) return 0;
  const hours = timeSeconds / 3600;
  return distanceKm / hours;
}

/**
 * Target distance per rep for a MAS-based interval session.
 * Returns metres, rounded to the nearest metre.
 *
 * @param masKmh        athlete's MAS in km/h (use estimateMasFromTimeTrial if deriving)
 * @param workSeconds   length of one work interval
 */
export function masDistancePerRep(masKmh: number, workSeconds: number): number {
  if (masKmh <= 0 || workSeconds <= 0) return 0;
  const speedMs = masKmhToMs(masKmh);
  const intensity = masIntensityForWorkSeconds(workSeconds) / 100;
  return Math.round(speedMs * intensity * workSeconds);
}

/**
 * Recommended ±tolerance band (in metres) for athlete self-regulation.
 * 2-3m for short reps, 5m for longer reps where small distance drift
 * matters less.
 */
export function masDistanceTolerance(workSeconds: number): number {
  return workSeconds <= 30 ? 3 : 5;
}
