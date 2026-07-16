import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import RootNavigator from './src/navigation/RootNavigator';
import { logCoachBuildFingerprint } from './src/utils/coachBuildInfo';

let DevE2EStatusMarkers: React.ComponentType | null = null;
if (__DEV__) {
  // The entire coordinator graph is development-only. There is no env or
  // production override: release bundles do not execute either require.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const devEntry = require('./src/dev/e2e/devE2EEntry');
  devEntry.installDevE2EEntry({ isDev: true });
  DevE2EStatusMarkers = devEntry.DevE2EStatusMarkers;
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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            {DevE2EStatusMarkers ? <DevE2EStatusMarkers /> : null}
            <RootNavigator />
            <StatusBar style="light" />
          </QueryClientProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
