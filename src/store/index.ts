/**
 * Zustand Store Exports
 * Central export point for all application state stores
 */

// Import-then-re-export (NOT bare `export ... from`) because clearAllStores
// below needs local bindings — re-exports alone don't create them, which
// made clearAllStores a latent compile/runtime error.
//
// authStore and uiStore are RETIRED (Sam's §6 ruling, 2026-08-03): both
// persisted only never-written defaults — stored non-decisions under the
// north star. A future sign-in flow or UI store rebuilds under
// docs/STORE_ARMOUR_RECIPE_2026-08-03.md and the writer-audit ratchet.
import { useProfileStore } from './profileStore';
import { useProgramStore } from './programStore';
import { useWorkoutLogStore } from './workoutLogStore';
import { useCoachStore } from './coachStore';
import { useAthletePreferencesStore, getAthletePrefs } from './athletePreferencesStore';
import { useReadinessStore } from './readinessStore';

export {
  useProfileStore,
  useProgramStore,
  useWorkoutLogStore,
  useCoachStore,
  useAthletePreferencesStore,
  getAthletePrefs,
  useReadinessStore,
};

/**
 * Helper function to clear all stores (for logout)
 */
export function clearAllStores() {
  const { clear: clearProfile } = useProfileStore.getState();
  const { clear: clearProgram } = useProgramStore.getState();
  const { clear: clearWorkoutLog } = useWorkoutLogStore.getState();
  const { clear: clearCoach } = useCoachStore.getState();
  const { clear: clearAthletePrefs } = useAthletePreferencesStore.getState();
  const { clear: clearReadiness } = useReadinessStore.getState();

  clearProfile();
  clearProgram();
  clearWorkoutLog();
  clearCoach();
  clearAthletePrefs();
  clearReadiness();
}
