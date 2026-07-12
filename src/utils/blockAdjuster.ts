/**
 * Block Adjuster — Week-Scoped Override Recomputation
 *
 * ARCHITECTURE:
 *   The microcycle is a WEEKLY TEMPLATE (workouts keyed by dayOfWeek 0-6).
 *   This template repeats across all weeks in the block.
 *   We NEVER mutate the template.
 *
 *   When any game day changes, we:
 *     1. Identify which week(s) in the block are affected
 *     2. Read the CURRENT calendar marks (source of truth) for those weeks
 *     3. Recompute ALL overrides for those weeks from scratch
 *     4. REPLACE (not merge) the overrides for those weeks atomically
 *
 *   Layer order for display:
 *     Template projection → dateOverrides → calendarStore markedDays
 *
 *   This eliminates stale ghost overrides — every recompute is clean.
 *
 * Design principle: "A real coach doesn't rewrite your whole program
 * because Saturday's game moved to Sunday."
 */

import type {
  Workout,
  WorkoutExercise,
  Microcycle,
  TrainingProgram,
} from '../types/domain';
import { classifyVisibleSession } from '../rules/sessionClassificationAdapter';

// ─── Types ───

export interface RecomputeResult {
  /** Complete override map for affected weeks — replaces (not merges) existing overrides for those dates */
  dateOverrides: Record<string, Workout>;
  /** All dates in the affected weeks that had overrides computed (used to clear stale ones) */
  affectedDates: string[];
  /** Human-readable summary */
  summary: string;
}

// ─── Date Helpers ───

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Format an ISO date string YYYY-MM-DD */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Shift an ISO date string by N days. */
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/** Get dayOfWeek (0=Sun..6=Sat) from ISO date string */
export function dateToDayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00').getDay();
}

/** Check whether a date falls within a program's active block. */
export function isDateInBlock(
  dateStr: string,
  program: TrainingProgram | null,
): boolean {
  if (!program) return false;
  const start = program.startDate.split('T')[0];
  const end = program.endDate.split('T')[0];
  return dateStr >= start && dateStr <= end;
}

/** Get the template workout for a specific date by matching its dayOfWeek */
function getTemplateWorkout(dateStr: string, microcycle: Microcycle): Workout | null {
  const dow = dateToDayOfWeek(dateStr);
  return microcycle.workouts.find(w => w.dayOfWeek === dow) || null;
}

/**
 * Get the Monday..Sunday date range for the ISO week containing `dateStr`.
 * Returns 7 date strings [Mon, Tue, Wed, Thu, Fri, Sat, Sun].
 */
function getWeekDates(dateStr: string): string[] {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay(); // 0=Sun
  // Shift to Monday: if Sunday (0), go back 6 days. Otherwise go back (dow-1) days.
  const mondayOffset = dow === 0 ? -6 : -(dow - 1);
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    dates.push(formatDate(day));
  }
  return dates;
}

/**
 * Get ALL week date ranges that could be affected by a game change on `changedDate`.
 * This includes the game's own week PLUS the adjacent week if the G+1/G-2 spills over.
 */
function getAffectedWeekDates(changedDate: string, blockStart: string, blockEnd: string): string[] {
  const primaryWeek = getWeekDates(changedDate);
  // G+1 might spill into next week (e.g., Sunday game → Monday is next week)
  const gPlus1 = shiftDate(changedDate, 1);
  const spillWeek = getWeekDates(gPlus1);
  // G-2 might spill into previous week
  const gMinus2 = shiftDate(changedDate, -2);
  const prevWeek = getWeekDates(gMinus2);

  // Combine all unique dates, clamped to block bounds
  const allDates = new Set<string>();
  [...primaryWeek, ...spillWeek, ...prevWeek].forEach(d => {
    if (d >= blockStart && d <= blockEnd) {
      allDates.add(d);
    }
  });

  return Array.from(allDates).sort();
}

// ─── Classification Helpers ───

function isLowerDominant(workout: Workout): boolean {
  const region = classifyVisibleSession(workout).strengthRegion;
  return region === 'lower' || region === 'full_body';
}

function isLowerOrHeavy(workout: Workout): boolean {
  const region = classifyVisibleSession(workout).strengthRegion;
  return (
    region === 'lower' ||
    region === 'full_body' ||
    workout.intensity === 'High'
  );
}

// ─── Workout Builders (real content, not empty shells) ───

function createRecoveryWorkout(dateStr: string, microcycleId: string, reason: string): Workout {
  const now = new Date().toISOString();
  const dow = dateToDayOfWeek(dateStr);
  const workoutId = `override-recovery-${dateStr}`;

  return {
    id: workoutId,
    microcycleId,
    dayOfWeek: dow,
    name: 'Recovery Session',
    description: `${reason} - flush, mobilise, restore`,
    durationMinutes: 30,
    intensity: 'Light',
    workoutType: 'Recovery',
    sessionTier: 'recovery',
    exercises: buildRecoveryExercises(workoutId),
    createdAt: now,
    updatedAt: now,
  };
}

function createOptionalWorkout(dateStr: string, microcycleId: string, reason: string): Workout {
  const now = new Date().toISOString();
  const dow = dateToDayOfWeek(dateStr);
  const workoutId = `override-optional-${dateStr}`;

  return {
    id: workoutId,
    microcycleId,
    dayOfWeek: dow,
    name: 'Prehab & Accessories',
    description: `${reason} - low-fatigue accessory work`,
    durationMinutes: 35,
    intensity: 'Light',
    workoutType: 'Strength',
    sessionTier: 'optional',
    exercises: buildAccessoryExercises(workoutId),
    createdAt: now,
    updatedAt: now,
  };
}

function buildRecoveryExercises(workoutId: string): WorkoutExercise[] {
  return [
    makeExercise(workoutId, 1, 'foam-roll-lower', 'Foam Roll — Hip Flexor, Quad, Adductors', 1, 90, 120, 0, 'Seconds total. Spend extra time on tender spots.'),
    makeExercise(workoutId, 2, 'hip-90-90', 'Hip 90/90 Stretch', 2, 30, 45, 30, 'Seconds per side. Breathe into the stretch.'),
    makeExercise(workoutId, 3, 'cat-cow', 'Cat-Cow', 2, 10, 12, 15, 'Slow and controlled. Match movement to breath.'),
    makeExercise(workoutId, 4, 'worlds-greatest', "World's Greatest Stretch", 2, 5, 5, 15, 'Per side. Hold each position 3 seconds.'),
    makeExercise(workoutId, 5, 'walk-or-bike', 'Light Walk or Stationary Bike', 1, 15, 20, 0, 'Minutes at conversational pace. Keep heart rate low.'),
  ];
}

function buildAccessoryExercises(workoutId: string): WorkoutExercise[] {
  // NOTE: Tib raises (lower_prehab) are intentionally excluded here.
  // This prehab template is used on freed game slots and generic optional days
  // which may sit adjacent to upper sessions. Lower-leg prehab (tib raises,
  // ankle dorsiflexion) is reserved for lower-body and extended recovery sessions
  // via the pool-based builder with category gating.
  return [
    makeExercise(workoutId, 1, 'band-pallof', 'Band Pallof Press', 3, 10, 12, 45, 'Band at chest height. Anti-rotation trunk work.'),
    makeExercise(workoutId, 2, 'copenhagen-plank', 'Copenhagen Plank', 3, 20, 30, 45, 'Seconds per side. Groin / adductor strength.'),
    makeExercise(workoutId, 3, 'band-pull-apart', 'Band Pull-Apart', 3, 15, 20, 30, 'Shoulder health. Squeeze at end range.'),
    makeExercise(workoutId, 4, 'calf-raise', 'Single-Leg Calf Raise', 3, 12, 15, 30, 'Per side. Slow eccentric (3 sec down).'),
    makeExercise(workoutId, 5, 'swiss-ball-curl', 'Swiss Ball Hamstring Curl', 2, 10, 12, 45, 'Hips up. Roll ball in and out.'),
  ];
}

function makeExercise(
  workoutId: string,
  order: number,
  exerciseId: string,
  name: string,
  sets: number,
  repsMin: number,
  repsMax: number,
  restSeconds: number,
  notes: string,
): WorkoutExercise {
  const now = new Date().toISOString();
  return {
    id: `${workoutId}-ex-${order}`,
    workoutId,
    exerciseId,
    exerciseOrder: order,
    prescribedSets: sets,
    prescribedRepsMin: repsMin,
    prescribedRepsMax: repsMax,
    restSeconds,
    notes,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Core Logic ───

/**
 * Recompute ALL overrides for the week(s) affected by a game change.
 *
 * This is NOT incremental. It:
 *   1. Identifies every date in the affected week(s)
 *   2. Reads the current calendar marks (source of truth for game days)
 *   3. Starts from the bare template for each date
 *   4. Applies game-relative rules (G+1 recovery, G-1 protection, G-2 moderation)
 *   5. Returns a COMPLETE override map that REPLACES all overrides for those dates
 *
 * The caller must:
 *   - Clear all existing overrides for `affectedDates`
 *   - Apply the returned `dateOverrides`
 *   This is done atomically via programStore.replaceOverridesForDates()
 */
export function recomputeWeekOverrides(
  program: TrainingProgram,
  microcycle: Microcycle,
  changedDate: string,
  currentGameDates: string[],  // ALL current game dates from calendarStore (source of truth)
): RecomputeResult {
  const blockStart = program.startDate.split('T')[0];
  const blockEnd = program.endDate.split('T')[0];

  // 1. Get all dates in the affected week(s)
  const affectedDates = getAffectedWeekDates(changedDate, blockStart, blockEnd);

  // 2. Build a Set of game dates within the block for fast lookup
  const gameDatesInBlock = new Set(
    currentGameDates.filter(d => d >= blockStart && d <= blockEnd)
  );

  // 3. For each affected date, decide if an override is needed
  const overrides: Record<string, Workout> = {};

  for (const date of affectedDates) {
    const templateWorkout = getTemplateWorkout(date, microcycle);
    const isGameInCalendar = gameDatesInBlock.has(date);
    const templateIsGame = templateWorkout?.workoutType === 'Game';

    // ── Case A: Calendar says game, template says game → no override needed ──
    // Both agree. The calendarStore mark + template projection will show game.
    if (isGameInCalendar && templateIsGame) {
      continue;
    }

    // ── Case B: Calendar says game, template says NOT game → no override needed ──
    // calendarStore layer 3 will show game, overriding the template. Fine.
    if (isGameInCalendar && !templateIsGame) {
      // But we might need to suppress the template workout for this date
      // since it's now a game day. The display will show "game" from calendarStore,
      // but the Program tab may still show the template workout content.
      // Override with nothing — the game marker is the truth.
      continue;
    }

    // ── Case C: Calendar says NOT game, template says game → override needed ──
    // Template would project "game" but user removed this game. Override with a real session.
    if (!isGameInCalendar && templateIsGame) {
      overrides[date] = createOptionalWorkout(date, microcycle.id, 'Freed game slot');
      continue;
    }

    // ── Case D: Neither calendar nor template says game → check if G-relative rules apply ──
    // This date might be near a game and need adjustment.
    if (!isGameInCalendar && !templateIsGame) {
      const override = computeGameProximityOverride(date, gameDatesInBlock, templateWorkout, microcycle);
      if (override) {
        overrides[date] = override;
      }
      // If no override needed, the template shows through cleanly.
      continue;
    }
  }

  return {
    dateOverrides: overrides,
    affectedDates,
    summary: `Recomputed ${affectedDates.length} dates around ${changedDate}. ${Object.keys(overrides).length} overrides produced.`,
  };
}

/**
 * For a non-game date, check if it's near any game in the calendar and needs adjustment.
 * Returns a Workout override if needed, null if the template is fine as-is.
 */
function computeGameProximityOverride(
  date: string,
  gameDates: Set<string>,
  templateWorkout: Workout | null,
  microcycle: Microcycle,
): Workout | null {
  if (!templateWorkout) return null;

  // Check each nearby game to see if this date needs adjustment
  // G+1: day AFTER a game → recovery
  const yesterday = shiftDate(date, -1);
  if (gameDates.has(yesterday)) {
    // This date is G+1 relative to yesterday's game
    if (templateWorkout.sessionTier !== 'recovery' && templateWorkout.workoutType !== 'Game') {
      return createRecoveryWorkout(date, microcycle.id, 'Post-game recovery');
    }
  }

  // G-1: day BEFORE a game → demote if heavy lower/compound
  const tomorrow = shiftDate(date, 1);
  if (gameDates.has(tomorrow)) {
    // This date is G-1 relative to tomorrow's game
    if (templateWorkout.sessionTier === 'core' && isLowerOrHeavy(templateWorkout)) {
      return {
        ...templateWorkout,
        id: `override-preGame-${date}`,
        sessionTier: 'optional',
        intensity: 'Light',
        description: `${templateWorkout.description} (pre-game - reduced load)`,
        exercises: [...templateWorkout.exercises],
        updatedAt: new Date().toISOString(),
      };
    }
  }

  // G-2: 2 days before a game → moderate if lower dominant
  const dayAfterTomorrow = shiftDate(date, 2);
  if (gameDates.has(dayAfterTomorrow)) {
    // This date is G-2 relative to a game 2 days out
    if (isLowerDominant(templateWorkout) && templateWorkout.sessionTier === 'core') {
      return {
        ...templateWorkout,
        id: `override-nearGame-${date}`,
        intensity: 'Moderate',
        description: `${templateWorkout.description} (48h to game - moderate load)`,
        exercises: [...templateWorkout.exercises],
        updatedAt: new Date().toISOString(),
      };
    }
  }

  // No game proximity issues — template is fine
  return null;
}
