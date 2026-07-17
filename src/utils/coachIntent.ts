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
 *   fatigue / soreness / poor_sleep  → canonical source-fact transaction
 *   busy_week / equipment_change     → canonical source-fact/profile transaction
 *   record_session_outcome           → canonical session-outcome transaction
 *   fixture_change                   → typed fixture intent-to-command adapter
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
import type { CoachTargetFrame } from './coachTargetFrame';
import type { ProgramEditDraft } from './coachProgramEditDraft';
import type {
  PendingClarificationAnswerClassification,
  PendingClarificationAnswerInput,
} from '../store/pendingCoachClarifierStore';
import type { ConditioningPerformanceLog } from './conditioningLogging';
import type { SessionComponentKind } from './sessionComponents';
import type { StrengthExercisePerformanceLog } from './strengthLogging';
import type {
  FeedbackCompletion,
  FeedbackFeeling,
  FeedbackPartialReason,
  FeedbackSkipReason,
  FeedbackSoreness,
  SessionOutcomeReason,
} from '../types/sessionOutcome';
import {
  INJURY_EPISODE_PROMPT_CONTRACT,
  isInjuryEpisodeIntent,
  parseInjuryEpisodeIntent,
  parseInjuryEpisodePayload,
} from '../../supabase/functions/shared/coachInjuryIntentContract';
import type {
  InjuryEpisodeIntent,
  InjuryEpisodeIntentKind,
  InjuryEpisodePayload,
  InjuryFollowupKind,
  InjurySeverity,
} from '../../supabase/functions/shared/coachInjuryIntentContract';
import type { InjuryBucket } from './programAdjustmentEngine';

export {
  isInjuryEpisodeIntent,
  parseInjuryEpisodeIntent,
  parseInjuryEpisodePayload,
};
export type {
  InjuryEpisodeIntentKind,
  InjuryEpisodePayload,
  InjuryEpisodeIntent,
  InjuryFollowupKind,
  InjurySeverity,
};

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
  | 'poor_sleep'
  | 'mixed_fact_and_program_adjustment'
  | 'temporary_source_fact_followup'
  | 'busy_week'
  | 'equipment_change'
  | 'record_session_outcome'
  | 'fixture_change'
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
  sourceDate?: string;
  targetDate?: string;
  /** Present only when the athlete explicitly said game or practice match. */
  explicitFixtureKind?: FixtureExplicitKind;
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
  maxSessionsThisWeek?: number;
  equipmentMode?: 'only' | 'without';
  equipmentTags?: import('../data/exercisePools').EquipmentTag[];
  conditioningModalities?: import('../types/domain').ConditioningEquipmentModality[];
  equipmentChangeScope?: 'temporary' | 'baseline';
  sets?: number;
  repsMin?: number;
  repsMax?: number;
  bikeLabel?: string;
  effortKind?: string;
  trainingIntent?: string;
  changeKind?: string;
  scope?: string;
  /** Typed temporary source-fact fields; never projection instructions. */
  factKind?: 'fatigue' | 'soreness' | 'poor_sleep' | 'equipment' | 'schedule' | 'time_cap';
  reportKind?: 'fatigue' | 'cooked';
  sorenessDistribution?: 'localized' | 'general';
  poorSleepPattern?: 'single_night' | 'repeated';
  /** True only when the athlete stated the numeric fact level themselves. */
  reportedLevelIsExplicit?: boolean;
  /** Structured session outcome fields. Stable ids are resolved client-side. */
  completion?: FeedbackCompletion;
  feeling?: FeedbackFeeling;
  soreness?: FeedbackSoreness;
  outcomeReason?: SessionOutcomeReason;
  reason?: SessionOutcomeReason;
  partialReason?: FeedbackPartialReason;
  skipReason?: FeedbackSkipReason;
  componentOutcomes?: CoachSessionOutcomeComponentPayload[];
  strength?: StrengthExercisePerformanceLog[];
  conditioning?: ConditioningPerformanceLog;
  notes?: string;
  difficulty?: number;
}

export type FixtureChangeAction = 'add' | 'move' | 'remove';

export type FixtureExplicitKind = 'game' | 'practice_match';

export type FixtureChangeMissingField = 'action' | 'targetDate';

export interface FixtureChangeAddPayload {
  action: 'add';
  targetDate: string;
  sourceDate?: never;
  explicitFixtureKind?: FixtureExplicitKind;
}

export interface FixtureChangeMovePayload {
  action: 'move';
  targetDate: string;
  sourceDate?: string;
  explicitFixtureKind?: FixtureExplicitKind;
}

export interface FixtureChangeRemovePayload {
  action: 'remove';
  sourceDate?: string;
  targetDate?: never;
  explicitFixtureKind?: FixtureExplicitKind;
}

export interface IncompleteFixtureClarificationPayload {
  action?: FixtureChangeAction;
  sourceDate?: string;
  targetDate?: string;
  explicitFixtureKind?: FixtureExplicitKind;
  missingFields: FixtureChangeMissingField[];
}

export type FixtureChangePayload =
  | FixtureChangeAddPayload
  | FixtureChangeMovePayload
  | FixtureChangeRemovePayload;

export interface CoachSessionOutcomeComponentPayload {
  kind: SessionComponentKind;
  completion: FeedbackCompletion;
  reason?: SessionOutcomeReason;
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

export type FixtureChangeIntent =
  | (Omit<CoachIntent, 'intent' | 'needsClarification' | 'payload'> & {
      intent: 'fixture_change';
      needsClarification: false;
      payload: FixtureChangePayload;
    })
  | (Omit<CoachIntent, 'intent' | 'needsClarification' | 'clarificationQuestion' | 'payload'> & {
      intent: 'fixture_change';
      needsClarification: true;
      clarificationQuestion: string;
      payload: IncompleteFixtureClarificationPayload;
    });

export interface AcceptedInjuryContextEpisode {
  episodeId: string;
  bodyPart: string;
  bucket: InjuryBucket | null;
  severity: number;
  status: 'active' | 'improving';
  onsetOrReportedDate: string;
  updatedAt: string;
  seriousSymptoms: boolean;
}

export interface AcceptedInjuryContext {
  revision: number;
  activeEpisodes: AcceptedInjuryContextEpisode[];
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
  /** Stable id of the athlete message that owns this Coach turn. */
  turnId?: string;
  /** The full user message just submitted. */
  userMessage: string;
  /** Recent chat — last N messages, oldest first. */
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Compatibility-only collapsed injury projection; never authoritative. */
  activeInjury: InjuryState | null;
  /**
   * Canonical accepted injury truth. This preserves every active episode;
   * activeInjury above is a compatibility projection only and must not be
   * used as the authoritative injury target.
   */
  acceptedInjuryContext: AcceptedInjuryContext;
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
  /** Most recent verified coach mutation target; pronouns should prefer it. */
  lastMutationTarget?: CoachContextEntry | null;
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
  /**
   * Stage 2 — central target-resolution frame. This is the source of
   * truth for "what is the user referring to?". `referenceResolution`
   * remains as a compatibility projection for older router/program-edit
   * paths while they migrate.
   */
  targetFrame?: CoachTargetFrame;
  /**
   * Stage 3A — pure mutation-contract draft. This answers
   * "what should happen?" without mutating or replacing the old
   * CoachCommand compatibility path yet.
   */
  programEditDraft?: ProgramEditDraft;
}

// ─── Classifier seam ─────────────────────────────────────────────────

/**
 * Pluggable intent classifier. Production wires a real LLM call
 * (edge function with structured output); tests inject a mock.
 *
 *   classify(packet) → Promise<CoachClassificationResult>
 *
 * Implementations MUST be pure side-effect-free (no store writes).
 * The dispatcher is responsible for any state mutation.
 */
export type CoachClassificationUnavailableReason =
  | 'missing_configuration'
  | 'network_failure'
  | 'http_failure'
  | 'invalid_json'
  | 'schema_failure'
  | 'timeout';

/**
 * Single source of truth for classification in one Coach turn. Transport and
 * configuration failures are deliberately not representable as CoachIntent.
 */
export type CoachClassificationResult =
  | {
      status: 'classified';
      intent: CoachIntent;
      provenance: 'deterministic' | 'semantic_service';
    }
  | {
      status: 'unavailable';
      reason: CoachClassificationUnavailableReason;
    };

export interface CoachIntentClassifier {
  classify(
    packet: CoachContextPacket,
  ): Promise<CoachClassificationResult> | CoachClassificationResult;
  classifyPendingClarificationAnswer?: (
    input: PendingClarificationAnswerInput,
  ) => Promise<PendingClarificationAnswerClassification> | PendingClarificationAnswerClassification;
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
  "intent": "<one of: new_injury_report | injury_severity_reply | active_injury_followup | temporary_source_fact_followup | why_didnt_program_change | program_explanation | session_mismatch_question | request_program_adjustment | record_session_outcome | fixture_change | fatigue | soreness | poor_sleep | mixed_fact_and_program_adjustment | busy_week | equipment_change | exercise_swap | general_question>",
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
    "action": "<for fixture_change: add | move | remove>",
    "sourceDate": "<optional fixture source, YYYY-MM-DD>",
    "targetDate": "<optional, YYYY-MM-DD>",
    "explicitFixtureKind": "<optional for fixture_change: game | practice_match; include only when the athlete explicitly says that kind>",
    "missingFields": ["<for incomplete fixture clarification: action | targetDate>"],
    "targetSessionName": "<optional>",
    "activity": "<new activity to add, preserve exact terms like HIIT rowing intervals, hard hill running, Pilates, assault bike sprints>",
    "replaceActivity": "<existing activity being replaced, e.g. Pilates>",
    "durationMinutes": <optional number>,
    "durationSeconds": <optional number, for sprint/effort reps>,
    "maxSessionsThisWeek": <optional number>,
    "equipmentMode": "<optional: only | without>",
    "equipmentTags": ["<optional canonical equipment tags>"],
    "conditioningModalities": ["<optional: bike | row | ski | treadmill>"],
    "equipmentChangeScope": "<optional: temporary | baseline>",
    "sets": <optional number>,
    "repsMin": <optional number>,
    "repsMax": <optional number>,
    "modality": "<optional: bike | row | run | walk | ski | swim | cardio | aerobic | sprint>",
    "intensity": "<optional: light | moderate | hard>",
    "bikeLabel": "<optional: standard | assault>",
    "effortKind": "<optional: sprint | interval>",
    "trainingIntent": "<optional: hiit | sprint | tempo | aerobic | low_load>",
    "changeKind": "<optional: modality | training_intent | modality_and_training_intent>",
    "scope": "<optional: one_off | this_week | recurring | permanent>",
    "factKind": "<optional: fatigue | soreness | poor_sleep | equipment | schedule | time_cap>",
    "reportKind": "<for fatigue facts: fatigue | cooked>",
    "sorenessDistribution": "<localized | general>",
    "poorSleepPattern": "<single_night | repeated>",
    "reportedLevelIsExplicit": <optional boolean; true only when the athlete explicitly stated the numeric level>,
    "completion": "<for record_session_outcome: full | partial | skipped>",
    "feeling": "<optional: very_easy | easy | good | hard | very_hard>",
    "soreness": "<optional: none | mild | moderate | high>",
    "partialReason": "<optional: ran_out_of_time | felt_sore_tight | too_hard_today | equipment_unavailable | other>",
    "skipReason": "<optional: busy_no_time | sore_tight | injured_niggle | sick_low_energy | didnt_feel_like_it | equipment_unavailable | other>",
    "componentOutcomes": [{ "kind": "<stable component kind such as strength or conditioning>", "completion": "<full | partial | skipped>", "reason": "<optional reason>" }]
  },
  "rationale": "<one sentence>"
}

${INJURY_EPISODE_PROMPT_CONTRACT}

CRITICAL RULES

1. \`acceptedInjuryContext.activeEpisodes\` is the authoritative injury context. \`activeInjury\` is compatibility-only and must not be used as the source of truth. If the message references the same body part as an accepted active episode, DO NOT classify it as new_injury_report. Use active_injury_followup or why_didnt_program_change.

2. If exactly one accepted active episode is the available target and the user just gives a number ("4/10"), this is injury_severity_reply with payload.severity (interpret it as the new severity for that EXISTING episode). If more than one episode could be the target, preserve the injury intent and let the app clarify the target.

3. Severity clarification (needsClarification=true with "How bad is it?") is ONLY appropriate when:
   - no accepted active episode matches the reported body part, AND
   - the user is reporting a NEW injury, AND
   - severity is missing.
   Missing severity is a valid injury classification, not schema failure. Never ask severity for an accepted existing episode unless the athlete is reporting a severity change or answering a severity question.

4. "why didn't X change?" / "why are deadlifts still there?" / "should I still train?" → why_didnt_program_change. Do not classify as a new request unless it's clear they want a NEW change.

5. A body part different from every accepted active episode may be a NEW injury — classify as new_injury_report. A new injury report remains new_injury_report even when a similar accepted episode exists; the app owns target resolution.

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
   - "fatigue" — global tired / cooked / drained / smashed without specific body part ("feeling cooked this week", "exhausted"). Set reportKind="cooked" for cooked language. Only set numeric severity when the athlete explicitly reports a number, and then set reportedLevelIsExplicit=true.
   - "soreness" — localised or general muscle soreness, NOT injury-level pain ("quads are sore", "tight calves", "DOMS"). Preserve payload.bodyPart exactly when localised. Only set numeric severity when the athlete explicitly reports a number, and then set reportedLevelIsExplicit=true.
   - "poor_sleep" — a factual report about sleep ("I slept badly"). Use poorSleepPattern="single_night" unless repeated nights are explicit. Only set numeric severity with reportedLevelIsExplicit=true when the athlete stated that number.
   - "busy_week" — schedule constraint: limited time / capacity ("crazy week ahead", "can only train twice", "exam week"). Set payload.severity=5 by default. If the athlete states an exact bounded weekly maximum, set payload.maxSessionsThisWeek.
   - "equipment_change" — exact available/unavailable equipment. Set payload.equipmentMode="only" or "without", payload.equipmentTags using canonical tags (bodyweight, dumbbells, barbell, cables, bands, bench, pullup_bar, kettlebell, machine, bike_or_treadmill), and payload.equipmentChangeScope="temporary" for bounded/current-week limits or "baseline" for permanent equipment settings. Preserve exact conditioning modality terms in payload.conditioningModalities (bike, row, ski, treadmill).
   - "record_session_outcome" — a report about work that already happened: completed, partial, missed/skipped attendance, or how a completed/recent session felt. Capture payload.requestedDate/targetSessionName, completion, feeling, soreness, reasons and componentOutcomes.
   - "I missed it" means record_session_outcome with completion="skipped". It is attendance feedback, not a schedule constraint and not a delete/move request.
   - "It was too hard" about a completed or recent session means record_session_outcome with feeling="hard" or "very_hard". If no partial/skip language exists, use completion="full".
   - "Make it easier" is a future request_program_adjustment, never session feedback.
   - Factual state and imperative programming are different: "I feel fatigued" is fatigue; "I'm cooked this week" is a fatigue fact with reportKind="cooked" and scope="this_week"; "Make this week lighter" and "Reduce my strength work" are request_program_adjustment.
   - If one message contains both a factual report and an explicit command (for example "I'm cooked, make this week lighter"), use mixed_fact_and_program_adjustment, set factKind and all fact fields, and also populate the structured program-edit fields. The app will apply one fact and one exact reversible edit without treating the fact as a second percentage edit.
   - A factual recovery/clear report ("my calves aren't sore now", "I slept well last night", "I'm not fatigued anymore", "my equipment is available again", "my schedule is back to normal") is temporary_source_fact_followup with followupKind="resolved" and factKind. Include bodyPart for soreness. Use factKind="equipment", "schedule", or "time_cap" for those exact temporary restrictions. Do not classify it as a new report or a generic command.
   - General post-session soreness belongs in record_session_outcome.soreness; only classify injury/soreness constraint intent when the athlete reports a current health issue that should change future training.
   - equipment_unavailable as an outcome reason remains feedback; it is not an equipment constraint.

8. Fixture changes:
   - Adding, moving, rescheduling, or removing a game or practice match is fixture_change. Use payload.action and ISO dates; do not encode fixture changes as request_program_adjustment.
   - A missed game or practice-match report about what already happened is record_session_outcome with completion="skipped", never fixture_change.
   - Moving a workout, strength session, conditioning session, or team-training session is request_program_adjustment, never fixture_change.
   - Set explicitFixtureKind only when the athlete explicitly says "game" or "practice match". It is a conflict signal; the app derives the canonical kind from accepted phase state.
   - add requires targetDate and forbids sourceDate. move requires targetDate and may include sourceDate. remove may include sourceDate and forbids targetDate. Never reinterpret add as move.
   - If action or a required targetDate is missing, set needsClarification=true, ask the smallest useful question, and include payload.missingFields. Do not invent or coerce a date.

9. Program adjustment requests:
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

10. Output VALID JSON only. No prose. No markdown.`;

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Validate a parsed JSON blob as a `CoachIntent`. Returns
 * null when the shape is unrecognisable (the dispatcher falls back to
 * the deterministic guard chain in that case).
 */
const VALID_COACH_INTENTS = new Set<CoachIntentKind>([
  'new_injury_report',
  'injury_severity_reply',
  'active_injury_followup',
  'temporary_source_fact_followup',
  'why_didnt_program_change',
  'program_explanation',
  'session_mismatch_question',
  'request_program_adjustment',
  'fatigue',
  'soreness',
  'poor_sleep',
  'mixed_fact_and_program_adjustment',
  'busy_week',
  'equipment_change',
  'record_session_outcome',
  'fixture_change',
  'missed_session',
  'exercise_swap',
  'general_question',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isISODate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function parseFixtureChangePayload(
  value: unknown,
  needsClarification: boolean,
): FixtureChangePayload | IncompleteFixtureClarificationPayload | null {
  if (!isRecord(value)) return null;
  const allowedKeys = new Set([
    'action',
    'sourceDate',
    'targetDate',
    'explicitFixtureKind',
    'missingFields',
  ]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return null;
  const action = value.action;
  if (action !== undefined && action !== 'add' && action !== 'move' && action !== 'remove') {
    return null;
  }
  if (hasOwn(value, 'sourceDate') && !isISODate(value.sourceDate)) return null;
  if (hasOwn(value, 'targetDate') && !isISODate(value.targetDate)) return null;
  if (
    hasOwn(value, 'explicitFixtureKind') &&
    value.explicitFixtureKind !== 'game' &&
    value.explicitFixtureKind !== 'practice_match'
  ) return null;
  if (action === 'add' && hasOwn(value, 'sourceDate')) return null;
  if (action === 'remove' && hasOwn(value, 'targetDate')) return null;

  if (needsClarification) {
    if (!Array.isArray(value.missingFields) || value.missingFields.length === 0) return null;
    const missingFields = value.missingFields;
    if (!missingFields.every((field) => field === 'action' || field === 'targetDate')) {
      return null;
    }
    if (new Set(missingFields).size !== missingFields.length) return null;
    if (action === undefined && !missingFields.includes('action')) return null;
    if ((action === 'add' || action === 'move') && !hasOwn(value, 'targetDate') &&
      !missingFields.includes('targetDate')) return null;
    if (action === 'remove' || ((action === 'add' || action === 'move') && hasOwn(value, 'targetDate'))) {
      return null;
    }
    return value as unknown as IncompleteFixtureClarificationPayload;
  }

  if (hasOwn(value, 'missingFields')) return null;
  if (action === 'add') {
    return hasOwn(value, 'targetDate')
      ? value as unknown as FixtureChangeAddPayload
      : null;
  }
  if (action === 'move') {
    return hasOwn(value, 'targetDate')
      ? value as unknown as FixtureChangeMovePayload
      : null;
  }
  return action === 'remove'
    ? value as unknown as FixtureChangeRemovePayload
    : null;
}

function explicitFixtureKindWasStated(
  payload: FixtureChangePayload | IncompleteFixtureClarificationPayload,
  athleteMessage: string | undefined,
): boolean {
  if (!payload.explicitFixtureKind || athleteMessage === undefined) return true;
  return payload.explicitFixtureKind === 'practice_match'
    ? /\bpractice[-\s]+match\b/i.test(athleteMessage)
    : /\bgame\b/i.test(athleteMessage);
}

export function isFixtureChangeIntent(intent: CoachIntent): intent is FixtureChangeIntent {
  return intent.intent === 'fixture_change' &&
    parseFixtureChangePayload(intent.payload, intent.needsClarification) !== null;
}

export function parseCoachIntent(raw: unknown, athleteMessage?: string): CoachIntent | null {
  if (!isRecord(raw)) return null;
  const r = raw;
  if (typeof r.intent !== 'string' || !VALID_COACH_INTENTS.has(r.intent as CoachIntentKind)) {
    return null;
  }
  if (
    typeof r.confidence !== 'number' ||
    !Number.isFinite(r.confidence) ||
    r.confidence < 0 ||
    r.confidence > 1 ||
    typeof r.needsClarification !== 'boolean'
  ) return null;
  if (hasOwn(r, 'clarificationQuestion') && typeof r.clarificationQuestion !== 'string') {
    return null;
  }
  if (hasOwn(r, 'payload') && !isRecord(r.payload)) return null;
  if (hasOwn(r, 'rationale') && typeof r.rationale !== 'string') return null;
  if (r.intent === 'new_injury_report' || r.intent === 'injury_severity_reply' ||
    r.intent === 'active_injury_followup') {
    return parseInjuryEpisodeIntent(r);
  }
  if (r.intent === 'fixture_change') {
    if (r.needsClarification &&
      (typeof r.clarificationQuestion !== 'string' || !r.clarificationQuestion.trim())) {
      return null;
    }
    const fixturePayload = parseFixtureChangePayload(r.payload, r.needsClarification);
    if (!fixturePayload || !explicitFixtureKindWasStated(fixturePayload, athleteMessage)) return null;
  }
  const out: CoachIntent = {
    intent: r.intent as CoachIntentKind,
    confidence: r.confidence,
    needsClarification: r.needsClarification,
    clarificationQuestion:
      typeof r.clarificationQuestion === 'string' ? r.clarificationQuestion : undefined,
    payload: isRecord(r.payload) ? r.payload as CoachIntentPayload : undefined,
    rationale: typeof r.rationale === 'string' ? r.rationale : undefined,
  };
  return out;
}
