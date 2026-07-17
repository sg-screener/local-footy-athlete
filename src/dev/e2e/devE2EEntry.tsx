import React from 'react';
import { Linking, NativeModules, Text, View } from 'react-native';
import { parseDevE2EEntryRoute } from './devE2EEntryRoute';
export { parseDevE2EEntryRoute } from './devE2EEntryRoute';
export type { DevE2EEntryRoute } from './devE2EEntryRoute';
import {
  devE2EMarkers,
  getDevE2EStateSnapshot,
  setDevE2EEntryReady,
  setDevE2EExplorerMetroDiagnostic,
  setDevE2EScenarioError,
  setDevE2ESeedError,
  subscribeDevE2EState,
} from './devE2EState';
import { restoreDevE2EClockBeforeHydration } from './devE2EClockPersistence';
import { devE2EScenarioReasonCode } from './devE2EScenarioProtocol';
import { ExplorerProductionRenderReceiptObserver } from './ExplorerProductionRenderReceiptObserver';
import {
  runLiveExplorerCampaign,
  runLiveExplorerScenario,
} from './explorerLiveScenarioRuntime';
import {
  acknowledgeExplorerPhysicalEvidence,
  restoreExplorerPhysicalEvidenceCampaign,
  startExplorerPhysicalEvidenceCampaign,
} from './explorerPhysicalEvidenceDevBridge';
import { verifyExplorerMetroDiagnostic } from './explorerAppLaunchContract';

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

function nativeE2EMetroUrl(): string | null {
  const settings = (NativeModules.SettingsManager as {
    settings?: Record<string, unknown>;
  } | undefined)?.settings;
  const value = settings?.e2eMetroUrl;
  return typeof value === 'string' ? value : null;
}

function publishDevE2EEntryError(
  error: unknown,
  scenarioId: string | null = null,
): void {
  const reasonCode = devE2EScenarioReasonCode(error);
  if (reasonCode) {
    setDevE2EScenarioError(reasonCode, error, scenarioId);
  } else {
    setDevE2ESeedError(error);
  }
}

/**
 * Must finish before RootNavigator or the coordinator imports persisted
 * stores. A mismatch fails closed and remains visible through the E2E marker.
 */
export async function prepareDevE2EAppLaunch(): Promise<boolean> {
  try {
    await restoreDevE2EClockBeforeHydration();
    return true;
  } catch (error) {
    publishDevE2EEntryError(error);
    return false;
  }
}

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
      if ('e2eMetroUrl' in route) {
        const selectedMetroUrl = verifyExplorerMetroDiagnostic({
          deepLinkMetroUrl: route.e2eMetroUrl,
          nativeMetroUrl: nativeE2EMetroUrl(),
        });
        setDevE2EExplorerMetroDiagnostic({
          metroUrl: selectedMetroUrl,
          ...(route.kind === 'explorer_diagnostic'
            ? { launchPurpose: route.launchPurpose }
            : {}),
        });
      }
      switch (route.kind) {
        case 'reset':
          return await coordinator.reset(route.seedId);
        case 'checkpoint':
          return await coordinator.checkpoint(route.checkpointId);
        case 'scenario_reset':
          return await coordinator.resetScenario(route.scenarioId);
        case 'scenario_checkpoint':
          return await coordinator.checkpointScenario(
            route.scenarioId,
            route.checkpointStepId,
          );
        case 'explorer_run': {
          const result = await runLiveExplorerScenario({
            coordinator,
            scenarioId: route.scenarioId,
          });
          if (result.status === 'blocked') {
            setDevE2EScenarioError(result.reasonCode, result, route.scenarioId);
          }
          return true;
        }
        case 'explorer_campaign': {
          const result = await runLiveExplorerCampaign(coordinator);
          if (result.status === 'blocked') {
            setDevE2EScenarioError(result.reasonCode, result);
          }
          return true;
        }
        case 'explorer_diagnostic':
          return true;
        case 'explorer_evidence_start':
          return await startExplorerPhysicalEvidenceCampaign({
            campaignId: route.campaignId,
            integratedRepositorySha: route.integratedRepositorySha,
            isDev,
          });
        case 'explorer_evidence':
          return await acknowledgeExplorerPhysicalEvidence(
            route.captureId,
            route.encodedReceipt,
            isDev,
          );
      }
    } catch (error) {
      publishDevE2EEntryError(
        error,
        'scenarioId' in route ? route.scenarioId : null,
      );
      return false;
    }
  };

  const subscription = linking.addEventListener('url', (event) => {
    void handleUrl(event.url);
  });
  void linking.getInitialURL().then(handleUrl).catch(publishDevE2EEntryError);
  // Reload validation is deliberately separate from URL handling. A preserved
  // checkpoint is inspected after hydration without calling reset/buildSeed.
  void coordinator.validateReloadCheckpoint().catch(publishDevE2EEntryError);
  void restoreExplorerPhysicalEvidenceCampaign({ isDev })
    .catch(publishDevE2EEntryError);

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
      <ExplorerProductionRenderReceiptObserver />
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
