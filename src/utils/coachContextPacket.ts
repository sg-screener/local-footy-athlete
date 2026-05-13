/**
 * coachContextPacket.ts — assemble the rich state the LLM intent
 * classifier needs to disambiguate user messages without us having to
 * hard-code phrase guards.
 *
 * Context = the truth we already have on file. The classifier reads
 * it, returns a structured intent, and the dispatcher acts. This
 * module is the seam between "what's true now" and "what the LLM
 * sees" — keep it pure (no mutations).
 *
 * Notes:
 *   - We deliberately don't include the LLM history pre-summarisation
 *     here; recent turns are enough for the disambiguation cases the
 *     spec calls out.
 *   - The week summaries strip down ResolvedDay[] to the fields the
 *     classifier actually needs (date, name, exercise names,
 *     coachNotes). Full Workout objects are too noisy.
 */

import type { ResolvedDay } from './sessionResolver';
import { getMondayStr, addDays } from './sessionResolver';
import { buildScheduleStateImperative } from './coachWeekDiff';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useProgramStore } from '../store/programStore';
import type { CoachContextPacket } from './coachIntent';
import type { PendingCoachProposal } from './coachIntent';
import { buildProgramTabProjectedWeek } from './visibleProgramReadModel';
import { getCoachContextSnapshot } from '../store/coachContextStateStore';
import { resolveCoachReference } from './coachReferenceResolver';

const RECENT_HISTORY_LIMIT = 8;

export interface BuildPacketInput {
  /** The user's just-submitted message. */
  userMessage: string;
  /** Recent conversation turns. */
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** ISO YYYY-MM-DD — locks classifier reasoning to a deterministic clock. */
  todayISO: string;
  /**
   * Pending injury context from the prior clarifier turn (if any).
   * The dispatcher uses this to bind severity-only replies to the
   * correct body part, even when activeInjury exists for a different
   * body part. See pendingInjuryPriorityTests for the live bug repro.
   */
  pendingInjury?: {
    bodyPart: string;
    timestamp: number;
  } | null;
  pendingCoachProposal?: PendingCoachProposal | null;
}

/**
 * Build the full packet from the live stores + supplied conversation
 * snippet. Pure outside of the store reads (which are themselves
 * idempotent .getState() reads).
 */
export function buildCoachContextPacket(input: BuildPacketInput): CoachContextPacket {
  const state = buildScheduleStateImperative();
  const monday = getMondayStr(0);
  const nextMonday = addDays(monday, 7);

  const cuStore = useCoachUpdatesStore.getState();
  const activeInjury = cuStore.activeInjury ?? null;
  const activeConstraints = (cuStore.activeConstraints ?? []).filter(
    (c) => c.status !== 'resolved',
  );
  const programStore = useProgramStore.getState();
  const projectedState = {
    ...state,
    activeConstraints,
  };
  const currentWeek = buildProgramTabProjectedWeek({
    mondayISO: monday,
    todayISO: input.todayISO,
    state: projectedState,
    overrideContexts: programStore.overrideContexts ?? {},
  });
  const nextWeek = buildProgramTabProjectedWeek({
    mondayISO: nextMonday,
    todayISO: input.todayISO,
    state: projectedState,
    overrideContexts: programStore.overrideContexts ?? {},
  });
  const coachUpdate = cuStore.updatesByWeek[monday] ?? null;

  const recent = input.recentMessages.slice(-RECENT_HISTORY_LIMIT);

  // Phase 2 — pull durable target context from the coach context
  // store and run the deterministic reference resolver. Both fields
  // are TTL-filtered inside getCoachContextSnapshot so a workout
  // opened yesterday never silently anchors "it" today.
  const ctx = getCoachContextSnapshot();
  const referenceResolution = resolveCoachReference({
    userMessage: input.userMessage,
    todayISO: input.todayISO,
    currentWeek,
    nextWeek,
    lastOpenedWorkout: ctx.lastOpenedWorkout,
    lastExplainedSession: ctx.lastExplainedSession,
    lastDiscussedWorkout: ctx.lastDiscussedWorkout,
  });

  return {
    userMessage: input.userMessage,
    recentMessages: recent,
    activeInjury,
    activeConstraints,
    pendingInjury: input.pendingInjury ?? null,
    pendingCoachProposal: input.pendingCoachProposal ?? null,
    coachUpdate: coachUpdate && coachUpdate.active ? coachUpdate : null,
    currentWeek,
    nextWeek,
    sessionFeedback: state.sessionFeedback ?? {},
    todayISO: input.todayISO,
    lastOpenedWorkout: ctx.lastOpenedWorkout,
    lastExplainedSession: ctx.lastExplainedSession,
    lastDiscussedWorkout: ctx.lastDiscussedWorkout,
    referenceResolution,
  };
}

/**
 * Lossy serialisation for sending the packet to an LLM as a JSON
 * blob. Strips the heavy Workout payload down to just the fields the
 * classifier reasons about (name, exercise names, coachNotes, source).
 */
export function serialisePacketForLLM(packet: CoachContextPacket): string {
  const stripDay = (d: ResolvedDay) => ({
    date: d.date,
    short: d.short,
    source: d.source,
    workout: d.workout
      ? {
          name: d.workout.name,
          workoutType: (d.workout as any).workoutType,
          sessionTier: (d.workout as any).sessionTier,
          exercises: (d.workout.exercises ?? []).map((e: any) => e.exercise?.name).filter(Boolean),
          coachNotes: d.workout.coachNotes ?? [],
        }
      : null,
  });

  const out = {
    userMessage: packet.userMessage,
    todayISO: packet.todayISO,
    activeInjury: packet.activeInjury
      ? {
          bodyPart: packet.activeInjury.bodyPart,
          severity: packet.activeInjury.severity,
          status: packet.activeInjury.status,
          createdAt: packet.activeInjury.createdAt,
        }
      : null,
    activeConstraints: (packet.activeConstraints ?? []).map((c) => ({
      id: c.id,
      type: c.type,
      severity: c.severity,
      status: c.status,
      ...(c.type === 'injury' || c.type === 'soreness'
        ? { bodyPart: c.bodyPart }
        : {}),
    })),
    pendingCoachProposal: packet.pendingCoachProposal
      ? {
          type: packet.pendingCoachProposal.type,
          target: packet.pendingCoachProposal.target,
          targetDay: packet.pendingCoachProposal.targetDay,
          targetDate: packet.pendingCoachProposal.targetDate,
          targetSessionName: packet.pendingCoachProposal.targetSessionName,
          action: packet.pendingCoachProposal.action,
          needs: packet.pendingCoachProposal.needs,
          supportedOptions: packet.pendingCoachProposal.supportedOptions,
          conditioningOption: packet.pendingCoachProposal.conditioningOption,
          prescription: packet.pendingCoachProposal.prescription,
          modality: packet.pendingCoachProposal.modality,
          allowNonStrengthTarget: packet.pendingCoachProposal.allowNonStrengthTarget,
          createdAt: packet.pendingCoachProposal.createdAt,
        }
      : null,
    coachUpdate: packet.coachUpdate
      ? {
          reason: packet.coachUpdate.reason,
          rules: packet.coachUpdate.rules,
          changes: packet.coachUpdate.changes,
        }
      : null,
    currentWeek: packet.currentWeek.map(stripDay),
    nextWeek: packet.nextWeek.map(stripDay),
    recentMessages: packet.recentMessages,
    // Phase 2 — durable target context. Strip the timestamp from the
    // wire payload (the resolver applied TTL already; raw timestamps
    // are noise to the classifier).
    lastOpenedWorkout: packet.lastOpenedWorkout
      ? {
          date: packet.lastOpenedWorkout.date,
          sessionName: packet.lastOpenedWorkout.sessionName,
          source: packet.lastOpenedWorkout.source,
          modalities: packet.lastOpenedWorkout.modalities ?? [],
        }
      : null,
    lastExplainedSession: packet.lastExplainedSession
      ? {
          date: packet.lastExplainedSession.date,
          sessionName: packet.lastExplainedSession.sessionName,
          source: packet.lastExplainedSession.source,
          modalities: packet.lastExplainedSession.modalities ?? [],
        }
      : null,
    lastDiscussedWorkout: packet.lastDiscussedWorkout
      ? {
          date: packet.lastDiscussedWorkout.date,
          sessionName: packet.lastDiscussedWorkout.sessionName,
          source: packet.lastDiscussedWorkout.source,
          modalities: packet.lastDiscussedWorkout.modalities ?? [],
        }
      : null,
    referenceResolution: packet.referenceResolution
      ? {
          status: packet.referenceResolution.status,
          target: packet.referenceResolution.target,
          confidence: packet.referenceResolution.confidence,
          failureReason: packet.referenceResolution.failureReason,
          isMutationLike: packet.referenceResolution.isMutationLike,
        }
      : null,
  };
  return JSON.stringify(out);
}
