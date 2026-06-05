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
 *   remove_session                        — remove a whole date's session
 *   remove_conditioning                   — drop a conditioning item/block
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
  dayHasModality,
  type BikeLabel,
  type ParsedModalitySwap,
} from './coachModalitySwap';
import type { ConditioningModality } from '../data/exerciseTags';
import type { MutationTouchedActivity } from '../store/coachMutationHistoryStore';
import {
  buildConditioningCoachPlan,
  buildConditioningPayloadFromRequest,
  type CoachConditioningEditScope,
  type CoachConditioningEditMode,
  detectRequestedTrainingIntent,
  type CoachPlanChangeKind,
  type CoachTrainingIntent,
} from './coachPlan';
import { parseCoachDurationMinutes } from './coachValueNormalizers';

export type ConditioningIntentModality =
  | ConditioningModality
  | 'walk'
  | 'cardio'
  | 'aerobic'
  | 'sprint';

export type AddConditioningIntensity = 'light' | 'moderate' | 'hard';

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
  | 'add_session'
  | 'add_conditioning'
  | 'remove_session'
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
      modality: ConditioningIntentModality | null;
      customActivity?: string;
      intensity?: AddConditioningIntensity;
      durationMinutes?: number;
      sets?: number;
      repsMin?: number;
      repsMax?: number;
      restSeconds?: number;
      prescriptionType?: 'duration' | 'duration_minutes';
      bikeLabel?: BikeLabel | null;
      effortKind?: 'sprint' | 'interval';
      replaceActivity?: string;
      trainingIntent?: CoachTrainingIntent;
      changeKind?: CoachPlanChangeKind;
      editMode?: CoachConditioningEditMode;
      editScope?: CoachConditioningEditScope;
      targetItemId?: string;
    }
  | {
      operation: 'add_session';
      sourceDate?: string;
      sourceSessionName?: string;
      targetSessionName?: string;
      reason?: string;
    }
  | {
      operation: 'remove_session';
      targetSessionId?: string | null;
      reason?: string;
    }
  | {
      operation: 'remove_conditioning';
      modality: ConditioningIntentModality | null;
      targetItemId?: string;
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
      options?: string[];
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
  workout?: {
    name?: string;
    workoutType?: string;
    sessionTier?: string;
    conditioningBlock?: {
      options?: Array<{
        title?: string;
        description?: string;
        exerciseIds?: string[];
      }>;
    };
    exercises?: Array<{
      id?: string;
      prescribedSets?: number;
      prescribedRepsMin?: number;
      prescribedRepsMax?: number;
      prescriptionType?: string;
      notes?: string;
      exercise?: {
        name?: string;
        description?: string;
      };
    }>;
  } | null;
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
    userMessage?: string;
    appliedReply?: string;
    touchedActivities?: MutationTouchedActivity[];
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

const EXPLICIT_RECURRING_HINT =
  /\b(?:going\s+forward|from\s+now\s+on|in\s+future|every|each|weekly|always|usually)\b/i;

const PLURAL_DAY_AS_POSSESSIVE_SESSION =
  /\b(?:mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays)\s+(?:session|workout)\b/i;

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

const ADD_ACTION_WORDS =
  '(?:add|tack\\s+on|put\\s+in|put|include|throw\\s+in|chuck\\s+in|chuck|slot\\s+in|work\\s+in|stick\\s+in|schedule|program|extra)';
const ADD_VERBS = new RegExp(`\\b${ADD_ACTION_WORDS}\\b`, 'i');
const REMOVE_ACTION_WORDS =
  "(?:remov\\w*|drop\\w*|ditch\\w*|scrap\\w*|skip\\w*|cancel\\w*|cut\\w*|axe\\w*|kill\\w*|delete\\w*|take\\s+out|get\\s+rid\\s+of|don'?t\\s+do|do\\s+not\\s+do)";
const REMOVE_VERBS = new RegExp(`\\b${REMOVE_ACTION_WORDS}\\b`, 'i');
const MOVE_VERBS = /\b(?:move|shift|push|reschedule|reschedul\w*|bump)\b/i;
const UNDO_VERBS = /\b(?:undo|revert|go\s+back|put\s+(?:it|that|this)\s+back|change\s+(?:it|that|this)\s+back|never\s+mind|nevermind|cancel\s+that)\b/i;

/**
 * Vague volume/intensity adjustment — "make this week easier", "lighten
 * me up", "I'm cooked". Triggers an option-bearing clarifier, not a
 * mutation, because the athlete hasn't told us which lever to pull.
 */
const VAGUE_LOAD_REQUEST: RegExp[] = [
  /\bmake\s+(?:this\s+week|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:easier|lighter|shorter)\b/i,
  /\b(?:do|make|change|adjust|switch|swap)\s+(?:something|it|this|today|tomorrow|the\s+session|the\s+workout)?\s*(?:easier|lighter|lower[-\s]*load)\b/i,
  /\b(?:lighten|ease|cut)\s+(?:me|it|things|the\s+week)\s+(?:up|down|back|off)\b/i,
  /\b(?:back\s+it\s+off|deload|reduce\s+(?:it|this|today|the\s+session|the\s+workout|the\s+load)|too\s+much\s+(?:work|conditioning|running|volume|load))\b/i,
  /\b(?:cooked|smoked|fried|wrecked|toast|flat|exhausted|fatigued|drained|knackered|low\s+energy|no\s+energy)\s*(?:this\s+week|today)?\b/i,
  /\b(?:i'?m|i\s+am|feel(?:ing)?|legs?|body|hamstrings?|hammys?|quads?|calves|groin|adductors?|shoulders?|back|hips?|knees?|ankles?)\s+(?:are\s+|is\s+|feel\s+|feels\s+|feeling\s+)?(?:cooked|sore|tight|fried|wrecked|smoked|toast|flat|exhausted|fatigued|drained|knackered|low\s+energy|no\s+energy)\b/i,
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
  if (
    PLURAL_DAY_AS_POSSESSIVE_SESSION.test(message) &&
    !EXPLICIT_RECURRING_HINT.test(message)
  ) {
    return 'one_off';
  }
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

function buildModalitySwapCommand(
  input: RouteCoachCommandInput,
  swap: ParsedModalitySwap,
  refDateBeforeToday: boolean,
): Extract<CoachCommand, { mode: 'mutate' }> {
  const ref = input.referenceResolution;
  const scope = detectScope(input.userMessage ?? '', refDateBeforeToday);

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

function targetWorkoutHasModality(
  input: RouteCoachCommandInput,
  modality: ConditioningModality,
): boolean {
  const target = findTargetVisibleSession(input);
  return dayHasModality(
    target ? ({ date: target.date, workout: target.workout } as any) : null,
    modality,
  );
}

function targetWorkoutHasAnyKnownNonBikeModality(
  input: RouteCoachCommandInput,
): boolean {
  return (['row', 'run', 'ski', 'swim', 'mixed'] as ConditioningModality[]).some((modality) =>
    targetWorkoutHasModality(input, modality),
  );
}

function findTargetVisibleSession(
  input: RouteCoachCommandInput,
): VisibleSessionRef | null {
  const targetDate = input.referenceResolution?.target?.date ?? null;
  const targetSessionName = input.referenceResolution?.target?.sessionName ?? null;
  const candidates = [
    ...(input.currentWeek ?? []),
    input.lastOpenedWorkout ?? null,
    input.lastExplainedSession ?? null,
  ].filter((entry): entry is VisibleSessionRef => !!entry?.workout);
  return (
    candidates.find((entry) => targetDate && entry.date === targetDate) ??
    candidates.find((entry) =>
      !!targetSessionName &&
      entry.sessionName.toLowerCase() === targetSessionName.toLowerCase(),
    ) ??
    null
  );
}

function formatTargetForQuestion(res: CoachReferenceResolution | null): string {
  const target = res?.target;
  if (!target) return 'that session';
  const day = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(target.date);
    if (!m) return target.date;
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
      new Date(`${target.date}T12:00:00`).getDay()
    ] ?? target.date;
  })();
  return `${day}'s ${target.sessionName}`;
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
  if (looksLikeConditioningRequest(obj)) return false;
  // Single bare word that's a conditioning verb → also add_conditioning.
  if (/^(bike|row|run|ski|swim|sprint|cardio|aerobic|conditioning)$/i.test(obj)) return false;
  return true;
}

function extractAddSessionTemplate(input: RouteCoachCommandInput): {
  sourceDate: string;
  sourceSessionName: string;
} | null {
  const message = input.userMessage ?? '';
  if (!ADD_VERBS.test(message)) return null;
  if (looksLikeConditioningRequest(message)) return null;

  const sessions = (input.currentWeek ?? [])
    .filter((day) => day.workout?.name || day.sessionName)
    .map((day) => ({
      date: day.date,
      sessionName: String(day.workout?.name ?? day.sessionName ?? '').trim(),
    }))
    .filter((day) => !!day.sessionName);
  if (sessions.length === 0) return null;

  const messageKey = normaliseSessionMention(message);
  const messageCompact = messageKey.replace(/\s+/g, '');
  for (const session of sessions) {
    const sessionKey = normaliseSessionMention(session.sessionName);
    const sessionCompact = sessionKey.replace(/\s+/g, '');
    if (!sessionKey || sessionKey === 'session' || sessionKey === 'workout') continue;
    if (
      messageKey.includes(sessionKey) ||
      sessionKey.includes(messageKey) ||
      (sessionCompact.length >= 5 && messageCompact.includes(sessionCompact)) ||
      (sessionCompact.length >= 5 && sessionCompact.includes(messageCompact))
    ) {
      return {
        sourceDate: session.date,
        sourceSessionName: session.sessionName,
      };
    }
  }
  return null;
}

function normaliseSessionMention(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\b(?:can|could|would|you|we|please|actually|add|put|include|schedule|program|slot|work|stick|chuck|throw|in|on|to|onto|for|there|that|this|day|session|workout|the|a|an)\b/g, ' ')
    .replace(/\b(?:sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday|s)?|thu(?:rs(?:day)?|r)?|fri(?:day)?|sat(?:urday)?|today|tomorrow|next|last)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type FatigueArea = 'lower' | 'upper' | 'general';
type VisibleSessionKind =
  | 'no_visible'
  | 'rest'
  | 'recovery'
  | 'game'
  | 'upper_pump'
  | 'lower_strength'
  | 'conditioning'
  | 'strength'
  | 'unknown';

function buildVagueLoadClarification(input: RouteCoachCommandInput, message: string): {
  question: string;
  options: string[];
  reason: string;
} {
  const area = detectFatigueArea(message);
  const today = visibleSessionForDate(input.currentWeek, input.todayISO);
  const sessionKind = classifyVisibleSession(today);
  const daysToNextGame = daysToNextVisibleGame(input);

  if (sessionKind === 'game') {
    if (area === 'lower') {
      return {
        question:
          "It's game day today, so the main question is whether you're okay to play or need to manage minutes/intensity. " +
          "Do you want me to leave the game as-is, mark today as limited, or adjust tomorrow's recovery?",
        options: ['Leave game day as-is', 'Mark today as limited', "Adjust tomorrow's recovery"],
        reason: 'vague_load_request_game_day_lower_fatigue',
      };
    }
    return {
      question:
        "It's game day today, so I won't change gym work. " +
        "Are you feeling generally flat, or are your legs bad enough that you want to mark today as limited and adjust recovery?",
      options: ['Generally flat', 'Mark today as limited', "Adjust tomorrow's recovery", 'Soreness or injury concern'],
      reason: 'vague_load_request_game_day_general_readiness',
    };
  }

  if (sessionKind === 'rest') {
    return {
      question:
        "You're already resting today. Do you want me to add a short recovery/mobility session or leave the plan as-is?",
      options: ['Add recovery/mobility', 'Leave as-is'],
      reason: 'vague_load_request_rest_day',
    };
  }

  if (sessionKind === 'recovery') {
    return {
      question:
        "You're already on a recovery day, so I wouldn't add load. " +
        'Do you want me to keep it as recovery only, shorten it to mobility, or leave the plan as-is?',
      options: ['Keep recovery only', 'Shorten to mobility', 'Leave as-is'],
      reason: 'vague_load_request_recovery_day',
    };
  }

  if (area === 'lower' && daysToNextGame === 1) {
    if (sessionKind === 'upper_pump') {
      const sessionName = today?.sessionName || today?.workout?.name || 'today';
      return {
        question:
          `You've got a game tomorrow and today is ${sessionName}, so I wouldn't add leg load. ` +
          'Do you want me to keep it as upper pump only, switch today to recovery/mobility, or remove today\'s session?',
        options: ['Keep upper pump only', 'Switch to recovery/mobility', "Remove today's session"],
        reason: 'vague_load_request_game_tomorrow_upper_pump',
      };
    }
    if (sessionKind === 'lower_strength') {
      return {
        question:
          "You've got a game tomorrow, so I'd avoid lower-body loading. " +
          'Do you want me to swap today to recovery, upper pump, or remove the session?',
        options: ['Swap to recovery', 'Upper pump', 'Remove the session'],
        reason: 'vague_load_request_game_tomorrow_lower_body',
      };
    }
    if (sessionKind === 'conditioning') {
      return {
        question:
          "Given the game tomorrow, I'd avoid extra running/conditioning. " +
          'Do you want me to remove conditioning or swap it to recovery?',
        options: ['Remove conditioning', 'Swap to recovery'],
        reason: 'vague_load_request_game_tomorrow_conditioning',
      };
    }
    return {
      question:
        "You've got a game tomorrow, so I'd avoid extra leg load. " +
        'Do you want me to reduce lower-body work, swap to recovery, or remove the session?',
      options: ['Reduce lower-body work', 'Swap to recovery', 'Remove the session'],
      reason: 'vague_load_request_game_tomorrow_lower_fatigue',
    };
  }

  if (sessionKind === 'no_visible' && (input.currentWeek?.length ?? 0) > 0) {
    return {
      question:
        "I can't see a visible session for today. Do you want me to adjust tomorrow's recovery, mark today as limited, or leave the plan as-is?",
      options: ["Adjust tomorrow's recovery", 'Mark today as limited', 'Leave as-is'],
      reason: 'vague_load_request_no_visible_session',
    };
  }

  if (area === 'lower') {
    return {
      question: 'Do you want me to reduce lower-body work, conditioning, or the whole session?',
      options: ['Reduce lower-body work', 'Reduce conditioning', 'Whole session'],
      reason: 'vague_load_request_lower_fatigue',
    };
  }

  if (area === 'upper') {
    return {
      question: 'Do you want me to reduce upper-body work, conditioning, or the whole session?',
      options: ['Reduce upper-body work', 'Reduce conditioning', 'Whole session'],
      reason: 'vague_load_request_upper_fatigue',
    };
  }

  return {
    question: 'Do you want me to make the strength work easier, the conditioning easier, or the whole session?',
    options: ['Strength work', 'Conditioning', 'Whole session'],
    reason: 'vague_load_request',
  };
}

function detectFatigueArea(message: string): FatigueArea {
  if (/\b(?:legs?|quads?|hamstrings?|hammys?|calves?|groin|adductors?|hips?|knees?|ankles?|glutes?)\b/i.test(message)) {
    return 'lower';
  }
  if (/\b(?:upper|shoulders?|arms?|chest|pecs?|biceps?|triceps?|elbows?|wrists?|lats?|traps?)\b/i.test(message)) {
    return 'upper';
  }
  return 'general';
}

function visibleSessionForDate(
  currentWeek: VisibleSessionRef[] | undefined,
  dateISO: string,
): VisibleSessionRef | null {
  return currentWeek?.find((day) => day.date === dateISO) ?? null;
}

function daysToNextVisibleGame(input: RouteCoachCommandInput): number | null {
  const candidates = new Set<string>(input.gameDates ?? []);
  for (const day of input.currentWeek ?? []) {
    if (isGameSession(day)) candidates.add(day.date);
  }

  let closest: number | null = null;
  for (const iso of candidates) {
    const delta = daysBetween(input.todayISO, iso);
    if (delta == null || delta < 0) continue;
    if (closest == null || delta < closest) closest = delta;
  }
  return closest;
}

function daysBetween(fromISO: string, toISO: string): number | null {
  const from = new Date(`${fromISO}T12:00:00`).getTime();
  const to = new Date(`${toISO}T12:00:00`).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.round((to - from) / 86_400_000);
}

function classifyVisibleSession(day: VisibleSessionRef | null): VisibleSessionKind {
  if (!day) return 'no_visible';
  if (!day.workout) return 'rest';
  if (isGameSession(day)) return 'game';

  const text = visibleSessionText(day);
  const identityText = [
    day.sessionName,
    day.workout?.name,
    (day.workout as any)?.workoutType,
    (day.workout as any)?.sessionTier,
  ].filter(Boolean).join(' ');
  const workoutType = String((day.workout as any).workoutType ?? '').toLowerCase();
  if (
    workoutType.includes('recovery') ||
    /\b(?:recovery|mobility|rest(?:\s+day)?)\b/i.test(identityText)
  ) {
    return 'recovery';
  }
  if (
    workoutType.includes('conditioning') ||
    /\b(?:conditioning|aerobic|flush|row(?:er|ing)?|bike|assault|ski\s*erg|skierg|run(?:ning)?|sprints?|tempo|cardio)\b/i.test(text)
  ) {
    return 'conditioning';
  }
  if (/\b(?:gunshow|gun\s*show|upper|arms?|pump)\b/i.test(text)) {
    return 'upper_pump';
  }
  if (/\b(?:lower|legs?|squat|hinge|deadlift|rdl|hamstrings?|quads?|calves?|glutes?)\b/i.test(text)) {
    return 'lower_strength';
  }
  if (workoutType.includes('strength')) return 'strength';
  return 'unknown';
}

function isGameSession(day: VisibleSessionRef | null): boolean {
  if (!day?.workout && !day?.sessionName) return false;
  return /\bgame(?:\s+day)?\b/i.test(visibleSessionText(day));
}

function visibleSessionText(day: VisibleSessionRef): string {
  const workout = day.workout;
  const exerciseText = (workout?.exercises ?? [])
    .map((exercise) => `${exercise.exercise?.name ?? ''} ${exercise.exercise?.description ?? ''} ${exercise.notes ?? ''}`)
    .join(' ');
  const conditioningText = (workout?.conditioningBlock?.options ?? [])
    .map((option) => `${option.title ?? ''} ${option.description ?? ''}`)
    .join(' ');
  return [
    day.sessionName,
    workout?.name,
    (workout as any)?.workoutType,
    (workout as any)?.sessionTier,
    exerciseText,
    conditioningText,
    day.modalities?.join(' '),
  ].filter(Boolean).join(' ');
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
  const hasDominantMutationCue = hasExplicitNonReadinessMutationCue(message);
  if (any(message, VAGUE_LOAD_REQUEST) && !hasDominantMutationCue) {
    const clarification = buildVagueLoadClarification(input, message);
    return {
      mode: 'clarify',
      question: clarification.question,
      options: clarification.options,
      missingFields: ['load_lever'],
      reason: clarification.reason,
    };
  }
  if (any(message, VAGUE_DISLIKE) && !hasDominantMutationCue) {
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

  // ─── 1b. Duration/volume correction to the last add-on ──────────
  // "Sorry, a bit more than 20 min" after "Done. I added Pilates..."
  // is not a fresh recovery-program question. It is a correction to the
  // last verified add_conditioning mutation, so route it back through
  // the deterministic add/update path.
  const lastAddDurationEdit = inferLastAddDurationEdit(input);
  if (
    lastAddDurationEdit &&
    input.lastChange?.operation === 'add_conditioning' &&
    (input.lastChange.target.kind === 'date' || input.lastChange.target.kind === 'exercise')
  ) {
    const lastAdd = inferLastAddedConditioningPayload(input);
    return {
      mode: 'mutate',
      operation: 'add_conditioning',
      target: input.lastChange.target,
      payload: {
        operation: 'add_conditioning',
        modality: lastAdd.modality,
        customActivity: lastAdd.customActivity,
        intensity: lastAddDurationEdit.intensity ?? lastAdd.intensity ?? 'light',
        durationMinutes: lastAddDurationEdit.durationMinutes,
        sets: lastAddDurationEdit.sets,
        repsMin: lastAddDurationEdit.repsMin,
        repsMax: lastAddDurationEdit.repsMax,
        restSeconds: lastAddDurationEdit.restSeconds,
        prescriptionType: lastAddDurationEdit.prescriptionType,
        bikeLabel: lastAdd.bikeLabel,
        effortKind: lastAdd.effortKind,
        replaceActivity: lastAdd.customActivity,
        trainingIntent: lastAddDurationEdit.trainingIntent,
        editMode: 'update_existing',
        editScope: 'edit_duration_only',
      },
      scope: 'one_off',
      confidence: 0.9,
      needsClarification: !!lastAddDurationEdit.needsClarification,
      clarificationQuestion: lastAddDurationEdit.clarificationQuestion,
      options: lastAddDurationEdit.options,
      missingFields: lastAddDurationEdit.missingFields,
      reason: lastAddDurationEdit.reason,
    };
  }

  // ─── 1c. Duration edit for an existing named activity ───────────
  // "Can you make the Pilates longer?" should bind to the visible
  // Pilates row, not ask the generic "different exercise/day?" prompt.
  const namedDurationEdit = inferNamedActivityDurationEdit(input);
  if (namedDurationEdit) {
    if (namedDurationEdit.status === 'ambiguous') {
      return {
        mode: 'clarify',
        question: namedDurationEdit.question,
        options: namedDurationEdit.options,
        missingFields: ['target_session'],
        reason: 'named_activity_duration_ambiguous',
      };
    }
    return {
      mode: 'mutate',
      operation: 'add_conditioning',
      target: {
        kind: 'date',
        date: namedDurationEdit.date,
        sessionName: namedDurationEdit.sessionName,
      },
      payload: {
        operation: 'add_conditioning',
        modality: namedDurationEdit.modality,
        customActivity: namedDurationEdit.customActivity,
        intensity: namedDurationEdit.intensity,
        durationMinutes: namedDurationEdit.durationMinutes,
        replaceActivity: namedDurationEdit.sourceActivity,
        editMode: 'update_existing',
        editScope: 'edit_duration_only',
      },
      scope: 'one_off',
      confidence: namedDurationEdit.matchedExisting ? 0.88 : 0.65,
      needsClarification: false,
      reason: 'named_activity_duration_adjustment',
    };
  }

  if (isUnderspecifiedRecoveryAdjustment(message)) {
    return {
      mode: 'clarify',
      question: ref?.target
        ? `How should I adjust ${formatTargetForQuestion(ref)} — keep it as recovery only, shorten it to mobility, or remove it?`
        : 'Which recovery session should I adjust, and how?',
      options: ['Keep recovery only', 'Shorten to mobility', 'Remove recovery'],
      missingFields: ref?.target ? ['load_lever'] : ['target_session', 'load_lever'],
      reason: 'recovery_adjustment_missing_lever',
    };
  }

  const typeReplacementIntent = extractConditioningTypeReplacementIntent(input);
  if (typeReplacementIntent) {
    const payload = buildConditioningPayloadFromRequest({
      userMessage: message,
      seed: typeReplacementIntent,
    });
    return {
      mode: 'mutate',
      operation: 'add_conditioning',
      target: targetFromResolution(ref),
      payload,
      scope: detectScope(message, refDateBeforeToday),
      confidence: ref?.target ? 0.86 : 0.55,
      needsClarification: !ref?.target,
      clarificationQuestion: ref?.target
        ? undefined
        : 'Which day should I replace the conditioning on?',
      reason: 'replace_conditioning_prescription_detected',
    };
  }

  const parsedSwap = ADD_VERBS.test(message) ? null : parseModalitySwapRequest(message);

  // ─── 1d. Explicit whole-session modality conversion ─────────────
  // "Make Wednesday's session a SkiErg" targets the session itself.
  // That must beat last-mutation follow-up planning, otherwise an old
  // add-on in mutation history can steal the turn and create "rower +
  // SkiErg" while the chat claims a swap.
  if (parsedSwap?.targetedSession) {
    return buildModalitySwapCommand(input, parsedSwap, refDateBeforeToday);
  }

  // ─── 1d. CoachPlan follow-up edit ───────────────────────────────
  // "make them SkiErg" after adding HIIT row intervals is not a fresh
  // low-load add. It is a modality edit that should preserve the
  // source activity's training intent and prescription.
  const coachPlan = buildConditioningCoachPlan({
    userMessage: message,
    referenceResolution: ref,
    lastChange: input.lastChange,
  });
  if (coachPlan) {
    return {
      mode: 'mutate',
      operation: 'add_conditioning',
      target: coachPlan.target,
      payload: coachPlan.payload,
      scope: 'one_off',
      confidence: 0.92,
      needsClarification: false,
      reason: coachPlan.reason,
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
  const isPositiveBikeSubtype =
    bikeIntent.source === 'positive_regular' ||
    bikeIntent.source === 'positive_assault';
  const targetAlreadyBike = targetWorkoutHasModality(input, 'bike');
  const targetKnownNonBike = targetWorkoutHasAnyKnownNonBikeModality(input);
  const isSubtypeCorrection =
    bikeIntent.source === 'negation_assault' ||
    bikeIntent.source === 'negation_regular' ||
    bikeIntent.source === 'complaint_assault' ||
    targetAlreadyBike ||
    (isPositiveBikeSubtype && !targetKnownNonBike);
  const hasMutationCue =
    /\b(?:i\s+(?:just\s+)?want|prefer|rather|use|make\s+(?:it|that)|actually)\b/i.test(message) ||
    /\bnot\s+(?:an?\s+)?\w*\s*bike\b/i.test(message);
  if (bikeLabel && !ADD_VERBS.test(message) && isSubtypeCorrection && (isExplicitBikeIntent || hasMutationCue)) {
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
  const swap = parsedSwap;
  if (swap) {
    return buildModalitySwapCommand(input, swap, refDateBeforeToday);
  }

  // ─── 4. Whole-session removal ──────────────────────────────────
  // Explicit delete/skip/cancel of a day/session beats readiness
  // context. Specific activity targets ("remove the rower on Wed") keep
  // routing to remove_conditioning below.
  if (isWholeSessionRemoveRequest(message)) {
    return {
      mode: 'mutate',
      operation: 'remove_session',
      target: targetFromResolution(ref),
      payload: {
        operation: 'remove_session',
        targetSessionId: ref?.target?.sessionName ?? null,
        reason: fatigueReasonFromMessage(message),
      },
      scope: detectScope(message, refDateBeforeToday),
      confidence: ref?.target ? 0.86 : 0.5,
      needsClarification: !ref?.target,
      clarificationQuestion: ref?.target ? undefined : 'Which session should I remove?',
      missingFields: ref?.target ? undefined : ['target_session'],
      reason: 'remove_session_detected',
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

  // ─── 4c. Add/copy an existing session onto a target day ─────────
  // "Add Gunshow to that Wednesday" is a session-level add, not
  // add_conditioning and not edit_item. We only bind when the requested
  // session name matches a visible session template; the executor owns
  // the Rest-target verification before writing.
  const addSessionTemplate = extractAddSessionTemplate(input);
  if (addSessionTemplate) {
    return {
      mode: 'mutate',
      operation: 'add_session',
      target: targetFromResolution(ref),
      payload: {
        operation: 'add_session',
        sourceDate: addSessionTemplate.sourceDate,
        sourceSessionName: addSessionTemplate.sourceSessionName,
        targetSessionName: addSessionTemplate.sourceSessionName,
      },
      scope: 'one_off',
      confidence: ref?.target ? 0.82 : 0.5,
      needsClarification: !ref?.target,
      clarificationQuestion: ref?.target
        ? undefined
        : 'Which day should I add that session to?',
      missingFields: ref?.target ? undefined : ['target_session'],
      reason: 'add_session_detected',
    };
  }

  // ─── 5. Add conditioning ────────────────────────────────────────
  const replacementAddIntent = extractConditioningReplacementIntent(message);
  if (replacementAddIntent) {
    const payload = buildConditioningPayloadFromRequest({
      userMessage: message,
      seed: replacementAddIntent,
    });
    return {
      mode: 'mutate',
      operation: 'add_conditioning',
      target: targetFromResolution(ref),
      payload,
      scope: detectScope(message, refDateBeforeToday),
      confidence: ref?.target ? 0.82 : 0.55,
      needsClarification: !ref?.target,
      clarificationQuestion: ref?.target ? undefined : 'Which day should I make that replacement on?',
      reason: 'replace_conditioning_activity_detected',
    };
  }
  const addIntent = extractAddConditioningIntent(message);
  if (addIntent) {
    const payload = buildConditioningPayloadFromRequest({
      userMessage: message,
      seed: addIntent,
    });
    return {
      mode: 'mutate',
      operation: 'add_conditioning',
      target: targetFromResolution(ref),
      payload,
      scope: detectScope(message, refDateBeforeToday),
      confidence: ref?.target ? 0.7 : 0.45,
      needsClarification: !ref?.target,
      clarificationQuestion: ref?.target ? undefined : 'Which day do you want me to add conditioning to?',
      reason: 'add_conditioning_detected',
    };
  }
  if (ADD_VERBS.test(message)) {
    const hasTarget = !!ref?.target;
    return {
      mode: 'clarify',
      question: hasTarget
        ? `What should I add to ${formatTargetForQuestion(ref)} — light bike, light walk, mobility, or pilates?`
        : 'What should I add, and which day should it go on? For example: light bike on Friday, mobility today, or pilates tomorrow.',
      options: ['Light bike', 'Light walk', 'Mobility', 'Pilates'],
      missingFields: hasTarget ? ['activity'] : ['target_session', 'activity'],
      reason: hasTarget
        ? 'add_conditioning_missing_activity'
        : 'add_conditioning_missing_target_and_activity',
    };
  }

  // ─── 6. Remove conditioning ─────────────────────────────────────
  if (REMOVE_VERBS.test(message) && looksLikeConditioningRequest(message)) {
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
  if (
    replaceMatch &&
    !looksLikeModality(replaceMatch[1]) &&
    !looksLikeModality(replaceMatch[2]) &&
    !looksLikeSessionTargetLabel(replaceMatch[1]) &&
    !containsConditioningModalityPhrase(replaceMatch[2])
  ) {
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
  return /^(bike|row|rower|rowing|run|running|jog|jogging|ski|skierg|swim|swimming|sprint|cardio|conditioning|aerobic|walk|walking)$/.test(w);
}

function hasExplicitNonReadinessMutationCue(message: string): boolean {
  if (!message) return false;
  if (REMOVE_VERBS.test(message)) {
    return (
      isWholeSessionRemoveRequest(message) ||
      looksLikeConditioningRequest(message) ||
      /\b(?:exercise|block|item|session|workout|day|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(message)
    );
  }
  if (MOVE_VERBS.test(message)) return true;
  if (ADD_VERBS.test(message)) return true;
  if (/\b(?:replace|swap|substitut\w*)\b/i.test(message)) return true;
  if (/\b(?:change|make|set|adjust)\b/i.test(message)) {
    if (/\b(?:easier|lighter|lower[-\s]*load|reduce|deload|back\s+off)\b/i.test(message)) {
      return false;
    }
    return /\b(?:to|into|instead|recovery|rest|bike|rower?|ski\s*erg|skierg|run|sprints?|conditioning|cardio|pilates|yoga|mobility|flush|aerobic)\b/i.test(message);
  }
  return false;
}

function isUnderspecifiedRecoveryAdjustment(message: string): boolean {
  if (!/\badjust(?:ed|ing|s)?\b/i.test(message)) return false;
  if (!/\b(?:recovery|recover|mobility|flush|rest)\b/i.test(message)) return false;
  if (/\b(?:to|into|instead|rather|with|for|remove|drop|ditch|scrap|skip|cancel|add|include|put|longer|shorter|harder|easier|lighter|reduce|less|more|minutes?|mins?|\d{1,3}\s*(?:min|mins|minute|minutes))\b/i.test(message)) {
    return false;
  }
  return true;
}

function looksLikeConditioningRequest(message: string): boolean {
  if (!message) return false;
  // "Farmer's walks" and "walking lunges" are strength/carry exercises,
  // not the easy recovery walk athletes usually mean in chat.
  if (/\b(?:farmer'?s?|farmers)\s+walks?\b/i.test(message)) return false;
  if (/\bwalking\s+lunges?\b/i.test(message)) return false;
  return /\b(?:bike|row|rower|rowing|run|running|jog|jogging|ski|skierg|swim|swimming|cardio|conditioning|aerobic|sprints?|walks?|walking|recovery|flush|pilates|yoga|mobility|stretch(?:ing)?|foam\s*roll(?:ing)?|prehab|activation|breath(?:ing)?|core)\b/i.test(message);
}

function detectModality(message: string): ConditioningIntentModality | null {
  if (/\bbike|cycling|spin\b/i.test(message)) return 'bike';
  if (/\brow|rower|rowing\b/i.test(message)) return 'row';
  if (/\bski|skierg\b/i.test(message)) return 'ski';
  if (/\bsprint\w*\b/i.test(message)) return 'sprint';
  if (/\brun|running|jog|jogging\b/i.test(message)) return 'run';
  if (/\bswim\b/i.test(message)) return 'swim';
  if (/\b(?:walks?|walking)\b/i.test(message) && looksLikeConditioningRequest(message)) return 'walk';
  if (/\bcardio\b/i.test(message)) return 'cardio';
  if (/\baerobic|recovery|flush\b/i.test(message)) return 'aerobic';
  return null;
}

function isWholeSessionRemoveRequest(message: string): boolean {
  if (!REMOVE_VERBS.test(message)) return false;
  if (hasSpecificConditioningRemovalTarget(message)) return false;
  return hasWholeSessionRemovalLanguage(message) || hasDayReference(message);
}

function hasSpecificConditioningRemovalTarget(message: string): boolean {
  if (/\b(?:conditioning|cardio|aerobic|flush|bike|rower?|rowing|ski\s*erg|skierg|run|running|sprints?|walks?|walking|pilates|yoga|mobility|stretch(?:ing)?|core)\b/i.test(message)) {
    return !hasWholeSessionRemovalLanguage(message);
  }
  return /\b(?:block|item|exercise|efforts?|reps?|sets?|between\s+reps|recovery\s+between)\b/i.test(message);
}

function hasWholeSessionRemovalLanguage(message: string): boolean {
  return (
    /\b(?:whole|entire|full)\s+(?:session|workout|day|thing)\b/i.test(message) ||
    /\b(?:session|workout|day)\s+fully\b/i.test(message) ||
    /\bfully\s+(?:remove|drop|ditch|scrap|skip|cancel|cut|delete)\b/i.test(message) ||
    /\b(?:remove|drop|ditch|scrap|skip|cancel|cut|delete)\b[^.?!,;]*\b(?:session|workout|day)\b/i.test(message) ||
    /\b(?:that|this|the)\s+(?:session|workout)\b/i.test(message)
  );
}

function hasDayReference(message: string): boolean {
  return extractDow(message) !== null || /\b(?:today|tomorrow)\b/i.test(message);
}

function fatigueReasonFromMessage(message: string): string | undefined {
  return any(message, VAGUE_LOAD_REQUEST) ? 'fatigue/readiness context' : undefined;
}

export interface AddConditioningIntent {
  modality: ConditioningIntentModality | null;
  customActivity?: string;
  intensity?: AddConditioningIntensity;
  durationMinutes?: number;
  sets?: number;
  repsMin?: number;
  repsMax?: number;
  restSeconds?: number;
  prescriptionType?: 'duration' | 'duration_minutes';
  bikeLabel?: BikeLabel | null;
  effortKind?: 'sprint' | 'interval';
  replaceActivity?: string;
  trainingIntent?: CoachTrainingIntent;
  changeKind?: CoachPlanChangeKind;
  editMode?: CoachConditioningEditMode;
  editScope?: CoachConditioningEditScope;
}

const LOW_LOAD_CUSTOM_ACTIVITIES: Array<{ re: RegExp; label: string }> = [
  { re: /\bpilates\b/i, label: 'Pilates' },
  { re: /\byoga\b/i, label: 'Yoga' },
  { re: /\bmobility\b/i, label: 'Mobility' },
  { re: /\bstretch(?:ing)?\b/i, label: 'Stretching' },
  { re: /\bfoam\s*roll(?:ing)?\b/i, label: 'Foam Rolling' },
  { re: /\bprehab\b/i, label: 'Prehab' },
  { re: /\bactivation\b/i, label: 'Activation' },
  { re: /\bbreath(?:ing)?\b/i, label: 'Breathing' },
  { re: /\bcore\b/i, label: 'Core' },
];

export function extractAddConditioningIntent(
  message: string,
  opts?: { requireAddVerb?: boolean },
): AddConditioningIntent | null {
  const requireAddVerb = opts?.requireAddVerb ?? true;
  if (requireAddVerb && !ADD_VERBS.test(message)) return null;
  if (!looksLikeConditioningRequest(message)) return null;

  const modality = detectModality(message);
  const intensity = detectIntensity(message);
  const durationMinutes = detectDurationMinutes(message);
  const bikeLabel = modality === 'bike' || /\bbike\b/i.test(message)
    ? parseBikeSubtypeIntent(message).desiredLabel
    : null;
  const effortKind = detectEffortKind(message);
  const trainingIntent = detectRequestedTrainingIntent(message);
  const customActivity =
    detectCustomActivity(message, modality, intensity) ??
    detectSprintBikeActivity(modality, bikeLabel, effortKind);

  return {
    modality,
    customActivity,
    intensity,
    durationMinutes,
    bikeLabel,
    effortKind,
    trainingIntent,
  };
}

function extractConditioningReplacementIntent(message: string): AddConditioningIntent | null {
  const parsed = parseConditioningReplacementPhrase(message);
  if (!parsed) return null;

  const newPhrase = parsed.toActivity;
  if (!looksLikeConditioningRequest(newPhrase)) return null;
  const modality = detectModality(newPhrase);
  const intensity = detectIntensity(newPhrase) ?? detectIntensity(message);
  const durationMinutes = detectDurationMinutes(newPhrase) ?? detectDurationMinutes(message);
  const bikeLabel = modality === 'bike' || /\bbike\b/i.test(newPhrase)
    ? parseBikeSubtypeIntent(newPhrase).desiredLabel
    : null;
  const effortKind = detectEffortKind(newPhrase) ?? detectEffortKind(message);
  const trainingIntent = detectRequestedTrainingIntent(newPhrase) ?? detectRequestedTrainingIntent(message);
  const customActivity =
    detectCustomActivity(newPhrase, modality, intensity) ??
    detectSprintBikeActivity(modality, bikeLabel, effortKind);

  return {
    modality,
    customActivity,
    intensity,
    durationMinutes,
    bikeLabel,
    effortKind,
    replaceActivity: parsed.fromActivity,
    trainingIntent,
    editMode: 'update_existing',
    editScope: trainingIntent
      ? 'replace_conditioning_prescription'
      : 'edit_modality_only',
  };
}

function extractConditioningTypeReplacementIntent(
  input: RouteCoachCommandInput,
): AddConditioningIntent | null {
  const message = input.userMessage ?? '';
  const trainingIntent = detectRequestedTrainingIntent(message);
  if (!trainingIntent) return null;
  if (isExplainQuestion(message) || isInspectQuery(message)) return null;
  if (!looksLikeConditioningRequest(message)) return null;

  const hasAddVerb = ADD_VERBS.test(message);
  const hasReplacementCue =
    /\b(?:instead|rather|replace|swap|change|make|actually|set|turn|convert)\b/i.test(message);
  const clearAppend =
    hasAddVerb &&
    (!hasReplacementCue || /\b(?:after|extra|on\s+top|alongside|as\s+well)\b/i.test(message));
  if (clearAppend) return null;

  const hasExistingEditCue =
    /\b(?:make|change|swap|replace|instead|rather|actually|set|turn|convert)\b/i.test(message) ||
    /\b(?:it|that|this|them|session|workout)\b/i.test(message) ||
    !!input.referenceResolution?.target;
  if (!hasExistingEditCue) return null;

  const visibleSeed = inferVisibleConditioningSeed(input);
  const requestedModality = detectModality(message);
  const modality =
    requestedModality === 'sprint'
      ? visibleSeed.modality
      : requestedModality ?? visibleSeed.modality;
  const intensity =
    detectIntensity(message) ??
    (trainingIntent === 'tempo' ? 'moderate' : trainingIntent === 'aerobic' || trainingIntent === 'low_load' ? 'light' : 'hard');
  const bikeLabel =
    modality === 'bike' || /\bbike\b/i.test(message)
      ? parseBikeSubtypeIntent(message).desiredLabel ?? visibleSeed.bikeLabel
      : null;
  const effortKind =
    detectEffortKind(message) ??
    (trainingIntent === 'sprint'
      ? 'sprint'
      : trainingIntent === 'hiit' || trainingIntent === 'tempo'
      ? 'interval'
      : undefined);
  const customActivity =
    detectSprintBikeActivity(modality, bikeLabel, effortKind) ??
    detectCustomActivity(message, modality, intensity);

  return {
    modality,
    customActivity,
    intensity,
    durationMinutes: detectDurationMinutes(message),
    bikeLabel,
    effortKind,
    replaceActivity: visibleSeed.title,
    trainingIntent,
    editMode: 'update_existing',
    editScope: 'replace_conditioning_prescription',
  };
}

function inferVisibleConditioningSeed(input: RouteCoachCommandInput): {
  title?: string;
  modality: ConditioningIntentModality | null;
  bikeLabel: BikeLabel | null;
} {
  const target = findTargetVisibleSession(input);
  const workout = target?.workout;
  if (!workout) return { modality: null, bikeLabel: null };
  const options = workout.conditioningBlock?.options ?? [];
  const exercises = workout.exercises ?? [];
  const firstOption = options[0];
  const linkedExercises = firstOption
    ? exercises.filter((ex) => (firstOption.exerciseIds ?? []).includes(String(ex.id ?? '')))
    : [];
  const firstExercise = linkedExercises[0] ?? exercises[0];
  const title =
    String(firstOption?.title ?? '').trim() ||
    String(firstExercise?.exercise?.name ?? '').trim() ||
    String(workout.name ?? '').trim() ||
    undefined;
  const haystack = [
    workout.name ?? '',
    (workout as any).description ?? '',
    firstOption?.title ?? '',
    firstOption?.description ?? '',
    firstExercise?.exercise?.name ?? '',
    firstExercise?.exercise?.description ?? '',
    firstExercise?.notes ?? '',
  ].join(' ');
  const modality = detectModality(haystack);
  const bikeLabel =
    modality === 'bike'
      ? parseBikeSubtypeIntent(haystack).desiredLabel
      : null;
  return { title, modality, bikeLabel };
}

function parseConditioningReplacementPhrase(
  message: string,
): { fromActivity: string; toActivity: string } | null {
  const cleaned = message.trim();
  const newInsteadOfOld =
    /\b(?:actually\s+)?(?:i\s+)?(?:want|need|prefer|would\s+rather|use|do|make(?:\s+it)?|change(?:\s+it)?(?:\s+to)?|swap(?:\s+it)?(?:\s+to)?|replace(?:\s+it)?(?:\s+with)?)\s+(?:(?:some|a|an|the)\s+)?([^?.!,]+?)\s+(?:instead\s+of|rather\s+than)\s+(?:the\s+)?([^?.!,]+?)(?:\s+(?:today|tomorrow|this\s+week|on\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)))?\s*$/i.exec(cleaned);
  if (newInsteadOfOld) {
    return buildReplacementPhraseResult(newInsteadOfOld[2], newInsteadOfOld[1]);
  }

  const oldWithNew =
    /\b(?:replace|swap|change)\s+(?:the\s+)?([^?.!,]+?)\s+(?:with|for|to)\s+(?:(?:some|a|an|the)\s+)?([^?.!,]+?)(?:\s+(?:today|tomorrow|this\s+week|on\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)))?\s*$/i.exec(cleaned);
  if (oldWithNew) {
    return buildReplacementPhraseResult(oldWithNew[1], oldWithNew[2]);
  }

  return null;
}

function buildReplacementPhraseResult(
  fromRaw: string,
  toRaw: string,
): { fromActivity: string; toActivity: string } | null {
  const fromActivity = cleanReplacementActivityPhrase(fromRaw, { preserveIntensity: false });
  const toActivity = cleanReplacementActivityPhrase(toRaw, { preserveIntensity: true });
  if (!fromActivity || !toActivity) return null;
  if (/^(it|this|that|one|session|workout)$/i.test(fromActivity)) return null;
  if (/^(it|this|that|one|session|workout)$/i.test(toActivity)) return null;
  if (isDayOrDateLabel(fromActivity)) return null;
  return { fromActivity, toActivity };
}

function isDayOrDateLabel(value: string): boolean {
  const normalised = value.trim().toLowerCase();
  return (
    /^(today|tomorrow|monday|mon|tuesday|tue|wednesday|wed|thursday|thu|thurs|friday|fri|saturday|sat|sunday|sun)$/.test(normalised) ||
    /^\d{4}-\d{2}-\d{2}$/.test(normalised)
  );
}

function looksLikeSessionTargetLabel(value: string): boolean {
  const normalised = value
    .trim()
    .toLowerCase()
    .replace(/'s\b/g, '')
    .replace(/\b(?:the|this|that)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (isDayOrDateLabel(normalised)) return true;
  return (
    /^(?:session|workout|day|conditioning|cardio|aerobic flush|flush)$/.test(normalised) ||
    /^(?:monday|mon|tuesday|tue|wednesday|wed|thursday|thu|thurs|friday|fri|saturday|sat|sunday|sun|today|tomorrow)\s+(?:session|workout|day|conditioning|cardio|aerobic flush|flush)$/.test(normalised)
  );
}

function containsConditioningModalityPhrase(value: string): boolean {
  return /\b(?:assault\s+bike|air\s+bike|stationary\s+bike|regular\s+bike|normal\s+bike|ski\s*erg|skierg|rower|rowing|row|bike|cycling|run|running|swim|swimming|ski)\b/i.test(value);
}

function cleanReplacementActivityPhrase(
  raw: string,
  opts: { preserveIntensity: boolean },
): string | null {
  let value = raw
    .replace(/\b(?:please|actually|instead|rather)\b/gi, ' ')
    .replace(/\b(?:today|tomorrow|this\s+week|next\s+week)\b/gi, ' ')
    .replace(/\bon\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, ' ')
    .replace(/\b(?:session|workout|block|conditioning|cardio|aerobic)\b/gi, ' ')
    .replace(/\b(?:some|a|an|the)\b/gi, ' ');
  if (!opts.preserveIntensity) {
    value = value.replace(/\b(?:light|easy|gentle|recovery|flush|hard|heavy|moderate|steady|tempo)\b/gi, ' ');
  }
  value = value
    .replace(/\b\d{1,3}\s*(?:min|mins|minute|minutes)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!value || value.length > 48) return null;
  return value;
}

function detectIntensity(message: string): AddConditioningIntensity | undefined {
  if (/\b(?:light|easy|gentle|recovery|flush|low[-\s]*load|low[-\s]*impact|zone\s*2|z2|conversational)\b/i.test(message)) {
    return 'light';
  }
  if (/\b(?:hard|heavy|intense|high[-\s]*intensity|hiit|max|near[-\s]*max|sprint|all[-\s]*out)\b/i.test(message)) {
    return 'hard';
  }
  if (/\b(?:moderate|steady|tempo)\b/i.test(message)) {
    return 'moderate';
  }
  return undefined;
}

function detectEffortKind(message: string): 'sprint' | 'interval' | undefined {
  if (/\b(?:sprints?|sprint\s+efforts?|hill\s+sprints?|max\s+efforts?|all[-\s]*out|near[-\s]*max|peak\s+power)\b/i.test(message)) {
    return 'sprint';
  }
  if (/\b(?:intervals?|efforts?|repeats?)\b/i.test(message)) {
    return 'interval';
  }
  return undefined;
}

function detectSprintBikeActivity(
  modality: ConditioningIntentModality | null,
  bikeLabel: BikeLabel | null | undefined,
  effortKind: 'sprint' | 'interval' | undefined,
): string | undefined {
  if (modality !== 'bike' || effortKind !== 'sprint') return undefined;
  return bikeLabel === 'assault' ? 'Assault Bike Sprints' : 'Bike Sprints';
}

function detectDurationMinutes(message: string): number | undefined {
  return parseCoachDurationMinutes(message) ?? undefined;
}

function detectDurationSeconds(message: string): number | undefined {
  const match = /\b(\d{1,3})\s*(?:sec|secs|second|seconds)\b/i.exec(message);
  if (!match) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 5 || value > 120) return undefined;
  return value;
}

function inferFollowUpDurationMinutes(message: string): number | null {
  const exact = detectDurationMinutes(message);
  const moreThan = /\b(?:a\s+)?(?:bit|little|touch)?\s*(?:more|longer|over|above)\s+than\s+(\d{1,3})\s*(?:min|mins|minute|minutes)?\b/i.exec(message);
  if (moreThan) {
    const base = Number(moreThan[1]);
    if (!Number.isFinite(base) || base < 1 || base >= 180) return null;
    return Math.min(180, base + 5);
  }
  const over = /\b(?:over|above)\s+(\d{1,3})\s*(?:min|mins|minute|minutes)\b/i.exec(message);
  if (over) {
    const base = Number(over[1]);
    if (!Number.isFinite(base) || base < 1 || base >= 180) return null;
    return Math.min(180, base + 5);
  }
  if (exact != null && /\b(?:make|set|change|adjust|to|for|duration|time|mins?|minutes?)\b/i.test(message)) {
    return exact;
  }
  if (/\b(?:a\s+)?(?:bit|little|touch)\s+(?:more|longer)\b/i.test(message)) {
    return 25;
  }
  return null;
}

interface LastAddDurationEdit {
  durationMinutes?: number;
  sets?: number;
  repsMin?: number;
  repsMax?: number;
  restSeconds?: number;
  prescriptionType?: 'duration' | 'duration_minutes';
  intensity?: AddConditioningIntensity;
  trainingIntent?: CoachTrainingIntent;
  needsClarification?: boolean;
  clarificationQuestion?: string;
  options?: string[];
  missingFields?: string[];
  reason: string;
}

function inferLastAddDurationEdit(input: RouteCoachCommandInput): LastAddDurationEdit | null {
  const message = input.userMessage ?? '';
  const hasDurationEditCue =
    detectDurationMinutes(message) != null ||
    detectDurationSeconds(message) != null ||
    /\b(?:longer|more|increase|extend|lengthen|shorter|less|reduce|trim|duration|time)\b/i.test(message);
  if (!hasDurationEditCue) return null;

  const lastChange = input.lastChange;
  if (
    lastChange?.operation !== 'add_conditioning' ||
    (lastChange.target.kind !== 'date' && lastChange.target.kind !== 'exercise')
  ) {
    return null;
  }

  const lastAdd = inferLastAddedConditioningPayload(input);
  const primaryActivity = getLastTouchedConditioningActivity(input.lastChange);
  const targetDate = lastChange.target.kind === 'date' ? lastChange.target.date : lastChange.target.date;
  const visibleMatch = findVisibleActivityMatches({
    currentWeek: input.currentWeek ?? [],
    customActivity: lastAdd.customActivity,
    modality: lastAdd.modality,
  }).find((m) => m.date === targetDate);

  const isSprint =
    lastAdd.effortKind === 'sprint' ||
    primaryActivity?.effortKind === 'sprint' ||
    visibleMatch?.prescriptionType === 'duration' ||
    /\bsprints?\b/i.test(lastAdd.customActivity ?? '');

  const exactMinutes = inferFollowUpDurationMinutes(message);
  if (exactMinutes != null && !isSprint) {
    return {
      durationMinutes: exactMinutes,
      reason: 'last_add_duration_correction',
    };
  }

  if (isSprint) {
    const exactSeconds = detectDurationSeconds(message);
    const currentMin = visibleMatch?.repsMin ?? primaryActivity?.repsMin ?? 20;
    const currentMax = visibleMatch?.repsMax ?? primaryActivity?.repsMax ?? 30;
    const currentSets = visibleMatch?.sets ?? primaryActivity?.sets ?? 6;
    if (exactSeconds != null) {
      return {
        sets: currentSets,
        repsMin: exactSeconds,
        repsMax: exactSeconds,
        reason: 'last_add_sprint_duration_correction',
      };
    }
    if (exactMinutes != null) {
      const label = lastAdd.customActivity ?? primaryActivity?.title ?? 'sprint work';
      const intensity = detectIntensity(message);
      return {
        durationMinutes: exactMinutes,
        intensity,
        trainingIntent:
          detectRequestedTrainingIntent(message) ??
          (intensity === 'light' ? 'low_load' : undefined),
        prescriptionType: 'duration_minutes',
        needsClarification: true,
        clarificationQuestion:
          `Do you mean ${exactMinutes} minutes for the whole ${label} session, ` +
          'or do you want to change the sprint efforts or recovery between reps?',
        options: [
          `${exactMinutes}-minute total session`,
          'Sprint effort length',
          'Recovery between reps',
        ],
        missingFields: ['duration_scope'],
        reason: 'last_add_sprint_minute_duration_ambiguous',
      };
    }
    if (/\b(?:shorter|less|reduce|trim)\b/i.test(message)) {
      const nextMax = Math.max(10, currentMax - 10);
      const nextMin = Math.max(10, Math.min(currentMin - 5, nextMax));
      return {
        sets: currentSets,
        repsMin: nextMin,
        repsMax: nextMax,
        reason: 'last_add_sprint_duration_correction',
      };
    }
    if (/\b(?:longer|more|increase|extend|lengthen)\b/i.test(message)) {
      const nextMin = Math.min(60, currentMin + 5);
      const nextMax = Math.min(60, Math.max(currentMax + 10, nextMin));
      return {
        sets: currentSets,
        repsMin: nextMin,
        repsMax: nextMax,
        reason: 'last_add_sprint_duration_correction',
      };
    }
  }

  if (exactMinutes != null) {
    return {
      durationMinutes: exactMinutes,
      reason: 'last_add_duration_correction',
    };
  }

  const currentMinutes = visibleMatch?.durationMinutes ?? primaryActivity?.durationMinutes;
  const base =
    Number.isFinite(currentMinutes) && currentMinutes && currentMinutes > 0
      ? currentMinutes
      : 20;
  if (/\b(?:longer|more|increase|extend|lengthen)\b/i.test(message)) {
    return {
      durationMinutes: Math.min(180, base + 5),
      reason: 'last_add_duration_correction',
    };
  }
  if (/\b(?:shorter|less|reduce|trim)\b/i.test(message)) {
    return {
      durationMinutes: Math.max(5, base - 5),
      reason: 'last_add_duration_correction',
    };
  }
  return null;
}

function inferLastAddedConditioningPayload(
  input: RouteCoachCommandInput,
): Pick<AddConditioningIntent, 'modality' | 'customActivity' | 'intensity' | 'bikeLabel' | 'effortKind'> {
  const primaryActivity = getLastTouchedConditioningActivity(input.lastChange);
  const sourceText = [
    input.lastChange?.userMessage ?? '',
    input.lastChange?.appliedReply ?? '',
    ...(input.recentMessages ?? []).slice(-4).map((m) => m.content),
  ].join(' ');
  const fromAddIntent = extractAddConditioningIntent(input.lastChange?.userMessage ?? '');
  const customActivity =
    primaryActivity?.title ??
    fromAddIntent?.customActivity ??
    detectCustomActivity(sourceText, fromAddIntent?.modality ?? null, fromAddIntent?.intensity) ??
    extractAddedActivityFromReply(input.lastChange?.appliedReply ?? '') ??
    undefined;
  const modality =
    (primaryActivity?.modality as ConditioningIntentModality | null | undefined) ??
    fromAddIntent?.modality ??
    detectModality(sourceText);
  const intensity =
    (primaryActivity?.intensity as AddConditioningIntensity | undefined) ??
    fromAddIntent?.intensity ??
    detectIntensity(sourceText) ??
    'light';
  const bikeLabel = (primaryActivity?.bikeLabel as BikeLabel | null | undefined) ?? fromAddIntent?.bikeLabel ?? (
    modality === 'bike' || /\bbike\b/i.test(sourceText)
      ? parseBikeSubtypeIntent(sourceText).desiredLabel
      : null
  );
  const effortKind =
    (primaryActivity?.effortKind as 'sprint' | 'interval' | undefined) ??
    fromAddIntent?.effortKind ??
    detectEffortKind(sourceText);
  return {
    modality,
    customActivity,
    intensity,
    bikeLabel,
    effortKind,
  };
}

function getLastTouchedConditioningActivity(
  lastChange: RouteCoachCommandInput['lastChange'],
): MutationTouchedActivity | undefined {
  return lastChange?.touchedActivities?.find((activity) => activity.kind === 'conditioning');
}

type NamedActivityDurationEdit =
  | {
      status: 'resolved';
      date: string;
      sessionName?: string;
      customActivity?: string;
      modality: ConditioningIntentModality | null;
      intensity: AddConditioningIntensity;
      durationMinutes: number;
      matchedExisting: boolean;
      sourceActivity?: string;
    }
  | {
      status: 'ambiguous';
      question: string;
      options?: string[];
    };

interface VisibleActivityMatch {
  date: string;
  sessionName?: string;
  title: string;
  durationMinutes?: number;
  sets?: number;
  repsMin?: number;
  repsMax?: number;
  prescriptionType?: string;
}

function inferNamedActivityDurationEdit(
  input: RouteCoachCommandInput,
): NamedActivityDurationEdit | null {
  const message = input.userMessage ?? '';
  const hasDurationEditCue =
    detectDurationMinutes(message) != null ||
    /\b(?:longer|more|increase|extend|lengthen|shorter|less|reduce|trim|duration|time)\b/i.test(message);
  if (!hasDurationEditCue) return null;

  const modality = detectModality(message);
  const intensity = detectIntensity(message) ?? 'light';
  const customActivity = detectCustomActivity(message, modality, intensity);
  if (!customActivity && !modality) return null;

  const matches = findVisibleActivityMatches({
    currentWeek: input.currentWeek ?? [],
    customActivity,
    modality,
  });
  const refDate = input.referenceResolution?.target?.date ?? null;
  const refMatch = refDate ? matches.find((m) => m.date === refDate) : undefined;
  const todayMatch = matches.find((m) => m.date === input.todayISO);
  const chosen =
    refMatch ??
    (matches.length === 1 ? matches[0] : undefined) ??
    (matches.length > 1 ? todayMatch : undefined);

  if (matches.length > 1 && !chosen) {
    const label = customActivity ?? humanConditioningLabel(modality ?? 'conditioning');
    return {
      status: 'ambiguous',
      question: `I found more than one ${label} option this week. Which day should I make longer?`,
      options: matches.map((m) => `${shortDay(m.date)} ${m.date}`),
    };
  }

  const fallbackDate = refDate;
  const targetDate = chosen?.date ?? fallbackDate;
  if (!targetDate) {
    const label = customActivity ?? humanConditioningLabel(modality ?? 'conditioning');
    return {
      status: 'ambiguous',
      question: `I can't find ${label} in this week's program. Which day should I change?`,
      options: visibleWorkoutOptions(input.currentWeek ?? []),
    };
  }

  const durationMinutes = inferDurationMinutesFromDurationEdit(
    message,
    chosen?.durationMinutes,
  );
  if (durationMinutes == null) return null;

  return {
    status: 'resolved',
    date: targetDate,
    sessionName: chosen?.sessionName ?? input.referenceResolution?.target?.sessionName,
    customActivity: customActivity ?? chosen?.title,
    modality,
    intensity,
    durationMinutes,
    matchedExisting: !!chosen,
    sourceActivity: chosen?.title,
  };
}

function inferDurationMinutesFromDurationEdit(
  message: string,
  currentMinutes?: number,
): number | null {
  const hasExplicitDuration =
    detectDurationMinutes(message) != null ||
    /\b(?:more|longer|over|above)\s+than\s+\d{1,3}\b/i.test(message) ||
    /\b(?:over|above)\s+\d{1,3}\s*(?:min|mins|minute|minutes)\b/i.test(message);
  if (hasExplicitDuration) return inferFollowUpDurationMinutes(message);

  const base =
    Number.isFinite(currentMinutes) && currentMinutes && currentMinutes > 0
      ? currentMinutes
      : 20;
  if (/\b(?:longer|more|increase|extend|lengthen)\b/i.test(message)) {
    return Math.min(180, base + 5);
  }
  if (/\b(?:shorter|less|reduce|trim)\b/i.test(message)) {
    return Math.max(5, base - 5);
  }
  return null;
}

function findVisibleActivityMatches(args: {
  currentWeek: VisibleSessionRef[];
  customActivity?: string;
  modality: ConditioningIntentModality | null;
}): VisibleActivityMatch[] {
  const { currentWeek, customActivity, modality } = args;
  const seen = new Set<string>();
  const matches: VisibleActivityMatch[] = [];

  for (const day of currentWeek) {
    const workout = day.workout;
    if (!workout) continue;
    const sessionName = day.sessionName ?? workout.name ?? 'session';
    const exercises = workout.exercises ?? [];
    const options = workout.conditioningBlock?.options ?? [];

    for (const option of options) {
      const optionText = [
        option.title ?? '',
        option.description ?? '',
        ...exercises
          .filter((ex) => (option.exerciseIds ?? []).includes(String(ex.id ?? '')))
          .flatMap((ex) => [ex.exercise?.name ?? '', ex.exercise?.description ?? '', ex.notes ?? '']),
      ].join(' ');
      if (!activityTextMatches(optionText, customActivity, modality)) continue;
      const linkedExercises = exercises.filter((ex) =>
        (option.exerciseIds ?? []).includes(String(ex.id ?? '')),
      );
      const title =
        String(option.title ?? '').trim() ||
        String(linkedExercises[0]?.exercise?.name ?? '').trim() ||
        customActivity ||
        humanConditioningLabel(modality ?? 'conditioning');
      const key = `${day.date}:${normaliseActivityText(title)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({
        date: day.date,
        sessionName,
        title,
        durationMinutes: extractVisibleDurationMinutes(optionText, linkedExercises),
        ...extractVisiblePrescription(linkedExercises),
      });
    }

    for (const ex of exercises) {
      const text = [ex.exercise?.name ?? '', ex.exercise?.description ?? '', ex.notes ?? ''].join(' ');
      if (!activityTextMatches(text, customActivity, modality)) continue;
      const title =
        String(ex.exercise?.name ?? '').trim() ||
        customActivity ||
        humanConditioningLabel(modality ?? 'conditioning');
      const key = `${day.date}:${normaliseActivityText(title)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({
        date: day.date,
        sessionName,
        title,
        durationMinutes: extractVisibleDurationMinutes(text, [ex]),
        ...extractVisiblePrescription([ex]),
      });
    }
  }

  return matches;
}

function activityTextMatches(
  text: string,
  customActivity: string | undefined,
  modality: ConditioningIntentModality | null,
): boolean {
  const haystack = normaliseActivityText(text);
  if (!haystack) return false;
  if (customActivity) {
    const wanted = normaliseActivityText(customActivity);
    if (wanted && haystack.includes(wanted)) return true;
  }
  if (!modality) return false;
  const termsByModality: Record<string, string[]> = {
    bike: ['bike', 'cycling', 'spin', 'stationarybike'],
    row: ['row', 'rower', 'rowing'],
    rower: ['row', 'rower', 'rowing'],
    run: ['run', 'running', 'jog', 'jogging'],
    ski: ['ski', 'skierg'],
    swim: ['swim', 'swimming'],
    walk: ['walk', 'walking'],
    cardio: ['cardio'],
    aerobic: ['aerobic', 'recovery', 'flush'],
    sprint: ['sprint'],
    mixed: ['metcon', 'conditioning'],
  };
  return (termsByModality[modality] ?? [modality]).some((term) =>
    haystack.includes(normaliseActivityText(term)),
  );
}

function normaliseActivityText(value: string | undefined): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function humanConditioningLabel(modality: string): string {
  switch (modality) {
    case 'bike': return 'bike';
    case 'row':
    case 'rower': return 'row';
    case 'run': return 'run';
    case 'ski': return 'SkiErg';
    case 'swim': return 'swim';
    case 'walk': return 'walk';
    case 'cardio': return 'cardio';
    case 'aerobic': return 'aerobic work';
    case 'sprint': return 'sprint work';
    default: return 'conditioning';
  }
}

function extractVisibleDurationMinutes(
  text: string,
  exercises: NonNullable<VisibleSessionRef['workout']>['exercises'],
): number | undefined {
  for (const ex of exercises ?? []) {
    const repsMax = Number(ex.prescribedRepsMax ?? 0);
    const repsMin = Number(ex.prescribedRepsMin ?? 0);
    if (ex.prescriptionType === 'duration_minutes') {
      const minutes = repsMax || repsMin;
      if (minutes > 0) return minutes;
    }
  }
  return detectDurationMinutes(text);
}

function extractVisiblePrescription(
  exercises: NonNullable<VisibleSessionRef['workout']>['exercises'],
): Pick<VisibleActivityMatch, 'sets' | 'repsMin' | 'repsMax' | 'prescriptionType'> {
  for (const ex of exercises ?? []) {
    const repsMin = Number(ex.prescribedRepsMin ?? 0);
    const repsMax = Number(ex.prescribedRepsMax ?? 0);
    const sets = Number(ex.prescribedSets ?? 0);
    const prescriptionType =
      typeof ex.prescriptionType === 'string' ? ex.prescriptionType : undefined;
    if (repsMin > 0 || repsMax > 0 || sets > 0 || prescriptionType) {
      return {
        sets: sets > 0 ? sets : undefined,
        repsMin: repsMin > 0 ? repsMin : undefined,
        repsMax: repsMax > 0 ? repsMax : undefined,
        prescriptionType,
      };
    }
  }
  return {};
}

function visibleWorkoutOptions(currentWeek: VisibleSessionRef[]): string[] {
  return currentWeek
    .filter((d) => !!d.workout)
    .map((d) => `${shortDay(d.date)} ${d.date}`);
}

function shortDay(iso: string): string {
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
    new Date(`${iso}T12:00:00`).getDay()
  ];
  return dow ?? iso;
}

function extractAddedActivityFromReply(reply: string): string | undefined {
  const m = /\badded\s+(?:a|an)?\s*([A-Za-z][A-Za-z\s-]{1,40}?)\s+(?:to|for|on)\b/i.exec(reply);
  if (!m) return undefined;
  const raw = m[1].trim().replace(/\s+/g, ' ');
  if (!raw || /\bconditioning\s+block\b/i.test(raw)) return undefined;
  return raw
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function detectCustomActivity(
  message: string,
  modality: ConditioningIntentModality | null,
  intensity: AddConditioningIntensity | undefined,
): string | undefined {
  const namedConditioning = detectNamedConditioningActivity(message);
  if (namedConditioning) return namedConditioning;

  for (const activity of LOW_LOAD_CUSTOM_ACTIVITIES) {
    if (activity.re.test(message)) return activity.label;
  }

  if (modality === 'walk') return intensity === 'hard' ? 'Walk' : 'Light Walk';
  const describedActivity = extractDescribedConditioningActivity(message);
  if (describedActivity) return toTitleCase(describedActivity);
  if (modality && intensity === 'light') {
    const labelByModality: Record<string, string> = {
      bike: 'Light Bike',
      row: 'Light Row',
      run: 'Easy Run',
      ski: 'Light SkiErg',
      swim: 'Easy Swim',
      cardio: 'Light Cardio',
      aerobic: 'Light Aerobic',
      sprint: 'Sprint Intervals',
      mixed: 'Mixed Conditioning',
    };
    return labelByModality[modality];
  }
  if (modality) return undefined;

  const freeform = extractFreeformAddActivity(message);
  if (freeform && isSafeFreeformAddActivity(freeform)) return toTitleCase(freeform);
  return undefined;
}

function extractDescribedConditioningActivity(message: string): string | null {
  const addPhrase =
    new RegExp(`\\b${ADD_ACTION_WORDS}\\s+(?:(?:a|an|some|the)\\s+)?([^?.!,]+?)(?=\\s+\\b(?:to|onto|on|for|after|before|into)\\b|\\s*$)`, 'i').exec(message)?.[1];
  let value = (addPhrase ?? message)
    .replace(/\b(?:can|could|would)\s+you\b/gi, ' ')
    .replace(/\b(?:please|actually|instead|rather)\b/gi, ' ')
    .replace(/\b(?:want|need|prefer|make|change|swap|replace|with|for|to|do)\b/gi, ' ')
    .replace(/\b(?:today|tomorrow|this\s+week|next\s+week)\b/gi, ' ')
    .replace(/\bon\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, ' ')
    .replace(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)'?s?\b/gi, ' ')
    .replace(/\b\d{1,3}\s*(?:min|mins|minute|minutes)\b/gi, ' ')
    .replace(/\b(?:session|workout|block|conditioning|cardio|aerobic)\b/gi, ' ')
    .replace(/\b(?:some|a|an|the|it|this|that)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!value || value.length > 48) return null;
  if (isGenericConditioningActivityLabel(value)) return null;
  if (!looksLikeConditioningRequest(value) && !looksLikeConditioningRequest(message)) return null;
  if (!isSafeFreeformAddActivity(value) && !isSafeConditioningFreeformActivity(value)) return null;
  return value;
}

function isGenericConditioningActivityLabel(activity: string): boolean {
  const normalized = activity
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(?:light|easy|gentle|hard|moderate|steady|tempo|recovery|flush)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [
    'bike',
    'cycling',
    'row',
    'rower',
    'rowing',
    'run',
    'running',
    'jog',
    'jogging',
    'walk',
    'walking',
    'ski',
    'skierg',
    'swim',
    'swimming',
    'sprint',
    'sprints',
    'interval',
    'intervals',
    'cardio',
    'conditioning',
    'aerobic',
  ].includes(normalized);
}

function detectNamedConditioningActivity(message: string): string | undefined {
  const patterns: Array<{ re: RegExp; fallback?: string }> = [
    { re: /\b((?:hard|easy|light|moderate|tempo)?\s*hill\s+(?:running|runs?|sprints?))\b/i },
    { re: /\b((?:hard|easy|light|moderate|tempo)\s+running)\b/i },
    { re: /\b(tempo\s+runn?ing|tempo\s+runs?)\b/i, fallback: 'Tempo Running' },
  ];
  for (const pattern of patterns) {
    const match = pattern.re.exec(message);
    if (!match) continue;
    const label = (match[1] ?? pattern.fallback ?? '').replace(/\s+/g, ' ').trim();
    if (!label) continue;
    return toTitleCase(label);
  }
  return undefined;
}

function extractFreeformAddActivity(message: string): string | null {
  const match = new RegExp(`\\b${ADD_ACTION_WORDS}\\s+(?:(?:a|an|some|the)\\s+)?([^?.!,]+?)(?=\\s+\\b(?:to|onto|on|for|after|before|into)\\b|\\s*$)`, 'i').exec(message);
  if (!match) return null;
  let value = match[1]
    .replace(/\b(?:light|easy|gentle|recovery|flush|hard|heavy|moderate|steady|tempo)\b/gi, ' ')
    .replace(/\b\d{1,3}\s*(?:min|mins|minute|minutes)\b/gi, ' ')
    .replace(/\b(?:session|workout|block|conditioning|cardio|aerobic)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!value || value.length > 40) return null;
  return value;
}

function isSafeFreeformAddActivity(activity: string): boolean {
  if (!activity) return false;
  if (/\b(?:squat|deadlift|bench|press|rdl|clean|snatch|jerk|lunge|row|curl|extension|raise|carry|carries|kg|reps?|sets?)\b/i.test(activity)) {
    return false;
  }
  return /^[a-z][a-z\s/-]{1,39}$/i.test(activity);
}

function isSafeConditioningFreeformActivity(activity: string): boolean {
  if (!activity) return false;
  if (!/\b(?:hiit|high[-\s]*intensity|intervals?|sprints?|efforts?|tempo|flush|row(?:ing|er)?|bike|run(?:ning)?|ski(?:erg)?|swim(?:ming)?|walk(?:ing)?|pilates|mobility|yoga)\b/i.test(activity)) {
    return false;
  }
  if (/\b(?:squat|deadlift|bench|press|rdl|clean|snatch|jerk|lunge|curl|extension|raise|carry|carries|kg|reps?|sets?)\b/i.test(activity)) {
    return false;
  }
  return /^[a-z0-9][a-z0-9\s/-]{1,48}$/i.test(activity);
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => word.length <= 3 && word === word.toUpperCase()
      ? word
      : /^(hiit|mas)$/i.test(word)
      ? word.toUpperCase()
      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
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
