/**
 * SmokeCoachBikeHarness — top-level, ALWAYS-MOUNTED smoke preflight
 * surface for the coach-bike-flow Maestro regression.
 *
 * EVOLUTION
 *
 *   v1: visible-week markers lived inside CoachScreen. Failed because
 *       CoachScreen's smoke flag was non-reactive (mount-order race).
 *   v2: harness moved to ResolvedAppNavigator gated on `inSmokeMode`.
 *       Failed because the gate itself depends on getSmokeRuntimeSignal(),
 *       which can be `null` in deep-link runs — the harness never
 *       mounted at all and Maestro saw zero markers.
 *   v3 (this file):
 *       • Mount unconditionally in __DEV__ from App.tsx (not gated on
 *         smoke runtime signal). This eliminates EVERY mount-order /
 *         signal-propagation race the harness can hit, because the
 *         harness is on screen the moment App.tsx renders.
 *       • Module-load + render + error logs so we can prove the
 *         component reached the live bundle even when logcat is
 *         unreliable.
 *       • Debug-grade physical visibility: 12×12 red squares,
 *         zIndex 999999, elevation 999999. Maestro cannot miss them.
 *       • Always renders exactly one of {inactive, pending, ready,
 *         missing} markers + an always-on debug marker. Even when the
 *         smoke flow signal is `null`, the inactive marker proves the
 *         harness is in the live UI tree.
 *
 * The marker visuals are intentionally ugly. This is a dev-only smoke
 * harness. The product UI is untouched.
 */

import React from 'react';
import { View, Text } from 'react-native';

// Module-load proof. Logs BEFORE any React work — if Metro served this
// module at all, this line runs. The wrapper greps for the literal.
// eslint-disable-next-line no-console
console.warn('[smoke-harness] module loaded');

import {
  getActiveSmokeInitialRoute,
  getSmokeRuntimeSignal,
  subscribeToActiveSmokeInitialRoute,
} from '../../utils/smokeBootstrap';
import {
  getSmokeNavStateSnapshot,
  subscribeSmokeNavState,
} from '../../navigation/smokeNavState';
import { useProgramStore } from '../../store/programStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useProfileStore } from '../../store/profileStore';
import { buildProgramTabProjectedWeek } from '../../utils/visibleProgramReadModel';
import { logger } from '../../utils/logger';
// Re-export the pure derivation + types from a sibling .ts module so
// contract tests can require them without pulling in react-native.
import {
  deriveSmokeVisibleWeekHarnessState as deriveCore,
  type SmokeVisibleWeekHarnessResult,
} from './smokeVisibleWeekHarnessState';

// Re-export the pure derivation + types so existing imports continue
// to work AND so contract tests can require either entry point.
export {
  deriveSmokeVisibleWeekHarnessState,
  type SmokeVisibleWeekHarnessState,
  type SmokeVisibleWeekHarnessReason,
  type SmokeVisibleWeekHarnessResult,
} from './smokeVisibleWeekHarnessState';

// Build fingerprint — bumped every time the harness contract changes
// in a way Maestro YAMLs need to follow. Wrapper asserts this BEFORE
// any visible-week checks; if it's missing the bundle is stale and
// the run aborts with "Stale bundle: smoke-build-fingerprint missing".
export const SMOKE_HARNESS_BUILD_FINGERPRINT = 'smoke-harness-v3-2026-05-13';

// ── Physical-visibility marker style ────────────────────────────────
//
// Intentionally ugly + impossible to miss. 12×12 px native View with
// solid red backgroundColor + zIndex/elevation 999999. Maestro's
// hit-test is generous, but native invisibility (opacity, zero size,
// behind another View) trips it up. This is dev-only.
const HARNESS_MARKER_STYLE_BASE = {
  position: 'absolute' as const,
  width: 12,
  height: 12,
  zIndex: 999999,
  elevation: 999999,
  backgroundColor: '#FF2D55',
};

const FINGERPRINT_STYLE = {
  ...HARNESS_MARKER_STYLE_BASE,
  top: 6,
  left: 6,
  backgroundColor: '#00C853',
};

const DEBUG_STYLE = {
  ...HARNESS_MARKER_STYLE_BASE,
  top: 6,
  left: 24,
};

const STATE_MARKER_STYLE = {
  ...HARNESS_MARKER_STYLE_BASE,
  top: 6,
  left: 42,
};

// ── Helper: Day-of-week number from yyyy-mm-dd ─────────────────────

const DAY_NAME_TO_NUMBER: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function getCurrentMondayISO(): string {
  const now = new Date();
  const dow = now.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + offset);
  monday.setHours(12, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

// ── Hook: subscribe to the same Zustand stores Program / Coach use ─

function useHarnessScheduleState(): any {
  const currentProgram = useProgramStore((s) => s.currentProgram);
  const currentMicrocycle = useProgramStore((s) => s.currentMicrocycle);
  const manualOverrides = useProgramStore((s) => s.dateOverrides);
  const sessionFeedback = useProgramStore((s) => s.sessionFeedback);
  const weightOverrides = useProgramStore((s) => s.weightOverrides);
  const markedDays = useCalendarStore((s) => s.markedDays);
  const onboardingData = useProfileStore((s) => s.onboardingData);
  const seasonPhase = useProfileStore((s) => s.onboardingData?.seasonPhase) || null;
  const usualGameDay = useProfileStore((s) => s.onboardingData?.usualGameDay);
  const gameDay = useProfileStore((s) => s.onboardingData?.gameDay);
  const preferredDays = useProfileStore((s) => s.onboardingData?.preferredTrainingDays);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useCoachPreferencesStore } = require('../../store/coachPreferencesStore');
  const modalityPreferences = useCoachPreferencesStore(
    (s: any) => s.modalityPreferences,
  );
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useCoachUpdatesStore } = require('../../store/coachUpdatesStore');
  const activeInjury = useCoachUpdatesStore((s: any) => s.activeInjury);
  const activeConstraints =
    useCoachUpdatesStore((s: any) => s.activeConstraints) ?? [];

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { inferEquipment, DEFAULT_ATHLETE_CONTEXT } = require('../../utils/sessionBuilder');
  const trainingLocation = onboardingData?.trainingLocation || 'Commercial gym';
  const athleteContext = onboardingData
    ? {
        injuries: onboardingData.injuries || [],
        equipmentTags: inferEquipment(trainingLocation),
        trainingLocation,
        onboardingData,
      }
    : DEFAULT_ATHLETE_CONTEXT;

  const availableDayNumbers =
    preferredDays && preferredDays.length > 0
      ? preferredDays
          .map((name: string) => DAY_NAME_TO_NUMBER[name])
          .filter((n: number | undefined) => n !== undefined)
      : undefined;

  return {
    currentProgram,
    currentMicrocycle,
    manualOverrides: manualOverrides || {},
    markedDays: markedDays || {},
    athleteContext,
    seasonPhase,
    usualGameDay,
    gameDay,
    readiness: 'medium',
    sessionFeedback: sessionFeedback || {},
    weightOverrides: weightOverrides || {},
    availableDayNumbers,
    activeInjury: activeInjury ?? null,
    activeConstraints,
    modalityPreferences: modalityPreferences ?? {},
  };
}

// ── Component ───────────────────────────────────────────────────────

/**
 * Mounted UNCONDITIONALLY in __DEV__ at the top of App.tsx — outside
 * NavigationContainer, outside any Screen, outside any
 * ScrollView/FlatList/KeyboardAvoidingView. The "inactive" marker is
 * the proof that the harness reached the live UI tree even when the
 * smoke flow signal is null.
 *
 * Production builds: this component is mounted under
 * `{__DEV__ ? <SmokeCoachBikeHarness /> : null}`, so it doesn't ship.
 */
export default function SmokeCoachBikeHarness(): React.ReactElement | null {
  const smokeRuntimeSignal = React.useMemo(() => {
    try {
      return getSmokeRuntimeSignal();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[smoke-harness] runtime signal error', e);
      return { flow: null, source: 'error', envValue: null, fileValue: null } as any;
    }
  }, []);
  const smokeFlowActive = smokeRuntimeSignal.flow === 'coach-bike-flow';

  const activeSmokeRoute = React.useSyncExternalStore(
    subscribeToActiveSmokeInitialRoute,
    getActiveSmokeInitialRoute,
    getActiveSmokeInitialRoute,
  );

  const navSnapshot = React.useSyncExternalStore(
    subscribeSmokeNavState,
    getSmokeNavStateSnapshot,
    getSmokeNavStateSnapshot,
  );

  const state = useHarnessScheduleState();
  const overrideContexts = useProgramStore((s) => s.overrideContexts) ?? {};

  const mondayISO = getCurrentMondayISO();
  const todayISO = new Date().toISOString().slice(0, 10);

  // Build weekDays inside a try/catch so a thrown engine call cannot
  // silently fail the harness. weekDays=undefined drives `pending` →
  // the harness still renders a marker.
  let weekDays: any = undefined;
  let engineError: Error | null = null;
  if (state.currentProgram) {
    try {
      weekDays = buildProgramTabProjectedWeek({
        mondayISO,
        todayISO,
        state,
        overrideContexts,
        modalityPreferences: state.modalityPreferences,
      });
    } catch (err) {
      engineError = err as Error;
      // eslint-disable-next-line no-console
      console.error('[smoke-harness] render error', err);
      logger.warn(
        `[smoke-harness] engine-throw err=${(err as Error)?.message ?? String(err)}`,
      );
      weekDays = undefined;
    }
  }

  let result: SmokeVisibleWeekHarnessResult;
  try {
    result = deriveCore({
      smokeFlowActive,
      actualCurrentRoute: navSnapshot.actualCurrentRoute,
      weekDays,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[smoke-harness] render error', err);
    result = {
      state: 'missing',
      reason: 'wednesday-has-no-workout',
      route: navSnapshot.actualCurrentRoute,
      weekDump: `(derive-threw: ${(err as Error)?.message ?? String(err)})`,
    };
  }

  // Render proof — emit every render with the resolved state. This is
  // the wrapper's secondary source of truth (UI markers are primary).
  // eslint-disable-next-line no-console
  console.warn('[smoke-harness] render', {
    smokeFlowActive,
    actualCurrentRoute: navSnapshot.actualCurrentRoute,
    state: result.state,
    reason: result.reason,
    weekDump: result.weekDump,
    activeSmokeRoute,
    engineError: engineError ? String(engineError) : null,
    fingerprint: SMOKE_HARNESS_BUILD_FINGERPRINT,
  });

  React.useEffect(() => {
    const { state: s, reason, route, weekDump } = result;
    const flow = smokeRuntimeSignal.flow ?? 'null';
    const activeRoute = activeSmokeRoute ?? 'null';
    if (s === 'inactive') {
      logger.warn(
        `[smoke-visible-week] state=inactive reason=${reason} flow=${flow} activeRoute=${activeRoute}`,
      );
      return;
    }
    if (s === 'pending') {
      logger.info(
        `[smoke-visible-week] state=pending reason=${reason} route=${route ?? 'null'} week=${weekDump}`,
      );
      return;
    }
    if (s === 'ready') {
      logger.info(
        `[smoke-visible-week] state=ready reason=${reason} route=${route ?? 'null'} week=${weekDump}`,
      );
      return;
    }
    if (s === 'missing') {
      logger.warn(
        `[smoke-visible-week] state=missing reason=${reason} route=${route ?? 'null'} week=${weekDump}`,
      );
      return;
    }
  }, [
    result,
    smokeRuntimeSignal.flow,
    activeSmokeRoute,
  ]);

  // ── Markers ──────────────────────────────────────────────────────
  //
  // smoke-build-fingerprint, smoke-visible-week-debug, and exactly one
  // of {inactive, pending, ready, missing} are ALL rendered native
  // visible. Maestro's first preflight step is `assertVisible
  // smoke-build-fingerprint` — if that fails the wrapper aborts with
  // "Stale bundle: smoke-build-fingerprint missing".
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        zIndex: 999999,
        elevation: 999999,
      }}
      accessibilityLabel="smoke-coach-bike-harness-root"
      testID="smoke-coach-bike-harness-root"
    >
      {/*
        smoke-build-fingerprint AND smoke-harness-mounted are OWNED BY
        App.tsx (not this component). Reasons:
          • smoke-build-fingerprint must survive any harness import
            failure → cannot live here.
          • smoke-harness-mounted must prove App.tsx executed the
            smoke mount zone block → also cannot live here, otherwise
            it depends on this very component being importable.
        This component owns ONLY the debug marker + the four
        state-driven markers. If smoke-harness-mounted is visible
        (App.tsx ran the mount zone) but smoke-visible-week-debug is
        not, then SmokeCoachBikeHarness specifically failed to render
        — module import failure, render-throw, etc. The wrapper
        labels that case "SmokeCoachBikeHarness component not
        rendered or module not loaded".
      */}
      {/* Debug marker — always rendered. carries state+reason+route+week
          in accessibilityLabel for the wrapper. */}
      <View
        accessible={true}
        pointerEvents="none"
        style={DEBUG_STYLE}
        testID="smoke-visible-week-debug"
        accessibilityLabel={`smoke-visible-week state=${result.state} reason=${result.reason} route=${result.route ?? 'null'} week=${result.weekDump}`}
      >
        <Text
          style={{ fontSize: 1, color: 'transparent' }}
        >
          {`state=${result.state} reason=${result.reason} route=${result.route ?? 'null'} week=${result.weekDump}`}
        </Text>
      </View>
      {/* Exactly one state marker. */}
      {result.state === 'inactive' ? (
        <View
          accessible={true}
          pointerEvents="none"
          style={STATE_MARKER_STYLE}
          testID="smoke-visible-week-inactive"
          accessibilityLabel={`smoke-visible-week-inactive reason=${result.reason}`}
        />
      ) : null}
      {result.state === 'pending' ? (
        <View
          accessible={true}
          pointerEvents="none"
          style={STATE_MARKER_STYLE}
          testID="smoke-visible-week-pending"
          accessibilityLabel={`smoke-visible-week-pending reason=${result.reason}`}
        />
      ) : null}
      {result.state === 'ready' ? (
        <View
          accessible={true}
          pointerEvents="none"
          style={STATE_MARKER_STYLE}
          testID="smoke-visible-week-ready"
          accessibilityLabel="smoke-visible-week-ready"
        />
      ) : null}
      {result.state === 'missing' ? (
        <View
          accessible={true}
          pointerEvents="none"
          style={STATE_MARKER_STYLE}
          testID="smoke-visible-week-missing"
          accessibilityLabel={`smoke-visible-week-missing reason=${result.reason}`}
        />
      ) : null}
    </View>
  );
}
