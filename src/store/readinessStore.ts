import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReadinessSignal } from '../utils/readiness';
import { normalizeAcceptedKeyedMap } from './acceptedStateColdStart';
import { getMondayForDate } from '../utils/sessionResolver';
import {
  athleteActionDiagnosticHash,
  athleteActionErrorCode,
  athleteActionTerminalReasonChain,
  beginAthleteActionTrace,
  classifyAthleteActionFailure,
  emitAthleteActionEvent,
  runWithAthleteActionTrace,
} from '../utils/athleteActionDiagnostics';

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

function commitReadinessSignalWithTrace(
  date: string,
  patch: Omit<Partial<ReadinessSignal>, 'date' | 'updatedAt'> | null,
): void {
  const diagnosticSource = patch?.source === 'coach_message' ? 'coach' : 'tap';
  const trace = beginAthleteActionTrace({
    source: diagnosticSource,
    actionType: 'readiness_change',
    route: 'readiness_store',
    currentWeekId: getMondayForDate(date),
    targetDate: date,
    sessionDate: date,
    scope: 'single_date',
  });
  runWithAthleteActionTrace(trace, () => {
    emitAthleteActionEvent(trace, 'athlete_action_parsed', {
      parsedMutationType: patch ? 'set_readiness_signal' : 'clear_readiness_signal',
      readinessPatchHash: athleteActionDiagnosticHash(patch),
    });
    emitAthleteActionEvent(trace, 'athlete_action_route_selected', {
      selectedRoute: 'accepted_readiness_transaction',
      producer: 'readinessStore',
    });
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('./acceptedStateTransaction').commitReadinessSignalTransaction({ date, patch });
      const internalResultCode = patch ? 'readiness_signal_set' : 'readiness_signal_cleared';
      emitAthleteActionEvent(trace, 'athlete_action_completed', {
        outcome: 'accepted',
        internalResultCode,
        targetDate: date,
      });
      emitAthleteActionEvent(trace, 'athlete_ui_outcome_shown', {
        uiSurface: 'readiness_control',
        uiOutcome: 'success',
        internalResultCode,
        finalUiMessageKey: internalResultCode,
      });
    } catch (error) {
      const rejectionCode = athleteActionErrorCode(error, 'readiness_signal_unknown_error');
      emitAthleteActionEvent(trace, 'athlete_action_failed', {
        outcome: 'threw',
        internalResultCode: 'readiness_signal_failed',
        originalRejectionCode: rejectionCode,
        rejectionCodes: [rejectionCode],
        firstFailingBoundary: 'commitReadinessSignalTransaction',
        failureCategory: classifyAthleteActionFailure(rejectionCode, 'readiness'),
        validCandidateExisted: false,
        previousStateRestored: true,
        terminalReasonChain: athleteActionTerminalReasonChain(trace.traceId),
      });
      throw error;
    }
  });
}

export const useReadinessStore = create<ReadinessState>()(
  persist(
    (set, get) => ({
      signalsByDate: {},

      setReadinessSignal: (date, signal) => {
        commitReadinessSignalWithTrace(date, signal);
      },

      clearReadinessSignal: (date) => {
        commitReadinessSignalWithTrace(date, null);
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
