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
import {
  DEV_E2E_CLOCK_STORAGE_KEY,
  restoreDevE2EClockBeforeHydration,
} from './devE2EClockPersistence';
import { DEV_E2E_CHECKPOINT_STORAGE_KEY } from './devE2ECheckpoint';
import { DEV_E2E_SCENARIO_SESSION_STORAGE_KEY } from './devE2EScenarioSession';
import { DevE2EEntryRouteQueue } from './devE2EEntryRouteQueue';
import { devE2EScenarioReasonCode } from './devE2EScenarioProtocol';
import { ExplorerProductionRenderReceiptObserver } from './ExplorerProductionRenderReceiptObserver';
import { ExplorerActionIngressControl } from './ExplorerActionIngressControl';
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
import { restoreExplorerActionIngress } from './explorerActionIngress';
import {
  clearExplorerScenarioActiveTimeBudget,
  restoreExplorerScenarioActiveTimeBudget,
} from './explorerScenarioActiveTimeBudget';
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

function devE2ENativeBridge(): {
  receiptJson?: unknown;
  seedId?: unknown;
  launchRefusalCodes?: unknown;
} | undefined {
  return (NativeModules as Record<string, unknown>)
    .DevE2ELaunchDiagnostic as {
      receiptJson?: unknown;
      seedId?: unknown;
      launchRefusalCodes?: unknown;
    } | undefined;
}

/**
 * THE NATIVE SIDE'S REFUSALS, WHICH USED TO BE CRASHES.
 *
 * Sam's order, 2026-08-10, after the third crash of one shape in a day: *"A DEV
 * DIAGNOSTIC MUST NOT BE ABLE TO KILL THE APP… It should refuse loudly — a
 * visible marker the flow can assert on, a log line, a red screen — and let the
 * app boot."* `DevE2ELaunchDiagnostic.swift` held TEN `fatalError`s on the
 * launch path and now holds none; each one is a typed code arriving here.
 *
 * IT IS PUBLISHED THROUGH THE EXISTING LAUNCH-ERROR CHANNEL rather than a new
 * one. `e2e-explorer-launch-error-<code>` already means "the launch diagnostic
 * refused, and here is why" — a second marker family for the same fact would be
 * a second representation of one thing, which is the defect every law in this
 * repo exists to kill.
 */
function publishNativeLaunchRefusals(): void {
  const raw = devE2ENativeBridge()?.launchRefusalCodes;
  if (!Array.isArray(raw)) return;
  for (const code of raw) {
    if (typeof code === 'string' && code.length > 0) {
      setDevE2EExplorerLaunchError(code);
    }
  }
}

function nativeExplorerLaunchDiagnosticInput(): {
  receiptJson: unknown;
  explorerLaunchRequested: boolean;
} {
  // THE `SettingsManager` FALLBACK IS DELETED, AND IT WAS NEVER REACHABLE.
  //
  // It used to OR in `typeof settings?.e2eMetroUrl === 'string'`. A probe on
  // 2026-08-10 printed `keys=NO_SETTINGS`: `NativeModules.SettingsManager` is
  // `undefined` on this platform, so that arm could never be true. It was
  // harmless — the bridge's `receiptJson` carries the real signal — but it read
  // like a fallback somebody could rely on, which is the shape this repo keeps
  // paying for. Removed rather than left as reassurance.
  const receiptJson = devE2ENativeBridge()?.receiptJson;
  return { receiptJson, explorerLaunchRequested: receiptJson !== undefined };
}

/**
 * WAS THIS APP LAUNCHED BY THE HARNESS? One question, one answer, one channel.
 *
 * The native bridge only carries a receipt when the launch supplied
 * `e2eMetroUrl` — which only the runner does — so its presence IS the signal.
 * Exported because App.tsx has to know at module scope, before a frame is
 * drawn, whether a human or an instrument is holding the phone.
 */
export function devE2ELaunchRequested(): boolean {
  return nativeExplorerLaunchDiagnosticInput().explorerLaunchRequested;
}

/**
 * THE SEED REQUESTED AT LAUNCH, through the native channel that has its own
 * name, its own validation and its own refusal (`DevE2ELaunchDiagnostic.swift`).
 *
 * Sam ruled the design over the cheaper one: *"i dont care if it has to do 1
 * rebuild for 40 minutes - i care about the best solution long term"*.
 *
 * The native side has already validated the shape and `fatalError`ed on a
 * malformed value, so a string arriving here is one the app agreed to seed. The
 * type check is a boundary assertion, not a second opinion.
 */
function launchRequestedSeedId(): string | null {
  const seedId = devE2ENativeBridge()?.seedId;
  return typeof seedId === 'string' && seedId.length > 0 ? seedId : null;
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
/**
 * THE OUTCOME OF THE LAUNCH BARRIER, AND IT IS NO LONGER A BARE BOOLEAN.
 *
 * `false` used to be the whole answer, and `App.tsx` responded by never mounting
 * `RootNavigator` — **which renders as a white screen with nothing on it.** Sam
 * hit it at 19:22 on 2026-08-10 and had no way to know what had happened.
 *
 * The reason has to travel with the refusal or the screen cannot name it, and a
 * screen that cannot name it is the blank screen again with a border.
 */
export interface DevE2ELaunchPreparation {
  readonly ready: boolean;
  /** Present only when `ready` is false. The message shown to the developer. */
  readonly reason: string | null;
}

export async function prepareDevE2EAppLaunch(): Promise<DevE2ELaunchPreparation> {
  try {
    await restoreDevE2EClockBeforeHydration();
    await activeInstallation?.coordinatorReady();
    return { ready: true, reason: null };
  } catch (error) {
    publishDevE2EEntryError(error);
    return {
      ready: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * CLEAR THE HARNESS'S OWN LEFTOVERS AND NOTHING ELSE.
 *
 * The founding case: a Maestro run seeds a world and leaves a dev clock receipt
 * behind; the next PLAIN launch reads a receipt with no matching checkpoint,
 * `restoreDevE2EClockBeforeHydration` throws *"clock receipt has no active
 * checkpoint"*, and the app never mounts. **The athlete's own program is not
 * involved and is not touched here** — only the three dev-E2E records that
 * describe a harness session.
 */
export async function clearDevE2EHarnessState(): Promise<void> {
  // Loaded here, inside the development entry path, exactly as every other
  // dev-E2E storage reader in this tree does it.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module = require('@react-native-async-storage/async-storage');
  const storage = (module.default ?? module) as {
    removeItem: (key: string) => Promise<void>;
  };
  await Promise.all([
    storage.removeItem(DEV_E2E_CLOCK_STORAGE_KEY),
    storage.removeItem(DEV_E2E_CHECKPOINT_STORAGE_KEY),
    storage.removeItem(DEV_E2E_SCENARIO_SESSION_STORAGE_KEY),
  ]);
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

  // BEFORE ANYTHING ELSE IS ATTEMPTED. A native refusal means the launch inputs
  // were wrong, so every downstream step is about to fail for a reason that is
  // not its own. Publishing first means the marker naming the REAL cause is up
  // before any consequential one can be.
  publishNativeLaunchRefusals();

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
          await clearExplorerScenarioActiveTimeBudget(route.scenarioId);
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

  /**
   * SEEDING DOES NOT NEED A LAUNCH ARGUMENT, AND A LAUNCH-ARGUMENT VERSION OF IT
   * WAS BUILT HERE AND DELETED THE SAME DAY (2026-08-10).
   *
   * **Why it was built:** seeding went through a DEEP LINK, and on iOS Maestro's
   * `openLink` routes via Safari, which raises *"Open in 'Local Footy Athlete'?"*.
   * A `maestro hierarchy` dump proved that while that alert is up the
   * accessibility tree contains **the alert and ZERO app content** — it does not
   * overlay the app, it replaces what the runner can see. That is what "the rig
   * has been dead since 18 July" actually was.
   *
   * **Why it was deleted: it could never have worked, and the probe proved it.**
   * The launch argument was read from `NativeModules.SettingsManager.settings`,
   * and on this platform **`SettingsManager` is `undefined`** — a probe printed
   * `keys=NO_SETTINGS`. Shipping it would have been a feature that reads as
   * working and never fires.
   *
   * **THE SAME PROBE CONDEMNS EXISTING CODE, and it is left as a FINDING rather
   * than fixed in passing:** `nativeExplorerLaunchDiagnosticInput` above ORs in
   * `typeof settings?.e2eMetroUrl === 'string'`. That branch is unreachable for
   * the same reason. It is harmless today because the native bridge's
   * `receiptJson` carries the real signal, but it is a fallback nobody can rely
   * on and it reads like one they can.
   *
   * **What works instead, measured and free:** deliver the deep link with
   * `xcrun simctl openurl`, which hands the URL to the app directly rather than
   * navigating a web page to a custom scheme — **no Safari, no dialog, no native
   * change and no rebuild.** Verified 2026-08-10: the alert never appears and
   * the seed route runs.
   */
  const subscription = linking.addEventListener('url', (event) => {
    void handleUrl(event.url);
  });
  void linking.getInitialURL()
    .then(async (initialUrl) => {
      // A URL wins when both are present: it is the more specific request, and
      // a flow that opened one meant it.
      if (await handleUrl(initialUrl)) return true;
      const seedId = launchRequestedSeedId();
      if (!seedId) return false;
      // Through the SAME queue a URL uses, so ordering and the
      // coordinator-ready barrier stay one mechanism rather than two that can
      // drift. And onto the SAME `coordinator.reset(seedId)` the URL route
      // calls — one owner, two doors into it, no second seeding path.
      return routeQueue.enqueue(`launch:e2eSeedId:${seedId}`, {
        kind: 'reset',
        seedId,
      } as never);
    })
    .catch(publishDevE2EEntryError);

  activeInstallation = {
    installed: true,
    handleUrl,
    coordinatorReady: async () => {
      if (coordinator) return;
      await launchDiagnosticReady;
      // A seed AUTHORS a fresh world. Quiescent boot REPLAYS an existing one.
      // They used to overlap here because raw store hydration can finish before
      // the app's derived-world boot does; the replay latch then swallowed the
      // seed's durable writes under "THE BOOT DOES NOT WRITE". Finish the one
      // app hydration owner before releasing any queued seed route. This keeps
      // replay writes blocked and install writes durable without teaching the
      // storage boundary a second, dev-only meaning for the latch.
      //
      // Dynamic only after the hard development guard and clock barrier: boot
      // must derive against the restored deterministic clock.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { awaitAppHydration } = require('../../store/appHydrationGate');
      const hydration = await awaitAppHydration();
      if (hydration.status !== 'ready') {
        throw new Error(
          `dev_e2e_app_hydration_failed:${hydration.failedStores.join(',')}`,
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createDefaultDevE2ESeedCoordinator } =
        require('./defaultDevE2ESeedCoordinator');
      coordinator = createDefaultDevE2ESeedCoordinator(true);
      await restoreExplorerPhysicalEvidenceCampaign({ isDev });
      await restoreExplorerScenarioActiveTimeBudget();
      await restoreExplorerActionIngress();
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
      <ExplorerActionIngressControl />
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
