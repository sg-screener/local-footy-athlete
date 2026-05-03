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
import { resolveWeekWithConditioning, getMondayStr, addDays } from './sessionResolver';
import { buildScheduleStateImperative } from './coachWeekDiff';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import type { CoachContextPacket } from './coachIntent';

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

  const currentWeek = resolveWeekWithConditioning(monday, state);
  const nextWeek = resolveWeekWithConditioning(nextMonday, state);

  const cuStore = useCoachUpdatesStore.getState();
  const activeInjury = cuStore.activeInjury ?? null;
  const activeConstraints = (cuStore.activeConstraints ?? []).filter(
    (c) => c.status !== 'resolved',
  );
  const coachUpdate = cuStore.updatesByWeek[monday] ?? null;

  const recent = input.recentMessages.slice(-RECENT_HISTORY_LIMIT);

  return {
    userMessage: input.userMessage,
    recentMessages: recent,
    activeInjury,
    activeConstraints,
    pendingInjury: input.pendingInjury ?? null,
    coachUpdate: coachUpdate && coachUpdate.active ? coachUpdate : null,
    currentWeek,
    nextWeek,
    todayISO: input.todayISO,
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
  };
  return JSON.stringify(out);
}
