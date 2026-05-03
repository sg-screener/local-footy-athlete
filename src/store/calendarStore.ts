import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Calendar Store — Game Day Management
 *
 * Stores manually-set overrides by date:
 *   'game'   → explicit game (user added or moved here)
 *   'rest'   → user-forced rest day
 *   'noGame' → explicit bye / "no game this week" override. Only
 *              meaningful in In-season, where a virtual game would
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

      setGameDay: (date) =>
        set((state) => ({
          markedDays: { ...state.markedDays, [date]: 'game' },
        })),

      removeGameDay: (date) =>
        set((state) => {
          const updated = { ...state.markedDays };
          if (updated[date] === 'game') delete updated[date];
          return { markedDays: updated };
        }),

      setRestDay: (date) =>
        set((state) => ({
          markedDays: { ...state.markedDays, [date]: 'rest' },
        })),

      removeRestDay: (date) =>
        set((state) => {
          const updated = { ...state.markedDays };
          if (updated[date] === 'rest') delete updated[date];
          return { markedDays: updated };
        }),

      setNoGame: (date) =>
        set((state) => ({
          markedDays: { ...state.markedDays, [date]: 'noGame' },
        })),

      removeNoGame: (date) =>
        set((state) => {
          const updated = { ...state.markedDays };
          if (updated[date] === 'noGame') delete updated[date];
          return { markedDays: updated };
        }),

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

      clearAllGames: () =>
        set((state) => {
          const updated: Record<string, CalendarDayType> = {};
          for (const [date, type] of Object.entries(state.markedDays)) {
            if (type === 'game' || type === 'noGame') continue;
            updated[date] = type;
          }
          return { markedDays: updated };
        }),

      clear: () => set({ markedDays: {}, selectedDate: null }),
    }),
    {
      name: 'calendar-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ markedDays: state.markedDays }),
    }
  )
);
