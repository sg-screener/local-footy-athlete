import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorageCompat } from './asyncStorageCompat';
import {
  endSessionStopwatch,
  pauseSessionStopwatch,
  resumeSessionStopwatch,
  startSessionStopwatch,
  type EndedSessionStopwatch,
  type SessionStopwatch,
} from '../rules/sessionStopwatch';

/**
 * Session Stopwatch Store — R-132 (Sam, 2026-08-23).
 *
 * PERSISTS TWO SMALL THINGS AND DERIVES THE REST:
 * - `current` — the athlete's timing ACTS (start/pause timestamps) for the one
 *   session being timed. FACTS: a relaunch mid-session resumes the same count
 *   because elapsed time is derived from the stored timestamps, never ticked
 *   in memory.
 * - `lastEnded` — the measured RESULT of the most recently ended stopwatch,
 *   held so the feedback form's duration question can offer the measured
 *   number instead of an empty box (*"makes putting in the feed back form
 *   very easy"*). One slot, deliberately: the form reads it for the matching
 *   day; a new measurement replaces the old one.
 *
 * Starting a different workout's stopwatch replaces `current` — one athlete,
 * one body, one session being timed at a time.
 */
interface SessionStopwatchState {
  current: SessionStopwatch | null;
  lastEnded: EndedSessionStopwatch | null;
  start: (args: { workoutId: string; dateISO: string; nowISO: string }) => void;
  pause: (nowISO: string) => void;
  resume: (nowISO: string) => void;
  /** Ends and records the measurement. Returns it for the caller's own use. */
  end: (nowISO: string) => EndedSessionStopwatch | null;
  /** Ends only the named session. A different open workout is never stopped. */
  endFor: (args: {
    workoutId: string;
    dateISO: string;
    nowISO: string;
  }) => EndedSessionStopwatch | null;
}

export const useSessionStopwatchStore = create<SessionStopwatchState>()(
  persist(
    (set, get) => ({
      current: null,
      lastEnded: null,
      start: (args) => set({ current: startSessionStopwatch(args) }),
      pause: (nowISO) => {
        const { current } = get();
        if (current) set({ current: pauseSessionStopwatch(current, nowISO) });
      },
      resume: (nowISO) => {
        const { current } = get();
        if (current) set({ current: resumeSessionStopwatch(current, nowISO) });
      },
      end: (nowISO) => {
        const { current } = get();
        if (!current) return null;
        const ended = endSessionStopwatch(current, nowISO);
        set({ current: null, lastEnded: ended });
        return ended;
      },
      endFor: ({ workoutId, dateISO, nowISO }) => {
        const { current } = get();
        if (!current || current.workoutId !== workoutId || current.dateISO !== dateISO) {
          return null;
        }
        return get().end(nowISO);
      },
    }),
    {
      name: 'session-stopwatch-store',
      storage: createJSONStorage(() => asyncStorageCompat),
      partialize: (state) => ({
        current: state.current,
        lastEnded: state.lastEnded,
      }),
    },
  ),
);

/**
 * The measured minutes for this exact session, when the athlete timed it.
 *
 * A paused stopwatch is already a durable measurement: its persisted
 * `pausedAtISO` freezes the reading. A running stopwatch can also be read at
 * the instant Log Session is tapped; that door immediately promotes it to the
 * ended result through `endFor`.
 */
export function measuredMinutesFor(args: {
  workoutId: string;
  dateISO: string;
  nowISO: string;
}): number | null {
  const { current, lastEnded } = useSessionStopwatchStore.getState();
  if (current?.workoutId === args.workoutId && current.dateISO === args.dateISO) {
    return endSessionStopwatch(current, args.nowISO).measuredMinutes;
  }
  return lastEnded?.workoutId === args.workoutId && lastEnded.dateISO === args.dateISO
    ? lastEnded.measuredMinutes
    : null;
}
