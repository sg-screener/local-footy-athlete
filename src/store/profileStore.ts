import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { OnboardingData } from '../types/domain';
import { normalizeOnboardingRole } from '../utils/roleBuckets';
import { asyncStorageCompat } from './asyncStorageCompat';

interface ProfileState {
  onboardingData: OnboardingData;
  isOnboardingComplete: boolean;
  isLoading: boolean;
  error: string | null;
  updateOnboardingData: (data: Partial<OnboardingData>) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

const initialOnboardingData: OnboardingData = {
  trainingLocation: 'Commercial gym',
  equipment: [
    'barbell',
    'dumbbells',
    'squat_rack',
    'pullup_bar',
    'cable_machine',
    'hamstring_curl',
    'knee_extension',
    'bands',
  ],
};

let acceptedProfileMirrorPublicationInProgress = false;

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      onboardingData: initialOnboardingData,
      isOnboardingComplete: false,
      isLoading: false,
      error: null,

      updateOnboardingData: (data) =>
        set((state) => ({
          onboardingData: normalizeOnboardingRole({
            ...state.onboardingData,
            ...data,
          }),
        })),

      completeOnboarding: () => {
        set({ isOnboardingComplete: true });
      },

      resetOnboarding: () => {
        set({
          onboardingData: initialOnboardingData,
          isOnboardingComplete: false,
        });
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      clear: () => {
        set({
          onboardingData: initialOnboardingData,
          isOnboardingComplete: false,
          isLoading: false,
          error: null,
        });
      },
    }),
    {
      name: 'profile-store',
      storage: createJSONStorage(() => asyncStorageCompat),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ProfileState> | undefined;
        return {
          ...currentState,
          ...persisted,
          onboardingData: normalizeOnboardingRole({
            ...currentState.onboardingData,
            ...(persisted?.onboardingData ?? {}),
          }),
        };
      },
    },
  ),
);

function canonicalAcceptedProfile(): OnboardingData | null {
  try {
    const accepted = require('./programStore').useProgramStore.getState().acceptedMaterialContext;
    return accepted.revision > 0 && accepted.acceptedProfileSnapshot
      ? accepted.acceptedProfileSnapshot.onboardingData
      : null;
  } catch {
    return null;
  }
}

/** ProgramStore's accepted profile is authoritative; ProfileStore is a read mirror. */
export function publishAcceptedProfileCompatibilityMirror(
  onboardingData: OnboardingData,
): void {
  acceptedProfileMirrorPublicationInProgress = true;
  try {
    useProfileStore.setState({
      onboardingData: normalizeOnboardingRole(onboardingData),
    });
  } finally {
    acceptedProfileMirrorPublicationInProgress = false;
  }
}

/** Restore the complete downstream profile mirror without triggering upstream fencing. */
export function restoreAcceptedProfileCompatibilityMirror(snapshot: {
  onboardingData: OnboardingData;
  isOnboardingComplete: boolean;
}): void {
  acceptedProfileMirrorPublicationInProgress = true;
  try {
    useProfileStore.setState({
      onboardingData: normalizeOnboardingRole(snapshot.onboardingData),
      isOnboardingComplete: snapshot.isOnboardingComplete,
    });
  } finally {
    acceptedProfileMirrorPublicationInProgress = false;
  }
}

useProfileStore.subscribe((state) => {
  if (acceptedProfileMirrorPublicationInProgress) return;
  const canonical = canonicalAcceptedProfile();
  if (!canonical ||
    JSON.stringify(state.onboardingData) === JSON.stringify(canonical)) return;
  acceptedProfileMirrorPublicationInProgress = true;
  try {
    useProfileStore.setState({
      onboardingData: normalizeOnboardingRole(canonical),
    });
  } finally {
    acceptedProfileMirrorPublicationInProgress = false;
  }
});
