/**
 * coachIntent.ts — structured intent schema for the coach pipeline.
 *
 * ARCHITECTURE
 *
 *   LLM = conversation brain / intent parser
 *   UAE / deterministic engines = program authority
 *   UI = verified visible state
 *
 * The LLM returns a `CoachIntent` (this module's discriminated union),
 * NOT a program mutation. CoachScreen dispatches based on the intent
 * kind:
 *
 *   new_injury_report           → severity clarifier + UAE
 *   injury_severity_reply       → pending-injury resolver + UAE
 *   active_injury_followup      → progression handler (improving / worse / resolved)
 *   why_didnt_program_change    → coachStateInspector (explain, then maybe re-apply)
 *   program_explanation         → explain visible programming choice
 *   session_mismatch_question   → visible program explanation, no injury clarifier
 *   request_program_adjustment  → UAE / coachActions
 *   fatigue / missed_session
 *   exercise_swap               → UAE
 *   general_question            → free-form LLM reply (no mutation)
 *
 * Only the deterministic engines mutate program state. The LLM never
 * writes overrides directly. Visible-diff verification still applies
 * to every mutation.
 *
 * PLUGGABLE CLASSIFIER
 *
 * The `CoachIntentClassifier` interface is the seam. Production wires
 * a real LLM-backed implementation (edge function with structured
 * output / tool use). Tests inject a deterministic mock that returns
 * scripted intents, so the conversational dispatcher can be validated
 * without an LLM call.
 */

import type { ResolvedDay } from './sessionResolver';
import type { InjuryState } from './injuryProgression';
import type { CoachUpdate, ActiveConstraint } from '../store/coachUpdatesStore';
import type { CoachContextEntry } from '../store/coachContextStateStore';
import type { MutationHistoryEntry } from '../store/coachMutationHistoryStore';
import type { CoachReferenceResolution } from './coachReferenceResolver';

// ─── Intent schema ──────────────────────────────────────────────────

export type CoachIntentKind =
  | 'new_injury_report'
  | 'injury_severity_reply'
  | 'active_injury_followup'
  | 'why_didnt_program_change'
  | 'program_explanation'
  | 'session_mismatch_question'
  | 'request_program_adjustment'
  | 'fatigue'
  | 'soreness'
  | 'busy_week'
  | 'missed_session'
  | 'exercise_swap'
  | 'general_question';

export interface CoachIntentPayload {
  /** Free-text body part (raw, not bucket — the engine resolves). */
  bodyPart?: string;
  /** Pain rating 1..10. */
  severity?: number;
  /** ISO YYYY-MM-DD reference for "why didn't X change?" / requests. */
  requestedDate?: string;
  /** Workout name reference for "why are deadlifts still in Lower?". */
  requestedSession?: string;
  /** Free-text athlete concern, surfaced into replies / state inspector. */
  concern?: string;
  /** Status update for active_injury_followup: 'better' / 'worse' / etc. */
  followupKind?: 'resolved' | 'improving' | 'worsening' | 'unchanged';
  /** Structured program-edit action when intent=request_program_adjustment. */
  operation?: string;
  action?: string;
  targetDate?: string;
  targetSessionName?: string;
  activity?: string;
  customActivity?: string;
  newActivity?: string;
  oldActivity?: string;
  fromActivity?: string;
  toActivity?: string;
  replaceActivity?: string;
  replacingActivity?: string;
  modality?: string;
  intensity?: string;
  durationMinutes?: number;
  minutes?: number;
  durationSeconds?: number;
  seconds?: number;
  sets?: number;
  repsMin?: number;
  repsMax?: number;
  bikeLabel?: string;
  effortKind?: string;
  trainingIntent?: string;
  changeKind?: string;
  scope?: string;
}

export type ProgramAdjustmentAction =
  | 'add_conditioning'
  | 'remove_session'
  | 'remove_conditioning'
  | 'move_session';

export type ProgramAdjustmentNeed =
  | 'conditioning_type';

export type ProgramAdjustmentConditioningOption =
  | 'light_aerobic_intervals'
  | 'short_bike_flush'
  | 'tempo_running'
  | 'custom';

export interface PendingCoachProposal {
  type: 'program_adjustment';
  target?: string;
  targetDay?: string;
  targetDate?: string;
  targetSessionName?: string;
  action: ProgramAdjustmentAction;
  needs?: ProgramAdjustmentNeed;
  supportedOptions?: ProgramAdjustmentConditioningOption[];
  conditioningOption?: ProgramAdjustmentConditioningOption;
  prescription?: string;
  modality?: string;
  allowNonStrengthTarget?: boolean;
  createdAt: number;
}

/**
 * The structured intent a classifier returns. `confidence` lets the
 * dispatcher choose to ask a clarification question on borderline
 * cases instead of dispatching incorrectly. `needsClarification`
 * forces the clarification path when true.
 */
export interface CoachIntent {
  intent: CoachIntentKind;
  /** 0..1 model confidence. Below ~0.6 callers should consider clarification. */
  confidence: number;
  needsClarification: boolean;
  /** Question to ask when needsClarification === true. */
  clarificationQuestion?: string;
  payload?: CoachIntentPayload;
  /** Free-text rationale (for logs / UI debug). */
  rationale?: string;
}

// ─── Context packet ─────────────────────────────────────────────────

/**
 * Rich state passed alongside the user message to the classifier so
 * the LLM has enough context to differentiate "new injury" from
 * "follow-up" without us hard-coding phrase guards.
 *
 * All fields are read-only snapshots of the moment the message was
 * sent. The classifier MUST NOT mutate state — mutations belong to
 * the deterministic engines that run after dispatch.
 */
export interface CoachContextPacket {
  /** The full user message just submitted. */
  userMessage: string;
  /** Recent chat — last N messages, oldest first. */
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Active injury, if any. Drives most of the disambiguation logic. */
  activeInjury: InjuryState | null;
  /**
   * All active constraints — injuries, fatigue, soreness, schedule, etc.
   * Used by the constraint-resolution detector that runs BEFORE the
   * LLM intent classifier so a message like "no fatigue anymore" can
   * clear the right constraint without being re-classified as a fresh
   * fatigue report.
   */
  activeConstraints: ActiveConstraint[];
  /**
   * Pending injury context from a prior clarifier turn. When present,
   * a severity-only reply ("9") MUST bind to pending.bodyPart even
   * if activeInjury exists for a different body part. This is the
   * fix for the live "shoulder severity applied to hammy" bug.
   */
  pendingInjury?: {
    bodyPart: string;
    timestamp: number;
  } | null;
  /**
   * Pending deterministic program edit proposal. A confirmation like
   * "sounds good" must bind to this instead of falling through as
   * generic chat.
   */
  pendingCoachProposal?: PendingCoachProposal | null;
  /** Active Coach Update card for the displayed week, if present. */
  coachUpdate: CoachUpdate | null;
  /** Current-week resolved days — what the athlete sees on the Program tab. */
  currentWeek: ResolvedDay[];
  /** Next-week resolved days — for "next week is unchanged" type queries. */
  nextWeek: ResolvedDay[];
  /** Session feedback keyed by ISO date. Used to avoid editing completed sessions. */
  sessionFeedback?: Record<string, { completion?: string }>;
  /** ISO date the message was sent. Locks classifier reasoning to a clock. */
  todayISO: string;

  /**
   * Phase 2 — durable coach target context. Populated from
   * coachContextStateStore so the dispatcher / reference resolver
   * can bind "it" / "that session" / "the row" to a concrete date.
   * Each entry is fresh-only (TTL applied at packet build time);
   * stale entries are filtered out and presented as null.
   */
  lastOpenedWorkout?: CoachContextEntry | null;
  lastExplainedSession?: CoachContextEntry | null;
  lastDiscussedWorkout?: CoachContextEntry | null;
  /** Most recent verified coach mutation with structured touched items. */
  lastMutation?: Pick<
    MutationHistoryEntry,
    'operation' | 'mutationKind' | 'affectedDates' | 'scope' | 'touchedActivities' | 'timestamp'
  > | null;
  /**
   * Phase 2 — pre-computed reference resolution outcome. The packet
   * builder runs the resolver before classification so the dispatcher
   * (and downstream truth gate) can short-circuit on
   * unresolvable / ambiguous references without re-running the logic.
   */
  referenceResolution?: CoachReferenceResolution;
}

// ─── Classifier seam ─────────────────────────────────────────────────

/**
 * Pluggable intent classifier. Production wires a real LLM call
 * (edge function with structured output); tests inject a mock.
 *
 *   classify(packet) → Promise<CoachIntent>
 *
 * Implementations MUST be pure side-effect-free (no store writes).
 * The dispatcher is responsible for any state mutation.
 */
export interface CoachIntentClassifier {
  classify(packet: CoachContextPacket): Promise<CoachIntent> | CoachIntent;
}

// ─── Production system prompt (used by the LLM-backed classifier) ──

/**
 * The prompt the LLM-backed classifier sends. Lives here so the rules
 * stay in lock-step with the schema — tests assert against this same
 * string when validating the production wiring.
 *
 * The model is instructed to return JSON matching `CoachIntent`. The
 * dispatcher validates the shape before acting.
 */
export const COACH_INTENT_SYSTEM_PROMPT = `You are the intent classifier for a strength coach app.

Your job is to read the athlete's latest message + the surrounding context and return a JSON object that matches this schema:

{
  "intent": "<one of: new_injury_report | injury_severity_reply | active_injury_followup | why_didnt_program_change | program_explanation | session_mismatch_question | request_program_adjustment | fatigue | soreness | busy_week | missed_session | exercise_swap | general_question>",
  "confidence": <0..1>,
  "needsClarification": <boolean>,
  "clarificationQuestion": "<string if needsClarification>",
  "payload": {
    "bodyPart": "<optional, free-text>",
    "severity": <optional, 1..10>,
    "requestedDate": "<optional, YYYY-MM-DD>",
    "requestedSession": "<optional>",
    "concern": "<optional, free-text>",
    "followupKind": "<optional: resolved | improving | worsening | unchanged>",
    "operation": "<for program edits: add_conditioning | remove_session | remove_conditioning | replace_conditioning | move_session | replace_exercise | change_duration>",
    "targetDate": "<optional, YYYY-MM-DD>",
    "targetSessionName": "<optional>",
    "activity": "<new activity to add, preserve exact terms like HIIT rowing intervals, hard hill running, Pilates, assault bike sprints>",
    "replaceActivity": "<existing activity being replaced, e.g. Pilates>",
    "durationMinutes": <optional number>,
    "durationSeconds": <optional number, for sprint/effort reps>,
    "sets": <optional number>,
    "repsMin": <optional number>,
    "repsMax": <optional number>,
    "modality": "<optional: bike | row | run | walk | ski | swim | cardio | aerobic | sprint>",
    "intensity": "<optional: light | moderate | hard>",
    "bikeLabel": "<optional: standard | assault>",
    "effortKind": "<optional: sprint | interval>",
    "trainingIntent": "<optional: hiit | sprint | tempo | aerobic | low_load>",
    "changeKind": "<optional: modality | training_intent | modality_and_training_intent>",
    "scope": "<optional: one_off | this_week | recurring | permanent>"
  },
  "rationale": "<one sentence>"
}

CRITICAL RULES

1. If \`activeInjury\` is set in context AND the message references the same body part (or no specific body part), DO NOT classify as new_injury_report. Use active_injury_followup or why_didnt_program_change.

2. If \`activeInjury\` is set and the user just gives a number ("4/10"), this is injury_severity_reply with payload.severity (interpret as the new severity for the EXISTING injury).

3. Severity clarification (needsClarification=true with "How bad is it?") is ONLY appropriate when:
   - no activeInjury exists, AND
   - the user is reporting a NEW injury, AND
   - severity is missing.
   Never ask severity if activeInjury.severity is already set unless the user explicitly reports a different injury.

4. "why didn't X change?" / "why are deadlifts still there?" / "should I still train?" → why_didnt_program_change. Do not classify as a new request unless it's clear they want a NEW change.

5. Different body part with activeInjury → may be a NEW injury — classify as new_injury_report (the dispatcher will handle the severity clarifier flow if needed).

6. Programming rationale and session naming/display mismatch questions are NOT injuries. Classify as program_explanation or session_mismatch_question, never new_injury_report:
   - "why did you put a mid week row in?"
   - "why is there a row on Wednesday?"
   - "why am I rowing instead of running?"
   - "why is this a zone 2 row?"
   - "upper pull", "pull day", "pull session", "push/pull", "upper/lower" are training terms unless paired with explicit injury language.
   - "why is upper pull on Wednesday a rowing session?"
   - "why do I have upper pull listed as Wednesday but it opens as rowing?"
   - "why does Wednesday say X but open as Y?"
   - "session mismatch", "rowing session"
   Only ask pain out of 10 when explicit pain/injury words are present: pain, hurt, sore, soreness, strain, injured, tight, tweaked, pulled my hamstring/back/groin.

7. Non-injury signals — disambiguate carefully:
   - "fatigue" — global tired / cooked / drained / smashed without specific body part ("feeling cooked this week", "exhausted"). Estimate severity 1..10 from intensity language.
   - "soreness" — localised muscle soreness, NOT injury-level pain ("quads are sore", "tight calves", "DOMS"). payload.bodyPart is required. Severity 1..10 from descriptors.
   - "busy_week" — schedule constraint: limited time / capacity ("crazy week ahead", "can only train twice", "exam week"). Set payload.severity=5 by default.
   - "missed_session" — past tense report of skipping a session ("missed Tuesday", "didn't get to the field session"). Capture payload.requestedDate when given.

8. Program adjustment requests:
   - "add conditioning to Monday", "chuck some HIIT rowing intervals on Tuesday", "slot in a rower session Friday", "remove conditioning from Friday", "can we move Monday" → request_program_adjustment.
   - If pendingCoachProposal is set and the user says "sounds good", "yes", "do it", or similar confirmation, classify as request_program_adjustment, not general_question.
   - For supported edits, fill the structured edit fields in payload. Preserve the athlete's actual requested activity words. "HIIT rowing intervals" must not become "row"; "assault bike sprints" must not become "bike intervals"; "hard hill running" must not become "run".
   - If the athlete asks for HIIT/high-intensity intervals on a named modality and gives a day, do not ask for the prescription unless they explicitly want custom work/rest. Use operation="add_conditioning", activity with their exact phrase, modality, intensity="hard", effortKind="interval".
   - If the athlete changes only the modality of a recent add-on ("make them SkiErg", "can that be bike instead"), preserve the source training intent. HIIT rowing intervals → HIIT SkiErg intervals, not easy SkiErg. Return operation="change_modality", replaceActivity=<old title>, activity=<new title>, trainingIntent=<preserved intent>, changeKind="modality".
   - If the athlete changes only the training quality ("make it HIIT", "make that recovery"), preserve the modality and return changeKind="training_intent".
   - If the user says "X instead of Y", use operation="replace_conditioning", activity="X", replaceActivity="Y".
   - If the user asks to make an existing add-on longer/shorter or a specific duration, use operation="change_duration", activity if known, and durationMinutes if stated. For sprint/effort work, use durationSeconds or repsMin/repsMax when seconds are requested.
   - Pronouns like "it", "them", "that", "those" usually refer to packet.lastMutation.touchedActivities[0] first, then recentMessages/context. Preserve that activity title and target date when filling payload.
   - If the date/session or activity is missing, set needsClarification=true and ask the smallest useful question.
   - You only classify/structure intent. The app will apply or reject deterministic supported edits.

9. Output VALID JSON only. No prose. No markdown.`;

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Validate / coerce a parsed JSON blob into a `CoachIntent`. Returns
 * null when the shape is unrecognisable (the dispatcher falls back to
 * the deterministic guard chain in that case).
 */
export function parseCoachIntent(raw: unknown): CoachIntent | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as any;
  const validKinds: CoachIntentKind[] = [
    'new_injury_report',
    'injury_severity_reply',
    'active_injury_followup',
    'why_didnt_program_change',
    'program_explanation',
    'session_mismatch_question',
    'request_program_adjustment',
    'fatigue',
    'soreness',
    'busy_week',
    'missed_session',
    'exercise_swap',
    'general_question',
  ];
  if (!validKinds.includes(r.intent)) return null;
  const confidence = typeof r.confidence === 'number' ? r.confidence : 0.5;
  const needsClarification = !!r.needsClarification;
  const out: CoachIntent = {
    intent: r.intent,
    confidence,
    needsClarification,
    clarificationQuestion:
      typeof r.clarificationQuestion === 'string' ? r.clarificationQuestion : undefined,
    payload: r.payload && typeof r.payload === 'object' ? r.payload : undefined,
    rationale: typeof r.rationale === 'string' ? r.rationale : undefined,
  };
  return out;
}
