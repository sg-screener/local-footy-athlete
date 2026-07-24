/**
 * exerciseCanonicalisation — the single boundary that resolves ANY incoming
 * exercise name onto Sam's curated vocabulary before any athlete-visible layer
 * reads it.
 *
 * Ownership (Part B / Stage 3): the curated layer owns every athlete-visible
 * word; generation provides structure only. A program can carry an exercise name
 * from any generator — the local pools (already cue-covered by
 * authoredCueLibraryTests §6) or the AI backend, whose spellings diverge
 * ("Farmers Carry" vs the curated "Farmer Carry"). Every reader of an
 * exercise's cue/tag/load must first canonicalise the name through here, so an
 * off-vocabulary spelling can never silently fall through to a generic cue or
 * drop its load anchor.
 *
 * Resolution order:
 *   1. Already a curated cue key (exact).
 *   2. Case-insensitive curated key.
 *   3. The load-alias resolver (`resolveExerciseName`, plurals/possessives) —
 *      taken only when it lands on a curated cue key.
 * Otherwise the raw name is returned unchanged; the vocabulary-closure test
 * (exerciseNameCanonicalisationTests) fails the build if a name the app can
 * prescribe does not land on a curated key here.
 */
import { EXERCISE_CUES } from '../data/exerciseCues';
import { resolveExerciseName } from './loadEstimation';

const curatedKeyByLower: Map<string, string> = new Map(
  Object.keys(EXERCISE_CUES).map((key) => [key.toLowerCase(), key]),
);

/** The curated cue key an incoming name maps to, or the raw name if none. */
export function canonicalExerciseName(raw: string): string {
  if (!raw) return raw;
  if (EXERCISE_CUES[raw]) return raw;
  const lower = raw.toLowerCase();
  const ci = curatedKeyByLower.get(lower);
  if (ci) return ci;
  // Bridge divergent spellings through the load-alias map, but only adopt the
  // result when it is itself a curated key (otherwise keep the raw name).
  const resolved = resolveExerciseName(raw);
  if (resolved !== raw) {
    if (EXERCISE_CUES[resolved]) return resolved;
    const resolvedCi = curatedKeyByLower.get(resolved.toLowerCase());
    if (resolvedCi) return resolvedCi;
  }
  return raw;
}

/** True when a name resolves to a real curated cue (never the generic fallback). */
export function hasCuratedCue(raw: string): boolean {
  return Boolean(EXERCISE_CUES[canonicalExerciseName(raw)]);
}
