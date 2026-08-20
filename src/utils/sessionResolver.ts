/**
 * Session Resolver — Pure Scheduling Engine
 *
 * ARCHITECTURE:
 *   Single source of truth for "what session belongs on date X?"
 *   Zero React. Zero Zustand. Pure functions only.
 *
 *   resolveDate() is the atomic unit. Every other function calls it.
 *
 * RESOLUTION PRIORITY:
 *   1. Manual override (human/coach authored workout swap)
 *   2. Calendar mark: rest → null workout
 *   3. Calendar mark: game → game stub
 *   4. Template says game but calendar doesn't → freed slot (optional session)
 *   5. Template + game proximity rules (G+1 recovery, G-1 demote, G-2 moderate)
 *   6. Unmodified template
 *   7. No workout (out of block or rest day)
 *
 * DESIGN PRINCIPLES:
 *   - Automatic adjustments (game proximity) are DERIVED, not stored
 *   - Only manual human/coach edits are persisted (manualOverrides)
 *   - Every screen calls these functions through hooks — one pipeline everywhere
 *   - No useMemo for schedule data — derive on every render (trivial cost)
 */

import { getTeamTrainingWorkoutState } from './teamTraining';
import type {
  Workout,
  Exercise,
  Microcycle,
  TrainingProgram,
  SeasonPhase,
  CapacityBand,
  DayOfWeek,
  WeekScopedWorkoutOverlay,
  LoggedWorkout,
  UserRemovalConstraint,
} from '../types/domain';
import type { CalendarDayType } from '../store/calendarStore';
import type { TemporarySourceFact } from '../rules/temporarySourceFact';
import { awaySpansFromFacts, dateIsInsideAwaySpan } from '../rules/awaySpans';
import { storedGameAnchor, isDayOfWeek } from '../rules/gameAnchor';
import { composeDaySurfaces, removalConstraintForComposedDay } from '../rules/dayPrecedence';
import { markInjuryWithheldRows } from '../rules/injuryWithheldRows';
import {
  applyExclusionsToAuthoredDay,
  type ExerciseExclusion,
} from '../rules/exerciseExclusions';
import {
  type AthleteContext,
} from './sessionBuilder';
import type { WeekLog } from './conditioningRules';
import {
  applyStrengthProgression,
  buildStrengthWorkoutHistoryFromFeedback,
  buildProgressionContext,
  deriveMissedStrengthSessionsThisWeek,
  workoutHasProgressableStrengthRows,
} from './strengthProgressionIntegration';
import {
  analyzeFeedbackPatterns,
  conditioningReportsRecentFatigue,
  shouldPreferRest,
} from './feedbackPatterns';
import { findMatchingFeedback, deriveAdaptation } from './feedbackAdapter';
import type { SessionFeedback } from '../store/programStore';
import { classifyVisibleSession } from '../rules/sessionClassificationAdapter';
import {
  canonicalFixtureKindForResolvedPhase,
  type FixtureAvailabilityKind,
} from '../rules/fixtureConditionedAvailability';
import { logger } from './logger';
import {
  getProgramBlockStateForDate,
  getStoredBlockStateForDate,
  selectMicrocycleForDate,
  type StoredProgramBlockState,
} from './programBlockState';
import {
  BIBLE_WEEKLY_CAPS,
  countWeeklyExposures,
  programmedRunningDayAllowance,
} from '../rules/weeklyExposureCounts';
import {
  attachPrescriptionEffectEvidence,
  buildPrescriptionEffectEvidence,
} from './deterministicCoachNoteFactory';
import {
  createDerivedSessionProvenance,
  isResolverOwnedDerivedSession,
} from '../rules/derivedSessionProvenance';
import { resolverMayDisplace } from '../rules/athletePlacement';
import { todayISOLocal } from './appDate';
import { hasPowerRow } from '../rules/sessionRowCounting';
import { selectStoredWeekDeclaration } from '../rules/storedWeekDeclaration';

export { computeBlockBounds } from './programBlockState';

// ─── Input/Output Types ───

export interface ScheduleState {
  currentProgram: TrainingProgram | null;
  currentMicrocycle: Microcycle | null;
  manualOverrides: Record<string, Workout>;
  /** System-authored selected-week overlays; manual overrides still outrank these. */
  weekScopedOverlays?: Record<string, WeekScopedWorkoutOverlay>;
  /**
   * The athlete's removal decisions — bins, and the remainders they leave.
   *
   * ADDED 2026-08-04 by the precedence unification. This is the surface that
   * makes a deletion survive §18, and until now it was not a field here at all:
   * `rebaseAcceptedEffectiveWeek` applied it and the live resolver could not
   * see it, so a binned day the accepted week held empty went on showing
   * whatever else occupied it. Both adapters
   * (`hooks/useSchedule.ts`, `utils/coachWeekDiff.ts`) feed it; the §18 gateway
   * passes it explicitly and then blanks it, because by the time the gateway
   * re-enters, constraints have already been applied to the composed content
   * and applying them twice would re-remove a remainder.
   */
  userRemovalConstraints?: readonly UserRemovalConstraint[];
  /**
   * THE ATHLETE'S "LEAVE THIS EXERCISE OUT" DECISIONS, for the days this state
   * will be asked about. Supplied by the VIEW doors only — see the note beside
   * `applyExclusionsToAuthoredDay` in `resolveDate` for why a canonicalising
   * caller must NOT supply them.
   */
  athleteExclusions?: readonly ExerciseExclusion[];
  /**
   * THE RECORD of those same decisions, never blanked
   * (`docs/REMOVAL_RECORD_SPLIT_RULING_2026-08-06.md`).
   *
   * The field above is an APPLICATION input and the gateway empties it once
   * the removals are folded into the composed week. Tier 4 runs downstream of
   * that, and its repair search has a different question — "does a decision
   * explain this gap?" — which an emptied input cannot answer. Carried here
   * so the deriver can hand it on; nothing in this file applies it.
   */
  removalDecisions?: readonly UserRemovalConstraint[];
  /**
   * THE ATHLETE'S SOURCE FACTS — leg (v)'s read side, install site 2 of 3.
   *
   * The week's IDENTITY (a severe illness makes it optional) reached this
   * resolver only because generation had WRITTEN it onto the overlay's stored
   * declaration. Installing the derivation at the accepted reader alone would
   * leave THIS line answering the same question from storage, and the one-owner
   * law is about the three lines agreeing, not about one of them being right.
   * Assembled from `acceptedMaterialContext`, which the one assembly already
   * carries — no new store read.
   */
  temporarySourceFacts?: readonly TemporarySourceFact[];
  markedDays: Record<string, CalendarDayType>;
  /** Athlete profile context for adaptive derived sessions. */
  athleteContext: AthleteContext;
  /** Season phase for conditioning placement. Null = skip conditioning. */
  seasonPhase: SeasonPhase | null;
  /**
   * New-style "usual game day" from phase-shift modal. When set together
   * with seasonPhase='In-season', the resolver renders a virtual Game on
   * this day every week automatically.
   */
  usualGameDay?: DayOfWeek;
  /**
   * The onboarding screen's game day, used as the fallback when `usualGameDay`
   * is not set. ANY of the seven days. Resolved by `storedGameAnchor`, which is
   * also what makes a legacy `'Varies'` read as no anchor.
   */
  gameDay?: DayOfWeek;
  /**
   * Athlete capacity band for conditioning caps.
   *
   * `null` means the profile CANNOT be scored — not 'medium'. The consumers
   * below read `state.readiness || 'medium'`, which is the pre-existing shape
   * and is only reachable for a profile that HAS a program; generation refuses
   * an unscoreable profile, so an unscoreable athlete has no week for these
   * caps to modulate. Do not turn the null into a tier here (Sam, 2026-07-30):
   * that is the silent default the rubric's fail-loud exists to kill.
   */
  capacity: CapacityBand | null;
  /** Session feedback keyed by ISO date. Used to feed feeling/patterns into progression. */
  sessionFeedback?: Record<string, SessionFeedback>;
  /** Logged strength history, newest first, when already available to the caller. */
  workoutHistory?: LoggedWorkout[];
  /** Persisted block state from ProgramStore when available. */
  blockState?: StoredProgramBlockState | null;
  /**
   * Per-session weight overrides from the athlete.
   * Key: ISO date → exerciseId → performed weight (null = bodyweight).
   * Used by progression to use last performed weight as baseline.
   */
  weightOverrides?: Record<string, Record<string, number | null>>;
  /**
   * Days the athlete is available to train, as JS day-of-week numbers
   * (0 = Sunday, 1 = Monday, … 6 = Saturday).
   *
   * HARD CONSTRAINT: the resolver must NEVER place any session (strength,
   * conditioning, or recovery) on a day not in this set.
   * Undefined/empty = no constraint (all days available).
   */
  availableDayNumbers?: number[];

}

export interface ResolvedDay {
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** 0=Sun..6=Sat */
  dayOfWeek: number;
  /** Short label: MON, TUE, etc. */
  short: string;
  /** Is this calendar date today? */
  isToday: boolean;
  /** The fully resolved workout for this date */
  workout: Workout | null;
  /** What determined the final state */
  source:
    | 'manual'         // from manualOverrides
    | 'game'           // calendar mark → game stub
    | 'rest'           // calendar mark → rest
    | 'gameProximity'  // template modified by G+1/G-1/G-2 rules
    | 'conditioning'   // conditioning rules placed a session on an empty day
    | 'recovery'       // recovery rules placed a session on an empty day
    | 'template'       // unmodified template workout
    | 'none';          // no workout (out of block or rest day)
  /** Indicator for calendar dots and styling */
  indicator: 'core' | 'optional' | 'recovery' | 'conditioning' | 'game' | 'rest' | null;
}

// ─── Constants ───

declare const __DEV__: boolean | undefined;
const IS_DEV = typeof __DEV__ !== 'undefined' && __DEV__;

const DAY_SHORT: Record<number, string> = {
  0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT',
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Date Helpers ───

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  date.setDate(date.getDate() + n);
  return formatDate(date);
}

function shiftDate(dateStr: string, days: number): string {
  return addDays(dateStr, days);
}

function isoDayDiff(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000,
  );
}

/**
 * Build a map of exerciseId → last performed weight from weight overrides.
 * Only considers dates strictly before `beforeDate`.
 * Returns an empty record if no overrides exist.
 */
function buildLastPerformedWeights(
  allOverrides: Record<string, Record<string, number | null>>,
  beforeDate: string,
): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  // Walk dates in reverse chronological order
  const dates = Object.keys(allOverrides).filter(d => d < beforeDate).sort().reverse();
  for (const d of dates) {
    const exerciseWeights = allOverrides[d];
    for (const [exId, weight] of Object.entries(exerciseWeights)) {
      // Only take the most recent for each exercise
      if (!(exId in result)) {
        result[exId] = weight;
      }
    }
  }
  return result;
}

function dateToDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
}

function isInBlock(dateStr: string, program: TrainingProgram | null): boolean {
  if (!program) return false;
  const start = program.startDate.split('T')[0];
  const end = program.endDate.split('T')[0];
  return dateStr >= start && dateStr <= end;
}

/** Get ISO date string for Monday of the week containing today, offset by N weeks. */
export function getMondayStr(weekOffset: number): string {
  return addDays(getMondayStrForDate(todayISOLocal()), weekOffset * 7);
}

/**
 * Get ISO date string for Monday of the week containing an arbitrary date.
 * Single owner of the "which Monday does this date belong to" rule — any
 * surface that needs the full week for a date (e.g. the plan-change door
 * hosted away from the Program tab) goes through here rather than
 * re-deriving Monday arithmetic locally.
 */
export function getMondayStrForDate(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00`);
  const dow = d.getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : -(dow - 1);
  d.setDate(d.getDate() + mondayOffset);
  d.setHours(12, 0, 0, 0);
  return formatDate(d);
}

export interface ProgramWeekOffsetBounds {
  /** Earliest Monday-relative offset containing any part of the saved program. */
  min: number;
  /** Latest Monday-relative offset containing any part of the saved program. */
  max: number;
}

function weekOffsetBetween(currentMonday: string, targetMonday: string): number {
  const current = new Date(`${currentMonday}T12:00:00`);
  const target = new Date(`${targetMonday}T12:00:00`);
  return Math.round((target.getTime() - current.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

/**
 * The saved program owns the Program tab's navigable date range.
 *
 * Bounds are week-shaped because the surface is week-shaped: a program that
 * begins on Wednesday still permits the Monday-Sunday week containing that
 * Wednesday, but never the prior week. No block-length assumption appears
 * here; two-, four- and six-week programs all resolve from their own dates.
 */
export function programWeekOffsetBounds(
  program: Pick<TrainingProgram, 'startDate' | 'endDate'> | null | undefined,
  todayISO: string,
): ProgramWeekOffsetBounds {
  if (!program?.startDate || !program.endDate) return { min: 0, max: 0 };

  const startDate = program.startDate.slice(0, 10);
  const endDate = program.endDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)
    || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
    || startDate > endDate) {
    return { min: 0, max: 0 };
  }

  const currentMonday = getMondayStrForDate(todayISO);
  return {
    min: weekOffsetBetween(currentMonday, getMondayStrForDate(startDate)),
    max: weekOffsetBetween(currentMonday, getMondayStrForDate(endDate)),
  };
}

export function clampProgramWeekOffset(
  requestedOffset: number,
  bounds: ProgramWeekOffsetBounds,
): number {
  return Math.min(bounds.max, Math.max(bounds.min, requestedOffset));
}

function toDateString(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

// ─── Classification Helpers (from blockAdjuster) ───

// ─── Core Exposure Protection ───

/**
 * REQUIRED EXPOSURE TYPES — the movement patterns the engine plans as
 * non-negotiable within a microcycle. If a session's name matches one of
 * these and it carries tier === 'core', it represents a required exposure
 * that the resolver must NOT delete, replace, or downgrade.
 */
const REQUIRED_EXPOSURE_PATTERNS = [
  'lower', 'push', 'pull', 'upper', 'full body', 'balanced',
] as const;

function createGameStub(
  dateStr: string,
  dow: number,
  variant: FixtureAvailabilityKind = 'game',
): Workout {
  const now = new Date().toISOString();
  return {
    id: `calendar-game-${dateStr}`,
    microcycleId: 'calendar',
    dayOfWeek: dow,
    name: 'Game Day',
    description: 'Match day',
    durationMinutes: 120,
    intensity: 'High',
    // LABEL ONLY (ruling 6-IV-4): the variant is a WORD channel for
    // `dayIsPracticeMatch`, never a second workoutType — every `=== 'Game'`
    // comparison (locks, invariants, proximity) keeps meaning what it means.
    workoutType: 'Game',
    ...(variant === 'practice_match' ? { fixtureVariant: 'practice_match' as const } : {}),
    sessionTier: 'core',
    exercises: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Virtual game stub. Distinct id prefix so we can tell virtual from explicit
 * calendar-sourced games (useful in logs + analytics).
 */
function createVirtualGameStub(dateStr: string, dow: number): Workout {
  const now = new Date().toISOString();
  return {
    id: `virtual-game-${dateStr}`,
    microcycleId: 'virtual',
    dayOfWeek: dow,
    name: 'Game Day',
    description: 'Match day',
    durationMinutes: 120,
    intensity: 'High',
    workoutType: 'Game',
    sessionTier: 'core',
    exercises: [],
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Game Day (virtual games) ───

/** Day-name → JS getDay() number for mapping profile fields to dow. */
const DOW_TO_NUM: Record<DayOfWeek, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/**
 * Resolve the effective game day from profile fields.
 *
 * THE FRI/SAT/SUN ALLOWLIST THAT USED TO LIVE HERE IS DELETED (2026-08-12).
 * It was the entire reason a game could not be on a Tuesday: this function
 * answered `undefined` for any midweek day, so the week downstream was built as
 * if there were NO GAME — no G-1, no G-2, no G+1. The athlete got the wrong
 * week, not a missing preference.
 *
 * `storedGameAnchor` is now the one owner of "which day is the game", shared
 * with the profile sheet, the phase sheet, the generator, the replan, the boot
 * re-seed and the coach. Seven other copies of this question were collapsed
 * onto it.
 */
export function resolveEffectiveGameDay(
  usualGameDay?: DayOfWeek,
  gameDay?: DayOfWeek,
): DayOfWeek | undefined {
  return storedGameAnchor({ usualGameDay, gameDay }) ?? undefined;
}

/**
 * Is a virtual game active for this schedule state?
 * Requires In-season phase and a resolvable effective game day.
 */
function isVirtualGameEnabled(state: ScheduleState): boolean {
  if (state.seasonPhase !== 'In-season') return false;
  return resolveEffectiveGameDay(state.usualGameDay, state.gameDay) !== undefined;
}

/**
 * Returns true if any date in the Mon–Sun week containing `date` has an
 * explicit 'game' mark. Used to suppress the virtual game when the user has
 * moved the game to a different day this week.
 */
function weekHasExplicitGameMark(
  date: string,
  markedDays: Record<string, CalendarDayType>,
): boolean {
  const monday = getMondayForDate(date);
  const sunday = addDays(monday, 6);
  for (const [d, type] of Object.entries(markedDays)) {
    if (type === 'game' && d >= monday && d <= sunday) return true;
  }
  return false;
}

// ─── Game Proximity Logic (from blockAdjuster) ───

/**
 * Effective game dates for proximity and placement logic.
 *
 * Combines explicit 'game' marks with VIRTUAL games derived from
 * profile.usualGameDay/gameDay when In-season. Without this augmentation,
 * G-1/G-2/G+1 proximity rules never fire for virtual Saturdays because
 * getAllGameDates only scans explicit marks.
 *
 * Explicit 'game' marks are scoped by day-of-week + proximity:
 *   - Recurring marks (dow === usualGameDay)  → unconditional, all weeks see them.
 *   - One-off / moved marks (dow !== usualGameDay, or no recurring game active)
 *     → count for their own Mon–Sun week AND for dates within ±2 days of the
 *     mark. This keeps true cross-week G+1/G-1/G-2 protection without letting
 *     one-off marks reshape weeks 2+ away.
 *
 * Virtual games are included only for weeks where the virtual game is not
 * suppressed (no 'noGame'/'rest' on the day itself, no other explicit 'game'
 * mark in that Mon–Sun week). Walks a ±windowDays window around centerDate
 * so proximity checks for any day in the window can see neighbouring games.
 */
function getEffectiveGameDates(
  state: ScheduleState,
  centerDate: string,
  windowDays: number = 10,
): Set<string> {
  const dates = effectiveGameDatesAround({
    markedDays: state.markedDays || {},
    usualGameDay: state.usualGameDay,
    gameDay: state.gameDay,
    seasonPhase: state.seasonPhase,
    centerDate,
    windowDays,
  });
  /* ── R-020 ON THE READ SIDE: A TRIP TAKES THE FIXTURE WITH IT ─────────────
   *
   * The VIRTUAL fixture above is re-derived from `gameDay` + In-season, so it
   * reappears for every Saturday forever — including Saturdays the athlete is a
   * thousand kilometres away. The plan side already removes it
   * (`weeklySchedulerInputs.clubInputsAfterTravel`); without this the two sides
   * disagree, and the disagreement is not cosmetic.
   *
   * ⚠ **MEASURED, AND IT COST THE ATHLETE A WHOLE STRENGTH DAY.** 2026-08-17,
   * `npm run trace:equipment-scopes` B2: the composer authored a full lower day
   * on the Friday of a trip — `Goblet Squat`, `RDLs` (a MAIN LIFT), `Cossack
   * Squat`, `Single-Leg RDL`, `Band Pallof Press` — and the athlete was shown a
   * **Gunshow**, because `applyGameProximity` saw a phantom Saturday fixture,
   * called that Friday G−1, and displaced the day. §18 had already counted
   * those rows, so the week that was JUDGED and the week that SHIPPED disagreed
   * about a main lift.
   *
   * Sam ruled the boundary himself: *"If you're away, you're not playing … the
   * game on the 15th should be removed … but the next saturday the 22nd game is
   * still alive"*. Only dates INSIDE a live span are dropped.
   *
   * ⚠ **AN EXPLICIT CALENDAR MARK IS NOT AN EXEMPTION, AND TRYING TO MAKE IT
   * ONE SPLIT THE APP IN TWO.** The first version of this filter kept a marked
   * fixture — "a mark is the athlete's own word" — and the plan side
   * (`clubInputsAfterTravel`) drops fixtures inside a span whether marked or
   * not. So the two sides disagreed about the same Saturday: the PLAN built a
   * normal week with a Friday lower day, and the READ side then called that
   * Friday G−1 and replaced it with a Gunshow. Measured — weekday 5 lost
   * `Goblet Squat, RDLs, Cossack Squat, Single-Leg RDL, Band Pallof Press`,
   * caught by `test:equipment-scopes` [19b].
   *
   * A mark says a fixture EXISTS; it does not say the athlete is in the country
   * for it. Being away is the later, narrower fact and it wins on both sides.
   * The span owner is the shared `awaySpans.ts`, so the plan side and the read
   * side now give one answer. */
  const spans = awaySpansFromFacts(state.temporarySourceFacts);
  if (spans.length === 0) return dates;
  return new Set([...dates].filter((date) => !dateIsInsideAwaySpan(date, spans)));
}

/**
 * `getEffectiveGameDates` over the minimal slice it actually reads, so callers
 * outside the resolver (the G-1 ask-flow) can ask the SAME owner "where are the
 * games?" instead of re-deriving it from a visible week. Re-derivation is how a
 * second answer to a settled question gets born; there is one answer and this
 * is it.
 */
export function effectiveGameDatesAround(args: {
  markedDays: Readonly<Record<string, CalendarDayType>>;
  usualGameDay?: DayOfWeek;
  gameDay?: DayOfWeek;
  seasonPhase: SeasonPhase | null | undefined;
  centerDate: string;
  windowDays?: number;
}): Set<string> {
  const markedDays = args.markedDays || {};
  const centerDate = args.centerDate;
  const windowDays = args.windowDays ?? 10;
  const games = new Set<string>();

  const effGameDay = resolveEffectiveGameDay(args.usualGameDay, args.gameDay);
  const virtualDow = effGameDay !== undefined ? DOW_TO_NUM[effGameDay] : undefined;
  const recurringActive = args.seasonPhase === 'In-season' && virtualDow !== undefined;

  // Bounds for one-off scoping (Mon–Sun of centerDate's week).
  const centerMonday = getMondayForDate(centerDate);
  const centerSunday = addDays(centerMonday, 6);

  // Loop 1: explicit 'game' marks. Recurring marks (dow === usualGameDay) are
  // included for any centerDate. One-off marks (different dow, or pre-season
  // practice matches with no recurring game) count only for their own Mon–Sun
  // week and for the adjacent ±2-day proximity window.
  for (const [date, type] of Object.entries(markedDays)) {
    if (type !== 'game') continue;
    if (recurringActive) {
      const dow = dateToDayOfWeek(date);
      const isRecurring = dow === virtualDow;
      if (isRecurring) {
        games.add(date);
        continue;
      }
    }
    const sameWeek = date >= centerMonday && date <= centerSunday;
    const adjacentProtectionWindow = Math.abs(isoDayDiff(centerDate, date)) <= 2;
    if (!sameWeek && !adjacentProtectionWindow) continue;
    games.add(date);
  }

  if (!recurringActive) return games;

  // Loop 2: virtual games for the recurring day, in a ±windowDays window.
  for (let offset = -windowDays; offset <= windowDays; offset++) {
    const d = addDays(centerDate, offset);
    const dow = dateToDayOfWeek(d);
    if (dow !== virtualDow) continue;
    const mark = markedDays[d];
    // User bye-out on the virtual day itself → no game that week.
    if (mark === 'noGame' || mark === 'rest') continue;
    // Moved game in the same week → virtual suppressed by the explicit mark.
    if (weekHasExplicitGameMark(d, markedDays)) continue;
    games.add(d);
  }
  return games;
}

// ─── Indicator Helper ───

function workoutToIndicator(workout: Workout | null, source: ResolvedDay['source']): ResolvedDay['indicator'] {
  if (source === 'rest') return 'rest';
  if (source === 'game') return 'game';
  if (source === 'conditioning') return 'conditioning';
  if (!workout) return null;
  if (workout.workoutType === 'Game') return 'game';
  if (workout.sessionTier === 'recovery' || workout.workoutType === 'Recovery') return 'recovery';
  if (workout.sessionTier === 'optional') return 'optional';
  return 'core';
}

// ─── Build Helper ───

function buildDay(
  date: string,
  dow: number,
  today: string,
  workout: Workout | null,
  source: ResolvedDay['source'],
): ResolvedDay {
  return {
    date,
    dayOfWeek: dow,
    short: DAY_SHORT[dow],
    isToday: date === today,
    workout,
    source,
    indicator: workoutToIndicator(workout, source),
  };
}

function getWeekScopedTemplateWorkout(
  date: string,
  state: ScheduleState,
): { hasOverlay: boolean; workout: Workout | null; overlay: WeekScopedWorkoutOverlay | null } {
  const weekStart = getMondayForDate(date);
  const overlay = state.weekScopedOverlays?.[weekStart] ?? null;
  if (!overlay) return { hasOverlay: false, workout: null, overlay: null };
  if (date < overlay.weekStart || date > overlay.weekEnd) {
    return { hasOverlay: false, workout: null, overlay: null };
  }
  if (!Object.prototype.hasOwnProperty.call(overlay.workoutsByDate, date)) {
    return { hasOverlay: false, workout: null, overlay: null };
  }
  return {
    hasOverlay: true,
    workout: overlay.workoutsByDate[date] ?? null,
    overlay,
  };
}

function microcycleIdForDate(date: string, state: ScheduleState): string {
  return selectMicrocycleForDate(
    state.currentProgram,
    state.currentMicrocycle,
    date,
  )?.id || 'derived';
}

// ─── Core Function ───

/**
 * resolveDate — Single source of truth for any date's workout.
 *
 * Resolution priority — THE ordering, owned by `rules/dayPrecedence.ts`:
 *   1. Emptying decisions: calendar rest mark → null; calendar game mark →
 *      game stub; an active removal constraint → its remainder or nothing.
 *   2. Composed content: manual override > week overlay > base microcycle.
 *   3. Template says game but no calendar mark → freed slot (optional session)
 *   4. Template + game proximity rules
 *   5. Unmodified template
 *   6. No workout
 *
 * THE MANUAL OVERRIDE USED TO SIT AT PRIORITY 1, ABOVE THE MARK. That single
 * exception was the whole live/accepted divergence: the accepted stack reaches
 * this same function through the §18 gateway with `manualOverrides: {}`
 * (`section18AcceptedWeekGateway.ts:248-250`), because by then the override has
 * already been composed into the candidate microcycle — so Priority 1 never
 * fired there and the mark won. One ordering, two answers, decided by whether
 * the surface happened to still be populated.
 *
 * Sam recorded the consequence himself at `programStore.ts:1187-1196`: the
 * screen prescribed Lower Squat on a day he had marked rest "while the accepted
 * week correctly held nothing". The accepted answer is the one his note calls
 * correct, so the live path converges onto it and the accepted stack does not
 * move. See `rules/dayPrecedence.ts` for the full reasoning.
 */
/* ── WHY THERE IS NO READ-SIDE PER-DAY EQUIPMENT SCOPING HERE ──────────────
 *
 * `withAthleteKitForDate` lived here from 2026-08-17 and was DELETED the same
 * day, after being PROVEN INERT rather than assumed so. It re-resolved
 * `AthleteContext.equipmentTags` for each date so that every builder inside one
 * date resolution got that day's kit.
 *
 * **THE PROOF IT IS REDUNDANT, MEASURED BOTH WAYS.** With it disabled: the
 * ten-world equipment trace is BYTE-IDENTICAL, the five printed weeks are
 * BYTE-IDENTICAL, and `test:equipment-scopes` 24/0, `test:away-flow` 51/0,
 * `test:away-span-ownership` 8/0, `test:exercise-exclusions` 52/0,
 * `test:scenarios` 62/3 and `print:week` are all unchanged. Nothing anywhere
 * observed it.
 *
 * **AND THE REASON IS CAUSAL, NOT JUST EMPIRICAL — three routes, all closed:**
 *   1. STRENGTH content is composed at GENERATION against the per-day kit
 *      (`composeWeek`'s `temporaryKitByDayOfWeek`), and a projection may no
 *      longer replace a composer-authored session, so no read-side producer
 *      authors strength rows over a composed day.
 *   2. The G−1 Gunshow — the one read-side producer that ever authored
 *      kit-sensitive rows inside a trip — cannot land there: a fixture inside a
 *      live span is gone (`getEffectiveGameDates`), and when the fixture is
 *      OUTSIDE the span its G−1 falls on a Rest template that proximity leaves
 *      alone. That was the `Tricep Pushdown`-in-a-hotel route and it is shut.
 *   3. `freedByTheTrip` authors CONDITIONING, whose machine choice is governed
 *      by the modality owner and the substitution policy, not by
 *      `AthleteContext.equipmentTags`.
 *
 * ⚠ **WHAT WOULD REQUIRE IT BACK, so this is a decision and not an amnesia:**
 * any read-side producer that authors STRENGTH or ACCESSORY rows on a date
 * inside a live equipment span — a proximity rule that displaces onto a
 * non-empty day, a freed-slot `prehab_accessories` reachable during a trip, or
 * an athlete-added session composed at read time. The moment one exists, the
 * week-level `equipmentTags` is wrong for it again, and the fix is this
 * function restored at this seam — not a filter at the producer.
 *
 * A guard is not left behind for a deleted function: the property that matters
 * is held athlete-side by `test:equipment-scopes` [16]/[21], which walk every
 * VISIBLE row against that day's kit and would red on any such producer
 * whatever authored it. */
function _resolveDateRaw(date: string, state: ScheduleState): ResolvedDay {
  const { currentProgram, manualOverrides, markedDays } = state;
  const currentMicrocycle = selectMicrocycleForDate(
    currentProgram,
    state.currentMicrocycle,
    date,
  );
  const dow = dateToDayOfWeek(date);
  const today = todayISOLocal();
  const inBlock = isInBlock(date, currentProgram);

  // ── Priority 1: Calendar marks (game / rest / noGame) ──
  const mark = markedDays ? markedDays[date] : undefined;
  if (mark === 'rest') {
    return buildDay(date, dow, today, null, 'rest');
  }
  if (mark === 'game') {
    // A calendar mark carries no variant of its own — the SEASON decides which
    // word the fixture wears (`calendarStore` routes an in-season game and a
    // pre-season practice match through the same mark). One predicate, shared
    // with the engine's week mode.
    return buildDay(
      date, dow, today,
      createGameStub(date, dow, canonicalFixtureKindForResolvedPhase(state.seasonPhase)),
      'game',
    );
  }
  // 'noGame' is handled below during virtual-game injection: it suppresses
  // the virtual game on its own date but does not, by itself, block template
  // or conditioning from running on that day (bye weeks still get a session).

  // ── Priority 3: Virtual Game (In-season + effective game day) ──
  // Render a Game cell on the day where `dow === DOW_TO_NUM[effectiveGameDay]`
  // when:
  //   - the phase HAS fixtures — In-season games and Pre-season practice
  //     matches; the app's own `canonicalFixtureKindForResolvedPhase` is what
  //     distinguishes them, AND
  //   - profile has an effective game day (usualGameDay || gameDay), AND
  //   - this day itself is NOT marked 'noGame' (explicit bye), AND
  //   - no other day in this Mon–Sun week has an explicit 'game' mark
  //     (week-level suppression when user has moved the game).
  //
  // This runs BEFORE the freed-game-slot logic so Saturday is never treated
  // as empty when virtual should own it.
  const effectiveGameDay = resolveEffectiveGameDay(state.usualGameDay, state.gameDay);
  // ⚠ **PRE-SEASON WAS MISSING AND IT MADE AN ANCHOR INVISIBLE.** This read was
  // `seasonPhase === 'In-season'`, so a PRE-SEASON athlete with a declared
  // fixture saw a Rest Day on it — while generation had stored a `Game` workout
  // there and the exposure contract had issued a `practice_match` anchor
  // claiming conditioning, sprint AND hard-day credit off it. The week was
  // counted as having four conditioning exposures and the athlete could see
  // three. **An anchor the athlete cannot see must never satisfy the contract.**
  //
  // The app already knows a pre-season fixture is a practice match
  // (`canonicalFixtureKindForResolvedPhase`) and already has the signed word for
  // it (`day.headline.practice_match`) — only this gate had not been told.
  // Off-season stays out: it has no fixtures, so a stale `gameDay` on an
  // off-season profile must not mint one.
  const phaseHasFixtures = state.seasonPhase === 'In-season'
    || state.seasonPhase === 'Pre-season';
  const virtualEnabled = phaseHasFixtures && effectiveGameDay !== undefined;
  if (
    virtualEnabled &&
    mark !== 'noGame' &&
    dow === DOW_TO_NUM[effectiveGameDay!] &&
    !weekHasExplicitGameMark(date, markedDays || {})
  ) {
    return buildDay(date, dow, today, createVirtualGameStub(date, dow), 'game');
  }

  const overlayTemplate = getWeekScopedTemplateWorkout(date, state);

  // ── Priority 2: composed content — override > overlay > base ──
  //
  // ONE statement of the ordering (`rules/dayPrecedence.ts`), the same call the
  // accepted stack makes. Overlay SELECTION stays here because this site
  // range-checks the overlay's own `weekStart`/`weekEnd` and the others key
  // straight off the Monday; only the ordering is shared.
  const composed = composeDaySurfaces({
    date,
    dayOfWeek: dow,
    dateOverrides: manualOverrides,
    overlay: overlayTemplate.hasOverlay
      ? { workoutsByDate: { [date]: overlayTemplate.workout } }
      : null,
    base: currentMicrocycle?.workouts.find(w => w.dayOfWeek === dow) || null,
  });

  // ── Priority 1, constraint half: the athlete emptied or trimmed this day ──
  //
  // `userRemovalConstraints` was not a field on `ScheduleState` and appeared
  // nowhere in this file, so the live path could not order what it could not
  // see: a bin the accepted week honoured was invisible to the screen the
  // moment anything else occupied the day. Applied AFTER compose and BELOW the
  // marks, which is where the accepted stack applies it
  // (`acceptedEffectiveWeek.ts:144-157`, before the gateway's own resolver
  // pass). The result then continues down the normal derivation path so
  // proximity, conditioning and recovery treat it exactly as they do there.
  const constrained = removalConstraintForComposedDay({
    composed,
    constraints: state.userRemovalConstraints,
  });

  // ── THE ATHLETE'S "LEAVE THIS EXERCISE OUT", ON AN AUTHORED DAY ──────────
  //
  // INSTALL SITE 2 OF 2. Site 1 is `rebaseAcceptedEffectiveWeek`, the accepted
  // stack's compose owner. **This function is the one the athlete's SCREEN
  // takes** — measured 2026-08-13, `resolveWeekWithConditioning` leaves through
  // its `!state.seasonPhase` guard and never reaches its own tail — so a filter
  // installed only at the accepted stack is a filter the athlete never sees.
  // Both sites read the SAME decisions from the SAME owner
  // (`liveAthleteExclusions`), so they cannot disagree.
  //
  // AFTER the removal constraint, deliberately: a constraint pushes its own
  // `remainingWorkout` back onto the day, and content the athlete's removal
  // deposited must answer the athlete's exclusion too.
  //
  // ⚠ **ON `ScheduleState`, AND THE FIRST CUT READ THE LIVE STORE HERE INSTEAD.**
  // That looked safer — nothing can forget a field that does not exist — and it
  // was measured WRONG within one restart. This resolver is not only the read
  // door: `programStore.canonicaliseAcceptedBoundaryState` composes the accepted
  // week THROUGH it, and `commitRebuiltProgram` persists the result. So a filter
  // that applies unconditionally is a filter that gets WRITTEN DOWN — three
  // stored microcycles lost the row permanently while the block before the
  // decision day kept it, and Restore then had nothing to give back.
  //
  // A filter that is persisted is not a filter. So the exclusions travel on the
  // STATE, and only the doors that mean *"what does the athlete SEE"* carry
  // them: `deriveVisibleWeek.assembleScheduleState` and `hooks/useSchedule`.
  // The canonicalisers build their own bare states and therefore compose the
  // week the app AUTHORED, which is the week that must be stored.
  const dayExclusions = state.athleteExclusions ?? [];
  /* ── AN INJURY MARKS A ROW; ONLY THE ATHLETE REMOVES ONE ──────────────────
   *
   * Sam, 2026-08-20: *"Preserve the original exercises. On that date, show them
   * as unavailable/skip ... Remove remains exclusively athlete-authored
   * Remove."* So the two projections sit side by side here and do OPPOSITE
   * things on purpose: the exclusion FILTERS the row out, the injury MARKS it.
   *
   * It belongs at exactly this seam for exactly the reason written above about
   * exclusions — `canonicaliseAcceptedBoundaryState` composes the stored week
   * THROUGH this resolver, and a projection that reaches it gets written down.
   * `state.temporarySourceFacts` is supplied by the VIEW doors, so a
   * canonicalising caller carries none and marks nothing. */
  const dayInjuryFacts = state.temporarySourceFacts ?? [];
  const withhold = <T extends Workout | null>(workout: T): T => markInjuryWithheldRows({
    workout, dateISO: date, facts: dayInjuryFacts,
  });
  const composedWorkout = withhold(applyExclusionsToAuthoredDay({
    workout: composed.workout,
    dateISO: date,
    exclusions: dayExclusions,
  }));
  const constrainedWorkout = constrained
    ? withhold(applyExclusionsToAuthoredDay({
      workout: constrained.workout,
      dateISO: date,
      exclusions: dayExclusions,
    }))
    : null;

  // ── The date override answers WITHOUT needing block data ──
  //
  // A date override is stored content FOR THIS DATE. It is not derived from a
  // block, so the "no block data" guard below — which governs TEMPLATE
  // derivation — must not swallow it. Before the precedence unification the
  // override returned above that guard as Priority 1 and this was free; moving
  // it below the marks moved it below the guard too, and an override on any
  // date outside `[program.startDate, program.endDate]` silently stopped
  // rendering. Marks and removal constraints still outrank it: both are
  // resolved above this line.
  if (!constrained && composed.owner === 'date_override' && composedWorkout) {
    return buildDay(date, dow, today, composedWorkout, 'manual');
  }

  // ── No block data → nothing to resolve ──
  if (!inBlock || (!currentMicrocycle && !overlayTemplate.hasOverlay)) {
    return buildDay(date, dow, today, null, 'none');
  }

  const templateWorkout = constrained ? constrainedWorkout : composedWorkout;
  const templateMicrocycleId = overlayTemplate.overlay?.id ?? currentMicrocycle?.id ?? 'derived';

  /* ── PRIORITY 4, GAME PROXIMITY, IS DELETED ────────────────────────────────
   *
   * Demolition area 3, Sam 2026-08-19: *"Reading/drawing a program must not
   * author, persist, restore, repair or rewrite it."*
   *
   * `applyGameProximity` (251 lines) INVENTED SESSIONS while drawing the week.
   * On G+1 it built a `mobility` flush the composer had never authored; on G-1
   * it replaced whatever was there with a `arms_pump` Gunshow; on G-2 it
   * rewrote a lower session's intensity, description and every row's load. None
   * of it was stored, so the week the athlete saw and the week §18 counted were
   * different objects — and the day could not be edited, because a door that
   * edits stored decisions has nothing to edit on a day that exists only as a
   * derivation (`athleteSessionDeletionTests` regression 6).
   *
   * THE SURVIVING OWNER IS THE WEEKLY SCHEDULER, which already reasons about
   * fixtures — `daysUntilNextGame`, `sprintDayIsLegal`, the G-3 Bible anchor
   * moved onto it in this same demolition. G+1/G-1/G-2 are Bible laws about
   * which DAY carries what, and days are the scheduler's. Rebuilding them there
   * is on the rebuild list; nothing is rebuilt here. */
  const gameDates = getEffectiveGameDates(state, date);

  /* ── Priority 5: template says game, calendar doesn't (a freed slot) ──────
   *
   * ⚠ THE PREHAB SYNTHESIS IS DELETED (area 3, 2026-08-19). When other games
   * remained in the week this branch BUILT a `prehab_accessories` session onto
   * the freed day — content nobody authored, on a day the athlete cannot edit
   * because there is nothing stored to edit.
   *
   * The freed day is now simply EMPTY, which is the honest reading of the fact:
   * the fixture the stub stood for is not on the calendar. Filling a freed slot
   * is authoring and belongs to the scheduler and composer. On the rebuild
   * list. */
  if (templateWorkout?.workoutType === 'Game' && !mark) {
    return buildDay(date, dow, today, null, 'none');
  }

  // Accepted-week rest stubs are persisted scheduling decisions, not visible
  // sessions. Keep the day empty and mark it as rest so the later
  // conditioning/recovery fill passes cannot claim it.
  if (
    templateWorkout?.workoutType === 'Rest' &&
    templateWorkout.exercises.length === 0 &&
    !hasPowerRow(templateWorkout) &&
    !templateWorkout.conditioningBlock &&
    !templateWorkout.speedBlock
  ) {
    return buildDay(date, dow, today, null, 'rest');
  }

  /* ── Priority 6a IS DELETED: a stored session is not rebuilt at read ───────
   *
   * This branch REPLACED a stored recovery-tier session with a freshly built
   * mobility session on every read, because legacy AI-authored templates lacked
   * structured prescription fields. Rebuilding stored content while drawing it
   * is read-time authoring: the athlete saw a session that was composed anew on
   * each render rather than the one the app is holding.
   *
   * The surviving owner is the composer, which authors mobility with its
   * prescription fields already present. A legacy template that arrives without
   * them now renders as what it is. On the rebuild list (area 3). */

  // ── Priority 6b: Unmodified template ──
  return buildDay(date, dow, today, templateWorkout, templateWorkout ? 'template' : 'none');
}

/**
 * Public base resolver. Injury facts are not applied here: the visible-program
 * gate composes them once for every card/detail surface, including manual
 * overrides. Keeping this resolver on the accepted base prevents a second
 * injury owner and lets later athlete edits survive.
 *
 * ⚠ THE SECOND INJURY OWNER IS DELETED (demolition area 3, 2026-08-19), and
 * with it the legacy `state.activeInjury` alias and the `injuryProjectionOwner`
 * flag that decided which of the two got to rewrite the day (2026-08-19).
 * A projection does not filter safety: the composer refuses an illegal row
 * before authoring it, and the visible-program gate composes the fact.
 */
export function resolveDate(date: string, state: ScheduleState): ResolvedDay {
  return _resolveDateRaw(date, state);
}

// ─── Wrapper Functions ───

/** Resolve 7 days (Mon→Sun) for the week starting at mondayStr. */
export function resolveWeek(mondayStr: string, state: ScheduleState): ResolvedDay[] {
  const days: ResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(resolveDate(addDays(mondayStr, i), state));
  }
  return days;
}

/** Resolve indicator for every date in a month. Used by Calendar grid. */
export function resolveMonthIndicators(
  year: number,
  month: number,
  state: ScheduleState,
): Record<string, ResolvedDay['indicator']> {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const result: Record<string, ResolvedDay['indicator']> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateString(year, month, d);
    result[dateStr] = resolveDate(dateStr, state).indicator;
  }
  return result;
}

// ─── Conditioning-Aware Resolution ───

/**
 * Get the Monday (ISO date) of the week containing a given date.
 */
export function getMondayForDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  const dow = date.getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : -(dow - 1);
  date.setDate(date.getDate() + mondayOffset);
  return formatDate(date);
}

/**
 * Resolve a full week with conditioning and recovery placement.
 *
 * Three-pass approach:
 *   Pass 1: Resolve all 7 days normally (strength templates, game proximity, overrides).
 *   Pass 2: Walk Mon→Sun. For each empty day within the active block,
 *           try conditioning placement via the rule engine. Earlier days'
 *           placements feed into later days' WeekLog (progressive accumulation).
 *   Pass 3: Walk Mon→Sun again. For each STILL-empty day within the block,
 *           try recovery placement. Recovery never coexists with strength
 *           or conditioning on the same day. Uses readiness-based category
 *           selection (passive / active / extended) with frequency guards.
 *
 * Resolution order: Strength → Conditioning → Recovery fills gaps.
 * Each pass is additive — never displaces prior passes.
 *
 * If no seasonPhase is available (pre-onboarding), passes 2 and 3 are skipped.
 */
/**
 * Materialise strength progression for a resolved week (AUTHORING step).
 *
 * Applies the progression engine to template/manual strength days, mutating
 * `baseDays` in place. This is the *authoring / acceptance-time* computation:
 * it used to run on every read inside resolveWeekWithConditioning, which made
 * loads drift on each resolution and let mutations snapshot a re-progressed
 * value. Under the §18 ownership redesign (stage 1) it is invoked once when a
 * week is authored / accepted, and resolution merely projects the frozen
 * result. Exported so authoring paths and progression tests drive it directly.
 */
export function materialiseWeekStrengthProgression(
  baseDays: ResolvedDay[],
  state: ScheduleState,
  gameDates: string[],
): ResolvedDay[] {
  const injuries = (state.athleteContext?.injuries || []).map(i => ({
    bodyArea: i.bodyArea,
    severity: i.severity,
  }));

  const feedbackMap = state.sessionFeedback || {};
  const allFeedbackSorted: SessionFeedback[] = Object.values(feedbackMap)
    .sort((a: SessionFeedback, b: SessionFeedback) => b.dateStr.localeCompare(a.dateStr));

  // Build a workout-type-by-date map for session type matching.
  // Uses resolved base days + template workouts to map dates → workoutType.
  const workoutByDate: Record<string, Workout> = {};
  for (const day of baseDays) {
    if (day.workout) {
      workoutByDate[day.date] = day.workout;
    }
  }
  // Also include historical dates from feedback that have no resolved day
  // (previous weeks). Use the workout name/type from the template by dayOfWeek.
  if (state.currentMicrocycle) {
    for (const fb of allFeedbackSorted) {
      const fbMicrocycle = selectMicrocycleForDate(
        state.currentProgram,
        state.currentMicrocycle,
        fb.dateStr,
      );
      if (!workoutByDate[fb.dateStr] && fbMicrocycle?.workouts) {
        const [fy, fm, fd] = fb.dateStr.split('-').map(Number);
        const fbDate = new Date(fy, fm - 1, fd);
        const fbDow = fbDate.getDay();
        const matchingWorkout = fbMicrocycle.workouts.find(
          (w: Workout) => w.dayOfWeek === fbDow
        );
        if (matchingWorkout) {
          workoutByDate[fb.dateStr] = matchingWorkout;
        }
      }
    }
  }

  for (let i = 0; i < baseDays.length; i++) {
    const day = baseDays[i];
    if (
      day.workout &&
      workoutHasProgressableStrengthRows(day.workout) &&
      (day.source === 'template' || day.source === 'manual')
    ) {
      // Recent feedback before this date — for per-day pattern analysis
      const priorFeedback = allFeedbackSorted.filter(
        (fb: SessionFeedback) => fb.dateStr < day.date
      );
      const lastFeedbackFeeling = priorFeedback.length > 0
        ? (priorFeedback[0].feeling as any) || null
        : null;

      // Session-type-matched adaptation (from new difficulty/soreness fields)
      const matchedFeedback = findMatchingFeedback(
        day.workout,
        feedbackMap,
        workoutByDate,
        day.date,
      );
      const adaptation = deriveAdaptation(matchedFeedback);
      const blockState = state.blockState
        ? getStoredBlockStateForDate(
            state.blockState,
            day.date,
            state.seasonPhase,
            state.currentProgram?.seasonPhaseClock,
          )
        : state.currentProgram
          ? getProgramBlockStateForDate({
            dateISO: day.date,
            programStartISO: state.currentProgram.startDate,
            seasonPhase: state.seasonPhase,
            seasonPhaseClock: state.currentProgram.seasonPhaseClock,
          })
          : undefined;

      const providedWorkoutHistory = (state.workoutHistory ?? [])
        .filter((workout) => workout.loggedDate < day.date)
        .sort((a, b) => b.loggedDate.localeCompare(a.loggedDate));
      const feedbackWorkoutHistory = buildStrengthWorkoutHistoryFromFeedback(
        feedbackMap,
        day.date,
      );
      const workoutHistory = [...providedWorkoutHistory, ...feedbackWorkoutHistory]
        .sort((a, b) => b.loggedDate.localeCompare(a.loggedDate));
      const missedSessionsThisWeek = deriveMissedStrengthSessionsThisWeek(
        feedbackMap,
        day.date,
      );

      const progressionCtx = buildProgressionContext(
        state.seasonPhase!,
        state.capacity || 'medium',
        gameDates,
        day.date,
        injuries,
        state.markedDays || {},
        workoutHistory,
        lastFeedbackFeeling,
        priorFeedback.slice(0, 4), // analysis window for pattern biases
        adaptation.explanation ? adaptation : null,
        { blockState, missedSessionsThisWeek },
      );

      // Build last-performed-weight map from weight overrides (dates before today)
      const lastPerformedWeights = buildLastPerformedWeights(
        state.weightOverrides || {},
        day.date,
      );

      let progressedWorkout: Workout = applyStrengthProgression(
        day.workout,
        progressionCtx,
        Object.keys(lastPerformedWeights).length > 0 ? lastPerformedWeights : undefined,
      );

      if (adaptation.explanation) {
        const adaptationReason = adaptation.volumeAdjustment < 0
          ? 'adaptation_reduced'
          : adaptation.volumeAdjustment > 0
            ? 'adaptation_increased'
            : 'adaptation_held';
        progressedWorkout = attachPrescriptionEffectEvidence(
          progressedWorkout,
          buildPrescriptionEffectEvidence({
            seed: {
              kind: 'progression_adaptation',
              reason: adaptationReason,
              ownerKey: `session-feedback:${matchedFeedback?.dateStr ?? day.date}:${day.workout.workoutType}`,
            },
            before: day.workout.exercises,
            after: progressedWorkout.exercises,
          }),
        );
      }

      // Attach adaptation explanation as metadata for UI consumption
      if (adaptation.explanation) {
        (progressedWorkout as any)._adaptationExplanation = adaptation.explanation;
      }

      baseDays[i] = {
        ...day,
        workout: progressedWorkout,
      };
    }
  }

  return baseDays;
}

/**
 * Author a week's strength progression (AUTHORING/acceptance entry point).
 *
 * Resolves the base week, then materialises strength progression into it and
 * returns the progressed days. This is the single seam that should run once
 * when a week is authored / accepted (its result is then stored and merely
 * projected by resolveWeekWithConditioning). It reproduces exactly what the
 * old read-time progression pass computed for a given ScheduleState — so
 * progression itself is unchanged; only *when* it runs has moved.
 */
export function authorWeekStrengthProgression(
  mondayStr: string,
  state: ScheduleState,
): ResolvedDay[] {
  const baseDays = resolveWeek(mondayStr, state);
  const gameDates: string[] = [];
  getEffectiveGameDates(state, mondayStr).forEach((d) => gameDates.push(d));
  return materialiseWeekStrengthProgression(baseDays, state, gameDates);
}

/**
 * Bake strength progression into a program's stored microcycles (AUTHORING).
 *
 * Runs once at generation so the stored week already carries its progressed
 * loads; resolution then merely projects them. This replaces the retired
 * read-time progression pass as the place progression is applied to a freshly
 * authored program. Mutates each microcycle's workouts in place.
 */
export function bakeMicrocycleStrengthProgression(
  program: TrainingProgram,
  state: Omit<ScheduleState, 'currentProgram' | 'currentMicrocycle'>,
): void {
  for (const microcycle of program.microcycles) {
    const weekStart = microcycle.startDate.slice(0, 10);
    const authored = authorWeekStrengthProgression(weekStart, {
      ...state,
      currentProgram: program,
      currentMicrocycle: microcycle,
    });
    const progressedById = new Map<string, Workout>();
    for (const day of authored) {
      if (day.workout) progressedById.set(day.workout.id, day.workout);
    }
    microcycle.workouts = microcycle.workouts.map(
      (workout) => progressedById.get(workout.id) ?? workout,
    );
  }
}

export function resolveWeekWithConditioning(
  mondayStr: string,
  state: ScheduleState,
): ResolvedDay[] {
  // Pass 1: base resolution (strength, game proximity, templates)
  const baseDays = resolveWeek(mondayStr, state);

  // Guard: skip conditioning + recovery if no season context
  // ⚠ THIS IS THE RETURN THE PROGRAM TAB TAKES — measured on a device
  // 2026-08-13 (SEAT_INBOX item 30), and it is why three filters added BELOW it
  // over two days could never run. `state.seasonPhase` is empty in the state the
  // screen builds, so the whole conditioning tail is skipped and the athlete's
  // week is `resolveWeek`'s output. Probes: this function entered 61 times in
  // one flow, the line at the bottom of it reached ZERO.
  if (!state.seasonPhase) return applyAwayPass(baseDays, state);

  // The availability set, the block bounds and the weekly feedback summary were
  // all inputs to the deleted conditioning/recovery PLACEMENT passes. Nothing
  // reads them now that the resolver places nothing (demolition area 3).
  const gameDates: string[] = [];
  {
    const effSet = getEffectiveGameDates(state, mondayStr);
    effSet.forEach((d) => gameDates.push(d));
  }

  // Strength progression is materialised once at authoring/acceptance time
  // (see materialiseWeekStrengthProgression / bakeMicrocycleStrengthProgression)
  // and baked into the stored week. Resolution now PROJECTS those loads — it no
  // longer recomputes progression on read. Retiring the read-time progression
  // layer is stage 1 of the §18 ownership redesign.

  // ── Double game week: second G+1 → full rest ──
  // On double game weeks, game proximity places recovery on BOTH G+1 days.
  // The second G+1 should be full rest — the athlete played two games in
  // one week and needs complete recovery, not another session.
  // Convert the later G+1 recovery to rest before conditioning/recovery passes
  // so neither pass attempts to fill it.
  //
  // GUARD: only fire when the week actually contains ≥2 games. Cross-week
  // G+1 proximity can place Monday recovery from a prior-week Sunday game;
  // without this guard, that single outside-week anchor could be misread
  // as a double-game week and a legitimate in-week G+1 would be downgraded.
  const result = [...baseDays];
  const today = todayISOLocal();
  const weekMonday = mondayStr;
  const weekSunday = addDays(weekMonday, 6);
  let gamesInThisWeek = 0;
  for (const gd of gameDates) {
    if (gd >= weekMonday && gd <= weekSunday) gamesInThisWeek++;
  }
  if (gamesInThisWeek >= 2) {
    const g1Indices: number[] = [];
    for (let i = 0; i < result.length; i++) {
      const day = result[i];
      if (
        day.source === 'gameProximity' &&
        day.workout &&
        (day.workout.workoutType === 'Recovery' || day.workout.sessionTier === 'recovery')
      ) {
        g1Indices.push(i);
      }
    }
    if (g1Indices.length >= 2) {
      // Keep the first G+1 recovery, convert all subsequent to full rest
      for (let k = 1; k < g1Indices.length; k++) {
        const idx = g1Indices[k];
        result[idx] = buildDay(result[idx].date, result[idx].dayOfWeek, today, null, 'rest');
      }
    }
  }

  /* ── THE PRE-GAME FATIGUE-STACKING GUARD IS DELETED (area 3, 2026-08-19) ───
   *
   * It only ever fired on a day whose `source` was `'gameProximity'` and whose
   * workout was named `Gunshow` — both of which the deleted read-time proximity
   * engine produced. With that engine gone the guard is UNREACHABLE, and its
   * remedy was itself a synthesis: it replaced the G-2 day with a freshly built
   * `prehab_accessories` session.
   *
   * The real rule it protected — do not stack upper-body stress in the 48h
   * pre-game window — is a SCHEDULING law and belongs to the weekly scheduler,
   * beside the G-3 anchor. On the rebuild list. */

  // Contract v2 is the final owner of selected core, optional work and true
  // rest for an accepted week. Game-proximity and progression have already
  // resolved above; the legacy gap-fill passes below must not invent a new
  // conditioning or recovery session after the accepted-week gateway.
  const section18Microcycle = selectMicrocycleForDate(
    state.currentProgram,
    state.currentMicrocycle,
    mondayStr,
  );
  const section18Overlay = state.weekScopedOverlays?.[mondayStr];
  // THE FLIP, MOVE (ii) — one read door. `selectMicrocycleForDate` above is
  // the covering answer, current-microcycle fallback already folded in.
  const section18StoredContract = selectStoredWeekDeclaration({
    overlay: section18Overlay,
    coveringMicrocycle: section18Microcycle,
    weekStart: mondayStr,
    reader: 'sessionResolver.tierFourEntry',
  });
  if (section18StoredContract) {
    // ── AWAY IS APPLIED BEFORE THE WEEK IS CONFORMED, NOT AFTER IT ──
    //
    // **SEAT_INBOX item 37. Sam, 2026-08-13:** *"Away has to replace the work it
    // removes, not just delete it — your Saturday Rest Day is the wrong case."*
    //
    // **THE ORDERING WAS THE WHOLE DEFECT.** `applyAwayPass` used to wrap the
    // RETURN of this branch, so the sequence was: conform the week against its
    // contract, and only then take the club off it. §18 therefore conformed a
    // week that still had a Game on Saturday, decided it was full, and handed
    // back a week the away pass then punched a hole in — with nothing left to
    // run. **A hole cut after the last filling pass can never be filled**, which
    // is why the vacated day read *"Training Day"*, and why calling it
    // *"Rest Day"* instead was answering the wrong question.
    //
    // ONE MOVE GIVES SAM HIS RULING, because the machinery already exists and is
    // already ruled: `derivedWeekContract` ALREADY drops a fixture inside the
    // trip and makes the week a bye-build (R-018, and his *"almost look like a
    // bye week build"*). The CONTRACT already knew the game was gone; only the
    // DAYS were being told afterwards. Applying away first lets §18 tier four
    // conform a club-less week against a club-less contract — and filling a
    // week that is short against its own contract is precisely what
    // `repairCoreConditioningShortfallCandidates` was for, before §18 stopped
    // injecting conditioning (2026-08-19).
    //
    // STILL A FILTER, STILL NOTHING STORED. This moves WHEN the read is
    // filtered, never what is written: his calendar mark, his accepted program
    // and the team night all still exist and all return when the fact lifts.
    const rested = result.map((day) =>
      !day.workout && day.source === 'none'
        ? buildDay(day.date, day.dayOfWeek, today, null, 'rest')
        : day);
    // Legs (ii)+(iii), install site 2 of 3 — THE DERIVER'S OWN
    // contract-selection line. The deriver reads
    // `overlay.exposureContractV2 ?? microcycle.exposureContractV2` itself, so
    // installing the derivation only at `acceptedEffectiveWeek.ts:102` leaves
    // tier 4 here conforming against the STORED contract and a fixture's
    // REMOVAL never reaches the conformance pass (scaffold defect 4).
    // ⚠ THE THIRD RETURN, AND IT IS THE ONE THE ATHLETE'S WEEK TAKES —
    // measured 2026-08-13 with a CONTROLLED probe (SEAT_INBOX item 30).
    // `resolveWeekWithConditioning` has three exits, not two: the no-season
    // guard, this §18 tier-four path, and the final line. A real week has a
    // stored §18 contract, so it leaves HERE — which is why every filter added
    // at the bottom of this function over two days never ran, and why the club
    // kept showing on a week the athlete was already looking at.
    // ⚠ TIER 4 AT READ IS DELETED (demolition area 3, 2026-08-19).
    //
    // `section18TierFour` (166 lines) re-derived the week's contract, ran the
    // §18 gateway over the week being DRAWN, and installed the gateway's answer
    // over the resolved days. It is the read-time conforming pass Sam's ruling
    // names: it *"may reshape a day"*. It also needed a hand-written boundary to
    // stop it EMPTYING one — measured 2026-08-17, it turned an authored
    // `lower_hinge | 5 rows` Friday into `Rest | 0 rows` on the athlete's
    // screen, so the week §18 judged and the week that shipped disagreed about
    // a main lift. A pass that needs a guard against destroying authored work is
    // a pass that should not run at read.
    //
    // §18 still runs, at the write boundaries, where it REFUSES.
    return applyAwayPass(rested, state);
  }

  /* ── PASS 2 IS GONE: THE READ-TIME CONDITIONING PLACEMENT ENGINE ──────────
   *
   * Demolition area 3, Sam 2026-08-19. It is the same class as Pass 3 below,
   * which went on 2026-07-30 for the same reason, and this file already said so
   * one branch up: *"the legacy gap-fill passes below must not invent a new
   * conditioning or recovery session after the accepted-week gateway."*
   *
   * WHAT IT DID: walked every empty day in the block and AUTHORED conditioning
   * onto it — choosing the template through `buildConditioningSession`, counting
   * a weekly running cap, and swapping a running session to an off-feet modality
   * when the cap was hit. Template choice, dose and modality are the
   * conditioning specialist's decisions, taken at authoring against the week's
   * contract; taken here they produced work no contract had counted and no door
   * could edit.
   *
   * ⚠ AND IT WAS ALREADY UNREACHABLE ON A REAL WEEK. The §18 branch above
   * returns for any week that has a stored contract, which every generated week
   * does. This pass only ever ran for a week with no declaration at all.
   *
   * SURVIVING OWNER: the conditioning specialist at authoring time, already on
   * the rebuild list from area A ("add conditioning after authorship ->
   * conditioning specialist"). Not rebuilt here. */

  // ── PASS 3 IS GONE: THE NINTH RECOVERY PLACEMENT SITE ──
  // BIBLE_ANCHOR: optional_placement_five_conditions
  //
  // It placed a derived recovery session on every remaining empty day, through
  // `resolveRecovery(daysToGame, daysSinceGame, phase, readiness, count, ...)` — an
  // app-invented rule with no authored source, on days nobody asked to fill.
  //
  // THE OPTIONAL PLACEMENT LAW (Sam, signed 2026-07-30, Bible §20.1) permits the app
  // to place optional work only under a placement rule Sam authored, with composition
  // Sam authored, visibly optional, binnable in one tap, and counting toward nothing.
  // Recovery fails the first: there is no authored rule that says "fill the spare
  // days with recovery". The charter deleted eight such sites in the generator; this
  // was the ninth, in the RESOLVER, and it survived because nothing could see it —
  // the generator filled every spare day first, so this pass had no empty day to
  // claim.
  //
  // Landing R2/R3/R4/R5 is what made it visible: with the day-based accessory
  // placements gone, empty days appeared and this pass immediately claimed one.
  // `athleteSessionDeletionTests` regression 6 caught it as a G+1 recovery session
  // the athlete could not delete — the resolver re-derived it on every read, so the
  // deletion never reached the visible week. A derived session cannot be binned,
  // which is condition 4 failing as well.
  //
  // Empty days stay empty. The athlete has the recovery door, and it is theirs.

  // ── Game-day LOCK invariant ──
  // If virtual game is enabled and the week has no explicit game mark, the
  // day at virtualDow is OWNED by the Game cell. Any non-Game workout that
  // somehow survived earlier passes (template fragment, conditioning,
  // recovery) is overwritten with a virtual Game here.
  //
  // Respects explicit `rest` / `noGame` marks on the game day itself so the
  // user can bye-out. Does NOT respect manual overrides — in-season game day
  // is non-negotiable.
  if (isVirtualGameEnabled(state)) {
    const effGameDay = resolveEffectiveGameDay(state.usualGameDay, state.gameDay)!;
    const virtualDow = DOW_TO_NUM[effGameDay];
    const weekHasExplicit = weekHasExplicitGameMark(mondayStr, state.markedDays || {});
    if (!weekHasExplicit) {
      for (let i = 0; i < result.length; i++) {
        const day = result[i];
        if (day.dayOfWeek !== virtualDow) continue;
        const dayMark = (state.markedDays || {})[day.date];
        if (dayMark === 'rest' || dayMark === 'noGame') continue; // user bye-out respected
        if (day.workout?.workoutType === 'Game') continue; // already a game
        if (IS_DEV) {
          logger.warn(
            `[resolver] Game-day LOCK overriding ${day.date} ` +
            `source=${day.source} workout="${day.workout?.name ?? 'null'}" → virtual Game`,
          );
        }
        result[i] = buildDay(
          day.date,
          day.dayOfWeek,
          today,
          createVirtualGameStub(day.date, day.dayOfWeek),
          'game',
        );
      }
    }
  }

  // ── Max-1-Game-per-week invariant ──
  // Belt-and-braces: if somehow more than one day ended up as Game, keep one
  // and downgrade the rest to empty. Priority:
  //   1. calendarGame (explicit 'game' mark OR virtual) — source === 'game'
  //   2. override (manual override with workoutType === 'Game')
  //   3. template
  // Tiebreak: first chronologically.
  const gameIndices: number[] = [];
  for (let i = 0; i < result.length; i++) {
    if (result[i].workout?.workoutType === 'Game') gameIndices.push(i);
  }
  if (gameIndices.length > 1) {
    const priorityOf = (src: ResolvedDay['source']): number => {
      if (src === 'game') return 0;
      if (src === 'manual') return 1;
      return 2;
    };
    // Pick the highest-priority game; tiebreak by earliest date (first index)
    let keepIdx = gameIndices[0];
    for (const idx of gameIndices) {
      if (priorityOf(result[idx].source) < priorityOf(result[keepIdx].source)) {
        keepIdx = idx;
      }
    }
    for (const idx of gameIndices) {
      if (idx === keepIdx) continue;
      if (IS_DEV) {
        logger.warn(
          `[resolver] Max-1-Game guard downgrading duplicate Game on ${result[idx].date} ` +
          `(source=${result[idx].source}) — keeping ${result[keepIdx].date} (source=${result[keepIdx].source})`,
        );
      }
      result[idx] = buildDay(result[idx].date, result[idx].dayOfWeek, today, null, 'none');
    }
  }

  // Final pass: apply the resolver-level injury filter to every day in
  // the week. This catches sessions added by the conditioning + recovery
  // overlays (which call buildDay directly without the wrapper). Manual
  return applyAwayPass(result, state);
}

/**
 * WHILE HE IS AWAY, THE CLUB IS NOT ON HIS WEEK — SEAT_INBOX item 30.
 *
 * **Sam, 2026-08-13, after seeing a team night and a Game Day survive a trip:**
 * *"if the person is away, consider the time they are away as building a new
 * program and their old program is gone for the time being — they won't have TT
 * commitments or games … so why should game day or TT still show up? thats
 * clunky and unprofessional"*.
 *
 * THE OTHER TWO FIXES WERE BOTH ABOUT WHAT THE WEEK *IS*: the plan stops marking
 * team days (`onboardingToCoachingInputs`) and a fixture inside the trip stops
 * anchoring it (`derivedWeekContract`). **Neither touches a week that was
 * ALREADY STORED with the club on it**, and the athlete's current week is
 * exactly that — which is why he still saw both. This is the read.
 *
 * IT IS A FILTER, NOT AN EDIT. Nothing is written: his calendar mark, his
 * accepted program and the team night all still exist and all come back the day
 * the fact expires or he clears it. What changes is what the week SHOWS while
 * the trip is live.
 */
/** A composed day name with its "Team Training" segment removed. */
function withoutTeamTrainingSegment(name: string | undefined): string {
  const parts = String(name ?? '').split(/\s+\+\s+/).map((part) => part.trim());
  const kept = parts.filter((part) => part.toLowerCase() !== 'team training');
  return kept.length > 0 ? kept.join(' + ') : String(name ?? '');
}

function applyAwayPass(days: ResolvedDay[], state: ScheduleState): ResolvedDay[] {
  const spans = (state.temporarySourceFacts ?? [])
    .filter((fact) => 'factKind' in fact && (fact as { factKind?: string }).factKind === 'schedule' &&
      (fact as { scheduleKind?: string }).scheduleKind === 'travel' &&
      (fact as { status?: string }).status === 'active' &&
      typeof (fact as { effectiveUntil?: unknown }).effectiveUntil === 'string')
    .map((fact) => ({
      from: String((fact as { effectiveFrom: string }).effectiveFrom).slice(0, 10),
      until: String((fact as { effectiveUntil: string }).effectiveUntil).slice(0, 10),
    }));
  if (spans.length === 0) return days;
  const isAway = (date: string): boolean =>
    spans.some((span) => date >= span.from && date <= span.until);
  const today = todayISOLocal();
  return days.map((day) => {
    if (!isAway(day.date)) return day;
    // A FIXTURE HE IS NOT AT IS NOT A DAY ON HIS WEEK — AND THE DAY IT LEAVES
    // BEHIND IS A REST DAY, NOT A HOLE.
    //
    // ── `'rest'`, NOT `'none'`, AND SAM NAMED THIS EXACT CELL ──
    // *"why the fuck does it read training day? it should read whatever the new
    // program is i.e. conditioning, lower body strength etc"*, looking at the
    // Saturday his game had just been taken off.
    //
    // **"Training Day" WAS THIS LINE.** `'none'` means "no workout" and
    // `dayKind` (`rules/projectVisibleWeek.ts:208`) maps every non-fixture,
    // non-`'rest'` day to `'training'`, whose signed headline is
    // *"Training Day"* — the app's word for a day that exists and holds
    // nothing. So vacating a fixture to `'none'` printed a placeholder where a
    // game used to be, on every away week, for as long as away has worked.
    //
    // WHY `'rest'` IS THE TRUE WORD AND NOT A NICER ONE. R-020 — *"yes clear
    // team training and games while away"* — says the club goes and **the
    // athlete's own sessions stay**. Nothing of his was ever on a fixture day,
    // so once the game goes the day holds nothing and is owed nothing: he is
    // not training that day. R-006 permits up to three full rest days in
    // exactly this shape of week (bye-recovery), so a rest day here is inside
    // the ruled bounds rather than an exception to them.
    //
    // ⚠ AND IT DOES **NOT** WIDEN `dayKind`'s REST/EMPTY DISTINCTION, which is
    // load-bearing: *"an empty training day and a rest day must be
    // distinguishable here"* — that conflation is what once let a deletion door
    // write a schedule fact. This says the narrower thing, at the one seam that
    // knows it: a day VACATED BY A LIVE TRIP is a rest day. A day that is empty
    // for any other reason is untouched and still reads as it did.
    //
    // STILL A FILTER, NEVER AN EDIT — same as every other line in this pass.
    // The mark, the fixture and the stored week are all intact and all return
    // when the fact lifts.
    /* ⚠ THE SUBSTITUTION IS DELETED; THE FILTER STAYS (area 3, 2026-08-19).
     *
     * `freedByTheTrip` BUILT a conditioning session — or a prehab session when
     * the builder declined — onto every day a live trip vacated. That is
     * authoring at read: content the composer never wrote, appearing on the
     * athlete's screen and countable by nothing.
     *
     * Sam's ruling that it served is intact and is NOT withdrawn: *"away has to
     * replace the work it removes, not just delete it"*. Its owner is the
     * COMPOSER, which already gets the trip — `weeklySchedulerInputs`
     * `clubInputsAfterTravel` takes the club night and the fixture out of the
     * facts the plan is built from, so the substitution can be authored in the
     * week rather than painted over it. On the rebuild list; not rebuilt here.
     *
     * WHAT REMAINS IS THE FILTER: the club's work is hidden while the athlete
     * is away, the mark and the stored week are untouched, and everything
     * returns the moment the fact lifts. */
    if (day.source === 'game' || day.indicator === 'game' ||
      day.workout?.workoutType === 'Game') {
      return buildDay(day.date, day.dayOfWeek, today, null, 'rest');
    }
    if (!day.workout) return day;
    const team = getTeamTrainingWorkoutState(day.workout);
    if (!team.hasTeamTraining) return day;
    // A day that was ONLY the club becomes a REST day — same word, same reason
    // as the fixture above, and it has to be the same or the week contradicts
    // itself: a team-only Tuesday and a vacated Saturday are both "a day whose
    // only content was the club, and the club is shut to him this week".
    // Reading one as *"Rest Day"* and the other as *"Training Day"* is the
    // clunkiness Sam named, one day over. A combined day is NOT this case — it
    // keeps its own half and loses the club's, renamed through the ONE owner of
    // that question, below.
    if (team.isTeamTrainingOnly) {
      return buildDay(day.date, day.dayOfWeek, today, null, 'rest');
    }
    return {
      ...day,
      workout: {
        ...day.workout,
        // ── THE CLUB HALF COMES OFF A COMBINED DAY, AND IT IS THE PAIR ──
        //
        // MEASURED ON A REAL SEEDED WORKOUT, not a synthetic one — that was the
        // mistake that cost two glass runs. A generated team day looks like
        // `{ name: "Team Training + Upper Pull", workoutType: "Team Training" }`
        // with THREE strength rows and NO `isTeamDay` flag and NO sections.
        // `getSessionComponents` then reads the team part from BOTH the name and
        // the type, and the strength part from the ROWS. So:
        //   name only  -> ["team_training"]              (his gym work vanishes)
        //   type only  -> ["strength","team_training"]   (nothing changes)
        //   BOTH       -> ["strength"]                   ✓
        // `getTeamTrainingWorkoutState().displayWorkoutType` cannot be used for
        // the second half: on this shape it returns "Team Training" unchanged.
        //
        // LIMIT, NAMED RATHER THAN HIDDEN: the surviving type is inferred, and a
        // club night combined with CONDITIONING rather than strength would be
        // labelled Strength. No such day exists in any seed to measure against,
        // so it is left as the honest simple rule instead of a guess with a
        // branch.
        name: withoutTeamTrainingSegment(day.workout.name),
        workoutType: (team.displayWorkoutType && team.displayWorkoutType !== 'Team Training'
          ? team.displayWorkoutType
          : 'Strength') as typeof day.workout.workoutType,
        exercises: team.renderableExercises,
      },
    };
  });
}

/**
 * Resolve a single date with conditioning context.
 *
 * Resolves the full week containing this date (for WeekLog context),
 * then returns just the target day. This ensures conditioning placement
 * considers the week's strength load, stacking guard, and weekly caps.
 */
export function resolveDateWithConditioning(
  date: string,
  state: ScheduleState,
): ResolvedDay {
  const monday = getMondayForDate(date);
  const weekDays = resolveWeekWithConditioning(monday, state);
  return weekDays.find(d => d.date === date) || resolveDate(date, state);
}

/**
 * Resolve month indicators with conditioning awareness.
 *
 * Resolves each week overlapping the month with conditioning placement,
 * then extracts indicators for dates within the month.
 */
export function resolveMonthIndicatorsWithConditioning(
  year: number,
  month: number,
  state: ScheduleState,
): Record<string, ResolvedDay['indicator']> {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const result: Record<string, ResolvedDay['indicator']> = {};

  const firstDay = toDateString(year, month, 1);
  const lastDay = toDateString(year, month, daysInMonth);
  const firstMonday = getMondayForDate(firstDay);

  // Walk week by week, resolving with conditioning
  let monday = firstMonday;
  for (let safety = 0; safety < 7; safety++) { // max 6 weeks overlap a month
    if (monday > lastDay) break;
    const weekDays = resolveWeekWithConditioning(monday, state);
    for (const day of weekDays) {
      if (day.date >= firstDay && day.date <= lastDay) {
        result[day.date] = day.indicator;
      }
    }
    monday = addDays(monday, 7);
  }

  return result;
}

/** Block bounds helper. */
export function getBlockBounds(state: ScheduleState): {
  startDate: string | null;
  endDate: string | null;
  nextBlockDate: string | null;
} {
  const { currentProgram } = state;
  if (!currentProgram) {
    return { startDate: null, endDate: null, nextBlockDate: null };
  }

  const start = currentProgram.startDate.split('T')[0];
  const end = currentProgram.endDate.split('T')[0];

  // Next block is the day after the current block ends
  const nextBlock = addDays(end, 1);

  return {
    startDate: start,
    endDate: end,
    nextBlockDate: nextBlock,
  };
}

// ─── Calendar Seeding ───

/**
 * Compute all dates within a block that fall on a given weekday.
 * Used to seed calendarStore with game dates after onboarding.
 *
 * Example: gameDay='Wednesday', block 2026-03-15 to 2026-04-05
 *   → ['2026-03-18', '2026-03-25', '2026-04-01']
 *
 * `GAME_DAY_MAP` used to live here and was a character-for-character duplicate
 * of `DOW_TO_NUM` above — two tables that could drift about how many days a
 * week has. There is one now.
 *
 * Anything that is not one of the seven days seeds nothing. That is how a
 * profile still holding the legacy `'Varies'` behaves, unchanged.
 */
export function computeGameDatesForBlock(
  gameDay: string,
  blockStartDate: string,
  blockEndDate: string,
): string[] {
  if (!isDayOfWeek(gameDay)) return [];
  const targetDow = DOW_TO_NUM[gameDay];

  const dates: string[] = [];
  const start = blockStartDate.split('T')[0];
  const end = blockEndDate.split('T')[0];

  // Walk from start to end, collecting dates that match the target weekday
  let current = start;
  for (let i = 0; i < 366; i++) { // safety cap
    if (current > end) break;
    const [y, m, d] = current.split('-').map(Number);
    const dow = new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
    if (dow === targetDow) {
      dates.push(current);
    }
    current = addDays(current, 1);
  }

  return dates;
}

/** Format a week label like "6 - 12 Apr" from a Monday date string. */
export function formatWeekLabel(mondayStr: string): string {
  const sunDate = addDays(mondayStr, 6);
  const [, mm, md] = mondayStr.split('-').map(Number);
  const [, sm, sd] = sunDate.split('-').map(Number);
  const mMon = MONTH_SHORT[mm - 1];
  const sMon = MONTH_SHORT[sm - 1];
  return mMon === sMon
    ? `${md} - ${sd} ${sMon}`
    : `${md} ${mMon} - ${sd} ${sMon}`;
}
