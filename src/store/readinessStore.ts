import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReadinessSignal } from '../utils/readiness';

interface ReadinessState {
  signalsByDate: Record<string, ReadinessSignal>;
  setReadinessSignal: (
    date: string,
    signal: Omit<Partial<ReadinessSignal>, 'date' | 'updatedAt'>,
  ) => void;
  clearReadinessSignal: (date: string) => void;
  /**
   * Drop signals for dates strictly before `dateISO`. Only today's signal
   * is ever read (see selectActiveProgramModifiers / useSchedule), so past
   * signals go dormant the next day but were never deleted — this bounds
   * the store instead of letting them accumulate forever.
   */
  pruneBefore: (dateISO: string) => void;
  clear: () => void;
}

export const useReadinessStore = create<ReadinessState>()(
  persist(
    (set) => ({
      signalsByDate: {},

      setReadinessSignal: (date, signal) =>
        set((state) => {
          const previous = state.signalsByDate[date];
          const next: ReadinessSignal = {
            ...previous,
            ...signal,
            date,
            source: signal.source ?? previous?.source ?? 'quick_check',
            updatedAt: new Date().toISOString(),
          };
          return {
            signalsByDate: {
              ...state.signalsByDate,
              [date]: next,
            },
          };
        }),

      clearReadinessSignal: (date) =>
        set((state) => {
          const next = { ...state.signalsByDate };
          delete next[date];
          return { signalsByDate: next };
        }),

      pruneBefore: (dateISO) =>
        set((state) => {
          const entries = Object.entries(state.signalsByDate).filter(
            ([date]) => date >= dateISO,
          );
          if (entries.length === Object.keys(state.signalsByDate).length) {
            return state; // nothing dormant to drop
          }
          return { signalsByDate: Object.fromEntries(entries) };
        }),

      clear: () => set({ signalsByDate: {} }),
    }),
    {
      name: 'readiness-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
