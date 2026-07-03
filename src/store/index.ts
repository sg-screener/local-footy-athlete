/**
 * Zustand Store Exports
 * Central export point for all application state stores
 */

// Import-then-re-export (NOT bare `export ... from`) because clearAllStores
// below needs local bindings — re-exports alone don't create them, which
// made clearAllStores a latent compile/runtime error.
import { useAuthStore } from './authStore';
import { useProfileStore } from './profileStore';
import { useProgramStore } from './programStore';
import { useWorkoutLogStore } from './workoutLogStore';
import { useCoachStore } from './coachStore';
import { useUIStore } from './uiStore';
import { useAthletePreferencesStore, getAthletePrefs } from './athletePreferencesStore';
import { useReadinessStore } from './readinessStore';

export {
  useAuthStore,
  useProfileStore,
  useProgramStore,
  useWorkoutLogStore,
  useCoachStore,
  useUIStore,
  useAthletePreferencesStore,
  getAthletePrefs,
  useReadinessStore,
};

/**
 * Helper function to clear all stores (for logout)
 */
export function clearAllStores() {
  const { clear: clearAuth } = useAuthStore.getState();
  const { clear: clearProfile } = useProfileStore.getState();
  const { clear: clearProgram } = useProgramStore.getState();
  const { clear: clearWorkoutLog } = useWorkoutLogStore.getState();
  const { clear: clearCoach } = useCoachStore.getState();
  const { clear: clearUI } = useUIStore.getState();
  const { clear: clearAthletePrefs } = useAthletePreferencesStore.getState();
  const { clear: clearReadiness } = useReadinessStore.getState();

  clearAuth();
  clearProfile();
  clearProgram();
  clearWorkoutLog();
  clearCoach();
  clearUI();
  clearAthletePrefs();
  clearReadiness();
}
