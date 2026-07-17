import type { DevE2EKeyValueStorage } from './devE2ECheckpoint';
import { readActiveDevE2EClockReceipt } from './devE2EClockPersistence';
import {
  EXPLORER_PHYSICAL_EVIDENCE_FAILURE,
  ExplorerPhysicalEvidenceBridge,
  ExplorerPhysicalEvidenceError,
  decodeExplorerPhysicalEvidenceReceipt,
  explorerCampaignArtifactDirectory,
  type ExplorerPhysicalCaptureRequestV1,
  type ExplorerPhysicalEvidenceReceiptV1,
} from './explorerPhysicalEvidence';
import {
  setDevE2EExplorerCaptureAccepted,
  setDevE2EExplorerCaptureError,
  setDevE2EExplorerCaptureRequest,
} from './devE2EState';

declare const __DEV__: boolean | undefined;

export const EXPLORER_PHYSICAL_EVIDENCE_CAMPAIGN_STORAGE_KEY =
  'dev-e2e-explorer-physical-evidence-campaign-v1';

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

function parseCampaignIdentity(value: unknown): ExplorerPhysicalEvidenceCampaignIdentity {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ExplorerPhysicalEvidenceError(
      EXPLORER_PHYSICAL_EVIDENCE_FAILURE.PERSISTENCE_FAILED,
      'campaign_identity',
    );
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== 2 || keys[0] !== 'campaignId' ||
    keys[1] !== 'integratedRepositorySha' ||
    typeof record.campaignId !== 'string' ||
    typeof record.integratedRepositorySha !== 'string' ||
    !/^[a-f0-9]{40}$/.test(record.integratedRepositorySha)) {
    throw new ExplorerPhysicalEvidenceError(
      EXPLORER_PHYSICAL_EVIDENCE_FAILURE.PERSISTENCE_FAILED,
      'campaign_identity',
    );
  }
  explorerCampaignArtifactDirectory(record.campaignId);
  return {
    campaignId: record.campaignId,
    integratedRepositorySha: record.integratedRepositorySha,
  };
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
  isDev?: boolean;
  storage?: DevE2EKeyValueStorage;
}): Promise<boolean> {
  if (!available(args.isDev)) {
    setDevE2EExplorerCaptureError(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.RELEASE_BUILD);
    return false;
  }
  const storage = args.storage ?? defaultStorage();
  const identity = parseCampaignIdentity({
    campaignId: args.campaignId,
    integratedRepositorySha: args.integratedRepositorySha,
  });
  await storage.setItem(
    EXPLORER_PHYSICAL_EVIDENCE_CAMPAIGN_STORAGE_KEY,
    JSON.stringify(identity),
  );
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
  const raw = await storage.getItem(EXPLORER_PHYSICAL_EVIDENCE_CAMPAIGN_STORAGE_KEY);
  if (!raw) return false;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ExplorerPhysicalEvidenceError(
      EXPLORER_PHYSICAL_EVIDENCE_FAILURE.PERSISTENCE_FAILED,
      'campaign_json',
    );
  }
  const identity = parseCampaignIdentity(value);
  const bridge = createBridge(identity, storage);
  active = { identity, bridge };
  await bridge.restore();
  return true;
}

export function readExplorerPhysicalEvidenceCampaignIdentity():
ExplorerPhysicalEvidenceCampaignIdentity | null {
  return active?.identity ?? null;
}

export async function requestExplorerPhysicalEvidence(
  request: ExplorerPhysicalCaptureRequestV1,
): Promise<ExplorerPhysicalEvidenceReceiptV1> {
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
