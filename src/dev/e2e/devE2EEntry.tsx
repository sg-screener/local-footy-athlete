import React from 'react';
import { Linking, NativeModules, Text, View } from 'react-native';
import {
  explorerPhysicalEvidenceCaptureIdFromRoute,
  parseDevE2EEntryRoute,
} from './devE2EEntryRoute';
export { parseDevE2EEntryRoute } from './devE2EEntryRoute';
export type { DevE2EEntryRoute } from './devE2EEntryRoute';
import {
  devE2EMarkers,
  getDevE2EStateSnapshot,
  setDevE2EEntryReady,
  setDevE2EExplorerCampaignError,
  setDevE2EExplorerCampaignPending,
  setDevE2EExplorerCaptureStage,
  setDevE2EExplorerLaunchError,
  setDevE2EExplorerNativeLaunchDiagnostic,
  setDevE2EScenarioError,
  setDevE2ESeedError,
  subscribeDevE2EState,
} from './devE2EState';
import { restoreDevE2EClockBeforeHydration } from './devE2EClockPersistence';
import { DevE2EEntryRouteQueue } from './devE2EEntryRouteQueue';
import { devE2EScenarioReasonCode } from './devE2EScenarioProtocol';
import { ExplorerProductionRenderReceiptObserver } from './ExplorerProductionRenderReceiptObserver';
import {
  EXPLORER_CAMPAIGN_BOOTSTRAP_REASON,
  ExplorerCampaignBootstrapError,
  requireExplorerCampaignScenarioReset,
  type ExplorerCampaignScenarioPrerequisite,
} from './explorerCampaignBootstrap';
import {
  runLiveExplorerCampaign,
  runLiveExplorerScenario,
} from './explorerLiveScenarioRuntime';
import {
  acknowledgeExplorerPhysicalEvidence,
  restoreExplorerPhysicalEvidenceCampaign,
  startExplorerPhysicalEvidenceCampaign,
} from './explorerPhysicalEvidenceDevBridge';
import {
  ExplorerNativeLaunchDiagnosticError,
  hydrateExplorerNativeLaunchDiagnostic,
  readActiveExplorerNativeLaunchDiagnostic,
  verifyExplorerNativeLaunchDiagnosticReceipt,
} from './explorerNativeLaunchDiagnostic';
import { ExplorerPhysicalEvidenceError } from './explorerPhysicalEvidence';
import type { DevE2ESeedCoordinator } from './DevE2ESeedCoordinator';

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
  coordinatorReady: () => Promise<void>;
  remove: () => void;
}

let activeInstallation: InstalledDevE2EEntry | null = null;

function nativeExplorerLaunchDiagnosticInput(): {
  receiptJson: unknown;
  explorerLaunchRequested: boolean;
} {
  const settings = (NativeModules.SettingsManager as {
    settings?: Record<string, unknown>;
  } | undefined)?.settings;
  const bridge = (NativeModules as Record<string, unknown>)
    .DevE2ELaunchDiagnostic as { receiptJson?: unknown } | undefined;
  const receiptJson = bridge?.receiptJson;
  return {
    receiptJson,
    explorerLaunchRequested: receiptJson !== undefined ||
      typeof settings?.e2eMetroUrl === 'string' ||
      typeof settings?.e2eLaunchPurpose === 'string',
  };
}

function publishDevE2EEntryError(
  error: unknown,
  scenarioId: string | null = null,
): void {
  if (error instanceof ExplorerNativeLaunchDiagnosticError) {
    setDevE2EExplorerLaunchError(error.reasonCode);
    return;
  }
  if (error instanceof ExplorerPhysicalEvidenceError) {
    // The bridge already published its exact fail-closed capture reason.
    return;
  }
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
    await activeInstallation?.coordinatorReady();
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
      coordinatorReady: async () => {},
      remove: () => {},
    };
  }
  if (activeInstallation) return activeInstallation;

  const linking = args.linking ?? (Linking as unknown as DevE2ELinking);
  const routeQueue = new DevE2EEntryRouteQueue<
    NonNullable<ReturnType<typeof parseDevE2EEntryRoute>>
  >();
  // Evidence acknowledgement must be able to resolve the promise held by an
  // active scenario route; placing both on one serial queue deadlocks them.
  const evidenceRouteQueue = new DevE2EEntryRouteQueue<
    Extract<
      NonNullable<ReturnType<typeof parseDevE2EEntryRoute>>,
      { kind: 'explorer_evidence' }
    >
  >();
  let coordinator: DevE2ESeedCoordinator | null = null;
  setDevE2EEntryReady();

  const nativeDiagnostic = nativeExplorerLaunchDiagnosticInput();
  const launchDiagnosticReady = nativeDiagnostic.explorerLaunchRequested
    ? hydrateExplorerNativeLaunchDiagnostic({
        nativeReceiptJson: nativeDiagnostic.receiptJson,
        isDev,
      }).then((receipt) => {
        // Readiness is visible only after the transaction's exact readback.
        setDevE2EExplorerNativeLaunchDiagnostic(receipt);
        return receipt;
      }).catch((error: unknown) => {
        setDevE2EExplorerLaunchError(
          error instanceof ExplorerNativeLaunchDiagnosticError
            ? error.reasonCode
            : 'native-receipt-corrupt',
        );
        return null;
      })
    : Promise.resolve(null);

  const campaignPrerequisite = (
    route: Extract<
      NonNullable<ReturnType<typeof parseDevE2EEntryRoute>>,
      { kind: 'explorer_run' | 'explorer_campaign' }
    >,
  ): ExplorerCampaignScenarioPrerequisite => {
    if (!route.campaignId || !route.integratedRepositorySha ||
      !route.e2eMetroUrl || !route.deterministicClockFingerprint) {
      setDevE2EExplorerCampaignError(
        EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.CAMPAIGN_MISSING,
      );
      throw new ExplorerCampaignBootstrapError(
        EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.CAMPAIGN_MISSING,
      );
    }
    return {
      campaignId: route.campaignId,
      integratedRepositorySha: route.integratedRepositorySha,
      e2eMetroUrl: route.e2eMetroUrl,
      deterministicClockFingerprint: route.deterministicClockFingerprint,
    };
  };

  const processRoute = async (
    route: NonNullable<ReturnType<typeof parseDevE2EEntryRoute>>,
  ): Promise<boolean> => {
    if (!coordinator) return false;
    try {
      let selectedMetroUrl: string | null = null;
      if ('e2eMetroUrl' in route) {
        if (!route.e2eMetroUrl) {
          throw new Error('explorer_metro_diagnostic_query_missing');
        }
        selectedMetroUrl = verifyExplorerNativeLaunchDiagnosticReceipt(
          readActiveExplorerNativeLaunchDiagnostic(),
          { selectedMetroUrl: route.e2eMetroUrl },
        ).requestedMetroUrl;
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
          await requireExplorerCampaignScenarioReset(
            campaignPrerequisite(route),
          );
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
          await requireExplorerCampaignScenarioReset(
            campaignPrerequisite(route),
          );
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
            e2eMetroUrl: selectedMetroUrl!,
            isDev,
          });
        case 'explorer_evidence':
          return await acknowledgeExplorerPhysicalEvidence(
            route.captureId,
            route.receiptFileReference,
            route.receiptSha256,
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

  const handleUrl = async (url: string | null | undefined): Promise<boolean> => {
    const evidenceCaptureId = explorerPhysicalEvidenceCaptureIdFromRoute(url);
    if (evidenceCaptureId) {
      setDevE2EExplorerCaptureStage(evidenceCaptureId, 'route-received');
    }
    const route = parseDevE2EEntryRoute(url);
    if (!route || !url) return false;
    if (route.kind === 'explorer_evidence_start') {
      setDevE2EExplorerCampaignPending(route.campaignId);
    }
    return route.kind === 'explorer_evidence'
      ? evidenceRouteQueue.enqueue(url, route)
      : routeQueue.enqueue(url, route);
  };

  const subscription = linking.addEventListener('url', (event) => {
    void handleUrl(event.url);
  });
  void linking.getInitialURL().then(handleUrl).catch(publishDevE2EEntryError);

  activeInstallation = {
    installed: true,
    handleUrl,
    coordinatorReady: async () => {
      if (coordinator) return;
      await launchDiagnosticReady;
      // Dynamic only after the hard development guard and clock barrier.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createDefaultDevE2ESeedCoordinator } =
        require('./defaultDevE2ESeedCoordinator');
      coordinator = createDefaultDevE2ESeedCoordinator(true);
      await restoreExplorerPhysicalEvidenceCampaign({ isDev });
      // Reload validation remains separate from route handling and never
      // calls reset/buildSeed for a preserved checkpoint.
      await coordinator.validateReloadCheckpoint();
      await evidenceRouteQueue.setReady(processRoute);
      await routeQueue.setReady(processRoute);
    },
    remove: () => {
      subscription.remove();
      evidenceRouteQueue.clear();
      routeQueue.clear();
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
