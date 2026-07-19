import type { DevE2EKeyValueStorage } from './devE2ECheckpoint';
import { readActiveDevE2EClockReceipt } from './devE2EClockPersistence';
import {
  EXPLORER_PHYSICAL_EVIDENCE_FAILURE,
  ExplorerPhysicalEvidenceBridge,
  ExplorerPhysicalEvidenceError,
  type ExplorerPhysicalEvidenceArtifactReader,
  type ExplorerPhysicalCaptureRequestV1,
  type ExplorerPhysicalEvidenceReceiptV1,
} from './explorerPhysicalEvidence';
import {
  setDevE2EExplorerCaptureAccepted,
  setDevE2EExplorerCaptureError,
  setDevE2EExplorerCaptureRequest,
  setDevE2EExplorerCaptureStage,
} from './devE2EState';
import {
  acceptExplorerCampaignBootstrap,
  restoreExplorerCampaignBootstrap,
} from './explorerCampaignBootstrap';
import { requireActiveExplorerNativeLaunchDiagnostic } from
  './explorerNativeLaunchDiagnostic';
import {
  resumeExplorerLiveExternalPauseIfPresent,
  withExplorerExternalStageDeadline,
} from './explorerScenarioActiveTimeBudget';

declare const __DEV__: boolean | undefined;

export interface ExplorerPhysicalEvidenceCampaignIdentity {
  readonly campaignId: string;
  readonly integratedRepositorySha: string;
  readonly e2eMetroUrl: string;
}

let active: {
  identity: ExplorerPhysicalEvidenceCampaignIdentity;
  bridge: ExplorerPhysicalEvidenceBridge;
} | null = null;
const pendingCaptureWaits = new Map<string, {
  promise: Promise<ExplorerPhysicalEvidenceReceiptV1>;
  resolve: (receipt: ExplorerPhysicalEvidenceReceiptV1) => void;
  reject: (error: unknown) => void;
}>();

function available(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  if (typeof __DEV__ !== 'undefined') return __DEV__;
  return (globalThis as { __DEV__?: boolean }).__DEV__ === true;
}

function defaultStorage(): DevE2EKeyValueStorage {
  // Loaded only from the guarded development entry.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module = require('@react-native-async-storage/async-storage');
  return module.default ?? module;
}

export function explorerPhysicalEvidenceArtifactUrl(args: {
  e2eMetroUrl: string;
  campaignId: string;
  relativeReference: string;
}): string {
  // Keep this literal and query-free. iOS URL delivery changed the query
  // representation before the strict Metro boundary saw it. Two encoded path
  // segments preserve the validated campaign and relative-file identities.
  return `${args.e2eMetroUrl}/__dev_e2e__/explorer-physical-evidence/` +
    `${encodeURIComponent(args.campaignId)}/` +
    encodeURIComponent(args.relativeReference);
}

function metroArtifactReader(
  e2eMetroUrl: string,
): ExplorerPhysicalEvidenceArtifactReader {
  return async ({ campaignId, relativeReference }) => {
    const url = explorerPhysicalEvidenceArtifactUrl({
      e2eMetroUrl,
      campaignId,
      relativeReference,
    });
    const response = await fetch(url, { cache: 'no-store' });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`explorer_physical_evidence_read_failed:${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  };
}

function createBridge(
  identity: ExplorerPhysicalEvidenceCampaignIdentity,
  storage: DevE2EKeyValueStorage,
  readArtifact: ExplorerPhysicalEvidenceArtifactReader =
    metroArtifactReader(identity.e2eMetroUrl),
): ExplorerPhysicalEvidenceBridge {
  return new ExplorerPhysicalEvidenceBridge({
    storage,
    readArtifact,
    integratedRepositorySha: identity.integratedRepositorySha,
    currentClockFingerprint: () => {
      const clock = readActiveDevE2EClockReceipt();
      if (!clock) {
        throw new ExplorerPhysicalEvidenceError(
          EXPLORER_PHYSICAL_EVIDENCE_FAILURE.CLOCK_MISMATCH,
          'active_clock_missing',
        );
      }
      return clock.semanticFingerprint;
    },
    markers: {
      request: setDevE2EExplorerCaptureRequest,
      accepted: setDevE2EExplorerCaptureAccepted,
      error: setDevE2EExplorerCaptureError,
      stage: setDevE2EExplorerCaptureStage,
    },
  });
}

export async function startExplorerPhysicalEvidenceCampaign(args: {
  campaignId: string;
  integratedRepositorySha: string;
  e2eMetroUrl: string;
  isDev?: boolean;
  storage?: DevE2EKeyValueStorage;
  readArtifact?: ExplorerPhysicalEvidenceArtifactReader;
}): Promise<boolean> {
  if (!available(args.isDev)) {
    setDevE2EExplorerCaptureError(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.RELEASE_BUILD);
    return false;
  }
  requireActiveExplorerNativeLaunchDiagnostic({
    launchPurpose: 'initial-cold-launch',
    selectedMetroUrl: args.e2eMetroUrl,
    integratedRepositorySha: args.integratedRepositorySha,
  });
  const storage = args.storage ?? defaultStorage();
  const bootstrap = await acceptExplorerCampaignBootstrap({
    campaignId: args.campaignId,
    integratedRepositorySha: args.integratedRepositorySha,
    e2eMetroUrl: args.e2eMetroUrl,
    storage,
    isDev: args.isDev,
  });
  const identity = {
    campaignId: bootstrap.campaignId,
    integratedRepositorySha: bootstrap.integratedRepositorySha,
    e2eMetroUrl: bootstrap.e2eMetroUrl,
  };
  const bridge = createBridge(identity, storage, args.readArtifact);
  active = { identity, bridge };
  await bridge.restore();
  return true;
}

export async function restoreExplorerPhysicalEvidenceCampaign(args: {
  isDev?: boolean;
  storage?: DevE2EKeyValueStorage;
} = {}): Promise<boolean> {
  if (!available(args.isDev)) return false;
  const storage = args.storage ?? defaultStorage();
  const bootstrap = await restoreExplorerCampaignBootstrap({
    storage,
    isDev: args.isDev,
  });
  if (!bootstrap || (bootstrap.status !== 'accepted' &&
    bootstrap.status !== 'active' && bootstrap.status !== 'complete')) {
    return false;
  }
  const identity = {
    campaignId: bootstrap.campaignId,
    integratedRepositorySha: bootstrap.integratedRepositorySha,
    e2eMetroUrl: bootstrap.e2eMetroUrl,
  };
  const bridge = createBridge(identity, storage);
  active = { identity, bridge };
  await bridge.restore();
  return true;
}

export async function requestExplorerPhysicalEvidence(
  request: ExplorerPhysicalCaptureRequestV1,
): Promise<ExplorerPhysicalEvidenceReceiptV1> {
  if (!available()) {
    setDevE2EExplorerCaptureError(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.RELEASE_BUILD);
    throw new ExplorerPhysicalEvidenceError(
      EXPLORER_PHYSICAL_EVIDENCE_FAILURE.RELEASE_BUILD,
    );
  }
  if (!active || request.campaignId !== active.identity.campaignId) {
    throw new ExplorerPhysicalEvidenceError(
      EXPLORER_PHYSICAL_EVIDENCE_FAILURE.CAMPAIGN_MISMATCH,
    );
  }
  const bridge = active.bridge;
  await bridge.requestCapture(request);
  const existing = pendingCaptureWaits.get(request.captureId);
  if (existing) return existing.promise;
  let resolveWait!: (receipt: ExplorerPhysicalEvidenceReceiptV1) => void;
  let rejectWait!: (error: unknown) => void;
  const promise = new Promise<ExplorerPhysicalEvidenceReceiptV1>(
    (resolve, reject) => {
      resolveWait = resolve;
      rejectWait = reject;
    },
  );
  pendingCaptureWaits.set(request.captureId, {
    promise,
    resolve: resolveWait,
    reject: rejectWait,
  });
  try {
    const accepted = await bridge.readAccepted(request.captureId);
    if (accepted) {
      resolveWait(accepted);
      pendingCaptureWaits.delete(request.captureId);
    }
  } catch (error) {
    pendingCaptureWaits.delete(request.captureId);
    throw error;
  }
  // Only the bridge completion below resolves this wait, after durable
  // readback and accepted-marker publication.
  try {
    return await withExplorerExternalStageDeadline(
      request.capturePhase === 'seed-reset'
        ? 'physical_evidence_acknowledgement'
        : 'physical_evidence_capture',
      async () => await promise,
    );
  } catch (error) {
    pendingCaptureWaits.delete(request.captureId);
    throw error;
  }
}

export async function acknowledgeExplorerPhysicalEvidence(
  captureId: string,
  receiptFileReference: string,
  receiptSha256: string,
  isDev?: boolean,
): Promise<boolean> {
  if (!available(isDev)) {
    setDevE2EExplorerCaptureError(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.RELEASE_BUILD);
    return false;
  }
  if (!active) {
    setDevE2EExplorerCaptureError(
      EXPLORER_PHYSICAL_EVIDENCE_FAILURE.REQUEST_NOT_PENDING,
    );
    return false;
  }
  try {
    const result = await active.bridge.acknowledgeReference(
      captureId,
      receiptFileReference,
      receiptSha256,
    );
    await resumeExplorerLiveExternalPauseIfPresent({
      reason: result.receipt.capturePhase === 'seed-reset'
        ? 'physical_evidence_acknowledgement'
        : 'physical_evidence_capture',
      scope: captureId,
      scenarioId: result.receipt.scenarioId,
    });
    pendingCaptureWaits.get(captureId)?.resolve(result.receipt);
    pendingCaptureWaits.delete(captureId);
    return true;
  } catch (error) {
    pendingCaptureWaits.get(captureId)?.reject(error);
    pendingCaptureWaits.delete(captureId);
    throw error;
  }
}

export function __resetExplorerPhysicalEvidenceDevBridgeForTest(): void {
  active = null;
  pendingCaptureWaits.clear();
}
