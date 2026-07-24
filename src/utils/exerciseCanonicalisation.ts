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
 *   3. The load-alias resolver (`resolveExerciseName`) — a curator's explicit
 *      ruling about a spelling, so it outranks any inferred match. Its TARGET is
 *      then resolved by rules 1/4/5 like any other spelling.
 *   4. Token signature: word order, number and in-compound abbreviation removed.
 *   5. Bounded superset match: shed equipment/position qualifier tokens while
 *      the remainder resolves to exactly one curated key.
 * Otherwise the raw name is returned unchanged, and the acceptance gate
 * (`enforceCuratedCueContract`) REFUSES the program rather than render it — an
 * unresolved name is a loud generation-contract violation, never a silent
 * cueless card (Sam ruling, device run 5). The vocabulary-closure test
 * (exerciseNameCanonicalisationTests) fails the build if a name the app can
 * prescribe does not land on a curated key here.
 *
 * The upstream half of the same contract: the generation prompt now offers this
 * vocabulary (`curatedExerciseVocabulary`) and instructs selection from it only,
 * so the generator no longer holds naming rights. Widening this matcher without
 * that is a permanent tail-chase.
 */
import { EXERCISE_CUES } from '../data/exerciseCues';
import {
  POWER_POOL_PENDING,
  selectableExerciseNames,
} from '../data/selectableExerciseVocabulary';
import { resolveExerciseName } from './loadEstimation';

/**
 * The curated NAME registry — every name the app is willing to call an
 * exercise, which is a strictly wider question than "which names have a cue".
 *
 * Selectable pool membership is the spine (see selectableExerciseVocabulary:
 * one circle), plus the power-block vocabulary the app itself names while its
 * pool placement is pending. Keying the boundary on cues alone meant a movement
 * with a family-level cue — every conditioning format, and the whole power
 * block — could not be canonicalised at all, so a merged spelling had nowhere
 * to land ("explosive push-ups" → "Explosive Push-up").
 *
 * Resolving a name and having a cue stay separate questions: `hasCuratedCue`
 * still demands a real EXERCISE_CUES entry, so widening the registry cannot
 * weaken the acceptance gate.
 */
function curatedNameRegistry(): string[] {
  return [...new Set([
    ...Object.keys(EXERCISE_CUES),
    ...selectableExerciseNames(),
    ...POWER_POOL_PENDING,
  ])];
}

const CURATED_NAMES: string[] = curatedNameRegistry();
const CURATED_NAME_SET: Set<string> = new Set(CURATED_NAMES);

const curatedKeyByLower: Map<string, string> = new Map(
  CURATED_NAMES.map((key) => [key.toLowerCase(), key]),
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
  // Sam's locked list spells lifts out in full ("Speed Trap Bar Deadlift", not
  // "speed trap bar DL"). Expanding the abbreviation here is the general form of
  // that rule, so "trap bar DL" collapses onto "Trap Bar Deadlift" without a
  // per-spelling alias for every lift the shorthand can decorate.
  dl: 'deadlift',
  banded: 'band',
};

/**
 * Number is not part of a movement's identity: "Hamstring Curls" and "Hamstring
 * Curl" are the same lift. Plurals used to be handled ad-hoc by whole-string
 * aliases, so whichever plural nobody had thought of rendered cueless (device
 * run 5). Singularisation is applied symmetrically to both sides of the
 * signature, so it can never change which names are distinguishable — only
 * which spellings collapse onto the same one.
 */
function singulariseToken(token: string): string {
  if (token.length <= 2 || !/[a-z]s$/.test(token)) return token;
  if (/ies$/.test(token)) return `${token.slice(0, -3)}y`;
  // "-es" is only a plural suffix when the STEM is a real sibilant ending
  // ("presses" -> "press", "boxes" -> "box"). A stem that merely ends in a
  // single s or z is a silent-e word, so only the "s" belongs to the plural
  // ("releases" -> "release", "squeezes" -> "squeeze", "raises" -> "raise").
  if (/es$/.test(token)) {
    const stem = token.slice(0, -2);
    if (/(?:ss|zz|ch|sh|x)$/.test(stem)) return stem;
  }
  if (/ss$/.test(token)) return token;          // "press", "cross" are singular
  return token.slice(0, -1);
}

/**
 * Qualifier tokens a generator decorates a movement with: the equipment it is
 * loaded with and the position/setup it is performed in. They are the tokens a
 * superset spelling adds ("… OHP (DB)", "Incline DB Row (Chest Supported)"), and
 * the ONLY tokens the boundary may drop — never a token that carries the
 * movement's identity ("single", "arm", "chest", "supported", "row").
 */
export const EQUIPMENT_QUALIFIER_TOKENS = new Set([
  'dumbbell', 'barbell', 'kettlebell', 'cable', 'machine', 'band',
  'bodyweight', 'smith', 'weighted', 'plate',
]);
export const POSITION_QUALIFIER_TOKENS = new Set([
  'incline', 'decline', 'seated', 'standing', 'lying', 'kneeling', 'half',
  'supported', 'alternating', 'staggered', 'elevated', 'close', 'wide', 'neutral',
]);
const QUALIFIER_TOKENS = new Set([...EQUIPMENT_QUALIFIER_TOKENS, ...POSITION_QUALIFIER_TOKENS]);

/** How many qualifier tokens a superset spelling may shed. Bounded on purpose. */
const MAX_DROPPED_QUALIFIERS = 2;

/**
 * The normalised, de-duplicated, sorted tokens of a name. Lowercase,
 * punctuation/hyphens to spaces, singularised, abbreviations expanded to the
 * curated full words. De-duplication makes the signature a SET, so appending a
 * qualifier a name already carries ("Incline DB Bench (DB)") is a no-op.
 */
export function signatureTokens(raw: string): string[] {
  const tokens = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(singulariseToken)
    .flatMap((token) => (TOKEN_EXPANSIONS[token] ?? token).split(' '));
  return [...new Set(tokens)].sort();
}

/**
 * A word-order-independent signature. Two spellings that differ only in word
 * order, number, or in-compound abbreviation share a signature; spellings with a
 * different set of words do not (no partial/substring matching, so no false
 * positives).
 */
function tokenSignature(raw: string): string {
  return signatureTokens(raw).join(' ');
}

/**
 * Curated key by token signature. First writer wins; the vocabulary-closure
 * test (exerciseNameCanonicalisationTests §6) asserts no two curated keys share
 * a signature, so the layer is unambiguous.
 */
const curatedKeyBySignature: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const key of CURATED_NAMES) {
    const sig = tokenSignature(key);
    if (!map.has(sig)) map.set(sig, key);
  }
  return map;
})();

/**
 * A curated key reached by shedding qualifier tokens from a SUPERSET spelling,
 * or null.
 *
 * Token-sort equality can only match a name with exactly the curated word set,
 * so a generator that decorates a movement with the equipment or position it
 * used ("Single Arm Half Kneeling OHP (DB)") never matched and rendered blank
 * (device run 5). This sheds qualifier tokens — fewest first, at most
 * `MAX_DROPPED_QUALIFIERS` — and adopts the result ONLY when exactly one curated
 * key is reachable at that depth. Fewest-first is what makes the more specific
 * key win: "Incline DB Row (Chest Supported)" sheds only "incline" and lands on
 * "Chest-Supported DB Row" rather than shedding "dumbbell" too and flattening to
 * "Chest Supported Row". Two distinct keys at the same depth is genuine
 * ambiguity: the name stays unresolved and the acceptance gate refuses it, which
 * is the honest outcome — never a guessed cue.
 */
function resolveBySheddingQualifiers(tokens: readonly string[]): string | null {
  const shed = tokens.filter((token) => QUALIFIER_TOKENS.has(token));
  const depth = Math.min(MAX_DROPPED_QUALIFIERS, shed.length);
  for (let k = 1; k <= depth; k += 1) {
    const reached = new Set<string>();
    for (const subset of combinations(shed, k)) {
      const remainder = tokens.filter((token) => !subset.includes(token));
      if (remainder.length === 0) continue;
      const key = curatedKeyBySignature.get(remainder.join(' '));
      if (key) reached.add(key);
    }
    if (reached.size === 1) return [...reached][0];
    if (reached.size > 1) return null;   // ambiguous at the shallowest depth — refuse
  }
  return null;
}

/** Every k-sized subset of `items` (k <= 2 in practice, so this stays trivial). */
function combinations(items: readonly string[], k: number): string[][] {
  if (k === 0) return [[]];
  const out: string[][] = [];
  for (let i = 0; i <= items.length - k; i += 1) {
    for (const rest of combinations(items.slice(i + 1), k - 1)) {
      out.push([items[i], ...rest]);
    }
  }
  return out;
}

/**
 * The curated key a single spelling lands on, or null: exact, then
 * case-insensitive, then a token-normalised signature (so a reordered,
 * pluralised or in-compound abbreviated spelling still lands — "single-arm
 * half-kneeling OHP", "Hamstring Curls"), then a bounded superset match.
 */
function curatedKeyForSpelling(name: string): string | null {
  if (CURATED_NAME_SET.has(name)) return name;
  const ci = curatedKeyByLower.get(name.toLowerCase());
  if (ci) return ci;
  const tokens = signatureTokens(name);
  return curatedKeyBySignature.get(tokens.join(' '))
    ?? resolveBySheddingQualifiers(tokens);
}

/** The curated cue key an incoming name maps to, or the raw name if none. */
export function canonicalExerciseName(raw: string): string {
  if (!raw) return raw;
  if (CURATED_NAME_SET.has(raw)) return raw;
  const ci = curatedKeyByLower.get(raw.toLowerCase());
  if (ci) return ci;
  // Bridge divergent spellings through the load-alias map FIRST — an alias is a
  // curator's explicit ruling about what a spelling means, so it outranks any
  // inferred match. The alias TARGET is then resolved by the same rules as any
  // other spelling: it used to be adopted only on an exact/case-insensitive hit,
  // so an alias pointing at a cosmetically different spelling of a curated key
  // ("Chest Supported DB Row" vs the curated "Chest-Supported DB Row") silently
  // resolved to nothing and the card rendered blank.
  const resolved = resolveExerciseName(raw);
  if (resolved !== raw) {
    const viaAlias = curatedKeyForSpelling(resolved);
    if (viaAlias) return viaAlias;
  }
  return curatedKeyForSpelling(raw) ?? raw;
}

/**
 * The exercise names the generator may choose from — SELECTABLE POOL
 * MEMBERSHIP, exactly, in stable alphabetical order.
 *
 * The vocabulary switch (Sam's locked-list changeset, 2026-07-24). It used to
 * derive from "has a cue", which answered the wrong question: a cue means the
 * app can DESCRIBE a movement, not that any builder can PRESCRIBE it. The
 * generator was therefore offered 42 census-confirmed orphans — names no pool
 * reaches — while the completeness invariant had no way to notice, because
 * "has a cue" was both the offer and the check.
 *
 * Now membership of a pool a live builder selects from is the single
 * definition, and the invariant runs in both directions (pool entry with no
 * cue+video, cue with no pool entry) with typed-kind exemptions only. See
 * src/data/selectableExerciseVocabulary.ts.
 */
export function curatedExerciseVocabulary(): string[] {
  return selectableExerciseNames();
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
