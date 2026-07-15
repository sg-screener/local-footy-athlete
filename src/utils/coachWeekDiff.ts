/**
 * coachWeekDiff — Resolved-week snapshot + diff helper for the Coach pipeline.
 *
 * The Coach edge function can return a `programUpdate.workouts` payload that
 * the app applies via `setCurrentMicrocycle`. Before the diff helper, the UI
 * emitted "Program updated — check your Program tab." whenever that payload
 * was present, even if the payload was a no-op (same workouts as before) or
 * if the update silently failed.
 *
 * This module is the single source of truth for "did the athlete-facing
 * resolved week actually change?". It runs the SAME resolver the Program tab
 * uses (`resolveWeekWithConditioning`) to capture a per-day fingerprint,
 * compares two snapshots, and returns a structured diff plus an Aussie-tone
 * summary that's grounded in what the athlete will actually see.
 *
 * USAGE (CoachScreen.handleSend):
 *   1. Snapshot before any mutation:   const before = snapshotResolvedWeek(buildScheduleStateImperative());
 *   2. Apply the program update normally (setCurrentMicrocycle, replaceExerciseInWorkout, etc.)
 *   3. Snapshot after:                  const after = snapshotResolvedWeek(buildScheduleStateImperative());
 *   4. Diff:                            const diff = diffWeekSnapshots(before, after);
 *   5. Gate the "Program updated" message on `diff.hasChanges`. Use
 *      `summarizeDiff(diff)` to describe what changed in human terms.
 *
 * IMPORTANT:
 *   - This file imports stores via getState() so it can be called outside
 *     React (i.e. from event handlers, not just hooks).
 *   - It re-implements the same ScheduleState assembly that `useScheduleState`
 *     does in src/hooks/useSchedule.ts. Keep these in sync.
 */

import {
  resolveWeekWithConditioning,
  getMondayStr,
  type ScheduleState,
  type ResolvedDay,
} from './sessionResolver';
import { DEFAULT_ATHLETE_CONTEXT } from './sessionBuilder';
import { resolveEquipmentAvailability } from './equipmentAvailability';
import { useProgramStore } from '../store/programStore';
import { useCalendarStore } from '../store/calendarStore';
import { useProfileStore } from '../store/profileStore';
import { useReadinessStore } from '../store/readinessStore';
import { logger } from './logger';
import { todayISOLocal as getTodayISOLocal } from './appDate';
import { deriveProfileReadiness } from './readiness';
import { buildReadinessActiveConstraints } from './readinessConstraints';
import { normalizeAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import {
  semanticFingerprint,
  snapshotSemanticResolvedDay,
} from './programSemanticSnapshot';

// ─── Types ───

const DAY_NAME: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

const DAY_NAME_TO_NUMBER: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

/** The athlete-facing fingerprint of a single day's resolved session. */
export interface DayFingerprint {
  date: string;            // ISO YYYY-MM-DD
  dayOfWeek: number;       // 0=Sun..6=Sat
  short: string;           // 'MON'
  dayName: string;         // 'Monday'
  source: ResolvedDay['source'];
  indicator: ResolvedDay['indicator'];
  workoutName: string | null;
  exerciseNames: string[];
  semanticFingerprint?: string;
}

/** A full week snapshot — Monday → Sunday. */
export interface WeekSnapshot {
  mondayStr: string;
  days: DayFingerprint[];
}

export type DayChangeType =
  | 'session-replaced'   // workout name changed (e.g. Lower → Recovery)
  | 'rest-added'         // had a session, now rest
  | 'session-added'      // was rest/none, now has a session
  | 'exercises-changed'  // same session name, different exercises
  | 'prescription-changed'; // same labels/identity, different semantic prescription

/** Per-day diff entry. */
export interface DayDiff {
  date: string;
  dayOfWeek: number;
  short: string;
  dayName: string;
  changeType: DayChangeType;
  before: { workoutName: string | null; exerciseNames: string[] };
  after: { workoutName: string | null; exerciseNames: string[] };
}

/** Structured diff between two week snapshots. */
export interface WeekDiff {
  hasChanges: boolean;
  changedDays: DayDiff[];
}

// ─── Imperative ScheduleState builder ───

/**
 * Replicates `useScheduleState` from src/hooks/useSchedule.ts but using
 * .getState() so it can be called from event handlers.
 *
 * KEEP IN SYNC with `useScheduleState` — any new field added there must be
 * mirrored here, or the snapshot won't match what the Program tab shows.
 */
export function buildScheduleStateImperative(): ScheduleState & { activeConstraints: any[] } {
  const programState = useProgramStore.getState();
  const calendarState = useCalendarStore.getState();
  const profileState = useProfileStore.getState();
  const onboardingData = profileState.onboardingData;
  const todayISO = getTodayISOLocal();

  // Injury / constraint state — read lazily via require to avoid circular imports.
  // The same active constraint array also carries equipment limits.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useCoachUpdatesStore } = require('../store/coachUpdatesStore');
  const coachUpdatesState = useCoachUpdatesStore.getState();

  // AthleteContext (matches useAthleteContext)
  const athleteContext = onboardingData
    ? {
        injuries: onboardingData.injuries || [],
        equipmentTags: resolveEquipmentAvailability(
          onboardingData,
          coachUpdatesState.activeConstraints ?? [],
          todayISO,
        ),
        trainingLocation: onboardingData.trainingLocation || 'Commercial gym',
        onboardingData,
      }
    : DEFAULT_ATHLETE_CONTEXT;

  const seasonPhase = onboardingData?.seasonPhase || null;
  const usualGameDay = onboardingData?.usualGameDay;
  const gameDay = onboardingData?.gameDay;
  // Older persisted states and focused test fixtures can pre-date the
  // accepted-context field.  The cold-start normalizer is the ownership
  // boundary for that compatibility case; visible projection should never
  // dereference a partial store snapshot directly.
  const acceptedContext = normalizeAcceptedMaterialContext(
    programState.acceptedMaterialContext,
  );
  const acceptedOwnsMaterialState = acceptedContext.revision > 0;
  const todayReadinessSignal = acceptedOwnsMaterialState
    ? acceptedContext.readinessSignalsByDate[todayISO]
    : useReadinessStore.getState().signalsByDate[todayISO];
  const readiness = deriveProfileReadiness(onboardingData);

  const preferredDays = onboardingData?.preferredTrainingDays;
  const availableDayNumbers =
    preferredDays && preferredDays.length > 0
      ? preferredDays
          .map((name: string) => DAY_NAME_TO_NUMBER[name])
          .filter((n: number | undefined) => n !== undefined)
      : undefined;

  const activeInjury = acceptedOwnsMaterialState
    ? acceptedContext.activeInjury
    : coachUpdatesState.activeInjury ?? null;
  const activeConstraints = acceptedOwnsMaterialState
    ? acceptedContext.activeConstraints
    : coachUpdatesState.activeConstraints ?? [];
  const readinessActiveConstraints = acceptedOwnsMaterialState
    ? []
    : buildReadinessActiveConstraints(todayReadinessSignal);

  return {
    currentProgram: programState.currentProgram,
    currentMicrocycle: programState.currentMicrocycle,
    manualOverrides: programState.dateOverrides || {},
    weekScopedOverlays: programState.weekScopedOverlays || {},
    markedDays: acceptedOwnsMaterialState
      ? acceptedContext.markedDays
      : calendarState.markedDays || {},
    athleteContext,
    seasonPhase,
    usualGameDay,
    gameDay,
    readiness,
    blockState: programState.blockState || null,
    sessionFeedback: programState.sessionFeedback || {},
    weightOverrides: programState.weightOverrides || {},
    availableDayNumbers,
    activeInjury,
    activeConstraints: [
      ...activeConstraints,
      ...readinessActiveConstraints,
    ],
  };
}

// ─── Snapshot ───

/** Convert a ResolvedDay to a stable, comparable fingerprint. */
function fingerprintDay(rd: ResolvedDay): DayFingerprint {
  const exerciseNames = rd.workout?.exercises
    ? rd.workout.exercises
        .map((ex: any) => ex.exercise?.name || ex.exerciseId || '')
        .filter((n: string) => n.length > 0)
    : [];

  return {
    date: rd.date,
    dayOfWeek: rd.dayOfWeek,
    short: rd.short,
    dayName: DAY_NAME[rd.dayOfWeek] || rd.short,
    source: rd.source,
    indicator: rd.indicator,
    workoutName: rd.workout?.name || null,
    exerciseNames,
    semanticFingerprint: semanticFingerprint(snapshotSemanticResolvedDay(rd)),
  };
}

/**
 * Snapshot the user-facing resolved week.
 *
 * Defaults to "this week" (weekOffset = 0). Pass a different offset (e.g. +1)
 * if the coach action is acting on a future week.
 */
export function snapshotResolvedWeek(
  state: ScheduleState,
  weekOffset = 0,
): WeekSnapshot {
  const mondayStr = getMondayStr(weekOffset);
  const resolved = resolveWeekWithConditioning(mondayStr, state);
  return {
    mondayStr,
    days: resolved.map(fingerprintDay),
  };
}

// ─── Diff ───

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function classifyChange(
  before: DayFingerprint,
  after: DayFingerprint,
): DayChangeType | null {
  const beforeName = before.workoutName;
  const afterName = after.workoutName;
  const sameExercises = arraysEqual(before.exerciseNames, after.exerciseNames);

  // Both null → both rest, no change
  if (!beforeName && !afterName) return null;

  // Rest → session
  if (!beforeName && afterName) return 'session-added';

  // Session → rest
  if (beforeName && !afterName) return 'rest-added';

  // Session → session
  if (beforeName !== afterName) return 'session-replaced';

  // Same session name but different exercises
  if (!sameExercises) return 'exercises-changed';

  if (before.semanticFingerprint !== after.semanticFingerprint) {
    return 'prescription-changed';
  }

  return null;
}

/**
 * Diff two week snapshots taken at the same week offset.
 *
 * Pre-condition: `before.mondayStr === after.mondayStr`. If they don't match
 * (e.g. someone took the snapshots across a midnight boundary or for different
 * weeks), the helper returns `hasChanges: false` and logs a warning — coach
 * messages should fall back to the no-op fallback in that case.
 */
export function diffWeekSnapshots(
  before: WeekSnapshot,
  after: WeekSnapshot,
): WeekDiff {
  if (before.mondayStr !== after.mondayStr) {
    if (typeof console !== 'undefined') {
      logger.warn(
        '[coachWeekDiff] snapshots span different weeks — skipping diff',
        { before: before.mondayStr, after: after.mondayStr },
      );
    }
    return { hasChanges: false, changedDays: [] };
  }

  const changedDays: DayDiff[] = [];
  for (let i = 0; i < before.days.length; i++) {
    const b = before.days[i];
    const a = after.days[i];
    if (!a || b.date !== a.date) continue;

    const changeType = classifyChange(b, a);
    if (!changeType) continue;

    changedDays.push({
      date: b.date,
      dayOfWeek: b.dayOfWeek,
      short: b.short,
      dayName: b.dayName,
      changeType,
      before: { workoutName: b.workoutName, exerciseNames: b.exerciseNames },
      after: { workoutName: a.workoutName, exerciseNames: a.exerciseNames },
    });
  }

  return { hasChanges: changedDays.length > 0, changedDays };
}

// ─── Summary ───

/** One-line "what changed on this day" sentence in the coach's voice. */
function summarizeDay(d: DayDiff): string {
  switch (d.changeType) {
    case 'session-added':
      return `${d.dayName}'s now ${d.after.workoutName} (was a rest day).`;
    case 'rest-added':
      return `${d.dayName}'s now a rest day (was ${d.before.workoutName}).`;
    case 'session-replaced':
      return `${d.dayName}'s now ${d.after.workoutName} (was ${d.before.workoutName}).`;
    case 'exercises-changed': {
      const beforeSet = new Set(d.before.exerciseNames);
      const afterSet = new Set(d.after.exerciseNames);
      const added = d.after.exerciseNames.filter((n) => !beforeSet.has(n));
      const removed = d.before.exerciseNames.filter((n) => !afterSet.has(n));
      if (added.length === 1 && removed.length === 1) {
        return `${d.dayName}: swapped ${removed[0]} for ${added[0]}.`;
      }
      if (added.length > 0 && removed.length > 0) {
        return `${d.dayName}: ${removed.length} swap${removed.length === 1 ? '' : 's'} in ${d.after.workoutName}.`;
      }
      return `${d.dayName}: tweaked ${d.after.workoutName}.`;
    }
    case 'prescription-changed':
      return `${d.dayName}: updated the ${d.after.workoutName} prescription.`;
  }
}

/**
 * Aussie-tone, athlete-grounded summary of what actually changed.
 *
 * Returns a sentence like:
 *   "Wednesday's now Recovery (was Lower Strength). Friday: swapped Back Squat for Front Squat."
 *
 * Returns the empty string if `diff.hasChanges` is false. Callers should use
 * the no-op fallback ("I checked your week — no changes were applied yet.")
 * in that case, NOT this function.
 */
export function summarizeDiff(diff: WeekDiff): string {
  if (!diff.hasChanges) return '';
  return diff.changedDays.map(summarizeDay).join(' ');
}

// ─── Today-forward filter ───

/**
 * Drop past-date entries from a diff. Coach summaries must NEVER claim a
 * change to a session that's already passed — even if a tool wrote an
 * override on a past date, the athlete can't act on it and reporting it
 * just confuses the picture.
 *
 * `todayISO` defaults to the local-machine "today" in YYYY-MM-DD form.
 * Pass an explicit value in tests for determinism.
 */
export function filterDiffFromDate(
  diff: WeekDiff,
  todayISO?: string,
): WeekDiff {
  const cutoff = todayISO || getTodayISOLocal();
  const future = diff.changedDays.filter((d) => d.date >= cutoff);
  return { hasChanges: future.length > 0, changedDays: future };
}

// ─── Bullet-style summary (preferred for coach reply turns) ───

/**
 * Bullet-style breakdown grounded in the diff. One bullet per changed day.
 * Returns the empty string when there are no changes.
 *
 * Format:
 *   "• Wednesday: swapped Back Squat for Front Squat.\n• Friday: now Recovery (was Lower Strength)."
 */
export function summarizeDiffBullets(diff: WeekDiff): string {
  if (!diff.hasChanges) return '';
  return diff.changedDays.map((d) => `• ${summarizeDay(d)}`).join('\n');
}

// summarizeDay was defined above as a private helper for summarizeDiff.
// Re-expose under the same name within this module so summarizeDiffBullets
// can use it. (It's already in scope — no separate export needed.)

// ─── Convenience wrapper for the common Coach flow ───

/**
 * Take a snapshot using the current store state. Convenience wrapper so
 * CoachScreen doesn't have to import ScheduleState plumbing directly.
 */
export function snapshotCurrentWeek(weekOffset = 0): WeekSnapshot {
  return snapshotResolvedWeek(buildScheduleStateImperative(), weekOffset);
}
