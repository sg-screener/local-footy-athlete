/**
 * useStaleOverrides — React hooks for stale override detection.
 *
 * Thin wrappers around the pure detection logic in staleOverrideDetector.ts.
 * Re-derives on every render (same pattern as useSchedule — trivial cost).
 */

import { useProgramStore } from '../store/programStore';
import { useCalendarStore } from '../store/calendarStore';
import {
  detectStaleOverrides,
  isOverrideStale,
  type StaleOverrideWarning,
} from '../utils/staleOverrideDetector';

/**
 * Detect all stale overrides across the entire calendar.
 * Used by HomeScreen to show warnings on the week view.
 */
export function useStaleOverrides(): StaleOverrideWarning[] {
  const dateOverrides = useProgramStore((s) => s.dateOverrides);
  const overrideContexts = useProgramStore((s) => s.overrideContexts);
  const markedDays = useCalendarStore((s) => s.markedDays);

  return detectStaleOverrides(
    dateOverrides || {},
    overrideContexts || {},
    markedDays || {},
  );
}

/**
 * Check if a specific date's override is stale.
 * Used by DayWorkoutScreen to show a warning banner.
 */
export function useIsOverrideStale(date: string | undefined): StaleOverrideWarning | null {
  const dateOverrides = useProgramStore((s) => s.dateOverrides);
  const overrideContexts = useProgramStore((s) => s.overrideContexts);
  const markedDays = useCalendarStore((s) => s.markedDays);

  if (!date) return null;

  return isOverrideStale(
    date,
    dateOverrides || {},
    overrideContexts || {},
    markedDays || {},
  );
}
