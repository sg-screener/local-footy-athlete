import React from 'react';
import { Linking, Text, View } from 'react-native';
import { parseDevE2EEntryRoute } from './devE2EEntryRoute';
export { parseDevE2EEntryRoute } from './devE2EEntryRoute';
export type { DevE2EEntryRoute } from './devE2EEntryRoute';
import {
  devE2EMarkers,
  getDevE2EStateSnapshot,
  setDevE2EEntryReady,
  setDevE2ESeedError,
  subscribeDevE2EState,
} from './devE2EState';

export interface DevE2ELinking {
  addEventListener: (
    event: 'url',
    listener: (event: { url?: string | null }) => void,
  ) => { remove: () => void };
  getInitialURL: () => Promise<string | null>;
}

export interface InstalledDevE2EEntry {
  installed: boolean;
  handleUrl: (url: string | null | undefined) => Promise<boolean>;
  remove: () => void;
}

let activeInstallation: InstalledDevE2EEntry | null = null;

export function installDevE2EEntry(args: {
  isDev?: boolean;
  linking?: DevE2ELinking;
} = {}): InstalledDevE2EEntry {
  const isDev = args.isDev ?? (typeof __DEV__ !== 'undefined' && __DEV__);
  if (!isDev) {
    return {
      installed: false,
      handleUrl: async () => false,
      remove: () => {},
    };
  }
  if (activeInstallation) return activeInstallation;

  // Dynamic only after the hard development guard. Release evaluation of this
  // entry module therefore cannot import the registry or hydrate/mutate stores.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createDefaultDevE2ESeedCoordinator } = require('./defaultDevE2ESeedCoordinator');
  const coordinator = createDefaultDevE2ESeedCoordinator(true);
  const linking = args.linking ?? (Linking as unknown as DevE2ELinking);
  setDevE2EEntryReady();

  const handleUrl = async (url: string | null | undefined): Promise<boolean> => {
    const route = parseDevE2EEntryRoute(url);
    if (!route) return false;
    try {
      return await (route.kind === 'reset'
        ? coordinator.reset(route.seedId)
        : coordinator.checkpoint(route.checkpointId));
    } catch (error) {
      setDevE2ESeedError(error);
      return false;
    }
  };

  const subscription = linking.addEventListener('url', (event) => {
    void handleUrl(event.url);
  });
  void linking.getInitialURL().then(handleUrl).catch(setDevE2ESeedError);
  // Reload validation is deliberately separate from URL handling. A preserved
  // checkpoint is inspected after hydration without calling reset/buildSeed.
  void coordinator.validateReloadCheckpoint().catch(setDevE2ESeedError);

  activeInstallation = {
    installed: true,
    handleUrl,
    remove: () => {
      subscription.remove();
      activeInstallation = null;
    },
  };
  return activeInstallation;
}

const MARKER_STYLE = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  width: 1,
  height: 1,
  opacity: 0.01,
  zIndex: 2147483647,
  elevation: 2147483647,
};

export function DevE2EStatusMarkers(): React.ReactElement {
  const snapshot = React.useSyncExternalStore(
    subscribeDevE2EState,
    getDevE2EStateSnapshot,
    getDevE2EStateSnapshot,
  );
  const errorReason = snapshot.phase === 'seed_error' ? snapshot.error : null;
  return (
    <>
      {devE2EMarkers(snapshot).map((marker) => (
        <View
          key={marker}
          accessible
          collapsable={false}
          pointerEvents="none"
          style={MARKER_STYLE}
          testID={marker}
          accessibilityLabel={marker}
        >
          <Text>{marker}</Text>
        </View>
      ))}
      {errorReason ? (
        <View
          accessible
          collapsable={false}
          pointerEvents="none"
          style={MARKER_STYLE}
          testID="e2e-seed-error-reason"
          accessibilityLabel={errorReason}
        >
          <Text>{errorReason}</Text>
        </View>
      ) : null}
    </>
  );
}

export function __resetDevE2EEntryForTest(): void {
  activeInstallation?.remove();
  activeInstallation = null;
}
