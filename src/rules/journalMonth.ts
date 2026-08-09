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

/**
 * One week's FELT facts, as `JournalFelt` already derived them.
 *
 * "YOUR MONTH IN FLAGS" IS A COUNT OF WHAT THE ATHLETE SAID, not a reading of
 * how they were. Every field here is something they answered; nothing is
 * inferred, and the module adds no interpretation to any of it.
 */
export interface MonthWeekFlags {
  readonly weekStart: string;
  readonly sorenessRecorded: number;
  readonly differedFromPlan: number;
  readonly gameFeelsRecorded: number;
}

/** One week's completion facts, as `JournalWork` already derived them. */
export interface MonthWeekWork {
  readonly weekStart: string;
  readonly sessionsPlanned: number;
  readonly completedFull: number;
  readonly completedPartial: number;
}

export interface BuildJournalMonthInput {
  /** Per-week totals the load model already derived, any order. */
  readonly weeks: readonly JournalLoadWeekTotals[];
  /** Per-week completion, from `journalWeek`. Empty when unknown. */
  readonly work?: readonly MonthWeekWork[];
  /** Per-week felt facts, from `journalWeek`. Empty when unknown. */
  readonly flags?: readonly MonthWeekFlags[];
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

/**
 * Consistency, and the sessions banked behind it.
 *
 * A PERCENTAGE WITHOUT ITS DENOMINATOR IS A CLAIM WITHOUT ITS EVIDENCE — "80%"
 * over five sessions and over fifty are different facts wearing one number, so
 * both halves travel together and the surface shows both.
 */
export interface MonthConsistency {
  readonly sessionsDone: number;
  readonly sessionsPlanned: number;
  /** 0-1. Only meaningful beside the counts above. */
  readonly rate: number;
  readonly weeksCounted: number;
}

/**
 * The month in flags — the design's "fatigue/soreness/illness trend".
 *
 * COUNTS, NEVER A TREND WORD. The design calls it a trend; what the app can
 * honestly produce is how many times the athlete said each thing. Turning three
 * soreness answers into "your soreness is rising" would be a direction claimed
 * from a count, and the load ruling's "observation, never diagnosis" forbids
 * exactly that move.
 */
export interface MonthFlags {
  readonly sorenessRecorded: number;
  readonly sessionsThatDiffered: number;
  readonly gamesRated: number;
  readonly weeksCounted: number;
}

export interface JournalMonth {
  /** NULL when nothing was recorded at all — silence rather than a row of zeroes. */
  readonly flags: MonthFlags | null;
  /**
   * NULL when no week carried a plan. A consistency figure over nothing is 0%,
   * which reads as total failure to an athlete who simply has no history.
   */
  readonly consistency: MonthConsistency | null;
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

/**
 * Consistency over the month's weeks.
 *
 * PARTIAL SESSIONS COUNT AS DONE, and that is the same ruling
 * `DidTheWorkHappen` already applies one screen up ("`done` = full + partial").
 * A second answer to "did that session happen" would be the two-owners defect at
 * a different time scale.
 */
function consistencyFrom(work: readonly MonthWeekWork[]): MonthConsistency | null {
  const withPlan = work.filter((week) => week.sessionsPlanned > 0);
  if (withPlan.length === 0) return null;
  const sessionsPlanned = withPlan.reduce((sum, w) => sum + w.sessionsPlanned, 0);
  const sessionsDone = withPlan.reduce(
    (sum, w) => sum + w.completedFull + w.completedPartial, 0,
  );
  if (sessionsPlanned === 0) return null;
  return {
    sessionsDone,
    sessionsPlanned,
    rate: sessionsDone / sessionsPlanned,
    weeksCounted: withPlan.length,
  };
}

/**
 * The month's flags, or nothing.
 *
 * A ROW OF ZEROES IS NOT A MONTH IN FLAGS. An athlete who answered nothing
 * should see the honest absence, not "soreness 0, differed 0, games 0" — which
 * reads like a report about a month rather than the absence of one.
 */
function flagsFrom(weeks: readonly MonthWeekFlags[]): MonthFlags | null {
  if (weeks.length === 0) return null;
  const sorenessRecorded = weeks.reduce((n, w) => n + w.sorenessRecorded, 0);
  const sessionsThatDiffered = weeks.reduce((n, w) => n + w.differedFromPlan, 0);
  const gamesRated = weeks.reduce((n, w) => n + w.gameFeelsRecorded, 0);
  if (sorenessRecorded + sessionsThatDiffered + gamesRated === 0) return null;
  return { sorenessRecorded, sessionsThatDiffered, gamesRated, weeksCounted: weeks.length };
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

  const consistency = consistencyFrom(input.work ?? []);
  const flags = flagsFrom(input.flags ?? []);

  return {
    flags,
    consistency,
    conditioningSeries,
    strengthSeries,
    gains,
    // THE BUILDING STATE NOW ACCOUNTS FOR CONSISTENCY TOO. A month with a real
    // consistency figure and no chart yet is NOT empty, and telling that athlete
    // "this builds as you train" beside a number they can already read would be
    // the honest-absence line lying about a presence.
    building: conditioningSeries === null && strengthSeries.size === 0
      && consistency === null && flags === null,
  };
}
