import { useEffect, useState } from 'react';
import { useProfileStore } from '../store/profileStore';
import {
  getSmokeRuntimeSignal,
  isSmokeBootstrapAllowed,
  runSmokeBootstrap,
} from '../utils/smokeBootstrap';
import { logger } from '../utils/logger';

interface UseInitializeAppReturn {
  isReady: boolean;
}

/**
 * Initialize app — waits for Zustand stores to rehydrate from
 * AsyncStorage, then handles the env-var smoke-bootstrap path.
 *
 * Deep-link Linking subscriptions (cold-start + warm-URL + polling
 * fallback) are owned by `installSmokeBootstrapListener`, which runs
 * at module-load time from App.tsx — that's the only place we can
 * register listeners early enough to catch Maestro's openLink, which
 * fires within milliseconds of cold-start. See
 * src/utils/smokeBootstrapInstaller.ts for the full rationale.
 *
 * This hook still handles the env-var path because:
 *   - it's a useful headless-CI escape hatch when no simulator is in
 *     play (e.g. EXPO_PUBLIC_SMOKE_BOOTSTRAP=coach-bike-flow);
 *   - env-vars are bundle-time and don't need a Linking subscription;
 *   - separating env from URL keeps the installer module free of any
 *     env-var conditionals and easier to reason about.
 *
 * Subscribing to `isOnboardingComplete` here keeps RootNavigator in
 * sync when the installer mutates the profile store.
 */
export function useInitializeApp(): UseInitializeAppReturn {
  const [isReady, setIsReady] = useState(false);

  // Tracked so RootNavigator re-renders when the smoke bootstrap flips
  // the gate true. The hook itself doesn't need the value, but keeping
  // the subscription here means useInitializeApp owns one consistent
  // view of "is the app booted enough to render".
  useProfileStore((state) => state.isOnboardingComplete);

  useEffect(() => {
    let cancelled = false;

    const bootstrapFromRuntimeSignal = async () => {
      const signal = getSmokeRuntimeSignal();
      if (!signal.flow) return;
      if (!isSmokeBootstrapAllowed()) {
        logger.warn(
          '[smoke-bootstrap] refused: smoke bootstrap flag set in non-dev build',
        );
        return;
      }
      logger.info(
        `[smoke-bootstrap] ${signal.source} flag detected flow=${signal.flow}`,
      );
      try {
        await runSmokeBootstrap({ flow: signal.flow });
      } catch (err: any) {
        logger.error(
          '[smoke-bootstrap] FAILED to run bootstrap from runtime flag',
          err?.message ?? err,
        );
      }
    };

    void bootstrapFromRuntimeSignal();

    // 300ms grace period to let Zustand persist rehydrate from
    // AsyncStorage before render.
    const t = setTimeout(() => {
      if (!cancelled) setIsReady(true);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  return { isReady };
}
