import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { colors } from '../theme/colors';
import AppNavigator from './AppNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import { useInitializeApp } from '../hooks/useInitializeApp';
import { useProfileStore } from '../store/profileStore';
import { Loading } from '../components/common/Loading';
import { View } from 'react-native';
import { logger } from '../utils/logger';
import { navigationRef } from './navigationRef';
import {
  getCurrentLeafRouteName,
  setActualCurrentRoute,
  setNavReady,
} from './smokeNavState';
import { getSmokeRuntimeSignal } from '../utils/smokeBootstrap';

// Custom dark theme for navigation
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent.lime,
    background: colors.surface.primary,
    card: colors.surface.secondary,
    text: colors.text.primary,
    border: colors.input.border,
    notification: colors.status.error,
  },
};

/**
 * Root navigator — conditionally renders onboarding or main app.
 *
 * IMPORTANT: This is NOT a nested native stack.  It just switches which
 * navigator is mounted inside a single NavigationContainer.  Nesting two
 * native stacks caused Android to lose height constraints on inner screens,
 * which broke ScrollView everywhere in the onboarding flow.
 */
export default function RootNavigator() {
  const { isReady } = useInitializeApp();
  const isOnboardingComplete = useProfileStore(
    (state) => state.isOnboardingComplete,
  );
  const inSmokeMode = React.useMemo(
    () => getSmokeRuntimeSignal().flow === 'coach-bike-flow',
    [],
  );

  // Diagnostic log for the live-smoke wrapper — every navigator swap is
  // visible in the simulator log so we can correlate dev-skip → tabs-mounted.
  React.useEffect(() => {
    logger.info(
      `[navigation-state] isOnboardingComplete ${isOnboardingComplete ? 'true' : 'false'} isReady ${isReady ? 'true' : 'false'}`,
    );
  }, [isOnboardingComplete, isReady]);

  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface.primary,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Loading />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={navigationTheme}
      ref={navigationRef}
      onReady={() => {
        // Mirrors NavigationContainer's onReady event into the smoke
        // log stream so the wrapper can prove the container actually
        // reached the ready state (a prerequisite for the smoke route
        // enforcer's dispatch).
        logger.info('[navigation-container] onReady');
        // Update the smoke state machine. NavigationContainer.onReady
        // is the canonical "navigator is mounted and ready to dispatch"
        // signal. The SmokeRouteEnforcer is gated on navReady === true.
        setNavReady(true);
        // Also seed actualCurrentRoute from the post-mount tree so the
        // first state event isn't required to populate it.
        const initial = navigationRef.isReady()
          ? navigationRef.getRootState?.() ?? null
          : null;
        if (initial) {
          const leaf = getCurrentLeafRouteName(initial);
          if (leaf) {
            setActualCurrentRoute(leaf);
            logger.info(`[nav-route] currentRoute=${leaf}`);
          }
        }
      }}
      onStateChange={(state) => {
        // SINGLE SOURCE OF TRUTH for actualCurrentRoute. The previous
        // implementation used Tab.Navigator's screenListeners.state,
        // which only sees the Tab navigator's own state — when the
        // inner stack hadn't initialised, the recursion bottomed out
        // at "CoachTab" instead of "Coach", and route-current-Coach
        // never appeared. NavigationContainer.onStateChange fires for
        // ALL state changes anywhere in the tree, and getCurrentLeafRouteName
        // walks down to the deepest active leaf.
        const leaf = state ? getCurrentLeafRouteName(state) : null;
        if (leaf) {
          setActualCurrentRoute(leaf);
          logger.info(`[nav-route] currentRoute=${leaf}`);
        }
      }}
    >
      {isOnboardingComplete ? <AppNavigator /> : <OnboardingNavigator />}
      {/* Smoke-only root marker. Normal dev app launches must not show it. */}
      {__DEV__ && inSmokeMode ? (
        <View
          accessible={true}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 18,
            left: 6,
            width: 8,
            height: 8,
            backgroundColor: '#2196F3',
            zIndex: 999998,
            elevation: 999998,
          }}
          testID="root-navigator-live"
          accessibilityLabel="root-navigator-live"
        />
      ) : null}
    </NavigationContainer>
  );
}
