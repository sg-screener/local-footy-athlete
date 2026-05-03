import { useEffect, useState } from 'react';
import { useProfileStore } from '../store/profileStore';

interface UseInitializeAppReturn {
  isReady: boolean;
}

/**
 * Initialize app — waits for Zustand stores to rehydrate from AsyncStorage.
 * Does NOT seed default data or auto-complete onboarding.
 * Program generation will happen after onboarding is completed.
 */
export function useInitializeApp(): UseInitializeAppReturn {
  const [isReady, setIsReady] = useState(false);

  // We just need to wait for Zustand persist rehydration
  const isOnboardingComplete = useProfileStore(
    (state) => state.isOnboardingComplete
  );

  useEffect(() => {
    // Small delay to ensure stores are hydrated from AsyncStorage
    const timeout = setTimeout(() => {
      setIsReady(true);
    }, 300);

    return () => clearTimeout(timeout);
  }, []);

  return { isReady };
}
