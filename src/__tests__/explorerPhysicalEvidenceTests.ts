import type { DevE2EKeyValueStorage } from '../dev/e2e/devE2ECheckpoint';
import {
  EXPLORER_HIERARCHY_FORMAT,
  EXPLORER_PHYSICAL_EVIDENCE_FAILURE,
  EXPLORER_PHYSICAL_EVIDENCE_STORAGE_KEY,
  ExplorerPhysicalEvidenceBridge,
  ExplorerPhysicalEvidenceError,
  createExplorerPhysicalCaptureRequest,
  explorerCaptureRelativePaths,
  explorerPhysicalEvidenceReceiptRelativeReference,
  parseExplorerPhysicalCaptureRequest,
  parseExplorerPhysicalEvidenceReceipt,
  validateExplorerPhysicalEvidenceReceipt,
  type ExplorerPhysicalCaptureRequestV1,
  type ExplorerPhysicalEvidenceReceiptV1,
} from '../dev/e2e/explorerPhysicalEvidence';
import {
  __resetExplorerPhysicalEvidenceDevBridgeForTest,
  acknowledgeExplorerPhysicalEvidence,
  explorerPhysicalEvidenceArtifactUrl,
  requestExplorerPhysicalEvidence,
  startExplorerPhysicalEvidenceCampaign,
} from '../dev/e2e/explorerPhysicalEvidenceDevBridge';
import { sha256BytesHex } from '../utils/semanticFingerprintV2';
import {
  __resetDevE2EStateForTest,
  devE2EMarkers,
  getDevE2EStateSnapshot,
  setDevE2EExplorerCaptureAccepted,
  setDevE2EExplorerCaptureError,
  setDevE2EExplorerCaptureRequest,
  setDevE2EExplorerCaptureStage,
} from '../dev/e2e/devE2EState';

const REPOSITORY_SHA = '9f28da0d51a62106bc85d12a14868c216de8b96d';
const CAMPAIGN_ID = 'explorer-nine-9f28da0d51a6';
const CLOCK = 'clock:physical-evidence';

class MemoryStorage implements DevE2EKeyValueStorage {
  readonly values = new Map<string, string>();
  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }
  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

class ReceiptWriteFailureStorage extends MemoryStorage {
  async setItem(key: string, value: string): Promise<void> {
    if (key === EXPLORER_PHYSICAL_EVIDENCE_STORAGE_KEY &&
      value.includes('"receipt":{')) {
      throw new Error('write failed');
    }
    await super.setItem(key, value);
  }
}

class ReadbackMismatchStorage extends MemoryStorage {
  private corruptNextRead = false;
  async setItem(key: string, value: string): Promise<void> {
    await super.setItem(key, value);
    if (key === EXPLORER_PHYSICAL_EVIDENCE_STORAGE_KEY &&
      value.includes('"receipt":{')) this.corruptNextRead = true;
  }
  async getItem(key: string): Promise<string | null> {
    const value = await super.getItem(key);
    if (!this.corruptNextRead || key !== EXPLORER_PHYSICAL_EVIDENCE_STORAGE_KEY ||
      !value) return value;
    this.corruptNextRead = false;
    const parsed = JSON.parse(value) as { entries: Array<{ receipt: unknown }> };
    parsed.entries[0].receipt = null;
    return JSON.stringify(parsed);
  }
}

class MemoryArtifacts {
  readonly values = new Map<string, Uint8Array>();
  readonly read = async (args: {
    campaignId: string;
    relativeReference: string;
  }): Promise<Uint8Array | null> => this.values.get(
    `${args.campaignId}/${args.relativeReference}`,
  ) ?? null;

  put(campaignId: string, relativeReference: string, value: Uint8Array): void {
    this.values.set(`${campaignId}/${relativeReference}`, value);
  }

  installPhysicalFiles(evidence: ExplorerPhysicalEvidenceReceiptV1): void {
    this.put(evidence.campaignId, evidence.screenshot.relativeReference,
      screenshotBytes(evidence.captureId));
    this.put(evidence.campaignId, evidence.hierarchy.relativeReference,
      hierarchyBytes(evidence.captureId));
  }

  installReceiptFile(evidence: ExplorerPhysicalEvidenceReceiptV1): {
    relativeReference: string;
    sha256: string;
  } {
    const relativeReference =
      explorerPhysicalEvidenceReceiptRelativeReference(evidence);
    const bytes = new TextEncoder().encode(JSON.stringify(evidence));
    this.put(evidence.campaignId, relativeReference, bytes);
    return { relativeReference, sha256: sha256BytesHex(bytes) };
  }
}

function screenshotBytes(captureId: string): Uint8Array {
  return new TextEncoder().encode(`screenshot:${captureId}`);
}

function hierarchyBytes(captureId: string): Uint8Array {
  return new TextEncoder().encode(`hierarchy:${captureId}`);
}

function request(args: {
  phase?: 'seed-reset' | 'after-action' | 'after-reload';
  stepId?: string;
  stepOrdinal?: number;
  reloadCount?: number;
  scenarioId?: string;
  campaignId?: string;
  traceId?: string;
  controlId?: string;
  observationId?: string;
} = {}): ExplorerPhysicalCaptureRequestV1 {
  const phase = args.phase ?? 'after-action';
  const seed = phase === 'seed-reset';
  return createExplorerPhysicalCaptureRequest({
    campaignId: args.campaignId ?? CAMPAIGN_ID,
    scenarioId: args.scenarioId ?? 'smoke-physical-evidence',
    ...(seed ? {} : { stepId: args.stepId ?? 'first-action' }),
    ...(seed ? {} : { stepOrdinal: args.stepOrdinal ?? 1 }),
    capturePhase: phase,
    reloadCount: args.reloadCount ?? (phase === 'after-reload' ? 1 : 0),
    traceId: seed ? null : args.traceId ?? 'trace-1',
    controlId: seed ? null : args.controlId ?? 'control-1',
    observationId: seed ? null : args.observationId ?? 'observation-1',
    expectedSemanticIdentity: {
      manifestSemanticHash: 'explorer-scenario-sha256-v1:manifest',
      actionSemanticHash: seed ? null : 'explorer-action-sha256-v1:action',
      canonicalSemanticIdentity: seed ? 'manifest' : 'canonical-1',
    },
    deterministicClockFingerprint: CLOCK,
  });
}

function receipt(
  captureRequest: ExplorerPhysicalCaptureRequestV1,
  overrides: Partial<ExplorerPhysicalEvidenceReceiptV1> = {},
): ExplorerPhysicalEvidenceReceiptV1 {
  const screenshot = screenshotBytes(captureRequest.captureId);
  const hierarchy = hierarchyBytes(captureRequest.captureId);
  return {
    schemaVersion: captureRequest.schemaVersion,
    captureId: captureRequest.captureId,
    campaignId: captureRequest.campaignId,
    scenarioId: captureRequest.scenarioId,
    ...(captureRequest.stepId ? { stepId: captureRequest.stepId } : {}),
    capturePhase: captureRequest.capturePhase,
    reloadCount: captureRequest.reloadCount,
    traceId: captureRequest.traceId,
    controlId: captureRequest.controlId,
    observationId: captureRequest.observationId,
    expectedSemanticIdentity: captureRequest.expectedSemanticIdentity,
    screenshot: {
      relativeReference: captureRequest.requestedScreenshotRelativePath,
      sha256: sha256BytesHex(screenshot),
      byteSize: screenshot.byteLength,
      mediaType: 'image/png',
    },
    hierarchy: {
      relativeReference: captureRequest.requestedHierarchyRelativePath,
      sha256: sha256BytesHex(hierarchy),
      byteSize: hierarchy.byteLength,
      format: EXPLORER_HIERARCHY_FORMAT,
    },
    capturedIntegratedRepositorySha: REPOSITORY_SHA,
    deterministicClockFingerprint: CLOCK,
    ...overrides,
  };
}

let passed = 0;
let failed = 0;
async function test(name: string, run: () => void | Promise<void>): Promise<void> {
  try {
    await run();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${name}`, error);
  }
}

function expect(value: boolean, message: string): void {
  if (!value) throw new Error(message);
}

function expectCode(
  code: string,
  run: () => unknown,
): void {
  try {
    run();
  } catch (error) {
    expect(error instanceof ExplorerPhysicalEvidenceError,
      `expected physical evidence error, received ${String(error)}`);
    expect((error as ExplorerPhysicalEvidenceError).reasonCode === code,
      `expected ${code}, received ${(error as ExplorerPhysicalEvidenceError).reasonCode}`);
    return;
  }
  throw new Error(`expected ${code}`);
}

async function expectAsyncCode(
  code: string,
  run: () => Promise<unknown>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    expect(error instanceof ExplorerPhysicalEvidenceError,
      `expected physical evidence error, received ${String(error)}`);
    expect((error as ExplorerPhysicalEvidenceError).reasonCode === code,
      `expected ${code}, received ${
        (error as ExplorerPhysicalEvidenceError).reasonCode}`);
    return;
  }
  throw new Error(`expected ${code}`);
}

function createTestBridge(args: {
  storage: DevE2EKeyValueStorage;
  artifacts: MemoryArtifacts;
  accepted?: string[];
  errors?: string[];
  stages?: string[];
}): ExplorerPhysicalEvidenceBridge {
  return new ExplorerPhysicalEvidenceBridge({
    storage: args.storage,
    readArtifact: args.artifacts.read,
    integratedRepositorySha: REPOSITORY_SHA,
    currentClockFingerprint: () => CLOCK,
    markers: {
      request: () => {},
      accepted: (captureId) => args.accepted?.push(captureId),
      error: (reasonCode) => args.errors?.push(reasonCode),
      stage: (captureId, stage) => args.stages?.push(`${stage}:${captureId}`),
    },
  });
}

function validate(
  captureRequest: ExplorerPhysicalCaptureRequestV1,
  evidence: unknown,
): ExplorerPhysicalEvidenceReceiptV1 {
  return validateExplorerPhysicalEvidenceReceipt({
    request: captureRequest,
    receipt: evidence,
    expectedIntegratedRepositorySha: REPOSITORY_SHA,
    currentDeterministicClockFingerprint: CLOCK,
  });
}

async function main(): Promise<void> {
  console.log('\n-- Explorer Physical Evidence Bridge --');

  await test('capture IDs are deterministic and unique by phase identity', () => {
    const first = request();
    const repeat = request();
    const reload = request({ phase: 'after-reload' });
    expect(first.captureId === repeat.captureId, 'same request changed capture ID');
    expect(first.captureId !== reload.captureId, 'different phase reused capture ID');
  });

  await test('request parsing is strict and revalidates its deterministic ID', () => {
    const valid = request();
    expect(parseExplorerPhysicalCaptureRequest(valid).captureId === valid.captureId,
      'valid request was rejected');
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_REQUEST, () =>
      parseExplorerPhysicalCaptureRequest({ ...valid, extra: true }));
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_REQUEST, () =>
      parseExplorerPhysicalCaptureRequest({
        ...valid,
        captureId: `explorer-capture-${'0'.repeat(64)}`,
      }));
  });

  await test('receipt parsing is strict and requires both physical files', () => {
    const valid = receipt(request());
    expect(parseExplorerPhysicalEvidenceReceipt(valid).captureId === valid.captureId,
      'valid receipt was rejected');
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_RECEIPT, () =>
      parseExplorerPhysicalEvidenceReceipt({ ...valid, extra: true }));
    const { hierarchy: _hierarchy, ...screenshotOnly } = valid;
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.MISSING_FILE, () =>
      parseExplorerPhysicalEvidenceReceipt(screenshotOnly));
    const { screenshot: _screenshot, ...hierarchyOnly } = valid;
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.MISSING_FILE, () =>
      parseExplorerPhysicalEvidenceReceipt(hierarchyOnly));
  });

  await test('absolute and parent-relative evidence paths are rejected', () => {
    const valid = receipt(request());
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.ABSOLUTE_PATH, () =>
      parseExplorerPhysicalEvidenceReceipt({
        ...valid,
        screenshot: { ...valid.screenshot, relativeReference: '/tmp/evidence.png' },
      }));
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.ABSOLUTE_PATH, () =>
      parseExplorerPhysicalEvidenceReceipt({
        ...valid,
        hierarchy: { ...valid.hierarchy, relativeReference: '../hierarchy.json' },
      }));
  });

  await test('empty files and invalid SHA-256 receipts are rejected', () => {
    const valid = receipt(request());
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.EMPTY_FILE, () =>
      parseExplorerPhysicalEvidenceReceipt({
        ...valid,
        screenshot: { ...valid.screenshot, byteSize: 0 },
      }));
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.INVALID_HASH, () =>
      parseExplorerPhysicalEvidenceReceipt({
        ...valid,
        hierarchy: { ...valid.hierarchy, sha256: 'abc' },
      }));
  });

  await test('trace mismatch fails closed', () => {
    const captureRequest = request();
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.TRACE_MISMATCH, () =>
      validate(captureRequest, receipt(captureRequest, { traceId: 'trace-wrong' })));
  });

  await test('control mismatch fails closed', () => {
    const captureRequest = request();
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.CONTROL_MISMATCH, () =>
      validate(captureRequest, receipt(captureRequest, { controlId: 'control-wrong' })));
  });

  await test('observation mismatch fails closed', () => {
    const captureRequest = request();
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.OBSERVATION_MISMATCH, () =>
      validate(captureRequest, receipt(captureRequest, {
        observationId: 'observation-wrong',
      })));
  });

  await test('reload-count mismatch fails closed', () => {
    const captureRequest = request();
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.RELOAD_COUNT_MISMATCH, () =>
      validate(captureRequest, receipt(captureRequest, { reloadCount: 1 })));
  });

  await test('capture, scenario, step and phase identity mismatches fail closed', () => {
    const captureRequest = request();
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.CAPTURE_ID_MISMATCH, () =>
      validate(captureRequest, receipt(captureRequest, {
        captureId: `explorer-capture-${'0'.repeat(64)}`,
      })));
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.SCENARIO_MISMATCH, () =>
      validate(captureRequest, receipt(captureRequest, {
        scenarioId: 'smoke-wrong-scenario',
      })));
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.STEP_MISMATCH, () =>
      validate(captureRequest, receipt(captureRequest, {
        stepId: 'wrong-step',
      })));
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.PHASE_MISMATCH, () =>
      validate(captureRequest, receipt(captureRequest, {
        capturePhase: 'after-reload',
        reloadCount: 1,
      })));
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.CLOCK_MISMATCH, () =>
      validate(captureRequest, receipt(captureRequest, {
        deterministicClockFingerprint: 'clock:wrong',
      })));
  });

  await test('cross-campaign, wrong repository, stale and future receipts fail closed', () => {
    const captureRequest = request();
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.CAMPAIGN_MISMATCH, () =>
      validate(captureRequest, receipt(captureRequest, {
        campaignId: 'explorer-nine-another',
      })));
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.REPOSITORY_SHA_MISMATCH, () =>
      validate(captureRequest, receipt(captureRequest, {
        capturedIntegratedRepositorySha: '0'.repeat(40),
      })));
    const stale = receipt(captureRequest, { deterministicClockFingerprint: 'clock:stale' });
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.STALE_RECEIPT, () =>
      validateExplorerPhysicalEvidenceReceipt({
        request: captureRequest,
        receipt: stale,
        expectedIntegratedRepositorySha: REPOSITORY_SHA,
        currentDeterministicClockFingerprint: CLOCK,
        staleClockFingerprints: ['clock:stale'],
      }));
    const future = receipt(captureRequest, { deterministicClockFingerprint: 'clock:future' });
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.FUTURE_RECEIPT, () =>
      validateExplorerPhysicalEvidenceReceipt({
        request: captureRequest,
        receipt: future,
        expectedIntegratedRepositorySha: REPOSITORY_SHA,
        currentDeterministicClockFingerprint: CLOCK,
        futureClockFingerprints: ['clock:future'],
      }));
  });

  await test('privacy-forbidden identifiers, Metro ports and timestamps are rejected', () => {
    const valid = receipt(request());
    for (const candidate of [
      { ...valid, rawDeviceIdentifier: 'device-1' },
      { ...valid, metroUrl: 'http://127.0.0.1:8081' },
      { ...valid, capturedAt: '2026-07-17T00:00:00.000Z' },
    ]) {
      expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.PRIVACY_FORBIDDEN_FIELD, () =>
        parseExplorerPhysicalEvidenceReceipt(candidate));
    }
  });

  await test('acknowledgement persists before accepted marker and is idempotent', async () => {
    const storage = new MemoryStorage();
    const artifacts = new MemoryArtifacts();
    const captureRequest = request();
    const accepted = receipt(captureRequest);
    artifacts.installPhysicalFiles(accepted);
    const events: string[] = [];
    const bridge = new ExplorerPhysicalEvidenceBridge({
      storage,
      readArtifact: artifacts.read,
      integratedRepositorySha: REPOSITORY_SHA,
      currentClockFingerprint: () => CLOCK,
      markers: {
        request: (captureId) => events.push(`request:${captureId}`),
        accepted: (captureId) => {
          const persisted = storage.values.get(EXPLORER_PHYSICAL_EVIDENCE_STORAGE_KEY) ?? '';
          expect(persisted.includes(`\"captureId\":\"${captureId}\"`) &&
            persisted.includes('\"receipt\":{'), 'accepted marker preceded persistence');
          events.push(`accepted:${captureId}`);
        },
        error: (reasonCode) => events.push(`error:${reasonCode}`),
        stage: (captureId, stage) => events.push(`stage:${stage}:${captureId}`),
      },
    });
    await bridge.requestCapture(captureRequest);
    const first = await bridge.acknowledge(captureRequest.captureId, accepted);
    const second = await bridge.acknowledge(captureRequest.captureId, accepted);
    expect(first.status === 'accepted' && second.status === 'already-accepted',
      'duplicate acknowledgement was not idempotent');
    expect(events.filter((event) => event.startsWith('accepted:')).length === 2,
      'idempotent acknowledgement did not republish accepted marker');
  });

  await test('seed-reset, after-action and after-reload receipt files are acknowledged', async () => {
    const storage = new MemoryStorage();
    const artifacts = new MemoryArtifacts();
    const accepted: string[] = [];
    const bridge = createTestBridge({ storage, artifacts, accepted });
    for (const captureRequest of [
      request({ phase: 'seed-reset' }),
      request({ phase: 'after-action' }),
      request({ phase: 'after-reload' }),
    ]) {
      const evidence = receipt(captureRequest);
      artifacts.installPhysicalFiles(evidence);
      const reference = artifacts.installReceiptFile(evidence);
      await bridge.requestCapture(captureRequest);
      const result = await bridge.acknowledgeReference(
        captureRequest.captureId,
        reference.relativeReference,
        reference.sha256,
      );
      expect(result.status === 'accepted',
        `${captureRequest.capturePhase} receipt was not accepted`);
    }
    expect(accepted.length === 3, 'not every capture phase published acceptance');
  });

  await test('receipt references reject absolute paths, traversal, hash mismatch and reuse', async () => {
    const storage = new MemoryStorage();
    const artifacts = new MemoryArtifacts();
    const captureRequest = request();
    const evidence = receipt(captureRequest);
    artifacts.installPhysicalFiles(evidence);
    const reference = artifacts.installReceiptFile(evidence);
    const bridge = createTestBridge({ storage, artifacts });
    await bridge.requestCapture(captureRequest);
    await expectAsyncCode(
      EXPLORER_PHYSICAL_EVIDENCE_FAILURE.RECEIPT_REFERENCE_INVALID,
      () => bridge.acknowledgeReference(
        captureRequest.captureId, '/tmp/receipt.json', reference.sha256,
      ),
    );
    await expectAsyncCode(
      EXPLORER_PHYSICAL_EVIDENCE_FAILURE.RECEIPT_REFERENCE_INVALID,
      () => bridge.acknowledgeReference(
        captureRequest.captureId, '../receipt.json', reference.sha256,
      ),
    );
    await expectAsyncCode(
      EXPLORER_PHYSICAL_EVIDENCE_FAILURE.RECEIPT_FILE_HASH_MISMATCH,
      () => bridge.acknowledgeReference(
        captureRequest.captureId, reference.relativeReference, '0'.repeat(64),
      ),
    );
    const another = request({ stepId: 'second-action', stepOrdinal: 2, reloadCount: 1 });
    await bridge.requestCapture(another);
    await expectAsyncCode(
      EXPLORER_PHYSICAL_EVIDENCE_FAILURE.RECEIPT_REFERENCE_MISMATCH,
      () => bridge.acknowledgeReference(
        another.captureId, reference.relativeReference, reference.sha256,
      ),
    );
  });

  await test('physical screenshot and hierarchy bytes must match receipt hashes', async () => {
    for (const kind of ['screenshot', 'hierarchy'] as const) {
      const storage = new MemoryStorage();
      const artifacts = new MemoryArtifacts();
      const captureRequest = request();
      const valid = receipt(captureRequest);
      const invalid = kind === 'screenshot'
        ? receipt(captureRequest, {
            screenshot: { ...valid.screenshot, sha256: '0'.repeat(64) },
          })
        : receipt(captureRequest, {
            hierarchy: { ...valid.hierarchy, sha256: '0'.repeat(64) },
          });
      artifacts.installPhysicalFiles(invalid);
      const bridge = createTestBridge({ storage, artifacts });
      await bridge.requestCapture(captureRequest);
      await expectAsyncCode(
        kind === 'screenshot'
          ? EXPLORER_PHYSICAL_EVIDENCE_FAILURE.SCREENSHOT_HASH_MISMATCH
          : EXPLORER_PHYSICAL_EVIDENCE_FAILURE.HIERARCHY_HASH_MISMATCH,
        () => bridge.acknowledge(captureRequest.captureId, invalid),
      );
    }
  });

  await test('missing screenshot or hierarchy fails before persistence', async () => {
    for (const missing of ['screenshot', 'hierarchy'] as const) {
      const storage = new MemoryStorage();
      const artifacts = new MemoryArtifacts();
      const captureRequest = request();
      const evidence = receipt(captureRequest);
      if (missing !== 'screenshot') {
        artifacts.put(evidence.campaignId, evidence.screenshot.relativeReference,
          screenshotBytes(evidence.captureId));
      }
      if (missing !== 'hierarchy') {
        artifacts.put(evidence.campaignId, evidence.hierarchy.relativeReference,
          hierarchyBytes(evidence.captureId));
      }
      const bridge = createTestBridge({ storage, artifacts });
      await bridge.requestCapture(captureRequest);
      await expectAsyncCode(
        EXPLORER_PHYSICAL_EVIDENCE_FAILURE.MISSING_FILE,
        () => bridge.acknowledge(captureRequest.captureId, evidence),
      );
      expect(!(storage.values.get(EXPLORER_PHYSICAL_EVIDENCE_STORAGE_KEY) ?? '')
        .includes('"receipt":{'), `${missing} absence persisted a receipt`);
    }
  });

  await test('persistence failure and readback mismatch publish no accepted marker', async () => {
    for (const storage of [
      new ReceiptWriteFailureStorage(),
      new ReadbackMismatchStorage(),
    ]) {
      const artifacts = new MemoryArtifacts();
      const captureRequest = request();
      const evidence = receipt(captureRequest);
      artifacts.installPhysicalFiles(evidence);
      const accepted: string[] = [];
      const bridge = createTestBridge({ storage, artifacts, accepted });
      await bridge.requestCapture(captureRequest);
      await expectAsyncCode(
        storage instanceof ReceiptWriteFailureStorage
          ? EXPLORER_PHYSICAL_EVIDENCE_FAILURE.PERSISTENCE_FAILED
          : EXPLORER_PHYSICAL_EVIDENCE_FAILURE.READBACK_MISMATCH,
        () => bridge.acknowledge(captureRequest.captureId, evidence),
      );
      expect(accepted.length === 0, 'failed durability published acceptance');
    }
  });

  await test('conflicting duplicate fails closed while identical duplicate is idempotent', async () => {
    const storage = new MemoryStorage();
    const artifacts = new MemoryArtifacts();
    const captureRequest = request();
    const evidence = receipt(captureRequest);
    artifacts.installPhysicalFiles(evidence);
    const bridge = createTestBridge({ storage, artifacts });
    await bridge.requestCapture(captureRequest);
    await bridge.acknowledge(captureRequest.captureId, evidence);
    expect((await bridge.acknowledge(captureRequest.captureId, evidence)).status ===
      'already-accepted', 'identical duplicate was not idempotent');
    await expectAsyncCode(
      EXPLORER_PHYSICAL_EVIDENCE_FAILURE.DUPLICATE_RECEIPT,
      () => bridge.acknowledge(captureRequest.captureId, {
        ...evidence,
        screenshot: { ...evidence.screenshot, sha256: '0'.repeat(64) },
      }),
    );
  });

  await test('one receipt cannot satisfy another pending capture', async () => {
    const storage = new MemoryStorage();
    const artifacts = new MemoryArtifacts();
    const first = request();
    const second = request({ stepId: 'second-action', stepOrdinal: 2, reloadCount: 1 });
    const bridge = new ExplorerPhysicalEvidenceBridge({
      storage,
      readArtifact: artifacts.read,
      integratedRepositorySha: REPOSITORY_SHA,
      currentClockFingerprint: () => CLOCK,
      markers: {
        request: () => {}, accepted: () => {}, error: () => {}, stage: () => {},
      },
    });
    await bridge.requestCapture(first);
    await bridge.requestCapture(second);
    try {
      await bridge.acknowledge(second.captureId, receipt(first));
    } catch (error) {
      expect(error instanceof ExplorerPhysicalEvidenceError &&
        error.reasonCode === EXPLORER_PHYSICAL_EVIDENCE_FAILURE.CAPTURE_ID_MISMATCH,
      'cross-request receipt had the wrong failure');
      return;
    }
    throw new Error('one receipt satisfied another request');
  });

  await test('cold reload restores pending and accepted evidence markers', async () => {
    const storage = new MemoryStorage();
    const artifacts = new MemoryArtifacts();
    const pending = request();
    const acceptedRequest = request({ phase: 'after-reload' });
    const first = new ExplorerPhysicalEvidenceBridge({
      storage,
      readArtifact: artifacts.read,
      integratedRepositorySha: REPOSITORY_SHA,
      currentClockFingerprint: () => CLOCK,
      markers: {
        request: () => {}, accepted: () => {}, error: () => {}, stage: () => {},
      },
    });
    await first.requestCapture(pending);
    await first.requestCapture(acceptedRequest);
    const acceptedEvidence = receipt(acceptedRequest);
    artifacts.installPhysicalFiles(acceptedEvidence);
    await first.acknowledge(acceptedRequest.captureId, acceptedEvidence);
    const restored: string[] = [];
    const cold = new ExplorerPhysicalEvidenceBridge({
      storage,
      readArtifact: artifacts.read,
      integratedRepositorySha: REPOSITORY_SHA,
      currentClockFingerprint: () => CLOCK,
      markers: {
        request: (captureId) => restored.push(`request:${captureId}`),
        accepted: (captureId) => restored.push(`accepted:${captureId}`),
        error: () => {},
        stage: () => {},
      },
    });
    await cold.restore();
    expect(restored.includes(`request:${pending.captureId}`) &&
      restored.includes(`accepted:${acceptedRequest.captureId}`),
    'cold restore omitted evidence state');
  });

  await test('state republish exposes exact marker across React remount and cold reload', async () => {
    __resetDevE2EStateForTest();
    const storage = new MemoryStorage();
    const artifacts = new MemoryArtifacts();
    const captureRequest = request({ phase: 'seed-reset' });
    const evidence = receipt(captureRequest);
    artifacts.installPhysicalFiles(evidence);
    const reference = artifacts.installReceiptFile(evidence);
    const bridge = new ExplorerPhysicalEvidenceBridge({
      storage,
      readArtifact: artifacts.read,
      integratedRepositorySha: REPOSITORY_SHA,
      currentClockFingerprint: () => CLOCK,
      markers: {
        request: setDevE2EExplorerCaptureRequest,
        accepted: setDevE2EExplorerCaptureAccepted,
        error: setDevE2EExplorerCaptureError,
        stage: setDevE2EExplorerCaptureStage,
      },
    });
    setDevE2EExplorerCaptureStage(captureRequest.captureId, 'route-received');
    await bridge.requestCapture(captureRequest);
    await bridge.acknowledgeReference(
      captureRequest.captureId,
      reference.relativeReference,
      reference.sha256,
    );
    const marker = `e2e-explorer-capture-accepted-${captureRequest.captureId}`;
    const firstRender = devE2EMarkers(getDevE2EStateSnapshot());
    const remountRender = devE2EMarkers(getDevE2EStateSnapshot());
    expect(firstRender.includes(marker) && remountRender.includes(marker),
      'React remount lost the accepted marker');
    for (const stage of [
      'route-received',
      'receipt-parsed',
      'pending-request-matched',
      'validation-succeeded',
      'persistence-succeeded',
      'readback-succeeded',
      'accepted-marker-published',
    ]) {
      expect(firstRender.includes(
        `e2e-explorer-capture-stage-${stage}-${captureRequest.captureId}`,
      ), `missing lifecycle stage ${stage}`);
    }
    __resetDevE2EStateForTest();
    const cold = new ExplorerPhysicalEvidenceBridge({
      storage,
      readArtifact: artifacts.read,
      integratedRepositorySha: REPOSITORY_SHA,
      currentClockFingerprint: () => CLOCK,
      markers: {
        request: setDevE2EExplorerCaptureRequest,
        accepted: setDevE2EExplorerCaptureAccepted,
        error: setDevE2EExplorerCaptureError,
        stage: setDevE2EExplorerCaptureStage,
      },
    });
    await cold.restore();
    expect(devE2EMarkers(getDevE2EStateSnapshot()).includes(marker),
      'cold reload lost the accepted marker');
  });

  await test('deterministic reset/action/reload file names are exact', () => {
    const reset = explorerCaptureRelativePaths({
      scenarioId: 'smoke-paths', capturePhase: 'seed-reset',
    });
    const action = explorerCaptureRelativePaths({
      scenarioId: 'smoke-paths', stepId: 'move-session', stepOrdinal: 2,
      capturePhase: 'after-action',
    });
    const reload = explorerCaptureRelativePaths({
      scenarioId: 'smoke-paths', stepId: 'move-session', stepOrdinal: 2,
      capturePhase: 'after-reload',
    });
    expect(reset.screenshot === 'smoke-paths/seed-initial.png' &&
      action.hierarchy ===
        'smoke-paths/02-move-session-after-action.accessibility.json' &&
      reload.screenshot === 'smoke-paths/02-move-session-after-reload.png',
    'physical evidence filenames drifted');
    expect(explorerPhysicalEvidenceArtifactUrl({
      e2eMetroUrl: 'http://127.0.0.1:8082',
      campaignId: CAMPAIGN_ID,
      relativeReference:
        'smoke-paths/physical-evidence-receipt-explorer-capture-' +
        `${'0'.repeat(64)}.json`,
    }) === 'http://127.0.0.1:8082/__dev_e2e__/explorer-physical-evidence/' +
      `${CAMPAIGN_ID}/smoke-paths%2F` +
      'physical-evidence-receipt-explorer-capture-' +
      `${'0'.repeat(64)}.json`,
    'app-to-Metro artifact URL was not the literal query-free path');
  });

  await test('request, accepted and fail-closed error markers are exact', () => {
    __resetDevE2EStateForTest();
    const captureRequest = request();
    setDevE2EExplorerCaptureRequest(captureRequest.captureId, '%7B%7D');
    expect(devE2EMarkers(getDevE2EStateSnapshot()).includes(
      `e2e-explorer-capture-request-${captureRequest.captureId}`,
    ), 'capture request marker missing');
    setDevE2EExplorerCaptureAccepted(captureRequest.captureId);
    setDevE2EExplorerCaptureStage(captureRequest.captureId, 'readback-succeeded');
    setDevE2EExplorerCaptureError(
      EXPLORER_PHYSICAL_EVIDENCE_FAILURE.TRACE_MISMATCH,
    );
    const markers = devE2EMarkers(getDevE2EStateSnapshot());
    expect(markers.includes(
      `e2e-explorer-capture-accepted-${captureRequest.captureId}`,
    ) && markers.includes(
      `e2e-explorer-capture-error-${
        EXPLORER_PHYSICAL_EVIDENCE_FAILURE.TRACE_MISMATCH}`,
    ) && !markers.includes(
      `e2e-explorer-capture-request-${captureRequest.captureId}`,
    ) && markers.includes(
      `e2e-explorer-capture-stage-readback-succeeded-${captureRequest.captureId}`,
    ), 'accepted/error markers or pending marker lifecycle changed');
  });

  await test('release builds reject evidence campaign and acknowledgement routes', async () => {
    __resetExplorerPhysicalEvidenceDevBridgeForTest();
    expect(await startExplorerPhysicalEvidenceCampaign({
      campaignId: CAMPAIGN_ID,
      integratedRepositorySha: REPOSITORY_SHA,
      e2eMetroUrl: 'http://127.0.0.1:8082',
      isDev: false,
    }) === false, 'release campaign route was accepted');
    expect(await acknowledgeExplorerPhysicalEvidence(
      request().captureId,
      'smoke-physical-evidence/physical-evidence-receipt-explorer-capture-' +
        `${'0'.repeat(64)}.json`,
      '0'.repeat(64),
      false,
    ) === false, 'release acknowledgement route was accepted');
    try {
      await requestExplorerPhysicalEvidence(request());
    } catch (error) {
      expect(error instanceof ExplorerPhysicalEvidenceError &&
        error.reasonCode === EXPLORER_PHYSICAL_EVIDENCE_FAILURE.RELEASE_BUILD,
      'release capture request had the wrong failure');
      return;
    }
    throw new Error('release capture request was accepted');
  });

  console.log(`\nExplorer physical evidence: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void main();
