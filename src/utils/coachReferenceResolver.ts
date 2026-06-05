/**
 * coachReferenceResolver.ts — deterministic anchor for "it" / "that
 * session" / "the row" / pronouns inside coach messages.
 *
 * THE PROBLEM
 *
 * "Can you change it to a bike instead of a row?" — without a stored
 * target there is no way to know what "it" refers to. The legacy
 * fallback used to guess (and answered the wrong session). The fix is
 * Phase 2: durable coach context state + this deterministic resolver.
 *
 *   explicit day  →  beats everything
 *   modality ref  →  prefer last-discussed, then scan visible week
 *   pronoun       →  bind to last-discussed if recent
 *   nothing       →  ambiguous → caller asks a clarifier
 *
 * Stays presentation-pure: returns a date + session name + reason
 * code. Does NOT mutate the program. Does NOT call into the LLM.
 *
 * USAGE
 *
 * CoachScreen builds its context packet, then calls this resolver
 * with the visible week + the coachContextStateStore snapshot. The
 * resolver attaches its outcome to the packet so the dispatcher and
 * (later) the truth gate can decide whether to apply, propose, or
 * ask for clarification.
 *
 * TESTABILITY
 *
 * All inputs are explicit — no store reads inside the resolver. The
 * `now` arg lets tests pin the clock so TTL checks behave
 * deterministically.
 */

import type { ResolvedDay } from './sessionResolver';
import type { CoachContextEntry, CoachContextSource } from '../store/coachContextStateStore';
import { COACH_CONTEXT_TTL_MS } from '../store/coachContextStateStore';
import { canonicalSessionKeyCandidates } from '../store/coachPreferencesStore';
import { logger } from './logger';

// ─── Public types ───────────────────────────────────────────────────

export type CoachReferenceStatus =
  | 'resolved'           // unambiguous target identified
  | 'ambiguous'          // multiple equally-good candidates — ask clarifier
  | 'no_target'          // pronoun used with no anchor — ask clarifier
  | 'expired'            // last-discussed entry is past TTL — ask clarifier
  | 'no_reference';      // user message contains no day/pronoun/modality cue

export type CoachReferenceMethod =
  | 'explicit_day'         // "Monday", "Wednesday", "tomorrow"
  | 'modality_match'       // "the row", "the bike"
  | 'pronoun_last_discussed'
  | 'pronoun_last_opened'
  | 'pronoun_last_explained'
  | 'implicit_recent_context'        // mutation-like turn with no explicit cue but
                                     // a single fresh recent target on file
  | 'implicit_recent_session_family' // multiple fresh recent contexts on different
                                     // dates that all share the same canonical
                                     // session-family key (e.g. two "Easy Aerobic
                                     // Flush" instances). Used by recurring /
                                     // permanent-pref ops where the family — not
                                     // the specific date — is what matters.
  | 'no_match';

export interface CoachReferenceTarget {
  /** ISO YYYY-MM-DD. */
  date: string;
  /** Athlete-facing session label. */
  sessionName: string;
  /** Where the binding came from — for logs / UI debug. */
  method: CoachReferenceMethod;
  /** Source of the underlying context entry (when applicable). */
  contextSource?: CoachContextSource;
}

export interface CoachReferenceResolution {
  status: CoachReferenceStatus;
  /** The bound target, populated when status === 'resolved'. */
  target: CoachReferenceTarget | null;
  /** 0..1 — only meaningful when resolved. */
  confidence: number;
  /** Machine-readable reason for non-resolution. */
  failureReason?:
    | 'no_explicit_day_or_pronoun'
    | 'pronoun_no_context'
    | 'pronoun_context_expired'
    | 'modality_no_match'
    | 'modality_multiple_matches'
    | 'explicit_day_outside_visible_week'
    | 'explicit_day_no_workout';
  /** Candidate matches (e.g. multiple sessions match "the row"). */
  candidates?: CoachReferenceTarget[];
  /**
   * Suggested clarifier — when the caller wants to ask the athlete
   * "do you mean Wednesday's Easy Aerobic Flush?" we synthesise a
   * specific question. Empty string when status === 'resolved'.
   */
  clarifierQuestion?: string;
  /**
   * True when the user's message uses mutation language (change,
   * swap, remove, etc.). The coach pipeline uses this as the truth
   * gate — mutation-like requests must NOT escape into legacy text
   * fallback even if the resolver returns no_reference.
   */
  isMutationLike: boolean;
}

export interface ResolveReferenceInput {
  userMessage: string;
  todayISO: string;
  /** Resolved current-week days from the visible projection. */
  currentWeek: ResolvedDay[];
  /** Optional next week — explicit "next Monday" support (best-effort). */
  nextWeek?: ResolvedDay[];
  lastOpenedWorkout: CoachContextEntry | null;
  lastExplainedSession: CoachContextEntry | null;
  lastDiscussedWorkout: CoachContextEntry | null;
  /** ms since epoch — defaults to Date.now() in production. */
  now?: number;
}

// ─── Constants ──────────────────────────────────────────────────────

/**
 * Pronouns that implicitly reference the last-discussed session.
 * Anchored on word boundaries to avoid false hits in "fit", "fits".
 */
const PRONOUN_PATTERNS: RegExp[] = [
  /\bit\b/i,
  /\bthat\s+(session|workout|day|one)\b/i,
  /\bthis\s+(session|workout|day|one)\b/i,
  /\bthe\s+session\b/i,
  /\bthe\s+workout\b/i,
  /\bthere\b/i,
];

/**
 * Mutation-like verbs / phrasing. The truth gate uses this so
 * "can you change it" never falls through to a legacy text reply.
 *
 * COVERAGE PRINCIPLE — the patterns below are deliberately broad, on
 * the theory that any false positive is a clarifier ("Which session do
 * you mean?") while any false negative leaks a mutation request into
 * the legacy text fallback that has no tools to honour it.
 *
 *   • Action verbs in present + past + imperative + gerund forms
 *     (change/changed/changing/can you change/please change …).
 *   • Preference-shaped phrasing without a verb
 *     ("I just want a bike", "use the bike instead", "prefer rowing",
 *     "actually a bike, not a rower").
 *   • Correction-shaped phrasing
 *     ("you changed it to assault bike", "not assault bike, regular",
 *     "actually make that …").
 *   • Modality-subtype callouts that always indicate a coach correction
 *     ("regular bike", "standard bike", "stationary bike",
 *     "assault bike").
 *   • Undo / revert language.
 */
const MUTATION_PATTERNS: RegExp[] = [
  // ─── Active-verb action requests ───
  // Match the verb + optional ed/ing/s suffixes so "change/changed/changing/changes" all count.
  /\bchang(?:e|ed|es|ing)\b/i,
  /\bswap(?:p?ed|p?ing|s)?\b/i,
  /\breplac(?:e|ed|es|ing)\b/i,
  /\bremov(?:e|ed|es|ing)\b/i,
  /\bdrop(?:p?ed|p?ing|s)?\b/i,
  /\badd(?:ed|ing|s)?\b/i,
  /\bmov(?:e|ed|es|ing)\b/i,
  /\bswitch(?:ed|ing|es)?\b/i,
  /\bsubstitut(?:e|ed|es|ing)\b/i,
  /\bskip(?:p?ed|p?ing|s)?\b/i,
  /\bcancel(?:l?ed|l?ing|s)?\b/i,

  // ─── Imperative phrasing ───
  /\bturn\s+(?:it|that|this)\b/i,
  /\bmake\s+(?:it|that|this)\b/i,
  /\bset\s+(?:it|that|this)\b/i,

  // ─── Preference / want phrasing (verbless mutations) ───
  /\bi\s+(?:just\s+)?want\b/i,
  /\bi(?:'?d|\s+would)\s+(?:like|prefer|rather)\b/i,
  /\bi(?:'?ll|\s+will)\s+(?:do|use|take)\b/i,
  /\bi\s+prefer\b/i,
  /\bplease\s+(?:use|do|make|change|swap|set)\b/i,
  /\buse\s+(?:a|the|an)\b.*\b(?:bike|rower|row|ski|run|treadmill|erg|spin)\b/i,

  // ─── "Instead", "rather than", "not X but Y" ───
  /\binstead\s+of\b/i,
  /\brather\s+than\b/i,
  /\bnot\s+(?:a|an|the)?\s*\w+.*\b(?:but|but\s+a|but\s+an|but\s+the)\b/i,

  // ─── Correction prefixes ("actually", "no actually", "wait") ───
  /\bactually\s+(?:a|an|the|i|make|use|do|change|swap)\b/i,
  /\b(?:wait|no)\s*,?\s*(?:i|make|use|change|that\s+should)\b/i,

  // ─── Subtype callouts that always imply correction ───
  /\b(?:assault|airdyne|echo|air|exercise|stationary|standard|regular|normal|spin)\s+bike\b/i,
  /\b(?:concept|c2|rowing)\s+(?:erg|rower)\b/i,
  /\b(?:ski|skierg|airrunner|curved)\b/i,

  // ─── Undo / revert ───
  /\bundo\b/i,
  /\brevert\b/i,
  /\bgo\s+back\b/i,
  /\b(?:put|change|switch)\s+(?:it\s+|that\s+|this\s+)?back\b/i,

  // ─── "Can you …" / "Could we …" wrappers around any action verb ───
  /\bcan\s+(?:we|you|i)\b.*\b(?:chang|swap|remov|mov|add|drop|switch|use|make|set|put|skip|cancel|substitut|replac)/i,
  /\bcould\s+(?:we|you|i)\b.*\b(?:chang|swap|remov|mov|add|drop|switch|use|make|set|put|skip|cancel|substitut|replac)/i,
];

/** Day-of-week names → 0..6 (Sun..Sat). */
const DOW_BY_NAME: Record<string, number> = {
  sun: 0, sunday: 0, sundays: 0,
  mon: 1, monday: 1, mondays: 1,
  tue: 2, tues: 2, tuesday: 2, tuesdays: 2,
  wed: 3, weds: 3, wednesday: 3, wednesdays: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, thursdays: 4,
  fri: 5, friday: 5, fridays: 5,
  sat: 6, saturday: 6, saturdays: 6,
};

/**
 * Modality tokens we'll recognise inside a session name / coach reply.
 * Used both to STAMP entries when written and to MATCH "the row" /
 * "the bike" / "the run" references on read.
 */
const MODALITY_TOKENS = [
  'rower', 'row', 'rowing',
  'bike', 'cycling', 'cycle', 'spin',
  'run', 'running', 'runs', 'jog',
  'sprint', 'sprints',
  'ski', 'skierg',
  'swim',
  'sled',
  'tempo',
] as const;

const MODALITY_ALIAS_GROUPS: string[][] = [
  ['rower', 'row', 'rowing'],
  ['bike', 'cycling', 'cycle', 'spin'],
  ['run', 'running', 'runs', 'jog'],
  ['sprint', 'sprints'],
  ['ski', 'skierg'],
];

// ─── Public helpers ─────────────────────────────────────────────────

/**
 * True when the message uses change/swap/remove/etc. language. Stable
 * enough that the truth gate can rely on it: if isMutationLike() is
 * true and no deterministic route handles the turn, the coach must
 * fail closed instead of relaying legacy text.
 */
export function isMutationLike(message: string): boolean {
  if (!message) return false;
  for (const r of MUTATION_PATTERNS) {
    if (r.test(message)) return true;
  }
  return false;
}

/**
 * Pull modality tokens out of a session name + exercise list. Used by
 * the writer side (DayWorkoutScreen mount, coach explanation reply)
 * so the stored entry can answer "the row" without re-reading the
 * Workout body.
 */
export function extractModalitiesFromSession(input: {
  name?: string;
  exercises?: Array<{ exercise?: { name?: string } | null } | null>;
}): string[] {
  const tokens: string[] = [];
  const tap = (text: string | undefined | null) => {
    if (!text) return;
    const lower = text.toLowerCase();
    for (const t of MODALITY_TOKENS) {
      const re = new RegExp(`\\b${t}\\b`, 'i');
      if (re.test(lower)) tokens.push(t);
    }
  };
  tap(input.name);
  for (const ex of input.exercises ?? []) {
    tap(ex?.exercise?.name);
  }
  return Array.from(new Set(tokens.map((t) => t.toLowerCase())));
}

// ─── Resolver core ──────────────────────────────────────────────────

/**
 * Resolve the user's reference to a concrete date + session, OR
 * return a clear non-resolution outcome the caller can act on.
 *
 * The order of operations is deliberate:
 *
 *   1. Explicit day name in the message wins.
 *   2. Modality reference ("the row") — prefer last-discussed,
 *      else scan the visible week.
 *   3. Pronoun ("it" / "that session") — bind to last-discussed
 *      if recent; expired → clarifier.
 *   4. Otherwise no_reference.
 */
export function resolveCoachReference(
  input: ResolveReferenceInput,
): CoachReferenceResolution {
  const now = input.now ?? Date.now();
  const message = (input.userMessage ?? '').trim();
  const isMutation = isMutationLike(message);
  const deicticDay = matchDeicticWeekdayReference(message);
  const lastDiscussedForDeictic = freshOrNull(input.lastDiscussedWorkout, now);
  if (
    deicticDay != null &&
    lastDiscussedForDeictic &&
    isoDow(lastDiscussedForDeictic.date) === deicticDay
  ) {
    return logResolution(input, message, isMutation, {
      status: 'resolved',
      target: {
        date: lastDiscussedForDeictic.date,
        sessionName: lastDiscussedForDeictic.sessionName,
        method: 'pronoun_last_discussed',
        contextSource: lastDiscussedForDeictic.source,
      },
      confidence: 0.86,
      isMutationLike: isMutation,
    });
  }

  // ─── 1. Explicit day name beats everything ───
  const explicit = matchExplicitDay(message, input.currentWeek, input.nextWeek, {
    todayISO: input.todayISO,
    isMutationLike: isMutation,
  });
  if (explicit.matched) {
    if (explicit.target) {
      return logResolution(input, message, isMutation, {
        status: 'resolved',
        target: explicit.target,
        confidence: 0.95,
        isMutationLike: isMutation,
      });
    }
    return logResolution(input, message, isMutation, {
      status: 'ambiguous',
      target: null,
      confidence: 0,
      failureReason: explicit.failureReason,
      clarifierQuestion: explicit.clarifierQuestion,
      isMutationLike: isMutation,
    });
  }

  // ─── 2. Modality reference ───
  const modalityTokens = extractModalityTokensFromMessage(message);
  if (modalityTokens.length > 0 && !isAddConditioningPayloadMessage(message)) {
    const modalityRes = matchByModality({
      tokens: modalityTokens,
      currentWeek: input.currentWeek,
      lastDiscussed: freshOrNull(input.lastDiscussedWorkout, now),
      lastOpened: freshOrNull(input.lastOpenedWorkout, now),
      lastExplained: freshOrNull(input.lastExplainedSession, now),
    });
    if (modalityRes.status === 'resolved' && modalityRes.target) {
      return logResolution(input, message, isMutation, {
        status: 'resolved',
        target: modalityRes.target,
        confidence: modalityRes.confidence ?? 0.85,
        isMutationLike: isMutation,
      });
    }
    if (modalityRes.status === 'ambiguous') {
      return logResolution(input, message, isMutation, {
        status: 'ambiguous',
        target: null,
        candidates: modalityRes.candidates,
        confidence: 0,
        failureReason: 'modality_multiple_matches',
        clarifierQuestion: modalityRes.clarifierQuestion,
        isMutationLike: isMutation,
      });
    }
    // modality referenced but no week match — fall through to pronoun
    // logic since "change the row" with no row in the week should not
    // silently resolve. We return no_target with a tailored failure.
    return logResolution(input, message, isMutation, {
      status: 'no_target',
      target: null,
      confidence: 0,
      failureReason: 'modality_no_match',
      clarifierQuestion:
        `I don't see a ${modalityTokens[0]} in this week's program. ` +
        `Which session do you mean?`,
      isMutationLike: isMutation,
    });
  }

  // ─── 3. Pronoun reference ───
  if (containsPronoun(message)) {
    const lastDiscussed = input.lastDiscussedWorkout;
    if (!lastDiscussed) {
      return logResolution(input, message, isMutation, {
        status: 'no_target',
        target: null,
        confidence: 0,
        failureReason: 'pronoun_no_context',
        clarifierQuestion: 'Which session do you mean?',
        isMutationLike: isMutation,
      });
    }
    if (now - lastDiscussed.updatedAt > COACH_CONTEXT_TTL_MS) {
      return logResolution(input, message, isMutation, {
        status: 'expired',
        target: null,
        confidence: 0,
        failureReason: 'pronoun_context_expired',
        clarifierQuestion: 'Which session do you mean?',
        isMutationLike: isMutation,
      });
    }
    const method: CoachReferenceMethod =
      lastDiscussed === input.lastExplainedSession
        ? 'pronoun_last_explained'
        : lastDiscussed === input.lastOpenedWorkout
          ? 'pronoun_last_opened'
          : 'pronoun_last_discussed';
    return logResolution(input, message, isMutation, {
      status: 'resolved',
      target: {
        date: lastDiscussed.date,
        sessionName: lastDiscussed.sessionName,
        method,
        contextSource: lastDiscussed.source,
      },
      confidence: 0.8,
      isMutationLike: isMutation,
    });
  }

  // ─── 4. Implicit recent-context binding ───
  // Mutation-like message with NO explicit day, NO modality, NO pronoun
  // can still bind to a freshly-discussed session.
  //
  //   Coach (just now): "I put the Wednesday Easy Aerobic Flush there to…"
  //   Athlete:          "Can you change to a bike?"
  //
  // Forcing a clarifier here is hostile — there's exactly one obvious
  // recent target. We bind it with method 'implicit_recent_context' so
  // logs and tests can tell this apart from a hard pronoun match.
  //
  // Guard rails:
  //   * Only fires when the message looks mutation-shaped — pure
  //     conversation never silently inherits a target this way.
  //   * Requires a fresh `lastDiscussedWorkout` (TTL-filtered).
  //   * If both lastExplained and lastOpened are fresh and point to
  //     DIFFERENT dates, we refuse (ambiguous) — better to ask.
  //   * Confidence is capped at 0.7 so the executor can decide whether
  //     the operation is compatible (e.g. modality swap onto a session
  //     with no conditioning will fail naturally in the engine).
  if (isMutation) {
    const lastDiscussed = freshOrNull(input.lastDiscussedWorkout, now);
    const lastExplained = freshOrNull(input.lastExplainedSession, now);
    const lastOpened = freshOrNull(input.lastOpenedWorkout, now);
    const recentDates = new Set<string>();
    for (const e of [lastDiscussed, lastExplained, lastOpened]) {
      if (e) recentDates.add(e.date);
    }
    if (lastDiscussed && recentDates.size === 1) {
      const method: CoachReferenceMethod = 'implicit_recent_context';
      return logResolution(input, message, isMutation, {
        status: 'resolved',
        target: {
          date: lastDiscussed.date,
          sessionName: lastDiscussed.sessionName,
          method,
          contextSource: lastDiscussed.source,
        },
        confidence: 0.7,
        isMutationLike: isMutation,
      });
    }
    if (recentDates.size > 1) {
      // Multiple fresh contexts on different dates. If they all share a
      // canonical session-family key (e.g. last week's Easy Aerobic Flush
      // and this week's Easy Aerobic Flush), we collapse to one target —
      // the future-most date wins. This is the right answer for recurring
      // preference ops where the family — not the specific date — is what
      // the athlete actually means.
      const familyTarget = collapseSameSessionFamily([
        lastDiscussed,
        lastExplained,
        lastOpened,
      ], input.todayISO);
      // Phase G runtime audit — surface the collapse decision (or its
      // refusal) so live logs prove whether the canonical-family branch
      // ran at all and which entries it considered. Without this, an
      // 'ambiguous' status is opaque about whether the new code path
      // even executed. Sam's spec.
      logger.debug('[coach-family-collapse]', {
        decision: familyTarget ? 'collapsed' : 'no_shared_family',
        candidateNames: [lastDiscussed, lastExplained, lastOpened]
          .filter((e): e is CoachContextEntry => e != null)
          .map((e) => e.sessionName ?? null),
        candidateDates: [lastDiscussed, lastExplained, lastOpened]
          .filter((e): e is CoachContextEntry => e != null)
          .map((e) => e.date),
        chosen: familyTarget
          ? { date: familyTarget.date, sessionName: familyTarget.sessionName }
          : null,
      });
      if (familyTarget) {
        return logResolution(input, message, isMutation, {
          status: 'resolved',
          target: familyTarget,
          confidence: 0.75,
          isMutationLike: isMutation,
        });
      }
      // Genuinely different sessions on different dates — clarifier.
      return logResolution(input, message, isMutation, {
        status: 'ambiguous',
        target: null,
        confidence: 0,
        failureReason: 'no_explicit_day_or_pronoun',
        clarifierQuestion: 'Which session do you mean?',
        isMutationLike: isMutation,
      });
    }
  }

  // ─── 5. No reference at all ───
  return logResolution(input, message, isMutation, {
    status: 'no_reference',
    target: null,
    confidence: 0,
    failureReason: 'no_explicit_day_or_pronoun',
    isMutationLike: isMutation,
  });
}

// ─── Private helpers ────────────────────────────────────────────────

function isAddConditioningPayloadMessage(message: string): boolean {
  if (!message) return false;
  const hasAddVerb =
    /\b(?:add|include|chuck|throw\s+in|put\s+in|slot\s+in|tack\s+on|add\s+on)\b/i.test(message);
  if (!hasAddVerb) return false;
  const hasConditioningPayload =
    /\b(?:bike|row|rower|rowing|run|running|jog|ski\s*erg|skierg|ski|swim|swimming|cardio|conditioning|aerobic|sprints?|intervals?|walks?|walking|pilates|yoga|mobility)\b/i.test(message);
  if (!hasConditioningPayload) return false;
  return (
    containsPronoun(message) ||
    /\b(?:on|onto|to|for|into)\s+(?:today|tomorrow|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday|s)?|thu(?:rs(?:day)?|r)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|this\s+day|that\s+day|this\s+session|that\s+session|the\s+session|the\s+workout)\b/i.test(message)
  );
}

function matchDeicticWeekdayReference(message: string): number | null {
  const lower = String(message ?? '').toLowerCase();
  const m =
    /\b(?:that|this)\s+(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday|s)?|thu(?:rs(?:day)?|r)?|fri(?:day)?|sat(?:urday)?)\b/i.exec(lower);
  if (!m) return null;
  return DOW_BY_NAME[m[1]] ?? null;
}

function isoDow(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
}

function freshOrNull(
  entry: CoachContextEntry | null,
  now: number,
): CoachContextEntry | null {
  if (!entry) return null;
  if (now - entry.updatedAt > COACH_CONTEXT_TTL_MS) return null;
  return entry;
}

/**
 * Return a single canonical-family target when ALL provided context
 * entries share a canonical session-family key (per
 * `canonicalSessionKeyCandidates`). The future-most date wins (or, when
 * none are in the future relative to `todayISO`, the most-recently-updated).
 *
 * Returns null when:
 *   • Fewer than two distinct fresh entries are provided.
 *   • Entries don't share a common canonical key.
 *
 * USED BY: the implicit-recent-binding fallback, so that "this week's
 * Easy Aerobic Flush" and "last week's Easy Aerobic Flush" collapse to
 * one target for recurring / permanent preference ops instead of
 * forcing an unnecessary clarifier.
 */
function collapseSameSessionFamily(
  entries: Array<CoachContextEntry | null>,
  todayISO: string,
): CoachReferenceTarget | null {
  const fresh = entries.filter(
    (e): e is CoachContextEntry => e != null,
  );
  if (fresh.length < 2) return null;

  // Compute canonical-key candidate sets for each entry; the family is
  // the intersection (any shared key counts as the same family).
  const keySets = fresh.map((e) =>
    new Set(canonicalSessionKeyCandidates(e.sessionName ?? '')),
  );
  // Intersect: a family key must exist in every entry's candidate set.
  const sharedKeys: string[] = [];
  for (const k of keySets[0]) {
    if (!k) continue;
    if (keySets.every((s) => s.has(k))) sharedKeys.push(k);
  }
  if (sharedKeys.length === 0) return null;

  // Prefer the future-most entry (date >= todayISO). Fallback: latest
  // updatedAt.
  const futureEntries = fresh.filter((e) => e.date >= todayISO);
  const pool = futureEntries.length > 0 ? futureEntries : fresh;
  // Pick latest date within the pool.
  let pick = pool[0];
  for (const e of pool) {
    if (e.date > pick.date) pick = e;
    else if (e.date === pick.date && e.updatedAt > pick.updatedAt) pick = e;
  }
  return {
    date: pick.date,
    sessionName: pick.sessionName,
    method: 'implicit_recent_session_family',
    contextSource: pick.source,
  };
}

function containsPronoun(message: string): boolean {
  return PRONOUN_PATTERNS.some((r) => r.test(message));
}

function extractModalityTokensFromMessage(message: string): string[] {
  if (!message) return [];
  const lower = message.toLowerCase();
  // We only count modality tokens that follow "the " or are bare
  // tokens — "change the row" hits, but "I felt rowed under" doesn't.
  const tokens: string[] = [];
  for (const t of MODALITY_TOKENS) {
    const re = new RegExp(`\\bthe\\s+${t}\\b|\\b${t}\\s+session\\b|\\b${t}\\s+workout\\b`, 'i');
    if (re.test(lower)) tokens.push(t);
  }
  return Array.from(new Set(tokens.map((s) => s.toLowerCase())));
}

function modalityAliasSet(token: string): Set<string> {
  const normalised = token.toLowerCase();
  for (const group of MODALITY_ALIAS_GROUPS) {
    if (group.includes(normalised)) return new Set(group);
  }
  return new Set([normalised]);
}

function entryHasModality(
  entry: CoachContextEntry | null | undefined,
  token: string,
): boolean {
  if (!entry) return false;
  const aliases = modalityAliasSet(token);
  if ((entry.modalities ?? []).some((m) => aliases.has(m))) return true;
  // Defensive: if modalities weren't stamped, fall back to name scan.
  const name = (entry.sessionName ?? '').toLowerCase();
  for (const a of aliases) {
    if (new RegExp(`\\b${a}\\b`, 'i').test(name)) return true;
  }
  return false;
}

function dayHasModality(day: ResolvedDay, token: string): boolean {
  const w = day.workout;
  if (!w) return false;
  const aliases = modalityAliasSet(token);
  const checkText = (text: string | undefined | null): boolean => {
    if (!text) return false;
    const lower = text.toLowerCase();
    for (const a of aliases) {
      if (new RegExp(`\\b${a}\\b`, 'i').test(lower)) return true;
    }
    return false;
  };
  if (checkText(w.name)) return true;
  for (const ex of w.exercises ?? []) {
    if (checkText(ex.exercise?.name)) return true;
  }
  return false;
}

function matchByModality(args: {
  tokens: string[];
  currentWeek: ResolvedDay[];
  lastDiscussed: CoachContextEntry | null;
  lastOpened: CoachContextEntry | null;
  lastExplained: CoachContextEntry | null;
}): {
  status: 'resolved' | 'ambiguous' | 'no_match';
  target?: CoachReferenceTarget;
  candidates?: CoachReferenceTarget[];
  confidence?: number;
  clarifierQuestion?: string;
} {
  const token = args.tokens[0];

  // Prefer last-discussed entry when it matches the modality token —
  // that's where context continuity comes from.
  if (entryHasModality(args.lastDiscussed, token)) {
    const e = args.lastDiscussed!;
    return {
      status: 'resolved',
      target: {
        date: e.date,
        sessionName: e.sessionName,
        method: 'modality_match',
        contextSource: e.source,
      },
      confidence: 0.9,
    };
  }

  // Fall back to scanning the visible week for a session that
  // contains that modality.
  const matches: CoachReferenceTarget[] = [];
  for (const d of args.currentWeek) {
    if (!d.workout) continue;
    if (dayHasModality(d, token)) {
      matches.push({
        date: d.date,
        sessionName: d.workout.name ?? 'session',
        method: 'modality_match',
      });
    }
  }
  if (matches.length === 1) {
    return { status: 'resolved', target: matches[0], confidence: 0.85 };
  }
  if (matches.length > 1) {
    return {
      status: 'ambiguous',
      candidates: matches,
      clarifierQuestion: `I see multiple ${token} sessions this week. Which day?`,
    };
  }
  return { status: 'no_match' };
}

function matchExplicitDay(
  message: string,
  currentWeek: ResolvedDay[],
  nextWeek: ResolvedDay[] = [],
  opts?: { todayISO?: string; isMutationLike?: boolean },
): {
  matched: boolean;
  target?: CoachReferenceTarget;
  failureReason?: CoachReferenceResolution['failureReason'];
  clarifierQuestion?: string;
} {
  const lower = ` ${message.toLowerCase()} `;
  const isNext = /\bnext\s+(week|mon|tue|wed|thu|fri|sat|sun)/.test(lower);
  const isExplicitlyPast = /\blast\s+(week|mon|tue|wed|thu|fri|sat|sun)/.test(lower) ||
    /\bprevious\s+(mon|tue|wed|thu|fri|sat|sun)/.test(lower);

  // ─── "today" / "tomorrow" → resolve to day-of-week ─────────────
  const todayISO = opts?.todayISO;
  if (todayISO && /\btoday\b/i.test(lower)) {
    const todayDay = currentWeek.find((d) => d.date === todayISO);
    if (todayDay?.workout) {
      return {
        matched: true,
        target: {
          date: todayDay.date,
          sessionName: todayDay.workout.name ?? 'session',
          method: 'explicit_day',
        },
      };
    }
    if (todayDay) {
      return {
        matched: true,
        failureReason: 'explicit_day_no_workout',
        clarifierQuestion: `There's no session scheduled for today. Which day do you mean?`,
      };
    }
  }
  if (todayISO && /\btomorrow\b/i.test(lower)) {
    const [y, m, d] = todayISO.split('-').map(Number);
    const dt = new Date(y, m - 1, d, 12);
    dt.setDate(dt.getDate() + 1);
    const tmrISO = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const tmrDay = currentWeek.find((dd) => dd.date === tmrISO)
      ?? nextWeek.find((dd) => dd.date === tmrISO);
    if (tmrDay?.workout) {
      return {
        matched: true,
        target: {
          date: tmrDay.date,
          sessionName: tmrDay.workout.name ?? 'session',
          method: 'explicit_day',
        },
      };
    }
    if (tmrDay) {
      return {
        matched: true,
        failureReason: 'explicit_day_no_workout',
        clarifierQuestion: `There's no session scheduled for tomorrow. Which day do you mean?`,
      };
    }
  }

  let matchedDow: number | null = null;
  for (const [name, dow] of Object.entries(DOW_BY_NAME)) {
    const re = new RegExp(`\\b${name}\\b`, 'i');
    if (re.test(lower)) {
      matchedDow = dow;
      break;
    }
  }
  if (matchedDow == null) return { matched: false };

  const week = isNext && nextWeek.length ? nextWeek : currentWeek;
  const day = week.find((d) => d.dayOfWeek === matchedDow);
  if (!day) {
    return {
      matched: true,
      failureReason: 'explicit_day_outside_visible_week',
      clarifierQuestion: `I can't find that day in this week's program. Which session do you mean?`,
    };
  }

  // ─── Future-default for bare weekday mutations ─────────────────
  // When the matched day is in the past AND the user didn't say "last"
  // or "previous" AND the message is mutation-like, auto-advance to
  // next week's occurrence so the coach doesn't reject with "that
  // session is in the past". Questions/explanations about a past day
  // are fine — they legitimately refer to the current week.
  const mutationLike = opts?.isMutationLike ?? false;
  if (
    todayISO &&
    mutationLike &&
    !isExplicitlyPast &&
    !isNext &&
    day.date < todayISO &&
    nextWeek.length > 0
  ) {
    const nextDay = nextWeek.find((d) => d.dayOfWeek === matchedDow);
    if (nextDay?.workout) {
      return {
        matched: true,
        target: {
          date: nextDay.date,
          sessionName: nextDay.workout.name ?? 'session',
          method: 'explicit_day',
        },
      };
    }
  }

  if (!day.workout) {
    return {
      matched: true,
      failureReason: 'explicit_day_no_workout',
      clarifierQuestion: `${day.short} doesn't have a session this week. Which day do you mean?`,
    };
  }
  return {
    matched: true,
    target: {
      date: day.date,
      sessionName: day.workout.name ?? 'session',
      method: 'explicit_day',
    },
  };
}

// ─── Logging ────────────────────────────────────────────────────────

function logResolution(
  input: ResolveReferenceInput,
  message: string,
  isMutation: boolean,
  result: CoachReferenceResolution,
): CoachReferenceResolution {
  const explicitDayHit = (() => {
    for (const [name] of Object.entries(DOW_BY_NAME)) {
      const re = new RegExp(`\\b${name}\\b`, 'i');
      if (re.test(message)) return name;
    }
    return null;
  })();
  logger.debug('[coach-reference-resolution]', {
    userMessage: message,
    explicitDay: explicitDayHit,
    pronounDetected: containsPronoun(message),
    modalityTokens: extractModalityTokensFromMessage(message),
    isMutationLike: isMutation,
    // Phase G runtime audit — top-level method makes it trivial to grep
    // logs for `method: "implicit_recent_session_family"` and confirm the
    // canonical-family collapse landed. Sam's spec.
    method: result.target?.method ?? null,
    lastOpenedWorkout: input.lastOpenedWorkout
      ? {
          date: input.lastOpenedWorkout.date,
          sessionName: input.lastOpenedWorkout.sessionName,
          source: input.lastOpenedWorkout.source,
          ageMs:
            (input.now ?? Date.now()) - input.lastOpenedWorkout.updatedAt,
        }
      : null,
    lastExplainedSession: input.lastExplainedSession
      ? {
          date: input.lastExplainedSession.date,
          sessionName: input.lastExplainedSession.sessionName,
          source: input.lastExplainedSession.source,
          ageMs:
            (input.now ?? Date.now()) - input.lastExplainedSession.updatedAt,
        }
      : null,
    resolvedTarget: result.target,
    confidence: result.confidence,
    failureReason: result.failureReason,
    status: result.status,
  });
  return result;
}
