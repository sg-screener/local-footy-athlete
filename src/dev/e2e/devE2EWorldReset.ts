/** One dev-harness owner for returning every durable athlete input to empty. */
import { useWorkoutLogStore } from '../../store/workoutLogStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useReadinessStore } from '../../store/readinessStore';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import { useCoachPreferencesStore } from '../../store/coachPreferencesStore';
import { useAthletePreferencesStore } from '../../store/athletePreferencesStore';
import { useDecisionLedgerStore } from '../../store/decisionLedgerStore';
import { useBlockSelectionHistoryStore } from '../../store/blockSelectionHistoryStore';
import { useProfileStore } from '../../store/profileStore';
import { useProgramStore } from '../../store/programStore';
import { clearAthleteActionDiagnosticEvents } from '../../utils/athleteActionDiagnostics';

export function resetDevE2EWorldThroughPublicAPIs(): void {
  clearAthleteActionDiagnosticEvents();
  useWorkoutLogStore.getState().clear();
  useCalendarStore.getState().clear();
  useReadinessStore.getState().clear();
  useCoachUpdatesStore.getState().clearAllCoachUpdates();
  useCoachPreferencesStore.getState().clearAllModalityPreferences();
  useAthletePreferencesStore.getState().clear();
  // These two histories sit outside ProgramStore. Leaving either one behind
  // makes the next generated athlete inherit decisions from the last one.
  useDecisionLedgerStore.getState().clear();
  useBlockSelectionHistoryStore.getState().clear();
  useProfileStore.getState().clear();
  // ProgramStore stays last so no compatibility mirror can republish material.
  useProgramStore.getState().clear();
}
