/**
 * coachCommandRouter — single deterministic entry point for every
 * athlete coach turn. Replaces the historical "isMutationLike +
 * parseModalitySwapRequest + many phrase-specific gates" stack with one
 * pure function:
 *
 *     routeCoachCommand(input): CoachCommand
 *
 * The router NEVER mutates state. It takes the user's message + the
 * resolved context and returns a typed command describing WHAT the
 * athlete wants. A separate executor (`coachCommandExecutor.ts`)
 * dispatches the command to the appropriate engine.
 *
 * ─── Design rules ────────────────────────────────────────────────────
 *
 *  1. Mutation-like turns ALWAYS return mode='mutate' or mode='clarify'.
 *     They never silently fall through to mode='explain'. This is the
 *     truth gate the legacy `/coach-chat` fallback honours — only
 *     `mode='explain'` and `mode='inspect_state'` are allowed to ride
 *     the legacy path; everything else is locally executed or rejected.
 *
 *  2. Every CoachCommand carries a `confidence` score and an explicit
 *     `needsClarification` flag. The executor refuses to apply commands
 *     with low confidence and pivots to a clarify reply instead.
 *
 *  3. Operation parsing is conservative. When a phrase could mean two
 *     different operations (e.g. "swap the row for a bike" — modality
 *     swap or exercise swap?), the router prefers the modality form
 *     because it's the only one with a verified projection path today.
 *
 *  4. The router does NOT call resolveCoachReference. Reference
 *     resolution happens upstream in the context packet build; the
 *     router consumes the resolution.
 *
 * ─── Supported mutate operations (initial set) ───────────────────────
 *
 *   set_conditioning_modality_preference  — recurring future swap
 *   swap_conditioning_modality_once       — single-date swap
 *   set_bike_subtype_preference           — label-only correction
 *   add_conditioning                      — append a session/exercise
 *   remove_conditioning                   — drop a session/exercise
 *   replace_exercise                      — strength-pool style swap
 *   move_session                          — Wed → Thu shift
 *   undo_last_change                      — revert most recent mutation
 *
 * ─── Unsupported (router emits mode='reject' with reason) ────────────
 *
 *   * Compound multi-step commands ("swap Wed and remove Friday")
 *   * Whole-program rebuilds ("redo the whole week")
 *   * Equipment substitutions outside the conditioning modality set
 *   * Anything that needs an LLM to interpret free-form intent
 */

import type { CoachReferenceResolution } from './coachReferenceResolver';
import { isMutationLike } from './coachReferenceResolver';
import {
  parseModalitySwapRequest,
  extractBikeLabel,
  parseBikeSubtypeIntent,
  type BikeLabel,
} from './coachModalitySwap';
import type { ConditioningModality } from '../data/exerciseTags';

// ─── Public types ───────────────────────────────────────────────────

export type CoachCommandTarget =
  | { kind: 'date'; date: string; sessionName?: string }
  | { kind: 'session_name'; sessionName: string }
  | { kind: 'exercise'; date: string; exerciseName: string }
  | { kind: 'last_change' }
  | { kind: 'unbound' };

export type CoachCommandScope =
  | 'one_off'        // single date, no future implications
  | 'this_week'      // current week only
  | 'recurring'      // future-looking, applies until cleared
  | 'permanent';     // until explicitly undone

/** The discrete set of mutate operations the executor knows how to run. */
export type CoachMutateOperation =
  | 'set_conditioning_modality_preference'
  | 'swap_conditioning_modality_once'
  | 'set_bike_subtype_preference'
  | 'add_conditioning'
  | 'remove_conditioning'
  | 'replace_exercise'
  | 'move_session'
  | 'undo_last_change';

/** Payload schemas — the executor type-narrows on `operation`. */
export type CoachMutatePayload =
  | {
      operation: 'set_conditioning_modality_preference';
      from: ConditioningModality | null;
      to: ConditioningModality;
      bikeLabel: BikeLabel | null;
    }
  | {
      operation: 'swap_conditioning_modality_once';
      from: ConditioningModality | null;
      to: ConditioningModality;
      bikeLabel: BikeLabel | null;
    }
  | {
      operation: 'set_bike_subtype_preference';
      bikeLabel: BikeLabel;
    }
  | {
      operation: 'add_conditioning';
      modality: ConditioningModality | null;
      durationMinutes?: number;
    }
  | {
      operation: 'remove_conditioning';
      modality: ConditioningModality | null;
    }
  | {
      operation: 'replace_exercise';
      fromExercise: string;
      toExercise: string | null;
    }
  | {
      operation: 'move_session';
      toDate?: string;
      toDow?: number; // 0=Sun..6=Sat
      /** True when the athlete asked to swap two days' sessions. The
       *  executor performs a two-way move (source → dest AND dest → source). */
      swap?: boolean;
      /** When swap=true, dow of the OTHER side (e.g. "swap Mon and Tue" →
       *  target.date=Mon, swapWithDow=Tue). Used by the executor's
       *  bidirectional safety pass. */
      swapWithDow?: number;
    }
  | {
      operation: 'undo_last_change';
    };

/**
 * Canonical CoachMode union. The router classifies every athlete turn
 * into exactly one of these five modes BEFORE any operation parsing.
 * The mode controls the downstream pipeline:
 *
 *   conversation       → answer naturally using actual program context
 *                        (legacy /coach-chat, but with the visible week
 *                        + activeInjury packet, never freeform)
 *   clarify            → option-bearing question, executor short-circuits
 *   mutate             → deterministic engine + verification
 *   inspect_state      → read-only state report (no LLM round-trip)
 *   reject_with_reason → explain the rule + offer a safer alternative
 *
 * NOTE: 'explain' and 'reject' are accepted as legacy aliases for
 * `conversation` and `reject_with_reason` to keep older call sites
 * compiling during the migration. New code MUST emit the canonical
 * names.
 */
export type CoachMode =
  | 'conversation'
  | 'clarify'
  | 'mutate'
  | 'inspect_state'
  | 'reject_with_reason';

export type CoachCommand =
  | {
      mode: 'mutate';
      operation: CoachMutateOperation;
      target: CoachCommandTarget;
      payload: CoachMutatePayload;
      scope: CoachCommandScope;
      confidence: number;          // 0..1
      needsClarification: boolean; // true → executor MUST ask before applying
      clarificationQuestion?: string;
      missingFields?: string[];    // structured list for the executor/UI
      reason: string;              // short rationale used in transaction logs
    }
  | {
      // Canonical: conversation. Legacy alias: 'explain' (still emitted
      // by older tests; the executor handles both equivalently).
      mode: 'conversation' | 'explain';
      topic: ExplainTopic;
      target: CoachCommandTarget;
      confidence: number;
      reason: string;
    }
  | {
      mode: 'clarify';
      question: string;
      /**
       * Optional concrete options to present to the athlete. The screen
       * may render these as quick-reply chips; the LLM/legacy never
       * sees them. Order matters — most likely first.
       */
      options?: string[];
      missingFields?: string[];
      reason: string;
      /**
       * Best-guess command the router would have emitted if the
       * ambiguity were resolved. Lets the executor stash a pending
       * proposal and resume on the next turn.
       */
      pendingCommand?: CoachCommand;
    }
  | {
      // Canonical: reject_with_reason. Legacy alias: 'reject'.
      mode: 'reject_with_reason' | 'reject';
      reason: string;
      reply: string;
      /** Structured rule violations (e.g. "heavy_lower_within_72h_of_game"). */
      safetyConcerns?: string[];
      /** Concrete next steps the athlete can pick from. */
      suggestedAlternatives?: string[];
    }
  | {
      mode: 'inspect_state';
      question: string;
      target: CoachCommandTarget;
      reason: string;
    };

export type ExplainTopic =
  | 'session_purpose'
  | 'exercise_purpose'
  | 'why_program_didnt_change'
  | 'general_program_question';

// ─── Inputs ─────────────────────────────────────────────────────────

export interface VisibleSessionRef {
  date: string;
  sessionName: string;
  modalities?: string[];
}

export interface RouteCoachCommandInput {
  userMessage: string;
  todayISO: string;
  referenceResolution: CoachReferenceResolution | null;
  /** Current visible week — used to narrow targets for ops the
   *  resolver couldn't bind on its own (e.g. "swap Wednesday"). */
  currentWeek?: VisibleSessionRef[];
  /** Last workout the athlete actually opened (for pronoun "it"). */
  lastOpenedWorkout?: VisibleSessionRef | null;
  /** Last session the coach explained in chat. */
  lastExplainedSession?: VisibleSessionRef | null;
  /** Last mutation/preference applied this conversation. Used for undo. */
  lastChange?: {
    operation: CoachMutateOperation;
    target: CoachCommandTarget;
    appliedAt: number;
  } | null;
  /** Recent chat tail. Used for "next Wednesday" / "going forward" drift. */
  recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /**
   * Game-day calendar input for the safety pre-pass on `move_session`.
   * The router will refuse heavy-lower moves within 72h of a game and
   * conditioning moves within 48h of a game (recovery/flush exempt).
   * `null` skips the safety pass — only do this in tests.
   */
  gameDates?: string[];
  /**
   * Optional: dow (0=Sun..6=Sat) of the team training days. Used by the
   * move-safety pre-pass to refuse moves onto team training days.
   */
  teamTrainingDows?: number[];
}

// ─── Pattern banks ──────────────────────────────────────────────────

/** Past-tense / preference / "going forward" → recurring scope. */
const RECURRING_HINT: RegExp[] = [
  /\bgoing\s+forward\b/i,
  /\bfrom\s+now\s+on\b/i,
  /\bin\s+future\b/i,
  /\bevery\s+(?:time|week|mon|tue|wed|thu|fri|sat|sun)\w*\b/i,
  /\beach\s+(?:week|mon|tue|wed|thu|fri|sat|sun)\w*\b/i,
  /\bweekly\b/i,
  // Plural day names ("Mondays", "Wednesdays") imply recurring
  /\b(?:mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays)\b/i,
  /\balways\b/i,
  /\busually\b/i,
];

/** "Just this session" / "only Wednesday" → one_off scope. */
const ONE_OFF_HINT: RegExp[] = [
  /\bjust\s+(?:this|today|tomorrow|wednesday|thursday|friday|saturday|sunday|monday|tuesday)\b/i,
  /\bonly\s+(?:this|today|tomorrow|wednesday|thursday|friday|saturday|sunday|monday|tuesday)\b/i,
  /\bone[- ]off\b/i,
  /\bthis\s+(?:one|session|time)\s+only\b/i,
];

/** "Not this week, going forward" — explicit scope correction. */
const SCOPE_CORRECTION_RECURRING: RegExp[] = [
  /\bnot\s+this\s+week,?\s*(?:going\s+forward|from\s+now\s+on|future)/i,
  /\bnot\s+today,?\s*(?:going\s+forward|from\s+now\s+on|future)/i,
];

/** "I meant <day>" / "actually <day>" — target correction. */
const TARGET_CORRECTION: RegExp[] = [
  /\bi\s+meant\s+(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  /\b(actually|wait,?\s*i\s+meant)\s+(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
];

const ADD_VERBS = /\b(?:add|tack\s+on|put\s+in|include|throw\s+in|extra)\b/i;
const REMOVE_VERBS = /\b(?:remov|drop|skip|cancel|cut|axe|kill|delete|get\s+rid\s+of)\w*\b/i;
const MOVE_VERBS = /\b(?:move|shift|push|reschedule|reschedul\w*|bump)\b/i;
const UNDO_VERBS = /\b(?:undo|revert|go\s+back|put\s+(?:it|that|this)\s+back|change\s+(?:it|that|this)\s+back|never\s+mind|nevermind|cancel\s+that)\b/i;

/**
 * Vague volume/intensity adjustment — "make this week easier", "lighten
 * me up", "I'm cooked". Triggers an option-bearing clarifier, not a
 * mutation, because the athlete hasn't told us which lever to pull.
 */
const VAGUE_LOAD_REQUEST: RegExp[] = [
  /\bmake\s+(?:this\s+week|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:easier|lighter|shorter)\b/i,
  /\b(?:lighten|ease|cut)\s+(?:me|it|things|the\s+week)\s+(?:up|down|back|off)\b/i,
  /\b(?:cooked|smoked|fried|wrecked|toast)\s*(?:this\s+week|today)?\b/i,
];

/**
 * Vague target-of-dislike — "I don't like Wednesday", "not feeling
 * Friday". The router can't act without knowing WHAT they don't like,
 * so it emits an option-bearing clarifier.
 */
const VAGUE_DISLIKE: RegExp[] = [
  /\b(?:don'?t|do\s+not)\s+like\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)\b/i,
  /\bnot\s+feeling\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\b(?:hate|dislike)\s+(?:the\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
];

/**
 * Hypothetical / curiosity questions about program effects. These are
 * conversation, not mutation, even when they mention a session.
 *   "Would this affect Thursday?"
 *   "Is Wednesday too much?"
 *   "Should I do Friday before the game?"
 */
const HYPOTHETICAL_CONVERSATION: RegExp[] = [
  /\b(?:would|could|should|will)\s+(?:this|that|it|tuesday|wednesday|thursday|friday|saturday|sunday|monday)\s+(?:affect|impact|hurt|help|matter)\b/i,
  /\bis\s+(?:this|that|it|tuesday|wednesday|thursday|friday|saturday|sunday|monday)\s+(?:too\s+much|too\s+little|enough|ok|okay|fine)\b/i,
];

const DOW_MAP: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

// ─── Helpers ────────────────────────────────────────────────────────

function any(message: string, patterns: RegExp[]): boolean {
  return patterns.some((r) => r.test(message));
}

function detectScope(message: string, refDateBeforeToday: boolean): CoachCommandScope {
  if (any(message, SCOPE_CORRECTION_RECURRING)) return 'recurring';
  if (any(message, ONE_OFF_HINT)) return 'one_off';
  if (any(message, RECURRING_HINT)) return 'recurring';
  // Past target without "just this" → recurring (the orchestrator's
  // existing rule, lifted into the router).
  if (refDateBeforeToday) return 'recurring';
  return 'one_off';
}

function extractDow(message: string): number | null {
  const lower = message.toLowerCase();
  // Prefer the day-name that appears AFTER "to" — for "move Wednesday to
  // Thursday" we want Thursday, not Wednesday. Falls back to the only
  // day-name in the message when no "to" prefix exists.
  const after = /\bto\s+(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday|s)?|thu(?:rs(?:day)?|r)?|fri(?:day)?|sat(?:urday)?)\b/i.exec(lower);
  if (after) return DOW_MAP[after[1].toLowerCase()] ?? null;
  const m = /\b(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday|s)?|thu(?:rs(?:day)?|r)?|fri(?:day)?|sat(?:urday)?)\b/i.exec(lower);
  if (!m) return null;
  return DOW_MAP[m[1].toLowerCase()] ?? null;
}

function targetFromResolution(
  res: CoachReferenceResolution | null,
): CoachCommandTarget {
  if (res?.target) {
    return { kind: 'date', date: res.target.date, sessionName: res.target.sessionName };
  }
  return { kind: 'unbound' };
}

function isExplainQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  // Pure question forms: what / why / how / explain / tell me / point of
  if (/\bwhat'?s\s+(the\s+)?(point|purpose|deal)\b/i.test(message)) return true;
  if (/\bwhy\s+(?:am|do|does|is|are|did)\b/i.test(message)) return true;
  if (/\b(?:explain|tell\s+me\s+about|walk\s+me\s+through|what\s+is)\b/i.test(message)) return true;
  if (lower.endsWith('?') && /\b(?:what|why|how|when)\b/i.test(message)) {
    // Question word + question mark, no mutation verbs
    if (!isMutationLike(message)) return true;
  }
  return false;
}

function isInspectQuery(message: string): boolean {
  // "What's on Wednesday?", "Show me this week", "Is there a row tomorrow?"
  if (/\bwhat'?s\s+on\s+(?:wednesday|thursday|friday|saturday|sunday|monday|tuesday|today|tomorrow|next\s+\w+)\b/i.test(message)) return true;
  if (/\bshow\s+me\s+(?:this\s+week|next\s+week|today|tomorrow|wednesday|thursday|friday|saturday|sunday|monday|tuesday)\b/i.test(message)) return true;
  if (/\bis\s+there\s+(?:a|an|any)\s+\w+\s+(?:on|this)\b/i.test(message)) return true;
  return false;
}

/**
 * Compute the dow of the closest game date strictly within `windowDays`
 * of `dateISO`. Returns null when no game falls in the window.
 */
function nearestGameWithin(
  dateISO: string,
  gameDates: string[] | undefined,
  windowDays: number,
): string | null {
  if (!gameDates || gameDates.length === 0) return null;
  const target = new Date(dateISO + 'T12:00:00').getTime();
  let nearest: { iso: string; deltaDays: number } | null = null;
  for (const g of gameDates) {
    const t = new Date(g + 'T12:00:00').getTime();
    const delta = Math.abs(t - target) / 86_400_000;
    if (delta <= windowDays) {
      if (!nearest || delta < nearest.deltaDays) nearest = { iso: g, deltaDays: delta };
    }
  }
  return nearest?.iso ?? null;
}

/**
 * Move-session safety pre-pass. Returns a `reject_with_reason` command
 * when the proposed move violates a programming rule, or null when the
 * move is safe to attempt.
 *
 * Rules:
 *   1. No heavy lower (squat/hinge sessions) within 72h of a game.
 *   2. No conditioning within 48h of a game (recovery/flush exempt).
 *   3. G-1 is arms/pump only — refuse heavy-anything moves onto G-1.
 *   4. Refuse moves onto a team training day.
 */
function moveSafetyPrePass(args: {
  toDateISO: string | null;
  toDow: number | null;
  sessionLabel: string | null; // best guess at the session being moved
  gameDates: string[] | undefined;
  teamTrainingDows: number[] | undefined;
}): { reason: string; safetyConcerns: string[]; alternatives: string[] } | null {
  const { toDateISO, toDow, sessionLabel, gameDates, teamTrainingDows } = args;
  const safetyConcerns: string[] = [];
  const alternatives: string[] = [];

  // Team-training collision (only checkable when we know the dow).
  if (toDow !== null && teamTrainingDows && teamTrainingDows.includes(toDow)) {
    safetyConcerns.push('move_lands_on_team_training_day');
    alternatives.push('Pick a non-team-training day');
  }

  if (toDateISO) {
    const game72 = nearestGameWithin(toDateISO, gameDates, 3);
    const game48 = nearestGameWithin(toDateISO, gameDates, 2);
    const game24 = nearestGameWithin(toDateISO, gameDates, 1);
    const isHeavyLower = !!sessionLabel && /\b(?:lower|squat|hinge|deadlift|heavy)\b/i.test(sessionLabel);
    const isConditioning = !!sessionLabel && /\b(?:row|bike|run|ski|swim|sprint|aerobic|condition)\w*\b/i.test(sessionLabel);
    const isRecoveryFlush = !!sessionLabel && /\b(?:flush|recovery|easy|aerobic\s+base)\b/i.test(sessionLabel);

    if (isHeavyLower && game72) {
      safetyConcerns.push('heavy_lower_within_72h_of_game');
      alternatives.push('Move it earlier in the week (≥72h before the game)');
      alternatives.push('Make the destination day arms/pump only');
    }
    if (isConditioning && !isRecoveryFlush && game48) {
      safetyConcerns.push('conditioning_within_48h_of_game');
      alternatives.push('Keep conditioning ≥48h before the game, or run a recovery flush instead');
    }
    if (game24) {
      // G-1: arms/pump only.
      if (!isRecoveryFlush) {
        safetyConcerns.push('non_pump_session_on_G-1');
        alternatives.push('Replace with arms/pump only on G-1');
      }
    }
  }

  if (safetyConcerns.length === 0) return null;
  return {
    reason: 'move_session_safety_violation',
    safetyConcerns,
    alternatives: Array.from(new Set(alternatives)),
  };
}

function isoForDow(todayISO: string, dow: number): string {
  const t = new Date(todayISO + 'T12:00:00');
  const todayDow = t.getDay();
  const delta = ((dow - todayDow) + 7) % 7 || 7;
  const d = new Date(t.getTime() + delta * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoAddDays(todayISO: string, n: number): string {
  const t = new Date(todayISO + 'T12:00:00');
  const d = new Date(t.getTime() + n * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Extract a destination date for a move from a message. Recognises
 *   "tomorrow"               → +1 day
 *   "the day after tomorrow" → +2 days
 *   "today"                  → todayISO (executor rejects same-date moves)
 *   "<day name>"             → next occurrence of that DOW
 *   "to <day name>"          → preferred — same as above
 * Returns the resolved ISO when known, or `{ toDate: null, toDow }` when only
 * a DOW could be extracted. The returned `toDow` lets the safety pre-pass
 * still check team-training collisions when the date is unresolvable.
 */
function extractDestination(
  message: string,
  todayISO: string,
): { toDate: string | null; toDow: number | null } {
  const lower = message.toLowerCase();
  if (/\bday\s+after\s+tomorrow\b/.test(lower)) {
    const iso = isoAddDays(todayISO, 2);
    const dow = new Date(iso + 'T12:00:00').getDay();
    return { toDate: iso, toDow: dow };
  }
  if (/\btomorrow\b/.test(lower)) {
    const iso = isoAddDays(todayISO, 1);
    const dow = new Date(iso + 'T12:00:00').getDay();
    return { toDate: iso, toDow: dow };
  }
  if (/\btoday\b/.test(lower)) {
    const dow = new Date(todayISO + 'T12:00:00').getDay();
    return { toDate: todayISO, toDow: dow };
  }
  const dow = extractDow(message);
  if (dow !== null) return { toDate: isoForDow(todayISO, dow), toDow: dow };
  return { toDate: null, toDow: null };
}

/**
 * Detect "swap <day-A> and <day-B>" / "swap <day-A> with <day-B>" patterns.
 * Returns the two DOWs in the order they appeared, or null when the
 * message doesn't fit the swap shape. Used to route bidirectional moves.
 */
function extractSwapDays(message: string): { dowA: number; dowB: number } | null {
  const m =
    /\b(?:swap|switch|trade|flip)\s+(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday|s)?|thu(?:rs(?:day)?|r)?|fri(?:day)?|sat(?:urday)?)\s+(?:and|with|for)\s+(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday|s)?|thu(?:rs(?:day)?|r)?|fri(?:day)?|sat(?:urday)?)\b/i.exec(
      message,
    );
  if (!m) return null;
  const dowA = DOW_MAP[m[1].toLowerCase()];
  const dowB = DOW_MAP[m[2].toLowerCase()];
  if (typeof dowA !== 'number' || typeof dowB !== 'number') return null;
  if (dowA === dowB) return null;
  return { dowA, dowB };
}

/**
 * "Put X on <day> instead" — verb shape that's semantically a move but
 * doesn't use a move-verb. Detected only when there's a destination day
 * and the prefix sounds session-shaped (lower body, upper pull, the row,
 * etc.) — never when the object is a conditioning modality (those route
 * to add_conditioning).
 */
function isPutOnDayMove(message: string): boolean {
  const m = /\bput\s+(?:the\s+)?([a-z][a-z\s-]{2,40}?)\s+on\s+(?:sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday|s)?|thu(?:rs(?:day)?|r)?|fri(?:day)?|sat(?:urday)?|today|tomorrow)\b/i.exec(
    message,
  );
  if (!m) return false;
  const obj = m[1].trim();
  // Conditioning modality words → handled by add_conditioning, not move.
  if (looksLikeModality(obj)) return false;
  // Single bare word that's a conditioning verb → also add_conditioning.
  if (/^(bike|row|run|ski|swim|sprint|cardio|aerobic|conditioning)$/i.test(obj)) return false;
  return true;
}

// ─── Main router ────────────────────────────────────────────────────

export function routeCoachCommand(input: RouteCoachCommandInput): CoachCommand {
  const message = input.userMessage ?? '';
  const ref = input.referenceResolution;
  const refDateBeforeToday =
    !!ref?.target?.date && ref.target.date < input.todayISO;

  const mutationLike = isMutationLike(message);

  // ─── 0. Correction phrases ("I meant <day>", "not this week, going forward") ───
  // These are corrections to a previous turn that have NO action verb on
  // their own. We can't act on them in isolation — but we MUST NOT let
  // them ride the legacy explanation path. Emit clarify so the executor
  // composes a context-aware question.
  if (any(message, TARGET_CORRECTION)) {
    return {
      mode: 'clarify',
      question: 'Got it — what would you like me to change for that day?',
      reason: 'target_correction_no_action',
    };
  }
  if (any(message, SCOPE_CORRECTION_RECURRING)) {
    return {
      mode: 'clarify',
      question:
        'Understood — I\'ll apply this going forward. ' +
        'Could you remind me what change you want?',
      reason: 'scope_correction_no_action',
    };
  }

  // ─── 0a. Hypothetical / curiosity → conversation ─────────────────
  // "Would this affect Thursday?" / "Is Wednesday too much?" — these
  // are real questions that deserve a grounded answer, not a clarifier
  // and not a mutation attempt.
  if (any(message, HYPOTHETICAL_CONVERSATION)) {
    return {
      mode: 'conversation',
      topic: 'general_program_question',
      target: targetFromResolution(ref),
      confidence: 0.8,
      reason: 'hypothetical_program_question',
    };
  }

  // ─── 0b. Vague load/dislike → option-bearing clarify ─────────────
  // "Make this week easier" / "I'm cooked" / "I don't like Wednesday"
  // — the athlete hasn't said WHAT to change. Offer 3 concrete levers
  // instead of asking an open prompt.
  if (any(message, VAGUE_LOAD_REQUEST)) {
    return {
      mode: 'clarify',
      question: 'Yep — do you want me to reduce gym volume, conditioning, or both?',
      options: ['Reduce gym volume', 'Reduce conditioning', 'Both'],
      missingFields: ['load_lever'],
      reason: 'vague_load_request',
    };
  }
  if (any(message, VAGUE_DISLIKE)) {
    return {
      mode: 'clarify',
      question:
        "What don't you like about it — the day, the modality, " +
        'the duration, or how it sits next to team training?',
      options: ['The day', 'The modality', 'The duration', 'How it sits next to team training'],
      missingFields: ['dislike_facet'],
      reason: 'vague_dislike',
    };
  }

  // ─── 1. Undo / revert (highest precedence — works without target) ───
  if (UNDO_VERBS.test(message)) {
    const target: CoachCommandTarget = input.lastChange?.target ?? { kind: 'last_change' };
    return {
      mode: 'mutate',
      operation: 'undo_last_change',
      target,
      payload: { operation: 'undo_last_change' },
      scope: 'one_off',
      confidence: input.lastChange ? 0.9 : 0.6,
      needsClarification: !input.lastChange,
      clarificationQuestion: input.lastChange
        ? undefined
        : "I don't have a last change on record — what would you like me to undo?",
      reason: 'undo_verb_detected',
    };
  }

  // ─── 2. Bike subtype-only correction ─────────────────────────────
  // "I want a regular bike, not an assault bike". Detected via the
  // structured parseBikeSubtypeIntent — covers negation, complaint,
  // and question-form-as-complaint shapes that don't carry a
  // want/prefer verb (e.g. "it's still saying assault bike?").
  //
  // Bare-token mentions ("regular bike" with no verb) only route here
  // when an explicit mutation cue is present in the message — otherwise
  // a passing reference like "what do you mean by regular bike" would
  // trigger an unintended preference write.
  const bikeIntent = parseBikeSubtypeIntent(message);
  const bikeLabel = bikeIntent.desiredLabel;
  const isExplicitBikeIntent =
    bikeLabel != null &&
    bikeIntent.source !== null &&
    bikeIntent.source !== 'token_only_regular' &&
    bikeIntent.source !== 'token_only_assault';
  const hasMutationCue =
    /\b(?:i\s+(?:just\s+)?want|prefer|rather|use|make\s+(?:it|that)|actually)\b/i.test(message) ||
    /\bnot\s+(?:an?\s+)?\w*\s*bike\b/i.test(message);
  if (bikeLabel && (isExplicitBikeIntent || hasMutationCue)) {
    // Same-modality bike-label correction: route through the modality
    // preference operation but with from===to===bike. The executor
    // hands this off to orchestrateModalitySwap which already has the
    // label-only path.
    return {
      mode: 'mutate',
      operation: 'set_bike_subtype_preference',
      target: targetFromResolution(ref),
      payload: { operation: 'set_bike_subtype_preference', bikeLabel },
      scope: 'recurring',
      confidence: ref?.target ? 0.9 : 0.6,
      needsClarification: !ref?.target,
      clarificationQuestion: ref?.target ? undefined : 'Which session should the bike change apply to?',
      reason: 'bike_subtype_correction',
    };
  }

  // ─── 3. Modality swap (single-date or recurring) ────────────────
  const swap = parseModalitySwapRequest(message);
  if (swap) {
    const scope = detectScope(message, refDateBeforeToday);

    // Same-modality (from===to) → label-only preference path
    if (swap.from && swap.from === swap.to) {
      return {
        mode: 'mutate',
        operation: 'set_bike_subtype_preference',
        target: targetFromResolution(ref),
        payload: {
          operation: 'set_bike_subtype_preference',
          bikeLabel: swap.bikeLabel ?? 'standard',
        },
        scope: 'recurring',
        confidence: 0.85,
        needsClarification: !ref?.target,
        clarificationQuestion: ref?.target ? undefined : 'Which session do you mean?',
        reason: 'modality_swap_same_label',
      };
    }

    if (scope === 'recurring') {
      return {
        mode: 'mutate',
        operation: 'set_conditioning_modality_preference',
        target: targetFromResolution(ref),
        payload: {
          operation: 'set_conditioning_modality_preference',
          from: swap.from,
          to: swap.to,
          bikeLabel: swap.bikeLabel ?? null,
        },
        scope: 'recurring',
        confidence: ref?.target ? 0.9 : 0.55,
        needsClarification: !ref?.target,
        clarificationQuestion: ref?.target ? undefined : 'Which session should I switch?',
        reason: 'modality_swap_recurring',
      };
    }

    return {
      mode: 'mutate',
      operation: 'swap_conditioning_modality_once',
      target: targetFromResolution(ref),
      payload: {
        operation: 'swap_conditioning_modality_once',
        from: swap.from,
        to: swap.to,
        bikeLabel: swap.bikeLabel ?? null,
      },
      scope: 'one_off',
      confidence: ref?.target ? 0.9 : 0.55,
      needsClarification: !ref?.target,
      clarificationQuestion: ref?.target ? undefined : 'Which session should I switch?',
      reason: 'modality_swap_one_off',
    };
  }

  // ─── 4. Move session ────────────────────────────────────────────
  // Three phrase shapes route here:
  //   (a) "swap <day-A> and <day-B>"           → bidirectional move (swap=true)
  //   (b) "move <session> to <day>"            → one-way move
  //   (c) "put <session> on <day> [instead]"   → one-way move via "put" verb
  // Each runs through the same safety pre-pass when the destination day
  // is decidable. The executor owns the actual two-write orchestration.

  // ─── 4a. Swap days — "swap Mon and Tue" ─────────────────────────
  const swapDays = extractSwapDays(message);
  if (swapDays) {
    const { dowA, dowB } = swapDays;
    const toDateA = isoForDow(input.todayISO, dowA);
    const toDateB = isoForDow(input.todayISO, dowB);
    const sessionLabel = ref?.target?.sessionName ?? extractSessionLabelFromMessage(message);
    // Safety pre-pass for BOTH directions — a swap that violates either
    // side is unsafe.
    for (const [toDateISO, toDow] of [[toDateB, dowB], [toDateA, dowA]] as const) {
      const violation = moveSafetyPrePass({
        toDateISO,
        toDow,
        sessionLabel,
        gameDates: input.gameDates,
        teamTrainingDows: input.teamTrainingDows,
      });
      if (violation) {
        const ruleProse = humaniseSafetyConcerns(violation.safetyConcerns);
        const altProse =
          violation.alternatives.length > 0
            ? ` Want me to ${violation.alternatives[0].toLowerCase()}?`
            : '';
        return {
          mode: 'reject_with_reason',
          reason: violation.reason,
          reply: `I wouldn't swap those days — ${ruleProse}.${altProse}`,
          safetyConcerns: violation.safetyConcerns,
          suggestedAlternatives: violation.alternatives,
        };
      }
    }
    // Bind source = day-A; the executor reads day-A's workout, swaps with day-B.
    return {
      mode: 'mutate',
      operation: 'move_session',
      target: { kind: 'date', date: toDateA },
      payload: {
        operation: 'move_session',
        toDate: toDateB,
        toDow: dowB,
        swap: true,
        swapWithDow: dowA,
      },
      scope: 'this_week',
      confidence: 0.85,
      needsClarification: false,
      reason: 'swap_days_detected',
    };
  }

  // ─── 4b. "Put X on <day> instead" — move via put-verb ───────────
  // Only when there's clearly a destination day. Falls through if the
  // object looks like a conditioning modality (those route to
  // add_conditioning in section 5).
  if (isPutOnDayMove(message)) {
    const dest = extractDestination(message, input.todayISO);
    const sessionLabel = ref?.target?.sessionName ?? extractSessionLabelFromMessage(message);
    if (dest.toDate || dest.toDow !== null) {
      const violation = moveSafetyPrePass({
        toDateISO: dest.toDate,
        toDow: dest.toDow,
        sessionLabel,
        gameDates: input.gameDates,
        teamTrainingDows: input.teamTrainingDows,
      });
      if (violation) {
        const ruleProse = humaniseSafetyConcerns(violation.safetyConcerns);
        const altProse =
          violation.alternatives.length > 0
            ? ` Want me to ${violation.alternatives[0].toLowerCase()}?`
            : '';
        return {
          mode: 'reject_with_reason',
          reason: violation.reason,
          reply: `I wouldn't ${ruleProse}.${altProse}`,
          safetyConcerns: violation.safetyConcerns,
          suggestedAlternatives: violation.alternatives,
        };
      }
    }
    return {
      mode: 'mutate',
      operation: 'move_session',
      target: targetFromResolution(ref),
      payload: {
        operation: 'move_session',
        toDate: dest.toDate ?? undefined,
        toDow: dest.toDow ?? undefined,
      },
      scope: 'this_week',
      confidence: ref?.target && dest.toDate ? 0.8 : 0.5,
      // Executor owns the missing-source / missing-dest clarifier.
      needsClarification: false,
      reason: 'put_on_day_move_detected',
    };
  }

  if (MOVE_VERBS.test(message)) {
    const dest = extractDestination(message, input.todayISO);
    const sessionLabel = ref?.target?.sessionName ?? extractSessionLabelFromMessage(message);

    // Safety pre-pass — refuse moves that violate game-day rules. We
    // only run this when the destination is decidable; otherwise we
    // fall through to the normal mutate/clarify path.
    if (dest.toDate || dest.toDow !== null) {
      const violation = moveSafetyPrePass({
        toDateISO: dest.toDate,
        toDow: dest.toDow,
        sessionLabel,
        gameDates: input.gameDates,
        teamTrainingDows: input.teamTrainingDows,
      });
      if (violation) {
        const ruleProse = humaniseSafetyConcerns(violation.safetyConcerns);
        const altProse =
          violation.alternatives.length > 0
            ? ` Want me to ${violation.alternatives[0].toLowerCase()}?`
            : '';
        return {
          mode: 'reject_with_reason',
          reason: violation.reason,
          reply: `I wouldn't ${ruleProse}.${altProse}`,
          safetyConcerns: violation.safetyConcerns,
          suggestedAlternatives: violation.alternatives,
        };
      }
    }

    return {
      mode: 'mutate',
      operation: 'move_session',
      target: targetFromResolution(ref),
      payload: {
        operation: 'move_session',
        toDate: dest.toDate ?? undefined,
        toDow: dest.toDow ?? undefined,
      },
      scope: 'this_week',
      confidence: ref?.target && dest.toDow !== null ? 0.85 : 0.5,
      // Executor owns missing-source / missing-dest clarifiers — it can
      // list the actual visible-week days as concrete options instead
      // of asking an open question.
      needsClarification: false,
      reason: 'move_verb_detected',
    };
  }

  // ─── 5. Add conditioning ────────────────────────────────────────
  if (ADD_VERBS.test(message) && /\b(?:bike|row|rower|run|ski|swim|cardio|conditioning|aerobic|sprint)\b/i.test(message)) {
    return {
      mode: 'mutate',
      operation: 'add_conditioning',
      target: targetFromResolution(ref),
      payload: { operation: 'add_conditioning', modality: detectModality(message) },
      scope: detectScope(message, refDateBeforeToday),
      confidence: ref?.target ? 0.7 : 0.45,
      needsClarification: !ref?.target,
      clarificationQuestion: ref?.target ? undefined : 'Which day do you want me to add conditioning to?',
      reason: 'add_conditioning_detected',
    };
  }

  // ─── 6. Remove conditioning ─────────────────────────────────────
  if (REMOVE_VERBS.test(message) && /\b(?:bike|row|rower|run|ski|swim|cardio|conditioning|aerobic|sprint|session|workout)\b/i.test(message)) {
    return {
      mode: 'mutate',
      operation: 'remove_conditioning',
      target: targetFromResolution(ref),
      payload: { operation: 'remove_conditioning', modality: detectModality(message) },
      scope: detectScope(message, refDateBeforeToday),
      confidence: ref?.target ? 0.7 : 0.45,
      needsClarification: !ref?.target,
      clarificationQuestion: ref?.target ? undefined : 'Which session should I remove?',
      reason: 'remove_conditioning_detected',
    };
  }

  // ─── 7. Replace exercise (strength) ─────────────────────────────
  // "swap deadlift for trap bar" / "replace bench press" — when the
  // exercise tokens are NOT conditioning modality words.
  const replaceMatch =
    /\b(?:swap|replace|substitut\w*|change)\s+(?:the\s+)?([a-z][a-z\s-]+?)\s+(?:for|with|to)\s+(?:a\s+|an\s+)?([a-z][a-z\s-]+)/i.exec(message);
  if (replaceMatch && !looksLikeModality(replaceMatch[1]) && !looksLikeModality(replaceMatch[2])) {
    return {
      mode: 'mutate',
      operation: 'replace_exercise',
      target: targetFromResolution(ref),
      payload: {
        operation: 'replace_exercise',
        fromExercise: replaceMatch[1].trim(),
        toExercise: replaceMatch[2].trim(),
      },
      scope: 'one_off',
      confidence: ref?.target ? 0.75 : 0.5,
      // The executor builds an option-bearing clarifier from the
      // workout's actual exercise list when the target is missing —
      // never short-circuit through the generic clarify gate here.
      needsClarification: false,
      reason: 'replace_exercise_detected',
    };
  }

  // ─── 7b. Replace exercise — pronoun source ──────────────────────
  // "replace this exercise" / "change this one". The athlete opened
  // a session in DayWorkout and is referring to one of its exercises;
  // the executor reads the workout and asks WHICH exercise.
  const pronounReplace =
    /\b(?:swap|replace|substitut\w*|change)\s+(?:this|that)(?:\s+(?:one|exercise))?\b/i.exec(message);
  if (pronounReplace) {
    return {
      mode: 'mutate',
      operation: 'replace_exercise',
      target: targetFromResolution(ref),
      payload: {
        operation: 'replace_exercise',
        fromExercise: '__pronoun__',
        toExercise: null,
      },
      scope: 'one_off',
      confidence: ref?.target ? 0.7 : 0.4,
      // Defer to the executor — it will list the workout's exercises
      // as options instead of asking an open-ended question.
      needsClarification: false,
      reason: 'replace_exercise_pronoun',
    };
  }

  // ─── 7c. Replace exercise — source-only (no replacement named) ──
  // "swap cable rows" / "replace bench press" — the athlete named the
  // exercise to drop but not what to swap to. The executor classifies
  // the source via the strength pools and offers siblings as options.
  const sourceOnlyReplace =
    /\b(?:swap|replace|substitut\w*)\s+(?:the\s+)?([a-z][a-z\s-]{1,40}?)\s*$/i.exec(message.trim()) ||
    /\b(?:swap|replace|substitut\w*)\s+(?:the\s+)?([a-z][a-z\s-]{1,40}?)(?=\s*[.,!?])/i.exec(message);
  if (sourceOnlyReplace && !looksLikeModality(sourceOnlyReplace[1])) {
    return {
      mode: 'mutate',
      operation: 'replace_exercise',
      target: targetFromResolution(ref),
      payload: {
        operation: 'replace_exercise',
        fromExercise: sourceOnlyReplace[1].trim(),
        toExercise: null,
      },
      scope: 'one_off',
      confidence: ref?.target ? 0.65 : 0.4,
      needsClarification: false,
      reason: 'replace_exercise_source_only',
    };
  }

  // ─── 8. Mutation-like fall-through: clarify, never explain ──────
  // "Change something on Wednesday" / "I want to swap" — verb without
  // enough payload. Per the truth-gate contract, we can NEVER drop a
  // mutation request into mode='explain'. Ask one targeted clarifier.
  if (mutationLike) {
    if (!ref?.target) {
      return {
        mode: 'clarify',
        question: ref?.clarifierQuestion ?? 'Which session do you mean?',
        reason: 'mutation_like_no_target',
      };
    }
    return {
      mode: 'clarify',
      question: 'What change would you like — different exercise, different day, lighter session, or skip it?',
      reason: 'mutation_like_no_payload',
    };
  }

  // ─── 9. Inspect state ───────────────────────────────────────────
  if (isInspectQuery(message)) {
    return {
      mode: 'inspect_state',
      question: message,
      target: targetFromResolution(ref),
      reason: 'inspect_state_query',
    };
  }

  // ─── 10. Conversation ───────────────────────────────────────────
  // Question forms that don't propose a mutation. The screen routes
  // these through the legacy /coach-chat path WITH the full coach
  // context packet so replies stay grounded in the visible program.
  if (isExplainQuestion(message)) {
    return {
      mode: 'conversation',
      topic: 'general_program_question',
      target: targetFromResolution(ref),
      confidence: 0.7,
      reason: 'explain_question_form',
    };
  }

  // ─── Fallback: open conversation. Lower confidence so debugging
  // surfaces show "we didn't pick anything specific". Still routes
  // through the grounded conversation path — the LLM is allowed to
  // interpret freeform language because it cannot mutate state.
  return {
    mode: 'conversation',
    topic: 'general_program_question',
    target: targetFromResolution(ref),
    confidence: 0.3,
    reason: 'no_specific_intent_detected',
  };
}

// ─── Reject helpers ────────────────────────────────────────────────

const SAFETY_CONCERN_PROSE: Record<string, string> = {
  heavy_lower_within_72h_of_game:
    'move heavy lower body that close to game day',
  conditioning_within_48h_of_game:
    'put conditioning that close to the game',
  'non_pump_session_on_G-1':
    'put a non-pump session on the day before the game',
  move_lands_on_team_training_day:
    'move it onto a team training day',
  move_session_safety_violation: 'make that move',
};

function humaniseSafetyConcerns(concerns: string[]): string {
  if (concerns.length === 0) return 'make that move';
  return concerns
    .map((c) => SAFETY_CONCERN_PROSE[c] ?? c.replace(/_/g, ' '))
    .join(' or ');
}

/**
 * Best-effort extraction of the session label from the user message
 * when the resolver couldn't bind a target. Recognises "lower body",
 * "upper", "row", "bike", "team training", etc. Used by the move
 * safety pre-pass to decide if it's a heavy-lower move.
 */
function extractSessionLabelFromMessage(message: string): string | null {
  const m = /\b(?:lower\s*body|lower|upper\s*body|upper|squat\w*|hinge|deadlift|row(?:er)?|bike|run|ski|swim|sprint|aerobic|conditioning|recovery|flush|team\s*training)\b/i.exec(message);
  return m ? m[0] : null;
}

// ─── Helpers exposed for tests ──────────────────────────────────────

function looksLikeModality(word: string): boolean {
  const w = word.toLowerCase().trim();
  return /^(bike|row|rower|rowing|run|running|ski|skierg|swim|swimming|sprint|cardio|conditioning|aerobic)$/.test(w);
}

function detectModality(message: string): ConditioningModality | null {
  if (/\bbike|cycling|spin\b/i.test(message)) return 'bike';
  if (/\brow|rower|rowing\b/i.test(message)) return 'row';
  if (/\bski|skierg\b/i.test(message)) return 'ski';
  if (/\brun|running|jog\b/i.test(message)) return 'run';
  if (/\bswim\b/i.test(message)) return 'swim';
  return null;
}

/**
 * Convenience: did the router emit a mutate / clarify / reject command?
 * Used by the legacy-fallback gate in CoachScreen — when this returns
 * true, the legacy /coach-chat fetch is FORBIDDEN regardless of
 * executor success. Reject_with_reason is included because the rule
 * explanation IS the reply; the LLM doesn't get a second pass.
 */
export function isMutateCommand(cmd: CoachCommand): boolean {
  return (
    cmd.mode === 'mutate' ||
    cmd.mode === 'clarify' ||
    cmd.mode === 'reject_with_reason' ||
    cmd.mode === 'reject'
  );
}

/**
 * Did the router decide the turn is safe to delegate to the legacy
 * conversation/explanation path? Only `conversation` (legacy `explain`)
 * and `inspect_state` are allowed — and the legacy path is now
 * required to ride with the full coachContextPacket so replies stay
 * grounded in the visible program.
 */
export function canFallbackToLegacy(cmd: CoachCommand): boolean {
  return (
    cmd.mode === 'conversation' ||
    cmd.mode === 'explain' ||
    cmd.mode === 'inspect_state'
  );
}

/**
 * True if the command is one of the conversational modes — the screen
 * uses this to decide whether to mount the LLM-grounded reply path
 * (with full program context) vs. the executor.
 */
export function isConversationalMode(cmd: CoachCommand): boolean {
  return (
    cmd.mode === 'conversation' ||
    cmd.mode === 'explain' ||
    cmd.mode === 'inspect_state'
  );
}

export const __testing__ = {
  RECURRING_HINT,
  ONE_OFF_HINT,
  SCOPE_CORRECTION_RECURRING,
  TARGET_CORRECTION,
  detectScope,
  extractDow,
  detectModality,
};
