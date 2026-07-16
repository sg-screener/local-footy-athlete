import { useEffect, useState } from 'react';
import { useProfileStore } from '../store/profileStore';

interface UseInitializeAppReturn {
  isReady: boolean;
}

/** Existing app-start grace period; dev E2E readiness has its own hydration gate. */
export function useInitializeApp(): UseInitializeAppReturn {
  const [isReady, setIsReady] = useState(false);
  useProfileStore((state) => state.isOnboardingComplete);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return { isReady };
}
