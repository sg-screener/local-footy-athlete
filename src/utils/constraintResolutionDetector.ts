/**
 * constraintResolutionDetector.ts — pure classifier that decides
 * whether the athlete's message is announcing that an active
 * constraint has resolved.
 *
 * The dispatcher runs this BEFORE the LLM intent classifier so a
 * message like "no fatigue anymore" never gets re-classified as a new
 * fatigue report. The detector is deterministic on phrase patterns so
 * the live failure ("Fatigue card sticks after the athlete says it's
 * gone") is fixed in one place without touching the LLM.
 *
 * Decision order (highest signal first):
 *
 *   1. Explicit ALL-CLEAR phrases ("all good now", "everything is
 *      fine", "clear all issues") → resolve every active constraint,
 *      kind='all'.
 *
 *   2. Fatigue-specific resolved phrases ("no fatigue anymore", "not
 *      cooked anymore", "energy is back", "feeling fresh", "feel
 *      normal again") → resolve every active fatigue constraint,
 *      kind='fatigue'.
 *
 *   3. Body-part-specific resolved phrases ("hammy is fine", "shoulder
 *      is good now", "pain is gone in my knee", "hammy cleared up") →
 *      resolve every injury / soreness constraint matching that body
 *      part (with aliases), kind='injury' | 'soreness'.
 *
 *   4. Generic "I'm fine" phrases ("I'm fine now", "I'm good now",
 *      "back to normal") with NO body part:
 *        • zero active constraints  → matched=false (kind='generic',
 *          reason='no_active_match')
 *        • exactly one active constraint → resolve it (kind='generic')
 *        • ≥2 active constraints → ambiguous, dispatcher must ask
 *          which one to clear.
 *
 * Returning matched=false leaves the message for the existing intent
 * classifier; matched=true short-circuits the pipeline.
 */

import type { ActiveConstraint } from '../store/coachUpdatesStore';

// ─── Result shape ───────────────────────────────────────────────────

export type ResolutionKind =
  | 'all'
  | 'fatigue'
  | 'injury'
  | 'soreness'
  | 'generic';

export interface DetectConstraintResolutionResult {
  /**
   * The detector positively classified the message as a resolution
   * announcement. When matched=true the dispatcher MUST short-circuit
   * — either by clearing constraints or asking the ambiguity question.
   */
  matched: boolean;
  /**
   * IDs of active constraints to resolve. Empty when matched=false or
   * when ambiguous (the dispatcher waits for the athlete's reply).
   */
  constraintIdsToResolve: string[];
  /** Free-text reason for logs. */
  reason: string;
  /**
   * The athlete used a resolution phrase but the dispatcher still
   * needs to disambiguate (multiple active constraints + generic
   * phrase). When true, dispatcher asks
   * "Good — which one should I clear: fatigue, hammy, shoulder, or
   * all of them?" and constraintIdsToResolve is empty.
   */
  ambiguous: boolean;
  /** Categorical kind for logging / replies. */
  kind?: ResolutionKind;
  /** Body part the athlete named (lowercased). Present on injury/soreness branches. */
  bodyPart?: string;
  /**
   * Constraints the dispatcher should mention in the ambiguity
   * question. Only populated when ambiguous=true.
   */
  candidates?: ActiveConstraint[];
}

// ─── Phrase tables ──────────────────────────────────────────────────

const ALL_CLEAR_PATTERNS = [
  /\ball\s+good\s+now\b/i,
  /\beverything\s+is\s+fine\b/i,
  /\beverything\s+is\s+good\b/i,
  /\beverything('?s|\s+is)\s+sorted\b/i,
  /\bclear\s+all\s+(?:issues|injuries|constraints|flags|the\s+issues)\b/i,
  /\bremove\s+all\s+(?:issues|injuries|constraints|flags)\b/i,
  /\bnothing'?s?\s+wrong\b/i,
  /\bno\s+issues\s+(?:at\s+all|left|anymore)\b/i,
];

const FATIGUE_RESOLVED_PATTERNS = [
  /\bno\s+(?:more\s+)?fatigue(?:\s+(?:anymore|left))?\b/i,
  /\bhave\s+no\s+fatigue\b/i,
  /\bnot\s+(?:cooked|tired|fatigued|exhausted|wrecked|knackered|smashed)\s+anymore\b/i,
  /\bno\s+longer\s+(?:cooked|tired|fatigued|exhausted)\b/i,
  /\benergy\s+is\s+back\b/i,
  /\benergy\s+levels?\s+are\s+back\b/i,
  /\bfeeling\s+fresh\b/i,
  /\bfeel\s+normal\s+again\b/i,
  /\bfresh\s+again\b/i,
  /\bnot\s+feeling\s+cooked\s+anymore\b/i,
  /\bfatigue\s+is\s+gone\b/i,
];

const GENERIC_FINE_PATTERNS = [
  /\bi'?m\s+fine\s+now\b/i,
  /\bi'?m\s+good\s+now\b/i,
  /\bi'?m\s+all\s+good\b/i,
  /\bi\s+am\s+(?:fine|good)\s+now\b/i,
  /\bback\s+to\s+normal\b/i,
  /\bfeeling\s+(?:fine|good|normal)\s+now\b/i,
  /\bfeel\s+(?:fine|good|normal)\s+now\b/i,
];

/**
 * Body-part-specific "is good / is gone" patterns. These allow the
 * detector to spot resolution even when the athlete doesn't use one of
 * the strict GENERIC_FINE phrases — e.g. "hammy cleared up", "knee
 * feels good again". The patterns deliberately require a verb so plain
 * mentions like "my hammy" don't trip them.
 */
const BODY_PART_VERB_PATTERNS = [
  // pain / soreness verbs
  /\bpain\s+(?:is\s+)?gone\b/i,
  /\bno\s+more\s+(?:\S+\s+)?pain\b/i,
  /\bnot\s+sore\s+anymore\b/i,
  /\bno\s+(?:longer\s+)?sore\b/i,
  /\bcleared\s+up\b/i,
  /\bhealed\s+up\b/i,
  /\b(?:is|feels?)\s+(?:fine|good|better|great|normal)\s+(?:now|again)\b/i,
  /\b(?:is|feels?)\s+(?:all\s+)?(?:cleared|healed|sorted|sweet)\b/i,
  /\bback\s+to\s+(?:full\s+)?(?:strength|normal)\b/i,
];

// ─── Body part vocabulary + aliases ─────────────────────────────────

interface BodyPartEntry {
  canonical: string;
  aliases: string[];
}

const BODY_PART_TABLE: BodyPartEntry[] = [
  { canonical: 'hamstring', aliases: ['hamstring', 'hamstrings', 'hammy', 'hammies', 'hams'] },
  { canonical: 'shoulder', aliases: ['shoulder', 'shoulders'] },
  { canonical: 'knee', aliases: ['knee', 'knees'] },
  { canonical: 'ankle', aliases: ['ankle', 'ankles'] },
  { canonical: 'calf', aliases: ['calf', 'calves'] },
  { canonical: 'quad', aliases: ['quad', 'quads', 'quadricep', 'quadriceps'] },
  { canonical: 'groin', aliases: ['groin', 'adductor', 'adductors'] },
  { canonical: 'lower back', aliases: ['lower back', 'low back'] },
  { canonical: 'upper back', aliases: ['upper back'] },
  { canonical: 'back', aliases: ['back'] },
  { canonical: 'hip', aliases: ['hip', 'hips', 'hip flexor', 'hip flexors'] },
  { canonical: 'glute', aliases: ['glute', 'glutes', 'butt'] },
  { canonical: 'achilles', aliases: ['achilles'] },
  { canonical: 'foot', aliases: ['foot', 'feet'] },
  { canonical: 'neck', aliases: ['neck'] },
  { canonical: 'wrist', aliases: ['wrist', 'wrists'] },
  { canonical: 'elbow', aliases: ['elbow', 'elbows'] },
  { canonical: 'pec', aliases: ['pec', 'pecs', 'chest'] },
  { canonical: 'bicep', aliases: ['bicep', 'biceps'] },
  { canonical: 'tricep', aliases: ['tricep', 'triceps'] },
];

function findBodyPartMentions(message: string): Array<{ canonical: string; matched: string }> {
  const lower = message.toLowerCase();
  const hits: Array<{ canonical: string; matched: string }> = [];
  // Sort entries by aliases longest-first so multi-word ("lower back")
  // wins over single-word ("back"). Build a flat sorted alias list so
  // the longest-first guarantee holds across entries.
  const aliasIndex: Array<{ alias: string; canonical: string }> = [];
  for (const e of BODY_PART_TABLE) {
    for (const a of e.aliases) aliasIndex.push({ alias: a, canonical: e.canonical });
  }
  aliasIndex.sort((a, b) => b.alias.length - a.alias.length);

  let working = lower;
  for (const { alias, canonical } of aliasIndex) {
    const re = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'g');
    if (re.test(working)) {
      hits.push({ canonical, matched: alias });
      // Consume the matched alias so a longer phrase (e.g. "lower back")
      // doesn't also get re-counted as the shorter "back" later in the
      // pass. Replace with placeholder of equal length to keep indexes.
      working = working.replace(re, '_'.repeat(alias.length));
    }
  }
  // Deduplicate by canonical, preserving first encounter.
  const seen = new Set<string>();
  return hits.filter((h) => {
    if (seen.has(h.canonical)) return false;
    seen.add(h.canonical);
    return true;
  });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Map an active constraint's stored bodyPart string to a canonical
 * key that can be cross-referenced against the body parts the message
 * mentions. Returns null for fatigue / schedule / missed_session
 * constraints (no body part).
 */
function constraintBodyPartCanonical(c: ActiveConstraint): string | null {
  if (c.type === 'injury' || c.type === 'soreness') {
    const lower = (c.bodyPart || '').toLowerCase();
    if (!lower) return null;
    // Match against the alias table. Longest-first so "lower back" wins.
    const aliasIndex: Array<{ alias: string; canonical: string }> = [];
    for (const e of BODY_PART_TABLE) {
      for (const a of e.aliases) aliasIndex.push({ alias: a, canonical: e.canonical });
    }
    aliasIndex.sort((a, b) => b.alias.length - a.alias.length);
    for (const { alias, canonical } of aliasIndex) {
      if (new RegExp(`\\b${escapeRegex(alias)}\\b`).test(lower)) return canonical;
    }
    return lower; // last resort — exact match required
  }
  return null;
}

// ─── Detector ───────────────────────────────────────────────────────

export function detectConstraintResolution(
  message: string,
  activeConstraints: ActiveConstraint[],
): DetectConstraintResolutionResult {
  const normalised = (message || '').trim();
  if (!normalised) {
    return {
      matched: false,
      constraintIdsToResolve: [],
      reason: 'empty_message',
      ambiguous: false,
    };
  }

  const active = (activeConstraints ?? []).filter((c) => c.status !== 'resolved');

  // ── 1. Explicit all-clear ──────────────────────────────────────────
  const allClearHit = ALL_CLEAR_PATTERNS.some((re) => re.test(normalised));
  if (allClearHit) {
    if (active.length === 0) {
      return {
        matched: true,
        constraintIdsToResolve: [],
        reason: 'all_clear_no_active',
        ambiguous: false,
        kind: 'all',
      };
    }
    if (active.length > 1) {
      return {
        matched: true,
        constraintIdsToResolve: [],
        reason: 'all_clear_multiple_active_facts',
        ambiguous: true,
        kind: 'all',
        candidates: active,
      };
    }
    return {
      matched: true,
      constraintIdsToResolve: [active[0].id],
      reason: 'all_clear_single_active_fact',
      ambiguous: false,
      kind: active[0].type === 'injury' ? 'injury' : 'all',
    };
  }

  // ── 2. Fatigue-specific phrases ────────────────────────────────────
  const fatigueHit = FATIGUE_RESOLVED_PATTERNS.some((re) => re.test(normalised));
  if (fatigueHit) {
    const fatigueIds = active
      .filter((c) => c.type === 'fatigue')
      .map((c) => c.id);
    if (fatigueIds.length === 0) {
      return {
        matched: true,
        constraintIdsToResolve: [],
        reason: 'fatigue_phrase_no_active_fatigue',
        ambiguous: false,
        kind: 'fatigue',
      };
    }
    return {
      matched: true,
      constraintIdsToResolve: fatigueIds,
      reason: 'fatigue_resolved',
      ambiguous: false,
      kind: 'fatigue',
    };
  }

  // ── 3. Body-part-specific phrases ──────────────────────────────────
  const bodyPartMentions = findBodyPartMentions(normalised);
  const bodyPartVerbHit = BODY_PART_VERB_PATTERNS.some((re) => re.test(normalised));
  if (bodyPartMentions.length > 0 && bodyPartVerbHit) {
    const namedSet = new Set(bodyPartMentions.map((m) => m.canonical));
    const matchedConstraints = active.filter((c) => {
      if (c.type !== 'injury' && c.type !== 'soreness') return false;
      const canonical = constraintBodyPartCanonical(c);
      return canonical != null && namedSet.has(canonical);
    });

    if (matchedConstraints.length === 0) {
      // The athlete mentioned a body part + a "fine" verb but no
      // active constraint covers that body part. We still consider
      // this a resolution attempt so the dispatcher can reply
      // honestly ("I didn't have an active flag for ___").
      return {
        matched: true,
        constraintIdsToResolve: [],
        reason: 'body_part_phrase_no_match',
        ambiguous: false,
        kind: 'injury',
        bodyPart: bodyPartMentions[0].canonical,
      };
    }

    // Determine kind from the first matched constraint (when both
    // soreness and injury for the same body part exist, we resolve
    // both — kind defaults to 'injury' if any is an injury).
    const anyInjury = matchedConstraints.some((c) => c.type === 'injury');
    const kind: ResolutionKind = anyInjury ? 'injury' : 'soreness';
    return {
      matched: true,
      constraintIdsToResolve: matchedConstraints.map((c) => c.id),
      reason: 'body_part_resolved',
      ambiguous: false,
      kind,
      bodyPart: bodyPartMentions[0].canonical,
    };
  }

  // ── 4. Generic "I'm fine now" / "back to normal" ───────────────────
  const genericHit = GENERIC_FINE_PATTERNS.some((re) => re.test(normalised));
  if (genericHit) {
    if (active.length === 0) {
      return {
        matched: true,
        constraintIdsToResolve: [],
        reason: 'generic_no_active',
        ambiguous: false,
        kind: 'generic',
      };
    }
    if (active.length === 1) {
      return {
        matched: true,
        constraintIdsToResolve: [active[0].id],
        reason: 'generic_single_active',
        ambiguous: false,
        kind: 'generic',
      };
    }
    // ≥2 active constraints + generic phrase → ambiguous.
    return {
      matched: true,
      constraintIdsToResolve: [],
      reason: 'generic_ambiguous',
      ambiguous: true,
      kind: 'generic',
      candidates: active,
    };
  }

  return {
    matched: false,
    constraintIdsToResolve: [],
    reason: 'no_resolution_phrase',
    ambiguous: false,
  };
}

// ─── Reply helpers ──────────────────────────────────────────────────

/**
 * Format the dispatcher's ambiguity question. Lists the active
 * constraints by short label so the athlete can answer with one of
 * the options.
 */
export function formatResolutionAmbiguityQuestion(
  candidates: ActiveConstraint[],
): string {
  const labels = candidates.map(constraintShortLabel);
  if (labels.length === 0) return 'Good - which one should I clear?';
  if (labels.length === 1) {
    return `Good - should I clear ${labels[0]}?`;
  }
  const head = labels.slice(0, -1).join(', ');
  const tail = labels[labels.length - 1];
  const exactOnly = candidates.some((constraint) => constraint.type === 'injury');
  return exactOnly
    ? `Good - which exact one has resolved: ${head} or ${tail}?`
    : `Good - which one should I clear: ${head}, ${tail}, or all of them?`;
}

/**
 * Format the success reply when constraints have been cleared. Names
 * the cleared item(s) so the athlete sees a concrete acknowledgement.
 */
export function formatResolutionSuccessReply(
  cleared: ActiveConstraint[],
  kind: ResolutionKind,
): string {
  if (kind === 'all' || cleared.length > 1) {
    const labels = cleared.map(constraintShortLabel);
    if (labels.length === 0) return `Good - clearing any active flags.`;
    if (labels.length === 1) return `Good - I've cleared the ${labels[0]} flag and your week is back to normal.`;
    const head = labels.slice(0, -1).join(', ');
    const tail = labels[labels.length - 1];
    return `Good - I've cleared the ${head} and ${tail} flags and your week is back to normal.`;
  }
  if (cleared.length === 1) {
    const label = constraintShortLabel(cleared[0]);
    return `Good - I've cleared the ${label} flag and your week is back to normal.`;
  }
  return `Good - your week is back to normal.`;
}

/**
 * Format the "no active flag" reply when the athlete announces a
 * resolution but there's nothing on file to clear.
 */
export function formatResolutionInactiveReply(
  kind: ResolutionKind,
  bodyPart?: string,
): string {
  if (kind === 'fatigue') {
    return `Good to hear. I didn't have an active fatigue flag on your week - nothing to clear.`;
  }
  if (kind === 'injury' || kind === 'soreness') {
    const label = bodyPart ? `${bodyPart} ` : '';
    return `Good to hear. I didn't have an active ${label}flag on your week - nothing to clear.`;
  }
  return `Good to hear. There weren't any active flags on your week - nothing to clear.`;
}

function constraintShortLabel(c: ActiveConstraint): string {
  switch (c.type) {
    case 'fatigue':
      return 'fatigue';
    case 'injury':
      return c.bodyPart || 'injury';
    case 'soreness':
      return c.bodyPart || 'soreness';
    case 'schedule':
      return 'busy week';
    case 'missed_session':
      return 'missed session';
    default:
      return 'flag';
  }
}
