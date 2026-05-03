/**
 * Stale Override Detector — Pure detection logic for game-proximity overrides
 * that may no longer match the current calendar.
 *
 * DESIGN PRINCIPLES:
 *   - Pure functions only (no React, no Zustand)
 *   - Two detection paths:
 *     1. Structured: OverrideContext.intent === 'gameProximity' + relatedGameDate
 *     2. Heuristic: workout name keyword matching (backward compat for pre-context overrides)
 *   - Never mutates overrides — detection only, action is in the UI layer
 *   - Lives alongside sessionResolver.ts as a scheduling-adjacent utility
 */

import type { Workout, OverrideContext } from '../types/domain';
import type { CalendarDayType } from '../store/calendarStore';
import { addDays } from './sessionResolver';

// ─── Types ───

export interface StaleOverrideWarning {
  /** ISO date of the override */
  date: string;
  /** The override workout */
  workout: Workout;
  /** Human-readable reason why it looks stale */
  reason: string;
  /** Detection method used */
  detectedBy: 'context' | 'heuristic';
}

// ─── Keyword patterns for heuristic detection ───

/** Keywords in workout names that suggest game-proximity intent. */
const GAME_PROXIMITY_KEYWORDS = [
  'pre-game',
  'post-game',
  'g+1',
  'g-1',
  'g-2',
  'game day',
  'arms / pump',    // common G-1 replacement
  'arms/pump',
];

/** Keywords that suggest recovery intent (only stale if no nearby game). */
const RECOVERY_KEYWORDS = [
  'recovery',
  'flush',
  'mobilise',
  'restore',
];

// ─── Helpers ───

function getAllGameDates(markedDays: Record<string, CalendarDayType>): Set<string> {
  const games = new Set<string>();
  for (const [date, type] of Object.entries(markedDays)) {
    if (type === 'game') games.add(date);
  }
  return games;
}

/**
 * Check whether a game exists within `range` days of a date.
 * Range of 2 covers G-2 through G+2 which is the full proximity window.
 */
function hasNearbyGame(date: string, gameDates: Set<string>, range: number = 2): boolean {
  for (let offset = -range; offset <= range; offset++) {
    if (gameDates.has(addDays(date, offset))) return true;
  }
  return false;
}

/**
 * Heuristic: classify the game-proximity relationship implied by the workout name.
 *
 * Returns:
 *   'pre-game'  — implies G-1 (game should be the NEXT day)
 *   'post-game' — implies G+1 (game should be the PREVIOUS day)
 *   'generic'   — implies some nearby game (G-2 through G+2)
 *   null        — doesn't look game-proximity-related
 */
function classifyProximityIntent(workout: Workout): 'pre-game' | 'post-game' | 'generic' | null {
  const text = `${workout.name} ${workout.description}`.toLowerCase();

  // Specific relationships first
  if (text.includes('pre-game') || text.includes('g-1')) return 'pre-game';
  if (text.includes('post-game') || text.includes('g+1')) return 'post-game';

  // Generic proximity keywords
  if (text.includes('g-2') || text.includes('game day')) return 'generic';
  if (text.includes('arms / pump') || text.includes('arms/pump')) return 'pre-game';

  // Recovery is only flagged if the name explicitly mentions game context
  const hasRecoveryKeyword = RECOVERY_KEYWORDS.some(k => text.includes(k));
  const hasGameReference = text.includes('game') || text.includes('match');
  if (hasRecoveryKeyword && hasGameReference) return 'post-game';

  return null;
}

// ─── Core Detection ───

/**
 * Detect stale overrides across all manual overrides.
 *
 * Two detection paths (structured then heuristic):
 *
 * 1. STRUCTURED (preferred): If the override has an OverrideContext with
 *    intent='gameProximity' and a relatedGameDate, check if that game date
 *    still has a game mark. If not, the override is stale.
 *
 * 2. HEURISTIC (backward compat): If no OverrideContext exists, check if
 *    the workout name contains game-proximity keywords AND there's no game
 *    within 2 days. This catches overrides created before the context system.
 *
 * Returns an array of warnings (empty = no stale overrides detected).
 */
export function detectStaleOverrides(
  manualOverrides: Record<string, Workout>,
  overrideContexts: Record<string, OverrideContext>,
  markedDays: Record<string, CalendarDayType>,
): StaleOverrideWarning[] {
  const warnings: StaleOverrideWarning[] = [];
  const gameDates = getAllGameDates(markedDays);

  for (const [date, workout] of Object.entries(manualOverrides)) {
    const context = overrideContexts[date];

    // Skip dismissed overrides — user already reviewed and chose to keep
    if (context?.intent === 'dismissed') continue;

    // Path 1: Structured detection via OverrideContext
    if (context?.intent === 'gameProximity' && context.relatedGameDate) {
      if (!gameDates.has(context.relatedGameDate)) {
        warnings.push({
          date,
          workout,
          reason: `This ${context.label || 'session'} was set for the game on ${formatFriendlyDate(context.relatedGameDate)}, but that game has moved or been removed.`,
          detectedBy: 'context',
        });
        continue; // don't double-flag with heuristic
      }
      // Game still exists — but check if it's still nearby this override date
      if (!hasNearbyGame(date, new Set([context.relatedGameDate]), 2)) {
        warnings.push({
          date,
          workout,
          reason: `This ${context.label || 'session'} was set relative to the game on ${formatFriendlyDate(context.relatedGameDate)}, but that game is no longer near ${formatFriendlyDate(date)}.`,
          detectedBy: 'context',
        });
        continue;
      }
    }

    // Path 2: Heuristic detection via workout name keywords
    // Only if no structured context exists (backward compat)
    if (!context) {
      const intent = classifyProximityIntent(workout);
      if (intent) {
        let isStale = false;
        let reason = '';

        if (intent === 'pre-game') {
          // Pre-game implies G-1: game should be the next day
          const gameNextDay = gameDates.has(addDays(date, 1));
          if (!gameNextDay) {
            isStale = true;
            reason = `"${workout.name}" looks like a pre-game (G-1) session, but there's no game the next day.`;
          }
        } else if (intent === 'post-game') {
          // Post-game implies G+1: game should be the previous day
          const gamePrevDay = gameDates.has(addDays(date, -1));
          if (!gamePrevDay) {
            isStale = true;
            reason = `"${workout.name}" looks like a post-game (G+1) session, but there's no game the day before.`;
          }
        } else {
          // Generic: any game within 2 days
          if (!hasNearbyGame(date, gameDates, 2)) {
            isStale = true;
            reason = `"${workout.name}" looks like a game-day adjustment, but there's no game nearby on the calendar.`;
          }
        }

        if (isStale) {
          warnings.push({ date, workout, reason, detectedBy: 'heuristic' });
        }
      }
    }
  }

  return warnings;
}

/**
 * Check a single date for a stale override.
 * Convenience wrapper used by individual day views.
 */
export function isOverrideStale(
  date: string,
  manualOverrides: Record<string, Workout>,
  overrideContexts: Record<string, OverrideContext>,
  markedDays: Record<string, CalendarDayType>,
): StaleOverrideWarning | null {
  if (!manualOverrides[date]) return null;
  const warnings = detectStaleOverrides(
    { [date]: manualOverrides[date] },
    overrideContexts,
    markedDays,
  );
  return warnings.length > 0 ? warnings[0] : null;
}

// ─── Display Helpers ───

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatFriendlyDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  return `${DAY_SHORT[date.getDay()]} ${d} ${MONTH_SHORT[m - 1]}`;
}
