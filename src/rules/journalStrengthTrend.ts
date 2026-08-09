/**
 * THE STRENGTH LINE — "best top sets this week; one line per lift with an
 * up/flat/down arrow vs last week" (docs/JOURNAL_DESIGN_2026-07-23.md, Monday
 * card item 2; the same source the addendum's progress markers read).
 *
 * L14 domain purity: no React, no navigation, no stores, no device clock.
 *
 * ZERO NEW STORED STATE. Every number here derives on read from
 * `SessionFeedback.strength[]`, which the app has recorded since long before the
 * Journal existed — its own type comment says the snapshot was captured "for
 * future progression/diary use", and this is that use.
 *
 * ── NO CONSTANTS, AND THAT IS WHY THIS ONE CAN SHIP ──
 *
 * The load model's every headline waits on a Sam-signed constant. This module
 * has none to wait on: "heavier than last week" is a comparison of two recorded
 * numbers, not a judgement against a threshold. `flat` is exact equality, which
 * is a fact rather than a tolerance — the moment a tolerance appears here ("within
 * 2.5kg counts as flat") it becomes a constant and it goes in the signing table
 * with the others.
 *
 * ── WHAT "ANCHOR LIFT" MEANS HERE, SAID OUT LOUD ──
 *
 * The design says "one line per anchor lift". Measured: **the app has no anchor-
 * lift concept** — `isAnchor` in `sessionClassificationAdapter` and
 * `workoutCanonicalisation` means a game or team-training ANCHOR DAY, a different
 * noun entirely. What it does have is `SessionFeedback.strength[]`, which
 * `strengthLogging.isMainStrengthExercise` already filters to main lifts.
 *
 * So this module reads "anchor lift" as "the main lifts the app already records",
 * and does NOT invent a second definition to sit beside the one that exists. If
 * Sam wants a narrower set, that is an authored list and a ruling, not a
 * predicate for this file to guess at.
 */

import { journalWeekStartOf, calendarWeeksBefore } from './journalLoad';
import type { StrengthExercisePerformanceLog } from '../utils/strengthLogging';

// ─── Inputs ──────────────────────────────────────────────────────────────

export interface JournalStrengthSessionInput {
  readonly date: string;
  readonly strength: readonly StrengthExercisePerformanceLog[];
}

export interface BuildJournalStrengthTrendInput {
  readonly weekStart: string;
  /** Every recorded session the app holds, any order. */
  readonly sessions: readonly JournalStrengthSessionInput[];
}

// ─── Output ──────────────────────────────────────────────────────────────

export interface StrengthTopSet {
  readonly weightKg: number;
  /**
   * The reps held at that top set, or null when the athlete logged no per-set
   * detail. NULL IS NOT ZERO and is not the prescription: the prescribed range
   * is what was asked for, not what was done, and printing it beside a real
   * weight would read as a record of work nobody recorded.
   */
  readonly reps: number | null;
}

/**
 * `new` is a first-class answer, not a missing one. A lift with no previous week
 * has no direction — an arrow would claim a comparison that did not happen.
 */
export type StrengthTrendDirection = 'up' | 'flat' | 'down' | 'new';

export interface StrengthLiftTrend {
  readonly exerciseName: string;
  readonly thisWeek: StrengthTopSet;
  /** The same lift's top set last week, or null when it was not trained. */
  readonly lastWeek: StrengthTopSet | null;
  readonly direction: StrengthTrendDirection;
}

// ─── Derivation ──────────────────────────────────────────────────────────

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * The heaviest recorded top set per lift in one week's sessions.
 *
 * A SKIPPED LIFT IS NOT A TOP SET. `weightKg` on a skipped row is the weight
 * that was PRESCRIBED and not lifted; counting it would report a personal best
 * for a session the athlete told us they did not do.
 */
function topSetsForSessions(
  sessions: readonly JournalStrengthSessionInput[],
): Map<string, StrengthTopSet> {
  const best = new Map<string, StrengthTopSet>();
  for (const session of sessions) {
    for (const lift of session.strength) {
      if (lift.completion === 'skipped') continue;
      const weightKg = positive(lift.weightKg);
      if (weightKg === null) continue;
      const current = best.get(lift.exerciseName);
      if (current && current.weightKg >= weightKg) continue;
      best.set(lift.exerciseName, { weightKg, reps: positive(lift.actualReps) });
    }
  }
  return best;
}

function directionFor(
  thisWeek: StrengthTopSet,
  lastWeek: StrengthTopSet | null,
): StrengthTrendDirection {
  if (lastWeek === null) return 'new';
  if (thisWeek.weightKg > lastWeek.weightKg) return 'up';
  if (thisWeek.weightKg < lastWeek.weightKg) return 'down';
  return 'flat';
}

/**
 * One line per lift trained this week, heaviest first.
 *
 * ORDERED DETERMINISTICALLY, and the tie-break is not decoration: two lifts at
 * the same load would otherwise swap places between renders depending on Map
 * insertion order, which is a diff nobody can explain and a screenshot nobody
 * can reproduce.
 *
 * A LIFT TRAINED LAST WEEK AND NOT THIS WEEK GETS NO LINE. The card reports what
 * happened this week; a lift that did not happen has no top set, and a row
 * reading "Back Squat —" is an absence dressed as a record.
 */
export function buildJournalStrengthTrend(
  input: BuildJournalStrengthTrendInput,
): readonly StrengthLiftTrend[] {
  const byWeek = new Map<string, JournalStrengthSessionInput[]>();
  for (const session of input.sessions) {
    const weekStart = journalWeekStartOf(session.date);
    if (weekStart === null) continue;
    const bucket = byWeek.get(weekStart);
    if (bucket) bucket.push(session);
    else byWeek.set(weekStart, [session]);
  }

  const thisWeek = topSetsForSessions(byWeek.get(input.weekStart) ?? []);
  // THE CALENDAR WEEK BEFORE THIS ONE, not "the last week I trained in". The
  // arrow says "vs last week" out loud, and the load slice already paid for
  // confusing those two — a comparison against a week from four months ago is a
  // different claim wearing the same words.
  const [previousWeekStart] = calendarWeeksBefore(input.weekStart, 1);
  const lastWeek = topSetsForSessions(
    previousWeekStart ? byWeek.get(previousWeekStart) ?? [] : [],
  );

  return Array.from(thisWeek.entries())
    .map(([exerciseName, top]) => {
      const previous = lastWeek.get(exerciseName) ?? null;
      return {
        exerciseName,
        thisWeek: top,
        lastWeek: previous,
        direction: directionFor(top, previous),
      };
    })
    .sort((a, b) => (b.thisWeek.weightKg - a.thisWeek.weightKg)
      || a.exerciseName.localeCompare(b.exerciseName));
}
