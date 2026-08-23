/**
 * THE SESSION STOPWATCH — R-132 (Sam, 2026-08-23, verbatim):
 *
 *   *"Stopwatch in the strength sessions or programmed sessions in top right
 *   corner above everything maybe on same line as Thu 20/8 - 7 Exercises =
 *   keeping font the same but just saying 'Start session' its a little button
 *   or something with a timer next to it that you can pause or end, i.e. this
 *   should make it easy to monitor how long the strength lasts and makes
 *   putting in the feed back form very easy"*
 *
 * WHAT IS STORED IS THE ATHLETE'S ACTS, NOT THE READING. Start, pause and
 * resume are timestamps the athlete created; elapsed time is DERIVED from
 * them on every tick, so a killed app resumes the same count from disk and
 * nothing needs a background timer. Ending converts the acts into one
 * measured RESULT (`measuredMinutes`) — the number the feedback form's
 * duration question is asking for, which is the second half of his sentence.
 *
 * Every transition takes `nowISO` from its caller: this module holds no
 * clock, so the store and every suite drive it deterministically.
 */

export interface SessionStopwatch {
  /** The workout the athlete started, so a different session never inherits it. */
  readonly workoutId: string;
  /** The day it belongs to — the feedback form matches on this. */
  readonly dateISO: string;
  readonly startedAtISO: string;
  /** Whole milliseconds spent paused across every pause so far. */
  readonly pauseAccumMs: number;
  /** Set while paused; null while running. */
  readonly pausedAtISO: string | null;
}

/** The measured result an ended stopwatch leaves behind. */
export interface EndedSessionStopwatch {
  readonly workoutId: string;
  readonly dateISO: string;
  readonly endedAtISO: string;
  /**
   * Elapsed running time, to the nearest whole minute, never 0 — a session
   * the athlete timed happened, and the feedback form's duration refuses 0.
   */
  readonly measuredMinutes: number;
}

export function startSessionStopwatch(args: {
  workoutId: string;
  dateISO: string;
  nowISO: string;
}): SessionStopwatch {
  return {
    workoutId: args.workoutId,
    dateISO: args.dateISO,
    startedAtISO: args.nowISO,
    pauseAccumMs: 0,
    pausedAtISO: null,
  };
}

export function pauseSessionStopwatch(
  stopwatch: SessionStopwatch,
  nowISO: string,
): SessionStopwatch {
  if (stopwatch.pausedAtISO) return stopwatch;
  return { ...stopwatch, pausedAtISO: nowISO };
}

export function resumeSessionStopwatch(
  stopwatch: SessionStopwatch,
  nowISO: string,
): SessionStopwatch {
  if (!stopwatch.pausedAtISO) return stopwatch;
  return {
    ...stopwatch,
    pauseAccumMs: stopwatch.pauseAccumMs
      + Math.max(0, Date.parse(nowISO) - Date.parse(stopwatch.pausedAtISO)),
    pausedAtISO: null,
  };
}

/** Running time so far, pauses excluded. Never negative, whatever the clocks. */
export function sessionStopwatchElapsedMs(
  stopwatch: SessionStopwatch,
  nowISO: string,
): number {
  const upTo = stopwatch.pausedAtISO ?? nowISO;
  return Math.max(0,
    Date.parse(upTo) - Date.parse(stopwatch.startedAtISO) - stopwatch.pauseAccumMs);
}

export function endSessionStopwatch(
  stopwatch: SessionStopwatch,
  nowISO: string,
): EndedSessionStopwatch {
  const elapsed = sessionStopwatchElapsedMs(stopwatch, nowISO);
  return {
    workoutId: stopwatch.workoutId,
    dateISO: stopwatch.dateISO,
    endedAtISO: nowISO,
    measuredMinutes: Math.max(1, Math.round(elapsed / 60_000)),
  };
}

/** `mm:ss` under an hour, `h:mm:ss` from there — digits and colons only. */
export function formatSessionStopwatchElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const two = (value: number): string => String(value).padStart(2, '0');
  return hours > 0
    ? `${hours}:${two(minutes)}:${two(seconds)}`
    : `${minutes}:${two(seconds)}`;
}
