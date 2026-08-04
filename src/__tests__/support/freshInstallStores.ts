/**
 * resetStoresToFreshInstall — ONE owner for "put every store back to a state a
 * fresh install could actually be in".
 *
 * Extracted from `athleteActionWalkerTests.freshInstall` on 2026-08-04, when a
 * second suite (the session-list combination matrix) needed the same reset and
 * a weaker second copy immediately failed: leftover accepted state made the
 * second `commitRebuiltProgram` of a run throw
 * `AcceptedStateLedgerMismatchError`. That is the walker's own warning coming
 * true from the outside —
 *
 *   "A FRESH INSTALL IS TOTAL OR IT IS NOT A FRESH INSTALL. […] A reset that
 *    leaves a door open makes every reproduction in this file a coin toss, and
 *    the shrinker's minimal history a lie."
 *
 * — so the list lives in one place and grows in one place. Stores that own a
 * named reset act are reset THROUGH it, never with a bare default write: the
 * armour refuses a default over answered state, and a harness must not bypass
 * the owners it is testing.
 *
 * The caller still clears its own `localStorage` stub (each suite installs its
 * own Map) and its own harness-local flags.
 */
import { useProgramStore } from '../../store/programStore';
import { useProfileStore } from '../../store/profileStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useReadinessStore } from '../../store/readinessStore';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import { useCoachMutationHistoryStore } from '../../store/coachMutationHistoryStore';
import { useAthletePreferencesStore } from '../../store/athletePreferencesStore';
import { useCoachPreferencesStore } from '../../store/coachPreferencesStore';
import { useCoachStore } from '../../store/coachStore';
import { useCoachMemoryStore } from '../../store/coachMemoryStore';
import { createEmptyReversibleAdjustmentLedger } from '../../rules/reversibleAdjustmentLedger';
import type { OnboardingData } from '../../types/domain';

export function resetStoresToFreshInstall(reason: string): void {
  useProfileStore.setState({
    onboardingData: {} as OnboardingData,
    isOnboardingComplete: false,
  });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useCoachMutationHistoryStore.getState().clearAll();
  // Through the stores' own reset doors — the armour refuses a raw default
  // write over answered prefs, and a fresh install must not bypass the owners.
  useAthletePreferencesStore.getState().clear();
  useCoachPreferencesStore.getState().clearAllModalityPreferences();
  useCoachStore.getState().clear();
  useCoachMemoryStore.getState().clearNotes();
  // The LR-23 in-memory stores: reset through their own actions. (The
  // `getCoachRevisionTemplateContext` module singleton is a third confirmed
  // carrier with no reset API — DECLARED in the day-shift log, not reset here.)
  require('../../store/pendingCoachClarifierStore')
    .usePendingCoachClarifierStore.getState().reset();
  require('../../store/coachContextStateStore')
    .useCoachContextStateStore.getState().clearCoachContext();
  useProgramStore.setState({
    currentProgram: null, currentMicrocycle: null, todayWorkout: null,
    isGenerating: false, isLoading: false, error: null, blockState: null,
    acceptedMaterialContext: {
      markedDays: {}, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 0, lastTransaction: reason,
      injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
  } as never);
}
