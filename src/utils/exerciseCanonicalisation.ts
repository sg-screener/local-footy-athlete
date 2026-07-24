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

/**
 * In-compound abbreviation expansions, applied token-by-token. The curated
 * vocabulary spells movements out in full ("Overhead Press", "Single-Arm",
 * "Dumbbell"); edge/AI spellings abbreviate them, sometimes only inside a
 * compound ("… OHP", "SA …") where a whole-string alias can never reach them.
 * Expanding to the curated full words makes both sides share one signature.
 */
const TOKEN_EXPANSIONS: Record<string, string> = {
  ohp: 'overhead press',
  sa: 'single arm',
  db: 'dumbbell',
  bb: 'barbell',
  kb: 'kettlebell',
  rdl: 'romanian deadlift',
};

/**
 * A word-order-independent signature: lowercase, punctuation/hyphens to spaces,
 * abbreviations expanded to the curated full words, tokens sorted. Two spellings
 * that differ only in word order or in-compound abbreviation share a signature;
 * spellings with a different set of words do not (no partial/substring matching,
 * so no false positives).
 */
function tokenSignature(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((token) => (TOKEN_EXPANSIONS[token] ?? token).split(' '))
    .sort()
    .join(' ');
}

/**
 * Curated key by token signature. First writer wins; the vocabulary-closure
 * test (exerciseNameCanonicalisationTests §6) asserts no two curated keys share
 * a signature, so the layer is unambiguous.
 */
const curatedKeyBySignature: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const key of Object.keys(EXERCISE_CUES)) {
    const sig = tokenSignature(key);
    if (!map.has(sig)) map.set(sig, key);
  }
  return map;
})();

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
  // Last: a token-normalised signature match, so a reordered or in-compound
  // abbreviated spelling ("single-arm half-kneeling OHP") still lands on its
  // curated key. This is what the whole-string alias table above cannot do.
  const bySignature = curatedKeyBySignature.get(tokenSignature(raw));
  if (bySignature) return bySignature;
  return raw;
}

/** True when a name resolves to a real curated cue (never the generic fallback). */
export function hasCuratedCue(raw: string): boolean {
  return Boolean(EXERCISE_CUES[canonicalExerciseName(raw)]);
}

/**
 * The subset of `names` that do NOT resolve to a curated cue — the
 * generation-contract violations. Deduplicated, order-preserving.
 */
export function collectUnresolvedCues(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const unresolved: string[] = [];
  for (const name of names) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    if (!hasCuratedCue(name)) unresolved.push(name);
  }
  return unresolved;
}

/**
 * Thrown at program acceptance when a to-be-rendered exercise name does not
 * resolve to a curated cue. The ingress boundary is TOTAL: an unresolved name
 * is a loud generation-contract violation, never a silent cueless card (Sam
 * ruling, L10 run 3). Callers in production may catch this and `logger.error`
 * rather than crash; the assertion itself always throws so it is testable and
 * hard-fails in development.
 */
export class ExerciseVocabularyViolation extends Error {
  readonly unresolved: string[];
  constructor(context: string, unresolved: string[]) {
    super(
      `[GenerationContract] ${context}: ${unresolved.length} exercise name(s) `
        + `with no curated cue — ${unresolved.join(', ')}. The curated layer owns `
        + 'every athlete-visible word (Stage 3): add a curated cue or an alias so '
        + 'the name resolves at the canonicalisation boundary.',
    );
    this.name = 'ExerciseVocabularyViolation';
    this.unresolved = unresolved;
  }
}

/** Throw if any name lacks a curated cue. Pure; production wraps its own policy. */
export function assertCuratedExerciseCues(names: readonly string[], context: string): void {
  const unresolved = collectUnresolvedCues(names);
  if (unresolved.length > 0) throw new ExerciseVocabularyViolation(context, unresolved);
}
