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

import {
  normalizeStrengthIntent,
  resolveLegacyStrengthIntent,
  type StrengthIntent,
} from '../rules/strengthPatternContributions';

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
  /**
   * Final visible exercise rows. When the typed intent is a generic lower or
   * upper session, meaningful main-pattern evidence can make the display name
   * more specific (or broader) without changing workout classification.
   */
  exercises?: ReadonlyArray<{
    name?: string;
    exercise?: { name?: string | null } | null;
  } | null>;
  /** Typed engine strength pattern. Used before any legacy text inference. */
  strengthPattern?: StrengthPatternMetadata;
  /** Canonical typed contract. When present, no display text may override it. */
  strengthIntent?: StrengthIntent;
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
 * Main-pattern probes for content-aware display identity. These deliberately
 * exclude support-only work such as Face Pulls, Nordics and lunges: one small
 * support exercise must not turn a genuine Upper Push or Lower Hinge session
 * into a mixed-region title. Direct anchors such as Box Squat + Hip Thrust or
 * Bench Press + Cable Row are meaningful evidence of both patterns.
 */
const MEANINGFUL_EXERCISE_PATTERN_PROBES: Array<[MovementPattern, RegExp]> = [
  ['squat', /\b(?:back|front|box|goblet|hack|belt|zercher|safety(?: bar)?)?\s*squats?\b|\bleg press\b/i],
  ['hinge', /\b(?:trap bar\s+)?deadlifts?\b|\bromanian deadlifts?\b|\brdls?\b|\bhip thrusts?\b|\bgood mornings?\b|\bkettlebell swings?\b/i],
  ['push', /\bbench press\b|\boverhead press\b|\bshoulder press\b|\blandmine press\b|\bohp\b|\bdips?\b|\bpush[- ]?ups?\b/i],
  ['pull', /\b(?:cable|dumbbell|barbell|machine|seated|chest[- ]?supported|inverted|pendlay|t[- ]?bar|bent[- ]?over|single[- ]?arm)\s+rows?\b|\brows\b|\bpull[- ]?ups?\b|\bchin[- ]?ups?\b|\b(?:lat |neutral[- ]?grip |single[- ]?arm )?pulldowns?\b/i],
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
    const nextPlus = tail.search(/\s\+\s/);
    const immediatePart = nextPlus >= 0 ? tail.slice(0, nextPlus) : tail;
    if (hasConditioningText(immediatePart) && !hasExplicitStrengthText(immediatePart)) {
      return text.slice(0, match.index).trim();
    }
  }

  const dashSeparator = /\s[—–-]\s/g;
  while ((match = dashSeparator.exec(text))) {
    const tail = text.slice(match.index + match[0].length);
    const nextDash = tail.search(/\s[—–-]\s/);
    const immediatePart = nextDash >= 0 ? tail.slice(0, nextDash) : tail;
    if (hasConditioningText(immediatePart) && !hasExplicitStrengthText(immediatePart)) {
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

export function inferMeaningfulExerciseMovementPatterns(
  exercises: SessionNameInput['exercises'],
): MovementPattern[] {
  const found = new Set<MovementPattern>();
  for (const row of exercises ?? []) {
    const name = String(row?.exercise?.name ?? row?.name ?? '').trim();
    if (!name) continue;
    for (const [pattern, probe] of MEANINGFUL_EXERCISE_PATTERN_PROBES) {
      if (probe.test(name)) found.add(pattern);
    }
  }
  return (['squat', 'hinge', 'push', 'pull'] as MovementPattern[])
    .filter((pattern) => found.has(pattern));
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
      return lowerDetails;
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
      // Full-body is layout metadata, not an exact contribution ledger.
      // New callers provide strengthIntent; ambiguous legacy callers must use
      // visible main content or retain their existing display name.
      return [];
    default:
      return [];
  }
}

function movementPatternsFromVisibleContent(input: SessionNameInput): MovementPattern[] {
  if (!input.exercises?.length) return [];
  const sourceText = strengthTextForMovementInference(input.focus || input.name);
  const isStrengthIntent = !!input.strengthPattern || hasExplicitStrengthText(sourceText);
  if (!isStrengthIntent) return [];

  // Combined/full-body metadata is already explicit and must remain stable.
  if (
    input.strengthPattern === 'lower_combined' ||
    input.strengthPattern === 'upper_combined' ||
    input.strengthPattern === 'full_body'
  ) {
    return [];
  }
  return inferMeaningfulExerciseMovementPatterns(input.exercises);
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
 *   3. Meaningful patterns from final visible exercises for generic strength.
 *   4. Typed strengthPattern from the engine/session allocation.
 *   5. Inferred patterns from strength-scoped focus (legacy fallback).
 *   6. Inferred patterns from strength-scoped name (AI-generated fallback).
 *   7. Cleaned name/focus pass-through (for conditioning / recovery / other).
 */
export function resolveSessionDisplayName(input: SessionNameInput): string {
  const isTeam = !!input.isTeamDay;
  const existingName = (input.name || '').trim();
  const auxiliaryText = `${input.name ?? ''} ${input.focus ?? ''}`;
  const isStandaloneConditioning =
    !!input.conditioningFlavour && !input.hasCombinedConditioning;

  // Recovery and accessory identities are already honest domain labels. They
  // must never be promoted to main strength from words in mobility/prehab rows.
  if (!isTeam && input.tier === 'recovery') {
    return existingName || fallbackFromText(input.focus) || 'Recovery';
  }
  if (
    !isTeam &&
    !input.strengthIntent &&
    !input.strengthPattern &&
    /\b(gunshow|prehab|accessor|pump|mobility|recovery)\b/i.test(auxiliaryText)
  ) {
    return existingName || fallbackFromText(input.focus) || 'Session';
  }

  // A standalone conditioning slot may be a row/bike/run prescription even
  // when the planner focus still carries a stale strength label. Do not let
  // "row" infer "Upper Pull" for an erg session.
  if (!isTeam && isStandaloneConditioning) {
    if (existingName) return existingName;
  }

  // Step 1: determine strength label (if any).
  let patterns: MovementPattern[] = [];
  const typedIntent = input.strengthIntent
    ? normalizeStrengthIntent(input.strengthIntent)
    : null;
  if (typedIntent) {
    patterns = [...typedIntent.effectivePatterns];
  } else {
    const visibleContentPatterns = movementPatternsFromVisibleContent(input);
    const legacyFocus = strengthTextForMovementInference(input.focus);
    const legacyName = strengthTextForMovementInference(input.name);
    const legacy = resolveLegacyStrengthIntent({
      strengthPattern: input.strengthPattern,
      contentPatterns: input.movementPatterns?.length
        ? input.movementPatterns
        : visibleContentPatterns,
      focus: isConditioningOnlyText(legacyFocus) ? undefined : legacyFocus,
      name: isConditioningOnlyText(legacyName) ? undefined : legacyName,
    });
    patterns = legacy.intent?.effectivePatterns ?? [];
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
