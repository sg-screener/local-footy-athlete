/**
 * WeekLog Builder — Assembles conditioning WeekLog from resolved schedule data.
 *
 * Pure functions. No React. No Zustand.
 *
 * Bridges the gap between the resolver's per-day output and the conditioning
 * engine's week-level input (WeekLog). Derives as much as possible from
 * existing schedule data; fields that need external input get safe defaults.
 *
 * DERIVATION MAP:
 *   strengthSessions   → from resolved workouts with workoutType 'Strength'
 *   teamTrainingSessions → from resolved workouts with workoutType 'Team Training'
 *   byeWeek            → 0 games in markedDays this week
 *   doubleGameWeek     → 2+ games in markedDays this week
 *   missedTeamTraining → false (needs explicit user input — safe default)
 *   weeksOffTraining   → 0 (needs session history — safe default)
 *   readiness          → passed in, defaults to 'medium'
 */

import type { ResolvedDay } from './sessionResolver';
import type { WeekLog } from './conditioningRules';
import type { ConditioningTier } from '../data/exerciseTags';
import type { CalendarDayType } from '../store/calendarStore';
import type { ReadinessLevel } from '../types/domain';
import { CONDITIONING_META } from '../data/exerciseTags';

// ─── Public API ───

/**
 * Build a WeekLog from the week's resolved days plus calendar context.
 *
 * Called during week-level conditioning resolution. The `conditioningPlaced`
 * array grows as conditioning is placed day by day within the week —
 * each successive call includes earlier days' placements so that
 * stacking guard, weekly caps, and strength interaction work correctly.
 *
 * @param resolvedDays      - The 7 resolved days (Mon–Sun), strength/template pass
 * @param markedDays        - Full calendar marks (game/rest) from calendarStore
 * @param readiness         - Athlete readiness (from onboarding or default)
 * @param conditioningPlaced - Conditioning sessions placed so far this week
 */
export function buildWeekLog(
  resolvedDays: ResolvedDay[],
  markedDays: Record<string, CalendarDayType>,
  readiness: ReadinessLevel = 'medium',
  conditioningPlaced: WeekLog['sessions'] = [],
): WeekLog {
  // Count game days within this specific week
  const weekDates = new Set(resolvedDays.map(d => d.date));
  let gamesThisWeek = 0;
  for (const [date, type] of Object.entries(markedDays)) {
    if (type === 'game' && weekDates.has(date)) gamesThisWeek++;
  }

  // Extract strength sessions from resolved workouts
  const strengthSessions: WeekLog['strengthSessions'] = [];
  let teamTrainingCount = 0;

  for (const day of resolvedDays) {
    if (!day.workout) continue;

    if (day.workout.workoutType === 'Team Training') {
      teamTrainingCount++;
    }

    if (day.workout.workoutType === 'Strength') {
      strengthSessions.push({
        dateStr: day.date,
        fatigue: intensityToFatigue(day.workout.intensity),
      });
    }
  }

  return {
    sessions: conditioningPlaced,
    strengthSessions,
    teamTrainingSessions: teamTrainingCount,
    byeWeek: gamesThisWeek === 0,
    missedTeamTraining: false,    // Requires explicit user input — safe default
    doubleGameWeek: gamesThisWeek >= 2,
    weeksOffTraining: 0,          // Requires session history — safe default
    readiness,
  };
}

/**
 * Create a WeekLog session entry from a placed conditioning result.
 * Used to accumulate placements as we walk through the week.
 */
export function conditioningToWeekLogEntry(
  dateStr: string,
  exerciseName: string,
): WeekLog['sessions'][0] {
  const meta = CONDITIONING_META[exerciseName];
  const tier: ConditioningTier = meta?.tier || 'C';

  // Fatigue maps directly from tier
  let fatigue: 'low' | 'moderate' | 'high' = 'low';
  if (tier === 'A' || tier === 'B-high') fatigue = 'high';
  else if (tier === 'B-low') fatigue = 'moderate';

  return { dateStr, tier, exerciseName, fatigue };
}

// ─── Internal Helpers ───

/** Map IntensityLevel to fatigue rating for strength sessions. */
function intensityToFatigue(intensity: string): 'low' | 'moderate' | 'high' {
  switch (intensity) {
    case 'Light': return 'low';
    case 'Moderate': return 'moderate';
    case 'High':
    case 'Maximal': return 'high';
    default: return 'moderate';
  }
}
