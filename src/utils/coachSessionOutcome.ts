import type { ResolvedDay } from './sessionResolver';
import type {
  CoachContextPacket,
  CoachIntent,
  CoachSessionOutcomeComponentPayload,
} from './coachIntent';
import {
  parseFeedbackCompletion,
  parseFeedbackFeeling,
  parseFeedbackSoreness,
  parseSessionOutcomeReason,
  type FeedbackCompletion,
  type FeedbackFeeling,
  type RecordSessionOutcomeComponentIntent,
  type RecordSessionOutcomeIntent,
  type SessionOutcomeReason,
} from '../types/sessionOutcome';
import {
  commitSessionOutcomeTransaction,
  resolveSessionOutcomeTarget,
  type SessionOutcomeTransactionResult,
} from '../store/sessionOutcomeTransaction';
import { getSessionComponents } from './sessionComponents';

export type CoachSessionOutcomeResolution =
  | { kind: 'not_outcome' }
  | { kind: 'clarify'; reply: string }
  | { kind: 'ready'; intent: RecordSessionOutcomeIntent; target: ResolvedDay };

export type CoachSessionOutcomeExecution =
  | { kind: 'not_outcome' }
  | { kind: 'clarify'; reply: string }
  | {
      kind: 'recorded';
      reply: string;
      result: Extract<SessionOutcomeTransactionResult, { ok: true }>;
      target: ResolvedDay;
    }
  | { kind: 'failed'; reply: string; result: Extract<SessionOutcomeTransactionResult, { ok: false }> };

/**
 * Deterministic adapter from semantic Coach classification to the canonical
 * shared intent. It resolves structured target context; it does not inspect
 * phrases or mutate any store.
 */
export function resolveCoachSessionOutcomeIntent(
  coachIntent: CoachIntent,
  packet: CoachContextPacket,
): CoachSessionOutcomeResolution {
  if (
    coachIntent.intent !== 'record_session_outcome' &&
    coachIntent.intent !== 'missed_session'
  ) return { kind: 'not_outcome' };

  const payload = coachIntent.payload ?? {};
  const completion = coachIntent.intent === 'missed_session'
    ? 'skipped'
    : parseFeedbackCompletion(payload.completion);
  if (!completion) {
    return { kind: 'clarify', reply: 'Did you complete it fully, partly, or miss it?' };
  }

  const targetResolution = resolveCoachOutcomeTarget(packet, payload);
  if (targetResolution.kind === 'clarify') return targetResolution;
  const target = targetResolution.target;
  const workout = target.workout!;
  const availableComponents = getSessionComponents(workout);
  const suppliedReason = payload.outcomeReason ?? payload.reason ??
    (completion === 'partial' ? payload.partialReason : payload.skipReason);
  const reason = parseSessionOutcomeReason(completion, suppliedReason);
  if (completion !== 'full' && suppliedReason !== undefined && !reason) {
    return { kind: 'clarify', reply: 'What was the main reason?' };
  }
  const componentResolution = resolveComponentOutcomes({
    supplied: payload.componentOutcomes,
    available: availableComponents,
    completion,
    defaultReason: reason,
  });
  if (componentResolution.kind === 'clarify') return componentResolution;
  const feeling = parseFeedbackFeeling(payload.feeling);
  const soreness = parseFeedbackSoreness(payload.soreness);
  const difficulty = finiteDifficulty(payload.difficulty);
  const notes = typeof payload.notes === 'string' ? payload.notes.trim() : '';
  return {
    kind: 'ready',
    target,
    intent: {
      date: target.date,
      sessionIdentity: {
        workoutId: workout.id,
        ...(workout.planEntryId ? { planEntryId: workout.planEntryId } : {}),
      },
      completion,
      feeling: completion === 'skipped' ? null : feeling,
      soreness: completion === 'skipped' ? null : soreness,
      reason,
      componentOutcomes: componentResolution.outcomes,
      ...(Array.isArray(payload.strength) ? { strength: payload.strength } : {}),
      ...(payload.conditioning ? { conditioning: payload.conditioning } : {}),
      ...(notes ? { notes } : {}),
      ...(difficulty !== undefined ? { difficulty } : {}),
      source: {
        entryPoint: 'coach',
        surface: 'coach_chat',
        interpretedIntent: coachIntent.intent,
      },
    },
  };
}

export async function executeCoachSessionOutcome(
  coachIntent: CoachIntent,
  packet: CoachContextPacket,
): Promise<CoachSessionOutcomeExecution> {
  const resolved = resolveCoachSessionOutcomeIntent(coachIntent, packet);
  if (resolved.kind !== 'ready') return resolved;
  const result = await commitSessionOutcomeTransaction(resolved.intent);
  if (!result.ok) {
    return {
      kind: 'failed',
      reply: "I understood the feedback, but I couldn't persist it safely, so I haven't marked the session.",
      result,
    };
  }
  return {
    kind: 'recorded',
    reply: coachOutcomeReply(result.normalizedIntent, resolved.target),
    result,
    target: resolved.target,
  };
}

function resolveCoachOutcomeTarget(
  packet: CoachContextPacket,
  payload: NonNullable<CoachIntent['payload']>,
): { kind: 'target'; target: ResolvedDay } | { kind: 'clarify'; reply: string } {
  const visible = uniqueDays([...packet.currentWeek, ...packet.nextWeek]);
  const explicitDate = payload.targetDate ?? payload.requestedDate;
  if (explicitDate) {
    const target = dayForDate(explicitDate, visible, packet.todayISO);
    if (!target?.workout) {
      return { kind: 'clarify', reply: `I can't see a session on ${explicitDate}. Which session do you mean?` };
    }
    return { kind: 'target', target };
  }

  const framedDate = packet.targetFrame?.resolvedTarget?.date ??
    packet.referenceResolution?.target?.date ?? null;
  if (framedDate) {
    const target = dayForDate(framedDate, visible, packet.todayISO);
    if (target?.workout) return { kind: 'target', target };
  }

  const namedSession = payload.targetSessionName ?? payload.requestedSession;
  if (namedSession) {
    const matches = visible.filter((day) =>
      day.workout && sessionNamesMatch(day.workout.name, namedSession));
    if (matches.length === 1) return { kind: 'target', target: matches[0] };
    if (matches.length > 1) return ambiguousTarget(matches);
    return { kind: 'clarify', reply: `I can't match “${namedSession}” to one visible session. Which day was it?` };
  }

  const contextual = [
    packet.lastOpenedWorkout,
    packet.lastMutationTarget,
    packet.lastDiscussedWorkout,
    packet.lastExplainedSession,
  ]
    .filter((entry): entry is NonNullable<typeof entry> => !!entry)
    .sort((left, right) => right.updatedAt - left.updatedAt);
  for (const entry of contextual) {
    const target = dayForDate(entry.date, visible, packet.todayISO);
    if (target?.workout) return { kind: 'target', target };
  }

  const today = visible.find((day) => day.date === packet.todayISO && day.workout);
  if (today) return { kind: 'target', target: today };

  const recentCandidates = visible.filter((day) =>
    !!day.workout && day.date <= packet.todayISO);
  if (recentCandidates.length === 1) {
    return { kind: 'target', target: recentCandidates[0] };
  }
  if (recentCandidates.length > 1) return ambiguousTarget(recentCandidates);
  return { kind: 'clarify', reply: 'Which session are you giving feedback on?' };
}

function resolveComponentOutcomes(args: {
  supplied: CoachSessionOutcomeComponentPayload[] | undefined;
  available: ReturnType<typeof getSessionComponents>;
  completion: FeedbackCompletion;
  defaultReason: SessionOutcomeReason | null;
}):
  | { kind: 'outcomes'; outcomes: RecordSessionOutcomeComponentIntent[] }
  | { kind: 'clarify'; reply: string } {
  if (!args.supplied || args.supplied.length === 0) {
    return {
      kind: 'outcomes',
      outcomes: args.available.map((component) => ({
        componentId: component.id,
        kind: component.kind,
        label: component.label,
        completion: args.completion,
        reason: args.completion === 'full' ? null : args.defaultReason,
      })),
    };
  }

  const outcomes: RecordSessionOutcomeComponentIntent[] = [];
  const seen = new Set<string>();
  for (const supplied of args.supplied) {
    const component = args.available.find((candidate) => candidate.kind === supplied.kind);
    const completion = parseFeedbackCompletion(supplied.completion);
    if (!component || !completion || seen.has(component.id)) {
      return { kind: 'clarify', reply: 'Which part of the session did you complete or skip?' };
    }
    seen.add(component.id);
    const reason = parseSessionOutcomeReason(completion, supplied.reason);
    if (completion !== 'full' && supplied.reason !== undefined && !reason) {
      return { kind: 'clarify', reply: `What happened with the ${component.label}?` };
    }
    outcomes.push({
      componentId: component.id,
      kind: component.kind,
      label: component.label,
      completion,
      reason,
    });
  }
  if (args.completion === 'full' || args.completion === 'skipped') {
    for (const component of args.available) {
      if (seen.has(component.id)) continue;
      outcomes.push({
        componentId: component.id,
        kind: component.kind,
        label: component.label,
        completion: args.completion,
        reason: args.completion === 'full' ? null : args.defaultReason,
      });
    }
  }
  if (outcomes.length !== args.available.length) {
    return {
      kind: 'clarify',
      reply: 'What happened with each part of the session?',
    };
  }
  return { kind: 'outcomes', outcomes };
}

function dayForDate(
  date: string,
  visible: ResolvedDay[],
  todayISO: string,
): ResolvedDay | null {
  const existing = visible.find((day) => day.date === date);
  if (existing) return existing;
  try {
    const target = resolveSessionOutcomeTarget(date, todayISO);
    return {
      date,
      dayOfWeek: target.workout.dayOfWeek,
      short: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][target.workout.dayOfWeek],
      isToday: date === todayISO,
      workout: target.workout,
      source: 'template',
      indicator: 'core',
    };
  } catch {
    return null;
  }
}

function ambiguousTarget(candidates: ResolvedDay[]): { kind: 'clarify'; reply: string } {
  const labels = candidates.slice(-3).map((day) => {
    const weekday = new Date(`${day.date}T12:00:00`).toLocaleDateString('en-AU', {
      weekday: 'long',
    });
    return `${weekday}'s ${day.workout?.name ?? 'session'}`;
  });
  return { kind: 'clarify', reply: `Which session do you mean—${labels.join(' or ')}?` };
}

function uniqueDays(days: ResolvedDay[]): ResolvedDay[] {
  const byDate = new Map<string, ResolvedDay>();
  for (const day of days) byDate.set(day.date, day);
  return Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date));
}

function sessionNamesMatch(visibleName: string, requestedName: string): boolean {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
  const visible = normalize(visibleName);
  const requested = normalize(requestedName);
  return visible === requested || visible.includes(requested) || requested.includes(visible);
}

function finiteDifficulty(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.min(10, Math.round(value)))
    : undefined;
}

function coachOutcomeReply(intent: RecordSessionOutcomeIntent, target: ResolvedDay): string {
  const label = target.workout?.name ?? 'session';
  if (intent.completion === 'skipped') {
    return `Got it—I recorded ${label} as missed. I haven't moved or deleted the workout.`;
  }
  if (intent.completion === 'partial') {
    return `Got it—I recorded ${label} as partially completed${feelingSuffix(intent.feeling)}.`;
  }
  return `Got it—I recorded ${label} as completed${feelingSuffix(intent.feeling)}.`;
}

function feelingSuffix(feeling: FeedbackFeeling | null): string {
  if (!feeling) return '';
  return ` and ${feeling.replace('_', ' ')}`;
}
