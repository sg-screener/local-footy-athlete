import { semanticFingerprint } from './semanticFingerprint';
import {
  DEV_E2E_DATE_ANCHORS,
  isDevE2ESeedId,
  type DevE2ESeedId,
} from './devE2ESeedIds';
import type { DevE2ECheckpointRecord } from './devE2ECheckpoint';

declare const __DEV__: boolean | undefined;

export const DEV_E2E_CLOCK_PROTOCOL_VERSION = 1 as const;
export const DEV_E2E_CAMPAIGN_TIME_ZONE = 'Australia/Melbourne';

export interface DevE2EClockReceipt {
  protocolVersion: typeof DEV_E2E_CLOCK_PROTOCOL_VERSION;
  seedId: DevE2ESeedId;
  anchorInstant: string;
  timezone: string;
  createdAt: string;
  semanticFingerprint: string;
}

export interface DevE2EClockSnapshot {
  receipt: DevE2EClockReceipt;
  instant: Date;
  timezone: string;
}

interface DevE2EClockSemanticPayload {
  protocolVersion: typeof DEV_E2E_CLOCK_PROTOCOL_VERSION;
  seedId: DevE2ESeedId;
  anchorInstant: string;
  timezone: string;
}

const RECEIPT_KEYS = [
  'anchorInstant',
  'createdAt',
  'protocolVersion',
  'seedId',
  'semanticFingerprint',
  'timezone',
] as const;
const EXPLICIT_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;

type DevE2EClockGlobal = typeof globalThis & {
  __LFA_DEV_E2E_CLOCK_RECEIPT__?: DevE2EClockReceipt;
};

function clockGlobal(): DevE2EClockGlobal {
  return globalThis as DevE2EClockGlobal;
}

export function isDevE2EClockAvailable(): boolean {
  if (typeof __DEV__ !== 'undefined') return __DEV__;
  return (globalThis as { __DEV__?: boolean }).__DEV__ === true;
}

function assertExplicitInstant(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' ||
    !EXPLICIT_INSTANT_PATTERN.test(value) ||
    Number.isNaN(Date.parse(value))) {
    throw new Error(`DevE2EClock receipt corrupt: invalid ${field}.`);
  }
}

function assertTimezone(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('DevE2EClock receipt corrupt: invalid timezone.');
  }
  try {
    new Intl.DateTimeFormat('en-AU', { timeZone: value }).format(new Date(0));
  } catch {
    throw new Error(`DevE2EClock receipt corrupt: invalid timezone ${value}.`);
  }
}

function semanticPayload(
  receipt: Pick<
    DevE2EClockReceipt,
    'protocolVersion' | 'seedId' | 'anchorInstant' | 'timezone'
  >,
): DevE2EClockSemanticPayload {
  return {
    protocolVersion: receipt.protocolVersion,
    seedId: receipt.seedId,
    anchorInstant: receipt.anchorInstant,
    timezone: receipt.timezone,
  };
}

export function devE2EClockSemanticFingerprint(
  receipt: Pick<
    DevE2EClockReceipt,
    'protocolVersion' | 'seedId' | 'anchorInstant' | 'timezone'
  >,
): string {
  return semanticFingerprint(semanticPayload(receipt));
}

function zonedDateTimeParts(instant: Date, timezone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  return Object.fromEntries(parts
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, Number(part.value)]));
}

/**
 * Converts a campaign-local calendar date at noon into one explicit instant.
 * The calculation is driven by the supplied IANA timezone, never the device.
 */
export function devE2EAnchorInstantForDate(
  dateISO: string,
  timezone: string = DEV_E2E_CAMPAIGN_TIME_ZONE,
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    throw new Error(`DevE2EClock anchor date invalid: ${dateISO}.`);
  }
  assertTimezone(timezone);
  const [year, month, day] = dateISO.split('-').map(Number);
  const targetAsUTC = Date.UTC(year, month - 1, day, 12, 0, 0, 0);
  let candidate = targetAsUTC;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedDateTimeParts(new Date(candidate), timezone);
    const representedAsUTC = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      0,
    );
    const correction = targetAsUTC - representedAsUTC;
    candidate += correction;
    if (correction === 0) break;
  }
  return new Date(candidate).toISOString();
}

export function createDevE2EClockReceipt(args: {
  seedId: DevE2ESeedId;
  anchorInstant: string;
  timezone: string;
  createdAt?: string;
}): DevE2EClockReceipt {
  if (!isDevE2ESeedId(args.seedId)) {
    throw new Error(`DevE2EClock receipt unknown seed: ${String(args.seedId)}.`);
  }
  assertExplicitInstant(args.anchorInstant, 'anchorInstant');
  assertTimezone(args.timezone);
  const createdAt = args.createdAt ?? new Date().toISOString();
  assertExplicitInstant(createdAt, 'createdAt');
  const semantic = {
    protocolVersion: DEV_E2E_CLOCK_PROTOCOL_VERSION,
    seedId: args.seedId,
    anchorInstant: new Date(args.anchorInstant).toISOString(),
    timezone: args.timezone,
  } satisfies DevE2EClockSemanticPayload;
  return {
    ...semantic,
    createdAt: new Date(createdAt).toISOString(),
    semanticFingerprint: semanticFingerprint(semantic),
  };
}

export function createDevE2EClockReceiptForSeed(
  seedId: DevE2ESeedId,
  createdAt?: string,
): DevE2EClockReceipt {
  return createDevE2EClockReceipt({
    seedId,
    anchorInstant: devE2EAnchorInstantForDate(DEV_E2E_DATE_ANCHORS[seedId]),
    timezone: DEV_E2E_CAMPAIGN_TIME_ZONE,
    createdAt,
  });
}

export function parseDevE2EClockReceipt(value: unknown): DevE2EClockReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('DevE2EClock receipt corrupt: expected an object.');
  }
  const record = value as Partial<DevE2EClockReceipt> & Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== RECEIPT_KEYS.length ||
    !RECEIPT_KEYS.every((key, index) => keys[index] === key)) {
    throw new Error('DevE2EClock receipt corrupt: unexpected fields.');
  }
  if (record.protocolVersion !== DEV_E2E_CLOCK_PROTOCOL_VERSION) {
    throw new Error(
      `DevE2EClock receipt corrupt: unsupported protocol ${String(record.protocolVersion)}.`,
    );
  }
  if (typeof record.seedId !== 'string' || !isDevE2ESeedId(record.seedId)) {
    throw new Error(`DevE2EClock receipt unknown seed: ${String(record.seedId)}.`);
  }
  assertExplicitInstant(record.anchorInstant, 'anchorInstant');
  assertTimezone(record.timezone);
  assertExplicitInstant(record.createdAt, 'createdAt');
  if (typeof record.semanticFingerprint !== 'string') {
    throw new Error('DevE2EClock receipt corrupt: invalid semantic fingerprint.');
  }
  const normalized = createDevE2EClockReceipt({
    seedId: record.seedId,
    anchorInstant: record.anchorInstant,
    timezone: record.timezone,
    createdAt: record.createdAt,
  });
  if (record.semanticFingerprint !== normalized.semanticFingerprint) {
    throw new Error(
      `DevE2EClock receipt corrupt: semantic fingerprint expected=${normalized.semanticFingerprint} actual=${record.semanticFingerprint}.`,
    );
  }
  return normalized;
}

export function setDevE2EClock(
  receiptValue: DevE2EClockReceipt,
): DevE2EClockReceipt | null {
  if (!isDevE2EClockAvailable()) return null;
  const receipt = parseDevE2EClockReceipt(receiptValue);
  clockGlobal().__LFA_DEV_E2E_CLOCK_RECEIPT__ = receipt;
  return receipt;
}

export function setDevE2EClockForSeed(
  seedId: DevE2ESeedId,
  createdAt?: string,
): DevE2EClockReceipt | null {
  if (!isDevE2EClockAvailable()) return null;
  return setDevE2EClock(createDevE2EClockReceiptForSeed(seedId, createdAt));
}

export function clearDevE2EClock(): boolean {
  if (!isDevE2EClockAvailable()) return false;
  delete clockGlobal().__LFA_DEV_E2E_CLOCK_RECEIPT__;
  return true;
}

export function getDevE2EClockReceipt(): DevE2EClockReceipt | null {
  const receipt = clockGlobal().__LFA_DEV_E2E_CLOCK_RECEIPT__;
  if (!isDevE2EClockAvailable() || !receipt) return null;
  return { ...receipt };
}

export function getDevE2EClockSnapshot(): DevE2EClockSnapshot | null {
  const receipt = getDevE2EClockReceipt();
  if (!receipt) return null;
  return {
    receipt,
    instant: new Date(receipt.anchorInstant),
    timezone: receipt.timezone,
  };
}

export function assertDevE2EClockMatchesCheckpoint(
  receipt: DevE2EClockReceipt | null,
  checkpoint: DevE2ECheckpointRecord,
): DevE2EClockReceipt {
  if (!receipt) {
    throw new Error('DevE2EClock reload mismatch: active checkpoint has no clock receipt.');
  }
  if (receipt.seedId !== checkpoint.seedId) {
    throw new Error(
      `DevE2EClock reload mismatch: checkpoint seed=${checkpoint.seedId} receipt seed=${receipt.seedId}.`,
    );
  }
  if (receipt.semanticFingerprint !== checkpoint.clockFingerprint) {
    throw new Error(
      `DevE2EClock reload mismatch: checkpoint fingerprint=${checkpoint.clockFingerprint} receipt fingerprint=${receipt.semanticFingerprint}.`,
    );
  }
  return receipt;
}
