/**
 * useSessionExplanation — Hook for "Why this session" data.
 *
 * Computes daysToGame and hasGameThisWeek from the calendar store, reads
 * seasonPhase from the profile store, then calls explainSession() with
 * a full SessionContext so off-season athletes never see game framing.
 */

import { useCalendarStore } from '../store/calendarStore';
import { useProfileStore } from '../store/profileStore';
import {
  explainSession,
  type SessionContext,
  type SessionExplanation,
} from '../utils/sessionExplanation';
import type { ResolvedDay } from '../utils/sessionResolver';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function dateMidnightMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
}

/**
 * Compute days until the next game from a given date.
 * Returns null if no future game exists in markedDays.
 */
function computeDaysToGame(
  dateStr: string,
  markedDays: Record<string, string>,
): number | null {
  const dateMs = dateMidnightMs(dateStr);
  let closest: number | null = null;

  for (const [gd, type] of Object.entries(markedDays)) {
    if (type !== 'game') continue;
    const diff = Math.round((dateMidnightMs(gd) - dateMs) / MS_PER_DAY);
    if (diff > 0 && (closest === null || diff < closest)) {
      closest = diff;
    }
  }

  return closest;
}

/**
 * True if any 'game' entry in markedDays falls within ±7 days of dateStr.
 * Used to gate game-related coaching language: in off-season or weeks with
 * no scheduled game, we never want phrasing like "before the weekend".
 */
function computeHasGameThisWeek(
  dateStr: string,
  markedDays: Record<string, string>,
): boolean {
  const dateMs = dateMidnightMs(dateStr);
  for (const [gd, type] of Object.entries(markedDays)) {
    if (type !== 'game') continue;
    const diffDays = Math.round((dateMidnightMs(gd) - dateMs) / MS_PER_DAY);
    if (Math.abs(diffDays) <= 7) return true;
  }
  return false;
}

function buildContext(
  dateStr: string,
  markedDays: Record<string, string>,
  seasonPhase: SessionContext['seasonPhase'],
): SessionContext {
  return {
    daysToGame: computeDaysToGame(dateStr, markedDays),
    hasGameThisWeek: computeHasGameThisWeek(dateStr, markedDays),
    seasonPhase,
  };
}

/**
 * Get explanation for a single ResolvedDay.
 */
export function useSessionExplanation(day: ResolvedDay | null): SessionExplanation | null {
  const markedDays = useCalendarStore((s) => s.markedDays) || {};
  const seasonPhase = useProfileStore((s) => s.onboardingData.seasonPhase);

  if (!day) return null;

  return explainSession(day, buildContext(day.date, markedDays, seasonPhase));
}

/**
 * Get explanations for an entire week of ResolvedDays.
 */
export function useWeekExplanations(weekDays: ResolvedDay[]): SessionExplanation[] {
  const markedDays = useCalendarStore((s) => s.markedDays) || {};
  const seasonPhase = useProfileStore((s) => s.onboardingData.seasonPhase);

  return weekDays.map((day) =>
    explainSession(day, buildContext(day.date, markedDays, seasonPhase)),
  );
}
