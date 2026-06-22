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
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import type { CoachContextPacket } from './coachIntent';
import type { PendingCoachProposal } from './coachIntent';
import { buildProgramTabProjectedWeek } from './visibleProgramReadModel';
import { getCoachContextSnapshot } from '../store/coachContextStateStore';
import { autoBindUniqueModalityTarget } from './coachVisibleWeekAutoBind';
import type { PendingScheduleTransaction } from '../store/pendingCoachClarifierStore';
import {
  referenceResolutionFromTargetFrame,
  resolveCoachTargetFrame,
  targetFrameFromReferenceTarget,
} from './coachTargetFrame';

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
  pendingTransaction?: PendingScheduleTransaction | null;
  selectedDate?: string | null;
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
  const lastMutationRaw = useCoachMutationHistoryStore
    .getState()
    .getLastUndoableMutation();
  const lastMutation = lastMutationRaw
    ? {
        operation: lastMutationRaw.operation,
        mutationKind: lastMutationRaw.mutationKind,
        affectedDates: lastMutationRaw.affectedDates,
        scope: lastMutationRaw.scope,
        touchedActivities: lastMutationRaw.touchedActivities,
        timestamp: lastMutationRaw.timestamp,
      }
    : null;

  // Phase 2 — pull durable target context from the coach context
  // store and run the deterministic reference resolver. Both fields
  // are TTL-filtered inside getCoachContextSnapshot so a workout
  // opened yesterday never silently anchors "it" today.
  const ctx = getCoachContextSnapshot();
  const targetFrame = resolveCoachTargetFrame({
    userMessage: input.userMessage,
    visibleWeek: currentWeek,
    pendingTransaction: input.pendingTransaction ?? null,
    lastMutationTarget: ctx.lastMutationTarget,
    openedSession: ctx.lastOpenedWorkout,
    explainedSession: ctx.lastExplainedSession,
    selectedDate: input.selectedDate ?? null,
    todayISO: input.todayISO,
  });
  const baseResolution = referenceResolutionFromTargetFrame(targetFrame, input.userMessage);

  // ─── VISIBLE-WEEK UNIQUE-MODALITY AUTO-BIND ────────────────────
  // When the resolver couldn't bind a target (no lastExplained /
  // lastOpened / explicit day) but the message is a modality swap
  // and exactly one visible-week session matches the source modality,
  // synthesise the reference here so every downstream consumer
  // (router, executor, CoachScreen) sees it.  This is the canonical
  // location — CoachScreen also has a redundant call but this one
  // fires first and makes the packet self-contained.
  const basePacket = {
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
    lastMutationTarget: ctx.lastMutationTarget,
    lastMutation,
    targetFrame,
    referenceResolution: baseResolution,
  };

  const autoBind = autoBindUniqueModalityTarget(basePacket, input.userMessage);
  if (autoBind.bound) {
    const autoBoundTargetFrame = autoBind.boundTarget
      ? targetFrameFromReferenceTarget({
          target: autoBind.boundTarget,
          targetSource: 'visible_week',
          reason: 'visible_week_auto_bind',
          explicitDateRole: 'none',
          confidence: 0.78,
        })
      : targetFrame;
    return {
      ...autoBind.packet,
      targetFrame: autoBoundTargetFrame,
      referenceResolution: referenceResolutionFromTargetFrame(autoBoundTargetFrame, input.userMessage),
    };
  }
  return basePacket;
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
          conditioningOptions: (d.workout.conditioningBlock?.options ?? []).map((o: any) => ({
            title: o.title,
            description: o.description,
          })),
          exercises: (d.workout.exercises ?? []).map((e: any) => ({
            name: e.exercise?.name,
            notes: e.notes,
            prescriptionType: e.prescriptionType,
            sets: e.prescribedSets,
            repsMin: e.prescribedRepsMin,
            repsMax: e.prescribedRepsMax,
          })).filter((e: any) => e.name),
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
    lastMutationTarget: packet.lastMutationTarget
      ? {
          date: packet.lastMutationTarget.date,
          sessionName: packet.lastMutationTarget.sessionName,
          source: packet.lastMutationTarget.source,
          modalities: packet.lastMutationTarget.modalities ?? [],
          lastMutationType: packet.lastMutationTarget.lastMutationType,
          targetSessionId: packet.lastMutationTarget.targetSessionId ?? null,
          newlyAdded: packet.lastMutationTarget.newlyAdded ?? false,
        }
      : null,
    lastMutation: packet.lastMutation
      ? {
          operation: packet.lastMutation.operation,
          mutationKind: packet.lastMutation.mutationKind,
          affectedDates: packet.lastMutation.affectedDates,
          scope: packet.lastMutation.scope,
          touchedActivities: packet.lastMutation.touchedActivities ?? [],
          timestamp: packet.lastMutation.timestamp,
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
    targetFrame: packet.targetFrame
      ? {
          targetSource: packet.targetFrame.targetSource,
          resolvedTarget: packet.targetFrame.resolvedTarget,
          confidence: packet.targetFrame.confidence,
          missingFields: packet.targetFrame.missingFields,
          candidateOptions: packet.targetFrame.candidateOptions,
          reason: packet.targetFrame.reason,
          explicitDateRole: packet.targetFrame.explicitDateRole,
        }
      : null,
  };
  return JSON.stringify(out);
}
