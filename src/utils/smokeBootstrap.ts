/**
 * Smoke-test bootstrap.
 *
 * Long-term replacement for "Maestro taps the dev-skip Pressable". The
 * onboarding-by-UI approach was fragile: the press could silently
 * succeed at the testID layer without firing React's onPress, leaving
 * the smoke flow stuck on the Welcome screen forever.
 *
 * Instead, the smoke harness now launches the app and immediately
 * opens a deep link:
 *
 *     localfootyathlete://smoke/coach-bike-flow
 *
 * The bootstrap below seeds the canonical Sam persona, installs the
 * `DEFAULT_PROGRAM` deterministically (no Supabase edge function
 * round-trip — the smoke flow must not depend on the network), and
 * marks `isOnboardingComplete = true` so RootNavigator mounts
 * AppNavigator directly on the next render.
 *
 * The deep link is dev-only by design: the registered URL scheme is
 * present in every build, but the bootstrap function refuses to run
 * unless `__DEV__` is true or `EXPO_PUBLIC_SMOKE_BOOTSTRAP_ALLOW` is
 * explicitly set. Even if a release build is accidentally fed a smoke
 * URL, nothing happens.
 *
 * Diagnostic log markers (grepped by scripts/smoke-coach-bike-flow.js):
 *   [smoke-bootstrap] started
 *   [smoke-bootstrap] profile seeded
 *   [smoke-bootstrap] program installed
 *   [smoke-bootstrap] onboarding complete
 *   [smoke-bootstrap] main tabs ready
 */

import type { OnboardingData, TrainingProgram } from '../types/domain';
import { DEFAULT_PROGRAM } from '../data/defaultProgram';
import { buildSmokeCoachBikeFlowProgram } from '../data/smokeCoachBikeFlowProgram';
import { useProfileStore } from '../store/profileStore';
import { useProgramStore } from '../store/programStore';
import { useCalendarStore } from '../store/calendarStore';
import { DEV_TEST_ONBOARDING_DATA } from './devOnboardingSkip';
import { seedOnboardingProgram } from './onboardingCompletion';
import { logger } from './logger';
import { SMOKE_BOOTSTRAP_FLOW } from '../generated/smokeBootstrapFlag';
import {
  setBootstrapComplete,
  setRouteIntent,
} from '../navigation/smokeNavState';

/**
 * Resolve the deterministic program for a given smoke flow. The pipeline
 * tests + the live app must install the SAME shape so the coach
 * conversation enters with the session it expects to discuss.
 */
export function programForSmokeFlow(flow: SmokeFlow): TrainingProgram {
  switch (flow) {
    case 'coach-bike-flow':
      return buildSmokeCoachBikeFlowProgram();
    default: {
      // Exhaustiveness — TS will error if a new flow is added without a case.
      const _exhaustive: never = flow;
      void _exhaustive;
      return DEFAULT_PROGRAM;
    }
  }
}

export const SMOKE_URL_SCHEME = 'localfootyathlete';
export const SMOKE_URL_HOST = 'smoke';

/**
 * Known smoke flows. Adding a flow here is the only step needed to
 * expand the harness — both the parser and the bootstrap respect this
 * list, so unknown flows are rejected (never silently degrade to a
 * generic seed).
 */
export const SMOKE_FLOWS = ['coach-bike-flow'] as const;
export type SmokeFlow = (typeof SMOKE_FLOWS)[number];
export type SmokeInitialRoute = 'Coach' | null;

const SMOKE_URL_RE = new RegExp(
  // localfootyathlete://smoke/<flow>  (trailing slash + query tolerated)
  `^${SMOKE_URL_SCHEME}:\\/\\/${SMOKE_URL_HOST}\\/([a-z0-9-]+)\\/?(?:\\?.*)?$`,
  'i',
);

export interface ParsedSmokeUrl {
  flow: SmokeFlow;
}

/**
 * Returns the parsed smoke flow if `url` is a recognised smoke
 * bootstrap URL — null otherwise. Unknown flows return null too, never
 * a partial match.
 */
export function parseSmokeBootstrapUrl(
  url: string | null | undefined,
): ParsedSmokeUrl | null {
  if (!url) return null;
  const match = SMOKE_URL_RE.exec(url.trim());
  if (!match) return null;
  const flow = match[1].toLowerCase();
  if (!SMOKE_FLOWS.includes(flow as SmokeFlow)) return null;
  return { flow: flow as SmokeFlow };
}

/**
 * Reads `process.env.EXPO_PUBLIC_SMOKE_BOOTSTRAP` (set at bundle time
 * for headless CI runs). Returns a parsed flow or null.
 */
export function getSmokeFlowFromEnv(
  envValue: string | undefined = process.env.EXPO_PUBLIC_SMOKE_BOOTSTRAP,
): SmokeFlow | null {
  if (!envValue) return null;
  const flow = envValue.toLowerCase().trim();
  if (!SMOKE_FLOWS.includes(flow as SmokeFlow)) return null;
  return flow as SmokeFlow;
}

/**
 * Reads the generated smoke flag written by the fresh live-smoke
 * wrapper. This is intentionally bundled as source, so it does not
 * depend on Expo CLI exposing shell env vars inside React Native.
 */
export function getSmokeFlowFromGeneratedFlag(
  flagValue: string | null | undefined = SMOKE_BOOTSTRAP_FLOW,
): SmokeFlow | null {
  if (!flagValue) return null;
  const flow = flagValue.toLowerCase().trim();
  if (!SMOKE_FLOWS.includes(flow as SmokeFlow)) return null;
  return flow as SmokeFlow;
}

export interface SmokeRuntimeSignal {
  flow: SmokeFlow | null;
  source: 'env' | 'file' | null;
  envValue: string | undefined;
  fileValue: string | null | undefined;
}

export function getSmokeRuntimeSignal(): SmokeRuntimeSignal {
  const envValue = process.env.EXPO_PUBLIC_SMOKE_BOOTSTRAP;
  const envFlow = getSmokeFlowFromEnv(envValue);
  if (envFlow) {
    return {
      flow: envFlow,
      source: 'env',
      envValue,
      fileValue: SMOKE_BOOTSTRAP_FLOW,
    };
  }

  const fileFlow = getSmokeFlowFromGeneratedFlag(SMOKE_BOOTSTRAP_FLOW);
  return {
    flow: fileFlow,
    source: fileFlow ? 'file' : null,
    envValue,
    fileValue: SMOKE_BOOTSTRAP_FLOW,
  };
}

/**
 * Permissive in dev, locked-down in release. A future overrideable
 * flag (`EXPO_PUBLIC_SMOKE_BOOTSTRAP_ALLOW`) lets us run the smoke
 * bootstrap against a release-style bundle if needed, but by default
 * release builds simply ignore smoke URLs.
 */
export function isSmokeBootstrapAllowed(
  isDev: boolean =
    typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production',
  override: string | undefined = process.env.EXPO_PUBLIC_SMOKE_BOOTSTRAP_ALLOW,
): boolean {
  if (isDev) return true;
  return override === '1' || override === 'true';
}

export interface RunSmokeBootstrapArgs {
  flow: SmokeFlow;
  /** Overrides for unit-testing — production code passes none of these. */
  profileStore?: Pick<
    ReturnType<typeof useProfileStore.getState>,
    'updateOnboardingData' | 'completeOnboarding' | 'clear'
  >;
  programStore?: Pick<
    ReturnType<typeof useProgramStore.getState>,
    'setCurrentProgram' | 'setCurrentMicrocycle' | 'setTodayWorkout'
  >;
  calendarStore?: Pick<
    ReturnType<typeof useCalendarStore.getState>,
    'setGameDay' | 'clearAllGames'
  >;
  onboardingData?: OnboardingData;
  program?: TrainingProgram;
}

export interface RunSmokeBootstrapResult {
  flow: SmokeFlow;
  onboardingData: OnboardingData;
  program: TrainingProgram;
}

/**
 * Idempotent guard so re-firing the deep link mid-flow doesn't seed a
 * second time (Maestro retries can re-emit openLink). The first run
 * mutates stores; subsequent runs short-circuit.
 */
let lastBootstrapForFlow: SmokeFlow | null = null;
let activeSmokeInitialRoute: SmokeInitialRoute = null;

/**
 * `activeSmokeInitialRoute` is module-level state, so React can't
 * naturally observe it. This subscriber set is fired whenever
 * `runSmokeBootstrap` (or the test reset helper) mutates the route.
 * AppNavigator uses `subscribeToActiveSmokeInitialRoute` +
 * `getActiveSmokeInitialRoute` with `useSyncExternalStore` to gate
 * Tab.Navigator mount until the smoke initial route is locked in.
 *
 * Without this, AppNavigator computed `initialRouteName` once on
 * mount from a fallback. `initialRouteName` only applies on first
 * mount of `Tab.Navigator`, so any timing race meant the live Maestro
 * launch could open Program tab and never expose route-current-Coach.
 */
const activeSmokeInitialRouteSubscribers = new Set<() => void>();

function notifyActiveSmokeInitialRouteSubscribers(): void {
  for (const cb of Array.from(activeSmokeInitialRouteSubscribers)) {
    try {
      cb();
    } catch {
      // Subscribers must not throw; swallow so one bad listener can't
      // break the others.
    }
  }
}

export function subscribeToActiveSmokeInitialRoute(cb: () => void): () => void {
  activeSmokeInitialRouteSubscribers.add(cb);
  return () => {
    activeSmokeInitialRouteSubscribers.delete(cb);
  };
}

/**
 * Returns the route the smoke bootstrap has actually selected. Unlike
 * `getSmokeInitialRoute`, this never falls back to deriving the route
 * from the flow signal — null means "not yet resolved by the
 * bootstrap". Used by AppNavigator's ready gate.
 */
export function getActiveSmokeInitialRoute(): SmokeInitialRoute {
  return activeSmokeInitialRoute;
}

function initialRouteForSmokeFlow(flow: SmokeFlow | null): SmokeInitialRoute {
  return flow === 'coach-bike-flow' ? 'Coach' : null;
}

export function getSmokeInitialRoute(
  flow: SmokeFlow | null = getSmokeRuntimeSignal().flow,
): SmokeInitialRoute {
  return activeSmokeInitialRoute ?? initialRouteForSmokeFlow(flow);
}

/**
 * For tests — reset the idempotency guard between cases.
 */
export function __resetSmokeBootstrapForTest(): void {
  lastBootstrapForFlow = null;
  activeSmokeInitialRoute = null;
  notifyActiveSmokeInitialRouteSubscribers();
  setRouteIntent(null);
  setBootstrapComplete(false);
}

/**
 * Run the smoke bootstrap for the given flow.
 *
 * Always uses `DEFAULT_PROGRAM` (deterministic, no network) so the
 * harness has a known visible week regardless of edge-function health.
 * The Phase H coach pipeline then mutates that program through the
 * three bike-flow turns — that's what the smoke is actually testing.
 */
export async function runSmokeBootstrap(
  args: RunSmokeBootstrapArgs,
): Promise<RunSmokeBootstrapResult> {
  const { flow } = args;
  if (lastBootstrapForFlow === flow) {
    logger.info(`[smoke-bootstrap] skipped: already bootstrapped flow=${flow}`);
    return {
      flow,
      onboardingData: args.onboardingData ?? DEV_TEST_ONBOARDING_DATA,
      program: args.program ?? programForSmokeFlow(flow),
    };
  }

  const onboardingData = args.onboardingData ?? DEV_TEST_ONBOARDING_DATA;
  const program = args.program ?? programForSmokeFlow(flow);
  const profileStore = args.profileStore ?? useProfileStore.getState();
  const programStore = args.programStore ?? useProgramStore.getState();
  const calendarStore = args.calendarStore ?? useCalendarStore.getState();

  logger.info(`[smoke-bootstrap] started flow=${flow}`);
  activeSmokeInitialRoute = initialRouteForSmokeFlow(flow);
  if (activeSmokeInitialRoute) {
    logger.info(`[smoke-bootstrap] initialRoute=${activeSmokeInitialRoute}`);
    // Single seam where routeIntent enters the smoke state machine.
    // Once set, AppNavigator will trip smoke-route-intent-${name},
    // and the SmokeRouteEnforcer (gated on intent + navReady +
    // bootstrapComplete) becomes eligible to dispatch the reset.
    setRouteIntent(activeSmokeInitialRoute);
  }
  // Wake up the AppNavigator ready gate. It's safe to fire even if no
  // navigator is mounted yet — there are simply zero subscribers.
  notifyActiveSmokeInitialRouteSubscribers();

  // Wipe slate so re-runs are deterministic — game-day marks from a
  // prior run mustn't bleed into the new program's calendar.
  try {
    calendarStore.clearAllGames();
  } catch (err) {
    // Optional store method; swallow if absent in tests.
  }
  try {
    profileStore.clear();
  } catch (err) {
    // Optional store method; swallow if absent in tests.
  }

  profileStore.updateOnboardingData(onboardingData);
  logger.info('[smoke-bootstrap] profile seeded');

  seedOnboardingProgram({
    onboardingData,
    program,
    programStore: args.programStore,
    calendarStore: args.calendarStore,
  });
  // Echo the seeded Wednesday so the live wrapper can confirm the
  // fixture made it into the store. The diagnostic surfaces the
  // shape mismatch we hit before this fixture existed: the bootstrap
  // would seed DEFAULT_PROGRAM (Wednesday = Upper Strength) while the
  // coach pipeline expected Easy Aerobic Flush.
  try {
    const wed = program.microcycles?.[0]?.workouts?.find(
      (w) => w.dayOfWeek === 3,
    );
    logger.info(
      `[smoke-bootstrap] wednesday-seeded name=${wed?.name ?? '-'} type=${wed?.workoutType ?? '-'}`,
    );
  } catch {
    // Diagnostic only; failure here must not break the bootstrap.
  }
  logger.info('[smoke-bootstrap] program installed');

  profileStore.completeOnboarding();
  logger.info('[smoke-bootstrap] onboarding complete');

  lastBootstrapForFlow = flow;
  // Mark the bootstrap chunk of the state machine done. From this
  // point on the SmokeRouteEnforcer's gate (navReady && bootstrapComplete
  // && routeIntent !== null) can resolve and the imperative reset can
  // happen. Crucially this fires AFTER all stores have been mutated so
  // the marker means "stores are seeded AND onboarding is past".
  setBootstrapComplete(true);
  return { flow, onboardingData, program };
}
