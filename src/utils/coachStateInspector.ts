/**
 * coachStateInspector.ts — answers "why didn't X change?" questions
 * by inspecting the actual program state instead of fabricating a
 * generic explanation.
 *
 * Pure function. Reads ResolvedDay[] (current + next week), the
 * activeInjury, and any explicit overrideContexts to construct a
 * structured explanation the dispatcher can convert into a reply.
 *
 * The athlete asks something like:
 *   "why didn't Monday change?"
 *   "why are deadlifts still in next Lower?"
 *   "should I still train?"
 *
 * The dispatcher hands over the parsed reference (date / session /
 * exercise) and we walk the resolved week to give a concrete answer.
 */

import type { ResolvedDay } from './sessionResolver';
import type { InjuryState } from './injuryProgression';

export interface InspectQuery {
  /** ISO date the user is asking about (optional). */
  date?: string;
  /** Workout name reference, e.g. "Lower Strength" / "Monday Lower". */
  sessionName?: string;
  /** Exercise the user explicitly mentioned, e.g. "deadlifts". */
  exerciseName?: string;
}

export interface InspectInput {
  query: InspectQuery;
  todayISO: string;
  activeInjury: InjuryState | null;
  currentWeek: ResolvedDay[];
  nextWeek: ResolvedDay[];
  /** Per-date override contexts so we can tell template vs manual. */
  overrideContexts: Record<string, { intent?: string; label?: string }>;
}

export interface InspectAnswer {
  /** Short structured reason — picked up by the reply builder. */
  kind:
    | 'past_date'
    | 'no_session_on_date'
    | 'session_already_modified'
    | 'session_unaffected_by_injury'
    | 'exercise_already_removed'
    | 'exercise_present_should_remove'
    | 'no_active_injury'
    | 'general_state';
  /** Human-readable explanation suitable for chat. */
  message: string;
  /** ISO date of the resolved day this answer is grounded in (when applicable). */
  date?: string;
  /** Source of the resolved workout (template / manual / etc). */
  source?: ResolvedDay['source'];
  /** Whether the dispatcher should attempt a re-apply / reconcile. */
  suggestReapply?: boolean;
}

function findDayByDateOrName(
  days: ResolvedDay[],
  query: InspectQuery,
): ResolvedDay | undefined {
  if (query.date) return days.find((d) => d.date === query.date);
  if (query.sessionName) {
    const target = query.sessionName.trim().toLowerCase();
    return days.find((d) => (d.workout?.name ?? '').toLowerCase().includes(target));
  }
  return undefined;
}

function exercisePresent(workout: ResolvedDay['workout'], name: string): boolean {
  if (!workout) return false;
  const target = name.trim().toLowerCase();
  return (workout.exercises ?? []).some(
    (ex) => (ex.exercise?.name ?? '').toLowerCase().includes(target),
  );
}

/**
 * Compose a structured answer to a "why didn't X change?" query.
 *
 *   1. If the date is in the past → past_date
 *   2. No session on that date → no_session_on_date
 *   3. Date has a manual override (source==='manual') → session_already_modified
 *   4. Active injury exists but the resolved workout has no coachNotes
 *      AND the requested exercise is still present → exercise_present_should_remove
 *      (suggestReapply=true; dispatcher should re-run the engine)
 *   5. The session is not relevant for the active injury → session_unaffected_by_injury
 *   6. The requested exercise has already been swapped/removed → exercise_already_removed
 *   7. No active injury at all → no_active_injury
 *   8. Fall-through general state explanation.
 */
export function inspectCoachState(input: InspectInput): InspectAnswer {
  const { query, todayISO, activeInjury, currentWeek, nextWeek, overrideContexts } = input;

  // Resolve the date for past-date detection.
  if (query.date && query.date < todayISO) {
    return {
      kind: 'past_date',
      date: query.date,
      message: `${query.date} is in the past, so the program for that day was already locked in. Future sessions are the ones I can still adjust.`,
    };
  }

  // Find the referenced day across both weeks (current first, then next).
  const allDays = [...currentWeek, ...nextWeek];
  const day = findDayByDateOrName(allDays, query);

  if (query.date && !day) {
    return {
      kind: 'no_session_on_date',
      date: query.date,
      message: `Nothing scheduled for ${query.date}, so there's nothing to change.`,
    };
  }
  if (!day || !day.workout) {
    return {
      kind: 'no_session_on_date',
      message: `I couldn't find that session in the current or next week.`,
    };
  }

  // Manual override — session has been touched already.
  if (day.source === 'manual') {
    const ctx = overrideContexts[day.date];
    const intent = ctx?.intent ?? 'manual';
    return {
      kind: 'session_already_modified',
      date: day.date,
      source: 'manual',
      message: `${day.short} ${day.workout.name} has already been modified (${intent}). Coach notes on that day: ${(day.workout.coachNotes ?? []).join('; ') || 'none'}.`,
    };
  }

  // No active injury — there's nothing to apply.
  if (!activeInjury || activeInjury.status === 'resolved') {
    return {
      kind: 'no_active_injury',
      date: day.date,
      source: day.source,
      message: `No active injury on file, so the program isn't being filtered. Sessions are running on the original template.`,
    };
  }

  // Exercise-specific question — is the named exercise still in the
  // workout despite the active injury?
  if (query.exerciseName) {
    const present = exercisePresent(day.workout, query.exerciseName);
    if (present) {
      // Two sub-cases: did the resolver-level filter run?
      const hasCoachNote = (day.workout.coachNotes ?? []).length > 0;
      if (hasCoachNote) {
        return {
          kind: 'exercise_already_removed',
          date: day.date,
          source: day.source,
          message: `${query.exerciseName} is still listed because the resolver kept it (likely a tier mismatch — the injury severity doesn't warrant removal at this level). The session has notes: ${(day.workout.coachNotes ?? []).join('; ')}.`,
        };
      }
      return {
        kind: 'exercise_present_should_remove',
        date: day.date,
        source: day.source,
        suggestReapply: true,
        message: `${query.exerciseName} is still in ${day.workout.name} — the injury filter didn't catch it. I'll re-apply the ${activeInjury.bodyPart} restrictions now.`,
      };
    }
    return {
      kind: 'exercise_already_removed',
      date: day.date,
      source: day.source,
      message: `${query.exerciseName} is already out of ${day.workout.name}. Coach notes: ${(day.workout.coachNotes ?? []).join('; ') || 'none'}.`,
    };
  }

  // Session-level question — is this session even relevant for the bucket?
  const hasCoachNote = (day.workout.coachNotes ?? []).length > 0;
  if (!hasCoachNote) {
    return {
      kind: 'session_unaffected_by_injury',
      date: day.date,
      source: day.source,
      message: `${day.short} ${day.workout.name} doesn't load the ${activeInjury.bodyPart}, so the injury filter left it alone. Going ahead with that session is fine.`,
    };
  }

  return {
    kind: 'general_state',
    date: day.date,
    source: day.source,
    message: `${day.short} ${day.workout.name} carries the ${activeInjury.bodyPart} restrictions: ${(day.workout.coachNotes ?? []).join('; ')}.`,
  };
}
