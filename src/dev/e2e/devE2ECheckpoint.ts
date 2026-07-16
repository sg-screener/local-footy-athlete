import { isDevE2ESeedId, type DevE2ESeedId } from './devE2ESeedIds';
import type { AthleteActionTraceCheckpointV2 } from './AthleteActionTraceCoordinator';
import { isDevE2EScenarioProtocolId } from './devE2EScenarioProtocol';

export type DevE2EFingerprintMap = Record<string, string>;

export interface DevE2EKeyValueStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export const DEV_E2E_CHECKPOINT_STORAGE_KEY = 'dev-e2e-checkpoint-v2';

export interface DevE2ECheckpointRecord {
  version: 2;
  seedId: DevE2ESeedId;
  checkpointId: DevE2ESeedId;
  fingerprints: DevE2EFingerprintMap;
  clockFingerprint: string;
  unfinishedAthleteActionTraces: AthleteActionTraceCheckpointV2;
  scenarioId?: string;
  checkpointStepId?: string;
  activeActionTraceId?: string;
  priorActionTraceId?: string | null;
}

function defaultDevE2EStorage(): DevE2EKeyValueStorage {
  // Loaded only inside the development entry/checkpoint path.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module = require('@react-native-async-storage/async-storage');
  return module.default ?? module;
}

function parseFingerprintMap(value: unknown): DevE2EFingerprintMap | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.some(([key, fingerprint]) =>
    key.length === 0 || typeof fingerprint !== 'string')) return null;
  return Object.fromEntries(entries) as DevE2EFingerprintMap;
}

function parseAthleteActionTraceCheckpoint(
  value: unknown,
): AthleteActionTraceCheckpointV2 {
  const checkpoint = value as Partial<AthleteActionTraceCheckpointV2> | null;
  const traceIds = Array.isArray(checkpoint?.records)
    ? checkpoint.records.map((record) => record?.traceId)
    : [];
  if (!checkpoint ||
    checkpoint.version !== 2 ||
    checkpoint.fingerprintContract !== 'athlete-semantic-sha256-v2' ||
    !Array.isArray(checkpoint.records) ||
    checkpoint.records.some((record) =>
      !record ||
      record.schemaVersion !== 2 ||
      record.fingerprintContract !== 'athlete-semantic-sha256-v2' ||
      typeof record.traceId !== 'string' ||
      record.traceId.length === 0) ||
    new Set(traceIds).size !== traceIds.length) {
    throw new Error('Dev E2E checkpoint TraceV2 receipt is corrupt.');
  }
  return checkpoint as AthleteActionTraceCheckpointV2;
}

export function parseDevE2ECheckpointRecord(value: unknown): DevE2ECheckpointRecord {
  const parsed = value as Partial<DevE2ECheckpointRecord> | null;
  const fingerprints = parseFingerprintMap(parsed?.fingerprints);
  const scenarioFieldCount = parsed
    ? [
        parsed.scenarioId,
        parsed.checkpointStepId,
        parsed.activeActionTraceId,
        parsed.priorActionTraceId,
      ].filter((field) => field !== undefined).length
    : 0;
  if (!parsed ||
    parsed.version !== 2 ||
    typeof parsed.seedId !== 'string' ||
    !isDevE2ESeedId(parsed.seedId) ||
    typeof parsed.checkpointId !== 'string' ||
    !isDevE2ESeedId(parsed.checkpointId) ||
    !fingerprints ||
    typeof parsed.clockFingerprint !== 'string' ||
    parsed.clockFingerprint.length === 0 ||
    (scenarioFieldCount !== 0 && scenarioFieldCount !== 4) ||
    (scenarioFieldCount === 4 && (
      !isDevE2EScenarioProtocolId(parsed.scenarioId) ||
      !isDevE2EScenarioProtocolId(parsed.checkpointStepId) ||
      typeof parsed.activeActionTraceId !== 'string' ||
      parsed.activeActionTraceId.length === 0 ||
      (parsed.priorActionTraceId !== null &&
        (typeof parsed.priorActionTraceId !== 'string' ||
          parsed.priorActionTraceId.length === 0))
    ))) {
    throw new Error('Dev E2E checkpoint receipt is corrupt.');
  }
  const unfinishedAthleteActionTraces = parseAthleteActionTraceCheckpoint(
    parsed.unfinishedAthleteActionTraces,
  );
  if (scenarioFieldCount === 4 &&
    !unfinishedAthleteActionTraces.records.some((record) =>
      record.traceId === parsed.activeActionTraceId)) {
    throw new Error('Dev E2E checkpoint receipt is corrupt.');
  }
  const record: DevE2ECheckpointRecord = {
    version: 2,
    seedId: parsed.seedId,
    checkpointId: parsed.checkpointId,
    fingerprints,
    clockFingerprint: parsed.clockFingerprint,
    unfinishedAthleteActionTraces,
  };
  if (scenarioFieldCount === 4) {
    record.scenarioId = parsed.scenarioId!;
    record.checkpointStepId = parsed.checkpointStepId!;
    record.activeActionTraceId = parsed.activeActionTraceId!;
    record.priorActionTraceId = parsed.priorActionTraceId!;
  }
  return record;
}

export async function writeDevE2ECheckpointRecord(
  record: DevE2ECheckpointRecord,
  storage: DevE2EKeyValueStorage = defaultDevE2EStorage(),
): Promise<void> {
  await storage.setItem(DEV_E2E_CHECKPOINT_STORAGE_KEY, JSON.stringify(record));
}

export async function readDevE2ECheckpointRecord(
  storage: DevE2EKeyValueStorage = defaultDevE2EStorage(),
): Promise<DevE2ECheckpointRecord | null> {
  const raw = await storage.getItem(DEV_E2E_CHECKPOINT_STORAGE_KEY);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Dev E2E checkpoint receipt is corrupt.');
  }
  return parseDevE2ECheckpointRecord(parsed);
}

export async function clearDevE2ECheckpointRecord(
  storage: DevE2EKeyValueStorage = defaultDevE2EStorage(),
): Promise<void> {
  await storage.removeItem(DEV_E2E_CHECKPOINT_STORAGE_KEY);
}
