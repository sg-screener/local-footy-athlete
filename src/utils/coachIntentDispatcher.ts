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
 *                          ├─▶ general_question / fatigue / missed / busy / swap
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

// ─── Result type ────────────────────────────────────────────────────

export type DispatchReplyMode =
  | 'severity_clarifier'
  | 'severity_reply_uae'
  | 'progression'
  | 'state_inspector'
  | 'reapplied'
  | 'general_state_grounded'
  | 'non_injury_constraint'
  | 'constraint_resolution_applied'
  | 'constraint_resolution_ambiguous'
  | 'constraint_resolution_no_match'
  | 'safe_fallback'
  | 'fall_through';

export type NonInjuryConstraintKind =
  | 'fatigue'
  | 'soreness'
  | 'busy_week'
  | 'missed_session';

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
}

// ─── Dependency surface ─────────────────────────────────────────────

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
  ) => string;
  /** Run UAE for a known {bodyPart, severity}. Returns the reply text. */
  runUAEForInjury: (
    bodyPart: string,
    severity: number,
    note: string,
  ) => string;
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
   * Apply a non-injury constraint (fatigue / soreness / busy_week /
   * missed_session). Builds the producer constraint, writes it to the
   * activeConstraints store, and returns a state-grounded reply +
   * whether the program was actually mutated.
   *
   * `mutated: false` ⇒ informational only (e.g. missed_session). The
   * card still surfaces, the reply is still produced, and the active
   * constraint is still persisted — but the visible week is unchanged.
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
}

// ─── Dispatcher ─────────────────────────────────────────────────────

export function dispatchCoachIntent(
  intent: CoachIntent,
  packet: CoachContextPacket,
  deps: DispatchDeps,
): DispatchOutcome {
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
      const reply = deps.runProgression(
        { kind: 'unchanged' },
        packet.activeInjury,
        packet.userMessage,
      );
      logger.debug('[coach-flow] route', { route: 'active_injury_followup', mutated: false });
      logger.debug('[coach-reply] source', { mode: 'progression' });
      return {
        handled: true,
        reply,
        mutated: false,
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
      const reply = deps.runUAEForInjury(bodyPart, severity, packet.userMessage);
      logger.debug('[coach-flow] route', { route: 'severity_reply_uae', mutated: true });
      logger.debug('[coach-reply] source', { mode: 'severity_reply_uae' });
      return {
        handled: true,
        reply,
        mutated: true,
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
      const reply = deps.runProgression(outcome, current, packet.userMessage);
      logger.debug('[coach-flow] route', {
        route: 'active_injury_followup',
        followup,
        mutated: outcome.kind !== 'unchanged',
      });
      logger.debug('[coach-reply] source', { mode: 'progression' });
      return {
        handled: true,
        reply,
        mutated: outcome.kind !== 'unchanged',
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
          suffix = ` Re-applied the ${packet.activeInjury.bodyPart} restriction — the program has been updated for ${ans.date}.`;
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
        const reply = deps.runUAEForInjury(bodyPart, severity, packet.userMessage);
        logger.debug('[coach-flow] route', { route: 'new_injury_full_payload_uae', mutated: true });
        logger.debug('[coach-reply] source', { mode: 'severity_reply_uae' });
        return {
          handled: true,
          reply,
          mutated: true,
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

    case 'request_program_adjustment': {
      // Concrete adjustment requests still fall through for now —
      // the existing edge-function action layer handles non-injury
      // adjustments. When activeInjury exists, log a warning so we
      // can spot any conflicting mutation in the wild.
      if (packet.activeInjury && packet.activeInjury.status !== 'resolved') {
        logger.debug('[coach-flow] route', {
          route: 'request_program_adjustment',
          warning: 'activeInjury present — UAE constraints take priority',
        });
      }
      logger.debug('[coach-flow] route', { route: 'fall_through', reason: 'request_program_adjustment' });
      return {
        handled: false,
        reply: '',
        mutated: false,
        replyMode: 'fall_through',
      };
    }

    case 'fatigue':
    case 'soreness':
    case 'busy_week':
    case 'missed_session': {
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
  const m = concern.match(/(deadlift|RDL|nordic|squat|sprint|bench|overhead)/i);
  return m ? m[1] : undefined;
}
