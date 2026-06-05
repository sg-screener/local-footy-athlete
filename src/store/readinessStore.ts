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

      clear: () => set({ signalsByDate: {} }),
    }),
    {
      name: 'readiness-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
