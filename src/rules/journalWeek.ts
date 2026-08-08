/**
 * THE JOURNAL'S WEEK — a pure derivation over facts the app already stores.
 *
 * L14 domain purity: no React, no navigation, no stores, no device clock. Every
 * input arrives explicitly, so this module is callable from a plain test.
 *
 * THE WHOLE POINT: this file stores nothing and owns nothing. It reads the
 * projection (what the week IS), the exposure classifier (which days are HARD)
 * and the session outcomes (what the athlete DID), and answers the Journal's
 * questions from those three. The north star in one module — every number here
 * is derived on read, so none of it can go stale beside its inputs.
 *
 * WHY HARDNESS IS AN INPUT AND NOT A DERIVATION HERE.
 * `isHardDay` is owned by `weeklyExposureCounts.countWeeklyExposures`, which
 * defines it as `units.some(u => u.stress === 'high')`. The Journal reads that
 * answer; it never recomputes it. A second hardness authority is precisely the
 * defect class this repo has paid for twice (`intensity-never-feeds-identity`,
 * phase skew) — and the projection already carries `countsTowardLoad` for the
 * same stated reason: "carried, not derived by the surface".
 */

import type { FeedbackCompletion } from '../types/sessionOutcome';
import type { VisibleDay } from './visibleProjection';
import type { WeeklyExposureCounts } from './weeklyExposureCounts';

// ─── Sam's rulings, as constants ─────────────────────────────────────────

/**
 * THE WEEK-SHAPE VOCABULARY (Sam, 2026-08-08 —
 * docs/JOURNAL_LOAD_AND_DAY_SHAPE_RULING_2026-08-08.md §2).
 *
 * "I think we should track moderate as well." Derived, never stored:
 * flagged hard day -> Hard; any other training day -> Moderate;
 * recovery/mobility -> Easy; Rest and Game -> themselves.
 */
export type JournalDayShape = 'hard' | 'moderate' | 'easy' | 'rest' | 'game';

/**
 * THE LOAD WEIGHTS — SIGNED, Sam's own numbers, 2026-08-08 (§1 of the same
 * ruling): "do 2 - 1 - 0 though, easy days don't effect fatigue but count as
 * sessions."
 *
 * These are athlete-affecting constants and they are Sam-authored, so the
 * provenance law is satisfied at the value, not merely at the mechanism.
 *
 * THERE IS DELIBERATELY NO `game` OR `rest` WEIGHT HERE, and that absence is
 * load-bearing. A game classifies as `stress: 'high'`
 * (`stressClassification.ts:59-60`), so a game day IS a hard day and takes the
 * hard weight through the existing owner — no new constant, nothing invented.
 * The ruling never priced a game, and this is why it did not need to.
 */
export const JOURNAL_LOAD_WEIGHTS = {
  hard: 2,
  moderate: 1,
  easy: 0,
} as const;

/**
 * THE DATA-STATE SCHEDULE (addendum item 11). What the Journal is allowed to
 * claim at N weeks of recorded history. "Never a chart with one floating dot."
 */
export type JournalDataState =
  | 'first_week'
  | 'early'
  | 'load_ready'
  | 'trends_ready';

/** Weeks of history required before load-vs-normal may be shown at all. */
export const LOAD_COMPARISON_MIN_WEEKS = 4;

/** Weeks of history required before direction/pattern claims may be shown. */
export const TREND_MIN_WEEKS = 6;

// ─── Inputs ──────────────────────────────────────────────────────────────

/**
 * What the Journal reads from one recorded session outcome.
 *
 * A NARROW VIEW ON PURPOSE. `SessionFeedback` carries far more than this, and
 * widening this type is how a reading surface quietly becomes a second model of
 * a session. Absent fields are `null`, never invented — rider 1.
 */
export interface JournalSessionOutcome {
  readonly completion: FeedbackCompletion;
  /** The recorded reason, or null when the flow never asked for one. */
  readonly reason: string | null;
  readonly feeling: string | null;
  readonly soreness: string | null;
}

export interface BuildJournalWeekInput {
  readonly weekStart: string;
  /** The projection — the one authority on what each day IS. */
  readonly days: readonly VisibleDay[];
  /** The classifier — the one authority on which days are HARD. */
  readonly exposures: WeeklyExposureCounts;
  /** Recorded outcomes, keyed by ISO date. Absent = not answered yet. */
  readonly outcomesByDate: Readonly<Record<string, JournalSessionOutcome>>;
  /**
   * How many weeks of recorded history exist, INCLUDING this one. Drives the
   * data-state schedule. Supplied by the caller because counting history is a
   * store read, not a derivation over this week.
   */
  readonly weeksOfHistory: number;
}

// ─── Output ──────────────────────────────────────────────────────────────

export interface JournalDay {
  readonly date: string;
  readonly shape: JournalDayShape;
  /** This day's contribution to the load number. See JOURNAL_LOAD_WEIGHTS. */
  readonly loadWeight: number;
  /** True when this day asked anything of the athlete at all. */
  readonly isSession: boolean;
  /** The recorded outcome, or null when nothing was recorded for this day. */
  readonly outcome: JournalSessionOutcome | null;
}

export interface JournalWork {
  /** Days that asked for work — recovery and easy days included (Sam's §1). */
  readonly sessionsPlanned: number;
  readonly completedFull: number;
  readonly completedPartial: number;
  readonly skipped: number;
  /** Sessions with no outcome recorded yet — NOT the same as skipped. */
  readonly notAnswered: number;
  /**
   * Sessions that did not fully happen and carry NO recorded reason. The
   * Journal must say so out loud rather than inventing a why (rider 1).
   */
  readonly missingReasons: number;
}

export interface JournalLoad {
  /** This week's hard-weighted session load. Always derivable. */
  readonly thisWeek: number;
  /**
   * The rolling comparison. NULL until there is enough history — and null is a
   * state the surface must render honestly, never as zero or as "normal".
   */
  readonly comparison: null;
  readonly comparisonAvailable: boolean;
}

export interface JournalFelt {
  readonly feelingsRecorded: number;
  readonly sorenessRecorded: number;
  /** True when the athlete recorded nothing about how the week felt. */
  readonly nothingRecorded: boolean;
}

export interface JournalWeek {
  readonly weekStart: string;
  readonly days: readonly JournalDay[];
  readonly work: JournalWork;
  readonly load: JournalLoad;
  readonly felt: JournalFelt;
  readonly dataState: JournalDataState;
}

// ─── Derivation ──────────────────────────────────────────────────────────

/**
 * ONE PREDICATE, READ TWICE — which is Sam's "two questions, one store" made
 * structural rather than promised.
 *
 * Shape answers "what kind of day was this" and short-circuits on Rest and Game
 * because he ruled they show as themselves. Load answers "what did this cost"
 * and does NOT short-circuit, which is exactly why a game lands on the hard
 * weight without a game constant existing. Both read the same two facts —
 * `isHardDay` and "does anything here count toward load" — so the two answers
 * cannot drift apart.
 */
function dayCountsTowardLoad(day: VisibleDay): boolean {
  return day.parts.some((part) => part.countsTowardLoad);
}

function shapeForDay(day: VisibleDay, isHardDay: boolean): JournalDayShape {
  if (day.kind === 'rest') return 'rest';
  if (day.kind === 'game') return 'game';
  if (isHardDay) return 'hard';
  return dayCountsTowardLoad(day) ? 'moderate' : 'easy';
}

function loadWeightForDay(day: VisibleDay, isHardDay: boolean): number {
  if (isHardDay) return JOURNAL_LOAD_WEIGHTS.hard;
  if (dayCountsTowardLoad(day)) return JOURNAL_LOAD_WEIGHTS.moderate;
  return JOURNAL_LOAD_WEIGHTS.easy;
}

/**
 * Did this day ask anything of the athlete?
 *
 * Sam's §1 consequence, stated in his words: easy days "don't effect fatigue but
 * count as sessions". So this is deliberately NOT `loadWeight > 0` — a recovery
 * day weighs zero and is still a session. Writing it as a load test would have
 * silently dropped every easy day from "did the work happen", which is the one
 * place he said they must appear.
 */
function isSessionDay(day: VisibleDay): boolean {
  if (day.kind === 'rest') return false;
  return day.kind === 'game' || day.parts.length > 0;
}

export function deriveJournalDataState(weeksOfHistory: number): JournalDataState {
  if (weeksOfHistory >= TREND_MIN_WEEKS) return 'trends_ready';
  if (weeksOfHistory >= LOAD_COMPARISON_MIN_WEEKS) return 'load_ready';
  if (weeksOfHistory >= 2) return 'early';
  return 'first_week';
}

export function buildJournalWeek(input: BuildJournalWeekInput): JournalWeek {
  const hardDates = new Set(
    input.exposures.days.filter((d) => d.isHardDay).map((d) => d.date),
  );

  const days: JournalDay[] = input.days.map((day) => {
    const isHardDay = hardDates.has(day.date);
    const outcome = input.outcomesByDate[day.date] ?? null;
    return {
      date: day.date,
      shape: shapeForDay(day, isHardDay),
      loadWeight: loadWeightForDay(day, isHardDay),
      isSession: isSessionDay(day),
      outcome,
    };
  });

  let completedFull = 0;
  let completedPartial = 0;
  let skipped = 0;
  let notAnswered = 0;
  let missingReasons = 0;
  let feelingsRecorded = 0;
  let sorenessRecorded = 0;

  for (const day of days) {
    if (day.outcome) {
      if (day.outcome.feeling !== null) feelingsRecorded += 1;
      if (day.outcome.soreness !== null) sorenessRecorded += 1;
    }
    if (!day.isSession) continue;
    if (!day.outcome) {
      notAnswered += 1;
      continue;
    }
    if (day.outcome.completion === 'full') completedFull += 1;
    else if (day.outcome.completion === 'partial') completedPartial += 1;
    else skipped += 1;

    if (day.outcome.completion !== 'full' && day.outcome.reason === null) {
      missingReasons += 1;
    }
  }

  const sessionsPlanned = days.filter((d) => d.isSession).length;
  const thisWeekLoad = days.reduce((sum, d) => sum + d.loadWeight, 0);
  const dataState = deriveJournalDataState(input.weeksOfHistory);

  return {
    weekStart: input.weekStart,
    days,
    work: {
      sessionsPlanned,
      completedFull,
      completedPartial,
      skipped,
      notAnswered,
      missingReasons,
    },
    load: {
      thisWeek: thisWeekLoad,
      // SLICE 1 SHIPS NO COMPARISON, and it is null rather than absent so the
      // surface has something it must decide how to render. The rolling
      // four-week average is derived from RECORDED HISTORY, not from
      // projections of past weeks (those no longer exist to project), and that
      // derivation is its own slice. Until then the honest state is the only
      // state — never a number, never "normal".
      comparison: null,
      comparisonAvailable: input.weeksOfHistory >= LOAD_COMPARISON_MIN_WEEKS,
    },
    felt: {
      feelingsRecorded,
      sorenessRecorded,
      nothingRecorded: feelingsRecorded === 0 && sorenessRecorded === 0,
    },
    dataState,
  };
}
