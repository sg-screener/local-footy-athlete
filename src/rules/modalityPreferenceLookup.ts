/** Pure lookup over accepted preference input. The persistence adapter owns the live read. */
import type { ConditioningModality } from '../data/exerciseTags';
import type { BikeLabel } from '../utils/coachModalitySwap';

export interface ModalityPreference {
  /** Optional source modality. When set, only conditioning whose
   *  modality matches `from` is rewritten; conditioning on other
   *  modalities is left alone. When null, every conditioning slot in
   *  the matching session is rewritten to `to`. */
  from: ConditioningModality | null;
  /** Destination modality every matching slot should land on. */
  to: ConditioningModality;
  /**
   * Optional bike subtype label the projection should render. Only
   * meaningful when `to === 'bike'` (or when `from === to === 'bike'`
   * for label-only corrections). Null/undefined keeps the engine
   * default ("Assault Bike").
   */
  bikeLabel?: BikeLabel | null;
  /** Wall-clock millis at write time — tests + UI can show "set on …". */
  createdAt: number;
}

/** Lower-case + collapse whitespace + strip everything but a–z 0–9 + spaces. */
export function canonicalSessionKey(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Modality / dosage tokens that may decorate a session display name. We
 * strip TRAILING occurrences of these so
 *   "Easy Aerobic Flush (20min Rower)"
 * canonicalises down to "easy aerobic flush" before the alias-group walk.
 *
 * Token list intentionally small: every word here is a valid trailing
 * dosage suffix on a session display name. Adding generic words like
 * "training" or "session" would risk false positives.
 */
const TRAILING_MODALITY_TOKENS: ReadonlySet<string> = new Set([
  'row', 'rower', 'rowing',
  'bike', 'biking', 'cycling',
  'ski', 'skierg', 'skiing',
  'run', 'running', 'jog', 'jogging',
  'swim', 'swimming',
  'erg', 'cardio', 'finisher',
]);

/** Match a duration / distance token like "20min", "25min", "5km", "30s", "10mi". */
function isDurationToken(token: string): boolean {
  return /^\d+(min|mins|minute|minutes|sec|secs|s|km|m|mi|mile|miles)?$/i.test(token);
}

/** Strip everything in (...) from a display name. Whitespace is normalised. */
function stripParentheticals(name: string): string {
  return name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip trailing dosage / modality tokens from a canonical key.
 * Keeps at least 2 tokens to avoid collapsing legit short names like
 * "easy row" → "easy" (which would lose its alias-group identity).
 */
function stripTrailingDosageTokens(canonical: string): string {
  if (!canonical) return canonical;
  const words = canonical.split(' ');
  while (words.length > 2) {
    const last = words[words.length - 1];
    if (TRAILING_MODALITY_TOKENS.has(last) || isDurationToken(last)) {
      words.pop();
    } else {
      break;
    }
  }
  return words.join(' ');
}

/**
 * Return every canonical-key form to try when looking up a session name.
 * Order: most-specific → least-specific. Dedup-preserving.
 *
 *   "Easy Aerobic Flush (20min Rower)"
 *     1. raw           → "easy aerobic flush 20min rower"
 *     2. paren-stripped→ "easy aerobic flush"
 *     3. dosage-stripped from raw → "easy aerobic flush"
 *     4. dosage-stripped from paren-stripped → "easy aerobic flush"
 *
 * "Lower Body Strength + Aerobic Base finisher" → does NOT collapse to
 * "aerobic base" (only TRAILING dosage tokens are stripped, internal
 * "aerobic base" survives), so the standalone Easy Aerobic Flush
 * preference cannot leak into a strength session that happens to mention
 * an aerobic base finisher.
 */
export function canonicalSessionKeyCandidates(name: string): string[] {
  if (!name) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (k: string) => {
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  };

  const raw = canonicalSessionKey(name);
  add(raw);

  const parenStripped = canonicalSessionKey(stripParentheticals(name));
  add(parenStripped);

  add(stripTrailingDosageTokens(raw));
  add(stripTrailingDosageTokens(parenStripped));

  return out;
}

/**
 * Aliases that should resolve to the same preference. The orchestrator
 * stores under the resolved `targetSessionName` (typically `workout.name`,
 * e.g. "Easy Aerobic Flush"); the visible projection sometimes only sees
 * a normalized title like "Easy Row" or "Aerobic Base". Walking this
 * alias list lets a single preference apply across the family.
 *
 * We deliberately keep the alias map small and conservative — bigger
 * groups risk leaking preferences across unrelated sessions.
 */
const SESSION_NAME_ALIAS_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [
  // Easy aerobic flush family — block titles from sessionBuilder + canonical names
  [
    'easy aerobic flush',
    'aerobic flush',
    'aerobic base',
    'easy row',
    'easy bike',
    'easy ski',
    'zone 2 row',
    'zone 2 bike',
    'zone 2 conditioning',
  ],
  // Long base run / Z2 run family
  [
    'long nasal run',
    'long run',
    'aerobic run',
  ],
  // Hard interval erg family
  [
    'hard row intervals',
    'hard assault bike intervals',
    'hard skierg intervals',
    'row intervals',
    'assault bike intervals',
    'skierg intervals',
  ],
];

/**
 * Return every canonical key that should be checked against the
 * preference store for a given session name. Walks each canonical
 * candidate (raw, paren-stripped, dosage-stripped) and unions in every
 * alias-group sibling.
 *
 * The first entry is always the most-specific raw canonical form.
 */
export function aliasKeysForSessionName(sessionName: string): string[] {
  const candidates = canonicalSessionKeyCandidates(sessionName);
  if (candidates.length === 0) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  const add = (k: string) => {
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  };

  for (const cand of candidates) add(cand);

  // Layer in alias-group siblings for any candidate that lives in a group.
  for (const cand of candidates) {
    for (const group of SESSION_NAME_ALIAS_GROUPS) {
      if (group.includes(cand)) {
        for (const alias of group) add(alias);
      }
    }
  }
  return out;
}


export function lookupModalityPreference(sessionName: string, prefs: Readonly<Record<string, ModalityPreference>>): ModalityPreference | null {
  for (const key of aliasKeysForSessionName(sessionName)) {
    if (prefs[key]) return prefs[key];
  }
  return null;
}
