import type { DevE2EKeyValueStorage } from '../dev/e2e/devE2ECheckpoint';
import {
  EXPLORER_HIERARCHY_FORMAT,
  EXPLORER_PHYSICAL_EVIDENCE_FAILURE,
  EXPLORER_PHYSICAL_EVIDENCE_STORAGE_KEY,
  ExplorerPhysicalEvidenceBridge,
  ExplorerPhysicalEvidenceError,
  createExplorerPhysicalCaptureRequest,
  explorerCaptureRelativePaths,
  parseExplorerPhysicalCaptureRequest,
  parseExplorerPhysicalEvidenceReceipt,
  validateExplorerPhysicalEvidenceReceipt,
  type ExplorerPhysicalCaptureRequestV1,
  type ExplorerPhysicalEvidenceReceiptV1,
} from '../dev/e2e/explorerPhysicalEvidence';
import {
  __resetExplorerPhysicalEvidenceDevBridgeForTest,
  acknowledgeExplorerPhysicalEvidence,
  startExplorerPhysicalEvidenceCampaign,
} from '../dev/e2e/explorerPhysicalEvidenceDevBridge';
import { sha256Hex } from '../utils/semanticFingerprintV2';
import {
  __resetDevE2EStateForTest,
  devE2EMarkers,
  getDevE2EStateSnapshot,
  setDevE2EExplorerCaptureAccepted,
  setDevE2EExplorerCaptureError,
  setDevE2EExplorerCaptureRequest,
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
      sha256: sha256Hex(`screenshot:${captureRequest.captureId}`),
      byteSize: 100,
      mediaType: 'image/png',
    },
    hierarchy: {
      relativeReference: captureRequest.requestedHierarchyRelativePath,
      sha256: sha256Hex(`hierarchy:${captureRequest.captureId}`),
      byteSize: 200,
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

  await test('trace, control, observation and reload mismatches fail closed', () => {
    const captureRequest = request();
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.TRACE_MISMATCH, () =>
      validate(captureRequest, receipt(captureRequest, { traceId: 'trace-wrong' })));
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.CONTROL_MISMATCH, () =>
      validate(captureRequest, receipt(captureRequest, { controlId: 'control-wrong' })));
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.OBSERVATION_MISMATCH, () =>
      validate(captureRequest, receipt(captureRequest, {
        observationId: 'observation-wrong',
      })));
    expectCode(EXPLORER_PHYSICAL_EVIDENCE_FAILURE.RELOAD_COUNT_MISMATCH, () =>
      validate(captureRequest, receipt(captureRequest, { reloadCount: 1 })));
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
    const captureRequest = request();
    const accepted = receipt(captureRequest);
    const events: string[] = [];
    const bridge = new ExplorerPhysicalEvidenceBridge({
      storage,
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

  await test('one receipt cannot satisfy another pending capture', async () => {
    const storage = new MemoryStorage();
    const first = request();
    const second = request({ stepId: 'second-action', stepOrdinal: 2, reloadCount: 1 });
    const bridge = new ExplorerPhysicalEvidenceBridge({
      storage,
      integratedRepositorySha: REPOSITORY_SHA,
      currentClockFingerprint: () => CLOCK,
      markers: { request: () => {}, accepted: () => {}, error: () => {} },
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
    const pending = request();
    const acceptedRequest = request({ phase: 'after-reload' });
    const first = new ExplorerPhysicalEvidenceBridge({
      storage,
      integratedRepositorySha: REPOSITORY_SHA,
      currentClockFingerprint: () => CLOCK,
      markers: { request: () => {}, accepted: () => {}, error: () => {} },
    });
    await first.requestCapture(pending);
    await first.requestCapture(acceptedRequest);
    await first.acknowledge(acceptedRequest.captureId, receipt(acceptedRequest));
    const restored: string[] = [];
    const cold = new ExplorerPhysicalEvidenceBridge({
      storage,
      integratedRepositorySha: REPOSITORY_SHA,
      currentClockFingerprint: () => CLOCK,
      markers: {
        request: (captureId) => restored.push(`request:${captureId}`),
        accepted: (captureId) => restored.push(`accepted:${captureId}`),
        error: () => {},
      },
    });
    await cold.restore();
    expect(restored.includes(`request:${pending.captureId}`) &&
      restored.includes(`accepted:${acceptedRequest.captureId}`),
    'cold restore omitted evidence state');
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
  });

  await test('request, accepted and fail-closed error markers are exact', () => {
    __resetDevE2EStateForTest();
    const captureRequest = request();
    setDevE2EExplorerCaptureRequest(captureRequest.captureId, '%7B%7D');
    expect(devE2EMarkers(getDevE2EStateSnapshot()).includes(
      `e2e-explorer-capture-request-${captureRequest.captureId}`,
    ), 'capture request marker missing');
    setDevE2EExplorerCaptureAccepted(captureRequest.captureId);
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
    ), 'accepted/error markers or pending marker lifecycle changed');
  });

  await test('release builds reject evidence campaign and acknowledgement routes', async () => {
    __resetExplorerPhysicalEvidenceDevBridgeForTest();
    expect(await startExplorerPhysicalEvidenceCampaign({
      campaignId: CAMPAIGN_ID,
      integratedRepositorySha: REPOSITORY_SHA,
      isDev: false,
    }) === false, 'release campaign route was accepted');
    expect(await acknowledgeExplorerPhysicalEvidence(
      request().captureId,
      encodeURIComponent(JSON.stringify(receipt(request()))),
      false,
    ) === false, 'release acknowledgement route was accepted');
  });

  console.log(`\nExplorer physical evidence: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void main();
