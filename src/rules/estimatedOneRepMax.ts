export interface OneRepMaxBasis {
  readonly externalLoadKg: number;
  readonly reps: number;
  readonly bodyWeightKg?: number;
}

/**
 * Brzycki estimated 1RM. Low-rep sets only: beyond ten reps the estimate
 * becomes too sensitive to endurance and proximity to failure to plot as a
 * believable strength value.
 */
export function estimateOneRepMaxKg(loadKg: number, reps: number): number | null {
  if (!Number.isFinite(loadKg) || loadKg <= 0) return null;
  if (!Number.isInteger(reps) || reps < 1 || reps > 10) return null;
  return loadKg * 36 / (37 - reps);
}

/**
 * External-load equivalent. Barbell lifts have no bodyWeightKg and therefore
 * return the ordinary estimate. A weighted Pull-Up estimates the total system
 * load first, then removes bodyweight so the athlete sees the familiar added
 * load rather than a misleading 90kg Pull-Up.
 */
export function estimateExternalOneRepMaxKg(basis: OneRepMaxBasis): number | null {
  const bodyWeightKg = basis.bodyWeightKg ?? 0;
  if (!Number.isFinite(bodyWeightKg) || bodyWeightKg < 0) return null;
  if (!Number.isFinite(basis.externalLoadKg) || basis.externalLoadKg < 0) return null;
  const totalEstimate = estimateOneRepMaxKg(
    bodyWeightKg + basis.externalLoadKg,
    basis.reps,
  );
  return totalEstimate === null ? null : Math.max(0, totalEstimate - bodyWeightKg);
}

export function bestOneRepMaxBasis(sets: readonly OneRepMaxBasis[]): OneRepMaxBasis | null {
  let best: OneRepMaxBasis | null = null;
  let bestEstimate = -Infinity;
  for (const set of sets) {
    const estimate = estimateExternalOneRepMaxKg(set);
    if (estimate === null || estimate <= bestEstimate) continue;
    best = set;
    bestEstimate = estimate;
  }
  return best;
}

export function isPullUpExerciseName(exerciseName: string): boolean {
  const normalized = exerciseName
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
  return normalized === 'pull up'
    || normalized === 'pull ups'
    || normalized === 'weighted pull up'
    || normalized === 'weighted pull ups';
}
