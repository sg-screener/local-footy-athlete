import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorageCompat } from './asyncStorageCompat';
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

function canonicalFactReadinessProjection(): Record<string, ReadinessSignal> | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const accepted = require('./acceptedStateColdStart').normalizeAcceptedMaterialContext(
    require('./programStore').useProgramStore.getState().acceptedMaterialContext,
  );
  return accepted.revision > 0 || accepted.temporarySourceFacts.length > 0
    ? accepted.readinessSignalsByDate
    : null;
}

function replaceWithCanonicalReadinessProjection(
  _date: string,
  _patch: Omit<Partial<ReadinessSignal>, 'date' | 'updatedAt'> | null,
): void {
  // Downstream compatibility only. ProgramStore's accepted context is the
  // sole publisher; stale callers are overwritten by its current projection.
  const projection = canonicalFactReadinessProjection();
  if (projection) useReadinessStore.setState({ signalsByDate: projection });
}

export const useReadinessStore = create<ReadinessState>()(
  persist(
    (set) => ({
      signalsByDate: {},

      setReadinessSignal: (date, signal) => {
        replaceWithCanonicalReadinessProjection(date, signal);
      },

      clearReadinessSignal: (date) => {
        replaceWithCanonicalReadinessProjection(date, null);
      },

      pruneBefore: (dateISO) => {
        void dateISO;
        const projection = canonicalFactReadinessProjection();
        if (projection) set({ signalsByDate: projection });
      },

      clear: () => {
        const projection = canonicalFactReadinessProjection();
        if (projection) set({ signalsByDate: projection });
      },
    }),
    {
      name: 'readiness-store',
      storage: createJSONStorage(() => asyncStorageCompat),
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
        // Compatibility hydration is downstream-only. Once ProgramStore has
        // accepted canonical state, replace any stale persisted readiness
        // alias with that projection; never publish this store upstream.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const accepted = require('./acceptedStateColdStart').normalizeAcceptedMaterialContext(
          require('./programStore').useProgramStore.getState().acceptedMaterialContext,
        );
        // At revision zero retain the raw mirror long enough for ProgramStore,
        // the sole migration owner, to consume it in either hydration order.
        // It is never published upstream from here.
        if (accepted.revision > 0 || accepted.temporarySourceFacts.length > 0) {
          useReadinessStore.setState({ signalsByDate: accepted.readinessSignalsByDate });
        }
      },
    },
  ),
);
