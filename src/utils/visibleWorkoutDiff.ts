/**
 * visibleWorkoutDiff.ts
 *
 * Captures the subset of a Workout that the athlete can actually SEE on
 * the Program tab + day-detail screen, and compares before/after copies
 * of that subset.
 *
 * WHY THIS EXISTS
 *   The mutation pipeline (engine → applyAdjustmentEvents → store →
 *   resolver) can succeed at every step and still produce a workout that
 *   looks identical to the user. That happens when the engine emits an
 *   event the UI doesn't render — historically, things like writing a
 *   note into `description` when no surface displays description, or a
 *   cosmetic field bump that doesn't change any user-facing label.
 *
 *   The hard invariant: **if the coach's reply implies a change, the
 *   user must see a difference in the Program tab.** This helper is the
 *   verification seam that lets the coach screen enforce that — call
 *   it before/after the apply and compare.
 *
 * UI FIELDS WE TRACK
 *   - name           — rendered in HomeScreen day rows
 *   - exerciseNames  — rendered as count + via View Workout
 *   - conditioning   — rendered as the combined conditioning block
 *   - coachNotes     — rendered inline on HomeScreen + DayWorkoutScreen
 *
 *   We deliberately ignore `description` because not every surface
 *   renders it; relying on it would re-introduce the original failure.
 *   We ignore `sessionTier` because tier changes alone (e.g. core →
 *   optional) don't always produce a visible label change.
 *
 *   If a future event kind only changes a field outside this list, the
 *   diff helper will (correctly) report no visible change — and the
 *   reply gate will catch it.
 */

import type { Workout } from '../types/domain';

export interface VisibleWorkoutSnapshot {
  name: string | null;
  exerciseNames: string[]; // sorted, lower-cased for stable comparison
  conditioning: string[];  // sorted title/description surface
  coachNotes: string[];    // sorted for stable comparison
}

/**
 * Snapshot the user-visible surface of a workout. Sorts arrays so the
 * comparison is order-independent (a swap that reorders exercises but
 * keeps the same set wouldn't count as a "visible change" by name —
 * which is what we want).
 */
export function snapshotVisibleWorkout(
  workout: Workout | null | undefined,
): VisibleWorkoutSnapshot {
  if (!workout) return { name: null, exerciseNames: [], conditioning: [], coachNotes: [] };
  const exerciseNames = (workout.exercises ?? [])
    .map((ex) => (ex.exercise?.name ?? '').trim())
    .filter((n) => n.length > 0)
    .map((n) => n.toLowerCase())
    .sort();
  const coachNotes = [...(workout.coachNotes ?? [])]
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .sort();
  const conditioning = (workout.conditioningBlock?.options ?? [])
    .flatMap((opt) => [opt.title, opt.description])
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .map((n) => n.toLowerCase())
    .sort();
  return {
    name: workout.name ?? null,
    exerciseNames,
    conditioning,
    coachNotes,
  };
}

/**
 * Strict equality for two visible-workout snapshots. Returns true when
 * the user would NOT see any difference between the two states.
 */
export function visibleSnapshotsEqual(
  a: VisibleWorkoutSnapshot,
  b: VisibleWorkoutSnapshot,
): boolean {
  if (a.name !== b.name) return false;
  if (a.exerciseNames.length !== b.exerciseNames.length) return false;
  for (let i = 0; i < a.exerciseNames.length; i++) {
    if (a.exerciseNames[i] !== b.exerciseNames[i]) return false;
  }
  if (a.conditioning.length !== b.conditioning.length) return false;
  for (let i = 0; i < a.conditioning.length; i++) {
    if (a.conditioning[i] !== b.conditioning[i]) return false;
  }
  if (a.coachNotes.length !== b.coachNotes.length) return false;
  for (let i = 0; i < a.coachNotes.length; i++) {
    if (a.coachNotes[i] !== b.coachNotes[i]) return false;
  }
  return true;
}

export interface VisibleDiffEntry {
  date: string;
  changedFields: Array<'name' | 'exerciseNames' | 'conditioning' | 'coachNotes'>;
  before: VisibleWorkoutSnapshot;
  after: VisibleWorkoutSnapshot;
}

/**
 * Compute per-date visible diffs given a list of dates and a lookup for
 * before/after snapshots. Returns one entry per CHANGED date — a date
 * with no visible change is omitted entirely. Caller checks
 * `result.length > 0` for the hard invariant.
 *
 * Used by CoachScreen.handleSend to enforce the rule that a "Program
 * updated" reply requires at least one date where the user actually
 * sees something different.
 */
export function computeVisibleDiff(
  dates: string[],
  before: Record<string, VisibleWorkoutSnapshot>,
  after: Record<string, VisibleWorkoutSnapshot>,
): VisibleDiffEntry[] {
  const out: VisibleDiffEntry[] = [];
  for (const date of dates) {
    const b = before[date] ?? snapshotVisibleWorkout(null);
    const a = after[date] ?? snapshotVisibleWorkout(null);
    if (visibleSnapshotsEqual(a, b)) continue;
    const changed: Array<'name' | 'exerciseNames' | 'conditioning' | 'coachNotes'> = [];
    if (a.name !== b.name) changed.push('name');
    if (
      a.exerciseNames.length !== b.exerciseNames.length ||
      a.exerciseNames.some((n, i) => n !== b.exerciseNames[i])
    ) {
      changed.push('exerciseNames');
    }
    if (
      a.coachNotes.length !== b.coachNotes.length ||
      a.coachNotes.some((n, i) => n !== b.coachNotes[i])
    ) {
      changed.push('coachNotes');
    }
    if (
      a.conditioning.length !== b.conditioning.length ||
      a.conditioning.some((n, i) => n !== b.conditioning[i])
    ) {
      changed.push('conditioning');
    }
    out.push({ date, changedFields: changed, before: b, after: a });
  }
  return out;
}

export interface VerifiedProgramMutationResult {
  success: boolean;
  changedDates: string[];
  visibleDiff: VisibleDiffEntry[];
  reason?: string;
}

export interface IntendedProgramChange {
  type: 'add_conditioning' | 'remove_conditioning' | 'move_session' | string;
  targetDates?: string[];
  requiredText?: string;
}

export function assertVerifiedProgramMutation(args: {
  beforeWeek: Array<{ date: string; workout?: Workout | null }>;
  afterWeek: Array<{ date: string; workout?: Workout | null }>;
  intendedChange: IntendedProgramChange;
}): VerifiedProgramMutationResult {
  const before: Record<string, VisibleWorkoutSnapshot> = {};
  const after: Record<string, VisibleWorkoutSnapshot> = {};
  for (const d of args.beforeWeek) before[d.date] = snapshotVisibleWorkout(d.workout);
  for (const d of args.afterWeek) after[d.date] = snapshotVisibleWorkout(d.workout);
  const dates = args.intendedChange.targetDates?.length
    ? args.intendedChange.targetDates
    : Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const visibleDiff = computeVisibleDiff(dates, before, after);
  if (visibleDiff.length === 0) {
    return {
      success: false,
      changedDates: [],
      visibleDiff,
      reason: 'no_visible_diff',
    };
  }
  if (args.intendedChange.type === 'add_conditioning') {
    const needle = (args.intendedChange.requiredText ?? 'aerobic').toLowerCase();
    const landed = visibleDiff.some((entry) => {
      const surface = [
        ...entry.after.conditioning,
        ...entry.after.exerciseNames,
        ...entry.after.coachNotes.map((n) => n.toLowerCase()),
      ].join(' ');
      return /conditioning|interval|aerobic|bike|flush|tempo/.test(surface) && surface.includes(needle);
    });
    if (!landed) {
      return {
        success: false,
        changedDates: visibleDiff.map((d) => d.date),
        visibleDiff,
        reason: 'intended_conditioning_not_visible',
      };
    }
  }
  return {
    success: true,
    changedDates: visibleDiff.map((d) => d.date),
    visibleDiff,
  };
}
