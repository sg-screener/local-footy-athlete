import { semanticFingerprint } from './semanticFingerprint';

export const EXPLORER_CAMPAIGN_BOOTSTRAP_SCHEMA_VERSION = 1 as const;
// Campaign-wide deterministic receipt time. Every canonical Explorer seed is
// anchored to 2026-07-13 in Australia/Melbourne; bootstrap never reads wall time.
export const EXPLORER_CAMPAIGN_ACCEPTED_AT =
  '2026-07-13T02:00:00.000Z' as const;
export const EXPLORER_CAMPAIGN_TIMEZONE = 'Australia/Melbourne' as const;

export const EXPLORER_CAMPAIGN_BOOTSTRAP_STATUSES = [
  'pending',
  'accepted',
  'active',
  'complete',
  'blocked',
] as const;

export type ExplorerCampaignBootstrapStatus =
  typeof EXPLORER_CAMPAIGN_BOOTSTRAP_STATUSES[number];

export interface ExplorerCampaignBootstrapIdentity {
  readonly campaignId: string;
  readonly integratedRepositorySha: string;
  readonly e2eMetroUrl: string;
}

export interface ExplorerCampaignBootstrapRecord
extends ExplorerCampaignBootstrapIdentity {
  readonly schemaVersion: typeof EXPLORER_CAMPAIGN_BOOTSTRAP_SCHEMA_VERSION;
  readonly deterministicClockFingerprint: string;
  readonly status: ExplorerCampaignBootstrapStatus;
  readonly acceptedAt: string | null;
}

const RECORD_KEYS = [
  'acceptedAt',
  'campaignId',
  'deterministicClockFingerprint',
  'e2eMetroUrl',
  'integratedRepositorySha',
  'schemaVersion',
  'status',
] as const;
const CAMPAIGN_ID_PATTERN = /^explorer-nine-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REPOSITORY_SHA_PATTERN = /^[a-f0-9]{40}$/;

function assertMetroUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('explorer_campaign_metro_url_invalid');
  }
  if (parsed.protocol !== 'http:' ||
    (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') ||
    !parsed.port || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('explorer_campaign_metro_url_invalid');
  }
}

export function explorerCampaignDeterministicClockFingerprint(): string {
  return semanticFingerprint({
    schemaVersion: EXPLORER_CAMPAIGN_BOOTSTRAP_SCHEMA_VERSION,
    acceptedAt: EXPLORER_CAMPAIGN_ACCEPTED_AT,
    timezone: EXPLORER_CAMPAIGN_TIMEZONE,
  });
}

export function parseExplorerCampaignBootstrapIdentity(
  value: unknown,
): ExplorerCampaignBootstrapIdentity {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('explorer_campaign_identity_invalid');
  }
  const record = value as Record<string, unknown>;
  if (typeof record.campaignId !== 'string' ||
    !CAMPAIGN_ID_PATTERN.test(record.campaignId) ||
    typeof record.integratedRepositorySha !== 'string' ||
    !REPOSITORY_SHA_PATTERN.test(record.integratedRepositorySha) ||
    typeof record.e2eMetroUrl !== 'string') {
    throw new Error('explorer_campaign_identity_invalid');
  }
  assertMetroUrl(record.e2eMetroUrl);
  return {
    campaignId: record.campaignId,
    integratedRepositorySha: record.integratedRepositorySha,
    e2eMetroUrl: record.e2eMetroUrl,
  };
}

export function createExplorerCampaignBootstrapRecord(
  identityValue: ExplorerCampaignBootstrapIdentity,
  status: ExplorerCampaignBootstrapStatus,
): ExplorerCampaignBootstrapRecord {
  const identity = parseExplorerCampaignBootstrapIdentity(identityValue);
  return {
    schemaVersion: EXPLORER_CAMPAIGN_BOOTSTRAP_SCHEMA_VERSION,
    ...identity,
    deterministicClockFingerprint:
      explorerCampaignDeterministicClockFingerprint(),
    status,
    acceptedAt: status === 'pending'
      ? null
      : EXPLORER_CAMPAIGN_ACCEPTED_AT,
  };
}

export function parseExplorerCampaignBootstrapRecord(
  value: unknown,
): ExplorerCampaignBootstrapRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('explorer_campaign_receipt_corrupt');
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== RECORD_KEYS.length ||
    !RECORD_KEYS.every((key, index) => key === keys[index]) ||
    record.schemaVersion !== EXPLORER_CAMPAIGN_BOOTSTRAP_SCHEMA_VERSION ||
    typeof record.status !== 'string' ||
    !(EXPLORER_CAMPAIGN_BOOTSTRAP_STATUSES as readonly string[])
      .includes(record.status)) {
    throw new Error('explorer_campaign_receipt_corrupt');
  }
  const identity = parseExplorerCampaignBootstrapIdentity(record);
  const status = record.status as ExplorerCampaignBootstrapStatus;
  const expected = createExplorerCampaignBootstrapRecord(identity, status);
  if (record.deterministicClockFingerprint !==
      expected.deterministicClockFingerprint ||
    record.acceptedAt !== expected.acceptedAt) {
    throw new Error('explorer_campaign_clock_receipt_stale');
  }
  return expected;
}

export function explorerCampaignBootstrapRecordsMatch(
  left: ExplorerCampaignBootstrapRecord,
  right: ExplorerCampaignBootstrapRecord,
): boolean {
  return RECORD_KEYS.every((key) => left[key] === right[key]);
}
