/**
 * missedSessions.ts — deterministic detection of past, unlogged training
 * sessions (audit gap: a day that simply passes un-opened is invisible to
 * the app, so its picture of the week silently drifts from reality).
 *
 * A session counts as "missed" when ALL of these hold for a visible day:
 *   - the date is strictly in the past (date < todayISO)
 *   - it carried a real trainable session (not a rest day, not a game,
 *     not a pure recovery flow — those aren't worth chasing)
 *   - the athlete never logged it (no SessionFeedback for that date)
 *
 * The Program tab surfaces the most recent such day with a single
 * follow-up ("Did you do Tuesday?"). Every response routes through the
 * existing feedback / producer pipeline — no Coach chat.
 *
 * Pure + input-driven so it unit-tests without stores.
 */

import type { ResolvedDay } from './sessionResolver';
import type { SessionFeedback } from '../store/programStore';

export interface MissedSession {
  date: string;
  /** Short label for the prompt, e.g. "Tuesday". */
  weekdayLabel: string;
  /** Session name as shown on the plan, when available. */
  sessionName: string | null;
  /** True when the day is a team-training-only commitment (no gym rows). */
  isTeamTraining: boolean;
}

function isRestOrRecovery(day: ResolvedDay): boolean {
  const workout = day.workout;
  if (!workout) return true;
  const name = String(workout.name ?? '').toLowerCase();
  return (
    workout.workoutType === 'Recovery' ||
    workout.sessionTier === 'recovery' ||
    name === 'rest' ||
    name === 'rest day' ||
    name === 'recovery'
  );
}

function isGame(day: ResolvedDay): boolean {
  return day.workout?.workoutType === 'Game';
}

function weekdayLabelForDate(dateISO: string): string {
  const parsed = new Date(`${dateISO}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateISO;
  return parsed.toLocaleDateString('en-AU', { weekday: 'long' });
}

/**
 * Return every past, unlogged trainable day in the visible week, oldest
 * first. The caller typically prompts for the LAST entry (most recent).
 */
export function detectMissedSessions(args: {
  weekDays: ResolvedDay[];
  todayISO: string;
  sessionFeedback: Record<string, SessionFeedback>;
}): MissedSession[] {
  const { weekDays, todayISO, sessionFeedback } = args;
  const out: MissedSession[] = [];
  for (const day of weekDays) {
    if (day.date >= todayISO) continue; // today + future are not "missed" yet
    if (!day.workout) continue;
    if (isGame(day) || isRestOrRecovery(day)) continue;
    if (sessionFeedback[day.date]) continue; // already logged → handled
    // Team-training-only days have no gym rows but are still a real
    // commitment worth acknowledging.
    const name = day.workout.name ?? null;
    const isTeamTraining =
      (day.workout.exercises?.length ?? 0) === 0 &&
      /team|field|training/i.test(String(name ?? ''));
    out.push({
      date: day.date,
      weekdayLabel: weekdayLabelForDate(day.date),
      sessionName: name,
      isTeamTraining,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** The single day to prompt about (most recent missed), or null. */
export function mostRecentMissedSession(args: {
  weekDays: ResolvedDay[];
  todayISO: string;
  sessionFeedback: Record<string, SessionFeedback>;
}): MissedSession | null {
  const all = detectMissedSessions(args);
  return all.length > 0 ? all[all.length - 1] : null;
}

export type MissedSessionResponse = 'did_it' | 'missed_it' | 'move_forward' | 'skip_it';

/** Neutral feedback recorded when the athlete confirms they did / missed a
 *  session from the prompt. "did_it" allows normal progression; "missed_it"
 *  records a skip so the progression engine holds load rather than assuming
 *  the work happened. */
export function missedSessionFeedback(
  date: string,
  response: 'did_it' | 'missed_it',
): SessionFeedback {
  return response === 'did_it'
    ? { dateStr: date, feeling: 'good', completion: 'full' }
    : { dateStr: date, completion: 'skipped' };
}
