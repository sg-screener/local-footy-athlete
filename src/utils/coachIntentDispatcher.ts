/**
 * coachIntentDispatcher.ts — final orchestration seam between the
 * LLM intent classifier and the deterministic engines.
 *
 * The dispatcher is a PURE function (its mutations live in the
 * injected deps — coachUpdatesStore, programStore, applyAdjustmentEvents,
 * coachStateInspector). Everything is stubbable for tests.
 *
 *   intent (from LLM) ──▶ dispatcher
 *                          ├─▶ injury_severity_reply  → UAE → apply → diff → card
 *                          ├─▶ new_injury_report      → clarifier OR UAE
 *                          ├─▶ active_injury_followup → progression
 *                          ├─▶ why_didnt_program_change → coachStateInspector (+ reapply)
 *                          ├─▶ request_program_adjustment → UAE (TODO non-injury)
 *                          ├─▶ record_session_outcome → shared transaction (before dispatcher)
 *                          ├─▶ general_question / fatigue / busy / swap
 *                          │   → state-grounded reply, NO mutation by default
 *                          └─▶ unknown intent → safe-fallback general_question
 *
 *   handled === true means the dispatcher produced the assistant
 *   reply for this turn and the caller MUST NOT fall through to the
 *   legacy LLM path. This is the fence that stops the old action
 *   tools from competing with the UAE for injury flows.
 */

import type {
  CoachContextPacket,
  CoachIntent,
  PendingCoachProposal,
} from './coachIntent';
import { logger } from './logger';
import type { ResolvedDay } from './sessionResolver';
import type { Workout, OverrideContext } from '../types/domain';
import type { InjuryState } from './injuryProgression';
import {
  detectConstraintResolution,
  formatResolutionAmbiguityQuestion,
  formatResolutionSuccessReply,
  formatResolutionInactiveReply,
} from './constraintResolutionDetector';
import type { ActiveConstraint } from '../store/coachUpdatesStore';
import {
  isPendingProgramProposalExpired,
  isProgramAdjustmentCancel,
  isProgramAdjustmentConfirmation,
  getProgramAdjustmentRequiredText,
  getProgramAdjustmentSuccessReply,
  planProgramAdjustmentRequest,
  UNSUPPORTED_PROGRAM_ADJUSTMENT_REPLY,
} from './programAdjustmentRequests';
import type { AdjustmentEvent } from './programAdjustmentEngine';
import { deriveVisibleWorkoutIdentity } from './visibleWorkoutIdentity';
import {
  athleteActionDiagnosticHash,
  athleteActionTerminalReasonChain,
  beginAthleteActionTrace,
  classifyAthleteActionFailure,
  emitAthleteActionEvent,
  runWithAthleteActionTrace,
  type AthleteActionType,
} from './athleteActionDiagnostics';

// ─── Result type ────────────────────────────────────────────────────

export type DispatchReplyMode =
  | 'severity_clarifier'
  | 'severity_reply_uae'
  | 'progression'
  | 'state_inspector'
  | 'program_explanation'
  | 'session_mismatch_question'
  | 'reapplied'
  | 'general_state_grounded'
  | 'non_injury_constraint'
  | 'session_outcome_transaction_required'
  | 'program_adjustment_clarifier'
  | 'program_adjustment_proposed'
  | 'program_adjustment_applied'
  | 'program_adjustment_failed'
  | 'program_adjustment_unsupported'
  | 'constraint_resolution_applied'
  | 'constraint_resolution_ambiguous'
  | 'constraint_resolution_no_match'
  | 'safe_fallback'
  | 'fall_through';

export type NonInjuryConstraintKind =
  | 'fatigue'
  | 'soreness'
  | 'busy_week';

export interface DispatchOutcome {
  /**
   * `true` ⇒ dispatcher produced the reply and the caller MUST NOT
   * fall through to the legacy LLM path. `false` ⇒ caller should
   * proceed to the next layer (currently the legacy /coach-chat).
   */
  handled: boolean;
  /** The assistant reply for this turn (when handled). */
  reply: string;
  /** Whether the dispatcher mutated program state. */
  mutated: boolean;
  /** Categorical mode for logging / tests. */
  replyMode: DispatchReplyMode;
  /** Free-text rationale for logs. */
  rationale?: string;
  pendingCoachProposal?: PendingCoachProposal | null;
  /**
   * Session the dispatcher explicitly explained or otherwise tied
   * the reply to (program_explanation / session_mismatch_question
   * branches). CoachScreen uses this to populate the durable coach
   * context state so a follow-up "change it to a bike" knows which
   * session "it" refers to. See coachContextStateStore.ts.
   */
  referencedSession?: {
    date: string;
    sessionName: string;
    modalities?: string[];
  } | null;
  transaction?: {
    route: string;
    pendingProposalBefore: PendingCoachProposal | null;
    mutationAttempted: boolean;
    eventsEmitted: number;
    eventsApplied: number;
    visibleDiff: string[];
    replyMode: DispatchReplyMode;
  };
}

function looksLikeSessionMismatchQuestion(text: string): boolean {
  const t = text.toLowerCase();
  const hasTrainingTerm =
    /\b(upper\s+pull|pull\s+day|pull\s+session|push\/pull|upper\/lower|upper\s+body|lower\s+body|row|rower|rowing|rowing\s+session|zone\s*2\s+row|aerobic\s+base)\b/.test(t);
  const hasMismatchLanguage =
    /\bwhy\b/.test(t) ||
    /\b(listed|says?|showing|label(?:led)?|opens?|open as|instead|mismatch)\b/.test(t);
  const hasExplicitInjury =
    /\b(pain|hurt|hurts|sore|soreness|strain|strained|injured|injury|tight|tightness|tweaked|pulled\s+my|pulled\s+(?:a|the)?\s*(?:hamstring|hammy|back|groin|calf|quad|shoulder|knee))\b/.test(t);
  return hasTrainingTerm && hasMismatchLanguage && !hasExplicitInjury;
}

function looksLikeProgramExplanationQuestion(text: string): boolean {
  const t = text.toLowerCase();
  if (/\b(pain|hurt|hurts|sore|soreness|strain|strained|injured|injury|tight|tightness|tweaked|pulled\s+my)\b/.test(t)) {
    return false;
  }
  return (
    /\bwhy\b/.test(t) &&
    /\b(row|rower|rowing|zone\s*2|aerobic|mid[-\s]?week|instead of running|non[-\s]?running|running load)\b/.test(t)
  ) || looksLikeSessionMismatchQuestion(text);
}

function dayNameForDow(dow: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow] ?? 'That day';
}

function requestedDayFromText(text: string): number | null {
  const t = text.toLowerCase();
  const dayMatch = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ].findIndex((d) => new RegExp(`\\b${d}\\b`).test(t));
  return dayMatch >= 0 ? dayMatch : null;
}

function rowSignals(day: ResolvedDay): {
  row: boolean;
  zone2: boolean;
  aerobic: boolean;
  runningConversion: boolean;
  haystack: string;
} {
  const workout = day.workout;
  const exerciseNames = (workout?.exercises ?? [])
    .map((ex: any) => ex.exercise?.name)
    .filter(Boolean);
  const notes = [
    ...(workout?.coachNotes ?? []),
    ...(workout?.exercises ?? []).map((ex: any) => ex.notes).filter(Boolean),
    workout?.description,
    workout?.name,
    workout?.workoutType,
  ].filter(Boolean);
  const haystack = [...exerciseNames, ...notes].join(' ').toLowerCase();
  return {
    row: /\b(row|rower|rowing\s*erg)\b/.test(haystack),
    zone2: /\bzone\s*2\b/.test(haystack),
    aerobic: /\baerobic|conditioning\b/.test(haystack),
    runningConversion: /non[-\s]?running|run load|running load|shifted to non[-\s]?running/.test(haystack),
    haystack,
  };
}

interface RowSessionCandidate {
  day: ResolvedDay;
  score: number;
  reason: string;
  title: string;
  subtitle: string;
}

function findRowSessionCandidates(
  packet: CoachContextPacket,
  requestedDay: number | null,
): RowSessionCandidate[] {
  const all = [
    ...packet.currentWeek.map((day) => ({ day, weekBias: 8 })),
    ...packet.nextWeek.map((day) => ({ day, weekBias: 0 })),
  ];
  const wantsMidWeek = /\bmid[-\s]?week\b/i.test(packet.userMessage);
  const wantsRow = /\b(row|rower|rowing)\b/i.test(packet.userMessage);
  return all
    .filter(({ day }) =>
      !!day.workout && (requestedDay == null || day.dayOfWeek === requestedDay),
    )
    .map(({ day, weekBias }) => {
      const signals = rowSignals(day);
      if (wantsRow && !signals.row) return null;
      if (!signals.row && !signals.zone2 && !signals.aerobic) return null;
      const identity = deriveVisibleWorkoutIdentity(day.workout!);
      let score = weekBias;
      const reasons: string[] = [];
      if (requestedDay != null && day.dayOfWeek === requestedDay) {
        score += 100;
        reasons.push('requested day');
      }
      if (requestedDay == null && wantsMidWeek) {
        if (day.dayOfWeek === 3) {
          score += 45;
          reasons.push('mid-week Wednesday');
        } else if (day.dayOfWeek === 2 || day.dayOfWeek === 4) {
          score += 18;
          reasons.push('mid-week adjacent day');
        }
      }
      if (signals.row) {
        score += 45;
        reasons.push('row/rower visible');
      }
      if (signals.zone2) {
        score += 30;
        reasons.push('zone 2 visible');
      }
      if (signals.aerobic) {
        score += 15;
        reasons.push('aerobic/conditioning visible');
      }
      if (signals.runningConversion) {
        score += 20;
        reasons.push('non-running run-load note');
      }
      if (identity.isConditioningOnly) {
        score += 12;
        reasons.push('conditioning-only session');
      }
      return {
        day,
        score,
        reason: reasons.join(', ') || 'visible conditioning',
        title: identity.title || day.workout!.name,
        subtitle: String(identity.subtitle || day.workout!.workoutType || ''),
      };
    })
    .filter((candidate): candidate is RowSessionCandidate => !!candidate)
    .sort((a, b) => b.score - a.score);
}

/**
 * Identify the specific day the dispatcher's program-explanation /
 * session-mismatch reply is referring to. Exported so CoachScreen
 * can populate `lastExplainedSession` on the durable coach context
 * store after a `program_explanation` outcome — see
 * coachContextStateStore.ts.
 */
export function findReferencedVisibleDay(packet: CoachContextPacket): ResolvedDay | undefined {
  const requestedDay = requestedDayFromText(packet.userMessage);
  const all = [...packet.currentWeek, ...packet.nextWeek];
  if (requestedDay != null) {
    const rowOnDay = findRowSessionCandidates(packet, requestedDay)[0];
    if (rowOnDay?.day.dayOfWeek === requestedDay) return rowOnDay.day;
    return all.find((d) => d.dayOfWeek === requestedDay && d.workout);
  }
  return findRowSessionCandidates(packet, null)[0]?.day;
}

function buildProgramExplanationReply(packet: CoachContextPacket): string {
  const requestedDay = requestedDayFromText(packet.userMessage);
  const candidates = findRowSessionCandidates(packet, requestedDay);
  const selected = candidates[0];
  const detectedTopic = /\binstead of running|non[-\s]?running|running load\b/i.test(packet.userMessage)
    ? 'running_load_conversion'
    : /\bupper\s+pull|listed|opens?|label|mismatch\b/i.test(packet.userMessage)
    ? 'session_label_mismatch'
    : /\bzone\s*2\b/i.test(packet.userMessage)
    ? 'zone_2_row'
    : 'mid_week_row';

  if (!selected?.day.workout) {
    logger.debug('[coach-program-explanation]', {
      userMessage: packet.userMessage,
      requestedDay: requestedDay == null ? null : dayNameForDow(requestedDay),
      detectedTopic,
      rowSessionCandidates: [],
      selectedSessionDate: null,
      selectedSessionTitle: null,
      selectedSessionSubtitle: null,
      selectedSessionReason: null,
      replyMode: 'program_explanation',
    });
    return "I can't see the row session in the visible week I'm reading. Which day are you looking at?";
  }

  const day = selected.day;
  const workout = day.workout;
  const exerciseNames = (workout.exercises ?? [])
    .map((ex: any) => ex.exercise?.name)
    .filter(Boolean);
  const rowText = exerciseNames.find((name: string) => /\b(row|rower|rowing\s*erg)\b/i.test(name));
  const signals = rowSignals(day);
  const dayName = dayNameForDow(day.dayOfWeek);
  const rowLabel = rowText || selected.title;
  const recoveryBiased =
    /easy aerobic flush|3-4\/10|skip if legs feel heavy|thursday training quality/i.test(signals.haystack);
  const conversionSentence = signals.runningConversion
    ? ' That session was shifted to a non-running modality to manage weekly run load.'
    : '';
  const mismatchSentence = /\bupper\s+pull|listed|opens?|label|mismatch\b/i.test(packet.userMessage)
    ? ' If it still says Upper Pull while the workout is only rowing, that is a display issue: the title should match the final resolved conditioning session.'
    : '';

  logger.debug('[coach-program-explanation]', {
    userMessage: packet.userMessage,
    requestedDay: requestedDay == null ? null : dayNameForDow(requestedDay),
    detectedTopic,
    rowSessionCandidates: candidates.map((c) => ({
      date: c.day.date,
      day: dayNameForDow(c.day.dayOfWeek),
      title: c.title,
      subtitle: c.subtitle,
      score: c.score,
      reason: c.reason,
    })),
    selectedSessionDate: day.date,
    selectedSessionTitle: selected.title,
    selectedSessionSubtitle: selected.subtitle,
    selectedSessionReason: selected.reason,
    replyMode: 'program_explanation',
  });

  if (recoveryBiased) {
    return `I put the ${dayName} ${rowLabel} there as easy aerobic base without extra running load.${conversionSentence} Keep it easy: 20-30min at about 3-4/10.${mismatchSentence}`;
  }

  return `I put the ${dayName} ${rowLabel} there as easy Zone 2 without extra running load.${conversionSentence} Keep it conversational: about 4-5/10.${mismatchSentence}`;
}

function buildSessionMismatchReply(packet: CoachContextPacket): string {
  const explanation = buildProgramExplanationReply(packet);
  if (!/^I can't see the row session/.test(explanation)) return explanation;
  const day = findReferencedVisibleDay(packet);
  if (!day?.workout) return explanation;
  const identity = deriveVisibleWorkoutIdentity(day.workout);
  const title = identity.title || day.workout.name;
  const dayName = dayNameForDow(day.dayOfWeek);
  if (identity.isConditioningOnly) {
    return `That ${dayName} session is resolving as ${title}. It should be labelled as the final conditioning session in both the Program tab and workout detail.`;
  }
  return `${dayName} is currently resolving as ${title}. I can't see a row session on that day in the visible week I'm reading.`;
}

// ─── Dependency surface ─────────────────────────────────────────────

export interface InjuryDispatchDependencyResult {
  reply: string;
  mutated: boolean;
}

function normalizeInjuryDispatchDependencyResult(
  value: string | InjuryDispatchDependencyResult,
): InjuryDispatchDependencyResult {
  return typeof value === 'string' ? { reply: value, mutated: true } : value;
}

export interface DispatchDeps {
  /** Re-apply the injury policy to the week — used by why-handler. */
  reapplyInjuryAtSeverity: (
    bodyPart: string,
    severity: number,
    monday: string,
    todayISO: string,
  ) => { applied: number; visibleDiffDetected: boolean };
  /** Run the active-injury progression handler. */
  runProgression: (
    outcome:
      | { kind: 'resolved' }
      | { kind: 'improving'; newSeverity: number }
      | { kind: 'worsening'; newSeverity: number }
      | { kind: 'unchanged' },
    current: InjuryState,
    note: string,
  ) => string | InjuryDispatchDependencyResult;
  /** Run UAE for a known {bodyPart, severity}. Returns the reply text. */
  runUAEForInjury: (
    bodyPart: string,
    severity: number,
    note: string,
  ) => string | InjuryDispatchDependencyResult;
  /** State inspector — called by why_didnt_program_change. */
  inspect: (query: {
    date?: string;
    sessionName?: string;
    exerciseName?: string;
  }) => {
    kind: string;
    message: string;
    suggestReapply?: boolean;
    date?: string;
  };
  /** Build a state-grounded "should I train?" / general reply. */
  generalReply: (intent: CoachIntent, packet: CoachContextPacket) => string;
  /**
   * Apply a non-injury constraint (fatigue / soreness / busy_week).
   * Builds the producer constraint, writes it to the
   * activeConstraints store, and returns a state-grounded reply +
   * whether the program was actually mutated.
   *
   * `mutated: false` means no accepted constraint was published.
   */
  applyNonInjuryConstraint: (
    kind: NonInjuryConstraintKind,
    intent: CoachIntent,
    packet: CoachContextPacket,
  ) => { reply: string; mutated: boolean };
  /**
   * Resolve (clear) the named active constraints. The implementation:
   *   1. Calls `removeActiveConstraint(id)` for each id.
   *   2. If any cleared constraint is an injury, wipes the matching
   *      week's injury overrides so the visible week reverts.
   *   3. Deactivates the Coach Update card for the current Monday
   *      when no active constraints remain.
   *
   * Returns the constraints that were actually cleared (post-filter
   * — already-resolved ones are skipped). The dispatcher uses this
   * list to build the success reply ("Good — I've cleared the
   * fatigue flag and your week is back to normal").
   */
  applyConstraintResolution: (
    ids: string[],
    todayISO: string,
  ) => {
    cleared: ActiveConstraint[];
    remainingActiveCount?: number;
    derivedCardShouldRender?: boolean;
  };
  applyProgramAdjustmentEvents: (
    events: AdjustmentEvent[],
    intendedChange: { type: string; targetDates: string[]; requiredText?: string },
  ) => {
    eventsApplied: number;
    visibleDiff: string[];
    success: boolean;
    reason?: string;
  };
}

// ─── Dispatcher ─────────────────────────────────────────────────────

function dispatchCoachIntentWithinTrace(
  intent: CoachIntent,
  packet: CoachContextPacket,
  deps: DispatchDeps,
): DispatchOutcome {
  const pendingProposalBefore = packet.pendingCoachProposal ?? null;
  logger.debug('[coach-flow] intent', {
    kind: intent.intent,
    confidence: intent.confidence,
    needsClarification: intent.needsClarification,
    payloadKeys: intent.payload ? Object.keys(intent.payload) : [],
  });
  logger.debug('[coach-flow] activeInjury', packet.activeInjury
    ? {
        bodyPart: packet.activeInjury.bodyPart,
        severity: packet.activeInjury.severity,
        status: packet.activeInjury.status,
      }
    : null);

  if (
    pendingProposalBefore?.type === 'program_adjustment' &&
    isProgramAdjustmentCancel(packet.userMessage)
  ) {
    return {
      handled: true,
      reply: "No problem - I won't change the program.",
      mutated: false,
      replyMode: 'program_adjustment_failed',
      pendingCoachProposal: null,
      transaction: {
        route: 'pending_program_adjustment_cancelled',
        pendingProposalBefore,
        mutationAttempted: false,
        eventsEmitted: 0,
        eventsApplied: 0,
        visibleDiff: [],
        replyMode: 'program_adjustment_failed',
      },
    };
  }

  if (
    pendingProposalBefore?.type === 'program_adjustment' &&
    isPendingProgramProposalExpired(pendingProposalBefore)
  ) {
    if (isProgramAdjustmentConfirmation(packet.userMessage)) {
      return {
        handled: true,
        reply: 'That pending program adjustment expired, so I did not change the program. Ask me again and I can set it up fresh.',
        mutated: false,
        replyMode: 'program_adjustment_failed',
        pendingCoachProposal: null,
        transaction: {
          route: 'pending_program_adjustment_expired',
          pendingProposalBefore,
          mutationAttempted: false,
          eventsEmitted: 0,
          eventsApplied: 0,
          visibleDiff: [],
          replyMode: 'program_adjustment_failed',
        },
      };
    }
  }

  if (
    pendingProposalBefore?.type === 'program_adjustment' &&
    isProgramAdjustmentConfirmation(packet.userMessage)
  ) {
    const confirmationIntent: CoachIntent = {
      intent: 'request_program_adjustment',
      confidence: 1,
      needsClarification: false,
      payload: {
        requestedSession: pendingProposalBefore.targetDay,
        concern: pendingProposalBefore.prescription ?? pendingProposalBefore.action,
      },
    };
    const planned = planProgramAdjustmentRequest(confirmationIntent, packet);
    if (planned.kind === 'ready') {
      const apply = deps.applyProgramAdjustmentEvents(planned.events, {
        type: planned.proposal.action,
        targetDates: planned.events.map((e) => e.date),
        requiredText: getProgramAdjustmentRequiredText(planned.proposal),
      });
      const success = planned.events.length > 0 && apply.eventsApplied > 0 && apply.success;
      const reply = success
        ? getProgramAdjustmentSuccessReply(planned.proposal)
        : "I tried to add that, but it didn't land in the visible program. I'm not going to pretend it changed.";
      logger.debug('[coach-pending-adjustment]', {
        pendingBefore: pendingProposalBefore,
        userMessage: packet.userMessage,
        resolvedOption: planned.proposal.conditioningOption ?? null,
        nextPendingState: null,
        route: 'pending_program_adjustment_confirmation',
        replyMode: success ? 'program_adjustment_applied' : 'program_adjustment_failed',
      });
      return {
        handled: true,
        reply,
        mutated: success,
        replyMode: success ? 'program_adjustment_applied' : 'program_adjustment_failed',
        pendingCoachProposal: null,
        transaction: {
          route: 'pending_program_adjustment_confirmation',
          pendingProposalBefore,
          mutationAttempted: true,
          eventsEmitted: planned.events.length,
          eventsApplied: apply.eventsApplied,
          visibleDiff: apply.visibleDiff,
          replyMode: success ? 'program_adjustment_applied' : 'program_adjustment_failed',
        },
      };
    }
    return {
      handled: true,
      reply: planned.reply || "I tried to add that, but it didn't land in the visible program. I'm not going to pretend it changed.",
      mutated: false,
      replyMode: planned.kind === 'unsupported'
        ? 'program_adjustment_unsupported'
        : 'program_adjustment_failed',
      pendingCoachProposal: null,
      transaction: {
        route: `pending_program_adjustment_${planned.kind}`,
        pendingProposalBefore,
        mutationAttempted: false,
        eventsEmitted: 0,
        eventsApplied: 0,
        visibleDiff: [],
        replyMode: planned.kind === 'unsupported'
          ? 'program_adjustment_unsupported'
          : 'program_adjustment_failed',
      },
    };
  }

  if (
    pendingProposalBefore?.type === 'program_adjustment' &&
    (
      pendingProposalBefore.needs === 'conditioning_type' ||
      /conditioning|aerobic|interval|bike|flush|tempo|track|run|light|easy|something else|other/i.test(packet.userMessage)
    )
  ) {
    const followupIntent: CoachIntent = {
      intent: 'request_program_adjustment',
      confidence: Math.max(intent.confidence, 0.9),
      needsClarification: false,
      payload: {
        requestedSession: pendingProposalBefore.targetDay,
        concern: packet.userMessage,
      },
    };
    const planned = planProgramAdjustmentRequest(followupIntent, packet);
    if (planned.kind === 'proposal' || planned.kind === 'clarifier') {
      const replyMode = planned.kind === 'proposal'
        ? 'program_adjustment_proposed'
        : 'program_adjustment_clarifier';
      logger.debug('[coach-pending-adjustment]', {
        pendingBefore: pendingProposalBefore,
        userMessage: packet.userMessage,
        resolvedOption: planned.proposal.conditioningOption ?? null,
        nextPendingState: planned.proposal,
        route: planned.kind === 'proposal'
          ? 'pending_program_adjustment_proposed'
          : 'pending_program_adjustment_clarifier',
        replyMode,
      });
      return {
        handled: true,
        reply: planned.reply,
        mutated: false,
        replyMode,
        pendingCoachProposal: planned.proposal,
        transaction: {
          route: planned.kind === 'proposal'
            ? 'pending_program_adjustment_proposed'
            : 'pending_program_adjustment_clarifier',
          pendingProposalBefore,
          mutationAttempted: false,
          eventsEmitted: 0,
          eventsApplied: 0,
          visibleDiff: [],
          replyMode: planned.kind === 'proposal'
            ? 'program_adjustment_proposed'
            : 'program_adjustment_clarifier',
        },
      };
    }
  }

  if (looksLikeProgramExplanationQuestion(packet.userMessage)) {
    const reply = buildProgramExplanationReply(packet);
    logger.debug('[coach-flow] route', {
      route: 'program_explanation',
      mutated: false,
    });
    logger.debug('[coach-reply] source', { mode: 'program_explanation' });
    const referenced = findReferencedVisibleDay(packet);
    return {
      handled: true,
      reply,
      mutated: false,
      replyMode: 'program_explanation',
      referencedSession: referenced?.workout
        ? {
            date: referenced.date,
            sessionName: referenced.workout.name ?? 'session',
          }
        : null,
    };
  }

  // ── 0. Constraint-resolution detector ──────────────────────────────
  // Runs BEFORE pending-clarifier and intent classification so a
  // message like "no fatigue anymore" never gets re-classified as a
  // new fatigue report. Pure detector — never mutates state.
  // Pending clarifications still take priority: a bare severity reply
  // ("9/10") arriving while pendingInjury is set is the clarifier
  // handshake and must NOT be intercepted as resolution.
  if (!packet.pendingInjury) {
    const resolution = detectConstraintResolution(
      packet.userMessage,
      packet.activeConstraints ?? [],
    );
    if (resolution.matched) {
      logger.debug('[constraint-resolution] detected', {
        kind: resolution.kind,
        reason: resolution.reason,
        ambiguous: resolution.ambiguous,
        ids: resolution.constraintIdsToResolve,
      });

      // Ambiguous → ask the disambiguation question; do NOT mutate.
      if (resolution.ambiguous) {
        const reply = formatResolutionAmbiguityQuestion(
          resolution.candidates ?? packet.activeConstraints,
        );
        logger.debug('[constraint-resolution] ambiguous', {
          candidateIds: (resolution.candidates ?? packet.activeConstraints).map(
            (c) => c.id,
          ),
        });
        logger.debug('[coach-flow] route', {
          route: 'constraint_resolution_ambiguous',
          mutated: false,
        });
        return {
          handled: true,
          reply,
          mutated: false,
          replyMode: 'constraint_resolution_ambiguous',
          rationale: resolution.reason,
        };
      }

      // No active constraint to clear → honest reply, no mutation.
      if (resolution.constraintIdsToResolve.length === 0) {
        const reply = formatResolutionInactiveReply(
          resolution.kind ?? 'generic',
          resolution.bodyPart,
        );
        logger.debug('[constraint-resolution] no_active_match', {
          kind: resolution.kind,
          bodyPart: resolution.bodyPart,
        });
        logger.debug('[coach-flow] route', {
          route: 'constraint_resolution_no_match',
          mutated: false,
        });
        return {
          handled: true,
          reply,
          mutated: false,
          replyMode: 'constraint_resolution_no_match',
          rationale: resolution.reason,
        };
      }

      const exactMatches = (packet.activeConstraints ?? []).filter((constraint) =>
        resolution.constraintIdsToResolve.includes(constraint.id));
      if (exactMatches.some((constraint) => constraint.type === 'injury')) {
        return {
          handled: true,
          reply: exactMatches.length > 1
            ? 'Which exact injury has resolved? I’ll leave the other active restrictions unchanged.'
            : 'Use “Injury resolved” on that injury note so I can safely recompose and verify the affected sessions.',
          mutated: false,
          replyMode: 'constraint_resolution_ambiguous',
          rationale: 'injury_episode_resolution_required',
        };
      }

      // Apply the resolution.
      const resolutionApply = deps.applyConstraintResolution(
        resolution.constraintIdsToResolve,
        packet.todayISO,
      );
      const { cleared } = resolutionApply;
      const reply = formatResolutionSuccessReply(
        cleared,
        resolution.kind ?? 'generic',
      );
      logger.debug('[constraint-resolution] resolved', {
        clearedIds: cleared.map((c) => c.id),
        kind: resolution.kind,
      });
      logger.debug('[constraint-resolution] card_after_resolution', {
        // The store mutator handles deactivation; this log is the
        // proof the dispatcher acknowledged the post-resolve state.
        clearedCount: cleared.length,
        remainingActiveCount: resolutionApply.remainingActiveCount,
        derivedCardShouldRender: resolutionApply.derivedCardShouldRender,
      });
      logger.debug('[coach-flow] route', {
        route: 'constraint_resolution_applied',
        mutated: cleared.length > 0,
      });
      return {
        handled: true,
        reply,
        mutated: cleared.length > 0,
        replyMode: 'constraint_resolution_applied',
        rationale: resolution.reason,
      };
    }
  }

  // ── Severity clarification — only for new injuries with no severity.
  if (intent.needsClarification && intent.clarificationQuestion) {
    if (looksLikeSessionMismatchQuestion(packet.userMessage)) {
      const reply = buildSessionMismatchReply(packet);
      logger.debug('[coach-flow] suppressed_clarifier', {
        reason: 'session mismatch / training terminology',
        intent: intent.intent,
      });
      const referenced = findReferencedVisibleDay(packet);
      return {
        handled: true,
        reply,
        mutated: false,
        replyMode: 'session_mismatch_question',
        rationale: 'clarifier suppressed (session mismatch question)',
        referencedSession: referenced?.workout
          ? {
              date: referenced.date,
              sessionName: referenced.workout.name ?? 'session',
            }
          : null,
      };
    }
    // Hard-block when activeInjury exists for the SAME body part. The
    // LLM should not have classified this as needing clarification —
    // belt-and-braces here in case it does.
    if (
      packet.activeInjury &&
      packet.activeInjury.status !== 'resolved' &&
      (!intent.payload?.bodyPart ||
        intent.payload.bodyPart.toLowerCase() ===
          packet.activeInjury.bodyPart.toLowerCase())
    ) {
      logger.debug('[coach-flow] suppressed_clarifier', {
        reason: 'activeInjury exists for same body part',
        activeBodyPart: packet.activeInjury.bodyPart,
      });
      // Treat as active_injury_followup instead.
      const progression = normalizeInjuryDispatchDependencyResult(deps.runProgression(
        { kind: 'unchanged' },
        packet.activeInjury,
        packet.userMessage,
      ));
      logger.debug('[coach-flow] route', {
        route: 'active_injury_followup',
        mutated: progression.mutated,
      });
      logger.debug('[coach-reply] source', { mode: 'progression' });
      return {
        handled: true,
        reply: progression.reply,
        mutated: progression.mutated,
        replyMode: 'progression',
        rationale: 'clarifier suppressed (activeInjury same bodyPart)',
      };
    }
    logger.debug('[coach-flow] route', { route: 'severity_clarifier', mutated: false });
    logger.debug('[coach-reply] source', { mode: 'severity_clarifier' });
    return {
      handled: true,
      reply: intent.clarificationQuestion,
      mutated: false,
      replyMode: 'severity_clarifier',
      rationale: intent.rationale,
    };
  }

  switch (intent.intent) {
    case 'injury_severity_reply': {
      // Severity-only follow-up — body part priority:
      //   1. Explicit payload.bodyPart from the LLM (highest signal)
      //   2. Pending clarifier body part (the most recent question)
      //   3. activeInjury fallback (only when no pending exists)
      //
      // The pending tier is critical: without it, "shoulder is sore"
      // → "9" reply would bind to activeInjury (hammy) and reply
      // about the wrong body part. See pendingInjuryPriorityTests.
      const bodyPart =
        intent.payload?.bodyPart ??
        packet.pendingInjury?.bodyPart ??
        packet.activeInjury?.bodyPart;
      const severity = intent.payload?.severity;
      if (packet.pendingInjury?.bodyPart) {
        logger.debug('[injury-context] severity_bound_to_pending', {
          source: 'dispatcher',
          pendingBodyPart: packet.pendingInjury.bodyPart,
          activeInjuryBodyPart: packet.activeInjury?.bodyPart ?? null,
          payloadBodyPart: intent.payload?.bodyPart ?? null,
          chosenBodyPart: bodyPart,
        });
      }
      if (!bodyPart || severity == null) {
        logger.debug('[coach-flow] route', {
          route: 'severity_reply_uae',
          status: 'missing_payload',
        });
        return {
          handled: true,
          reply:
            "I didn't catch the body part for that severity. Can you tell me what's hurting?",
          mutated: false,
          replyMode: 'safe_fallback',
        };
      }
      const injury = normalizeInjuryDispatchDependencyResult(
        deps.runUAEForInjury(bodyPart, severity, packet.userMessage),
      );
      logger.debug('[coach-flow] route', {
        route: 'severity_reply_uae',
        mutated: injury.mutated,
      });
      logger.debug('[coach-reply] source', { mode: 'severity_reply_uae' });
      return {
        handled: true,
        reply: injury.reply,
        mutated: injury.mutated,
        replyMode: 'severity_reply_uae',
      };
    }

    case 'active_injury_followup': {
      const current = packet.activeInjury;
      if (!current || current.status === 'resolved') {
        // No injury to follow up on → general state reply.
        const reply = deps.generalReply(intent, packet);
        logger.debug('[coach-flow] route', { route: 'general_state_grounded', mutated: false });
        return {
          handled: true,
          reply,
          mutated: false,
          replyMode: 'general_state_grounded',
        };
      }
      const followup = intent.payload?.followupKind;
      let outcome:
        | { kind: 'resolved' }
        | { kind: 'improving'; newSeverity: number }
        | { kind: 'worsening'; newSeverity: number }
        | { kind: 'unchanged' };
      if (followup === 'resolved') outcome = { kind: 'resolved' };
      else if (followup === 'improving' && intent.payload?.severity != null) {
        outcome = { kind: 'improving', newSeverity: intent.payload.severity };
      } else if (followup === 'worsening' && intent.payload?.severity != null) {
        outcome = { kind: 'worsening', newSeverity: intent.payload.severity };
      } else {
        outcome = { kind: 'unchanged' };
      }
      const progression = normalizeInjuryDispatchDependencyResult(
        deps.runProgression(outcome, current, packet.userMessage),
      );
      logger.debug('[coach-flow] route', {
        route: 'active_injury_followup',
        followup,
        mutated: progression.mutated,
      });
      logger.debug('[coach-reply] source', { mode: 'progression' });
      return {
        handled: true,
        reply: progression.reply,
        mutated: progression.mutated,
        replyMode: 'progression',
      };
    }

    case 'why_didnt_program_change': {
      const ans = deps.inspect({
        date: intent.payload?.requestedDate,
        sessionName: intent.payload?.requestedSession,
        exerciseName:
          (intent.payload as any)?.exerciseName ??
          extractExerciseFromConcern(intent.payload?.concern),
      });
      logger.debug('[coach-flow] explanation_path', { kind: ans.kind });
      let mutated = false;
      let suffix = '';
      if (
        ans.suggestReapply &&
        packet.activeInjury &&
        packet.activeInjury.status !== 'resolved' &&
        ans.date
      ) {
        const monday = mondayOf(ans.date);
        const result = deps.reapplyInjuryAtSeverity(
          packet.activeInjury.bodyPart,
          packet.activeInjury.severity,
          monday,
          packet.todayISO,
        );
        if (result.visibleDiffDetected) {
          mutated = true;
          suffix = ` Re-applied the ${packet.activeInjury.bodyPart} restriction - the program has been updated for ${ans.date}.`;
          logger.debug('[active-constraint] future filter applied', { date: ans.date, applied: result.applied });
        } else {
          suffix = ` I tried to reconcile but the program already matches the active restriction.`;
        }
      }
      logger.debug('[coach-flow] route', { route: 'state_inspector', mutated });
      logger.debug('[coach-reply] source', { mode: mutated ? 'reapplied' : 'state_inspector' });
      return {
        handled: true,
        reply: `${ans.message}${suffix}`,
        mutated,
        replyMode: mutated ? 'reapplied' : 'state_inspector',
      };
    }

    case 'new_injury_report': {
      // The LLM may classify a fresh injury report with all the info
      // ready (body part + severity in the payload). When both are
      // present we go straight to the UAE. When severity is missing
      // and needsClarification was already false, fall through to the
      // legacy / clarifier path so the existing pendingInjuryRef
      // handshake still works.
      const bodyPart = intent.payload?.bodyPart;
      const severity = intent.payload?.severity;
      if (bodyPart && severity != null) {
        const injury = normalizeInjuryDispatchDependencyResult(
          deps.runUAEForInjury(bodyPart, severity, packet.userMessage),
        );
        logger.debug('[coach-flow] route', {
          route: 'new_injury_full_payload_uae',
          mutated: injury.mutated,
        });
        logger.debug('[coach-reply] source', { mode: 'severity_reply_uae' });
        return {
          handled: true,
          reply: injury.reply,
          mutated: injury.mutated,
          replyMode: 'severity_reply_uae',
        };
      }
      // Body part only or nothing — let the legacy path handle the
      // clarifier handshake (it already knows how to stash pending).
      logger.debug('[coach-flow] route', { route: 'fall_through', reason: 'new_injury_no_severity' });
      return {
        handled: false,
        reply: '',
        mutated: false,
        replyMode: 'fall_through',
      };
    }

    case 'program_explanation':
    case 'session_mismatch_question': {
      const reply = intent.intent === 'program_explanation'
        ? buildProgramExplanationReply(packet)
        : buildSessionMismatchReply(packet);
      logger.debug('[coach-flow] route', {
        route: intent.intent,
        mutated: false,
      });
      logger.debug('[coach-reply] source', { mode: intent.intent });
      const referenced = findReferencedVisibleDay(packet);
      return {
        handled: true,
        reply,
        mutated: false,
        replyMode: intent.intent === 'program_explanation'
          ? 'program_explanation'
          : 'session_mismatch_question',
        referencedSession: referenced?.workout
          ? {
              date: referenced.date,
              sessionName: referenced.workout.name ?? 'session',
            }
          : null,
      };
    }

    case 'request_program_adjustment': {
      const planned = planProgramAdjustmentRequest(intent, packet);
      if (planned.kind === 'unsupported') {
        logger.debug('[coach-flow] route', {
          route: 'request_program_adjustment_unsupported',
          mutated: false,
        });
        return {
          handled: true,
          reply: planned.reply || UNSUPPORTED_PROGRAM_ADJUSTMENT_REPLY,
          mutated: false,
          replyMode: 'program_adjustment_unsupported',
          pendingCoachProposal: null,
          transaction: {
            route: 'request_program_adjustment_unsupported',
            pendingProposalBefore,
            mutationAttempted: false,
            eventsEmitted: 0,
            eventsApplied: 0,
            visibleDiff: [],
            replyMode: 'program_adjustment_unsupported',
          },
        };
      }
      if (planned.kind === 'clarifier' || planned.kind === 'proposal') {
        logger.debug('[coach-flow] route', {
          route: planned.kind === 'clarifier'
            ? 'request_program_adjustment_clarifier'
            : 'request_program_adjustment_proposed',
          mutated: false,
        });
        return {
          handled: true,
          reply: planned.reply,
          mutated: false,
          replyMode: planned.kind === 'clarifier'
            ? 'program_adjustment_clarifier'
            : 'program_adjustment_proposed',
          pendingCoachProposal: planned.proposal,
          transaction: {
            route: planned.kind === 'clarifier'
              ? 'request_program_adjustment_clarifier'
              : 'request_program_adjustment_proposed',
            pendingProposalBefore,
            mutationAttempted: false,
            eventsEmitted: 0,
            eventsApplied: 0,
            visibleDiff: [],
            replyMode: planned.kind === 'clarifier'
              ? 'program_adjustment_clarifier'
              : 'program_adjustment_proposed',
          },
        };
      }
      if (planned.kind === 'not_found') {
        logger.debug('[coach-flow] route', {
          route: 'request_program_adjustment_not_found',
          mutated: false,
        });
        return {
          handled: true,
          reply: planned.reply,
          mutated: false,
          replyMode: 'program_adjustment_failed',
          pendingCoachProposal: null,
          transaction: {
            route: 'request_program_adjustment_not_found',
            pendingProposalBefore,
            mutationAttempted: false,
            eventsEmitted: 0,
            eventsApplied: 0,
            visibleDiff: [],
            replyMode: 'program_adjustment_failed',
          },
        };
      }
      const apply = deps.applyProgramAdjustmentEvents(planned.events, {
        type: planned.proposal.action,
        targetDates: planned.events.map((e) => e.date),
        requiredText: getProgramAdjustmentRequiredText(planned.proposal),
      });
      const success = planned.events.length > 0 && apply.eventsApplied > 0 && apply.success;
      logger.debug('[coach-flow] route', {
        route: success ? 'request_program_adjustment_applied' : 'request_program_adjustment_failed',
        mutated: success,
        eventsEmitted: planned.events.length,
        eventsApplied: apply.eventsApplied,
        visibleDiff: apply.visibleDiff,
      });
      return {
        handled: true,
        reply: success
          ? getProgramAdjustmentSuccessReply(planned.proposal)
          : "I tried to add that, but it didn't land in the visible program. I'm not going to pretend it changed.",
        mutated: success,
        replyMode: success ? 'program_adjustment_applied' : 'program_adjustment_failed',
        pendingCoachProposal: null,
        transaction: {
          route: success ? 'request_program_adjustment_applied' : 'request_program_adjustment_failed',
          pendingProposalBefore,
          mutationAttempted: true,
          eventsEmitted: planned.events.length,
          eventsApplied: apply.eventsApplied,
          visibleDiff: apply.visibleDiff,
          replyMode: success ? 'program_adjustment_applied' : 'program_adjustment_failed',
        },
      };
    }

    case 'fatigue':
    case 'soreness':
    case 'busy_week': {
      // Non-injury constraint producers — build a typed
      // ActiveConstraint, write it to the store, and let the existing
      // exposure/projection/Coach Update card pipeline surface it.
      // Soreness with no body part falls back to a clarifying reply
      // rather than persisting an unmapped entry.
      const kind: NonInjuryConstraintKind = intent.intent;
      const result = deps.applyNonInjuryConstraint(kind, intent, packet);
      logger.debug('[coach-flow] route', {
        route: 'non_injury_constraint',
        kind,
        mutated: result.mutated,
      });
      logger.debug('[coach-reply] source', { mode: 'non_injury_constraint' });
      return {
        handled: true,
        reply: result.reply,
        mutated: result.mutated,
        replyMode: 'non_injury_constraint',
      };
    }

    case 'record_session_outcome':
    case 'missed_session': {
      // Production classifies and commits session outcomes before this
      // legacy dispatcher. Never recreate the retired missed-session
      // constraint/Coach Note path if an older caller reaches this seam.
      logger.warn('[coach-flow] session outcome bypassed canonical transaction', {
        intent: intent.intent,
      });
      return {
        handled: true,
        reply: "I couldn't safely record that session outcome yet, so I haven't changed your plan or feedback.",
        mutated: false,
        replyMode: 'session_outcome_transaction_required',
      };
    }

    case 'general_question':
    case 'exercise_swap': {
      // For generic chat / soft requests, ALWAYS reply from the
      // dispatcher when activeInjury is set so the legacy LLM can't
      // fabricate injury-related claims. Without an active injury,
      // fall through to the legacy path (that handles exercise_swap
      // via the existing action tools).
      if (packet.activeInjury && packet.activeInjury.status !== 'resolved') {
        const reply = deps.generalReply(intent, packet);
        logger.debug('[coach-flow] route', {
          route: 'general_state_grounded',
          mutated: false,
          activeInjury: true,
        });
        logger.debug('[coach-reply] source', { mode: 'general_state_grounded' });
        return {
          handled: true,
          reply,
          mutated: false,
          replyMode: 'general_state_grounded',
        };
      }
      logger.debug('[coach-flow] route', { route: 'fall_through', reason: intent.intent });
      return {
        handled: false,
        reply: '',
        mutated: false,
        replyMode: 'fall_through',
      };
    }

    default: {
      // Unknown / unmapped intent — let legacy handle.
      logger.debug('[coach-flow] route', { route: 'fall_through', reason: 'unknown_intent' });
      return {
        handled: false,
        reply: '',
        mutated: false,
        replyMode: 'fall_through',
      };
    }
  }
}

function dispatcherDiagnosticActionType(intent: CoachIntent): AthleteActionType {
  if (intent.intent === 'record_session_outcome' || intent.intent === 'missed_session') {
    return 'session_feedback';
  }
  if (intent.intent === 'new_injury_report' || intent.intent === 'injury_severity_reply' ||
    intent.intent === 'active_injury_followup') return 'injury_change';
  if (intent.intent === 'fatigue' || intent.intent === 'soreness') return 'readiness_change';
  if (intent.intent === 'request_program_adjustment') {
    const operation = intent.payload?.operation ?? intent.payload?.action;
    if (operation === 'remove_session') return 'delete_session';
    if (operation === 'remove_conditioning') return 'delete_component';
    if (operation === 'move_session') return 'move_session';
    if (operation === 'add_conditioning') return 'add_session';
  }
  return 'coach_command';
}

/** Production Coach dispatcher entry with one trace across all injected mutation deps. */
export function dispatchCoachIntent(
  intent: CoachIntent,
  packet: CoachContextPacket,
  deps: DispatchDeps,
): DispatchOutcome {
  const targetDate = intent.payload?.targetDate ?? intent.payload?.requestedDate ?? packet.todayISO;
  const trace = beginAthleteActionTrace({
    source: 'coach',
    actionType: dispatcherDiagnosticActionType(intent),
    route: 'coach_intent_dispatcher',
    currentWeekId: mondayOf(targetDate),
    sourceDate: targetDate,
    targetDate,
    sessionDate: targetDate,
    scope: intent.payload?.scope ?? null,
  });
  return runWithAthleteActionTrace(trace, () => {
    emitAthleteActionEvent(trace, 'athlete_action_parsed', {
      parsedMutationType: intent.intent,
      confidenceBucket: intent.confidence >= 0.8 ? 'high' : intent.confidence >= 0.5 ? 'medium' : 'low',
      needsClarification: intent.needsClarification,
      payloadKeys: Object.keys(intent.payload ?? {}).sort(),
      targetIdentityHash: athleteActionDiagnosticHash({
        date: targetDate,
        requestedSession: intent.payload?.requestedSession ?? null,
        targetSessionName: intent.payload?.targetSessionName ?? null,
      }),
    });
    emitAthleteActionEvent(trace, 'athlete_action_route_selected', {
      selectedRoute: 'coach_intent_dispatcher',
      producer: 'dispatchCoachIntent',
      intentKind: intent.intent,
    });
    try {
      const outcome = dispatchCoachIntentWithinTrace(intent, packet, deps);
      const internalResultCode = `coach_dispatch_${outcome.replyMode}`;
      const failedMutation = outcome.transaction?.mutationAttempted === true && !outcome.mutated;
      if (failedMutation || outcome.replyMode === 'program_adjustment_failed') {
        const rejectionCode = outcome.transaction?.route ?? outcome.replyMode;
        emitAthleteActionEvent(trace, 'athlete_action_failed', {
          outcome: outcome.replyMode,
          internalResultCode,
          originalRejectionCode: rejectionCode,
          rejectionCodes: [rejectionCode],
          firstFailingBoundary: rejectionCode,
          failureCategory: classifyAthleteActionFailure(rejectionCode, 'dispatchCoachIntent'),
          validCandidateExisted: false,
          previousStateRestored: !outcome.mutated,
          genericMessageSelected: outcome.replyMode === 'program_adjustment_failed',
          genericMessageSelectionReason: outcome.replyMode === 'program_adjustment_failed'
            ? 'dispatcher_verified_failure_copy'
            : null,
          terminalReasonChain: athleteActionTerminalReasonChain(trace.traceId),
        });
      } else {
        emitAthleteActionEvent(trace, 'athlete_action_completed', {
          outcome: outcome.mutated ? 'accepted_changed' : outcome.handled ? 'handled_no_change' : 'fall_through',
          internalResultCode,
          dispatcherRoute: outcome.transaction?.route ?? outcome.replyMode,
          eventsEmitted: outcome.transaction?.eventsEmitted ?? 0,
          eventsApplied: outcome.transaction?.eventsApplied ?? 0,
        });
      }
      emitAthleteActionEvent(trace, 'athlete_ui_outcome_shown', {
        uiSurface: 'coach_chat',
        uiOutcome: outcome.replyMode,
        internalResultCode,
        mutated: outcome.mutated,
        handled: outcome.handled,
        finalUiMessageKey: outcome.replyMode,
      });
      return outcome;
    } catch (error) {
      const rejectionCode = error instanceof Error ? error.name : 'unknown_error';
      emitAthleteActionEvent(trace, 'athlete_action_failed', {
        outcome: 'threw',
        internalResultCode: `coach_dispatch_${intent.intent}_threw`,
        originalRejectionCode: rejectionCode,
        rejectionCodes: [rejectionCode],
        firstFailingBoundary: 'dispatchCoachIntent',
        failureCategory: classifyAthleteActionFailure(rejectionCode, 'dispatchCoachIntent'),
        validCandidateExisted: false,
        previousStateRestored: true,
        terminalReasonChain: athleteActionTerminalReasonChain(trace.traceId),
      });
      throw error;
    }
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────

function mondayOf(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  const dow = dt.getDay();
  const offset = dow === 0 ? -6 : -(dow - 1);
  dt.setDate(dt.getDate() + offset);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function extractExerciseFromConcern(concern?: string): string | undefined {
  if (!concern) return undefined;
  const m = concern.match(/(conditioning|aerobic|interval|deadlift|RDL|nordic|squat|sprint|bench|overhead)/i);
  return m ? m[1] : undefined;
}
