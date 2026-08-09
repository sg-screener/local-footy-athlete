/**
 * THE MONTHLY REVIEW — the design's "where progression lives", and layer 5 of
 * Sam's load ruling.
 *
 * L14 domain purity: no React, no navigation, no stores, no device clock.
 *
 * ── A SECOND TIME SCALE, NOT A SECOND MODEL ──
 *
 * This module reads records the weekly derivations ALREADY produced —
 * `JournalLoadWeekTotals` from the load model, the strength series from the
 * strength owner — and composes months from them. It never re-groups
 * `sessionFeedback` itself.
 *
 * That is the whole architectural point. A monthly module that regrouped the raw
 * store would be a second answer to "what happened in week N", and the two would
 * drift the first time a rule about which sessions count changed — which is the
 * defect class every slice of this unit has had to refuse.
 *
 * ── SAM'S CHART GUARDS ARE ENFORCED HERE, NOT AT THE SURFACE ──
 *
 * His ruling: *"no chart renders until its history is honest (never one floating
 * dot; 'builds as you train' copy until then)"*. A surface asked to obey that has
 * to remember it every time someone adds a chart. So this module returns a series
 * ONLY when it has enough points to be honest, and returns null otherwise — the
 * surface cannot render a one-dot chart because it is never handed one.
 *
 * `MIN_POINTS_FOR_A_TREND` is the threshold, and it is DERIVED from an existing
 * signed idea rather than invented: `journalWeek.TREND_MIN_WEEKS` is the
 * data-state schedule's own answer to "when may direction be claimed".
 *
 * ── NO RAW AU, OBSERVATION NEVER DIAGNOSIS ──
 *
 * The load ruling's two athlete-facing laws bind a chart exactly as they bind a
 * sentence. This module returns SERIES and never labels; the words that go beside
 * them are copy, and copy is Sam's.
 */

import { TREND_MIN_WEEKS } from './journalWeek';
import type { JournalLoadWeekTotals } from './journalLoad';
import type { StrengthTopSet } from './journalStrengthTrend';

/**
 * How many points a trend needs before it may be drawn.
 *
 * NOT A NEW CONSTANT. It is the data-state schedule's `TREND_MIN_WEEKS`, which
 * already answers "when may the app claim a direction" — inventing a second
 * threshold here would let a chart appear while the words beside it still said
 * "your Journal is building".
 */
export const MIN_POINTS_FOR_A_TREND = TREND_MIN_WEEKS;

// ─── Inputs ──────────────────────────────────────────────────────────────

export interface BuildJournalMonthInput {
  /** Per-week totals the load model already derived, any order. */
  readonly weeks: readonly JournalLoadWeekTotals[];
  /** Per-lift top sets by week, from the strength owner. */
  readonly strengthSeries: ReadonlyMap<
    string,
    readonly { readonly weekStart: string; readonly topSet: StrengthTopSet }[]
  >;
}

// ─── Output ──────────────────────────────────────────────────────────────

export interface MonthPoint {
  readonly weekStart: string;
  readonly value: number;
}

export interface StrengthGain {
  readonly exerciseName: string;
  readonly fromWeekStart: string;
  readonly fromKg: number;
  readonly toWeekStart: string;
  readonly toKg: number;
  /** Positive when the bar went up. Negative and zero are reported honestly. */
  readonly deltaKg: number;
}

export interface JournalMonth {
  /**
   * Conditioning volume over time, in the stream's own unit. NULL until there
   * are enough points to be honest — never a one-dot chart.
   */
  readonly conditioningSeries: readonly MonthPoint[] | null;
  /** Per-lift top-set series, only for lifts with enough points. */
  readonly strengthSeries: ReadonlyMap<string, readonly MonthPoint[]>;
  /**
   * The design's satisfaction line, as data: "you've added 12.5kg to your trap
   * bar since March". Only lifts that actually moved, biggest gain first.
   */
  readonly gains: readonly StrengthGain[];
  /** True when nothing has enough history yet — the "builds as you train" state. */
  readonly building: boolean;
}

// ─── Derivation ──────────────────────────────────────────────────────────

/**
 * A series, or nothing.
 *
 * THE GUARD LIVES HERE SO THE SURFACE CANNOT FORGET IT. Sam ruled that a chart
 * does not render until its history is honest; a module that returned two points
 * and trusted the caller to hide them would put that ruling in the hands of
 * whoever next adds a chart.
 */
function honestSeries(points: readonly MonthPoint[]): readonly MonthPoint[] | null {
  return points.length >= MIN_POINTS_FOR_A_TREND ? points : null;
}

export function buildJournalMonth(input: BuildJournalMonthInput): JournalMonth {
  // OLDEST FIRST — a trend is read left to right, and the load model returns its
  // history most-recent-first.
  const weeks = input.weeks.slice().sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  // A WEEK WITH NO CONDITIONING IS ABSENT, NOT ZERO. Plotting an untrained week
  // at 0 draws a collapse that never happened — the same rule the strength
  // series follows for a lift that was not trained.
  const conditioningPoints: MonthPoint[] = weeks
    .filter((week) => week.conditioningSRPE > 0)
    .map((week) => ({ weekStart: week.weekStart, value: week.conditioningSRPE }));

  const strengthSeries = new Map<string, readonly MonthPoint[]>();
  const gains: StrengthGain[] = [];

  for (const [exerciseName, points] of input.strengthSeries.entries()) {
    const asPoints: MonthPoint[] = points.map((point) => ({
      weekStart: point.weekStart,
      value: point.topSet.weightKg,
    }));
    const honest = honestSeries(asPoints);
    if (honest) strengthSeries.set(exerciseName, honest);

    // THE GAIN IS FIRST-TO-LAST, AND IT NEEDS TWO POINTS, NOT SIX. It is a
    // comparison of two recorded weights rather than a claimed direction, so the
    // trend threshold does not apply to it — a chart needs shape, a sentence
    // needs only both ends.
    if (asPoints.length < 2) continue;
    const first = asPoints[0];
    const last = asPoints[asPoints.length - 1];
    const deltaKg = last.value - first.value;
    if (deltaKg === 0) continue;
    gains.push({
      exerciseName,
      fromWeekStart: first.weekStart,
      fromKg: first.value,
      toWeekStart: last.weekStart,
      toKg: last.value,
      deltaKg,
    });
  }

  // BIGGEST GAIN FIRST, tie-broken by name so the order never wobbles between
  // renders — the discipline a surviving mutation taught the strength line.
  gains.sort((a, b) => (b.deltaKg - a.deltaKg) || a.exerciseName.localeCompare(b.exerciseName));

  const conditioningSeries = honestSeries(conditioningPoints);

  return {
    conditioningSeries,
    strengthSeries,
    gains,
    building: conditioningSeries === null && strengthSeries.size === 0,
  };
}
