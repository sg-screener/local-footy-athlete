import type { DevE2EKeyValueStorage } from './devE2ECheckpoint';
import { readActiveDevE2EClockReceipt } from './devE2EClockPersistence';
import {
  EXPLORER_PHYSICAL_EVIDENCE_FAILURE,
  ExplorerPhysicalEvidenceBridge,
  ExplorerPhysicalEvidenceError,
  decodeExplorerPhysicalEvidenceReceipt,
  type ExplorerPhysicalCaptureRequestV1,
  type ExplorerPhysicalEvidenceReceiptV1,
} from './explorerPhysicalEvidence';
import {
  setDevE2EExplorerCaptureAccepted,
  setDevE2EExplorerCaptureError,
  setDevE2EExplorerCaptureRequest,
} from './devE2EState';
import {
  acceptExplorerCampaignBootstrap,
  restoreExplorerCampaignBootstrap,
} from './explorerCampaignBootstrap';

declare const __DEV__: boolean | undefined;

export interface ExplorerPhysicalEvidenceCampaignIdentity {
  readonly campaignId: string;
  readonly integratedRepositorySha: string;
}

let active: {
  identity: ExplorerPhysicalEvidenceCampaignIdentity;
  bridge: ExplorerPhysicalEvidenceBridge;
} | null = null;

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

function createBridge(
  identity: ExplorerPhysicalEvidenceCampaignIdentity,
  storage: DevE2EKeyValueStorage,
): ExplorerPhysicalEvidenceBridge {
  return new ExplorerPhysicalEvidenceBridge({
    storage,
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
    },
  });
}

export async function startExplorerPhysicalEvidenceCampaign(args: {
  campaignId: string;
  integratedRepositorySha: string;
  e2eMetroUrl: string;
  isDev?: boolean;
  storage?: DevE2EKeyValueStorage;
}): Promise<boolean> {
  if (!available(args.isDev)) {
    setDevE2EExplorerCaptureError(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.RELEASE_BUILD);
    return false;
  }
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
  };
  const bridge = createBridge(identity, storage);
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
  // Runtime advancement pauses on this promise until the external deep-link
  // acknowledgement persists the exact matching receipt.
  return new Promise<ExplorerPhysicalEvidenceReceiptV1>((resolve, reject) => {
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      try {
        const receipt = await bridge.readAccepted(request.captureId);
        if (receipt) {
          stopped = true;
          resolve(receipt);
          return;
        }
        setTimeout(() => void poll(), 20);
      } catch (error) {
        stopped = true;
        reject(error);
      }
    };
    void poll();
  });
}

export async function acknowledgeExplorerPhysicalEvidence(
  captureId: string,
  encodedReceipt: string,
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
  const receipt = decodeExplorerPhysicalEvidenceReceipt(encodedReceipt);
  await active.bridge.acknowledge(captureId, receipt);
  return true;
}

export function __resetExplorerPhysicalEvidenceDevBridgeForTest(): void {
  active = null;
}
