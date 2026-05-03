/**
 * injuryClarificationGuard.ts
 *
 * Deterministic pre-LLM guard that intercepts injury-clarification turns and
 * returns the canonical severity question without ever calling the model.
 *
 * Why this exists: even with a STRICT OVERRIDE block at the top of the system
 * prompt, the LLM still occasionally combines "where" + "how bad" into one
 * message. Prompt-level rules are best-effort. This guard makes the first
 * clarifier deterministic and eliminates multi-question violations entirely.
 *
 * Source of truth: this file. The deno edge function in
 * `supabase/functions/coach-chat/index.ts` carries an embedded mirror of the
 * same logic (it can't import from src/). KEEP IN SYNC: any change to the
 * keyword lists, severity patterns, or decision tree must be applied to both.
 *
 * Decision tree (matches the STRICT OVERRIDE in the system prompt):
 *   hasSeverity=true                              → no fire (LLM does program adjustment)
 *   hasLocation + hasNegativeDescriptor           → FIRE (high-priority shortcut: "hammy cooked")
 *   isInjury=false                                → no fire (LLM handles; body-part alone NO LONGER fires)
 *   isInjury + hasLocation                        → FIRE → SEVERITY_QUESTION
 *   isInjury + !hasLocation, prior assistant asked severity → no fire (loop-safety)
 *   isInjury + !hasLocation                       → FIRE → SEVERITY_QUESTION (severity-first default)
 */

export const SEVERITY_QUESTION = 'How bad is it? Rough pain out of 10.';

// Tokens that mark a message as injury context. Word-boundary matched against
// the NORMALIZED haystack (see normalizeText). The gate is OR-based (keyword
// OR body part), so we don't chase every conjugation: "my hammy hurts" fires
// via the body-part branch even though "hurts" isn't on the list.
export const INJURY_KEYWORDS: readonly string[] = [
  'hurt',
  'hurts', // 3rd-person singular: "my hammy hurts"
  'injured',
  'injury',
  'tweak',
  'tweaked',
  'strain',
  'strained',
  'pull',
  'pulled',
  'tight',
  'tightness',
  'sore',
  'niggle',
  'twinge',
  'pinged', // slang: "hammy pinged"
];

// Misspelling / slang variants → canonical spellings.
// Applied before keyword & body-part detection so athletes don't need perfect
// typing. The map is intentionally narrow — list common variants only, not
// every possible typo.
export const BODY_PART_NORMALIZATION: Readonly<Record<string, string>> = {
  hammie: 'hammy',
  hammys: 'hammy',
  hamy: 'hammy',
  hamie: 'hammy',
  hamstrng: 'hamstring',
  hammstring: 'hamstring',
  sholder: 'shoulder',
  sholders: 'shoulders',
  shouder: 'shoulder',
  ankel: 'ankle',
  ankels: 'ankles',
  achelies: 'achilles',
  achillies: 'achilles',
  achiles: 'achilles',
  calve: 'calf', // singular "calve" not standard English; treat as calf
  grain: 'groin', // common typo
  qaud: 'quad',
  qauds: 'quads',
};

export const KEYWORD_NORMALIZATION: Readonly<Record<string, string>> = {
  tweek: 'tweak',
  tweeked: 'tweaked',
  tweeking: 'tweak',
  injuried: 'injured',
  injured_: 'injured',
};

// Phrase patterns that indicate injury intent without a single-token keyword.
// E.g. "felt something go in my leg" — no kw, no body part in our list, but
// clearly an injury report. These match against the ORIGINAL text (not
// normalized) for case/punctuation flexibility.
export const INJURY_PHRASE_PATTERNS: readonly RegExp[] = [
  /\bfelt (?:it|something|that|it all) go\b/i,
  /\bfelt (?:it|something|that) (?:pop|snap|tear|give|crack)\b/i,
  /\bsomething (?:popped|snapped|tore|gave way|cracked)\b/i,
  /\bgone in my\b/i, // "something's gone in my back"
];

// Negative descriptors paired with a body part trigger the high-priority
// shortcut: "hammy cooked", "shoulder feels off", "calf is gone". This branch
// is what catches normal athlete language without an explicit injury keyword.
// Matched word-boundary against the NORMALIZED haystack (so "Hammy COOKED"
// works and misspellings like "sholder" route through normalization first).
//
// Calibration: words here are strongly injury-coded when paired with a body
// part. Generic words like "off"/"bad"/"fine" are intentionally OUT of the
// single-word list (they false-fire too easily) — "off" is captured only via
// the multi-word pattern "feels off".
export const NEGATIVE_DESCRIPTORS: readonly string[] = [
  'cooked',
  'sore',
  'tight',
  'hurt',
  'hurts',
  'hurting',
  'tweak',
  'tweaked',
  'niggle',
  'twinge',
  'pinged',
  'pulled',
  'strained',
  'ache',
  'aching',
  'gone',
  'grabbed',
  'went',
  'pain',
  'painful',
  'stiff',
];

// Multi-word descriptors that signal "something is wrong with this body part".
// Matched against the ORIGINAL text (not normalized) since they don't depend
// on body-part spelling.
export const NEGATIVE_DESCRIPTOR_PATTERNS: readonly RegExp[] = [
  /\bfeels off\b/i,
  /\bnot right\b/i,
  /\bfeels weird\b/i,
  /\blocked up\b/i,
  /\bplaying up\b/i,
];

// Body-part vocabulary that counts as "location is known". Word-boundary matched.
// Ordered with multi-word entries first so the regex doesn't snag the suffix
// (e.g. "lower back" before "back").
export const BODY_PARTS: readonly string[] = [
  'lower back', 'upper back',
  'hamstring', 'hamstrings', 'hammy', 'hammies',
  'shoulder', 'shoulders',
  'knee', 'knees',
  'back',
  'groin',
  'quad', 'quads', 'quadricep', 'quadriceps',
  'calf', 'calves',
  'ankle', 'ankles',
  'hip', 'hips',
  'neck',
  'glute', 'glutes',
  'achilles',
  'elbow', 'elbows',
  'wrist', 'wrists',
  'foot', 'feet',
  'forearm', 'forearms',
  'bicep', 'biceps',
  'tricep', 'triceps',
  'pec', 'pecs', 'chest',
];

// Severity signals. Order doesn't matter — any match means "severity is known".
export const SEVERITY_PATTERNS: readonly RegExp[] = [
  // Numeric: "7", "8/10", "5 out of 10", "pain is a 6"
  /\b(?:[1-9]|10)\s*(?:\/\s*10|out of 10)\b/i,
  /\b(?:pain|sore|hurt|hurts).{0,20}\b(?:[1-9]|10)\b/i,
  /\b(?:[1-9]|10)\s*\/\s*10\b/,
  // Severe-end qualitative phrases
  /\b(?:really bad|very bad|severe|sharp pain|stabbing|excruciating|killing me|agony|can'?t walk|cannot walk|can'?t move|cannot move|barely walk|barely move)\b/i,
  // Mild-end qualitative phrases (still counts — we know roughly how bad)
  /\b(?:mild|minor|slight|barely (?:notice|hurts|sore)|just a bit|a little tight|a bit tight)\b/i,
];

export interface InjurySignals {
  isInjury: boolean;
  hasLocation: boolean;
  hasSeverity: boolean;
  hasNegativeDescriptor: boolean;
}

/**
 * Apply misspelling/slang normalization so detection doesn't depend on perfect
 * spelling. Returns lowercased text with body-part and keyword variants
 * replaced by their canonical forms.
 */
export function normalizeText(text: string): string {
  let out = text.toLowerCase();
  for (const [variant, canonical] of Object.entries(BODY_PART_NORMALIZATION)) {
    out = out.replace(
      new RegExp(`\\b${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
      canonical,
    );
  }
  for (const [variant, canonical] of Object.entries(KEYWORD_NORMALIZATION)) {
    out = out.replace(
      new RegExp(`\\b${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
      canonical,
    );
  }
  return out;
}

/**
 * Lightweight signal extraction over a single user message.
 *
 * isInjury is true if EITHER an injury keyword OR an injury phrase pattern
 * matches (after normalization). hasLocation is true if a body part is
 * named (with normalization). hasSeverity uses the unnormalized text since
 * patterns rely on numbers and punctuation.
 */
export function detectInjurySignals(text: string): InjurySignals {
  if (!text || typeof text !== 'string') {
    return {
      isInjury: false,
      hasLocation: false,
      hasSeverity: false,
      hasNegativeDescriptor: false,
    };
  }
  const normalized = normalizeText(text);
  const hasKeyword = INJURY_KEYWORDS.some((kw) => wordMatch(normalized, kw));
  const hasPhrase = INJURY_PHRASE_PATTERNS.some((re) => re.test(text));
  const isInjury = hasKeyword || hasPhrase;
  const hasLocation = BODY_PARTS.some((p) => wordMatch(normalized, p));
  const hasSeverity = SEVERITY_PATTERNS.some((re) => re.test(text));
  const hasNegativeDescriptor =
    NEGATIVE_DESCRIPTORS.some((d) => wordMatch(normalized, d)) ||
    NEGATIVE_DESCRIPTOR_PATTERNS.some((re) => re.test(text));
  return { isInjury, hasLocation, hasSeverity, hasNegativeDescriptor };
}

function wordMatch(haystack: string, needle: string): boolean {
  // Word boundary on both sides; needle is already lower-case.
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(haystack);
}

export interface ClarificationGuardResult {
  fired: boolean;
  reply?: string;
  reason: string;
  signals?: InjurySignals;
}

export interface GuardMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Returns `{ fired: true, reply: SEVERITY_QUESTION }` when the guard should
 * short-circuit the LLM. Returns `{ fired: false }` otherwise — the caller
 * should then proceed with the normal LLM call.
 *
 * Decision is anchored on the LATEST user message only. The thread history
 * is consulted only for narrow loop-safety on the both-missing branch.
 *
 * Loop-safety rule (revised):
 *   - If the latest user message names a body part (fresh injury context),
 *     ALWAYS fire (assuming severity missing). Each new body-part mention is
 *     treated as a new injury report — never suppressed by prior history.
 *     Example: prior turn asked severity for the hammy, athlete then says
 *     "Tweaked my shoulder" → fire severity question for the shoulder.
 *   - Loop-safety only applies to the both-missing branch ("I'm sore" with
 *     no body part), where the message could plausibly be a reply to the
 *     prior clarifier. In that narrow case only, suppress to avoid loops.
 */
export function checkInjuryClarificationGuard(
  messages: GuardMessage[] | undefined | null,
): ClarificationGuardResult {
  if (!messages || messages.length === 0) {
    return { fired: false, reason: 'no messages' };
  }
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user' || typeof last.content !== 'string') {
    return { fired: false, reason: 'last turn is not a user message' };
  }

  const signals = detectInjurySignals(last.content);

  // 1. Severity already provided → proceed to LLM (it'll do program
  //    adjustment or ask for location if missing). Severity check ALWAYS
  //    runs first so a severity-bearing follow-up always passes through.
  if (signals.hasSeverity) {
    return {
      fired: false,
      reason: 'severity already provided in user message',
      signals,
    };
  }

  // 2. HIGH-PRIORITY SHORTCUT: body part + negative descriptor → FIRE.
  //    Catches normal athlete language without an explicit injury keyword:
  //    "hammy cooked", "shoulder feels off", "calf is gone", "groin pinged".
  //    This runs BEFORE the keyword/phrase gate so a body+descriptor message
  //    never needs an INJURY_KEYWORD match to trigger. Loop-safety is
  //    intentionally skipped: each fresh body+descriptor pair is a new
  //    injury report.
  if (signals.hasLocation && signals.hasNegativeDescriptor) {
    return {
      fired: true,
      reply: SEVERITY_QUESTION,
      reason:
        'body part + negative descriptor → ask severity (high-priority shortcut)',
      signals,
    };
  }

  // 3. Gate: from here on we require an injury keyword or phrase pattern.
  //    Body-part alone NO LONGER fires (was a false-positive vector:
  //    "rolled out my hammy", "calves are fine", "back squats today").
  if (!signals.isInjury) {
    return {
      fired: false,
      reason:
        'no injury keyword/phrase detected (body-part alone or descriptor alone is not enough)',
      signals,
    };
  }

  // 4. Injury kw/phrase + body part → FIRE. Each new body-part mention is
  //    a fresh injury report; never suppressed by prior history (so
  //    "Tweaked my shoulder" after a prior hammy clarifier still fires for
  //    the shoulder).
  if (signals.hasLocation) {
    return {
      fired: true,
      reply: SEVERITY_QUESTION,
      reason:
        'injury kw/phrase + location, severity missing → ask severity (fresh body part)',
      signals,
    };
  }

  // 5. Injury kw/phrase, no body part → severity-first default with
  //    loop-safety. If the most recent assistant turn already asked a
  //    clarifier, the current message is likely a reply to it ("I'm sore",
  //    "yeah", etc.). Fall through to the LLM rather than re-asking.
  for (let i = messages.length - 2; i >= 0; i--) {
    const m = messages[i];
    if (!m || m.role !== 'assistant' || typeof m.content !== 'string') continue;
    if (
      /how bad is it.{0,40}(rough )?pain out of 10/i.test(m.content) ||
      /\bwhere\s+(?:is\s+it|exactly|are\s+you\s+sore)\b/i.test(m.content) ||
      /pain.{0,20}out of 10/i.test(m.content)
    ) {
      return {
        fired: false,
        reason:
          'kw/phrase but no body part AND prior assistant already asked a clarifier — let LLM interpret reply',
        signals,
      };
    }
    break; // Only inspect the most recent assistant turn.
  }

  return {
    fired: true,
    reply: SEVERITY_QUESTION,
    reason: 'injury kw/phrase, no body part, no severity → severity-first default',
    signals,
  };
}
