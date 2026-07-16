import { useProfileStore } from '../../store/profileStore';
import { useProgramStore } from '../../store/programStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useReadinessStore } from '../../store/readinessStore';
import { useCoachStore } from '../../store/coachStore';
import { useCoachMemoryStore } from '../../store/coachMemoryStore';
import { useCoachContextStateStore } from '../../store/coachContextStateStore';
import { usePendingCoachClarifierStore } from '../../store/pendingCoachClarifierStore';
import { useCoachMutationHistoryStore } from '../../store/coachMutationHistoryStore';
import { useCoachPreferencesStore } from '../../store/coachPreferencesStore';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import { useWorkoutLogStore } from '../../store/workoutLogStore';
import { useAthletePreferencesStore } from '../../store/athletePreferencesStore';
import { useUIStore } from '../../store/uiStore';
import { seedOnboardingProgram } from '../../utils/onboardingCompletion';
import { buildTemporaryEquipmentConstraint } from '../../utils/equipmentAvailability';
import {
  buildDevE2ESeed,
  validateDevE2EWitnesses,
  type DevE2EAuxiliaryState,
  type DevE2EWitnessState,
} from './devE2ESeedRegistry';
import {
  captureDevE2EMemoryFingerprints,
  clearDevE2ECheckpoint,
  fingerprintMapsMatch,
  readDevE2ECheckpoint,
  waitForDevE2EHydration,
  waitForDevE2EPersistence,
  writeDevE2ECheckpoint,
} from './devE2EPersistence';
import {
  DevE2ESeedCoordinator,
  type DevE2ECoordinatorDeps,
} from './DevE2ESeedCoordinator';

function clearLocalStateThroughPublicAPIs(): void {
  useCoachContextStateStore.getState().clearCoachContext();
  usePendingCoachClarifierStore.getState().clearPending();
  useWorkoutLogStore.getState().clear();
  useCoachStore.getState().clear();
  useCoachMemoryStore.getState().clearNotes();
  useCalendarStore.getState().clear();
  useReadinessStore.getState().clear();
  useCoachUpdatesStore.getState().clearAllCoachUpdates();
  useCoachMutationHistoryStore.getState().clearAll();
  useCoachPreferencesStore.getState().clearAllModalityPreferences();
  useAthletePreferencesStore.getState().clear();
  useUIStore.getState().clear();
  useProfileStore.getState().clear();
  // ProgramStore is last so no legacy mirror can republish old material.
  useProgramStore.getState().clear();
}

function applyAuxiliaryState(items: readonly DevE2EAuxiliaryState[]): void {
  for (const item of items) {
    if (item.kind === 'active_injury') {
      const timestamp = '2026-07-13T12:00:00.000Z';
      useCoachUpdatesStore.getState().setActiveInjury({
        bodyPart: item.bodyPart,
        bucket: item.injuryKey,
        severity: item.severity,
        initialSeverity: item.severity,
        status: 'active',
        rules: [],
        startDate: timestamp,
        lastUpdatedAt: timestamp,
        createdAt: timestamp,
        history: [],
      });
      useAthletePreferencesStore.getState().setActiveInjuries([item.injuryKey]);
      continue;
    }
    if (item.kind === 'temporary_equipment') {
      const constraint = buildTemporaryEquipmentConstraint({
        presetId: item.presetId,
        date: item.date,
        todayISO: `${item.date}T12:00:00.000Z`,
        source: 'system',
      });
      useCoachUpdatesStore.getState().upsertActiveConstraint(constraint);
      continue;
    }
    // Fixture installation stays inside the dev-only seed boundary. Live tap
    // and Coach ingress must use the canonical session-outcome transaction.
    useProgramStore.setState((state) => ({
      sessionFeedback: {
        ...state.sessionFeedback,
        [item.date]: {
          dateStr: item.date,
          completion: item.completion,
          feeling: item.feeling,
          soreness: item.soreness,
          difficulty: item.difficulty,
        },
      },
    }));
  }
}

function readWitnessState(): DevE2EWitnessState {
  const program = useProgramStore.getState();
  const updates = useCoachUpdatesStore.getState();
  return {
    program: program.currentProgram,
    profile: useProfileStore.getState().onboardingData,
    calendarMarks: useCalendarStore.getState().markedDays,
    activeInjury: updates.activeInjury,
    activeConstraints: updates.activeConstraints,
    sessionFeedback: program.sessionFeedback,
  };
}

const DEFAULT_DEPS: DevE2ECoordinatorDeps = {
  waitForHydration: waitForDevE2EHydration,
  resetLocalState: clearLocalStateThroughPublicAPIs,
  waitForPersistence: waitForDevE2EPersistence,
  buildSeed: buildDevE2ESeed,
  writeProfile: (seed) => useProfileStore.getState().updateOnboardingData(seed.profile),
  installProgram: (seed) => seedOnboardingProgram({
    onboardingData: seed.profile,
    program: seed.program,
  }),
  applyAuxiliaryState,
  completeOnboarding: () => useProfileStore.getState().completeOnboarding(),
  readWitnessState,
  validateWitnesses: validateDevE2EWitnesses,
  captureMemoryFingerprints: captureDevE2EMemoryFingerprints,
  fingerprintMapsMatch,
  writeCheckpoint: writeDevE2ECheckpoint,
  readCheckpoint: readDevE2ECheckpoint,
  clearCheckpoint: clearDevE2ECheckpoint,
};

export function createDefaultDevE2ESeedCoordinator(isDev: boolean): DevE2ESeedCoordinator {
  return new DevE2ESeedCoordinator(isDev, DEFAULT_DEPS);
}
