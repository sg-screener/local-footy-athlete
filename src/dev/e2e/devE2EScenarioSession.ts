import { semanticFingerprint } from './semanticFingerprint';
import type {
  DevE2EFingerprintMap,
  DevE2EKeyValueStorage,
} from './devE2ECheckpoint';
import { isDevE2ESeedId, type DevE2ESeedId } from './devE2ESeedIds';
import {
  DEV_E2E_SCENARIO_PROTOCOL_VERSION,
  DEV_E2E_SCENARIO_REASON,
  DevE2EScenarioProtocolError,
  isDevE2EScenarioProtocolId,
} from './devE2EScenarioProtocol';

export const DEV_E2E_SCENARIO_SESSION_STORAGE_KEY = 'dev-e2e-scenario-session-v2';

export interface DevE2ENextActionEligibility {
  nextStepId: string | null;
  status: 'eligible' | 'complete' | 'blocked';
  reasonCode: string;
  witnessIds: string[];
}

export interface DevE2EScenarioSessionRecord {
  protocolVersion: typeof DEV_E2E_SCENARIO_PROTOCOL_VERSION;
  scenarioId: string;
  seedId: DevE2ESeedId;
  checkpointStepId: string | null;
  activeActionTraceId: string | null;
  priorActionTraceId: string | null;
  reloadCount: number;
  currentAcceptedSemanticFingerprint: string;
  persistedStoreFingerprints: DevE2EFingerprintMap;
  clockFingerprint: string;
  nextActionEligibility: DevE2ENextActionEligibility;
  updatedAt: string;
}

const SESSION_KEYS = [
  'activeActionTraceId',
  'checkpointStepId',
  'clockFingerprint',
  'currentAcceptedSemanticFingerprint',
  'nextActionEligibility',
  'persistedStoreFingerprints',
  'priorActionTraceId',
  'protocolVersion',
  'reloadCount',
  'scenarioId',
  'seedId',
  'updatedAt',
] as const;
const ELIGIBILITY_KEYS = [
  'nextStepId',
  'reasonCode',
  'status',
  'witnessIds',
] as const;

function defaultDevE2EStorage(): DevE2EKeyValueStorage {
  // Loaded only inside the development scenario-session path.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module = require('@react-native-async-storage/async-storage');
  return module.default ?? module;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return keys.length === sortedExpected.length &&
    sortedExpected.every((key, index) => keys[index] === key);
}

function parseFingerprintMap(value: unknown): DevE2EFingerprintMap | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.some(([key, fingerprint]) =>
    key.length === 0 || typeof fingerprint !== 'string' || fingerprint.length === 0)) {
    return null;
  }
  return Object.fromEntries(entries);
}

function parseNullableId(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value;
}

function parseNextActionEligibility(value: unknown): DevE2ENextActionEligibility | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const status = record.status;
  if (!exactKeys(record, ELIGIBILITY_KEYS)) return null;
  const nextStepId = record.nextStepId === null
    ? null
    : isDevE2EScenarioProtocolId(record.nextStepId) ? record.nextStepId : undefined;
  if (nextStepId === undefined ||
    (status !== 'eligible' &&
      status !== 'complete' &&
      status !== 'blocked') ||
    typeof record.reasonCode !== 'string' ||
    record.reasonCode.length === 0 ||
    !Array.isArray(record.witnessIds) ||
    record.witnessIds.some((witnessId) =>
      typeof witnessId !== 'string' || witnessId.length === 0) ||
    new Set(record.witnessIds).size !== record.witnessIds.length ||
    (status === 'complete' && nextStepId !== null) ||
    (status !== 'complete' && nextStepId === null)) {
    return null;
  }
  return {
    nextStepId,
    status,
    reasonCode: record.reasonCode,
    witnessIds: [...record.witnessIds],
  };
}

export function devE2EAcceptedSemanticFingerprint(
  fingerprints: DevE2EFingerprintMap,
): string {
  return semanticFingerprint(fingerprints);
}

export function parseDevE2EScenarioSessionRecord(
  value: unknown,
): DevE2EScenarioSessionRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DevE2EScenarioProtocolError(
      DEV_E2E_SCENARIO_REASON.CORRUPT_SESSION,
      'Dev E2E scenario session is corrupt.',
    );
  }
  const record = value as Record<string, unknown>;
  const scenarioId = record.scenarioId;
  const seedId = record.seedId;
  const reloadCount = record.reloadCount;
  const currentAcceptedSemanticFingerprint =
    record.currentAcceptedSemanticFingerprint;
  const clockFingerprint = record.clockFingerprint;
  const updatedAtValue = record.updatedAt;
  const checkpointStepId = parseNullableId(record.checkpointStepId);
  const activeActionTraceId = parseNullableId(record.activeActionTraceId);
  const priorActionTraceId = parseNullableId(record.priorActionTraceId);
  const persistedStoreFingerprints = parseFingerprintMap(record.persistedStoreFingerprints);
  const nextActionEligibility = parseNextActionEligibility(record.nextActionEligibility);
  const updatedAt = typeof updatedAtValue === 'string'
    ? Date.parse(updatedAtValue)
    : NaN;
  if (!exactKeys(record, SESSION_KEYS) ||
    record.protocolVersion !== DEV_E2E_SCENARIO_PROTOCOL_VERSION ||
    !isDevE2EScenarioProtocolId(scenarioId) ||
    typeof seedId !== 'string' ||
    !isDevE2ESeedId(seedId) ||
    checkpointStepId === undefined ||
    activeActionTraceId === undefined ||
    priorActionTraceId === undefined ||
    typeof reloadCount !== 'number' ||
    !Number.isInteger(reloadCount) ||
    reloadCount < 0 ||
    typeof currentAcceptedSemanticFingerprint !== 'string' ||
    currentAcceptedSemanticFingerprint.length === 0 ||
    !persistedStoreFingerprints ||
    typeof clockFingerprint !== 'string' ||
    clockFingerprint.length === 0 ||
    !nextActionEligibility ||
    !Number.isFinite(updatedAt) ||
    typeof updatedAtValue !== 'string' ||
    new Date(updatedAt).toISOString() !== updatedAtValue ||
    (checkpointStepId === null && (
      activeActionTraceId !== null ||
      priorActionTraceId !== null ||
      reloadCount !== 0 ||
      nextActionEligibility.status === 'complete'
    )) ||
    (activeActionTraceId !== null && checkpointStepId === null) ||
    (activeActionTraceId !== null &&
      nextActionEligibility.status === 'eligible') ||
    (activeActionTraceId !== null && activeActionTraceId === priorActionTraceId)) {
    throw new DevE2EScenarioProtocolError(
      DEV_E2E_SCENARIO_REASON.CORRUPT_SESSION,
      'Dev E2E scenario session is corrupt.',
    );
  }
  return {
    protocolVersion: DEV_E2E_SCENARIO_PROTOCOL_VERSION,
    scenarioId,
    seedId,
    checkpointStepId,
    activeActionTraceId,
    priorActionTraceId,
    reloadCount,
    currentAcceptedSemanticFingerprint,
    persistedStoreFingerprints,
    clockFingerprint,
    nextActionEligibility,
    updatedAt: updatedAtValue,
  };
}

export async function writeDevE2EScenarioSessionRecord(
  record: DevE2EScenarioSessionRecord,
  storage: DevE2EKeyValueStorage = defaultDevE2EStorage(),
): Promise<void> {
  const parsed = parseDevE2EScenarioSessionRecord(record);
  await storage.setItem(DEV_E2E_SCENARIO_SESSION_STORAGE_KEY, JSON.stringify(parsed));
}

export async function readDevE2EScenarioSessionRecord(
  storage: DevE2EKeyValueStorage = defaultDevE2EStorage(),
): Promise<DevE2EScenarioSessionRecord | null> {
  const raw = await storage.getItem(DEV_E2E_SCENARIO_SESSION_STORAGE_KEY);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new DevE2EScenarioProtocolError(
      DEV_E2E_SCENARIO_REASON.CORRUPT_SESSION,
      'Dev E2E scenario session is corrupt.',
    );
  }
  return parseDevE2EScenarioSessionRecord(parsed);
}

export async function clearDevE2EScenarioSessionRecord(
  storage: DevE2EKeyValueStorage = defaultDevE2EStorage(),
): Promise<void> {
  await storage.removeItem(DEV_E2E_SCENARIO_SESSION_STORAGE_KEY);
}
