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

import type {
  FeedbackCompletion,
  FeedbackExpectation,
  FeedbackGameFeel,
} from '../types/sessionOutcome';
import { expectationAsksWhy } from '../types/sessionOutcome';
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
 * DEMOTED TO THE FALLBACK RUNG, NOT RETIRED (Sam, 2026-08-08 afternoon —
 * docs/JOURNAL_LOAD_MODEL_RULING_2026-08-08.md). The load slice builds a
 * three-layer model: strength TONNAGE and conditioning sRPE as two native
 * streams, combined only in RATIO space against each stream's own four-week
 * normal, plus a region layer for observation lines. **These weights become the
 * rung for any session with no rating** — "the number never has a hole and never
 * invents precision". So this constant is not the load model; it is the floor
 * under it, and the day-shape derivation below (§2 of the first ruling) stands
 * untouched by the newer one.
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
  /**
   * The post-game body-feel rating, or null on any session that is not a game —
   * and on a game the athlete did not answer. THE TWO ARE THE SAME null HERE on
   * purpose: the Journal counts what was recorded, and "not asked" and "asked,
   * not answered" are both "nothing recorded". A surface that needed to tell
   * them apart would be asking a different question than this one.
   */
  readonly gameFeel: FeedbackGameFeel | null;
  /** Did it match the prescription? Null when the tap went unanswered. */
  readonly expectation: FeedbackExpectation | null;
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
  /** Games the athlete rated their legs and energy on. */
  readonly gameFeelsRecorded: number;
  /**
   * THE LATEST GAME'S RATING, 1-10 since 2026-08-12, or null when no game was rated.
   *
   * A COUNT AND A RATING ARE DIFFERENT FACTS, and the UI ruling's glanceable
   * wants the second one. `gameFeelsRecorded` says how many games were rated;
   * this says what the athlete actually said about the most recent one.
   *
   * IT IS THE LATEST, NEVER A MEAN, and that is the load-bearing half. Two games
   * rated 2 and 5 average to 3.5 — a number no game earned, presented as though
   * a game had earned it. The latest game is a fact about a game that happened.
   * A week with two games is rare enough that a mean would be wrong in exactly
   * the weeks it got used.
   */
  readonly gameFeelLatest: FeedbackGameFeel | null;
  /**
   * Sessions the athlete said did NOT match the prescription. Counted, never
   * interpreted — the Journal says how many differed, not what to do about it.
   */
  readonly differedFromPlan: number;
  /** True when the athlete recorded nothing about how the week felt. */
  readonly nothingRecorded: boolean;
}

/**
 * WHAT KIND OF WORK THE WEEK HELD — addendum Group 1 item 1, "key exposures, not
 * completion counts".
 *
 * A DIFFERENT QUESTION FROM `JournalWork`, and the addendum's title says so.
 * `JournalWork` answers "did it happen"; this answers "what was it". A week of
 * five completed sessions that were all conditioning is a different week from
 * five that were balanced, and a completion count cannot tell them apart.
 *
 * THE COUNTS ARE THE CLASSIFIER'S, NOT THIS MODULE'S. `countWeeklyExposures` is
 * the owner the Journal already asks for hardness; asking it for the composition
 * too is one reader of one answer, where counting sessions here would be a second
 * authority on what a session IS.
 *
 * THE ATHLETE'S WORD IS NEVER "EXPOSURE". That noun is in Sam's
 * `ATHLETE_FORBIDDEN_VOCABULARY`; the surface renders training words.
 */
export interface JournalWeekKinds {
  readonly strength: number;
  readonly conditioning: number;
  readonly sprint: number;
  readonly teamTraining: number;
  readonly games: number;
  readonly recovery: number;
}

export interface JournalWeek {
  readonly weekStart: string;
  readonly days: readonly JournalDay[];
  readonly work: JournalWork;
  readonly load: JournalLoad;
  readonly felt: JournalFelt;
  /** What kind of work the week held — see JournalWeekKinds. */
  readonly kinds: JournalWeekKinds;
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
  let gameFeelsRecorded = 0;
  let gameFeelLatest: FeedbackGameFeel | null = null;
  let differedFromPlan = 0;

  for (const day of days) {
    if (day.outcome) {
      if (day.outcome.feeling !== null) feelingsRecorded += 1;
      if (day.outcome.soreness !== null) sorenessRecorded += 1;
      if (day.outcome.gameFeel !== null) {
        gameFeelsRecorded += 1;
        // LAST WRITER WINS BECAUSE `days` IS IN WEEK ORDER — the same ordering
        // the strip renders. Reading "latest" off an unordered collection is
        // how a Tuesday rating becomes Saturday's headline.
        gameFeelLatest = day.outcome.gameFeel;
      }
      // THE PREDICATE HAS AN OWNER. `expectationAsksWhy` is the one place that
      // decides which answers mean "it differed" — the form asks its follow-up
      // from it, the payload sends a reason from it, and the Journal counts from
      // it. A fourth copy of `!== 'as_expected'` here is how three readers start
      // disagreeing about one word.
      if (expectationAsksWhy(day.outcome.expectation)) differedFromPlan += 1;
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
    kinds: {
      // READ STRAIGHT OFF THE CLASSIFIER. Every one of these is a field
      // `countWeeklyExposures` already produced; none is recounted here.
      strength: input.exposures.mainStrengthExposures,
      // THE APP'S OWN CONDITIONING, NOT THE TOTAL. `conditioningExposures`
      // INCLUDES team training and games (its own comment says so), so using it
      // would count a Saturday game three times over on one screen — once as
      // conditioning, once as a game, once in the strip.
      conditioning: input.exposures.extraConditioningSessions,
      sprint: input.exposures.sprintCodExposures,
      teamTraining: input.exposures.teamTrainingSessions,
      games: input.exposures.games,
      recovery: input.exposures.recoverySessions,
    },
    felt: {
      feelingsRecorded,
      sorenessRecorded,
      gameFeelsRecorded,
      gameFeelLatest,
      differedFromPlan,
      // EVERY "FELT" FACT COUNTS TOWARD "NOTHING RECORDED", not just the two
      // that existed first. A week where the athlete rated a game and nothing
      // else used to render "you haven't recorded how anything felt" beside the
      // rating they had just given.
      nothingRecorded: feelingsRecorded === 0
        && sorenessRecorded === 0
        && gameFeelsRecorded === 0
        && differedFromPlan === 0,
    },
    dataState,
  };
}
