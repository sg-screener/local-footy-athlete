import type { DevE2EKeyValueStorage } from './devE2ECheckpoint';
import {
  semanticFingerprintV2,
  stableSemanticJsonV2,
} from '../../utils/semanticFingerprintV2';

export const EXPLORER_PHYSICAL_EVIDENCE_SCHEMA_VERSION = 1 as const;
export const EXPLORER_PHYSICAL_EVIDENCE_STORAGE_KEY =
  'dev-e2e-explorer-physical-evidence-v1';
export const EXPLORER_HIERARCHY_FORMAT =
  'maestro-accessibility-hierarchy-json-v1' as const;

export const EXPLORER_CAPTURE_PHASES = [
  'seed-reset',
  'after-action',
  'after-reload',
] as const;

export type ExplorerCapturePhase = (typeof EXPLORER_CAPTURE_PHASES)[number];

export const EXPLORER_PHYSICAL_EVIDENCE_FAILURE = Object.freeze({
  INVALID_REQUEST: 'capture_request_invalid',
  INVALID_RECEIPT: 'capture_receipt_invalid',
  PRIVACY_FORBIDDEN_FIELD: 'capture_privacy_forbidden_field',
  ABSOLUTE_PATH: 'capture_absolute_path_rejected',
  MISSING_FILE: 'capture_file_missing',
  EMPTY_FILE: 'capture_file_empty',
  INVALID_HASH: 'capture_hash_invalid',
  REQUEST_NOT_PENDING: 'capture_request_not_pending',
  CAPTURE_ID_MISMATCH: 'capture_id_mismatch',
  CAMPAIGN_MISMATCH: 'capture_campaign_mismatch',
  SCENARIO_MISMATCH: 'capture_scenario_mismatch',
  STEP_MISMATCH: 'capture_step_mismatch',
  PHASE_MISMATCH: 'capture_phase_mismatch',
  TRACE_MISMATCH: 'capture_trace_mismatch',
  CONTROL_MISMATCH: 'capture_control_mismatch',
  OBSERVATION_MISMATCH: 'capture_observation_mismatch',
  SEMANTIC_IDENTITY_MISMATCH: 'capture_semantic_identity_mismatch',
  RELOAD_COUNT_MISMATCH: 'capture_reload_count_mismatch',
  PATH_MISMATCH: 'capture_path_mismatch',
  CLOCK_MISMATCH: 'capture_clock_mismatch',
  STALE_RECEIPT: 'capture_receipt_stale',
  FUTURE_RECEIPT: 'capture_receipt_future',
  REPOSITORY_SHA_MISMATCH: 'capture_repository_sha_mismatch',
  DUPLICATE_RECEIPT: 'capture_receipt_duplicate',
  PERSISTENCE_FAILED: 'capture_persistence_failed',
  RELEASE_BUILD: 'capture_route_release_rejected',
} as const);

export type ExplorerPhysicalEvidenceFailureCode =
  (typeof EXPLORER_PHYSICAL_EVIDENCE_FAILURE)[
    keyof typeof EXPLORER_PHYSICAL_EVIDENCE_FAILURE
  ];

export class ExplorerPhysicalEvidenceError extends Error {
  readonly reasonCode: ExplorerPhysicalEvidenceFailureCode;

  constructor(reasonCode: ExplorerPhysicalEvidenceFailureCode, detail?: string) {
    super(detail ? `${reasonCode}:${detail}` : reasonCode);
    this.name = 'ExplorerPhysicalEvidenceError';
    this.reasonCode = reasonCode;
  }
}

export interface ExplorerExpectedSemanticIdentityV1 {
  readonly manifestSemanticHash: string;
  readonly actionSemanticHash: string | null;
  readonly canonicalSemanticIdentity: string;
}

/** App-owned identity of one externally executed physical capture. */
export interface ExplorerPhysicalCaptureRequestV1 {
  readonly schemaVersion: typeof EXPLORER_PHYSICAL_EVIDENCE_SCHEMA_VERSION;
  readonly captureId: string;
  readonly campaignId: string;
  readonly scenarioId: string;
  readonly stepId?: string;
  readonly capturePhase: ExplorerCapturePhase;
  readonly reloadCount: number;
  readonly traceId: string | null;
  readonly controlId: string | null;
  readonly observationId: string | null;
  readonly expectedSemanticIdentity: ExplorerExpectedSemanticIdentityV1;
  readonly deterministicClockFingerprint: string;
  readonly requestedScreenshotRelativePath: string;
  readonly requestedHierarchyRelativePath: string;
}

export interface ExplorerPhysicalScreenshotReceiptV1 {
  readonly relativeReference: string;
  readonly sha256: string;
  readonly byteSize: number;
  readonly mediaType: 'image/png';
}

export interface ExplorerPhysicalHierarchyReceiptV1 {
  readonly relativeReference: string;
  readonly sha256: string;
  readonly byteSize: number;
  readonly format: typeof EXPLORER_HIERARCHY_FORMAT;
}

/** Privacy-safe immutable statement returned by the external capture harness. */
export interface ExplorerPhysicalEvidenceReceiptV1 {
  readonly schemaVersion: typeof EXPLORER_PHYSICAL_EVIDENCE_SCHEMA_VERSION;
  readonly captureId: string;
  readonly campaignId: string;
  readonly scenarioId: string;
  readonly stepId?: string;
  readonly capturePhase: ExplorerCapturePhase;
  readonly reloadCount: number;
  readonly traceId: string | null;
  readonly controlId: string | null;
  readonly observationId: string | null;
  readonly expectedSemanticIdentity: ExplorerExpectedSemanticIdentityV1;
  readonly screenshot: ExplorerPhysicalScreenshotReceiptV1;
  readonly hierarchy: ExplorerPhysicalHierarchyReceiptV1;
  readonly capturedIntegratedRepositorySha: string;
  readonly deterministicClockFingerprint: string;
}

export interface ExplorerPhysicalEvidenceLedgerEntryV1 {
  readonly request: ExplorerPhysicalCaptureRequestV1;
  readonly receipt: ExplorerPhysicalEvidenceReceiptV1 | null;
}

export interface ExplorerPhysicalEvidenceLedgerV1 {
  readonly schemaVersion: typeof EXPLORER_PHYSICAL_EVIDENCE_SCHEMA_VERSION;
  readonly entries: readonly ExplorerPhysicalEvidenceLedgerEntryV1[];
}

export interface ExplorerPhysicalEvidenceMarkerPublisher {
  readonly request: (captureId: string, encodedRequest: string) => void;
  readonly accepted: (captureId: string) => void;
  readonly error: (reasonCode: ExplorerPhysicalEvidenceFailureCode) => void;
}

const REQUEST_KEYS = [
  'campaignId',
  'captureId',
  'capturePhase',
  'controlId',
  'deterministicClockFingerprint',
  'expectedSemanticIdentity',
  'observationId',
  'reloadCount',
  'requestedHierarchyRelativePath',
  'requestedScreenshotRelativePath',
  'scenarioId',
  'schemaVersion',
  'traceId',
] as const;
const RECEIPT_KEYS = [
  'campaignId',
  'captureId',
  'capturePhase',
  'capturedIntegratedRepositorySha',
  'controlId',
  'deterministicClockFingerprint',
  'expectedSemanticIdentity',
  'hierarchy',
  'observationId',
  'reloadCount',
  'scenarioId',
  'schemaVersion',
  'screenshot',
  'traceId',
] as const;
const EXPECTED_IDENTITY_KEYS = [
  'actionSemanticHash',
  'canonicalSemanticIdentity',
  'manifestSemanticHash',
] as const;
const SCREENSHOT_KEYS = ['byteSize', 'mediaType', 'relativeReference', 'sha256'] as const;
const HIERARCHY_KEYS = ['byteSize', 'format', 'relativeReference', 'sha256'] as const;
const LEDGER_KEYS = ['entries', 'schemaVersion'] as const;
const LEDGER_ENTRY_KEYS = ['receipt', 'request'] as const;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CAPTURE_ID_PATTERN = /^explorer-capture-[a-f0-9]{64}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const REPOSITORY_SHA_PATTERN = /^[a-f0-9]{40}$/;
const FORBIDDEN_PRIVACY_KEY =
  /(?:rawDevice|deviceIdentifier|deviceId|udid|simulatorId|metroPort|metroUrl|timestamp|capturedAt|observedAt|startedAt|endedAt)/i;
const METRO_VALUE = /(?:metro|localhost|127\.0\.0\.1)(?:[^\s]{0,32})?:\d{2,5}/i;

function fail(
  reasonCode: ExplorerPhysicalEvidenceFailureCode,
  detail?: string,
): never {
  throw new ExplorerPhysicalEvidenceError(reasonCode, detail);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const keys = Object.keys(value).sort();
  const required = expected.filter((key) => !optional.includes(key));
  return required.every((key) => keys.includes(key)) &&
    keys.every((key) => expected.includes(key)) &&
    keys.length >= required.length;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function nullableNonEmpty(value: unknown): value is string | null {
  return value === null || nonEmpty(value);
}

function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function assertPrivacySafe(value: unknown, path: readonly string[] = []): void {
  if (typeof value === 'string') {
    if (METRO_VALUE.test(value)) {
      fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.PRIVACY_FORBIDDEN_FIELD,
        path.join('.'));
    }
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_PRIVACY_KEY.test(key)) {
      fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.PRIVACY_FORBIDDEN_FIELD,
        [...path, key].join('.'));
    }
    assertPrivacySafe(child, [...path, key]);
  }
}

export function isPrivacySafeExplorerRelativePath(value: unknown): value is string {
  if (!nonEmpty(value) || value.startsWith('/') || value.startsWith('\\') ||
    /^[a-zA-Z]:[\\/]/.test(value) || value.includes('\\') ||
    value.split('/').some((segment) => !segment || segment === '.' || segment === '..') ||
    /^(?:file|https?|data):/i.test(value)) {
    return false;
  }
  return true;
}

function parseExpectedSemanticIdentity(
  value: unknown,
  failure: ExplorerPhysicalEvidenceFailureCode,
): ExplorerExpectedSemanticIdentityV1 {
  if (!isRecord(value) || !exactKeys(value, EXPECTED_IDENTITY_KEYS) ||
    !nonEmpty(value.manifestSemanticHash) ||
    !(value.actionSemanticHash === null || nonEmpty(value.actionSemanticHash)) ||
    !nonEmpty(value.canonicalSemanticIdentity)) {
    fail(failure, 'expected_semantic_identity');
  }
  return {
    manifestSemanticHash: value.manifestSemanticHash,
    actionSemanticHash: value.actionSemanticHash as string | null,
    canonicalSemanticIdentity: value.canonicalSemanticIdentity,
  };
}

function assertPhaseIdentity(args: {
  phase: ExplorerCapturePhase;
  stepId: string | undefined;
  reloadCount: number;
  traceId: string | null;
  controlId: string | null;
  observationId: string | null;
  actionSemanticHash: string | null;
  failure: ExplorerPhysicalEvidenceFailureCode;
}): void {
  const seed = args.phase === 'seed-reset';
  if ((seed && (args.stepId !== undefined || args.reloadCount !== 0 ||
      args.traceId !== null || args.controlId !== null ||
      args.observationId !== null || args.actionSemanticHash !== null)) ||
    (!seed && (!args.stepId || !args.traceId || !args.controlId ||
      !args.observationId || !args.actionSemanticHash)) ||
    (args.phase === 'after-action' && args.reloadCount < 0) ||
    (args.phase === 'after-reload' && args.reloadCount < 1)) {
    fail(args.failure, 'phase_identity');
  }
}

function requestPreimage(
  request: Omit<ExplorerPhysicalCaptureRequestV1, 'captureId'>,
): unknown {
  return {
    schemaVersion: request.schemaVersion,
    campaignId: request.campaignId,
    scenarioId: request.scenarioId,
    ...(request.stepId ? { stepId: request.stepId } : {}),
    capturePhase: request.capturePhase,
    reloadCount: request.reloadCount,
    traceId: request.traceId,
    controlId: request.controlId,
    observationId: request.observationId,
    expectedSemanticIdentity: request.expectedSemanticIdentity,
    deterministicClockFingerprint: request.deterministicClockFingerprint,
    requestedScreenshotRelativePath: request.requestedScreenshotRelativePath,
    requestedHierarchyRelativePath: request.requestedHierarchyRelativePath,
  };
}

export function explorerPhysicalCaptureId(
  request: Omit<ExplorerPhysicalCaptureRequestV1, 'captureId'>,
): string {
  const fingerprint = semanticFingerprintV2(requestPreimage(request));
  return `explorer-capture-${fingerprint.slice(fingerprint.lastIndexOf(':') + 1)}`;
}

export function explorerCampaignArtifactDirectory(campaignId: string): string {
  if (!ID_PATTERN.test(campaignId) || !campaignId.startsWith('explorer-nine-')) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_REQUEST, 'campaign_id');
  }
  return `artifacts/${campaignId}`;
}

export function explorerCaptureRelativePaths(args: {
  scenarioId: string;
  stepId?: string;
  stepOrdinal?: number;
  capturePhase: ExplorerCapturePhase;
}): { screenshot: string; hierarchy: string } {
  if (!ID_PATTERN.test(args.scenarioId)) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_REQUEST, 'scenario_id');
  }
  let basename: string;
  if (args.capturePhase === 'seed-reset') {
    if (args.stepId !== undefined || args.stepOrdinal !== undefined) {
      fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_REQUEST, 'seed_path_identity');
    }
    basename = 'seed-initial';
  } else {
    if (!args.stepId || !ID_PATTERN.test(args.stepId) ||
      !Number.isInteger(args.stepOrdinal) || (args.stepOrdinal ?? 0) < 1) {
      fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_REQUEST, 'step_path_identity');
    }
    basename = `${String(args.stepOrdinal).padStart(2, '0')}-${args.stepId}-${args.capturePhase}`;
  }
  return {
    screenshot: `${args.scenarioId}/${basename}.png`,
    hierarchy: `${args.scenarioId}/${basename}.accessibility.json`,
  };
}

export function createExplorerPhysicalCaptureRequest(args: {
  campaignId: string;
  scenarioId: string;
  stepId?: string;
  stepOrdinal?: number;
  capturePhase: ExplorerCapturePhase;
  reloadCount: number;
  traceId: string | null;
  controlId: string | null;
  observationId: string | null;
  expectedSemanticIdentity: ExplorerExpectedSemanticIdentityV1;
  deterministicClockFingerprint: string;
}): ExplorerPhysicalCaptureRequestV1 {
  const paths = explorerCaptureRelativePaths(args);
  const draft: Omit<ExplorerPhysicalCaptureRequestV1, 'captureId'> = {
    schemaVersion: EXPLORER_PHYSICAL_EVIDENCE_SCHEMA_VERSION,
    campaignId: args.campaignId,
    scenarioId: args.scenarioId,
    ...(args.stepId ? { stepId: args.stepId } : {}),
    capturePhase: args.capturePhase,
    reloadCount: args.reloadCount,
    traceId: args.traceId,
    controlId: args.controlId,
    observationId: args.observationId,
    expectedSemanticIdentity: args.expectedSemanticIdentity,
    deterministicClockFingerprint: args.deterministicClockFingerprint,
    requestedScreenshotRelativePath: paths.screenshot,
    requestedHierarchyRelativePath: paths.hierarchy,
  };
  return parseExplorerPhysicalCaptureRequest({
    ...draft,
    captureId: explorerPhysicalCaptureId(draft),
  });
}

export function parseExplorerPhysicalCaptureRequest(
  value: unknown,
): ExplorerPhysicalCaptureRequestV1 {
  assertPrivacySafe(value);
  if (!isRecord(value) ||
    !exactKeys(value, [...REQUEST_KEYS, 'stepId'], ['stepId']) ||
    value.schemaVersion !== EXPLORER_PHYSICAL_EVIDENCE_SCHEMA_VERSION ||
    !CAPTURE_ID_PATTERN.test(String(value.captureId)) ||
    !ID_PATTERN.test(String(value.campaignId)) ||
    !String(value.campaignId).startsWith('explorer-nine-') ||
    !ID_PATTERN.test(String(value.scenarioId)) ||
    !(value.stepId === undefined || ID_PATTERN.test(String(value.stepId))) ||
    !EXPLORER_CAPTURE_PHASES.includes(value.capturePhase as ExplorerCapturePhase) ||
    !validCount(value.reloadCount) || !nullableNonEmpty(value.traceId) ||
    !nullableNonEmpty(value.controlId) || !nullableNonEmpty(value.observationId) ||
    !nonEmpty(value.deterministicClockFingerprint)) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_REQUEST);
  }
  if (!isPrivacySafeExplorerRelativePath(value.requestedScreenshotRelativePath) ||
    !isPrivacySafeExplorerRelativePath(value.requestedHierarchyRelativePath)) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.ABSOLUTE_PATH);
  }
  const expectedSemanticIdentity = parseExpectedSemanticIdentity(
    value.expectedSemanticIdentity,
    EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_REQUEST,
  );
  const request: ExplorerPhysicalCaptureRequestV1 = {
    schemaVersion: EXPLORER_PHYSICAL_EVIDENCE_SCHEMA_VERSION,
    captureId: value.captureId as string,
    campaignId: value.campaignId as string,
    scenarioId: value.scenarioId as string,
    ...(value.stepId === undefined ? {} : { stepId: value.stepId as string }),
    capturePhase: value.capturePhase as ExplorerCapturePhase,
    reloadCount: value.reloadCount as number,
    traceId: value.traceId as string | null,
    controlId: value.controlId as string | null,
    observationId: value.observationId as string | null,
    expectedSemanticIdentity,
    deterministicClockFingerprint: value.deterministicClockFingerprint as string,
    requestedScreenshotRelativePath: value.requestedScreenshotRelativePath,
    requestedHierarchyRelativePath: value.requestedHierarchyRelativePath,
  };
  assertPhaseIdentity({
    phase: request.capturePhase,
    stepId: request.stepId,
    reloadCount: request.reloadCount,
    traceId: request.traceId,
    controlId: request.controlId,
    observationId: request.observationId,
    actionSemanticHash: request.expectedSemanticIdentity.actionSemanticHash,
    failure: EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_REQUEST,
  });
  const expectedPaths = explorerCaptureRelativePaths({
    scenarioId: request.scenarioId,
    stepId: request.stepId,
    stepOrdinal: request.capturePhase === 'seed-reset'
      ? undefined
      : request.capturePhase === 'after-reload'
        ? request.reloadCount
        : request.reloadCount + 1,
    capturePhase: request.capturePhase,
  });
  const { captureId: _captureId, ...captureIdentity } = request;
  if (request.requestedScreenshotRelativePath !== expectedPaths.screenshot ||
    request.requestedHierarchyRelativePath !== expectedPaths.hierarchy ||
    request.captureId !== explorerPhysicalCaptureId(captureIdentity)) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_REQUEST, 'deterministic_identity');
  }
  return request;
}

function parseScreenshot(value: unknown): ExplorerPhysicalScreenshotReceiptV1 {
  if (!isRecord(value) || !exactKeys(value, SCREENSHOT_KEYS)) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.MISSING_FILE, 'screenshot');
  }
  if (!isPrivacySafeExplorerRelativePath(value.relativeReference)) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.ABSOLUTE_PATH, 'screenshot');
  }
  if (!validCount(value.byteSize) || value.byteSize === 0) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.EMPTY_FILE, 'screenshot');
  }
  if (!SHA256_PATTERN.test(String(value.sha256))) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_HASH, 'screenshot');
  }
  if (value.mediaType !== 'image/png') {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_RECEIPT, 'screenshot_media_type');
  }
  return value as unknown as ExplorerPhysicalScreenshotReceiptV1;
}

function parseHierarchy(value: unknown): ExplorerPhysicalHierarchyReceiptV1 {
  if (!isRecord(value) || !exactKeys(value, HIERARCHY_KEYS)) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.MISSING_FILE, 'hierarchy');
  }
  if (!isPrivacySafeExplorerRelativePath(value.relativeReference)) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.ABSOLUTE_PATH, 'hierarchy');
  }
  if (!validCount(value.byteSize) || value.byteSize === 0) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.EMPTY_FILE, 'hierarchy');
  }
  if (!SHA256_PATTERN.test(String(value.sha256))) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_HASH, 'hierarchy');
  }
  if (value.format !== EXPLORER_HIERARCHY_FORMAT) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_RECEIPT, 'hierarchy_format');
  }
  return value as unknown as ExplorerPhysicalHierarchyReceiptV1;
}

export function parseExplorerPhysicalEvidenceReceipt(
  value: unknown,
): ExplorerPhysicalEvidenceReceiptV1 {
  assertPrivacySafe(value);
  if (!isRecord(value)) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_RECEIPT);
  }
  if (!Object.prototype.hasOwnProperty.call(value, 'screenshot') ||
    !Object.prototype.hasOwnProperty.call(value, 'hierarchy')) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.MISSING_FILE);
  }
  if (!exactKeys(value, [...RECEIPT_KEYS, 'stepId'], ['stepId']) ||
    value.schemaVersion !== EXPLORER_PHYSICAL_EVIDENCE_SCHEMA_VERSION ||
    !CAPTURE_ID_PATTERN.test(String(value.captureId)) ||
    !ID_PATTERN.test(String(value.campaignId)) ||
    !String(value.campaignId).startsWith('explorer-nine-') ||
    !ID_PATTERN.test(String(value.scenarioId)) ||
    !(value.stepId === undefined || ID_PATTERN.test(String(value.stepId))) ||
    !EXPLORER_CAPTURE_PHASES.includes(value.capturePhase as ExplorerCapturePhase) ||
    !validCount(value.reloadCount) || !nullableNonEmpty(value.traceId) ||
    !nullableNonEmpty(value.controlId) || !nullableNonEmpty(value.observationId) ||
    !REPOSITORY_SHA_PATTERN.test(String(value.capturedIntegratedRepositorySha)) ||
    !nonEmpty(value.deterministicClockFingerprint)) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_RECEIPT);
  }
  const expectedSemanticIdentity = parseExpectedSemanticIdentity(
    value.expectedSemanticIdentity,
    EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_RECEIPT,
  );
  const receipt: ExplorerPhysicalEvidenceReceiptV1 = {
    schemaVersion: EXPLORER_PHYSICAL_EVIDENCE_SCHEMA_VERSION,
    captureId: value.captureId as string,
    campaignId: value.campaignId as string,
    scenarioId: value.scenarioId as string,
    ...(value.stepId === undefined ? {} : { stepId: value.stepId as string }),
    capturePhase: value.capturePhase as ExplorerCapturePhase,
    reloadCount: value.reloadCount as number,
    traceId: value.traceId as string | null,
    controlId: value.controlId as string | null,
    observationId: value.observationId as string | null,
    expectedSemanticIdentity,
    screenshot: parseScreenshot(value.screenshot),
    hierarchy: parseHierarchy(value.hierarchy),
    capturedIntegratedRepositorySha: value.capturedIntegratedRepositorySha as string,
    deterministicClockFingerprint: value.deterministicClockFingerprint as string,
  };
  assertPhaseIdentity({
    phase: receipt.capturePhase,
    stepId: receipt.stepId,
    reloadCount: receipt.reloadCount,
    traceId: receipt.traceId,
    controlId: receipt.controlId,
    observationId: receipt.observationId,
    actionSemanticHash: receipt.expectedSemanticIdentity.actionSemanticHash,
    failure: EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_RECEIPT,
  });
  return receipt;
}

export function validateExplorerPhysicalEvidenceReceipt(args: {
  request: ExplorerPhysicalCaptureRequestV1;
  receipt: unknown;
  expectedIntegratedRepositorySha: string;
  currentDeterministicClockFingerprint: string;
  staleClockFingerprints?: readonly string[];
  futureClockFingerprints?: readonly string[];
}): ExplorerPhysicalEvidenceReceiptV1 {
  const request = parseExplorerPhysicalCaptureRequest(args.request);
  const receipt = parseExplorerPhysicalEvidenceReceipt(args.receipt);
  if (receipt.captureId !== request.captureId) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.CAPTURE_ID_MISMATCH);
  }
  if (receipt.campaignId !== request.campaignId) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.CAMPAIGN_MISMATCH);
  }
  if (receipt.scenarioId !== request.scenarioId) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.SCENARIO_MISMATCH);
  }
  if (receipt.stepId !== request.stepId) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.STEP_MISMATCH);
  }
  if (receipt.capturePhase !== request.capturePhase) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.PHASE_MISMATCH);
  }
  if (receipt.reloadCount !== request.reloadCount) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.RELOAD_COUNT_MISMATCH);
  }
  if (receipt.traceId !== request.traceId) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.TRACE_MISMATCH);
  }
  if (receipt.controlId !== request.controlId) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.CONTROL_MISMATCH);
  }
  if (receipt.observationId !== request.observationId) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.OBSERVATION_MISMATCH);
  }
  if (stableSemanticJsonV2(receipt.expectedSemanticIdentity) !==
    stableSemanticJsonV2(request.expectedSemanticIdentity)) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.SEMANTIC_IDENTITY_MISMATCH);
  }
  if (receipt.screenshot.relativeReference !==
      request.requestedScreenshotRelativePath ||
    receipt.hierarchy.relativeReference !== request.requestedHierarchyRelativePath) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.PATH_MISMATCH);
  }
  if (receipt.capturedIntegratedRepositorySha !== args.expectedIntegratedRepositorySha) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.REPOSITORY_SHA_MISMATCH);
  }
  if (receipt.deterministicClockFingerprint !==
      args.currentDeterministicClockFingerprint ||
    request.deterministicClockFingerprint !==
      args.currentDeterministicClockFingerprint) {
    if (args.staleClockFingerprints?.includes(receipt.deterministicClockFingerprint)) {
      fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.STALE_RECEIPT);
    }
    if (args.futureClockFingerprints?.includes(receipt.deterministicClockFingerprint)) {
      fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.FUTURE_RECEIPT);
    }
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.CLOCK_MISMATCH);
  }
  return receipt;
}

export function explorerEvidenceArtifactReference(
  evidence: ExplorerPhysicalScreenshotReceiptV1 | ExplorerPhysicalHierarchyReceiptV1,
): { artifactId: string; contentFingerprint: string } {
  return {
    artifactId: evidence.relativeReference,
    contentFingerprint: `sha256:${evidence.sha256}`,
  };
}

export function parseExplorerPhysicalEvidenceLedger(
  value: unknown,
): ExplorerPhysicalEvidenceLedgerV1 {
  if (!isRecord(value) || !exactKeys(value, LEDGER_KEYS) ||
    value.schemaVersion !== EXPLORER_PHYSICAL_EVIDENCE_SCHEMA_VERSION ||
    !Array.isArray(value.entries)) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.PERSISTENCE_FAILED, 'ledger');
  }
  const entries = value.entries.map((entry, index) => {
    if (!isRecord(entry) || !exactKeys(entry, LEDGER_ENTRY_KEYS)) {
      fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.PERSISTENCE_FAILED, `entry:${index}`);
    }
    const request = parseExplorerPhysicalCaptureRequest(entry.request);
    const receipt = entry.receipt === null
      ? null
      : parseExplorerPhysicalEvidenceReceipt(entry.receipt);
    if (receipt && receipt.captureId !== request.captureId) {
      fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.PERSISTENCE_FAILED,
        `entry_capture:${index}`);
    }
    return { request, receipt };
  });
  const captureIds = entries.map((entry) => entry.request.captureId);
  if (new Set(captureIds).size !== captureIds.length) {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.PERSISTENCE_FAILED, 'duplicate_capture');
  }
  return {
    schemaVersion: EXPLORER_PHYSICAL_EVIDENCE_SCHEMA_VERSION,
    entries,
  };
}

function defaultStorage(): DevE2EKeyValueStorage {
  // Loaded only inside the development evidence path.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module = require('@react-native-async-storage/async-storage');
  return module.default ?? module;
}

async function readLedger(
  storage: DevE2EKeyValueStorage,
): Promise<ExplorerPhysicalEvidenceLedgerV1> {
  const raw = await storage.getItem(EXPLORER_PHYSICAL_EVIDENCE_STORAGE_KEY);
  if (!raw) {
    return { schemaVersion: EXPLORER_PHYSICAL_EVIDENCE_SCHEMA_VERSION, entries: [] };
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.PERSISTENCE_FAILED, 'json');
  }
  return parseExplorerPhysicalEvidenceLedger(value);
}

async function writeLedger(
  storage: DevE2EKeyValueStorage,
  ledger: ExplorerPhysicalEvidenceLedgerV1,
): Promise<void> {
  const parsed = parseExplorerPhysicalEvidenceLedger(ledger);
  await storage.setItem(
    EXPLORER_PHYSICAL_EVIDENCE_STORAGE_KEY,
    JSON.stringify(parsed),
  );
}

export class ExplorerPhysicalEvidenceBridge {
  private readonly storage: DevE2EKeyValueStorage;
  private readonly markers: ExplorerPhysicalEvidenceMarkerPublisher;
  private readonly integratedRepositorySha: string;
  private readonly currentClockFingerprint: () => string;

  constructor(args: {
    storage?: DevE2EKeyValueStorage;
    markers: ExplorerPhysicalEvidenceMarkerPublisher;
    integratedRepositorySha: string;
    currentClockFingerprint: () => string;
  }) {
    if (!REPOSITORY_SHA_PATTERN.test(args.integratedRepositorySha)) {
      fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.REPOSITORY_SHA_MISMATCH,
        'configured_sha');
    }
    this.storage = args.storage ?? defaultStorage();
    this.markers = args.markers;
    this.integratedRepositorySha = args.integratedRepositorySha;
    this.currentClockFingerprint = args.currentClockFingerprint;
  }

  async restore(): Promise<ExplorerPhysicalEvidenceLedgerV1> {
    const ledger = await readLedger(this.storage);
    for (const entry of ledger.entries) {
      if (entry.receipt) this.markers.accepted(entry.request.captureId);
      else this.markers.request(
        entry.request.captureId,
        encodeURIComponent(JSON.stringify(entry.request)),
      );
    }
    return ledger;
  }

  async requestCapture(
    value: ExplorerPhysicalCaptureRequestV1,
  ): Promise<ExplorerPhysicalCaptureRequestV1> {
    const request = parseExplorerPhysicalCaptureRequest(value);
    if (request.deterministicClockFingerprint !== this.currentClockFingerprint()) {
      fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.CLOCK_MISMATCH);
    }
    const ledger = await readLedger(this.storage);
    const existing = ledger.entries.find((entry) =>
      entry.request.captureId === request.captureId);
    if (existing) {
      if (stableSemanticJsonV2(existing.request) !== stableSemanticJsonV2(request)) {
        fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.DUPLICATE_RECEIPT,
          request.captureId);
      }
      if (existing.receipt) this.markers.accepted(request.captureId);
      else this.markers.request(
        request.captureId,
        encodeURIComponent(JSON.stringify(request)),
      );
      return request;
    }
    await writeLedger(this.storage, {
      schemaVersion: EXPLORER_PHYSICAL_EVIDENCE_SCHEMA_VERSION,
      entries: [...ledger.entries, { request, receipt: null }],
    });
    this.markers.request(
      request.captureId,
      encodeURIComponent(JSON.stringify(request)),
    );
    return request;
  }

  async acknowledge(
    captureId: string,
    value: unknown,
  ): Promise<{ status: 'accepted' | 'already-accepted'; receipt: ExplorerPhysicalEvidenceReceiptV1 }> {
    try {
      const ledger = await readLedger(this.storage);
      const index = ledger.entries.findIndex((entry) =>
        entry.request.captureId === captureId);
      if (index < 0) {
        fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.REQUEST_NOT_PENDING, captureId);
      }
      const entry = ledger.entries[index]!;
      if (entry.receipt) {
        const duplicate = parseExplorerPhysicalEvidenceReceipt(value);
        if (stableSemanticJsonV2(duplicate) !== stableSemanticJsonV2(entry.receipt)) {
          fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.DUPLICATE_RECEIPT, captureId);
        }
        this.markers.accepted(captureId);
        return { status: 'already-accepted', receipt: entry.receipt };
      }
      const receipt = validateExplorerPhysicalEvidenceReceipt({
        request: entry.request,
        receipt: value,
        expectedIntegratedRepositorySha: this.integratedRepositorySha,
        currentDeterministicClockFingerprint: this.currentClockFingerprint(),
      });
      const entries = [...ledger.entries];
      entries[index] = { request: entry.request, receipt };
      // Persistence is deliberately awaited before the accepted marker exists.
      await writeLedger(this.storage, {
        schemaVersion: EXPLORER_PHYSICAL_EVIDENCE_SCHEMA_VERSION,
        entries,
      });
      this.markers.accepted(captureId);
      return { status: 'accepted', receipt };
    } catch (error) {
      const reasonCode = error instanceof ExplorerPhysicalEvidenceError
        ? error.reasonCode
        : EXPLORER_PHYSICAL_EVIDENCE_FAILURE.PERSISTENCE_FAILED;
      this.markers.error(reasonCode);
      throw error;
    }
  }

  async readAccepted(
    captureId: string,
  ): Promise<ExplorerPhysicalEvidenceReceiptV1 | null> {
    const ledger = await readLedger(this.storage);
    return ledger.entries.find((entry) =>
      entry.request.captureId === captureId)?.receipt ?? null;
  }

  async receiptsForScenario(args: {
    campaignId: string;
    scenarioId: string;
  }): Promise<readonly ExplorerPhysicalEvidenceReceiptV1[]> {
    const ledger = await readLedger(this.storage);
    return ledger.entries
      .filter((entry) => entry.request.campaignId === args.campaignId &&
        entry.request.scenarioId === args.scenarioId && entry.receipt !== null)
      .map((entry) => entry.receipt!);
  }
}

export function encodeExplorerPhysicalEvidenceReceipt(
  receipt: ExplorerPhysicalEvidenceReceiptV1,
): string {
  return encodeURIComponent(JSON.stringify(parseExplorerPhysicalEvidenceReceipt(receipt)));
}

export function decodeExplorerPhysicalEvidenceReceipt(
  encoded: string,
): ExplorerPhysicalEvidenceReceiptV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(encoded));
  } catch {
    fail(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_RECEIPT, 'encoded_payload');
  }
  return parseExplorerPhysicalEvidenceReceipt(parsed);
}
