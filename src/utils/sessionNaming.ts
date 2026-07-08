/**
 * Session Naming — Single Source of Truth for Athlete-Facing Session Names
 *
 * This module is the ONE place session display names are computed.
 * No UI component or builder should assemble session names ad hoc.
 *
 * Canonical labels (strict — no other names allowed for strength days):
 *
 *   LOWER BODY
 *     squat only                   → "Lower Squat"
 *     hinge only                   → "Lower Hinge"
 *     squat + hinge                → "Lower Body Strength"
 *
 *   UPPER BODY
 *     push only                    → "Upper Push"
 *     pull only                    → "Upper Pull"
 *     push + pull                  → "Upper Body Strength"
 *
 *   FULL BODY
 *     upper + lower patterns       → "Full Body Strength"
 *
 *   TEAM DAYS (priority)
 *     team only                    → "Team Training"
 *     team + strength label        → "Team Training + <canonical strength>"
 *
 * Conditioning / recovery / optional sessions keep their domain-specific
 * template names (e.g. "Long Nasal Run", "Tabata Intervals",
 * "Mobility, foam rolling, light movement"). Team-day priority still applies.
 *
 * FORBIDDEN outputs (internal terminology must never reach the athlete):
 *   "Lower Strength", "Upper Strength", "Upper Pull + Upper Push",
 *   "Lower Squat + Lower Hinge", "Lower Combined", "Upper Combined",
 *   any "X + Team Training" ordering, any "L-co" / "U-co" code.
 */

export type MovementPattern = 'squat' | 'hinge' | 'push' | 'pull';

export type StrengthPatternMetadata =
  | 'lower'
  | 'lower_combined'
  | 'push'
  | 'pull'
  | 'upper_combined'
  | 'full_body';

/** Tier type mirrors the domain's SessionTier. Kept permissive for callers. */
export type SessionTierLoose = 'core' | 'optional' | 'recovery' | string;

export interface SessionNameInput {
  /** Engine-authoritative structural label — primary source for pattern inference. */
  focus?: string;
  /** AI-generated / existing workout name — fallback source for conditioning/recovery pass-through. */
  name?: string;
  /** Optional explicit patterns. When present, overrides text inference. */
  movementPatterns?: MovementPattern[];
  /** Typed engine strength pattern. Used before any legacy text inference. */
  strengthPattern?: StrengthPatternMetadata;
  /** Team-day flag — when true, name ALWAYS leads with "Team Training". */
  isTeamDay?: boolean;
  /** Presence of a conditioning flavour marks this as a conditioning-bearing session. */
  conditioningFlavour?: string;
  /** True when conditioning is appended to a strength session (combined S+C). */
  hasCombinedConditioning?: boolean;
  /** Session tier for recovery short-circuiting. */
  tier?: SessionTierLoose;
}

/** Regex hits for each pattern, applied to lowercased source text. */
const PATTERN_PROBES: Array<[MovementPattern, RegExp]> = [
  ['squat', /\bsquat\b|quad[- ]?dominant|\blunge\b|leg press|front squat|back squat|goblet/],
  ['hinge', /\bhinge\b|hip[- ]?dominant|\brdl\b|deadlift|hip thrust|hamstring|good morning|kettlebell swing/],
  // NOTE: "\bpress\b" alone would false-match "leg press" (squat accessory),
  // so push requires a more specific token: push/bench/OHP/overhead press/dips/push-up.
  ['push',  /\bpush\b|\bbench\b|\bohp\b|overhead press|\bdips?\b|push[- ]?up/],
  ['pull',  /\bpull\b|\brow\b|chin[- ]?up|pull[- ]?up|face pull|lat pulldown|pulldown/],
];

/**
 * Shared conditioning-text detector. Guards strength inference from erg /
 * finisher wording such as "bike/row/ski", where "row" is not a strength pull.
 */
const CONDITIONING_TEXT_RX =
  /flush|aerobic|conditioning|finisher|intervals?|metcon|tempo|fartlek|\brun\b|\bbike\b|\brow(?:er)?\b|rowing|\bski\b|\berg\b|\bsprints?\b|\bmas\b|zone\s*2|\bkm\b|off[- ]?feet/i;

/**
 * Explicit strength wording. Used to distinguish combined strength + finisher
 * text from pure conditioning names that happen to mention row/bike/ski.
 */
const EXPLICIT_STRENGTH_TEXT_RX =
  /strength|upper body|lower body|full body|squat|hinge|hip[- ]?dominant|quad[- ]?dominant|bench|\bpress\b|push[- ]?up|pull[- ]?up|chin[- ]?up|deadlift|\brdl\b|lunge|push emphasis|pull emphasis|\blift/i;

export function hasConditioningText(text: string | undefined): boolean {
  return !!text && CONDITIONING_TEXT_RX.test(text);
}

export function hasExplicitStrengthText(text: string | undefined): boolean {
  return !!text && EXPLICIT_STRENGTH_TEXT_RX.test(text);
}

export function isConditioningOnlyText(text: string | undefined): boolean {
  return hasConditioningText(text) && !hasExplicitStrengthText(text);
}

/**
 * Keep movement-pattern inference scoped to the strength component. Engine
 * focus strings often append " + easy off-feet aerobic finisher
 * (bike/row/ski)"; the suffix must never add a fake pull pattern.
 */
export function strengthTextForMovementInference(text: string | undefined): string {
  if (!text) return '';
  const plusSeparator = /\s\+\s/g;
  let match: RegExpExecArray | null;
  while ((match = plusSeparator.exec(text))) {
    const tail = text.slice(match.index + match[0].length);
    if (hasConditioningText(tail)) {
      return text.slice(0, match.index).trim();
    }
  }

  const dashSeparator = /\s[—–-]\s/g;
  while ((match = dashSeparator.exec(text))) {
    const tail = text.slice(match.index + match[0].length);
    if (hasConditioningText(tail) && !hasExplicitStrengthText(tail)) {
      return text.slice(0, match.index).trim();
    }
  }

  return text.trim();
}

/**
 * Extract movement patterns from a focus or name string.
 * Uses deterministic keyword matching against the engine's buildFocus outputs
 * and typical AI-generated names. Returns patterns in canonical order.
 */
export function inferMovementPatterns(text: string | undefined): MovementPattern[] {
  if (!text) return [];
  const t = text.toLowerCase();
  // Short-circuit: explicit "full body" phrasing → all four patterns.
  // The engine's FB focus string also enumerates squat/hinge/push/pull, so
  // either path reaches "Full Body Strength" via canonicalStrengthLabel.
  if (/\bfull[- ]?body\b/.test(t)) {
    return ['squat', 'hinge', 'push', 'pull'];
  }
  const found: MovementPattern[] = [];
  for (const [pattern, rx] of PATTERN_PROBES) {
    if (rx.test(t)) found.push(pattern);
  }
  return found;
}

export function inferStrengthMovementPatterns(text: string | undefined): MovementPattern[] {
  const strengthText = strengthTextForMovementInference(text);
  if (!strengthText || isConditioningOnlyText(strengthText)) return [];
  return inferMovementPatterns(strengthText);
}

function lowerPatternDetailsFromText(text: string | undefined): MovementPattern[] {
  return inferStrengthMovementPatterns(text).filter(
    (pattern): pattern is 'squat' | 'hinge' => pattern === 'squat' || pattern === 'hinge',
  );
}

export function movementPatternsFromStrengthPattern(
  strengthPattern: StrengthPatternMetadata | undefined,
  sourceText?: string,
): MovementPattern[] {
  switch (strengthPattern) {
    case 'lower': {
      const lowerDetails = lowerPatternDetailsFromText(sourceText);
      return lowerDetails.length > 0 ? lowerDetails : ['squat', 'hinge'];
    }
    case 'lower_combined':
      return ['squat', 'hinge'];
    case 'push':
      return ['push'];
    case 'pull':
      return ['pull'];
    case 'upper_combined':
      return ['push', 'pull'];
    case 'full_body':
      return ['squat', 'hinge', 'push', 'pull'];
    default:
      return [];
  }
}

/**
 * Map an unordered set of movement patterns to the canonical athlete-facing
 * strength label. Returns null when no strength patterns are present.
 */
export function canonicalStrengthLabel(
  patterns: MovementPattern[],
): string | null {
  const set = new Set(patterns);
  const hasSquat = set.has('squat');
  const hasHinge = set.has('hinge');
  const hasPush = set.has('push');
  const hasPull = set.has('pull');
  const hasLower = hasSquat || hasHinge;
  const hasUpper = hasPush || hasPull;

  if (hasLower && hasUpper) return 'Full Body Strength';
  if (hasLower) {
    if (hasSquat && hasHinge) return 'Lower Body Strength';
    if (hasSquat) return 'Lower Squat';
    return 'Lower Hinge';
  }
  if (hasUpper) {
    if (hasPush && hasPull) return 'Upper Body Strength';
    if (hasPush) return 'Upper Push';
    return 'Upper Pull';
  }
  return null;
}

/** Canonical team-session name (team day with no strength load). */
export const TEAM_ONLY_NAME = 'Team Training';

/** Clean a raw name/focus string so it's presentable as a fallback. */
function fallbackFromText(text: string | undefined): string {
  if (!text) return '';
  // Strip anything after the first " — " or " + " separator so legacy verbose
  // engine focus strings don't leak full descriptions into the user label.
  const firstSep = text.search(/\s[—–-]\s|\s\+\s/);
  const head = firstSep > 0 ? text.slice(0, firstSep) : text;
  return head.trim();
}

/**
 * Resolve the single authoritative display name for a session.
 *
 * Precedence:
 *   1. Team-day priority prefix (always leads).
 *   2. Explicit movementPatterns (when provided, overrides inference).
 *   3. Typed strengthPattern from the engine/session allocation.
 *   4. Inferred patterns from strength-scoped focus (legacy fallback).
 *   5. Inferred patterns from strength-scoped name (AI-generated fallback).
 *   6. Cleaned name/focus pass-through (for conditioning / recovery / other).
 */
export function resolveSessionDisplayName(input: SessionNameInput): string {
  const isTeam = !!input.isTeamDay;
  const isStandaloneConditioning =
    !!input.conditioningFlavour && !input.hasCombinedConditioning;

  // A standalone conditioning slot may be a row/bike/run prescription even
  // when the planner focus still carries a stale strength label. Do not let
  // "row" infer "Upper Pull" for an erg session.
  if (!isTeam && isStandaloneConditioning) {
    const existingName = (input.name || '').trim();
    if (existingName) return existingName;
  }

  // Step 1: determine strength label (if any).
  let patterns: MovementPattern[] = [];
  if (input.movementPatterns && input.movementPatterns.length > 0) {
    patterns = input.movementPatterns;
  } else if (input.strengthPattern) {
    patterns = movementPatternsFromStrengthPattern(
      input.strengthPattern,
      input.focus || input.name,
    );
  } else {
    patterns = inferStrengthMovementPatterns(input.focus);
    if (patterns.length === 0) {
      patterns = inferStrengthMovementPatterns(input.name);
    }
  }
  const strengthLabel = canonicalStrengthLabel(patterns);

  // Step 2: team-day composition (always leads with "Team Training").
  if (isTeam) {
    if (strengthLabel) return `${TEAM_ONLY_NAME} + ${strengthLabel}`;
    return TEAM_ONLY_NAME;
  }

  // Step 3: strength session (no team) — use canonical label.
  if (strengthLabel) return strengthLabel;

  // Step 4: conditioning / recovery / other — pass through name (or cleaned focus).
  const existingName = (input.name || '').trim();
  if (existingName) return existingName;
  const cleaned = fallbackFromText(input.focus);
  if (cleaned) return cleaned;
  return 'Session';
}

/**
 * Canonical strength labels — the closed set of strings produced by
 * canonicalStrengthLabel. Used by splitSessionName as the presentation-layer
 * "is this side the strength?" probe, so the display can lead with strength
 * regardless of how the canonical name composed the parts.
 */
const STRENGTH_LABELS: ReadonlySet<string> = new Set([
  'Lower Squat',
  'Lower Hinge',
  'Lower Body Strength',
  'Upper Push',
  'Upper Pull',
  'Upper Body Strength',
  'Full Body Strength',
]);

/**
 * UI helper: split a canonical name like "Team Training + Upper Push" into
 * { title, context }. When there's no " + " separator, context is null.
 *
 * Presentation rule (display order):
 *   When one half is a canonical strength label, the strength ALWAYS leads
 *   as `title` and the other half becomes `context` prefixed with "+ ".
 *   This is purely a display-order swap — the canonical name itself
 *   (produced by resolveSessionDisplayName) is unchanged, so logs, AI
 *   payloads, and persisted state stay stable.
 *
 *     "Team Training + Upper Push"    → { title: "Upper Push",        context: "+ Team Training" }
 *     "Team Training + Lower Squat"   → { title: "Lower Squat",       context: "+ Team Training" }
 *     "Team Training"                 → { title: "Team Training",     context: null }
 *     "Upper Push"                    → { title: "Upper Push",        context: null }
 *     "Long Nasal Run"                → { title: "Long Nasal Run",    context: null }
 *
 * Callers should use resolveSessionDisplayName FIRST to produce the canonical
 * name, then this to render a two-tier card layout.
 */
export function splitSessionName(
  name: string,
): { title: string; context: string | null } {
  if (!name) return { title: '', context: null };
  const idx = name.indexOf(' + ');
  if (idx < 0) return { title: name.trim(), context: null };
  const left = name.slice(0, idx).trim();
  const right = name.slice(idx + 3).trim();
  // Strength-leads rule: if exactly one half is a canonical strength label,
  // lead with strength and demote the other half to a "+ context" subtitle.
  const leftIsStrength = STRENGTH_LABELS.has(left);
  const rightIsStrength = STRENGTH_LABELS.has(right);
  if (rightIsStrength && !leftIsStrength) {
    return { title: right, context: `+ ${left}` };
  }
  if (leftIsStrength && !rightIsStrength) {
    return { title: left, context: `+ ${right}` };
  }
  // Neither (or both — defensive): preserve the canonical order.
  return { title: left, context: right };
}
