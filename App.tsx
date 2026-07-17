import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { logCoachBuildFingerprint } from './src/utils/coachBuildInfo';

let DevE2EStatusMarkers: React.ComponentType | null = null;
let prepareDevE2EAppLaunch: (() => Promise<boolean>) | null = null;
let installDevE2EEntry: (() => unknown) | null = null;
let ReleaseRootNavigator: React.ComponentType | null = null;
if (__DEV__) {
  // Clock bootstrap is storage-only. The coordinator/store graph is imported
  // after the receipt is restored and checked against the active checkpoint.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const devEntry = require('./src/dev/e2e/devE2EEntry');
  DevE2EStatusMarkers = devEntry.DevE2EStatusMarkers;
  prepareDevE2EAppLaunch = devEntry.prepareDevE2EAppLaunch;
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

logCoachBuildFingerprint('app_launch');

export default function App() {
  const [DevRootNavigator, setDevRootNavigator] =
    React.useState<React.ComponentType | null>(null);

  React.useEffect(() => {
    if (!__DEV__ || !prepareDevE2EAppLaunch || !installDevE2EEntry) return;
    let mounted = true;
    void prepareDevE2EAppLaunch().then((ready) => {
      if (!ready || !mounted) return;
      // Store hydration begins only after the dev clock restoration barrier.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const RootNavigator = require('./src/navigation/RootNavigator').default;
      if (mounted) setDevRootNavigator(() => RootNavigator);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const RootNavigator = __DEV__ ? DevRootNavigator : ReleaseRootNavigator;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            {DevE2EStatusMarkers ? <DevE2EStatusMarkers /> : null}
            {RootNavigator ? <RootNavigator /> : null}
            <StatusBar style="light" />
          </QueryClientProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
