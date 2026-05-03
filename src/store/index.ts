/**
 * Zustand Store Exports
 * Central export point for all application state stores
 */

export { useAuthStore } from './authStore';
export type { } from './authStore';

export { useProfileStore } from './profileStore';
export type { } from './profileStore';

export { useProgramStore } from './programStore';
export type { } from './programStore';

export { useWorkoutLogStore } from './workoutLogStore';
export type { } from './workoutLogStore';

export { useCoachStore } from './coachStore';
export type { } from './coachStore';

export { useUIStore } from './uiStore';
export type { } from './uiStore';

export {
  useAthletePreferencesStore,
  getAthletePrefs,
} from './athletePreferencesStore';
export type { } from './athletePreferencesStore';

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

  clearAuth();
  clearProfile();
  clearProgram();
  clearWorkoutLog();
  clearCoach();
  clearUI();
  clearAthletePrefs();
}
