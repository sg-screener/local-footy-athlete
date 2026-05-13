import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import RootNavigator from './src/navigation/RootNavigator';
import { logCoachBuildFingerprint } from './src/utils/coachBuildInfo';
import { installSmokeBootstrapListener } from './src/utils/smokeBootstrapInstaller';
import { getSmokeRuntimeSignal } from './src/utils/smokeBootstrap';
import { setRuntimeReady } from './src/navigation/smokeNavState';

// IMPORTANT: SmokeCoachBikeHarness is intentionally NOT imported here.
// The live smoke probes are App.tsx-owned direct native Views. Every
// external lookup used to derive the visible-week state goes through
// dynamic require() inside try/catch so failures become renderable
// `state=missing reason=...` markers instead of silent module-load
// errors.

const SMOKE_BUILD_FINGERPRINT_LABEL = 'smoke-harness-v3-2026-05-13';

const smokeBootstrapSignal = getSmokeRuntimeSignal();
const shouldRenderSmokeRuntimeMarker =
  __DEV__ && smokeBootstrapSignal.flow === 'coach-bike-flow';

console.warn('[app-entry] App.tsx module loaded', {
  smokeBootstrapEnv: smokeBootstrapSignal.envValue,
  smokeBootstrapFileFlag: smokeBootstrapSignal.fileValue,
  smokeBootstrapSignal: smokeBootstrapSignal.flow,
  smokeBootstrapSignalSource: smokeBootstrapSignal.source,
  timestamp: new Date().toISOString(),
});

// CRITICAL: install the smoke-bootstrap Linking listener at module load,
// BEFORE any React rendering or async work.
installSmokeBootstrapListener();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

logCoachBuildFingerprint('app_launch');
setRuntimeReady(true);

// ─── Direct App.tsx smoke markers ──────────────────────────────────
//
// The live smoke harness uses direct native marker Views rendered from
// App.tsx beside RootNavigator. No overlay component, nested root, or
// child render tree owns these markers; the debug/state markers use the
// same renderSmokeMarker factory as the two probes Maestro already sees.

type SmokeOverlayState = 'inactive' | 'pending' | 'ready' | 'missing';

interface SmokeOverlayResult {
  state: SmokeOverlayState;
  reason: string;
  route: string | null;
  weekDump: string;
  error: string | null;
  wedText?: string;
  hasEasyAerobicFlush?: boolean;
  hasRower?: boolean;
}

const SMOKE_OVERLAY_INITIAL: SmokeOverlayResult = {
  state: 'pending',
  reason: 'initialising',
  route: null,
  weekDump: '(initialising)',
  error: null,
};

const STATE_TEST_IDS: Record<SmokeOverlayState, string> = {
  inactive: 'smoke-visible-week-inactive',
  pending: 'smoke-visible-week-pending',
  ready: 'smoke-precoach-week-ready',
  missing: 'smoke-visible-week-missing',
};

const STATE_MARKER_COLORS: Record<SmokeOverlayState, string> = {
  inactive: '#9E9E9E',
  pending: '#FF9100',
  ready: '#00C853',
  missing: '#FF1744',
};

// Hard-coded copies of the shared fixture constants. We deliberately
// don't import `src/data/smokeCoachBikeFlowProgram` statically here:
// any future static import that throws at module evaluation would
// take App.tsx down with it. The dynamic require below tries to load
// the live values; if that fails we fall back to these constants so
// the overlay still produces a sensible result.
const SMOKE_FALLBACK_WEDNESDAY_NAME = 'Easy Aerobic Flush';
const SMOKE_FALLBACK_PRE_CHANGE_RE = /\brower\b/i;
const EASY_AEROBIC_FLUSH_TOKEN = 'easy aerobic flush';
const ROWER_SMOKE_RE = /\b(rower|rowing|row)\b/i;

function compactWeekDump(weekDays: any): string {
  if (weekDays === undefined || weekDays === null) return '(weekDays=undefined)';
  if (!Array.isArray(weekDays)) return `(weekDays=${typeof weekDays})`;
  if (weekDays.length === 0) return '(weekDays=[])';
  return weekDays
    .map((d: any) => {
      const w = d?.workout;
      const type = w?.workoutType ?? w?.type ?? '-';
      const day = d?.short ?? `dow=${d?.dayOfWeek}`;
      return `${day}/${d?.date}=${w?.name ?? 'rest'}[${type}]`;
    })
    .join(', ');
}

function appendSmokeText(parts: string[], value: any) {
  if (typeof value === 'string' && value.trim()) {
    parts.push(value.trim());
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    parts.push(String(value));
  }
}

function collectSmokeTextValues(value: any, parts: string[], seen = new Set<any>()) {
  if (value === null || value === undefined) return;
  if (typeof value === 'string' || typeof value === 'number') {
    appendSmokeText(parts, value);
    return;
  }
  if (typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => collectSmokeTextValues(item, parts, seen));
    return;
  }
  Object.values(value).forEach((child) => collectSmokeTextValues(child, parts, seen));
}

function normalizeSmokeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function compactSmokeText(text: string): string {
  const normalized = normalizeSmokeText(text);
  return normalized.length > 500 ? `${normalized.slice(0, 500)}...` : normalized;
}

function collectWednesdaySmokeText(wedDay: any): string {
  if (!wedDay) return '';
  const parts: string[] = [];
  const workout = wedDay?.workout ?? wedDay;
  [
    wedDay?.title,
    wedDay?.name,
    wedDay?.label,
    wedDay?.type,
    wedDay?.category,
    wedDay?.workoutType,
    workout?.title,
    workout?.name,
    workout?.displayName,
    workout?.label,
    workout?.description,
    workout?.summary,
    workout?.type,
    workout?.category,
    workout?.workoutType,
    workout?.duration,
    workout?.durationText,
  ].forEach((value) => appendSmokeText(parts, value));
  (workout?.conditioningBlock?.options ?? workout?.options ?? []).forEach((opt: any) => {
    [
      opt?.title,
      opt?.name,
      opt?.label,
      opt?.description,
      opt?.summary,
      opt?.type,
      opt?.category,
      opt?.duration,
      opt?.durationText,
    ].forEach((value) => appendSmokeText(parts, value));
  });
  (workout?.exercises ?? []).forEach((wx: any) => {
    [
      wx?.title,
      wx?.name,
      wx?.description,
      wx?.notes,
      wx?.exercise?.title,
      wx?.exercise?.name,
      wx?.exercise?.description,
      wx?.exercise?.notes,
    ].forEach((value) => appendSmokeText(parts, value));
  });
  collectSmokeTextValues(workout?.coachNotes, parts);
  collectSmokeTextValues(workout?.blocks, parts);
  collectSmokeTextValues(workout?.sections, parts);
  collectSmokeTextValues(workout?.visibleFields, parts);
  return Array.from(new Set(parts)).join(' || ');
}

function getCurrentMondayISO(): string {
  const now = new Date();
  const dow = now.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + offset);
  monday.setHours(12, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

const DAY_NAME_TO_NUMBER: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/**
 * Pure derivation. EVERY external lookup is dynamic-required inside
 * its own try/catch — this function CANNOT throw. If any branch
 * fails, return state=missing with a categorical engine/store/derive
 * error reason and the error string in `error`.
 */
function deriveOverlayState(): SmokeOverlayResult {
  // ── 1. Smoke runtime signal ────────────────────────────────────
  let smokeFlowActive = false;
  try {
    smokeFlowActive = smokeBootstrapSignal.flow === 'coach-bike-flow';
  } catch (e) {
    return {
      state: 'missing',
      reason: 'engine-load-error',
      route: null,
      weekDump: '(no week)',
      error: `runtime-signal: ${(e as Error)?.message ?? String(e)}`,
    };
  }

  if (!smokeFlowActive) {
    return {
      state: 'inactive',
      reason: 'smoke-flow-not-active',
      route: null,
      weekDump: '(inactive)',
      error: null,
    };
  }

  // ── 2. Nav state machine — actualCurrentRoute ──────────────────
  let actualRoute: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getSmokeNavStateSnapshot } = require('./src/navigation/smokeNavState');
    const snap = getSmokeNavStateSnapshot();
    actualRoute = snap?.actualCurrentRoute ?? null;
  } catch (e) {
    return {
      state: 'missing',
      reason: 'engine-load-error',
      route: null,
      weekDump: '(no week)',
      error: `nav-state: ${(e as Error)?.message ?? String(e)}`,
    };
  }

  if (actualRoute === null) {
    return {
      state: 'pending',
      reason: 'no-active-route-yet',
      route: null,
      weekDump: '(awaiting nav)',
      error: null,
    };
  }

  // ── 3. Stores → ScheduleState ──────────────────────────────────
  let state: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useProgramStore } = require('./src/store/programStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useCalendarStore } = require('./src/store/calendarStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useProfileStore } = require('./src/store/profileStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useCoachPreferencesStore } = require('./src/store/coachPreferencesStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useCoachUpdatesStore } = require('./src/store/coachUpdatesStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { inferEquipment, DEFAULT_ATHLETE_CONTEXT } = require('./src/utils/sessionBuilder');

    const programState = useProgramStore.getState();
    const calendarState = useCalendarStore.getState();
    const profileState = useProfileStore.getState();
    const prefState = useCoachPreferencesStore.getState();
    const updatesState = useCoachUpdatesStore.getState();

    const onboardingData = profileState?.onboardingData;
    const trainingLocation = onboardingData?.trainingLocation || 'Commercial gym';
    const athleteContext = onboardingData
      ? {
          injuries: onboardingData.injuries || [],
          equipmentTags: inferEquipment(trainingLocation),
          trainingLocation,
          onboardingData,
        }
      : DEFAULT_ATHLETE_CONTEXT;

    const preferredDays = onboardingData?.preferredTrainingDays;
    const availableDayNumbers =
      preferredDays && preferredDays.length > 0
        ? preferredDays
            .map((name: string) => DAY_NAME_TO_NUMBER[name])
            .filter((n: number | undefined) => n !== undefined)
        : undefined;

    state = {
      currentProgram: programState?.currentProgram,
      currentMicrocycle: programState?.currentMicrocycle,
      manualOverrides: programState?.dateOverrides || {},
      markedDays: calendarState?.markedDays || {},
      athleteContext,
      seasonPhase: onboardingData?.seasonPhase || null,
      usualGameDay: onboardingData?.usualGameDay,
      gameDay: onboardingData?.gameDay,
      readiness: 'medium',
      sessionFeedback: programState?.sessionFeedback || {},
      weightOverrides: programState?.weightOverrides || {},
      availableDayNumbers,
      activeInjury: updatesState?.activeInjury ?? null,
      activeConstraints: updatesState?.activeConstraints ?? [],
      modalityPreferences: prefState?.modalityPreferences ?? {},
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      `[app-smoke-overlay] store-read-error ${(e as Error)?.message ?? String(e)}`,
    );
    return {
      state: 'missing',
      reason: 'store-read-error',
      route: actualRoute,
      weekDump: '(stores unavailable)',
      error: `store-read: ${(e as Error)?.message ?? String(e)}`,
    };
  }

  // ── 4. Engine → buildProgramTabProjectedWeek ───────────────────
  if (!state.currentProgram) {
    return {
      state: 'pending',
      reason: 'no-resolved-week-yet',
      route: actualRoute,
      weekDump: '(awaiting program)',
      error: null,
    };
  }

  let weekDays: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
      buildProgramTabProjectedWeek,
    } = require('./src/utils/visibleProgramReadModel');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useProgramStore } = require('./src/store/programStore');
    const overrideContexts = useProgramStore.getState()?.overrideContexts ?? {};
    weekDays = buildProgramTabProjectedWeek({
      mondayISO: getCurrentMondayISO(),
      todayISO: new Date().toISOString().slice(0, 10),
      state,
      overrideContexts,
      modalityPreferences: state.modalityPreferences,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      `[app-smoke-overlay] week-derive-error ${(e as Error)?.message ?? String(e)}`,
    );
    return {
      state: 'missing',
      reason: 'week-derive-error',
      route: actualRoute,
      weekDump: '(derive threw)',
      error: `week-derive: ${(e as Error)?.message ?? String(e)}`,
    };
  }

  const weekDump = compactWeekDump(weekDays);

  if (actualRoute !== 'Coach') {
    return {
      state: 'missing',
      reason: 'route-not-coach',
      route: actualRoute,
      weekDump,
      error: null,
    };
  }

  if (!Array.isArray(weekDays) || weekDays.length === 0) {
    return {
      state: 'missing',
      reason: 'no-resolved-week',
      route: actualRoute,
      weekDump,
      error: null,
    };
  }

  // ── 5. Resolve the canonical fixture constants. Try the live
  //      module first; fall back to inlined defaults if it throws.
  let WED_NAME = SMOKE_FALLBACK_WEDNESDAY_NAME;
  let PRE_CHANGE_RE: RegExp = SMOKE_FALLBACK_PRE_CHANGE_RE;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fixture = require('./src/data/smokeCoachBikeFlowProgram');
    if (typeof fixture.SMOKE_WEDNESDAY_WORKOUT_NAME === 'string') {
      WED_NAME = fixture.SMOKE_WEDNESDAY_WORKOUT_NAME;
    }
    if (fixture.SMOKE_WEDNESDAY_PRE_CHANGE_MODALITY instanceof RegExp) {
      PRE_CHANGE_RE = fixture.SMOKE_WEDNESDAY_PRE_CHANGE_MODALITY;
    }
  } catch {
    // Use the fallback constants — already correct values.
  }

  const wed = weekDays.find((d: any) => d?.dayOfWeek === 3) ?? null;
  if (!wed) {
    return {
      state: 'missing',
      reason: 'no-wednesday-day',
      route: actualRoute,
      weekDump,
      error: null,
    };
  }
  if (!wed.workout) {
    return {
      state: 'missing',
      reason: 'wednesday-has-no-workout',
      route: actualRoute,
      weekDump,
      error: null,
    };
  }
  const wedText = collectWednesdaySmokeText(wed);
  const haystack = normalizeSmokeText(wedText);
  const expectedWedName = normalizeSmokeText(WED_NAME || EASY_AEROBIC_FLUSH_TOKEN);
  const hasEasyAerobicFlush =
    haystack.includes(EASY_AEROBIC_FLUSH_TOKEN) ||
    (expectedWedName.length > 0 && haystack.includes(expectedWedName));
  const hasRower =
    ROWER_SMOKE_RE.test(haystack) ||
    PRE_CHANGE_RE.test(wedText);
  const compactWedText = compactSmokeText(wedText);

  if (!hasEasyAerobicFlush) {
    return {
      state: 'missing',
      reason: 'wednesday-not-easy-aerobic-flush',
      route: actualRoute,
      weekDump,
      error: null,
      wedText: compactWedText,
      hasEasyAerobicFlush,
      hasRower,
    };
  }
  if (!hasRower) {
    return {
      state: 'missing',
      reason: 'no-rower-before-change',
      route: actualRoute,
      weekDump,
      error: null,
      wedText: compactWedText,
      hasEasyAerobicFlush,
      hasRower,
    };
  }

  return {
    state: 'ready',
    reason: 'ok',
    route: actualRoute,
    weekDump,
    error: null,
    wedText: compactWedText,
    hasEasyAerobicFlush,
    hasRower,
  };
}

function renderSmokeMarker(
  testID: string,
  accessibilityLabel: string,
  left: number,
  backgroundColor: string,
): React.ReactElement {
  return (
    <View
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      collapsable={false}
      pointerEvents="none"
      style={[styles.smokeMarker, { left, backgroundColor }]}
      testID={testID}
    >
      <Text style={styles.smokeMarkerText}>{accessibilityLabel}</Text>
    </View>
  );
}

export default function App() {
  const [smokeOverlayResult, setSmokeOverlayResult] =
    React.useState<SmokeOverlayResult>(SMOKE_OVERLAY_INITIAL);

  React.useEffect(() => {
    if (!__DEV__) return;
    const tick = () => {
      try {
        setSmokeOverlayResult(deriveOverlayState());
      } catch (err) {
        setSmokeOverlayResult({
          state: 'missing',
          reason: 'engine-load-error',
          route: null,
          weekDump: '(error)',
          error: String(err),
        });
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, []);

  const smokeOverlayDebugLabel = `smoke-visible-week state=${smokeOverlayResult.state} reason=${smokeOverlayResult.reason} route=${smokeOverlayResult.route ?? 'null'} hasEasyAerobicFlush=${smokeOverlayResult.hasEasyAerobicFlush ?? false} hasRower=${smokeOverlayResult.hasRower ?? false} wedText=${smokeOverlayResult.wedText ?? '(none)'} week=${smokeOverlayResult.weekDump} error=${smokeOverlayResult.error ?? 'null'}`;
  const smokeOverlayStateLabel = `state=${smokeOverlayResult.state} reason=${smokeOverlayResult.reason}`;
  const smokeOverlayStateTestID = STATE_TEST_IDS[smokeOverlayResult.state];
  const smokeOverlayStateColor = STATE_MARKER_COLORS[smokeOverlayResult.state];

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn(`[app-smoke-overlay] render ${smokeOverlayDebugLabel}`);
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            {shouldRenderSmokeRuntimeMarker ? (
              <View
                collapsable={false}
                pointerEvents="none"
                style={styles.smokeRuntimeMarker}
                testID="smoke-runtime-ready"
                accessibilityLabel="smoke-runtime-ready"
              >
                <Text style={styles.smokeRuntimeMarkerText}>Smoke runtime ready</Text>
              </View>
            ) : null}
            {/*
              App.tsx-OWNED smoke markers. Three groups:
                1. smoke-build-fingerprint — proves App.tsx bundle is current.
                2. smoke-harness-mounted — proves the smoke mount zone executed.
                3. Direct visible-week debug + state markers — rendered
                   through the same native View factory as the first two.
              All native Views, position absolute, real backgroundColor,
              MAX-INT zIndex/elevation. No ScrollView/FlatList/keyboard
              parent dependency. Maestro asserts each in turn.
            */}
            {__DEV__ ? (
              <>
                {(() => {
                  // eslint-disable-next-line no-console
                  console.warn('[app-smoke-mount] fingerprint rendered');
                  return null;
                })()}
                {renderSmokeMarker(
                  'smoke-build-fingerprint',
                  SMOKE_BUILD_FINGERPRINT_LABEL,
                  0,
                  '#76FF03',
                )}
                {(() => {
                  // eslint-disable-next-line no-console
                  console.warn('[app-smoke-mount] harness mount zone rendered');
                  return null;
                })()}
                {renderSmokeMarker(
                  'smoke-harness-mounted',
                  `smoke-harness-mounted fingerprint=${SMOKE_BUILD_FINGERPRINT_LABEL}`,
                  40,
                  '#00E5FF',
                )}
                {renderSmokeMarker(
                  'smoke-visible-week-debug',
                  smokeOverlayDebugLabel,
                  80,
                  '#FFD600',
                )}
                {renderSmokeMarker(
                  smokeOverlayStateTestID,
                  smokeOverlayStateLabel,
                  120,
                  smokeOverlayStateColor,
                )}
              </>
            ) : null}
            <RootNavigator />
            <StatusBar style="light" />
          </QueryClientProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  smokeRuntimeMarker: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 9999,
    width: 1,
    height: 1,
    opacity: 0.01,
  },
  smokeRuntimeMarkerText: {
    fontSize: 1,
    color: '#000',
  },
  smokeMarker: {
    position: 'absolute',
    top: 0,
    width: 30,
    height: 30,
    zIndex: 2147483647,
    elevation: 2147483647,
  },
  smokeMarkerText: {
    fontSize: 1,
    color: 'transparent',
  },
});
