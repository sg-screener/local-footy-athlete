import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingData } from '../types/domain';
import { normalizeOnboardingRole } from '../utils/roleBuckets';

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
      storage: createJSONStorage(() => AsyncStorage),
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
