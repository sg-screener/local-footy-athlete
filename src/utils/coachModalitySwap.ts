/**
 * coachModalitySwap.ts — deterministic conditioning-modality swap.
 *
 * PHASE 3 of the coach pipeline. The user types something like
 *
 *   "Can you change it to a bike instead of a row?"
 *
 * The Phase 2 reference resolver pinpoints the day. This module
 * handles the *modality* part:
 *
 *   1. Parse the message to extract `from` and `to` modality tokens.
 *   2. Build a tier-preserving exercise map (e.g. Hard Row Intervals
 *      → Hard Assault Bike Intervals; Easy Row → Easy Bike).
 *   3. Emit a swap_conditioning_modality AdjustmentEvent the existing
 *      applyAdjustmentEvents pipeline can consume.
 *
 * The mapping is anchored on the CONDITIONING_META registry so any
 * new conditioning entry that registers a modality is automatically
 * eligible for tier-preserving swap selection.
 *
 * PURE — no store reads, no `new Date()`. Tests inject everything.
 */

import type { ResolvedDay } from './sessionResolver';
import {
  CONDITIONING_META,
  type ConditioningModality,
  type ConditioningTier,
  type ConditioningMeta,
} from '../data/exerciseTags';
import type { AdjustmentEvent } from './programAdjustmentEngine';
import { logger } from './logger';

// ─── Modality vocabulary ────────────────────────────────────────────

/**
 * User-typed tokens that map to a canonical modality. Mirrors the
 * resolver's vocabulary so "rower" / "row" / "rowing" all collapse
 * to the same target.
 */
const TOKEN_TO_MODALITY: Record<string, ConditioningModality> = {
  rower: 'row',
  row: 'row',
  rowing: 'row',
  bike: 'bike',
  'assault bike': 'bike',
  'air bike': 'bike',
  'stationary bike': 'bike',
  'regular bike': 'bike',
  'normal bike': 'bike',
  cycling: 'bike',
  cycle: 'bike',
  spin: 'bike',
  run: 'run',
  running: 'run',
  runs: 'run',
  jog: 'run',
  ski: 'ski',
  'ski erg': 'ski',
  skierg: 'ski',
  swim: 'swim',
  swimming: 'swim',
};

const MODALITY_TOKENS = Object.keys(TOKEN_TO_MODALITY);

/** Return canonical modality for a free-text token, or null. */
export function tokenToModality(token: string): ConditioningModality | null {
  if (!token) return null;
  const normalised = token.toLowerCase().replace(/\s+/g, ' ').trim();
  return TOKEN_TO_MODALITY[normalised] ?? TOKEN_TO_MODALITY[normalised.replace(/\s+/g, '')] ?? null;
}

// ─── Parsed swap intent ─────────────────────────────────────────────

export interface ParsedModalitySwap {
  /** Canonical modality (row, bike, …) the user wants to remove. */
  from: ConditioningModality | null;
  /** Canonical modality the user wants in its place. */
  to: ConditioningModality;
  /**
   * The raw token the user used for `to`. Useful when the reply
   * composer wants to echo the user's vocabulary ("Done — now on the
   * bike").
   */
  toToken: string;
  /** Was the `from` modality explicit, or inferred from the target? */
  fromInferred: boolean;
  /**
   * Bike subtype detected in the message ("regular/standard/stationary
   * bike" → 'standard', "assault/echo/airdyne bike" → 'assault'). Null
   * when the user said only "bike" without a qualifier — leaves the
   * existing label alone.
   */
  bikeLabel: BikeLabel | null;
  /**
   * True when the user explicitly targeted the whole session/day/workout
   * as the thing whose modality should change ("make Wednesday's session
   * a SkiErg"). This lets the router prefer the session-swap path over
   * last-mutation follow-up editing.
   */
  targetedSession: boolean;
}

// ─── Bike subtype intent parser ─────────────────────────────────────
//
// Token-presence is not enough. "I want a normal bike" mentions
// "assault bike" zero times, so the legacy parser worked. But:
//
//   "you changed to an assault bike I want a normal bike"   → regular
//   "regular bike, not assault bike"                        → regular
//   "not assault bike"                                      → regular
//   "I don't want assault bike"                             → regular
//   "it's still saying assault bike?"                       → regular
//   "it says assault bike"                                  → regular
//   "use assault bike"                                      → assault
//   "make it assault bike"                                  → assault
//
// Both labels can co-occur, the intent depends on negation / correction
// / complaint context, NOT raw token frequency. parseBikeSubtypeIntent
// classifies the surrounding verb (positive vs. negation vs. complaint)
// for each subtype mention and returns the desired label.
//
// `extractBikeLabel` is preserved as a thin wrapper for legacy callers
// (parseModalitySwapRequest / coachCommandRouter) — both now get the
// disambiguated label automatically.

const REGULAR_TOKEN = '(?:regular|normal|standard|stationary|upright|spin|exercise)';
const ASSAULT_TOKEN = '(?:assault|airdyne|echo|air)';

/**
 * Source of the inferred bike-subtype intent. Drives confidence + lets
 * downstream callers (the router) decide whether bare-token mentions
 * deserve their own gate.
 */
export type BikeSubtypeIntentSource =
  | 'positive_regular'
  | 'positive_assault'
  | 'negation_assault'
  | 'negation_regular'
  | 'complaint_assault'
  | 'token_only_regular'
  | 'token_only_assault'
  | null;

export interface BikeSubtypeIntent {
  /** Resolved subtype the user wants — null when the message has no callout. */
  desiredLabel: BikeLabel | null;
  /** Which clause shape produced the decision. Useful for logs + tests. */
  source: BikeSubtypeIntentSource;
  /** 0..1 — higher when an explicit verb (want/use/not) anchors the decision. */
  confidence: number;
}

/**
 * Deterministic bike subtype intent parser.
 *
 * Order of precedence (first match wins):
 *   1. Positive regular  ("want a normal bike", "use a regular bike")
 *   2. Positive assault  ("use assault bike", "make it assault bike")
 *   3. Negation/complaint of assault ("not assault bike", "still saying
 *      assault bike?", "it says assault bike", "you changed to an
 *      assault bike")
 *   4. Negation of regular ("not a normal bike, give me assault")
 *   5. Question-form-as-complaint: trailing `?` + bare assault mention
 *   6. Bare regular token
 *   7. Bare assault token
 *
 * "Both labels appear" cases are resolved by reading WHICH side of the
 * sentence the verb attaches to — never by counting tokens.
 */
export function parseBikeSubtypeIntent(message: string): BikeSubtypeIntent {
  const result = computeBikeSubtypeIntent(message);
  // Phase G runtime audit — surface the exact bike-intent verdict so live
  // logs prove which branch fired (or that the parser didn't see the
  // message at all). Sam's spec.
  if (message) {
    logger.debug('[coach-bike-subtype-intent]', {
      desiredLabel: result.desiredLabel,
      source: result.source,
      confidence: result.confidence,
      message: message.length > 200 ? `${message.slice(0, 200)}…` : message,
    });
  }
  return result;
}

/**
 * Internal implementation — kept private so the public
 * parseBikeSubtypeIntent can log uniformly without sprinkling logger
 * calls across the precedence ladder.
 */
function computeBikeSubtypeIntent(message: string): BikeSubtypeIntent {
  if (!message) return { desiredLabel: null, source: null, confidence: 0 };
  const m = message;

  // Verb groups. Kept narrow on purpose — adding a noisy verb here will
  // cause a question like "do you mean assault bike?" to misclassify.
  const POSITIVE_VERB =
    `(?:` +
    // First-person preferences
    `i\\s+(?:just\\s+|really\\s+)?(?:want|prefer|need|like|would\\s+like|would\\s+prefer|would\\s+rather)|` +
    `i'?d\\s+(?:like|prefer|rather)|i\\s+would\\s+(?:like|prefer|rather)|` +
    `i'?ll\\s+(?:do|use|go\\s+with|take)|` +
    // Bare verbs / imperatives
    `want|prefer|rather|use|using|do|take|add|include|throw\\s+in|put\\s+in|` +
    `go\\s+(?:with|on)|` +
    `change\\s+(?:it\\s+)?(?:to|into)|switch\\s+(?:it\\s+)?to|` +
    `make\\s+(?:it|that|it\\s+a|that\\s+a)|` +
    // Discourse markers commonly followed by a desired option
    `actually(?:\\s+(?:i\\s+want|just|make\\s+it))?|` +
    `just\\s+(?:do|use|give\\s+me)` +
    `)`;

  // Negation: "not" / "don't want" / "no" / "stop using" / "never want"
  const NEGATION_VERB =
    `(?:` +
    `not|` +
    `don'?t\\s+(?:want|like|need|use)|do\\s+not\\s+(?:want|like|need|use)|dont\\s+(?:want|like|need|use)|` +
    `never\\s+(?:want|use)|stop\\s+(?:using|with)|no\\s+more` +
    `)`;

  // Complaint shapes the user uses when reporting an undesired state.
  // "still saying / showing / on", "it says / shows / showing",
  // "keeps saying", "why is it / why are you", "(you) changed it to",
  // "switched it to", "put it on".
  const COMPLAINT_VERB =
    `(?:` +
    `(?:it'?s\\s+|its\\s+|it\\s+is\\s+)?still\\s+(?:saying|showing|on|set\\s+to|set\\s+as)|` +
    `keeps?\\s+(?:saying|showing|setting)|` +
    `(?:it|that)\\s+(?:says|shows|showing|reads)|` +
    `why\\s+(?:is|are|did|do|does)\\s+(?:it|you|that|there)|` +
    `(?:you\\s+)?changed\\s+(?:it\\s+)?to|switched\\s+(?:it\\s+)?to|put\\s+(?:it\\s+)?on|` +
    `you\\s+(?:gave|set|made)\\s+(?:me|it|that)` +
    `)`;

  const reRegularBike = (verb: string) =>
    new RegExp(`\\b${verb}\\s+(?:an?\\s+|the\\s+|me\\s+(?:an?\\s+|the\\s+)?)?${REGULAR_TOKEN}\\s+bike\\b`, 'i');
  const reAssaultBike = (verb: string) =>
    new RegExp(`\\b${verb}\\s+(?:an?\\s+|the\\s+|me\\s+(?:an?\\s+|the\\s+)?)?${ASSAULT_TOKEN}\\s+bike\\b`, 'i');

  // 1. Negation of assault bike — checked BEFORE positive so "I don't
  //    want assault bike" doesn't get gobbled by the bare `want` arm of
  //    POSITIVE_VERB. The negation regex requires the negation phrase to
  //    immediately precede the bike label, so plain "don't ... assault"
  //    with intervening words still falls through to later arms.
  if (reAssaultBike(NEGATION_VERB).test(m)) {
    return { desiredLabel: 'standard', source: 'negation_assault', confidence: 0.9 };
  }
  // 2. Negation of regular bike (rare but symmetric).
  if (reRegularBike(NEGATION_VERB).test(m)) {
    return { desiredLabel: 'assault', source: 'negation_regular', confidence: 0.85 };
  }
  // 3. Positive regular bike — runs after negation so "want a regular,
  //    not an assault" first catches the assault-side negation when the
  //    user listed assault first.
  if (reRegularBike(POSITIVE_VERB).test(m)) {
    return { desiredLabel: 'standard', source: 'positive_regular', confidence: 0.95 };
  }
  // 4. Positive assault bike.
  if (reAssaultBike(POSITIVE_VERB).test(m)) {
    return { desiredLabel: 'assault', source: 'positive_assault', confidence: 0.95 };
  }
  // 5. Complaint about assault bike (an indirect negation).
  if (reAssaultBike(COMPLAINT_VERB).test(m)) {
    return { desiredLabel: 'standard', source: 'complaint_assault', confidence: 0.85 };
  }
  // "Why isn't it an assault bike?" is a request for assault, not the
  // complaint shape above ("Why is it an assault bike?").
  if (
    new RegExp(`\\bwhy\\s+(?:isn'?t|is\\s+not|aren'?t|are\\s+not)\\s+(?:it|that|there)?\\s*(?:an?\\s+|the\\s+)?${ASSAULT_TOKEN}\\s+bike\\b`, 'i').test(m)
  ) {
    return { desiredLabel: 'assault', source: 'positive_assault', confidence: 0.85 };
  }
  // 6. Question-form complaint: trailing `?` + an assault mention with
  // no positive desire-verb anywhere → treat as "why is it assault?".
  const trimmed = m.trim();
  const endsWithQuestion = trimmed.endsWith('?');
  if (
    endsWithQuestion &&
    new RegExp(`\\b${ASSAULT_TOKEN}\\s+bike\\b`, 'i').test(m) &&
    !new RegExp(`\\b(?:want|prefer|use|make\\s+it|change\\s+(?:to|it\\s+to))\\s+(?:an?\\s+|the\\s+)?${ASSAULT_TOKEN}\\s+bike\\b`, 'i').test(m)
  ) {
    return { desiredLabel: 'standard', source: 'complaint_assault', confidence: 0.7 };
  }
  // 7. Bare regular bike token
  if (new RegExp(`\\b${REGULAR_TOKEN}\\s+bike\\b`, 'i').test(m)) {
    return { desiredLabel: 'standard', source: 'token_only_regular', confidence: 0.6 };
  }
  // 8. Bare assault bike token
  if (new RegExp(`\\b${ASSAULT_TOKEN}\\s+bike\\b`, 'i').test(m)) {
    return { desiredLabel: 'assault', source: 'token_only_assault', confidence: 0.6 };
  }
  return { desiredLabel: null, source: null, confidence: 0 };
}

/**
 * Extract a bike subtype callout from a message. Thin wrapper around
 * parseBikeSubtypeIntent so existing callers (parseModalitySwapRequest,
 * coachCommandRouter) get the disambiguated label automatically.
 *
 *   "I want a normal bike"                          → 'standard'
 *   "you changed to an assault bike I want a normal bike" → 'standard'
 *   "not assault bike"                              → 'standard'
 *   "it's still saying assault bike?"               → 'standard'
 *   "use assault bike"                              → 'assault'
 *   no bike mention                                 → null
 */
export function extractBikeLabel(message: string): BikeLabel | null {
  return parseBikeSubtypeIntent(message).desiredLabel;
}

/**
 * Parse a user message for a modality-swap intent. Returns null when
 * neither a `to X` nor a usable swap pattern is present.
 *
 * Recognised forms (anchor on `to`):
 *   "change it to a bike"                  → to=bike
 *   "swap the rower for a bike"            → from=row, to=bike
 *   "change rower to bike"                 → from=row, to=bike
 *   "make it a bike instead of a row"      → from=row, to=bike
 *   "can you make Wednesday a bike day"    → to=bike (from inferred from target)
 *   "switch it from row to bike"           → from=row, to=bike
 */
export function parseModalitySwapRequest(message: string): ParsedModalitySwap | null {
  if (!message) return null;
  const lower = message.toLowerCase();
  const bikeIntent = parseBikeSubtypeIntent(message);
  const bikeLabel = bikeIntent.desiredLabel;

  // ─── Same-modality bike-label correction ───
  // "I want a regular bike, not an assault bike", "make it a stationary
  // bike", "actually a normal bike", "it's still saying assault bike?".
  // The user's not switching modality, just labelling the bike subtype.
  // Treat as a `to=bike` request with `from=bike` so
  // applyModalityPreferenceToWorkout's same-modality path runs.
  //
  // We only fire on EXPLICIT intent (positive / negation / complaint /
  // question). Bare-token mentions ("what is a regular bike?") shouldn't
  // commit a preference write — they fall through to the conventional
  // swap pattern matcher below, which generally won't match either.
  const isBikeSubtypeCorrection =
    bikeIntent.source === 'negation_assault' ||
    bikeIntent.source === 'negation_regular' ||
    bikeIntent.source === 'complaint_assault' ||
    hasOpposedBikeSubtypeContext(lower, bikeLabel);
  if (bikeLabel && isBikeSubtypeCorrection) {
    return {
      from: 'bike',
      to: 'bike',
      toToken: 'bike',
      fromInferred: false,
      bikeLabel,
      targetedSession: false,
    };
  }

  const targetedConversion = parseTargetSessionModalityConversion(lower);

  // Try each `to`-style pattern first; if none yield a modality, bail.
  const toPatterns: RegExp[] = [
    /\b(?:change|swap|switch|turn|make|move)\s+(?:it|that|the\s+(?:row|rower|bike|run|ski|swim|workout|session|day))\s+(?:in)?to\s+(?:an?\s+)?([a-z]+)/i,
    /\b(?:to|into)\s+(?:an?\s+)?([a-z]+)\s+(?:instead|rather)\b/i,
    /\bswap\s+(?:the\s+)?(\w+)\s+(?:for|with)\s+(?:an?\s+)?(\w+)/i,
    /\bchange\s+(?:the\s+)?(\w+)\s+(?:to|for)\s+(?:an?\s+)?(\w+)/i,
    /\bmake\s+(?:it|that)\s+(?:an?\s+)?([a-z]+)\s+(?:day|session|workout)?/i,
    /\b(?:on|do)\s+(?:the|a)\s+([a-z]+)\s+instead\b/i,
    /\bto\s+(?:a\s+)?(bike|row|rower|run|running|ski|swim|cycling)\b/i,
  ];

  let to: ConditioningModality | null = null;
  let toToken = '';
  let from: ConditioningModality | null = null;
  let fromInferred = true;
  let targetedSession = false;

  // Two-token forms: `swap rower for bike`, `change rower to bike`.
  const twoTokenSwap =
    /\bswap\s+(?:the\s+)?(\w+)\s+(?:for|with)\s+(?:an?\s+)?(\w+)/i.exec(lower) ||
    /\bchange\s+(?:the\s+)?(\w+)\s+(?:to|for)\s+(?:an?\s+)?(\w+)/i.exec(lower);
  if (twoTokenSwap) {
    const fromCandidate = tokenToModality(twoTokenSwap[1]);
    const toCandidate = tokenToModality(twoTokenSwap[2]);
    if (fromCandidate && toCandidate && fromCandidate !== toCandidate) {
      from = fromCandidate;
      to = toCandidate;
      toToken = twoTokenSwap[2];
      fromInferred = false;
    }
  }

  // Target-session forms ("make Wednesday a SkiErg", "make it assault bike")
  // fill the destination, then fall through to the shared source extractor
  // below so phrases like "instead of row" still preserve from=row.
  if (!to && targetedConversion) {
    to = targetedConversion.to;
    toToken = targetedConversion.toToken;
    fromInferred = true;
    targetedSession = targetedConversion.targetedSession;
  }

  // Otherwise scan for a single `to X` token.
  if (!to) {
    for (const re of toPatterns) {
      const m = re.exec(lower);
      if (!m) continue;
      // If the regex captured two groups (twoTokenSwap-style), prefer the
      // second token as the destination.
      const candidateToken = m[m.length - 1] ?? '';
      const candidate = tokenToModality(candidateToken);
      if (!candidate) continue;
      to = candidate;
      toToken = candidateToken;
      break;
    }
  }

  if (!to) return null;

  // Look for an `instead of X` or `from X` to nail down the source.
  if (!from) {
    const insteadMatch = /\binstead\s+of\s+(?:an?\s+)?(\w+)/i.exec(lower);
    const fromMatch = /\bfrom\s+(?:an?\s+)?(\w+)\s+to\b/i.exec(lower);
    const candidate = (insteadMatch?.[1] ?? fromMatch?.[1] ?? '').toLowerCase();
    const canonical = tokenToModality(candidate);
    if (canonical && canonical !== to) {
      from = canonical;
      fromInferred = false;
    }
  }

  return { from, to, toToken, fromInferred, bikeLabel, targetedSession };
}

const DAY_NAME_TOKEN =
  '(?:today|tomorrow|sun|sundays?|mon|mondays?|tue|tues|tuesdays?|wed|weds|wednesdays?|thu|thur|thurs|thursdays?|fri|fridays?|sat|saturdays?)';
const SESSION_TARGET_TOKEN =
  `(?:(?:${DAY_NAME_TOKEN})(?:'s)?(?:\\s+(?:session|workout|day|conditioning|cardio|aerobic\\s+flush|flush))?|(?:it|this|that)|(?:this|that|the)?\\s*(?:session|workout|day|conditioning|cardio|aerobic\\s+flush|flush))`;
const MODALITY_DESTINATION_TOKEN =
  '(assault\\s+bike|air\\s+bike|stationary\\s+bike|regular\\s+bike|normal\\s+bike|ski\\s*erg|skierg|rower|rowing|row|bike|cycling|run|running|swim|swimming|ski)';

function parseTargetSessionModalityConversion(
  message: string,
): { to: ConditioningModality; toToken: string; targetedSession: boolean } | null {
  const patterns = [
    // "change Wednesday session to be a Ski Erg"
    `\\b(?:change|switch|make|turn|convert|set)\\s+(?:the\\s+)?${SESSION_TARGET_TOKEN}\\s+(?:to\\s+be|to|into|onto|as)\\s+(?:an?\\s+)?${MODALITY_DESTINATION_TOKEN}\\b`,
    // "make Wednesday a Ski Erg"
    `\\b(?:make|set|turn)\\s+(?:the\\s+)?${SESSION_TARGET_TOKEN}\\s+(?:an?\\s+)?${MODALITY_DESTINATION_TOKEN}\\b`,
    // "do/use Ski Erg on Wednesday"
    `\\b(?:do|use|put\\s+in|program|schedule)\\s+(?:an?\\s+)?${MODALITY_DESTINATION_TOKEN}\\s+(?:on|for|into)\\s+(?:the\\s+)?${SESSION_TARGET_TOKEN}\\b`,
    // "Wednesday session should be Ski Erg"
    `\\b(?:the\\s+)?${SESSION_TARGET_TOKEN}\\s+(?:should\\s+be|can\\s+be|could\\s+be|becomes?|as)\\s+(?:an?\\s+)?${MODALITY_DESTINATION_TOKEN}\\b`,
  ];
  let toToken = '';
  for (const source of patterns) {
    const match = new RegExp(source, 'i').exec(message);
    if (!match) continue;
    toToken = [...match].reverse().find((part) => tokenToModality(part)) ?? '';
    if (toToken) {
      toToken = toToken.replace(/\s+/g, ' ').trim();
      const to = tokenToModality(toToken);
      if (!to) return null;
      return {
        to,
        toToken,
        targetedSession: hasExplicitSessionTarget(match[0]),
      };
    }
  }
  return null;
}

function hasExplicitSessionTarget(matchedText: string): boolean {
  return (
    new RegExp(`\\b${DAY_NAME_TOKEN}\\b`, 'i').test(matchedText) ||
    /\b(?:session|workout|day|conditioning|cardio|aerobic\s+flush|flush)\b/i.test(matchedText)
  );
}

function hasOpposedBikeSubtypeContext(
  message: string,
  desiredLabel: BikeLabel | null,
): boolean {
  if (!desiredLabel) return false;
  const opposedToken = desiredLabel === 'standard' ? ASSAULT_TOKEN : REGULAR_TOKEN;
  const opposedMention = new RegExp(`\\b${opposedToken}(?:\\s+bike)?\\b`, 'i').test(message);
  if (!opposedMention) return false;
  return /\b(?:not|no|without|instead\s+of|rather\s+than|changed|switched|still|says?|shows?|showing|set|made|put)\b/i.test(message);
}

// ─── Tier-preserving mapping ────────────────────────────────────────

/**
 * Best-effort name swap for one conditioning exercise: keeps the same
 * tier on the target modality.
 *
 * Returns null when the source name isn't conditioning-tagged or no
 * tier-matching destination exists for the target modality.
 */
export function pickEquivalentByTier(
  fromName: string,
  toModality: ConditioningModality,
): string | null {
  const meta = CONDITIONING_META[fromName] as ConditioningMeta | undefined;
  if (!meta) return null;
  if (meta.modality === toModality) return null;
  // Prefer exact tier match. Fall back to nearest tier (B-low ↔ B-high)
  // so the swap always lands a real exercise even if the registry is
  // sparse for some modality (e.g. swim has only Tier C).
  const tierOrder: ConditioningTier[] = ['A', 'B-high', 'B-low', 'C'];
  const startIdx = tierOrder.indexOf(meta.tier);
  for (let radius = 0; radius < tierOrder.length; radius++) {
    const candidates: string[] = [];
    if (radius === 0) {
      // exact tier
      const tier = tierOrder[startIdx];
      candidates.push(...namesForTierAndModality(tier, toModality));
    } else {
      for (const offset of [-radius, radius]) {
        const idx = startIdx + offset;
        if (idx < 0 || idx >= tierOrder.length) continue;
        candidates.push(...namesForTierAndModality(tierOrder[idx], toModality));
      }
    }
    if (candidates.length > 0) return candidates[0];
  }
  return null;
}

function namesForTierAndModality(
  tier: ConditioningTier,
  modality: ConditioningModality,
): string[] {
  const out: string[] = [];
  for (const [name, meta] of Object.entries(CONDITIONING_META)) {
    if (meta.tier === tier && meta.modality === modality) out.push(name);
  }
  return out;
}

// ─── Modality token → display label / inverse detection ────────────

/**
 * The display labels the engine renders inside parenthetical exercise
 * names (e.g. "Easy Aerobic Flush (20min Rower)"). Mirrors the labels
 * sessionBuilder emits.
 */
const MODALITY_TO_LABEL: Record<ConditioningModality, string> = {
  bike: 'Assault Bike',
  row: 'Rower',
  ski: 'SkiErg',
  run: 'Run',
  swim: 'Swim',
  mixed: 'Mixed',
};

/**
 * Bike subtype preference. The DEFAULT label is "Bike" (standard upright
 * erg) — athletes who actually have an Assault/Air/Echo bike opt IN via
 * an explicit "assault bike" request. Stored on the ModalityPreference
 * and read back here when rendering names.
 *
 *   'assault'  → "Assault Bike" (only when user explicitly asked for one)
 *   'standard' → "Bike" (engine default — user's option A)
 *   'generic'  → "Bike" (no subtype implied)
 *
 * Future: if we add a real distinction in the engine, 'standard' could
 * pick a different exercise pool; today it only changes the rendered
 * label so no fake "stationary bike" exercise gets fabricated.
 *
 * IMPORTANT: this default flipped in Phase H. Previously bare "bike"
 * mapped to Assault Bike, which produced overrides like "Assault Bike
 * Intervals" for users on a normal stationary bike. The router /
 * orchestrator / event applier must respect the new default — pass
 * `bikeLabel: 'standard'` explicitly when synthesising bike-modality
 * events so that downstream rendering matches.
 */
export type BikeLabel = 'assault' | 'standard' | 'generic';

export interface ModalityLabelOpts {
  bikeLabel?: BikeLabel | null;
}

/**
 * Resolve the display label for a modality, honouring an optional
 * per-modality subtype. Bike is the only modality with a subtype today.
 *
 * DEFAULT: when `bikeLabel` is null/undefined, returns "Bike" (NOT
 * "Assault Bike"). Phase H — bare "bike" means standard bike.
 */
export function resolveModalityLabel(
  modality: ConditioningModality,
  opts?: ModalityLabelOpts,
): string {
  if (modality === 'bike') {
    const sub = opts?.bikeLabel ?? 'standard';
    if (sub === 'assault') return 'Assault Bike';
    return 'Bike';
  }
  return MODALITY_TO_LABEL[modality];
}

/** Map a free-text label found inside a parenthetical to its modality. */
const LABEL_PATTERNS: Array<{ re: RegExp; modality: ConditioningModality }> = [
  { re: /\b(rower|rowing\s*erg|\brow\b)\b/i, modality: 'row' },
  { re: /\b(assault\s*bike|echo\s*bike|airbike|exercise\s*bike|stationary\s*bike|\bbike\b|cycling)\b/i, modality: 'bike' },
  { re: /\b(skierg|ski\s*erg|\bski\b)\b/i, modality: 'ski' },
  { re: /\b(run|running|jog)\b/i, modality: 'run' },
  { re: /\b(swim|pool)\b/i, modality: 'swim' },
];

/**
 * Detect the conditioning modality embedded in a free-text exercise
 * name. Recognises both clean meta names ("Easy Row") and parenthetical
 * forms ("Easy Aerobic Flush (20min Rower)"). Returns null when no
 * modality token is present.
 */
export function inferModalityFromName(name: string): ConditioningModality | null {
  if (!name) return null;
  const meta = CONDITIONING_META[name];
  if (meta) return meta.modality;
  for (const { re, modality } of LABEL_PATTERNS) {
    if (re.test(name)) return modality;
  }
  return null;
}

/**
 * Rewrite a parenthetical / embedded modality label inside an exercise
 * name. Preserves the structural prefix (e.g. "Easy Aerobic Flush", the
 * duration token "20min", anything before/after the modality word).
 *
 * Returns null when no replacement is possible (no modality token found,
 * or token already matches `to`).
 */
export function rewriteModalityInName(
  name: string,
  to: ConditioningModality,
  opts?: ModalityLabelOpts,
): string | null {
  if (!name) return null;
  const targetLabel = resolveModalityLabel(to, opts);
  if (!targetLabel) return null;
  // Special case: same-modality bike-label correction. Used when the
  // user already on bike says "I want a regular bike, not an assault
  // bike". Rewrite the assault-bike label to the new bike label.
  if (to === 'bike') {
    const assaultRe = /\b(?:assault\s*bike|echo\s*bike|airbike|airdyne)\b/i;
    if (assaultRe.test(name)) {
      const replaced = name.replace(assaultRe, targetLabel);
      if (replaced !== name) return replaced;
    }
    if (targetLabel !== 'Bike' && /\bbike\b/i.test(name) && !assaultRe.test(name)) {
      const replaced = name.replace(/\bbike\b/i, targetLabel);
      if (replaced !== name) return replaced;
    }
    // Already labelled as "Bike" (no assault prefix) and target is also
    // a generic Bike → no rewrite needed.
    if (targetLabel === 'Bike' && /\bbike\b/i.test(name) && !assaultRe.test(name)) {
      return null;
    }
  }
  for (const { re, modality } of LABEL_PATTERNS) {
    if (modality === to) continue;
    if (!re.test(name)) continue;
    const replaced = name.replace(re, targetLabel);
    if (replaced !== name) return replaced;
  }
  return null;
}

// ─── Day-scoped helpers (for verification / message authoring) ──────

/**
 * True when the workout body contains at least one conditioning
 * exercise tagged with the given modality.
 */
export function dayHasModality(
  day: ResolvedDay | null | undefined,
  modality: ConditioningModality,
): boolean {
  if (!day?.workout) return false;
  for (const ex of day.workout.exercises ?? []) {
    const name = ex.exercise?.name ?? '';
    const meta = CONDITIONING_META[name];
    if (meta?.modality === modality) return true;
  }
  // Fallback: scan the conditioning block titles.
  for (const opt of day.workout.conditioningBlock?.options ?? []) {
    const meta = CONDITIONING_META[opt.title];
    if (meta?.modality === modality) return true;
  }
  // Last-resort: name token scan (handles synthetic / coach-injected
  // entries that aren't in CONDITIONING_META).
  const tokensForModality: Record<ConditioningModality, RegExp> = {
    bike: /\b(bike|cycling|cycle|spin)\b/i,
    row: /\b(row|rower|rowing)\b/i,
    run: /\b(run|running|runs|jog|sprint)\b/i,
    ski: /\b(ski|skierg)\b/i,
    swim: /\b(swim)\b/i,
    mixed: /\b(metcon|tabata|circuit)\b/i,
  };
  const re = tokensForModality[modality];
  if (re) {
    const parts: string[] = [
      day.workout.name,
      day.workout.description,
      (day.workout as any).coachAddedConditioningLabel,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    for (const opt of day.workout.conditioningBlock?.options ?? []) {
      if (typeof opt.title === 'string') parts.push(opt.title);
      if (typeof opt.description === 'string') parts.push(opt.description);
    }
    for (const ex of day.workout.exercises ?? []) {
      if (typeof ex.exercise?.name === 'string') parts.push(ex.exercise.name);
      if (typeof ex.exercise?.description === 'string') parts.push(ex.exercise.description);
      if (typeof (ex as any).notes === 'string') parts.push((ex as any).notes);
    }
    for (const part of parts) {
      if (re.test(part)) return true;
    }
  }
  return false;
}

// ─── Event factory ──────────────────────────────────────────────────

let eventCounter = 0;
function nextEventId(prefix: string): string {
  eventCounter += 1;
  return `${prefix}-${eventCounter}`;
}

export interface BuildSwapEventInput {
  date: string;
  from: ConditioningModality | null;
  to: ConditioningModality;
  /**
   * Bike subtype to render. Required when `to === 'bike'` for deterministic
   * Phase H rendering. The applier reads this off `event.after.bikeLabel`
   * and feeds it to the canonical workout rewrite helper.
   */
  bikeLabel?: BikeLabel | null;
  reason?: string;
}

/**
 * Construct a swap_conditioning_modality event the existing
 * applyAdjustmentEvents pipeline understands. The `before` / `after`
 * payloads encode `{ modality, bikeLabel? }` so the applier can do a
 * tier-preserving rewrite AND honour the bike subtype label.
 */
export function buildSwapConditioningModalityEvent(
  input: BuildSwapEventInput,
): AdjustmentEvent {
  const after: { modality: ConditioningModality; bikeLabel?: BikeLabel } = {
    modality: input.to,
  };
  // Phase H — bike events ALWAYS carry an explicit label so the applier
  // never silently defaults to 'Assault'.
  if (input.to === 'bike') {
    after.bikeLabel = input.bikeLabel ?? 'standard';
  } else if (input.bikeLabel) {
    after.bikeLabel = input.bikeLabel;
  }
  return {
    id: nextEventId('swap-modality'),
    kind: 'swap_conditioning_modality',
    date: input.date,
    reason: input.reason ?? `swap ${input.from ?? 'current'} → ${input.to}`,
    before: input.from ? { modality: input.from } : null,
    after,
  };
}

// ─── Canonical workout rewrite (Phase H) ────────────────────────────

/**
 * Forbidden tokens by destination modality. Used by `verifyModalityRewrite`
 * to scan all visible fields for any leftover "from" labels after a swap.
 * If any of these match, the rewrite is INCOMPLETE — the truth gate
 * blocks the "Done" reply.
 *
 * Bike (regular) destination: never allow "Rower", "Assault Bike", or
 * legacy "Intervals" suffixes that came from row.
 *
 * Bike (assault) destination: allow "Assault Bike", still strip "Rower".
 *
 * Row destination: strip bike/assault.
 */
const FORBIDDEN_TOKENS_BY_DESTINATION: Record<
  ConditioningModality,
  { regular: RegExp[]; assault: RegExp[] }
> = {
  bike: {
    regular: [
      /\b(?:rower|rowing\s*erg|\brow\b|rowing)\b/i,
      /\b(?:assault\s*bike|air\s*bike|airbike|echo\s*bike|airdyne)\b/i,
    ],
    assault: [
      /\b(?:rower|rowing\s*erg|\brow\b|rowing)\b/i,
    ],
  },
  row: {
    regular: [
      /\b(?:assault\s*bike|air\s*bike|airbike|echo\s*bike|airdyne|stationary\s*bike|exercise\s*bike|\bbike\b|cycling)\b/i,
    ],
    assault: [
      /\b(?:assault\s*bike|air\s*bike|airbike|echo\s*bike|airdyne|stationary\s*bike|exercise\s*bike|\bbike\b|cycling)\b/i,
    ],
  },
  run: {
    regular: [
      /\b(?:assault\s*bike|air\s*bike|airbike|echo\s*bike|\bbike\b|rower|\brow\b|cycling|swim|skierg)\b/i,
    ],
    assault: [
      /\b(?:assault\s*bike|air\s*bike|airbike|echo\s*bike|\bbike\b|rower|\brow\b|cycling|swim|skierg)\b/i,
    ],
  },
  ski: {
    regular: [
      /\b(?:rower|\brow\b|\bbike\b|cycling|run|running|swim)\b/i,
    ],
    assault: [
      /\b(?:rower|\brow\b|\bbike\b|cycling|run|running|swim)\b/i,
    ],
  },
  swim: {
    regular: [
      /\b(?:rower|\brow\b|\bbike\b|cycling|run|running|skierg|ski)\b/i,
    ],
    assault: [
      /\b(?:rower|\brow\b|\bbike\b|cycling|run|running|skierg|ski)\b/i,
    ],
  },
  mixed: {
    regular: [],
    assault: [],
  },
};

export interface ModalityRewriteLeak {
  field: string;
  text: string;
  matched: string;
}

export interface ModalityRewriteVerification {
  ok: boolean;
  leaks: ModalityRewriteLeak[];
}

function forbiddenPatternsForSources(
  sources: ConditioningModality[],
  toModality: ConditioningModality,
  bikeLabel: BikeLabel | null,
): RegExp[] {
  const patterns: RegExp[] = [];
  for (const source of sources) {
    if (source === toModality) continue;
    if (source === 'row') patterns.push(/\b(?:rower|rowing\s*erg|\brow\b|rowing)\b/i);
    if (source === 'bike') {
      patterns.push(/\b(?:assault\s*bike|air\s*bike|airbike|echo\s*bike|airdyne|stationary\s*bike|exercise\s*bike|\bbike\b|cycling)\b/i);
    }
    if (source === 'run') patterns.push(/\b(?:run|running|runs|jog|sprint)\b/i);
    if (source === 'ski') patterns.push(/\b(?:skierg|ski\s*erg|\bski\b)\b/i);
    if (source === 'swim') patterns.push(/\b(?:swim|swimming|pool)\b/i);
  }
  if (toModality === 'bike' && bikeLabel !== 'assault') {
    patterns.push(/\b(?:assault\s*bike|air\s*bike|airbike|echo\s*bike|airdyne)\b/i);
  }
  return patterns;
}

/**
 * Phase H truth gate. After a modality rewrite, scan EVERY athlete-visible
 * string field for tokens that contradict the destination modality. The
 * router uses this to decide whether to claim "Done" or fall back to a
 * sanitized "I can talk through that…" reply.
 *
 * Fields scanned:
 *   - workout.name
 *   - workout.description
 *   - exercises[].exercise.name + .description
 *   - exercises[].notes
 *   - conditioningBlock.options[].title + .description
 *   - coachNotes  (excludes the canonical "Swapped from X to Y" line,
 *     which legitimately mentions both modalities)
 */
export function verifyModalityRewrite(
  workout: {
    name?: string;
    description?: string;
    exercises?: Array<any>;
    conditioningBlock?: { options?: Array<{ title?: string; description?: string }> };
    coachNotes?: string[];
  } | null | undefined,
  toModality: ConditioningModality,
  bikeLabel: BikeLabel | null,
  sourceModalities?: ConditioningModality | ConditioningModality[] | null,
): ModalityRewriteVerification {
  if (!workout) return { ok: true, leaks: [] };
  const sources = Array.isArray(sourceModalities)
    ? sourceModalities
    : sourceModalities
      ? [sourceModalities]
      : null;
  const patterns = sources
    ? forbiddenPatternsForSources(sources, toModality, bikeLabel)
    : FORBIDDEN_TOKENS_BY_DESTINATION[toModality]?.[bikeLabel === 'assault' ? 'assault' : 'regular'] ?? [];
  if (patterns.length === 0) return { ok: true, leaks: [] };
  const leaks: ModalityRewriteLeak[] = [];
  const scan = (field: string, text: string | undefined) => {
    if (!text) return;
    for (const re of patterns) {
      const m = re.exec(text);
      if (m) {
        leaks.push({ field, text, matched: m[0] });
        return; // one leak per field is enough
      }
    }
  };

  scan('workout.name', workout.name);
  scan('workout.description', workout.description);

  (workout.exercises ?? []).forEach((ex: any, i: number) => {
    scan(`exercises[${i}].exercise.name`, ex?.exercise?.name);
    scan(`exercises[${i}].exercise.description`, ex?.exercise?.description);
    scan(`exercises[${i}].notes`, typeof ex?.notes === 'string' ? ex.notes : undefined);
  });

  (workout.conditioningBlock?.options ?? []).forEach((opt: any, i: number) => {
    scan(`conditioningBlock.options[${i}].title`, opt?.title);
    scan(`conditioningBlock.options[${i}].description`, opt?.description);
  });

  // coachNotes: skip canonical swap notes (they legitimately reference
  // BOTH modalities, e.g. "Swapped from rower to bike").
  (workout.coachNotes ?? []).forEach((n: string, i: number) => {
    if (/^(?:Swapped|Coach preference:|Swap\b)/i.test(n)) return;
    scan(`coachNotes[${i}]`, n);
  });

  return { ok: leaks.length === 0, leaks };
}

export interface ApplyConditioningModalityOpts {
  /** Source modality (null = any conditioning). */
  fromModality: ConditioningModality | null;
  /** Destination modality. */
  toModality: ConditioningModality;
  /**
   * Bike subtype label. Required when toModality === 'bike' to ensure
   * deterministic rendering. Defaults to 'standard' per Phase H.
   */
  bikeLabel?: BikeLabel | null;
  /**
   * True when this is a same-modality label correction (e.g. bike→bike
   * but bikeLabel flipped from assault to standard). In that case the
   * coachNote uses "Coach preference: using regular bike" framing, not
   * "Swapped from X to Y".
   */
  isLabelOnlyFix?: boolean;
  /**
   * True when the rewrite is driven by a recurring coach preference write
   * (e.g. via `applyModalityPreferenceToWorkout`). Frames the coachNote
   * as "Coach preference: using X instead of Y" so future renders make it
   * clear this came from a saved preference, not a one-off swap.
   */
  isRecurringPreference?: boolean;
}

/**
 * Phase H canonical conditioning-modality rewrite.
 *
 * Atomically rewrites EVERY athlete-visible text field on a workout to
 * reflect a modality swap (or bike-label correction). The caller passes
 * `{ fromModality, toModality, bikeLabel }` and gets back either a new
 * workout (with all fields coherent) or the original reference (when no
 * change applies).
 *
 * Fields rewritten:
 *   1. workout.name                              (e.g. "Easy Aerobic Flush (20min Rower)" → "...(20min Bike)")
 *   2. workout.description                       (e.g. "20min easy Rower" → "20min easy Bike")
 *   3. exercises[].exercise.name                 (clean meta → tier swap; embedded → label rewrite)
 *   4. exercises[].exercise.description
 *   5. exercises[].notes
 *   6. conditioningBlock.options[].title
 *   7. conditioningBlock.options[].description
 *   8. coachNotes                                (canonical "Swapped from X to Y" appended, deduped)
 *
 * Strategy per text field:
 *   • If isLabelOnlyFix → route directly through rewriteModalityInName
 *     (which has the assault→standard branch).
 *   • Else if the field is a clean CONDITIONING_META name → pick a
 *     tier-preserving destination via pickEquivalentByTier.
 *   • Else if a modality label is embedded → rewriteModalityInName.
 *   • Else leave untouched.
 *
 * Returns the original `workout` reference when nothing changed — callers
 * can use referential equality as a "did we apply" check.
 */
export function applyConditioningModalityToWorkout<
  W extends {
    name?: string;
    description?: string;
    exercises?: Array<any>;
    conditioningBlock?: { options?: Array<{ title: string; description?: string; [k: string]: any }> } | undefined;
    coachNotes?: string[];
  },
>(workout: W, opts: ApplyConditioningModalityOpts): W {
  if (!workout) return workout;
  const from = opts.fromModality;
  const to = opts.toModality;
  const bikeLabel = opts.bikeLabel ?? (to === 'bike' ? 'standard' : null);
  const isLabelOnlyFix =
    !!opts.isLabelOnlyFix ||
    (!!bikeLabel && to === 'bike' && (from === null || from === 'bike'));
  const labelOpts: ModalityLabelOpts = { bikeLabel };

  let touched = false;
  let firstRename: { from: string; to: string } | null = null;

  // Single per-field rewrite. Returns the new text, or null to mean "no
  // change" (caller keeps the original). isLabelOnlyFix routes straight
  // through the rewriteModalityInName bike-label branch.
  const rewriteText = (text: string | undefined): string | null => {
    if (!text || typeof text !== 'string') return null;
    if (isLabelOnlyFix) {
      const r = rewriteModalityInName(text, to, labelOpts);
      return r && r !== text ? r : null;
    }
    const inferred = inferModalityFromName(text);
    if (!inferred) return null;
    if (inferred === to) {
      // Already on target modality. Still allow a label-only re-render
      // if this is the bike-bike same-modality correction path — handled
      // above by isLabelOnlyFix. Otherwise nothing to do.
      return null;
    }
    if (from && inferred !== from) return null;
    // Clean meta names: prefer tier-preserving swap so we land on a
    // real registered exercise (e.g. "Easy Row" → "Easy Bike").
    const meta = CONDITIONING_META[text];
    if (meta) {
      if (to === 'bike' && bikeLabel !== 'assault') {
        const r = rewriteModalityInName(text, to, labelOpts);
        if (r && r !== text) return r;
      }
      const replacement = pickEquivalentByTier(text, to);
      if (replacement && replacement !== text) return replacement;
    }
    // Embedded modality label: rewrite in-text.
    const r = rewriteModalityInName(text, to, labelOpts);
    return r && r !== text ? r : null;
  };

  // Legacy bracketed "[Swapped to X]" tag — Phase H removes these
  // wherever they show up in name/description (pre-Phase-H code wrote
  // them inline; Phase H writes coachNotes instead).
  const stripLegacyTag = (text: string | undefined): string | null => {
    if (!text) return null;
    const stripped = text
      .replace(/\s*\[Swapped\s+(?:to|from)\b[^\]]*\]/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return stripped !== text ? stripped : null;
  };

  // 1. workout.name
  let newName = workout.name;
  const nameRewritten = rewriteText(workout.name);
  if (nameRewritten) {
    if (workout.name && !firstRename) firstRename = { from: workout.name, to: nameRewritten };
    newName = nameRewritten;
    touched = true;
  }
  const nameDetagged = stripLegacyTag(newName);
  if (nameDetagged) {
    newName = nameDetagged;
    touched = true;
  }

  // 2. workout.description
  let newDescription = workout.description;
  const descRewritten = rewriteText(workout.description);
  if (descRewritten) {
    newDescription = descRewritten;
    touched = true;
  }
  const descDetagged = stripLegacyTag(newDescription);
  if (descDetagged) {
    newDescription = descDetagged;
    touched = true;
  }

  // 3 + 4 + 5. exercises[].{exercise.name, exercise.description, notes}
  const newExercises = (workout.exercises ?? []).map((ex: any) => {
    const exName: string | undefined = ex?.exercise?.name;
    const exDesc: string | undefined = ex?.exercise?.description;
    const exNotes: string | undefined = typeof ex?.notes === 'string' ? ex.notes : undefined;
    const newExName = rewriteText(exName);
    // exercise.description: prefer a direct rewrite of the existing
    // description text. If the description matched the name verbatim
    // (the typical case in this codebase), also propagate the new name.
    let newExDesc: string | null = rewriteText(exDesc);
    if (!newExDesc && newExName && exName && exDesc === exName) {
      newExDesc = newExName;
    }
    const newExNotes = rewriteText(exNotes);
    if (!newExName && !newExDesc && !newExNotes) return ex;
    touched = true;
    if (newExName && exName && !firstRename) firstRename = { from: exName, to: newExName };
    return {
      ...ex,
      exercise: ex.exercise
        ? {
            ...ex.exercise,
            name: newExName ?? ex.exercise.name,
            description: newExDesc ?? ex.exercise.description,
          }
        : ex.exercise,
      notes: newExNotes ?? ex.notes,
    };
  });

  // 6 + 7. conditioningBlock.options[].{title, description}
  let newBlock = workout.conditioningBlock;
  if (newBlock?.options?.length) {
    let blockChanged = false;
    const newOptions = newBlock.options.map((opt: any) => {
      const newTitle = rewriteText(opt?.title);
      let newOptDesc: string | null = rewriteText(opt?.description);
      if (!newOptDesc && newTitle && opt?.title && opt?.description === opt?.title) {
        newOptDesc = newTitle;
      }
      if (!newTitle && !newOptDesc) return opt;
      blockChanged = true;
      touched = true;
      if (newTitle && opt?.title && !firstRename) firstRename = { from: opt.title, to: newTitle };
      return {
        ...opt,
        title: newTitle ?? opt.title,
        description: newOptDesc ?? opt.description,
      };
    });
    if (blockChanged) {
      newBlock = { ...newBlock, options: newOptions };
    }
  }

  if (!touched) return workout;

  // 8. coachNotes — canonical, deduped.
  const fromWord = modalityToReplyWord(from, 'previous option', null);
  const toWord = modalityToReplyWord(to, to as string, bikeLabel);
  const sessionLabel = newName ?? workout.name ?? 'this session';
  const note = opts.isRecurringPreference
    ? from
      ? `Coach preference: using ${toWord} instead of ${fromWord} for ${sessionLabel}`
      : `Coach preference: using ${toWord} for ${sessionLabel}`
    : isLabelOnlyFix
      ? `Coach preference: using ${toWord} for ${sessionLabel}`
      : from
        ? `Swapped from ${fromWord} to ${toWord}`
        : `Swapped to ${toWord}`;
  const existingNotes = workout.coachNotes ?? [];
  // Strip stale swap notes from prior modalities so the latest swap is
  // the only one displayed:
  //   - Notes that START with "Swapped ..." or "Coach preference: using..."
  //   - Notes that CONTAIN the legacy "[Swapped to X]" bracketed tag
  //     (a relic of the pre-Phase-H description-tag approach)
  const filteredNotes = existingNotes.filter(
    (n) =>
      !/^Swapped (?:to|from)\b/i.test(n) &&
      !/^Coach preference: using\b/i.test(n) &&
      !/\[Swapped\s+(?:to|from)\b[^\]]*\]/i.test(n),
  );
  const coachNotes = filteredNotes.includes(note) ? filteredNotes : [...filteredNotes, note];

  return {
    ...workout,
    name: newName,
    description: newDescription,
    exercises: newExercises,
    conditioningBlock: newBlock,
    coachNotes,
  } as W;
}

function modalityToReplyWord(
  modality: ConditioningModality | null,
  fallback: string,
  bikeLabel: BikeLabel | null,
): string {
  if (!modality) return fallback;
  if (modality === 'row') return 'rower';
  if (modality === 'bike') {
    if (bikeLabel === 'standard') return 'regular bike';
    if (bikeLabel === 'assault') return 'assault bike';
    return 'bike';
  }
  if (modality === 'run') return 'run';
  if (modality === 'ski') return 'ski';
  if (modality === 'swim') return 'swim';
  return modality;
}

// ─── Pure preference application ────────────────────────────────────

/**
 * Pure rewrite of a Workout's conditioning slots according to a recurring
 * modality preference. Returns the original reference (`workout`) when no
 * change is made — callers can use referential equality as a "did we
 * apply" check.
 *
 * Phase H: thin wrapper around `applyConditioningModalityToWorkout`. The
 * canonical helper handles all 8 visible-text fields atomically so the
 * old "rewrite exercise name only" bug (which left workout.name +
 * workout.description + option.description stale) can't recur.
 *
 * Rules carried by the canonical helper:
 *   - Every conditioning surface whose registered modality matches
 *     `from` (or every conditioning surface, when `from` is null) is
 *     rewritten to a tier-preserving destination on `to`.
 *   - durationMinutes / intensity / workoutType / sessionTier are
 *     preserved verbatim.
 *   - Exercises tagged on a different modality (or untagged) are left
 *     alone — no fallback rewrite. The recurring preference is meant to
 *     be conservative.
 *   - On rewrite, a canonical `coachNotes` line is appended.
 */
export function applyModalityPreferenceToWorkout<
  W extends {
    name?: string;
    description?: string;
    exercises?: Array<any>;
    conditioningBlock?: { options?: Array<{ title: string; description?: string; [k: string]: any }> } | undefined;
    coachNotes?: string[];
  },
>(workout: W, pref: { from: ConditioningModality | null; to: ConditioningModality; bikeLabel?: BikeLabel | null }): W {
  return applyConditioningModalityToWorkout(workout, {
    fromModality: pref.from,
    toModality: pref.to,
    bikeLabel: pref.bikeLabel ?? null,
    isRecurringPreference: true,
  });
}

// ─── Tokens used by tests / display ────────────────────────────────

export const _internal = {
  MODALITY_TOKENS,
  TOKEN_TO_MODALITY,
  namesForTierAndModality,
};
