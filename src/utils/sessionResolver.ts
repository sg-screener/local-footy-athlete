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

import type {
  Workout,
  Exercise,
  Microcycle,
  TrainingProgram,
  SeasonPhase,
  ReadinessLevel,
  DayOfWeek,
  GameDay,
} from '../types/domain';
import type { CalendarDayType } from '../store/calendarStore';
import {
  buildDerivedSession,
  buildConditioningSession,
  isRunningBasedConditioning,
  switchToOffFeetModality,
  type AthleteContext,
  DEFAULT_ATHLETE_CONTEXT,
} from './sessionBuilder';
import { buildWeekLog, conditioningToWeekLogEntry } from './weekLogBuilder';
import type { WeekLog } from './conditioningRules';
import { resolveRecovery } from './recoveryRules';
import {
  applyStrengthProgression,
  buildProgressionContext,
} from './strengthProgressionIntegration';
import {
  analyzeFeedbackPatterns,
  biasConditioningReadiness,
  shouldPreferRest,
} from './feedbackPatterns';
import { findMatchingFeedback, deriveAdaptation } from './feedbackAdapter';
import type { SessionFeedback } from '../store/programStore';
import { logger } from './logger';

// ─── Input/Output Types ───

export interface ScheduleState {
  currentProgram: TrainingProgram | null;
  currentMicrocycle: Microcycle | null;
  manualOverrides: Record<string, Workout>;
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
   * Legacy game day from onboarding's GameDayScreen. Used as fallback
   * when usualGameDay is not set (only Friday/Saturday/Sunday count;
   * 'Varies' is excluded).
   */
  gameDay?: GameDay;
  /** Athlete readiness for conditioning caps. Defaults to 'medium'. */
  readiness: ReadinessLevel;
  /** Session feedback keyed by ISO date. Used to feed feeling/patterns into progression. */
  sessionFeedback?: Record<string, SessionFeedback>;
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
  } | null;
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

// ─── Block Boundary Computation ───
//
// Aligns training blocks to calendar week boundaries (Mon-Sun).
//
// Rule: "The week the user starts in is Week 1. Then give them the next
// 3 full weeks, ending on Sunday."
//
// This means:
//   - Block start = Monday of the week containing the actual start date
//   - Block end = Sunday of the 3rd full week after the start week
//   - Start week counts as Week 1 (even if partial)
//   - Total span = 4 calendar weeks (Mon→Sun × 4 = 28 days)
//
// Examples:
//   Start Monday    7 Apr → block = 7 Apr (Mon) – 4 May (Sun) → 4 full weeks
//   Start Thursday 10 Apr → block = 7 Apr (Mon) – 4 May (Sun) → partial W1 + 3 full
//   Start Saturday 12 Apr → block = 7 Apr (Mon) – 4 May (Sun) → partial W1 + 3 full
//   Start Sunday   13 Apr → block = 7 Apr (Mon) – 4 May (Sun) → 1 day of W1 + 3 full

/**
 * Compute week-aligned block start (Monday) and end (Sunday) from
 * any start date. Returns ISO date strings (YYYY-MM-DD).
 *
 * Exported so generateProgram and defaultProgram can share the same
 * boundary logic instead of ad-hoc date arithmetic.
 */
export function computeBlockBounds(startDate: Date): { blockStart: string; blockEnd: string } {
  // Find Monday of the week containing startDate
  const dow = startDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysToMonday = dow === 0 ? -6 : -(dow - 1);
  const monday = new Date(startDate);
  monday.setDate(startDate.getDate() + daysToMonday);
  monday.setHours(12, 0, 0, 0);

  // Block end = 27 days later (4 calendar weeks: Mon→Sun × 4)
  // Mon + 27 days = Sunday of 4th week
  const endSunday = new Date(monday);
  endSunday.setDate(monday.getDate() + 27);
  endSunday.setHours(12, 0, 0, 0);

  return {
    blockStart: formatDate(monday),
    blockEnd: formatDate(endSunday),
  };
}

/** Get ISO date string for Monday of the week containing today, offset by N weeks. */
export function getMondayStr(weekOffset: number): string {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : -(dow - 1);
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset + weekOffset * 7);
  monday.setHours(12, 0, 0, 0);
  return formatDate(monday);
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

function toDateString(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

// ─── Classification Helpers (from blockAdjuster) ───

function isLowerDominant(workout: Workout): boolean {
  const name = workout.name.toLowerCase();
  return name.includes('lower') || name.includes('leg') || name.includes('squat') || name.includes('hinge');
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

  // Only protect template (engine-planned) and manual (coach-authored) sessions
  if (source !== 'template' && source !== 'manual') return true;

  if (isProtectedCoreExposure(workout)) {
    if (__DEV__) {
      logger.debug(
        `[resolver] BLOCKED replacement of protected core "${workout.name}" ` +
        `(tier=${workout.sessionTier}, source=${source}) on ${date} — context: ${context}`
      );
    }
    return false;
  }

  return true;
}

function createGameStub(dateStr: string, dow: number): Workout {
  const now = new Date().toISOString();
  return {
    id: `calendar-game-${dateStr}`,
    microcycleId: 'calendar',
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
 *   1. Prefer `usualGameDay` (new-style, set by phase-shift modal).
 *   2. Fallback to legacy `gameDay` if it is Friday / Saturday / Sunday
 *      (onboarding's GameDayScreen only sets this field).
 *   3. 'Varies' → no effective game day (user must mark manually).
 *
 * Returns undefined if no effective game day can be determined.
 *
 * This mirrors `coachingEngine.ts`'s `data.usualGameDay || data.gameDay`
 * so resolver + engine agree on "what day is the weekly game?".
 */
export function resolveEffectiveGameDay(
  usualGameDay?: DayOfWeek,
  gameDay?: GameDay,
): DayOfWeek | undefined {
  if (usualGameDay) return usualGameDay;
  if (gameDay === 'Friday' || gameDay === 'Saturday' || gameDay === 'Sunday') {
    return gameDay;
  }
  return undefined;
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
 * Explicit 'game' marks are scoped by day-of-week:
 *   - Recurring marks (dow === usualGameDay)  → unconditional, all weeks see them.
 *   - One-off / moved marks (dow !== usualGameDay) → ONLY count for the week
 *     they live in (the Mon–Sun window containing centerDate). Without this
 *     scoping, a one-off Sunday mark in Week A leaks into Week B's proximity
 *     checks (Mon shift -1 = prior Sun) and reshapes future weeks around an
 *     anchor that no longer exists outside its own week.
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
  const markedDays = state.markedDays || {};
  const games = new Set<string>();

  const effGameDay = resolveEffectiveGameDay(state.usualGameDay, state.gameDay);
  const virtualDow = effGameDay !== undefined ? DOW_TO_NUM[effGameDay] : undefined;
  const recurringActive = isVirtualGameEnabled(state) && virtualDow !== undefined;

  // Bounds for one-off scoping (Mon–Sun of centerDate's week).
  const centerMonday = recurringActive ? getMondayForDate(centerDate) : null;
  const centerSunday = centerMonday ? addDays(centerMonday, 6) : null;

  // Loop 1: explicit 'game' marks. Recurring marks (dow === usualGameDay) are
  // included for any centerDate. One-off marks (different dow) only count for
  // their own Mon–Sun week — otherwise a moved Sunday game in Week A would
  // anchor proximity calcs in Week B/C/D.
  for (const [date, type] of Object.entries(markedDays)) {
    if (type !== 'game') continue;
    if (recurringActive) {
      const dow = dateToDayOfWeek(date);
      const isRecurring = dow === virtualDow;
      if (!isRecurring) {
        // One-off override — scope to centerDate's week only.
        if (date < centerMonday! || date > centerSunday!) continue;
      }
    }
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
): Workout | null {
  // G+1: day after a game → recovery (even if no template workout)
  if (gameDates.has(shiftDate(date, -1))) {
    if (!templateWorkout || (templateWorkout.sessionTier !== 'recovery' && templateWorkout.workoutType !== 'Game')) {
      // GUARD: never replace a protected core exposure with recovery.
      // The engine placed this session here for a reason (required exposure).
      // Template workouts passed to this function always have source='template'.
      if (isProtectedCoreExposure(templateWorkout)) {
        if (__DEV__) {
          logger.debug(
            `[resolver] BLOCKED G+1 recovery replacing protected core "${templateWorkout!.name}" on ${date}`
          );
        }
        return null; // keep the template as-is
      }
      return buildDerivedSession('recovery', date, microcycleId, 'Post-game recovery', athlete);
    }
  }

  // G-1: day before a game → Gunshow (light upper-body pump)
  // BUT preserve recovery sessions and rest days (fatigue/injury flexibility)
  if (gameDates.has(shiftDate(date, 1))) {
    // Keep recovery as-is
    if (templateWorkout?.sessionTier === 'recovery' || templateWorkout?.workoutType === 'Recovery') {
      return null;
    }
    // Keep game as-is (shouldn't happen but guard)
    if (templateWorkout?.workoutType === 'Game') {
      return null;
    }
    // GUARD: never replace a protected core exposure with Gunshow.
    // The engine placed this session (e.g. Lower Strength on G-1) deliberately.
    if (isProtectedCoreExposure(templateWorkout)) {
      if (__DEV__) {
        logger.debug(
          `[resolver] BLOCKED G-1 Gunshow replacing protected core "${templateWorkout!.name}" on ${date}`
        );
      }
      return null; // keep the template as-is
    }
    // Everything else → Gunshow (derivedType key remains 'arms_pump')
    return buildDerivedSession('arms_pump', date, microcycleId, 'Pre-game day', athlete);
  }

  if (!templateWorkout) return null;

  // G-2: 2 days before a game → moderate lower-dominant sessions
  if (gameDates.has(shiftDate(date, 2))) {
    if (isLowerDominant(templateWorkout) && templateWorkout.sessionTier === 'core') {
      return {
        ...templateWorkout,
        id: `derived-nearGame-${date}`,
        intensity: 'Moderate',
        description: `${templateWorkout.description} (48h to game — moderate load)`,
        exercises: templateWorkout.exercises.map(e => ({
          ...e,
          // Preserve nested exercise sub-object for display
          exercise: e.exercise || { id: e.exerciseId, name: e.notes || `Exercise ${e.exerciseOrder}`, description: '' } as Exercise,
        })),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  return null; // no proximity effect
}

/**
 * Compressed-week Monday recovery.
 *
 * When the user moves a single game to Sunday (one-off, dow !== usualGameDay)
 * AND the next game is ≤6 days later (e.g. the recurring Saturday following
 * a moved Sunday game = 6-day turnaround), the body still needs the
 * Monday post-game flush — but the standard G+1 rule does NOT fire here
 * because `getEffectiveGameDates` correctly week-scopes the one-off mark
 * to its own Mon–Sun window, so Week B's gameDates excludes Week A's Sun.
 *
 * That week-scoping is the right default (prevents one-off marks from
 * reshaping all future weeks). This rule is the targeted exception: the
 * specific Monday immediately after a one-off Sunday game gets recovery,
 * regardless of week boundary, when the upcoming turnaround is compressed.
 *
 * Rules baked in:
 *   - Mon-only.
 *   - Bypasses the protected-core guard: Lower is INTENTIONALLY dropped
 *     for the compressed week (no makeup attempt).
 *   - Strictly week-after-Sun-game scoped: rule looks at THIS Mon's
 *     prior day only. Future weeks have no Sun mark → rule doesn't fire,
 *     guaranteeing zero leakage.
 *   - Push/pull weekly balance is maintained by the engine's
 *     enforceInSeasonPushPullBalance pass (Wed=Push, Fri=Pull stay intact).
 */
function applyCompressedWeekMondayRecovery(
  date: string,
  state: ScheduleState,
  microcycleId: string,
): Workout | null {
  // Mon-only.
  if (dateToDayOfWeek(date) !== 1) return null;

  // Needs an in-season recurring anchor for the "one-off" discrimination.
  if (state.seasonPhase !== 'In-season') return null;
  const usualGameDay = resolveEffectiveGameDay(state.usualGameDay, state.gameDay);
  if (!usualGameDay) return null;
  const usualDow = DOW_TO_NUM[usualGameDay];

  const markedDays = state.markedDays || {};
  const priorDate = addDays(date, -1);

  // Prior day must have an EXPLICIT one-off game mark.
  if (markedDays[priorDate] !== 'game') return null;
  const priorDow = dateToDayOfWeek(priorDate);
  if (priorDow === usualDow) return null; // Sun-recurring → normal G+1 already covers it

  // Look forward up to 6 days from priorDate for the next game (explicit or
  // virtual). 6 days = the compressed Sun→Sat turnaround threshold.
  for (let offset = 1; offset <= 6; offset++) {
    const probe = addDays(priorDate, offset);
    if (markedDays[probe] === 'game') {
      return buildDerivedSession(
        'recovery', date, microcycleId,
        'Compressed-week recovery (post-Sun game, short turnaround)',
        state.athleteContext,
      );
    }
    if (dateToDayOfWeek(probe) === usualDow) {
      const m = markedDays[probe];
      if (m === 'noGame' || m === 'rest') continue;
      if (weekHasExplicitGameMark(probe, markedDays)) continue;
      return buildDerivedSession(
        'recovery', date, microcycleId,
        'Compressed-week recovery (post-Sun game, short turnaround)',
        state.athleteContext,
      );
    }
  }

  return null;
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
 * Resolution priority:
 *   1. Manual override (human/coach)
 *   2. Calendar rest mark → null
 *   3. Calendar game mark → game stub
 *   4. Template says game but no calendar mark → freed slot (optional session)
 *   5. Template + game proximity rules
 *   6. Unmodified template
 *   7. No workout
 */
function _resolveDateRaw(date: string, state: ScheduleState): ResolvedDay {
  const { currentProgram, currentMicrocycle, manualOverrides, markedDays } = state;
  const dow = dateToDayOfWeek(date);
  const today = formatDate(new Date());
  const inBlock = isInBlock(date, currentProgram);

  // ── Priority 1: Manual override (human/coach authored) ──
  if (manualOverrides && manualOverrides[date]) {
    return buildDay(date, dow, today, manualOverrides[date], 'manual');
  }

  // ── Priority 2: Calendar marks (game / rest / noGame) ──
  const mark = markedDays ? markedDays[date] : undefined;
  if (mark === 'rest') {
    return buildDay(date, dow, today, null, 'rest');
  }
  if (mark === 'game') {
    return buildDay(date, dow, today, createGameStub(date, dow), 'game');
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

  // ── No block data → nothing to resolve ──
  if (!inBlock || !currentMicrocycle) {
    return buildDay(date, dow, today, null, 'none');
  }

  const templateWorkout = currentMicrocycle.workouts.find(w => w.dayOfWeek === dow) || null;

  // ── Priority 4: Game proximity rules (G+1 recovery, G-1 Gunshow, G-2 moderate) ──
  // Evaluated BEFORE freed-game-slot so that a moved game's G+1 takes priority
  // over a template game that no longer has a calendar mark.
  // gameDates includes VIRTUAL games (from profile.usualGameDay) so proximity
  // fires on Fri (G-1) + Thu (G-2) + Sun (G+1) even when Saturday is virtual
  // and not explicitly marked in calendarStore.
  const gameDates = getEffectiveGameDates(state, date);
  const effectiveTemplate = (templateWorkout?.workoutType === 'Game' && !mark)
    ? null  // template game without calendar mark → treat as empty for proximity
    : templateWorkout;
  const proximityResult = applyGameProximity(date, effectiveTemplate, gameDates, currentMicrocycle.id, state.athleteContext);
  if (proximityResult) {
    logger.debug(`[RESOLVER-PROXIMITY] date=${date} dow=${dow} → ${proximityResult.name} (tier=${proximityResult.sessionTier})`);
    return buildDay(date, dow, today, proximityResult, 'gameProximity');
  }

  // ── Priority 4b: Compressed-week Monday recovery ──
  // Targeted exception to the week-scoped one-off rule: when the user
  // moves a single game to Sunday and the next game is within 6 days, the
  // immediately-following Monday gets a forced Recovery (Lower is dropped,
  // not made up). Only fires on Mon directly after a one-off Sun mark —
  // future weeks have no such mark and are unaffected.
  const compressedRecovery = applyCompressedWeekMondayRecovery(date, state, currentMicrocycle.id);
  if (compressedRecovery) {
    logger.debug(`[RESOLVER-COMPRESSED-WEEK] date=${date} dow=${dow} → forced Recovery (post-Sun-game compression)`);
    return buildDay(date, dow, today, compressedRecovery, 'gameProximity');
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
        buildDerivedSession('prehab_accessories', date, currentMicrocycle.id, 'Freed game slot', state.athleteContext),
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

  // ── Priority 6a: Recovery template → replace with derived pool session ──
  // AI-generated recovery workouts lack structured prescription fields (prescriptionType,
  // perSide, restSeconds). Replace them with deterministic pool-built sessions so every
  // recovery exercise has proper sets/duration/reps for the structured renderer.
  if (
    templateWorkout &&
    (templateWorkout.sessionTier === 'recovery' || templateWorkout.workoutType === 'Recovery')
  ) {
    return buildDay(
      date, dow, today,
      buildDerivedSession('recovery', date, currentMicrocycle.id, 'Scheduled recovery — active', state.athleteContext),
      'template',
    );
  }

  // ── Priority 6b: Unmodified template ──
  return buildDay(date, dow, today, templateWorkout, templateWorkout ? 'template' : 'none');
}

/**
 * Public resolveDate — runs the full priority resolution and then
 * applies the resolver-level injury filter so future weeks (and any
 * single-date renders) reflect the active injury without needing
 * per-date overrides. Manual overrides bypass the filter.
 */
export function resolveDate(date: string, state: ScheduleState): ResolvedDay {
  const day = _resolveDateRaw(date, state);
  if (!state.activeInjury) return day;
  const [filtered] = applyInjuryFilterPass([day], state);
  return filtered;
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
export function resolveWeekWithConditioning(
  mondayStr: string,
  state: ScheduleState,
): ResolvedDay[] {
  // Pass 1: base resolution (strength, game proximity, templates)
  const baseDays = resolveWeek(mondayStr, state);

  // Guard: skip conditioning + recovery if no season context
  if (!state.seasonPhase) return baseDays;

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

  // ── Strength Progression Pass ──
  // Apply progression adjustments to template strength sessions.
  // This is a builder-layer operation that modifies prescriptions
  // (sets, reps, weight, rest) based on the progression engine.
  // Only affects exercises classified as primary_strength or secondary_strength.
  // Does NOT modify resolveDate() or change any placement logic.
  const injuries = (state.athleteContext?.injuries || []).map(i => ({
    bodyArea: i.bodyArea,
    severity: i.severity,
  }));

  // Build sorted feedback array once for the whole week.
  // Newest first, filtered to entries before the earliest day in the week.
  const feedbackMap = state.sessionFeedback || {};
  const allFeedbackSorted: SessionFeedback[] = Object.values(feedbackMap)
    .sort((a: SessionFeedback, b: SessionFeedback) => b.dateStr.localeCompare(a.dateStr));

  // Pattern summary for conditioning/recovery biases (computed once per week)
  const weekPatternSummary = analyzeFeedbackPatterns(
    allFeedbackSorted.filter((fb: SessionFeedback) => fb.dateStr < baseDays[0]?.date)
  );

  // Build a workout-type-by-date map for session type matching.
  // Uses resolved base days + template workouts to map dates → workoutType.
  const workoutTypeByDate: Record<string, string> = {};
  for (const day of baseDays) {
    if (day.workout) {
      workoutTypeByDate[day.date] = day.workout.workoutType;
    }
  }
  // Also include historical dates from feedback that have no resolved day
  // (previous weeks). Use the workout name/type from the template by dayOfWeek.
  if (state.currentMicrocycle) {
    for (const fb of allFeedbackSorted) {
      if (!workoutTypeByDate[fb.dateStr] && state.currentMicrocycle.workouts) {
        const [fy, fm, fd] = fb.dateStr.split('-').map(Number);
        const fbDate = new Date(fy, fm - 1, fd);
        const fbDow = fbDate.getDay();
        const matchingWorkout = state.currentMicrocycle.workouts.find(
          (w: Workout) => w.dayOfWeek === fbDow
        );
        if (matchingWorkout) {
          workoutTypeByDate[fb.dateStr] = matchingWorkout.workoutType;
        }
      }
    }
  }

  for (let i = 0; i < baseDays.length; i++) {
    const day = baseDays[i];
    if (
      day.workout &&
      day.workout.workoutType === 'Strength' &&
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
        day.workout.workoutType,
        feedbackMap,
        workoutTypeByDate,
        day.date,
      );
      const adaptation = deriveAdaptation(matchedFeedback);

      const progressionCtx = buildProgressionContext(
        state.seasonPhase!,
        state.readiness || 'medium',
        gameDates,
        day.date,
        injuries,
        state.markedDays || {},
        // workoutHistory: empty default — caller can provide via extended state
        [],
        lastFeedbackFeeling,
        priorFeedback.slice(0, 4), // analysis window for pattern biases
        adaptation.explanation ? adaptation : null,
      );

      // Build last-performed-weight map from weight overrides (dates before today)
      const lastPerformedWeights = buildLastPerformedWeights(
        state.weightOverrides || {},
        day.date,
      );

      const progressedWorkout = applyStrengthProgression(
        day.workout,
        progressionCtx,
        Object.keys(lastPerformedWeights).length > 0 ? lastPerformedWeights : undefined,
      );

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

  // ── Double game week: second G+1 → full rest ──
  // On double game weeks, game proximity places recovery on BOTH G+1 days.
  // The second G+1 should be full rest — the athlete played two games in
  // one week and needs complete recovery, not another session.
  // Convert the later G+1 recovery to rest before conditioning/recovery passes
  // so neither pass attempts to fill it.
  //
  // GUARD: only fire when the week actually contains ≥2 games. The
  // compressed-week Mon recovery rule places recovery with source
  // 'gameProximity' too — without this guard, a single-game week with a
  // compressed-Mon recovery (after a moved Sun in the prior week) would
  // be misread as a double-game week, and the legitimate Sun G+1 would
  // get downgraded to full rest.
  const result = [...baseDays];
  const today = formatDate(new Date());
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
            state.currentMicrocycle?.id || 'derived',
            'Pre-game window — avoiding upper-body stacking with G-1',
            state.athleteContext,
          ),
          'gameProximity',
        );
      }
    }
  }

  // Pass 2: progressive conditioning placement
  // Apply feedback pattern bias to conditioning readiness (one-step max)
  const conditioningReadiness = biasConditioningReadiness(
    state.readiness || 'medium',
    weekPatternSummary,
  );
  const conditioningPlaced: WeekLog['sessions'] = [];

  // ── In-season primary conditioning cap ──
  // For in-season weeks (including bye/freed-game weeks), limit the
  // conditioning pass to ONE primary (A or B-tier) placement.
  // After that primary slot is filled, remaining empty days should fall
  // through to Pass 3 (recovery) rather than stacking back-to-back
  // conditioning sessions on the weekend.
  // Pre-season and off-season allow multiple primary conditioning sessions.
  const inSeasonPrimaryCap = state.seasonPhase === 'In-season' ? 1 : Infinity;
  let primaryConditioningCount = 0;

  // ── Running exposure cap ──
  // Max 4 running-based conditioning sessions per week.
  // When the cap is reached, additional running sessions are converted to
  // off-feet modalities (bike/row/ski) while preserving the conditioning stimulus.
  // This is invisible to the user — same session intent, different modality.
  const MAX_RUNNING_SESSIONS = 4;
  let runningSessionCount = 0;

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
    );

    // Try conditioning placement
    const condWorkout = buildConditioningSession(
      day.date,
      gameDates,
      state.athleteContext,
      state.seasonPhase,
      weekLog,
      state.currentMicrocycle?.id || 'derived',
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
        const offFeet = switchToOffFeetModality(condWorkout.name, day.date);
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

  // Pass 3: recovery placement on remaining empty days
  // Count existing recovery sessions (including G+1 from game proximity)
  let weekRecoveryCount = 0;
  for (const day of result) {
    if (day.workout?.workoutType === 'Recovery' || day.workout?.sessionTier === 'recovery') {
      weekRecoveryCount++;
    }
  }

  for (let i = 0; i < result.length; i++) {
    const day = result[i];

    // Only place recovery on truly empty days within the active block
    if (day.workout !== null) continue;
    if (day.source !== 'none') continue;
    if (!blockStart || !blockEnd) continue;
    if (day.date < blockStart || day.date > blockEnd) continue;

    // HARD CONSTRAINT: never place sessions on unavailable days
    if (!isDayAvailable(day.dayOfWeek)) continue;

    // Compute game proximity for this date
    const [y, m, d] = day.date.split('-').map(Number);
    const dateMs = new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
    let daysToGame: number | null = null;
    let daysSinceGame: number | null = null;
    for (const gd of gameDates) {
      const [gy, gm, gdd] = gd.split('-').map(Number);
      const gameMs = new Date(gy, gm - 1, gdd, 12, 0, 0, 0).getTime();
      const diffDays = Math.round((gameMs - dateMs) / (1000 * 60 * 60 * 24));
      if (diffDays > 0 && (daysToGame === null || diffDays < daysToGame)) {
        daysToGame = diffDays;
      }
      if (diffDays < 0 && (daysSinceGame === null || -diffDays < daysSinceGame)) {
        daysSinceGame = -diffDays;
      }
    }

    // Check if high-tier conditioning was placed yesterday (stacking concern)
    const yesterday = addDays(day.date, -1);
    const recentHighTier = conditioningPlaced.some(
      s => s.dateStr === yesterday && (s.tier === 'A' || s.tier === 'B-high'),
    );

    // Feedback pattern: prefer full rest over additional recovery
    // if athlete has been reporting 'cooked' repeatedly and already has recovery
    if (shouldPreferRest(weekPatternSummary, weekRecoveryCount)) {
      continue; // leave this day empty — full rest
    }

    // Try recovery placement
    const recoveryResult = resolveRecovery(
      daysToGame,
      daysSinceGame,
      state.seasonPhase,
      state.readiness || 'medium',
      weekRecoveryCount,
      recentHighTier,
    );

    if (recoveryResult) {
      const recoveryWorkout = buildDerivedSession(
        recoveryResult.derivedType,
        day.date,
        state.currentMicrocycle?.id || 'derived',
        `Scheduled recovery — ${recoveryResult.category}`,
        state.athleteContext,
      );
      result[i] = buildDay(day.date, day.dayOfWeek, today, recoveryWorkout, 'recovery');
      weekRecoveryCount++;
    }
  }

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
        if (__DEV__) {
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
      if (__DEV__) {
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
  return applyInjuryFilterPass(result, state);
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

/** Map a GameDay name to JS dayOfWeek number (0=Sun..6=Sat). */
const GAME_DAY_MAP: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/**
 * Compute all dates within a block that fall on a given weekday.
 * Used to seed calendarStore with game dates after onboarding.
 *
 * Example: gameDay='Saturday', block 2026-03-15 to 2026-04-05
 *   → ['2026-03-21', '2026-03-28', '2026-04-04']
 *
 * Returns empty array for 'Varies' (user must set manually).
 */
export function computeGameDatesForBlock(
  gameDay: string,
  blockStartDate: string,
  blockEndDate: string,
): string[] {
  const targetDow = GAME_DAY_MAP[gameDay];
  if (targetDow === undefined) return []; // 'Varies' or unknown

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

/** Format a week label like "6 – 12 Apr" from a Monday date string. */
export function formatWeekLabel(mondayStr: string): string {
  const sunDate = addDays(mondayStr, 6);
  const [, mm, md] = mondayStr.split('-').map(Number);
  const [, sm, sd] = sunDate.split('-').map(Number);
  const mMon = MONTH_SHORT[mm - 1];
  const sMon = MONTH_SHORT[sm - 1];
  return mMon === sMon
    ? `${md} – ${sd} ${sMon}`
    : `${md} ${mMon} – ${sd} ${sMon}`;
}
