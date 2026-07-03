import React from 'react';
import { View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/colors';
import { logger } from '../utils/logger';
import { navigationRef } from './navigationRef';
import {
  getActiveSmokeInitialRoute,
  getSmokeInitialRoute,
  getSmokeRuntimeSignal,
  subscribeToActiveSmokeInitialRoute,
} from '../utils/smokeBootstrap';
import {
  getSmokeNavStateSnapshot,
  setRouteEnforcerRequested,
  subscribeSmokeNavState,
  type SmokeNavStateSnapshot,
} from './smokeNavState';
// SmokeCoachBikeHarness intentionally NOT imported here — it is
// mounted at App.tsx level (unconditional in __DEV__) so it reaches
// the live UI tree the moment the app renders, with no dependency on
// AppNavigator / NavigationContainer / onboarding state. Mounting
// here would create duplicate testIDs (Maestro hits "ambiguous match").

// Screen imports
import HomeScreen from '../screens/home/HomeScreen';
import { DayWorkoutScreen } from '../screens/home/DayWorkoutScreen';
import CoachScreen from '../screens/coach/CoachScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import FAQScreen from '../screens/profile/FAQScreen';
import { PrivacyScreen } from '../screens/profile/PrivacyScreen';
import { TermsScreen } from '../screens/profile/TermsScreen';

type ProgramStackParamList = {
  Home: { initialDate?: string } | undefined;
  DayWorkout: { workoutId: string; date?: string; startFinished?: boolean };
};

type CoachStackParamList = {
  Coach: { prefill?: string } | undefined;
};

type ProfileStackParamList = {
  Profile: undefined;
  FAQ: undefined;
  Privacy: undefined;
  Terms: undefined;
};

type TabParamList = {
  ProgramTab: { screen: string; params?: Record<string, any> } | undefined;
  CoachTab: { screen: string; params?: { prefill?: string } } | undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const ProgramStack = createNativeStackNavigator<ProgramStackParamList>();
const CoachStack = createNativeStackNavigator<CoachStackParamList>();
const ProfileStackNav = createNativeStackNavigator<ProfileStackParamList>();

function currentRouteName(state: any): string {
  if (!state || !Array.isArray(state.routes) || state.routes.length === 0) {
    return 'unknown';
  }
  const route = state.routes[state.index ?? 0];
  return route?.state ? currentRouteName(route.state) : route?.name || 'unknown';
}

// Clean SVG icons
function ProgramIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <Path d="M9 5a2 2 0 012-2h2a2 2 0 012 2v0a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      <Path d="M9 12h6" />
      <Path d="M9 16h6" />
    </Svg>
  );
}

function CoachIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </Svg>
  );
}

function ProfileIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <Path d="M12 3a4 4 0 100 8 4 4 0 000-8z" />
    </Svg>
  );
}

function ProgramStackNavigator() {
  return (
    <ProgramStack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
      <ProgramStack.Screen name="Home" component={HomeScreen} />
      <ProgramStack.Screen name="DayWorkout" component={DayWorkoutScreen} />
    </ProgramStack.Navigator>
  );
}

function CoachStackNavigator() {
  return (
    <CoachStack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
      <CoachStack.Screen name="Coach" component={CoachScreen} />
    </CoachStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStackNav.Navigator id={undefined} screenOptions={{ headerShown: false }}>
      <ProfileStackNav.Screen name="Profile" component={ProfileScreen} />
      <ProfileStackNav.Screen name="FAQ" component={FAQScreen} />
      <ProfileStackNav.Screen name="Privacy" component={PrivacyScreen} />
      <ProfileStackNav.Screen name="Terms" component={TermsScreen} />
    </ProfileStackNav.Navigator>
  );
}

const HIDDEN_MARKER_STYLE = {
  position: 'absolute' as const,
  width: 1,
  height: 1,
  minWidth: 1,
  minHeight: 1,
};

/**
 * Imperative route enforcer for smoke mode.
 *
 * Gate: this component does NOTHING until the smoke state machine
 * reports BOTH navReady === true AND bootstrapComplete === true AND
 * routeIntent === 'Coach'. Only then does it dispatch
 *
 *   CommonActions.reset({ index: 0, routes: [{ name: 'CoachTab' }] })
 *
 * via the singleton `navigationRef`. The dispatch is fired exactly
 * once per app lifetime (guarded by a ref + state-machine
 * routeEnforcerRequested flag). After dispatch, the actual current
 * route updates flow through NavigationContainer.onStateChange (in
 * RootNavigator) → setActualCurrentRoute(...) → re-render here →
 * marker switches.
 *
 * Why this gate matters. Earlier versions polled navigationRef.isReady()
 * directly, which can return true the moment the container mounts,
 * BEFORE bootstrap has wiped the persona/program. Dispatching reset at
 * that moment can race with the bootstrap's own store mutations and
 * leave the navigator on Program. The state-machine gate forces the
 * canonical order: bootstrap stores → navReady → enforce route.
 *
 * Logs (asserted by the wrapper):
 *   [smoke-route-enforcer] gate ready: navReady=true bootstrapComplete=true routeIntent=Coach
 *   [smoke-route-enforcer] navigation ready
 *   [smoke-route-enforcer] currentRoute=<name>
 *   [smoke-route-enforcer] requested CoachTab
 *   [smoke-route-enforcer] navigated CoachTab
 */
function SmokeRouteEnforcer({ snapshot }: { snapshot: SmokeNavStateSnapshot }) {
  const enforcedRef = React.useRef(false);
  const { navReady, bootstrapComplete, routeIntent } = snapshot;
  const gateOpen =
    navReady && bootstrapComplete && routeIntent === 'Coach';

  React.useEffect(() => {
    if (!gateOpen) return;
    if (enforcedRef.current) return;
    enforcedRef.current = true;

    logger.info(
      `[smoke-route-enforcer] gate ready: navReady=true bootstrapComplete=true routeIntent=${routeIntent}`,
    );

    if (!navigationRef.isReady()) {
      // navReady was set by RootNavigator.onReady — if isReady() is
      // still false here something is very wrong (the ref isn't
      // actually attached). Surface it loudly.
      logger.error(
        '[smoke-route-enforcer] gate said navReady but navigationRef.isReady() is false',
      );
      return;
    }
    logger.info('[smoke-route-enforcer] navigation ready');
    const current = navigationRef.getCurrentRoute()?.name;
    logger.info(
      `[smoke-route-enforcer] currentRoute=${current ?? 'unknown'}`,
    );
    setRouteEnforcerRequested(true);
    if (current === 'Coach') {
      logger.info(
        '[smoke-route-enforcer] already on Coach; dispatch skipped',
      );
      return;
    }
    logger.info('[smoke-route-enforcer] requested CoachTab');
    try {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'CoachTab' }],
        }),
      );
      logger.info('[smoke-route-enforcer] navigated CoachTab');
    } catch (err) {
      const message = String((err as Error)?.message ?? err);
      logger.error(`[smoke-route-enforcer] dispatch failed: ${message}`);
    }
  }, [gateOpen, routeIntent]);

  return null;
}

/**
 * Inner navigator: only mounted once the smoke initial route has been
 * resolved (or smoke mode is not active).
 *
 * EVERY smoke marker rendered here is derived from
 * `getSmokeNavStateSnapshot()` — the single authoritative state
 * machine. There is no local "currentRoute" useState anymore. The flow
 * is:
 *
 *   NavigationContainer.onStateChange (RootNavigator)
 *     → setActualCurrentRoute(getCurrentLeafRouteName(state))
 *     → smoke-state subscribers re-render
 *     → ResolvedAppNavigator picks up the new snapshot
 *     → smoke-route-current-Coach / smoke-bootstrap-route-ready / route-current-${name}
 *       update atomically
 *
 * Invariants enforced by the markers below:
 *   - `smoke-bootstrap-route-ready` renders ONLY when
 *     actualCurrentRoute === 'Coach' AND routeIntent === 'Coach'.
 *   - `smoke-route-mismatch` renders when routeEnforcerRequested is
 *     true but actualCurrentRoute !== routeIntent.
 *   - `route-current-${actualCurrentRoute}` renders only when
 *     actualCurrentRoute is a non-null leaf — never the sentinel.
 *   - `main-tabs-root` is NOT a smoke readiness gate. It is a layout
 *     wrapper.
 */
function ResolvedAppNavigator({
  initialTabRoute,
  inSmokeMode,
}: {
  initialTabRoute: keyof TabParamList;
  inSmokeMode: boolean;
}) {
  const snapshot = React.useSyncExternalStore(
    subscribeSmokeNavState,
    getSmokeNavStateSnapshot,
    getSmokeNavStateSnapshot,
  );

  React.useEffect(() => {
    logger.info(`[app-navigator] initialRouteName=${initialTabRoute}`);
    logger.info('[tabs-mounted] true');
    return () => {
      logger.info('[tabs-mounted] false');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Derived booleans (all from the state machine) ───────────────
  const showBootstrapComplete = inSmokeMode && snapshot.bootstrapComplete;
  const showNavReady = inSmokeMode && snapshot.navReady;
  const intentIsCoach = inSmokeMode && snapshot.routeIntent === 'Coach';
  const actualRouteIsCoach =
    inSmokeMode && snapshot.actualCurrentRoute === 'Coach';
  const routeReady = intentIsCoach && actualRouteIsCoach;
  // Mismatch: enforcer fired, but the actual route never converged on
  // the intent. Used as a structural diagnostic — Maestro can assert
  // !smoke-route-mismatch as a sanity check.
  const routeMismatch =
    inSmokeMode &&
    snapshot.routeEnforcerRequested &&
    snapshot.actualCurrentRoute !== null &&
    snapshot.actualCurrentRoute !== snapshot.routeIntent;
  const showCoachReady = inSmokeMode && snapshot.coachReady;

  React.useEffect(() => {
    if (routeReady) {
      logger.info('[app-navigator] smoke-bootstrap-route-ready');
    }
  }, [routeReady]);

  React.useEffect(() => {
    if (routeMismatch) {
      logger.error(
        `[smoke-route-error] intent=${snapshot.routeIntent} actual=${snapshot.actualCurrentRoute}`,
      );
    }
  }, [routeMismatch, snapshot.routeIntent, snapshot.actualCurrentRoute]);

  return (
    // main-tabs-root remains as a layout/structural marker so existing
    // non-smoke flows (and dev tooling) can find the tab shell. It is
    // explicitly NOT used as a smoke readiness gate any more — the YAML
    // and wrapper diagnostics treat it as informational only.
    <View style={{ flex: 1 }} testID="main-tabs-root" accessibilityLabel="Main tabs">
      {showBootstrapComplete ? (
        <View
          accessible={false}
          pointerEvents="none"
          style={HIDDEN_MARKER_STYLE}
          testID="smoke-bootstrap-complete"
          accessibilityLabel="smoke-bootstrap-complete"
        />
      ) : null}
      {showNavReady ? (
        <View
          accessible={false}
          pointerEvents="none"
          style={HIDDEN_MARKER_STYLE}
          testID="smoke-nav-ready"
          accessibilityLabel="smoke-nav-ready"
        />
      ) : null}
      {intentIsCoach ? (
        <View
          accessible={false}
          pointerEvents="none"
          style={HIDDEN_MARKER_STYLE}
          testID="smoke-route-intent-Coach"
          accessibilityLabel="smoke-route-intent-Coach"
        />
      ) : null}
      {actualRouteIsCoach ? (
        <View
          accessible={false}
          pointerEvents="none"
          style={HIDDEN_MARKER_STYLE}
          testID="smoke-route-current-Coach"
          accessibilityLabel="smoke-route-current-Coach"
        />
      ) : null}
      {routeReady ? (
        <View
          accessible={false}
          pointerEvents="none"
          style={HIDDEN_MARKER_STYLE}
          testID="smoke-bootstrap-route-ready"
          accessibilityLabel="smoke-bootstrap-route-ready"
        />
      ) : null}
      {routeMismatch ? (
        <View
          accessible={false}
          pointerEvents="none"
          style={HIDDEN_MARKER_STYLE}
          testID="smoke-route-mismatch"
          accessibilityLabel="smoke-route-mismatch"
        />
      ) : null}
      {showCoachReady ? (
        <View
          accessible={false}
          pointerEvents="none"
          style={HIDDEN_MARKER_STYLE}
          testID="smoke-coach-ready"
          accessibilityLabel="smoke-coach-ready"
        />
      ) : null}
      <SmokeRouteEnforcer snapshot={snapshot} />
      <Tab.Navigator
        id={undefined}
        initialRouteName={initialTabRoute}
        screenOptions={{
          headerShown: false,
          lazy: false,
          tabBarStyle: {
            backgroundColor: '#0C0C0C',
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
            height: 84,
            paddingTop: 12,
            paddingBottom: 28,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
            letterSpacing: 0.3,
            marginTop: 4,
          },
          tabBarActiveTintColor: '#C8FF00',
          tabBarInactiveTintColor: '#555555',
          tabBarItemStyle: {
            gap: 2,
          },
        }}
      >
        {/*
          In @react-navigation/bottom-tabs v7 the option that lands on the
          rendered <Pressable> as `testID` is `tabBarButtonTestID`, NOT
          `tabBarTestID`. Don't rename these without confirming against
          node_modules/@react-navigation/bottom-tabs/src/views/BottomTabBar.tsx.
        */}
        <Tab.Screen
          name="ProgramTab"
          component={ProgramStackNavigator}
          options={{
            title: 'Program',
            tabBarIcon: ({ color }) => <ProgramIcon color={color} size={22} />,
            tabBarButtonTestID: 'tab-program',
            tabBarAccessibilityLabel: 'Program tab',
          }}
          listeners={{
            tabPress: () => {
              logger.info('[tab-press] program');
            },
          }}
        />
        <Tab.Screen
          name="CoachTab"
          component={CoachStackNavigator}
          options={{
            title: 'Coach',
            tabBarIcon: ({ color }) => <CoachIcon color={color} size={22} />,
            tabBarButtonTestID: 'tab-coach',
            tabBarAccessibilityLabel: 'Coach tab',
          }}
          listeners={{
            tabPress: () => {
              logger.info('[tab-press] coach');
            },
          }}
        />
        <Tab.Screen
          name="ProfileTab"
          component={ProfileStackNavigator}
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <ProfileIcon color={color} size={22} />,
            tabBarButtonTestID: 'tab-profile',
            tabBarAccessibilityLabel: 'Profile tab',
          }}
          listeners={{
            tabPress: () => {
              logger.info('[tab-press] profile');
            },
          }}
        />
      </Tab.Navigator>
      {__DEV__ && snapshot.actualCurrentRoute !== null ? (
        <View
          accessible={false}
          pointerEvents="none"
          style={HIDDEN_MARKER_STYLE}
          testID={`route-current-${snapshot.actualCurrentRoute}`}
        />
      ) : null}
      {/* Smoke-only app marker. Normal dev app launches must not show it. */}
      {__DEV__ && inSmokeMode ? (
        <View
          accessible={true}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 30,
            left: 6,
            width: 8,
            height: 8,
            backgroundColor: '#9C27B0',
            zIndex: 999998,
            elevation: 999998,
          }}
          testID="app-navigator-live"
          accessibilityLabel="app-navigator-live"
        />
      ) : null}
    </View>
  );
}

/**
 * Top-level app navigator.
 *
 * In smoke mode, mounting Tab.Navigator before runSmokeBootstrap has
 * resolved the initial route burns the wrong `initialRouteName` into
 * the navigator (initialRouteName is read once, on first mount only).
 * To avoid that, the outer component owns a "ready gate":
 *
 *   - Subscribes to activeSmokeInitialRoute via useSyncExternalStore.
 *   - If smoke mode is active and the route is still null, render
 *     `main-tabs-root` so Maestro can prove the app reached the
 *     post-onboarding shell, but DO NOT mount Tab.Navigator yet.
 *   - As soon as runSmokeBootstrap fires and sets activeSmokeInitialRoute
 *     = 'Coach', the subscription re-renders this component, the gate
 *     clears, and ResolvedAppNavigator mounts Tab.Navigator with
 *     initialRouteName='CoachTab' on its first frame.
 *
 * Outside smoke mode, the gate is a no-op and Tab.Navigator mounts
 * immediately with the legacy ProgramTab default.
 */
export default function AppNavigator() {
  // Snapshot the runtime signal once per mount so re-renders driven by
  // the activeSmokeInitialRoute subscription don't re-read env state we
  // already trust at module load.
  const smokeRuntimeSignal = React.useMemo(() => getSmokeRuntimeSignal(), []);
  const inSmokeMode = smokeRuntimeSignal.flow === 'coach-bike-flow';

  const activeSmokeRoute = React.useSyncExternalStore(
    subscribeToActiveSmokeInitialRoute,
    getActiveSmokeInitialRoute,
    getActiveSmokeInitialRoute,
  );

  // In smoke mode we ONLY trust activeSmokeInitialRoute. Outside smoke
  // mode we use the legacy fallback (which is null in practice — the
  // Tab.Navigator mounts on its native ProgramTab default).
  const resolvedSmokeInitialRoute = inSmokeMode
    ? activeSmokeRoute
    : getSmokeInitialRoute();
  const smokeInitialResolved = !inSmokeMode || activeSmokeRoute !== null;
  const initialTabRoute: keyof TabParamList =
    resolvedSmokeInitialRoute === 'Coach' ? 'CoachTab' : 'ProgramTab';

  React.useEffect(() => {
    logger.info(
      `[app-navigator] smokeInitialRoute raw=${activeSmokeRoute ?? 'null'} signalFlow=${smokeRuntimeSignal.flow ?? 'null'} inSmokeMode=${inSmokeMode ? 'true' : 'false'} resolved=${smokeInitialResolved ? 'true' : 'false'}`,
    );
    if (!smokeInitialResolved) {
      logger.info(
        '[app-navigator] tabs not mounted yet — waiting for smoke bootstrap',
      );
    }
  }, [
    activeSmokeRoute,
    inSmokeMode,
    smokeInitialResolved,
    smokeRuntimeSignal.flow,
  ]);

  if (!smokeInitialResolved) {
    // CRITICAL: while we wait for runSmokeBootstrap to resolve the
    // initial route, render `smoke-tabs-pending-root` (NOT
    // `main-tabs-root`). Previously the gate also rendered
    // `main-tabs-root`, which let Maestro's main-tabs-root step pass
    // before Tab.Navigator was mounted with the correct
    // initialRouteName — and route-current-Coach then failed because
    // the resolved navigator never mounted in time. Splitting the
    // markers ensures Maestro can tell the difference between "shell
    // visible, route still pending" and "tabs really mounted with the
    // right route."
    return (
      <View
        style={{ flex: 1, backgroundColor: colors.surface.primary }}
        testID="smoke-tabs-pending-root"
        accessibilityLabel="Smoke tabs pending (waiting for smoke bootstrap)"
      >
        <View
          accessible={false}
          pointerEvents="none"
          style={HIDDEN_MARKER_STYLE}
          testID="smoke-bootstrap-pending"
        />
      </View>
    );
  }

  return (
    <ResolvedAppNavigator
      initialTabRoute={initialTabRoute}
      inSmokeMode={inSmokeMode}
    />
  );
}
