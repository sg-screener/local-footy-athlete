import { useEffect, useState } from 'react';
import {
  awaitAppHydration,
  getAppHydrationState,
  subscribeToAppHydration,
  type AppHydrationState,
} from '../store/appHydrationGate';

interface UseInitializeAppReturn {
  isReady: boolean;
  hydration: AppHydrationState;
}

/**
 * App-start readiness.
 *
 * This used to release the UI after a flat grace period that checked nothing,
 * so onboarding could mount before AsyncStorage had been read
 * (docs/ONBOARDING_PERSISTENCE_DIAGNOSIS_2026-07-24.md §3.3). Readiness is now
 * the hydration gate's verdict: ready when every persisted store has hydrated,
 * failed when one did not. Never elapsed time.
 */
export function useInitializeApp(): UseInitializeAppReturn {
  const [hydration, setHydration] = useState<AppHydrationState>(getAppHydrationState);

  useEffect(() => {
    const unsubscribe = subscribeToAppHydration(setHydration);
    void awaitAppHydration().then(setHydration);
    return unsubscribe;
  }, []);

  return { isReady: hydration.status !== 'hydrating', hydration };
}
