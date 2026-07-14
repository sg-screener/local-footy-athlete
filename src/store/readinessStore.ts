import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReadinessSignal } from '../utils/readiness';
import { normalizeAcceptedKeyedMap } from './acceptedStateColdStart';

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
    (set, get) => ({
      signalsByDate: {},

      setReadinessSignal: (date, signal) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitReadinessSignalTransaction({
          date,
          patch: signal,
        });
      },

      clearReadinessSignal: (date) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitReadinessSignalTransaction({
          date,
          patch: null,
        });
      },

      pruneBefore: (dateISO) => {
        const current = get().signalsByDate;
        const entries = Object.entries(current).filter(([date]) => date >= dateISO);
        if (entries.length === Object.keys(current).length) return;
        const next = Object.fromEntries(entries);
        const affectedDates = Object.keys(current).filter((date) => date < dateISO);
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitReadinessStateTransaction({
          reason: `readiness:prune:${dateISO}`,
          readinessSignalsByDate: next,
          affectedDates,
        });
      },

      clear: () => {
        const affectedDates = Object.keys(get().signalsByDate);
        if (affectedDates.length === 0) return;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitReadinessStateTransaction({
          reason: 'readiness:clear',
          readinessSignalsByDate: {},
          affectedDates,
        });
      },
    }),
    {
      name: 'readiness-store',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const incoming = (persisted as Partial<ReadinessState> | undefined) ?? {};
        return {
          ...current,
          ...incoming,
          signalsByDate: normalizeAcceptedKeyedMap<ReadinessSignal>(incoming.signalsByDate),
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return;
        const affectedDates = Object.keys(state.signalsByDate);
        if (affectedDates.length === 0) return;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitReadinessStateTransaction({
          reason: 'readiness:hydration_acceptance',
          readinessSignalsByDate: state.signalsByDate,
          affectedDates,
        });
      },
    },
  ),
);
