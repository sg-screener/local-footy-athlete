import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorageCompat } from './asyncStorageCompat';
import { normalizeAcceptedKeyedMap } from './acceptedStateColdStart';

/**
 * Calendar Store — Game Day Management
 *
 * Stores manually-set overrides by date:
 *   'game'   → explicit game (user added or moved here)
 *   'rest'   → user-forced rest day
 *   'noGame' → explicit no-fixture override. It suppresses the recurring
 *              in-season game or pre-season practice match that would
 *              otherwise render on profile.usualGameDay.
 *
 * During In-season, the resolver renders a VIRTUAL game on
 * profile.usualGameDay every week automatically, sourced from
 * profile (not this store). That virtual game is suppressed when:
 *   - any other day in that week has an explicit 'game' mark, or
 *   - the usualGameDay itself has a 'noGame' mark.
 *
 * Date keys are ISO strings: 'YYYY-MM-DD'
 */

export type CalendarDayType = 'game' | 'rest' | 'noGame';

function commitMark(date: string, mark: CalendarDayType | null, expectedCurrentMark?: CalendarDayType): void {
  // Dynamic loading keeps the accepted transaction owner above the legacy
  // compatibility mirror without creating a store-initialisation cycle.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('./acceptedStateTransaction').commitCalendarMarkTransaction({
    date,
    mark,
    expectedCurrentMark,
  });
}

interface CalendarState {
  // Map of date string → day type
  markedDays: Record<string, CalendarDayType>;

  // Currently selected date (for modal interaction)
  selectedDate: string | null;

  // Actions
  setGameDay: (date: string) => void;
  removeGameDay: (date: string) => void;
  setRestDay: (date: string) => void;
  removeRestDay: (date: string) => void;
  setNoGame: (date: string) => void;
  removeNoGame: (date: string) => void;
  setSelectedDate: (date: string | null) => void;
  getGameDaysInRange: (startDate: string, endDate: string) => string[];
  getNextGameDay: (fromDate?: string) => string | null;
  /**
   * Wipe all 'game' and 'noGame' overrides (leaves 'rest' marks intact).
   * Used when leaving In-season so no stale game state survives.
   */
  clearAllGames: () => void;
  clear: () => void;
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      markedDays: {},
      selectedDate: null,

      setGameDay: (date) => commitMark(date, 'game'),

      removeGameDay: (date) => commitMark(date, null, 'game'),

      setRestDay: (date) => commitMark(date, 'rest'),

      removeRestDay: (date) => commitMark(date, null, 'rest'),

      setNoGame: (date) => commitMark(date, 'noGame'),

      removeNoGame: (date) => commitMark(date, null, 'noGame'),

      setSelectedDate: (date) => set({ selectedDate: date }),

      getGameDaysInRange: (startDate, endDate) => {
        const { markedDays } = get();
        return Object.entries(markedDays)
          .filter(([date, type]) => type === 'game' && date >= startDate && date <= endDate)
          .map(([date]) => date)
          .sort();
      },

      getNextGameDay: (fromDate) => {
        const { markedDays } = get();
        const from = fromDate || new Date().toISOString().split('T')[0];
        const gameDays = Object.entries(markedDays)
          .filter(([date, type]) => type === 'game' && date >= from)
          .map(([date]) => date)
          .sort();
        return gameDays[0] || null;
      },

      clearAllGames: () => {
        const current = get().markedDays;
        const updated: Record<string, CalendarDayType> = {};
        const affectedDates: string[] = [];
        for (const [date, type] of Object.entries(current)) {
          if (type === 'game' || type === 'noGame') {
            affectedDates.push(date);
            continue;
          }
          updated[date] = type;
        }
        if (affectedDates.length === 0) return;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitCalendarStateTransaction({
          reason: 'calendar:clear_all_games',
          markedDays: updated,
          affectedDates,
          fixtureChangedDates: affectedDates,
        });
      },

      clear: () => {
        const affectedDates = Object.keys(get().markedDays);
        if (affectedDates.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require('./acceptedStateTransaction').commitCalendarStateTransaction({
            reason: 'calendar:clear',
            markedDays: {},
            affectedDates,
            fixtureChangedDates: affectedDates,
          });
        }
        set({ selectedDate: null });
      },
    }),
    {
      name: 'calendar-storage',
      storage: createJSONStorage(() => asyncStorageCompat),
      partialize: (state) => ({ markedDays: state.markedDays }),
      merge: (persisted, current) => {
        const incoming = (persisted as Partial<CalendarState> | undefined) ?? {};
        return {
          ...current,
          ...incoming,
          markedDays: normalizeAcceptedKeyedMap<CalendarDayType>(incoming.markedDays),
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return;
        const affectedDates = Object.keys(state.markedDays);
        if (affectedDates.length === 0) return;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitCalendarStateTransaction({
          reason: 'calendar:hydration_acceptance',
          markedDays: state.markedDays,
          affectedDates,
          fixtureChangedDates: affectedDates.filter((date) =>
            state.markedDays[date] === 'game' || state.markedDays[date] === 'noGame'),
        });
      },
    }
  )
);
