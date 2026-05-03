/**
 * constraintSummary.ts — describe what active constraints did to the
 * VISIBLE program across current AND future weeks.
 *
 * Why this layer exists:
 *   The UAE only emits AdjustmentEvent[] for the current week. The
 *   exposure engine + visibleProgramProjection silently filter future
 *   weeks via the activeInjury constraint. Without this helper, the
 *   coach reply (and Coach Update card) would say "left the program
 *   unchanged" because no events fired — even though next Monday's
 *   Lower Body Strength was rebuilt by the projection.
 *
 *   Pipeline:
 *     applyAdjustmentEvents → current-week applied (events surface)
 *     activeInjury seed     → projection filters next week silently
 *     summariseConstraintProjectionEffects(...) → bridge the two so
 *                              the reply + card can describe BOTH.
 *
 * Pure: no store reads, no I/O. Caller passes raw + projected weeks;
 * we diff them and produce text bullets for the reply.
 */

import type { ResolvedDay } from './sessionResolver';
import type { Constraint } from './exposureEngine';
import { logger } from './logger';

export interface SessionDelta {
  date: string;
  workoutName: string;
  removed: string[];
  /** Replacements introduced by future projection (never fake subs — kept []). */
  replaced: Array<{ from: string; to: string }>;
  /** Coach notes added by projection. */
  addedCoachNotes: string[];
}

export interface ConstraintSummary {
  currentWeekChanges: string[];
  nextWeekChanges: string[];
  affectedDates: string[];
  removedExercisesByDate: Record<string, string[]>;
  replacedExercisesByDate: Record<string, Array<{ from: string; to: string }>>;
  /** Per-day session-level deltas (used by the card / reply for detail). */
  currentWeekDeltas: SessionDelta[];
  nextWeekDeltas: SessionDelta[];
  /** When set, both weeks were unchanged — caller can confidently say so. */
  unchangedReason?: string;
  /** Reply category — drives the wording the caller picks. */
  replyMode:
    | 'no_changes'
    | 'current_only'
    | 'future_constraint_applied'
    | 'both_weeks_changed';
}

export interface SummariseInput {
  activeConstraint: Constraint | null;
  /** Raw (pre-projection) days for the current week, Mon..Sun. */
  currentWeekRaw: ResolvedDay[];
  /** Projected (post-constraint) days for the current week. */
  currentWeekProjected: ResolvedDay[];
  /** Raw next week. */
  nextWeekRaw: ResolvedDay[];
  /** Projected next week. */
  nextWeekProjected: ResolvedDay[];
}

// ─── Helpers ────────────────────────────────────────────────────────

function exerciseNames(day: ResolvedDay | undefined): string[] {
  if (!day?.workout) return [];
  return (day.workout.exercises ?? [])
    .map((e: any) => e.exercise?.name ?? '')
    .filter(Boolean);
}

function coachNotes(day: ResolvedDay | undefined): string[] {
  return day?.workout?.coachNotes ?? [];
}

const DOW_LABEL: Record<number, string> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed',
  4: 'Thu', 5: 'Fri', 6: 'Sat',
};

function dowFromISO(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return DOW_LABEL[new Date(y, m - 1, d, 12, 0, 0, 0).getDay()] ?? '';
}

/**
 * Compute the per-date delta between raw vs projected days.
 * Returns only the dates whose visible exercise list / coachNotes
 * actually changed.
 */
function diffWeek(
  raw: ResolvedDay[],
  projected: ResolvedDay[],
): SessionDelta[] {
  const projectedByDate = new Map(projected.map((d) => [d.date, d]));
  const out: SessionDelta[] = [];
  for (const r of raw) {
    const p = projectedByDate.get(r.date);
    if (!p) continue;
    const before = exerciseNames(r);
    const after = exerciseNames(p);
    const removed = before.filter((n) => !after.includes(n));
    const added = after.filter((n) => !before.includes(n));
    const beforeNotes = coachNotes(r);
    const afterNotes = coachNotes(p);
    const addedNotes = afterNotes.filter((n) => !beforeNotes.includes(n));
    if (removed.length === 0 && addedNotes.length === 0 && added.length === 0) continue;
    // We never fabricate substitutions in the projection — `replaced` stays
    // empty unless a future feature introduces real swaps (e.g. an
    // exposure-engine-backed replacement table).
    out.push({
      date: r.date,
      workoutName: r.workout?.name ?? '',
      removed,
      replaced: [],
      addedCoachNotes: addedNotes,
    });
  }
  return out;
}

function workoutBullet(delta: SessionDelta, includeDow: boolean): string {
  const dow = includeDow ? `${dowFromISO(delta.date)} ` : '';
  const name = delta.workoutName ? delta.workoutName : 'session';
  if (delta.removed.length === 0) {
    return `${dow}${name} adjusted — coach note added`;
  }
  if (delta.removed.length === 1) {
    return `${dow}${name} adjusted — ${delta.removed[0]} removed`;
  }
  if (delta.removed.length <= 3) {
    return `${dow}${name} adjusted — removed ${delta.removed.join(', ')}`;
  }
  const head = delta.removed.slice(0, 2).join(', ');
  return `${dow}${name} adjusted — ${head} + ${delta.removed.length - 2} more removed`;
}

// ─── Main ───────────────────────────────────────────────────────────

export function summariseConstraintProjectionEffects(
  input: SummariseInput,
): ConstraintSummary {
  const currentDeltas = diffWeek(input.currentWeekRaw, input.currentWeekProjected);
  const nextDeltas = diffWeek(input.nextWeekRaw, input.nextWeekProjected);

  const currentWeekChanges = currentDeltas.map((d) => workoutBullet(d, true));
  const nextWeekChanges = nextDeltas.map((d) => workoutBullet(d, true));

  const affectedDates = [
    ...currentDeltas.map((d) => d.date),
    ...nextDeltas.map((d) => d.date),
  ];

  const removedExercisesByDate: Record<string, string[]> = {};
  const replacedExercisesByDate: Record<string, Array<{ from: string; to: string }>> = {};
  for (const delta of [...currentDeltas, ...nextDeltas]) {
    if (delta.removed.length > 0) removedExercisesByDate[delta.date] = delta.removed;
    if (delta.replaced.length > 0) replacedExercisesByDate[delta.date] = delta.replaced;
  }

  let replyMode: ConstraintSummary['replyMode'];
  let unchangedReason: string | undefined;
  if (currentDeltas.length === 0 && nextDeltas.length === 0) {
    replyMode = 'no_changes';
    unchangedReason = input.activeConstraint
      ? 'no relevant sessions affected by the active constraint'
      : 'no active constraints';
  } else if (currentDeltas.length > 0 && nextDeltas.length === 0) {
    replyMode = 'current_only';
  } else if (currentDeltas.length === 0 && nextDeltas.length > 0) {
    replyMode = 'future_constraint_applied';
  } else {
    replyMode = 'both_weeks_changed';
  }

  logger.debug('[constraint-summary] current_week_changes', {
    count: currentDeltas.length,
    bullets: currentWeekChanges,
  });
  logger.debug('[constraint-summary] next_week_changes', {
    count: nextDeltas.length,
    bullets: nextWeekChanges,
  });
  logger.debug('[constraint-summary] reply_mode', {
    replyMode,
    affectedDates,
    activeConstraint: input.activeConstraint?.label ?? null,
  });

  return {
    currentWeekChanges,
    nextWeekChanges,
    affectedDates,
    removedExercisesByDate,
    replacedExercisesByDate,
    currentWeekDeltas: currentDeltas,
    nextWeekDeltas: nextDeltas,
    unchangedReason,
    replyMode,
  };
}

// ─── Reply text helpers ─────────────────────────────────────────────

/**
 * Build the "future constraint applied" sentence(s) to splice into a
 * reply when the current-week event list is empty BUT the projection
 * mutated next week. Caller pastes this in place of the legacy
 * "I left the program unchanged" wording.
 *
 *   Nothing major left to change this week, but the active restriction
 *   is now shaping next week:
 *     • Mon Lower Body Strength adjusted — Trap Bar Deadlift removed
 *     • Wed Conditioning adjusted — sprints removed
 */
export function renderFutureConstraintBlock(summary: ConstraintSummary): string {
  if (summary.nextWeekChanges.length === 0) return '';
  const intro =
    'Nothing major left to change this week, but the active restriction is now shaping next week:';
  const bullets = summary.nextWeekChanges.map((b) => `• ${b}`).join('\n');
  return `${intro}\n${bullets}`;
}

/** Render the Coach Update "Next week" section bullets (no intro). */
export function renderNextWeekBullets(summary: ConstraintSummary): string[] {
  return summary.nextWeekChanges.slice();
}

/** Render the "This week" bullets (event-derived, formatted same way). */
export function renderCurrentWeekBullets(summary: ConstraintSummary): string[] {
  return summary.currentWeekChanges.slice();
}
