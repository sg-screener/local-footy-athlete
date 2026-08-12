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
  ReadinessLevel,
  DayOfWeek,
  WeekScopedWorkoutOverlay,
  LoggedWorkout,
  UserRemovalConstraint,
} from '../types/domain';
import type { CalendarDayType } from '../store/calendarStore';
import type { TemporarySourceFact } from '../rules/temporarySourceFact';
import { storedGameAnchor, isDayOfWeek } from '../rules/gameAnchor';
import { composeDaySurfaces, removalConstraintForComposedDay } from '../rules/dayPrecedence';
import { composeAcceptedEffectiveWeekSurfaces } from './liveEvaluationSurfaces';
import type { WeeklyExposureContractV2 } from '../rules/weeklyExposureContractV2';
import {
  buildDerivedSession,
  buildConditioningSession,
  isRunningBasedConditioning,
  type AthleteContext,
  DEFAULT_ATHLETE_CONTEXT,
} from './sessionBuilder';
import { composeConditioningRows, offFeetAlternative } from '../rules/conditioningSelection';
import { buildWeekLog, conditioningToWeekLogEntry } from './weekLogBuilder';
import type { WeekLog } from './conditioningRules';
import { resolveRecovery } from './recoveryRules';
import {
  applyStrengthProgression,
  buildStrengthWorkoutHistoryFromFeedback,
  buildProgressionContext,
  deriveMissedStrengthSessionsThisWeek,
  workoutHasProgressableStrengthRows,
} from './strengthProgressionIntegration';
import {
  analyzeFeedbackPatterns,
  biasConditioningReadiness,
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
  readiness: ReadinessLevel | null;
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

  /**
   * Active injury — when set, the resolver applies a tier-aware filter
   * to every resolved workout (except manual overrides, which are
   * authoritative). This means future weeks reflect the injury too,
   * not just current-week overrides.
   *
   * Type is loose (`any`) at the resolver layer to avoid a circular
   * import with coachUpdatesStore. The shape matches `InjuryState` from
   * `utils/injuryProgression.ts` — `bodyPart`, `bucket`, `severity`,
   * `status` are the fields the filter reads.
   *
   * Resolved when `status === 'active'` or `'improving'`. `null` /
   * `undefined` / `'resolved'` skip the filter (template stands).
   */
  activeInjury?: {
    bodyPart: string;
    bucket: string | null;
    severity: number;
    status: 'active' | 'improving' | 'resolved';
    rules?: string[];
    seriousSymptoms?: boolean;
    seriousSymptom?: string;
    adjustmentLevel?: 'minimal' | 'slight' | 'moderate' | 'avoid_affected' | 'training_paused';
    safeFocus?: string[];
    advice?: string[];
    /** Recent peak/previous severity — drives staged reintroduction. */
    priorSeverity?: number | null;
  } | null;
  /** Canonical episodes compose at visibleProgramReadModel; legacy aliases
   * retain this resolver pass only until migration. */
  injuryProjectionOwner?: 'accepted_episode';
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

function isLowerDominant(workout: Workout): boolean {
  const region = classifyVisibleSession(workout).strengthRegion;
  return region === 'lower' || region === 'full_body';
}

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

/**
 * Returns true when a workout is a protected core exposure that the resolver
 * must never remove or replace. Such sessions may only be intensity-modified,
 * exercise-adjusted, or annotated.
 *
 * A session is protected when:
 *   1. It has tier === 'core'
 *   2. Its name matches a required exposure pattern (lower, push, pull, upper, balanced, full body)
 *
 * Game stubs (workoutType === 'Game') are NOT protected by this guard — they
 * follow their own calendar-mark resolution path.
 */
export function isProtectedCoreExposure(workout: Workout | null): boolean {
  if (!workout) return false;
  if (workout.sessionTier !== 'core') return false;
  if (workout.workoutType === 'Game') return false;
  const name = workout.name.toLowerCase();
  return REQUIRED_EXPOSURE_PATTERNS.some(p => name.includes(p));
}

/**
 * Shared guard: can this session be replaced by the resolver?
 *
 * Returns false (replacement blocked) when:
 *   - The session is a protected core exposure (see isProtectedCoreExposure)
 *   - AND it came from 'template' or 'manual' source (engine-planned or coach-authored)
 *
 * Returns true (replacement allowed) when:
 *   - The session is derived (source: gameProximity, conditioning, recovery)
 *   - OR it's non-core / non-exposure (prehab, accessories, arms/pump)
 *   - OR workout is null
 *
 * @param workout  The workout that would be replaced
 * @param source   The ResolvedDay source of the session
 * @param context  Descriptive label for dev logging (e.g. 'G+1 recovery', 'fatigue-stacking guard')
 * @param date     ISO date string for dev logging
 */
export function canReplaceSession(
  workout: Workout | null,
  source: ResolvedDay['source'],
  context: string,
  date: string,
): boolean {
  if (!workout) return true;

  // The athlete's own placement outranks every replacement this guard governs,
  // and it is asked FIRST because it does not depend on which pass happened to
  // put the session on the day — a placed session can render from any source.
  if (!resolverMayDisplace(workout)) {
    if (IS_DEV) {
      logger.debug(
        `[resolver] BLOCKED replacement of athlete-placed "${workout.name}" on ${date}`
        + ` — context: ${context}`
      );
    }
    return false;
  }

  // Only protect template (engine-planned) and manual (coach-authored) sessions
  if (source !== 'template' && source !== 'manual') return true;

  if (isProtectedCoreExposure(workout)) {
    if (IS_DEV) {
      logger.debug(
        `[resolver] BLOCKED replacement of protected core "${workout.name}" ` +
        `(tier=${workout.sessionTier}, source=${source}) on ${date} — context: ${context}`
      );
    }
    return false;
  }

  return true;
}

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

/** Extract all game date strings from markedDays. */
function getAllGameDates(markedDays: Record<string, CalendarDayType>): Set<string> {
  const games = new Set<string>();
  for (const [date, type] of Object.entries(markedDays)) {
    if (type === 'game') games.add(date);
  }
  return games;
}

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
  return effectiveGameDatesAround({
    markedDays: state.markedDays || {},
    usualGameDay: state.usualGameDay,
    gameDay: state.gameDay,
    seasonPhase: state.seasonPhase,
    centerDate,
    windowDays,
  });
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

/**
 * Check if a nearby game modifies this session via proximity rules.
 * Returns a modified Workout if so, null if the template is fine as-is.
 *
 * Rules:
 *   G+1 (day after game)  → Recovery Session (flush, mobilise, restore)
 *   G-1 (day before game) → Gunshow (always — low-fatigue upper body pump)
 *   G-2 (2 days before)   → moderate lower-dominant sessions
 *
 * G-1 defaults to Gunshow but preserves recovery and rest sessions
 * (for fatigue/injury flexibility). This ensures the pre-game session
 * follows the game dynamically when the game date moves.
 */
function applyGameProximity(
  date: string,
  templateWorkout: Workout | null,
  gameDates: Set<string>,
  microcycleId: string,
  athlete: AthleteContext,
  explicitGameDates: Set<string> = new Set(),
): Workout | null {
  const fixtureDependency = (args: {
    origin: 'fixture_recovery' | 'fixture_proximity';
    fixtureDate: string;
    relation: 'g_plus_1' | 'g_minus_1' | 'g_minus_2';
    creditMetric: 'safe_session_content' | 'hard_day_distribution';
  }) => {
    // ── LR-27: A FILLER HAS NOTHING UNDERNEATH IT TO RESTORE ─────────────────
    //
    // MEASURED 2026-08-05 (stage 2 priority B, `LR27_PROBE=1` on the deep
    // walker): in every acted-world invocation the "displaced session" snapshot
    // was a copy of THE VERY WORKOUT CARRYING IT — carrier and snapshot shared
    // one id (`derived-arms_pump-…:week-overlay:…`), and the record carried no
    // `sourcePlanEntryId` at all. That is the doubling, caught in the act.
    //
    // The mechanism: this resolver derives a G-1 Gunshow / G+1 flush over the
    // day, `materialiseVisibleSystemWork` persists it into the week overlay,
    // and on the NEXT resolve that stored filler arrives back here as
    // `templateWorkout`. `resolverMayDisplace` says only "the athlete did not
    // place it", which is true, so the filler was snapshotted into its own
    // successor — provenance depth +1, payload ×2, every launch, on disk.
    //
    // A resolver-owned filler is not an accepted session. There is no
    // prescription underneath it that a returning fixture must give back; the
    // resolver simply stops synthesising it. So the dependency records the
    // reference and NO snapshot, and the recursion becomes structurally
    // unrepresentable rather than bounded by a cap.
    //
    // `isResolverOwnedDerivedSession` is the existing owner of exactly this
    // question (system-authored game-proximity provenance + no backing plan
    // entry) — asked here rather than re-answered, so this site cannot drift
    // from the five others that already consult it.
    const displaced = isResolverOwnedDerivedSession(templateWorkout)
      ? null
      : templateWorkout;
    const snapshot = (): Workout | null => displaced
      ? JSON.parse(JSON.stringify(displaced)) as Workout
      : null;
    return createDerivedSessionProvenance({
      origin: args.origin,
      scope: 'session',
      triggerSignature: `fixture:${args.fixtureDate}:${args.relation}`,
      credit: { metric: args.creditMetric, amount: 1 },
      originatingDate: date,
      originatingFixtureDate: args.fixtureDate,
      sourcePlanEntryId: displaced?.planEntryId ?? null,
      validWhile: [{ kind: 'fixture_present', fixtureDate: args.fixtureDate }],
      invalidWhen: [{ kind: 'fixture_absent', fixtureDate: args.fixtureDate }],
      dependency: {
        kind: 'fixture_to_session',
        source: {
          date: args.fixtureDate,
          weekStart: getMondayForDate(args.fixtureDate),
        },
        target: {
          date,
          weekStart: getMondayForDate(date),
        },
        crossesWeekBoundary: getMondayForDate(args.fixtureDate) !== getMondayForDate(date),
        displacedSession: {
          targetDate: date,
          sourcePlanEntryId: displaced?.planEntryId ?? null,
          workout: snapshot(),
        },
        restoration: {
          targetDate: date,
          sourcePlanEntryId: displaced?.planEntryId ?? null,
          workout: snapshot(),
        },
      },
    });
  };

  // G+1: the day after a game.
  //
  // AN EMPTY G+1 IS REST, NOT RECOVERY (Sam's charter, 2026-07-30). This branch
  // used to read "even if no template workout" and materialise a recovery
  // session onto a day nothing was planned for. The Bible's anchor is
  // `g_plus_1_rest_or_recovery` — a DISJUNCTION the app was resolving on the
  // athlete's behalf, which is the whole finding of the session-type survey.
  //
  // AND IT MADE THE DELETION DOOR LIE. Once the generator stopped filling spare
  // days (the nine deleted recovery sites), G+1 had no template, so this derived
  // one from nothing — and an athlete tapping Remove on that session got
  // `visible_change_unverified`, because there was no stored thing to remove and
  // the day re-derived identically. `athleteSessionDeletionTests` regression 6
  // caught it on the Sunday-fixture scenario. A day whose content exists only as
  // a derivation cannot be edited by a door that edits stored decisions.
  //
  // What is NOT changed here: when a real planned session sits on G+1, the
  // proximity rule still applies. Replacing planned work with recovery is a
  // second, heavier question — it protects the athlete from training the day
  // after a game — and it is declared charter debt rather than settled in
  // passing. See `rules/sessionTypeCharter.ts`, recovery/placement.
  const previousDate = shiftDate(date, -1);
  if (gameDates.has(previousDate) && templateWorkout) {
    if (templateWorkout.sessionTier !== 'recovery' && templateWorkout.workoutType !== 'Game') {
      // GUARD: never replace protected core exposure for virtual/recurring
      // proximity. Explicit calendar game/practice-match marks are different:
      // Bible G+1 wins, so the core session is dropped rather than made up.
      //
      // AND never replace what the athlete put here. Sam's law is not about
      // which side of the fixture the day falls on — the day after a game was
      // eating athlete-placed sessions for exactly as long as the day before
      // was, it just had no device report against it.
      if (!resolverMayDisplace(templateWorkout) ||
        (isProtectedCoreExposure(templateWorkout) && !explicitGameDates.has(previousDate))) {
        if (IS_DEV) {
          logger.debug(
            `[resolver] BLOCKED G+1 recovery replacing protected core "${templateWorkout!.name}" on ${date}`
          );
        }
      } else {
        // THE DELETED TYPE IS NOT MATERIALISED (2026-08-01, device-pass
        // fail 3). This used to build a `recovery` session named "Post-game
        // recovery" — recovery is charter-deleted, and its authored contents
        // ARE the mobility flows (the charter's own row: "the 10 mobility
        // flow templates"). The Bible's G+1 protection stands — planned
        // displaceable work is still replaced with easy movement the day
        // after a game — but what lands is a MOBILITY session that names
        // itself, not a type no door offers. The planned-work-on-G+1
        // disjunction itself stays the charter's declared debt; this changes
        // which WORD and which authored composition the protection uses.
        const flush = buildDerivedSession(
          'mobility',
          date,
          microcycleId,
          'Post-game',
          athlete,
        );
        return {
          ...flush,
          derivedSessionProvenance: [fixtureDependency({
            origin: 'fixture_recovery',
            fixtureDate: previousDate,
            relation: 'g_plus_1',
            creditMetric: 'safe_session_content',
          })],
        };
      }
    }
  }

  // G-1: day before a game → Gunshow (light upper-body pump)
  // BUT preserve recovery sessions and rest days (fatigue/injury flexibility)
  const nextDate = shiftDate(date, 1);
  if (gameDates.has(nextDate)) {
    // Keep recovery as-is
    if (templateWorkout?.sessionTier === 'recovery' || templateWorkout?.workoutType === 'Recovery') {
      return null;
    }
    // A canonical explicit-rest stub is a final accepted-week decision. Keep
    // it empty so optional G-1 gunshow work cannot erase the true-rest floor.
    if (templateWorkout?.workoutType === 'Rest' && templateWorkout.exercises.length === 0) {
      return null;
    }
    // Keep game as-is (shouldn't happen but guard)
    if (templateWorkout?.workoutType === 'Game') {
      return null;
    }
    // ── WHO OWNS THE DAY BEFORE A FIXTURE ────────────────────────────────
    //
    // SAM'S LAW (2026-07-28), extended by his rulings of 2026-07-30 (#4, #5):
    // athlete-placed content outranks derived filler, and the G-1 ask-flow is
    // the ONLY door onto this day. So there is exactly one question here, and
    // the placement stamp answers it: did the athlete put this here?
    //
    // Two things used to answer it alongside the stamp, and both have been
    // retired because neither is information about ownership:
    //
    //   * `!explicitGameDates.has(nextDate)` — the STORAGE FORM of the fixture.
    //     An identical week behaved one way on a usual Saturday and another on
    //     an explicit practice match, so whether a committed swap survived
    //     depended on how the fixture happened to be recorded (ruling #5).
    //   * `isProtectedCoreExposure(templateWorkout)` — the session's NAME and
    //     TIER. That is `applyGameProximity` re-deciding ownership from a
    //     heuristic, which ruling #4 forbids: it consults the stamp, it does
    //     not re-decide. It also silently made G-1 non-light whenever
    //     generation happened to plan a core exposure there, which is the
    //     opposite of the Bible rule it was written next to.
    //
    // Required exposure displaced from G-1 is not lost — §18 owns the week's
    // counts and relocates it, which is the pipeline doing its job rather than
    // a render-time heuristic pre-empting it.
    if (!resolverMayDisplace(templateWorkout)) {
      return null;
    }
    // Everything the athlete did not place → Gunshow (derivedType 'arms_pump')
    return {
      ...buildDerivedSession('arms_pump', date, microcycleId, 'Pre-game day', athlete),
      derivedSessionProvenance: [fixtureDependency({
        origin: 'fixture_proximity',
        fixtureDate: nextDate,
        relation: 'g_minus_1',
        creditMetric: 'safe_session_content',
      })],
    };
  }

  if (!templateWorkout) return null;

  // G-2: 2 days before a game → moderate lower-dominant sessions
  if (gameDates.has(shiftDate(date, 2))) {
    if (isLowerDominant(templateWorkout) && templateWorkout.sessionTier === 'core') {
      const fixtureDate = shiftDate(date, 2);
      return {
        ...templateWorkout,
        id: `derived-nearGame-${date}`,
        intensity: 'Moderate',
        description: `${templateWorkout.description} (48h to game - moderate load)`,
        exercises: templateWorkout.exercises.map(e => ({
          ...e,
          // Preserve nested exercise sub-object for display
          exercise: e.exercise || { id: e.exerciseId, name: e.notes || `Exercise ${e.exerciseOrder}`, description: '' } as Exercise,
        })),
        derivedSessionProvenance: [
          ...(templateWorkout.derivedSessionProvenance ?? []),
          fixtureDependency({
            origin: 'fixture_proximity',
            fixtureDate,
            relation: 'g_minus_2',
            creditMetric: 'hard_day_distribution',
          }),
        ],
        updatedAt: new Date().toISOString(),
      };
    }
  }

  return null; // no proximity effect
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

/**
 * §18 AS TIER 4 OF THE DERIVATION — legs (ii) and (iii) at the deriver.
 *
 * Leg (iii): the week's contract is DERIVED from current fixture facts here,
 * not read stale off the overlay. Leg (ii): §18 then runs as TIER 4 of the
 * ordering (`rules/dayPrecedence.ts:19`) — a projection with the resolver
 * IDENTITY (`resolveVisibleWorkouts: (w) => [...w]`, which is also what stops
 * the gateway re-entering this resolver), output never persisted.
 *
 * The gateway imports this module, so the import is lazy by construction.
 */
function section18TierFour(args: {
  days: ResolvedDay[];
  storedContract: WeeklyExposureContractV2 | null;
  /** The week's AUTHORED plan — the repair search's relocation templates. */
  strengthTemplates: readonly Workout[];
  weekStart: string;
  today: string;
  state: ScheduleState;
}): ResolvedDay[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const derived = require('../rules/derivedWeekContract') as
    typeof import('../rules/derivedWeekContract');
  if (!args.storedContract) return args.days;
  const profile = args.state.athleteContext?.onboardingData ?? null;
  const contract = derived.deriveWeekContract({
    contract: args.storedContract,
    weekStart: args.weekStart,
    profile,
    markedDays: args.state.markedDays,
    userRemovalConstraints: args.state.userRemovalConstraints,
    workouts: args.days.flatMap((day) => day.workout ? [day.workout] : []),
    // Leg (v) read side, install site 2 of 3 — the same facts, the same owner.
    temporarySourceFacts: args.state.temporarySourceFacts,
  });
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const gateway = require('../rules/section18AcceptedWeekGateway') as
    typeof import('../rules/section18AcceptedWeekGateway');
  let result;
  try {
    result = gateway.runSection18AcceptedWeekGateway({
      contract,
      workouts: args.days.flatMap((day) => day.workout ? [day.workout] : []),
      weekStart: args.weekStart,
      profile,
      // THE DERIVER IS JUDGED AGAINST THE STATE IT IS DERIVING FROM
      // (`docs/SURFACES_CONTEXT_RULING_2026-08-06.md`). Tier 4 at read has no
      // accepted surfaces of its own — it is producing the week those surfaces
      // would describe — so the only thing it carries is the athlete's
      // decisions, and it says so rather than leaving the field absent.
      // Composed through the ONE composer, and it says both things: the
      // removals still to APPLY (blanked above this line by the gateway, which
      // has already applied them) and the RECORD of the decisions, which is
      // what the repair search's stand-down asks
      // (`docs/REMOVAL_RECORD_SPLIT_RULING_2026-08-06.md`).
      surfaces: composeAcceptedEffectiveWeekSurfaces({
        currentProgram: null,
        removalDecisions: args.state.removalDecisions ?? [],
        applyOnly: args.state.userRemovalConstraints ?? [],
      }),
      strengthTemplates: args.strengthTemplates,
      // ── ROOT 1b (sixteenth pass): the exact-date fixture
      // authority, derived from the same facts the host already carries
      // (profile + markedDays), the `governedFromISO` treatment. Without it
      // the expiry guard's `fixture_absent` check degrades to day-of-week in
      // THIS week's contract — structurally false for cross-week
      // dependencies — and tier 4 at read expires every fixture-linked
      // derived session the write path deliberately preserved.
      activeFixtureDates: profile
        ? (require('../rules/rollingHorizonRepair') as
            typeof import('../rules/rollingHorizonRepair'))
            .effectiveFixtureDatesForWeeks({
              profile,
              markedDays: args.state.markedDays ?? {},
              weekStarts: [
                (require('./programBlockState') as
                  typeof import('./programBlockState'))
                  .addDaysISO(args.weekStart, -7),
                args.weekStart,
                (require('./programBlockState') as
                  typeof import('./programBlockState'))
                  .addDaysISO(args.weekStart, 7),
              ],
            })
        : undefined,
      // THE PROJECTION IDENTITY the ruling specifies.
      resolveVisibleWorkouts: (workouts) => [...workouts],
    });
  } catch {
    // Tier 4 at read is a projection: a week it cannot accept is reported by
    // the accepted stack, never by blanking the athlete's screen.
    return args.days;
  }
  // DIAGNOSTIC ONLY — see `lastTierFourDerivation`'s header. The contract the
  // visible week answers to is never stored, so this is the only place the
  // lawfulness proof can read it from.
  derived.lastTierFourDerivation.weekStart = args.weekStart;
  derived.lastTierFourDerivation.contract = result.contract;
  derived.lastTierFourDerivation.status = result.status;
  derived.lastTierFourDerivation.repairs = result.repairs.map((repair) => repair.kind);
  derived.lastTierFourDerivation.blockingViolations = result.evaluation.blockingViolations
    .map((finding) => `${finding.code}:${finding.domain}`);
  const byDay = new Map<number, Workout>();
  for (const workout of result.visibleWorkouts) byDay.set(workout.dayOfWeek, workout);
  return args.days.map((day) => {
    // TIER 4 RUNS LAST; LAST IS NOT HIGHEST.
    // Tier 1 — the emptying decision — outranks it, so a day already emptied by
    // decision is left exactly as it is rather than having a typed Rest
    // installed onto it.
    if (!day.workout) return day;
    const conformed = byDay.get(day.dayOfWeek);
    if (!conformed) return buildDay(day.date, day.dayOfWeek, args.today, null, 'rest');
    return conformed === day.workout
      ? day
      : buildDay(day.date, day.dayOfWeek, args.today, conformed, day.source);
  });
}

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

/**
 * Resolver-level injury filter pass — applied AFTER priority
 * resolution + after conditioning / recovery layering. Walks the full
 * week and rewrites each day's workout through `applyInjuryFilterToWorkout`
 * when an active injury is in state.
 *
 * Manual overrides (source='manual') are SKIPPED — they're already the
 * authoritative state for that date and contain explicit coach
 * decisions; double-applying the filter would compound modifications.
 *
 * Game stubs and rest days are also skipped — neither has exercises to
 * filter and the filter is bucket-relevance-only.
 */
function applyInjuryFilterPass(
  days: ResolvedDay[],
  state: ScheduleState,
): ResolvedDay[] {
  if (!state.activeInjury) return days;
  if (state.activeInjury.status === 'resolved') return days;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { applyInjuryFilterToWorkout } = require('./injuryWorkoutFilter');
  return days.map((d) => {
    if (!d.workout) return d;
    if (d.source === 'manual' || d.source === 'game' || d.source === 'rest') return d;
    const filtered = applyInjuryFilterToWorkout(d.workout, state.activeInjury);
    if (filtered === d.workout) return d;
    return { ...d, workout: filtered, indicator: workoutToIndicator(filtered, d.source) };
  });
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
  //   - seasonPhase === 'In-season', AND
  //   - profile has an effective game day (usualGameDay || gameDay), AND
  //   - this day itself is NOT marked 'noGame' (explicit bye), AND
  //   - no other day in this Mon–Sun week has an explicit 'game' mark
  //     (week-level suppression when user has moved the game).
  //
  // This runs BEFORE the freed-game-slot logic so Saturday is never treated
  // as empty when virtual should own it.
  const effectiveGameDay = resolveEffectiveGameDay(state.usualGameDay, state.gameDay);
  const virtualEnabled = state.seasonPhase === 'In-season' && effectiveGameDay !== undefined;
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
  if (!constrained && composed.owner === 'date_override' && composed.workout) {
    return buildDay(date, dow, today, composed.workout, 'manual');
  }

  // ── No block data → nothing to resolve ──
  if (!inBlock || (!currentMicrocycle && !overlayTemplate.hasOverlay)) {
    return buildDay(date, dow, today, null, 'none');
  }

  const templateWorkout = constrained ? constrained.workout : composed.workout;
  const templateMicrocycleId = overlayTemplate.overlay?.id ?? currentMicrocycle?.id ?? 'derived';

  // ── Priority 4: Game proximity rules (G+1 recovery, G-1 Gunshow, G-2 moderate) ──
  // Evaluated BEFORE freed-game-slot so that a moved game's G+1 takes priority
  // over a template game that no longer has a calendar mark.
  // gameDates includes VIRTUAL games (from profile.usualGameDay) so proximity
  // fires on Fri (G-1) + Thu (G-2) + Sun (G+1) even when Saturday is virtual
  // and not explicitly marked in calendarStore.
  const gameDates = getEffectiveGameDates(state, date);
  const explicitGameDates = getAllGameDates(markedDays || {});
  const effectiveTemplate = (templateWorkout?.workoutType === 'Game' && !mark)
    ? null  // template game without calendar mark → treat as empty for proximity
    : templateWorkout;
  const proximityResult = applyGameProximity(
    date,
    effectiveTemplate,
    gameDates,
    templateMicrocycleId,
    state.athleteContext,
    explicitGameDates,
  );
  if (proximityResult) {
    logger.debug(`[RESOLVER-PROXIMITY] date=${date} dow=${dow} → ${proximityResult.name} (tier=${proximityResult.sessionTier})`);
    return buildDay(date, dow, today, proximityResult, 'gameProximity');
  }

  // ── Priority 5: Template says game but calendar doesn't (freed slot) ──
  // Only reached if game proximity didn't claim this date.
  // If other games still exist THIS WEEK → low-priority prehab (athlete has game fatigue).
  // If NO games this week (bye / game removed) → promote to core training slot.
  // This prevents the freed game day from being wasted on prehab when the athlete
  // has full recovery capacity and should use the day for real training.
  //
  // IMPORTANT: gameDates includes ALL marked games across the entire block.
  // We must filter to only games within the same Mon–Sun week as `date`.
  if (templateWorkout?.workoutType === 'Game' && !mark) {
    const mondayOfWeek = getMondayForDate(date);
    const sundayOfWeek = addDays(mondayOfWeek, 6);
    let gamesThisWeek = 0;
    for (const gd of gameDates) {
      if (gd >= mondayOfWeek && gd <= sundayOfWeek) {
        gamesThisWeek++;
      }
    }
    logger.debug(`[RESOLVER-FREED-GAME] date=${date} dow=${dow} mondayOfWeek=${mondayOfWeek} gamesThisWeek=${gamesThisWeek} totalGameDates=${gameDates.size}`);
    if (gamesThisWeek > 0) {
      // Other games exist THIS WEEK — athlete still has game fatigue. Light prehab is appropriate.
      logger.debug(`[RESOLVER-FREED-GAME] other games remain this week -> returning prehab`);
      return buildDay(
        date, dow, today,
        buildDerivedSession('prehab_accessories', date, templateMicrocycleId, 'Freed game slot', state.athleteContext),
        'gameProximity',
      );
    } else {
      // No games this week — freed capacity. Return null workout so
      // conditioning pass (Pass 2) can fill this as the primary training slot.
      // Source 'none' lets conditioning/recovery passes claim it.
      logger.debug(`[RESOLVER-FREED-GAME] no games this week -> returning none (freed for conditioning)`);
      return buildDay(date, dow, today, null, 'none');
    }
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

  // ── Priority 6a: Recovery template → replace with derived pool session ──
  // AI-generated recovery workouts lack structured prescription fields (prescriptionType,
  // perSide, restSeconds). Replace them with deterministic pool-built sessions so every
  // recovery exercise has proper sets/duration/reps for the structured renderer.
  // A recovery session the ATHLETE placed is not an AI-generated one missing
  // its prescription fields — it is the session they chose, and rebuilding it
  // from the pool replaces their content with the app's while keeping the
  // shape close enough that nobody notices.
  if (
    templateWorkout &&
    resolverMayDisplace(templateWorkout) &&
    (templateWorkout.sessionTier === 'recovery' || templateWorkout.workoutType === 'Recovery') &&
    // A TYPED COMPOSED OPTIONAL SESSION IS NOT A LEGACY TEMPLATE (2026-08-01).
    // This branch exists because AI-generated recovery templates lack
    // structured prescription fields; a session `buildDerivedSession` composed
    // (a mobility top-up, an athlete's Mobility add) already has them, and
    // rebuilding it re-rolled its composition on every read — worse, the
    // rebuilt id collided with the stored top-up's id in the bake-back pass,
    // so a `sessionTier: 'optional'` top-up was silently re-stored at tier
    // `recovery` (found by the absolutely-cooked bible cell). The typed marker
    // is the boundary: carried, never inferred, and never rebuilt over.
    !templateWorkout.composedOptionalKind
  ) {
    // Recovery-tier templates are LEGACY ingress now (generation stopped
    // minting the athlete-visible 'Recovery Session'; the allocator's safety
    // demotions materialise as Mobility). Whatever recovery-shaped template
    // still arrives is rebuilt as the thing its contents are — a mobility
    // flow that names itself — never as the charter-deleted type's word.
    return buildDay(
      date, dow, today,
      buildDerivedSession('mobility', date, templateMicrocycleId, 'Scheduled mobility', state.athleteContext),
      'template',
    );
  }

  // ── Priority 6b: Unmodified template ──
  return buildDay(date, dow, today, templateWorkout, templateWorkout ? 'template' : 'none');
}

/**
 * Public base resolver. Temporary injury facts are intentionally not applied
 * here: the visible-program gate composes them once for every card/detail
 * surface, including manual overrides. Keeping this resolver on the accepted
 * base prevents a second injury owner and lets later athlete edits survive.
 */
export function resolveDate(date: string, state: ScheduleState): ResolvedDay {
  const day = _resolveDateRaw(date, state);
  if (!state.activeInjury || state.injuryProjectionOwner === 'accepted_episode') return day;
  const [legacyProjected] = applyInjuryFilterPass([day], state);
  return legacyProjected;
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
        state.readiness || 'medium',
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

  // ── Availability hard-filter ──
  // Build a Set of allowed day-of-week numbers for O(1) lookup.
  // If availableDayNumbers is undefined/empty, all days are allowed.
  const availableSet: Set<number> | null =
    state.availableDayNumbers && state.availableDayNumbers.length > 0
      ? new Set(state.availableDayNumbers)
      : null;
  const isDayAvailable = (dayOfWeek: number): boolean =>
    availableSet === null || availableSet.has(dayOfWeek);

  // Extract all game dates from markedDays (full calendar, not just this week).
  // Augments with VIRTUAL games around this week so conditioning + recovery
  // placement see Saturday as a game even when it's not in calendarStore.
  const gameDates: string[] = [];
  {
    const effSet = getEffectiveGameDates(state, mondayStr);
    effSet.forEach((d) => gameDates.push(d));
  }

  // Determine block bounds for in-block check
  const blockStart = state.currentProgram?.startDate?.split('T')[0] || null;
  const blockEnd = state.currentProgram?.endDate?.split('T')[0] || null;

  // Weekly feedback context for the conditioning / recovery passes below.
  const feedbackMap = state.sessionFeedback || {};
  const allFeedbackSorted: SessionFeedback[] = Object.values(feedbackMap)
    .sort((a: SessionFeedback, b: SessionFeedback) => b.dateStr.localeCompare(a.dateStr));
  const weekPatternSummary = analyzeFeedbackPatterns(
    allFeedbackSorted.filter((fb: SessionFeedback) => fb.dateStr < baseDays[0]?.date)
  );

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

  // ── Pre-game fatigue-stacking guard ──
  // After Pass 1, game proximity may have assigned G-1 as Gunshow.
  // If G-2 is ALSO a Gunshow / arms-pump-ish derived game-proximity session
  // (NOT a template core session), the athlete gets redundant upper-body
  // stress in the 48h pre-game window.
  //
  // CRITICAL INVARIANT: Template core sessions on G-2 are NEVER replaced.
  // The coaching engine specifically places a moderate push/upper session
  // at G-2. That is the intended design — Upper Push on G-2 + Gunshow
  // on G-1 is the correct fatigue wave. Only derived/proximity duplicates
  // should be downgraded (e.g. two Gunshow sessions from adjacent games).
  for (let i = 0; i < result.length; i++) {
    const day = result[i];
    // Find G-1 days (Gunshow placed by game proximity)
    if (
      day.source === 'gameProximity' &&
      day.workout &&
      day.workout.name === 'Gunshow'
    ) {
      // G-2 is the day before G-1 in the result array
      const g2Idx = i - 1;
      if (g2Idx < 0) continue;
      const g2Day = result[g2Idx];
      if (!g2Day.workout) continue;

      // Shared guard: block replacement of any protected core exposure
      if (!canReplaceSession(g2Day.workout, g2Day.source, 'fatigue-stacking guard G-2→prehab', g2Day.date)) {
        continue;
      }

      // Only downgrade derived/proximity duplicates (e.g. two Gunshow
      // from adjacent games) or non-core upper sessions.
      const isArmsPump = g2Day.workout.name === 'Gunshow';
      const isDerivedUpper = g2Day.source === 'gameProximity' &&
        (g2Day.workout.name.toLowerCase().includes('gunshow') ||
         g2Day.workout.name.toLowerCase().includes('arm') ||
         g2Day.workout.name.toLowerCase().includes('pump'));

      if (isArmsPump || isDerivedUpper) {
        // Downgrade derived G-2 to Prehab & Accessories (low-fatigue, no upper bias)
        result[g2Idx] = buildDay(
          g2Day.date,
          g2Day.dayOfWeek,
          today,
          buildDerivedSession(
            'prehab_accessories',
            g2Day.date,
            microcycleIdForDate(g2Day.date, state),
            'Pre-game window - avoiding upper-body stacking with G-1',
            state.athleteContext,
          ),
          'gameProximity',
        );
      }
    }
  }

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
    return applyAwayPass(section18TierFour({
      days: rested,
      storedContract: section18StoredContract,
      // The AUTHORED week, which is what the publisher relocated from. A
      // session the fixture displaced is gone from `rested` by definition.
      strengthTemplates: section18Microcycle?.workouts ?? [],
      weekStart: mondayStr,
      today,
      state,
    }), state);
  }

  // Pass 2: progressive conditioning placement
  // Apply feedback pattern bias to conditioning readiness (one-step max)
  const conditioningReadiness = biasConditioningReadiness(
    state.readiness || 'medium',
    weekPatternSummary,
  );
  const conditioningPlaced: WeekLog['sessions'] = [];
  // The bye mode is the CONTRACT's, not this pass's. Conditioning used to infer
  // "fresh" from readiness and injury and cap the week's tiers on the answer,
  // which is capacity setting structure (Sam's readiness law, 2026-07-28).
  //
  // There is no `weekKind === 'deload'` fallback here (Sam's bye-mode ruling,
  // 2026-07-29): the athlete's answer is the only producer of the recovery mode,
  // and the accepted contract is where that answer has already landed. An
  // unanswered bye is a build bye.
  const byeMode: WeekLog['byeMode'] =
    section18Microcycle?.exposureContract?.identity.mode === 'in_season_bye_recovery'
      ? 'recovery'
      : 'build';

  // ── In-season primary conditioning cap ──
  // For in-season weeks (including bye/freed-game weeks), limit the
  // conditioning pass to ONE primary (A or B-tier) placement.
  // After that primary slot is filled, remaining empty days should fall
  // through to Pass 3 (recovery) rather than stacking back-to-back
  // conditioning sessions on the weekend.
  // Pre-season and off-season allow multiple primary conditioning sessions.
  const inSeasonPrimaryCap = state.seasonPhase === 'In-season' ? 1 : Infinity;
  let primaryConditioningCount = 0;

  // ── Running days the app may PROGRAM ──
  // THE RUNNING LAW (§17.B, Sam 2026-07-27): 2 minimum, 3 preferred, 4 hard max.
  // This is the PROGRAMMING half — 3 by default, 4 only under the two authored
  // conditions. It is deliberately NOT the validator's hard max: an athlete may
  // add a 4th (or the app may program one here) and that stays perfectly valid.
  // Seeded from anchors that already exist after base resolution; team training,
  // games and practice matches all count toward it.
  //
  // At the limit, further running sessions convert to off-feet modalities
  // (bike/row/ski) while preserving the conditioning stimulus — same session
  // intent, different modality.
  //
  // Condition (a) is "no equipment — off-leg conditioning isn't available", so
  // it turns on whether the athlete has a machine to do that off-leg work ON.
  // Bodyweight/bands alone cannot absorb a converted running session, which is
  // exactly why the law lets the 4th day stay on feet.
  const hasOffLegEquipment = (state.athleteContext?.equipmentTags ?? []).some(
    (tag) => tag === 'bike_or_treadmill' || tag === 'machine',
  );
  const runningAllowance = programmedRunningDayAllowance({
    phase: state.seasonPhase ?? 'Pre-season',
    hasEquipment: hasOffLegEquipment,
  });
  const MAX_RUNNING_SESSIONS = runningAllowance.days;
  if (runningAllowance.reason) {
    logger.debug(
      `[RUNNING-LAW] 4th running day unlocked: ${runningAllowance.reason} `
      + `(phase=${state.seasonPhase}, offLegEquipment=${hasOffLegEquipment})`,
    );
  }
  let runningSessionCount = countWeeklyExposures(
    result.map((day) => ({ date: day.date, workout: day.workout })),
  ).runningExposures;

  // ── Pre-season team-day guard (safety belt) ──
  // In pre-season, team training days are FIELD-LOAD ANCHORS. Even if the
  // AI/engine did not place a workout on a team day (or the team workout was
  // stripped somehow), the conditioning pass must NEVER add a standalone
  // conditioning session on a known team training day. The engine already
  // enforces this upstream; this is a belt-and-braces guard at placement time.
  const DAY_NAME_TO_NUM: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  };
  const preSeasonTeamDayNums: Set<number> = new Set(
    state.seasonPhase === 'Pre-season'
      ? (state.athleteContext?.onboardingData?.teamTrainingDays || [])
          .map((n) => DAY_NAME_TO_NUM[n])
          .filter((n): n is number => typeof n === 'number')
      : [],
  );
  // Note: sprint-adjacency to team days is already enforced by the coaching
  // engine's H-PRE-3 constraint and scorer. The resolver does not need to
  // re-enforce it here because the AI's weeklyPlan already reflects the
  // engine's category choices.

  for (let i = 0; i < result.length; i++) {
    const day = result[i];

    // Only place conditioning on truly empty days within the active block
    if (day.workout !== null) continue;
    if (day.source !== 'none') continue;
    if (!blockStart || !blockEnd) continue;
    if (day.date < blockStart || day.date > blockEnd) continue;

    // HARD CONSTRAINT: never place sessions on unavailable days
    if (!isDayAvailable(day.dayOfWeek)) continue;

    // PRE-SEASON HARD GUARD: never place standalone conditioning on a team
    // training day. Team training IS the conditioning for that day.
    if (preSeasonTeamDayNums.has(day.dayOfWeek)) {
      logger.debug(`[PRE-SEASON-GUARD] ${day.date} (dayOfWeek=${day.dayOfWeek}): skipping conditioning — team training day.`);
      continue;
    }

    // In-season: skip if we've already placed the primary conditioning session.
    // Tier C (flush/recovery conditioning) is still allowed beyond the cap.
    if (primaryConditioningCount >= inSeasonPrimaryCap && state.seasonPhase === 'In-season') {
      // Allow only Tier C (recovery-level conditioning) beyond the cap.
      // For simplicity, skip entirely — Pass 3 (recovery) will fill this day
      // with a proper recovery session instead.
      continue;
    }

    // Build WeekLog with accumulated placements (biased readiness)
    const weekLog = buildWeekLog(
      baseDays,
      state.markedDays || {},
      conditioningReadiness,
      conditioningPlaced,
      byeMode,
    );

    // Try conditioning placement
    const condWorkout = buildConditioningSession(
      day.date,
      gameDates,
      state.athleteContext,
      state.seasonPhase,
      weekLog,
      microcycleIdForDate(day.date, state),
      { sessionFeedback: feedbackMap },
    );

    if (condWorkout) {
      // ── Running exposure cap enforcement ──
      // If this is a running-based session and we've hit the cap,
      // swap exercises to off-feet modality (bike/row/ski).
      // The workout name, type, and tier stay the same — only the exercises change.
      //
      // EXCEPTION: Flying Sprints are NEVER converted off-feet.
      // They are top-end speed exposure and must always remain running-based.
      // They still count toward the running total but are exempt from conversion.
      const isRunning = isRunningBasedConditioning(condWorkout.name);
      const isFlyingSprints = condWorkout.name === 'Flying Sprints';

      if (isRunning && !isFlyingSprints && runningSessionCount >= MAX_RUNNING_SESSIONS) {
        const offFeetTemplate = offFeetAlternative(condWorkout.name, day.date);
        const offFeet = offFeetTemplate
          ? composeConditioningRows(offFeetTemplate, day.date)
          : null;
        if (offFeet) {
          for (const ex of offFeet) { ex.workoutId = condWorkout.id; }
          condWorkout.exercises = offFeet;
          logger.debug(`[RUNNING-CAP] ${day.date}: "${condWorkout.name}" → off-feet modality (running sessions=${runningSessionCount}/${MAX_RUNNING_SESSIONS})`);
        }
      } else if (isRunning) {
        runningSessionCount++;
      }

      result[i] = buildDay(day.date, day.dayOfWeek, today, condWorkout, 'conditioning');
      const entry = conditioningToWeekLogEntry(day.date, condWorkout.name);
      conditioningPlaced.push(entry);
      // Count primary (non-C) placements for the in-season cap
      if (entry.tier !== 'C') {
        primaryConditioningCount++;
      }
    }
  }

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
  // overrides are preserved as-is by `applyInjuryFilterPass`.
  return applyAwayPass(applyInjuryFilterPass(result, state), state);
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
    // A FIXTURE HE IS NOT AT IS NOT A DAY ON HIS WEEK. `buildDay(..., null,
    // 'none')` is the resolver's own way of saying "nothing here" — the same
    // call the max-one-game guard above uses to stand a duplicate down.
    if (day.source === 'game' || day.indicator === 'game' ||
      day.workout?.workoutType === 'Game') {
      return buildDay(day.date, day.dayOfWeek, today, null, 'none');
    }
    if (!day.workout) return day;
    const team = getTeamTrainingWorkoutState(day.workout);
    if (!team.hasTeamTraining) return day;
    // A day that was ONLY the club becomes empty; a combined day keeps its own
    // half and loses the club's, renamed through the ONE owner of that question.
    if (team.isTeamTrainingOnly) {
      return buildDay(day.date, day.dayOfWeek, today, null, 'none');
    }
    return {
      ...day,
      workout: {
        ...day.workout,
        name: team.displayName ?? day.workout.name,
        workoutType: (team.displayWorkoutType ?? day.workout.workoutType) as typeof day.workout.workoutType,
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
