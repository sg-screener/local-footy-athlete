import React from 'react';
import { LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { hydrateAthleteActionLog } from './src/utils/athleteActionLog';

let DevE2EStatusMarkers: React.ComponentType | null = null;
let prepareDevE2EAppLaunch:
  (() => Promise<{ ready: boolean; reason: string | null }>) | null = null;
let clearDevE2EHarnessState: (() => Promise<void>) | null = null;
let installDevE2EEntry: (() => unknown) | null = null;
let ReleaseRootNavigator: React.ComponentType | null = null;
if (__DEV__) {
  // Under Fusebox (RN DevTools), ordinary warnings never render LogBox
  // banners; the only warning banner RN can show is the hardcoded
  // "Open debugger to view warnings." advisory, which overlays the tab bar
  // and swallows taps on its buttons (Maestro taps element centers).
  // Suppress exactly that message. Launch-argument detection is unreliable:
  // Maestro arguments never reach UserDefaults/SettingsManager, so any
  // arg-gated suppression is dead code in E2E runs. Errors still surface.
  LogBox.ignoreLogs(['Open debugger to view warnings.']);
  // Clock bootstrap is storage-only. The coordinator/store graph is imported
  // after the receipt is restored and checked against the active checkpoint.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const devEntry = require('./src/dev/e2e/devE2EEntry');
  // ── THE SAME WALL, TWICE — SO THE STRING LIST STOPS HERE (§8, 2026-08-10) ──
  //
  // The line above suppresses ONE message by text, for one reason: a LogBox
  // banner sits in the bottom strip, that strip is the tab bar, and Maestro
  // taps element centres — so the banner eats every tab tap and the failure
  // reads as "the Profile tab is broken".
  //
  // The first working run-through since 18 July hit that wall again, from a
  // different message: a `logger.error` at boot raised the red LogBox badge
  // over the tab bar, the walk's first `tapOn: tab-profile` opened the log
  // viewer instead, and three surfaces went unvisited. The comment above even
  // promised it — "Errors still surface" — and that promise is what blinded
  // the instrument.
  //
  // Adding a second string would be attempt three at the same wall. The rule
  // is one line instead: WHEN THE HARNESS IS HOLDING THE PHONE, NO LOG DRAWS
  // ANYTHING. It covers every message this app has not written yet, which a
  // list of remembered strings never can.
  //
  // NOTHING IS SILENCED, ONLY UNDRAWN. `ignoreAllLogs` suppresses the OVERLAY;
  // every `console.error` and `logger.warn` still reaches Metro, still reaches
  // the device log, and the seed's own failure surface (`e2e-seed-error`) is
  // an app view, not a LogBox one, so the runner's error assertions are
  // untouched. A human running this app in dev sees exactly what they saw.
  if (devEntry.devE2ELaunchRequested()) LogBox.ignoreAllLogs();
  DevE2EStatusMarkers = devEntry.DevE2EStatusMarkers;
  prepareDevE2EAppLaunch = devEntry.prepareDevE2EAppLaunch;
  clearDevE2EHarnessState = devEntry.clearDevE2EHarnessState;
  installDevE2EEntry = () => devEntry.installDevE2EEntry({ isDev: true });
  // URL ingress must exist before the asynchronous clock/coordinator barrier.
  installDevE2EEntry();
} else {
  // Release never imports the development clock or coordinator.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ReleaseRootNavigator = require('./src/navigation/RootNavigator').default;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

// Read the previous run's action log back before anything can be added to it,
// so a relaunch is a GAP in the sequence rather than a reset of it — the
// sequence that leads to a report usually crosses one. Module scope, on every
// build, deliberately: this is the instrument that has to be alive where the
// defects are (AGENTS.md). Never awaited — nothing the athlete sees depends on
// it, and a slow read must not hold the first frame.
void hydrateAthleteActionLog();

export default function App() {
  const [DevRootNavigator, setDevRootNavigator] =
    React.useState<React.ComponentType | null>(null);
  // WHY A REFUSAL NEEDS ITS OWN STATE: see `DevLaunchRefused` below. `null` is
  // "the barrier has not answered yet"; a string is "it refused, and this is
  // why". The two used to be the same thing — nothing rendered — and that is
  // precisely the defect.
  const [devLaunchRefusal, setDevLaunchRefusal] =
    React.useState<string | null>(null);

  const runDevLaunchBarrier = React.useCallback(() => {
    if (!__DEV__ || !prepareDevE2EAppLaunch || !installDevE2EEntry) return;
    setDevLaunchRefusal(null);
    void prepareDevE2EAppLaunch().then(({ ready, reason }) => {
      if (!ready) {
        setDevLaunchRefusal(reason ?? 'The development launch barrier refused.');
        return;
      }
      // Store hydration begins only after the dev clock restoration barrier.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const RootNavigator = require('./src/navigation/RootNavigator').default;
      setDevRootNavigator(() => RootNavigator);
    });
  }, []);

  React.useEffect(() => { runDevLaunchBarrier(); }, [runDevLaunchBarrier]);

  const RootNavigator = __DEV__ ? DevRootNavigator : ReleaseRootNavigator;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            {DevE2EStatusMarkers ? <DevE2EStatusMarkers /> : null}
            {RootNavigator ? <RootNavigator /> : null}
            {__DEV__ && !RootNavigator && devLaunchRefusal ? (
              <DevLaunchRefused
                reason={devLaunchRefusal}
                onClear={() => {
                  void (clearDevE2EHarnessState?.() ?? Promise.resolve())
                    .then(runDevLaunchBarrier);
                }}
              />
            ) : null}
            <StatusBar style="light" />
          </QueryClientProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

/**
 * A REFUSED DEVELOPMENT LAUNCH MUST NOT LOOK LIKE A BROKEN APP.
 *
 * Sam's order, 2026-08-10, after losing time to a blank screen twice in one day:
 * *"a white screen must be impossible to reach silently."*
 *
 * THE FOUNDING CASE, MEASURED RATHER THAN GUESSED. In `__DEV__` the navigator
 * mounts only after `prepareDevE2EAppLaunch()` resolves. It returned a bare
 * `false` on any failure and the effect simply returned — so **the app rendered
 * a root with nothing in it, forever, with no error, no red box and no text.**
 * A Maestro run leaves a dev clock receipt behind; the next PLAIN launch reads a
 * receipt with no matching checkpoint, `restoreDevE2EClockBeforeHydration`
 * throws *"clock receipt has no active checkpoint"*, and that is the white
 * screen Sam saw at 19:22 after his rebuild.
 *
 * WHY IT DOES NOT JUST MOUNT THE APP ANYWAY. The barrier exists so store
 * hydration cannot begin before the development clock is restored; mounting past
 * a failed restore would hydrate the athlete's stores against the wrong clock,
 * which is a worse fault than a blank screen and a silent one too. **So the app
 * still refuses — it just says so, and offers the one-tap way out.**
 *
 * DEVELOPMENT ONLY. This whole component is inside `__DEV__`; a release build
 * never reaches the barrier and never renders this.
 */
function DevLaunchRefused({ reason, onClear }: {
  reason: string;
  onClear: () => void;
}) {
  // Required, not imported at module scope: release must not pull these in.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pressable, Text, View } = require('react-native');
  return (
    <View
      testID="dev-launch-refused"
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#1A0A0A',
        padding: 24,
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <Text style={{ color: '#FF7A85', fontSize: 20, fontWeight: '800' }}>
        The app did not start
      </Text>
      <Text style={{ color: '#E8EAED', fontSize: 15, lineHeight: 22 }}>
        A development check refused before the app could load. This is the test
        harness, not your training data — nothing of yours has been lost.
      </Text>
      <Text
        testID="dev-launch-refused-reason"
        style={{ color: '#8A8A8A', fontSize: 13, lineHeight: 19 }}
      >
        {reason}
      </Text>
      <Pressable
        testID="dev-launch-refused-clear"
        onPress={onClear}
        style={{
          backgroundColor: '#D8D800',
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#0C0C0C', fontSize: 16, fontWeight: '800' }}>
          Clear test-harness state and start
        </Text>
      </Pressable>
    </View>
  );
}
