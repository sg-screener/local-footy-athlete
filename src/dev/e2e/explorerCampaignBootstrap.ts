import type { DevE2EKeyValueStorage } from './devE2ECheckpoint';
import {
  createExplorerCampaignBootstrapRecord,
  explorerCampaignBootstrapRecordsMatch,
  parseExplorerCampaignBootstrapIdentity,
  parseExplorerCampaignBootstrapRecord,
  type ExplorerCampaignBootstrapIdentity,
  type ExplorerCampaignBootstrapRecord,
  type ExplorerCampaignBootstrapStatus,
} from './explorerCampaignBootstrapContract';
import {
  setDevE2EExplorerCampaignAccepted,
  setDevE2EExplorerCampaignError,
  setDevE2EExplorerCampaignPending,
} from './devE2EState';

declare const __DEV__: boolean | undefined;

export const EXPLORER_CAMPAIGN_BOOTSTRAP_STORAGE_KEY =
  'dev-e2e-explorer-campaign-bootstrap-v1';

export const EXPLORER_CAMPAIGN_BOOTSTRAP_REASON = {
  RELEASE_BUILD: 'release-build',
  CONFLICT: 'campaign-conflict',
  PERSISTENCE_READBACK_MISMATCH: 'persistence-readback-mismatch',
  RECEIPT_CORRUPT: 'receipt-corrupt',
  CAMPAIGN_MISSING: 'campaign-missing',
  CAMPAIGN_NOT_ACCEPTED: 'campaign-not-accepted',
  CAMPAIGN_ID_MISMATCH: 'campaign-id-mismatch',
  REPOSITORY_SHA_MISMATCH: 'repository-sha-mismatch',
  METRO_URL_MISMATCH: 'metro-url-mismatch',
  STALE_CLOCK_RECEIPT: 'stale-clock-receipt',
} as const;

export type ExplorerCampaignBootstrapReasonCode =
  typeof EXPLORER_CAMPAIGN_BOOTSTRAP_REASON[keyof
    typeof EXPLORER_CAMPAIGN_BOOTSTRAP_REASON];

export class ExplorerCampaignBootstrapError extends Error {
  constructor(
    readonly reasonCode: ExplorerCampaignBootstrapReasonCode,
    detail?: string,
  ) {
    super(detail ? `${reasonCode}:${detail}` : reasonCode);
    this.name = 'ExplorerCampaignBootstrapError';
  }
}

export interface ExplorerCampaignScenarioPrerequisite
extends ExplorerCampaignBootstrapIdentity {
  readonly deterministicClockFingerprint: string;
}

export interface ExplorerCampaignBootstrapMarkers {
  pending: (campaignId: string) => void;
  accepted: (campaignId: string) => void;
  error: (reasonCode: string) => void;
}

function defaultStorage(): DevE2EKeyValueStorage {
  // Loaded only after the development entry guard.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module = require('@react-native-async-storage/async-storage');
  return module.default ?? module;
}

function available(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  if (typeof __DEV__ !== 'undefined') return __DEV__;
  return (globalThis as { __DEV__?: boolean }).__DEV__ === true;
}

function sameIdentity(
  left: ExplorerCampaignBootstrapIdentity,
  right: ExplorerCampaignBootstrapIdentity,
): boolean {
  return left.campaignId === right.campaignId &&
    left.integratedRepositorySha === right.integratedRepositorySha &&
    left.e2eMetroUrl === right.e2eMetroUrl;
}

export class ExplorerCampaignBootstrapTransaction {
  private active: ExplorerCampaignBootstrapRecord | null = null;
  private operation: Promise<void> = Promise.resolve();

  constructor(
    private readonly storage: DevE2EKeyValueStorage,
    private readonly isDev: boolean,
    private readonly markers: ExplorerCampaignBootstrapMarkers = {
      pending: setDevE2EExplorerCampaignPending,
      accepted: setDevE2EExplorerCampaignAccepted,
      error: setDevE2EExplorerCampaignError,
    },
  ) {}

  accept(
    identityValue: ExplorerCampaignBootstrapIdentity,
  ): Promise<ExplorerCampaignBootstrapRecord> {
    return this.serialize(() => this.acceptNow(identityValue));
  }

  restore(): Promise<ExplorerCampaignBootstrapRecord | null> {
    return this.serialize(async () => {
      if (!this.isDev) return null;
      let record: ExplorerCampaignBootstrapRecord | null;
      try {
        record = await this.readDurable();
      } catch (error) {
        return this.fail(this.receiptFailureReason(error));
      }
      if (!record) return null;
      if (record.status === 'pending') {
        this.markers.pending(record.campaignId);
        return record;
      }
      if (record.status === 'blocked') {
        this.markers.error(EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.CAMPAIGN_NOT_ACCEPTED);
        return record;
      }
      this.active = record;
      this.markers.accepted(record.campaignId);
      return record;
    });
  }

  requireScenarioReset(
    prerequisite: ExplorerCampaignScenarioPrerequisite,
  ): Promise<ExplorerCampaignBootstrapRecord> {
    return this.serialize(async () => {
      this.assertAvailable();
      let durable: ExplorerCampaignBootstrapRecord | null;
      try {
        durable = await this.readDurable();
      } catch (error) {
        return this.fail(this.receiptFailureReason(error));
      }
      if (!durable) {
        return this.fail(EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.CAMPAIGN_MISSING);
      }
      if (durable.status !== 'accepted' && durable.status !== 'active') {
        return this.fail(EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.CAMPAIGN_NOT_ACCEPTED);
      }
      if (prerequisite.campaignId !== durable.campaignId) {
        return this.fail(EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.CAMPAIGN_ID_MISMATCH);
      }
      if (prerequisite.integratedRepositorySha !==
        durable.integratedRepositorySha) {
        return this.fail(EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.REPOSITORY_SHA_MISMATCH);
      }
      if (prerequisite.e2eMetroUrl !== durable.e2eMetroUrl) {
        return this.fail(EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.METRO_URL_MISMATCH);
      }
      if (prerequisite.deterministicClockFingerprint !==
        durable.deterministicClockFingerprint) {
        return this.fail(EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.STALE_CLOCK_RECEIPT);
      }
      if (durable.status === 'active') {
        this.active = durable;
        return durable;
      }
      const active = createExplorerCampaignBootstrapRecord(durable, 'active');
      await this.writeAndVerify(active);
      this.active = active;
      return active;
    });
  }

  requireActiveScenarioReset(): Promise<ExplorerCampaignBootstrapRecord> {
    const active = this.active;
    if (!active) {
      return this.serialize(async () =>
        this.fail(EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.CAMPAIGN_MISSING));
    }
    return this.requireScenarioReset({
      campaignId: active.campaignId,
      integratedRepositorySha: active.integratedRepositorySha,
      e2eMetroUrl: active.e2eMetroUrl,
      deterministicClockFingerprint: active.deterministicClockFingerprint,
    });
  }

  transition(
    status: Extract<
      ExplorerCampaignBootstrapStatus,
      'active' | 'complete' | 'blocked'
    >,
  ): Promise<ExplorerCampaignBootstrapRecord> {
    return this.serialize(async () => {
      this.assertAvailable();
      const durable = await this.readDurable();
      if (!durable || (durable.status !== 'accepted' &&
        durable.status !== 'active' && durable.status !== 'complete')) {
        return this.fail(EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.CAMPAIGN_NOT_ACCEPTED);
      }
      const next = createExplorerCampaignBootstrapRecord(durable, status);
      await this.writeAndVerify(next);
      this.active = next;
      return next;
    });
  }

  readActive(): ExplorerCampaignBootstrapRecord | null {
    return this.active ? { ...this.active } : null;
  }

  private async acceptNow(
    identityValue: ExplorerCampaignBootstrapIdentity,
  ): Promise<ExplorerCampaignBootstrapRecord> {
    this.assertAvailable();
    const identity = parseExplorerCampaignBootstrapIdentity(identityValue);
    let existing: ExplorerCampaignBootstrapRecord | null;
    try {
      existing = await this.readDurable();
    } catch (error) {
      return this.fail(this.receiptFailureReason(error));
    }
    if (existing && !sameIdentity(existing, identity)) {
      return this.fail(EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.CONFLICT);
    }
    if (existing && (existing.status === 'accepted' ||
      existing.status === 'active' || existing.status === 'complete')) {
      this.active = existing;
      this.markers.accepted(existing.campaignId);
      return existing;
    }
    const pending = createExplorerCampaignBootstrapRecord(identity, 'pending');
    this.markers.pending(pending.campaignId);
    await this.writeAndVerify(pending);
    const accepted = createExplorerCampaignBootstrapRecord(identity, 'accepted');
    await this.writeAndVerify(accepted);
    this.active = accepted;
    // This marker is deliberately after the exact durable readback above.
    this.markers.accepted(accepted.campaignId);
    return accepted;
  }

  private assertAvailable(): void {
    if (!this.isDev) {
      this.markers.error(EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.RELEASE_BUILD);
      throw new ExplorerCampaignBootstrapError(
        EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.RELEASE_BUILD,
      );
    }
  }

  private fail(reasonCode: ExplorerCampaignBootstrapReasonCode): never {
    this.markers.error(reasonCode);
    throw new ExplorerCampaignBootstrapError(reasonCode);
  }

  private receiptFailureReason(
    error: unknown,
  ): ExplorerCampaignBootstrapReasonCode {
    return error instanceof Error &&
      error.message === 'explorer_campaign_clock_receipt_stale'
      ? EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.STALE_CLOCK_RECEIPT
      : EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.RECEIPT_CORRUPT;
  }

  private async writeAndVerify(
    record: ExplorerCampaignBootstrapRecord,
  ): Promise<void> {
    await this.storage.setItem(
      EXPLORER_CAMPAIGN_BOOTSTRAP_STORAGE_KEY,
      JSON.stringify(record),
    );
    let readback: ExplorerCampaignBootstrapRecord | null;
    try {
      readback = await this.readDurable();
    } catch {
      return this.fail(
        EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.PERSISTENCE_READBACK_MISMATCH,
      );
    }
    if (!readback || !explorerCampaignBootstrapRecordsMatch(record, readback)) {
      return this.fail(
        EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.PERSISTENCE_READBACK_MISMATCH,
      );
    }
  }

  private async readDurable(): Promise<ExplorerCampaignBootstrapRecord | null> {
    const raw = await this.storage.getItem(
      EXPLORER_CAMPAIGN_BOOTSTRAP_STORAGE_KEY,
    );
    if (!raw) return null;
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new ExplorerCampaignBootstrapError(
        EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.RECEIPT_CORRUPT,
      );
    }
    return parseExplorerCampaignBootstrapRecord(value);
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operation.then(operation, operation);
    this.operation = result.then(() => undefined, () => undefined);
    return result;
  }
}

let defaultTransaction: ExplorerCampaignBootstrapTransaction | null = null;

function sharedTransaction(args: {
  storage?: DevE2EKeyValueStorage;
  isDev?: boolean;
} = {}): ExplorerCampaignBootstrapTransaction {
  if (!defaultTransaction || args.storage || args.isDev !== undefined) {
    defaultTransaction = new ExplorerCampaignBootstrapTransaction(
      args.storage ?? defaultStorage(),
      available(args.isDev),
    );
  }
  return defaultTransaction;
}

export function acceptExplorerCampaignBootstrap(args:
ExplorerCampaignBootstrapIdentity & {
  storage?: DevE2EKeyValueStorage;
  isDev?: boolean;
}): Promise<ExplorerCampaignBootstrapRecord> {
  return sharedTransaction(args).accept(args);
}

export function restoreExplorerCampaignBootstrap(args: {
  storage?: DevE2EKeyValueStorage;
  isDev?: boolean;
} = {}): Promise<ExplorerCampaignBootstrapRecord | null> {
  return sharedTransaction(args).restore();
}

export function requireExplorerCampaignScenarioReset(
  prerequisite: ExplorerCampaignScenarioPrerequisite,
): Promise<ExplorerCampaignBootstrapRecord> {
  return sharedTransaction().requireScenarioReset(prerequisite);
}

export function requireActiveExplorerCampaignScenarioReset():
Promise<ExplorerCampaignBootstrapRecord> {
  return sharedTransaction().requireActiveScenarioReset();
}

export function readActiveExplorerCampaignBootstrap():
ExplorerCampaignBootstrapRecord | null {
  return defaultTransaction?.readActive() ?? null;
}

export function completeActiveExplorerCampaign():
Promise<ExplorerCampaignBootstrapRecord> {
  return sharedTransaction().transition('complete');
}

export function __resetExplorerCampaignBootstrapForTest(): void {
  defaultTransaction = null;
}
