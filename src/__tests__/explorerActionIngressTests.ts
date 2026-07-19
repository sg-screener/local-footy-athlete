import {
  EXPLORER_ACTION_INGRESS_FAILURE,
  EXPLORER_ACTION_INGRESS_STORAGE_KEY,
  ExplorerActionIngressError,
  ExplorerActionIngressGate,
  createExplorerActionIngressRequest,
  explorerCanonicalTargetIds,
  type ExplorerActionIngressClaimInput,
  type ExplorerActionIngressStorage,
} from '../dev/e2e/explorerActionIngress';
import {
  EXPLORER_PRODUCTION_OWNER_BY_ACTION,
  type ExplorerExecutableAction,
  type ExplorerProductionActionReceipt,
} from '../dev/e2e/explorerActionBridge';
import {
  __resetDevE2EStateForTest,
  devE2EMarkers,
  getDevE2EStateSnapshot,
} from '../dev/e2e/devE2EState';
import { explorerActionSemanticHash } from
  '../dev/e2e/explorerScenarioContractValidation';

(globalThis as { __DEV__?: boolean }).__DEV__ = true;

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

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

class MemoryStorage implements ExplorerActionIngressStorage {
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

const ACTION: ExplorerExecutableAction = {
  type: 'session.delete',
  target: { kind: 'session', sessionId: 'session-one' },
  args: { date: '2026-07-13' },
};
const HASH = explorerActionSemanticHash(ACTION);

function request(revision = 7) {
  return createExplorerActionIngressRequest({
    campaignId: 'campaign-one',
    scenarioId: 'smoke-whole-session-deletion',
    stepId: 'delete-whole-session',
    actionSemanticHash: HASH,
    expectedControlId: 'session-delete-action-session-one',
    expectedCanonicalTargetIds: explorerCanonicalTargetIds(ACTION),
    expectedAcceptedRevision: revision,
    priorActionTraceId: 'prior-trace-one',
    deterministicClockFingerprint: 'clock-one',
  });
}

function claimInput(overrides: Partial<ExplorerActionIngressClaimInput> = {}):
ExplorerActionIngressClaimInput {
  return {
    campaignId: 'campaign-one',
    scenarioId: 'smoke-whole-session-deletion',
    stepId: 'delete-whole-session',
    actionSemanticHash: HASH,
    controlId: 'session-delete-action-session-one',
    canonicalTargetIds: ['session-one'],
    acceptedRevision: 7,
    ...overrides,
  };
}

function productionReceipt(overrides: Partial<ExplorerProductionActionReceipt> = {}):
ExplorerProductionActionReceipt {
  return {
    protocolVersion: 1,
    actionType: ACTION.type,
    actionSemanticHash: HASH,
    target: ACTION.target,
    status: 'applied',
    owner: EXPLORER_PRODUCTION_OWNER_BY_ACTION[ACTION.type],
    receiptId: 'receipt-one',
    traceV2RootId: 'trace-one',
    acceptedRevisionBefore: 7,
    acceptedRevisionAfter: 8,
    reasonCode: null,
    durable: true,
    productionReceipt: { transactionId: 'transaction-one' },
    ...overrides,
  } as ExplorerProductionActionReceipt;
}

async function expectFailure(
  expected: string,
  run: () => void | Promise<void>,
): Promise<void> {
  try {
    await run();
    throw new Error(`expected ${expected}`);
  } catch (error) {
    if (!(error instanceof ExplorerActionIngressError)) throw error;
    expect(error.reasonCode === expected,
      `expected ${expected}, received ${error.reasonCode}`);
  }
}

async function main(): Promise<void> {
  console.log('\n-- Explicit Explorer Action Ingress Gate --');

  await test('evidence acceptance can publish eligibility and awaiting without mutation', async () => {
    __resetDevE2EStateForTest();
    const gate = new ExplorerActionIngressGate(new MemoryStorage());
    let ownerCalls = 0;
    await gate.open(request());
    const markers = devE2EMarkers(getDevE2EStateSnapshot());
    expect(markers.includes(
      'e2e-explorer-action-awaiting-smoke-whole-session-deletion-delete-whole-session',
    ), 'awaiting marker missing');
    expect(ownerCalls === 0, 'opening the gate invoked a production owner');
  });

  await test('valid UI claim starts exactly one action and preserves prior trace', async () => {
    __resetDevE2EStateForTest();
    const gate = new ExplorerActionIngressGate(new MemoryStorage());
    await gate.open(request());
    let ownerCalls = 0;
    const first = gate.claimAndStart(claimInput(), () => {
      const markers = devE2EMarkers(getDevE2EStateSnapshot());
      expect(markers.includes(
        'e2e-explorer-action-awaiting-smoke-whole-session-deletion-delete-whole-session',
      ), 'owner started before awaiting marker');
      expect(markers.includes(
        'e2e-explorer-action-claimed-smoke-whole-session-deletion-delete-whole-session',
      ), 'owner started before claimed marker');
      ownerCalls += 1;
    });
    const duplicate = gate.claimAndStart(claimInput(), () => { ownerCalls += 1; });
    expect(first.claimId === duplicate.claimId, 'identical claim was not idempotent');
    expect(first.priorActionTraceId === 'prior-trace-one', 'prior trace linkage changed');
    expect(ownerCalls === 1, `owner started ${ownerCalls} times`);
  });

  await test('wrong control cannot consume the request', async () => {
    const gate = new ExplorerActionIngressGate(new MemoryStorage());
    await gate.open(request());
    await expectFailure(EXPLORER_ACTION_INGRESS_FAILURE.WRONG_CONTROL, () =>
      gate.claim(claimInput({ controlId: 'wrong-control' })));
    expect(gate.readStateForTest()?.status === 'pending', 'wrong control consumed request');
    expect(devE2EMarkers(getDevE2EStateSnapshot()).includes(
      'e2e-explorer-action-error-wrong_control',
    ), 'typed action error marker missing');
  });

  await test('wrong canonical target cannot consume the request', async () => {
    const gate = new ExplorerActionIngressGate(new MemoryStorage());
    await gate.open(request());
    await expectFailure(EXPLORER_ACTION_INGRESS_FAILURE.WRONG_TARGET, () =>
      gate.claim(claimInput({ canonicalTargetIds: ['session-two'] })));
    expect(gate.readStateForTest()?.status === 'pending', 'wrong target consumed request');
  });

  await test('wrong scenario or step cannot consume the request', async () => {
    const gate = new ExplorerActionIngressGate(new MemoryStorage());
    await gate.open(request());
    await expectFailure(EXPLORER_ACTION_INGRESS_FAILURE.WRONG_SCENARIO_STEP, () =>
      gate.claim(claimInput({ stepId: 'another-step' })));
  });

  await test('wrong campaign or action hash cannot consume the request', async () => {
    const wrongCampaign = new ExplorerActionIngressGate(new MemoryStorage());
    await wrongCampaign.open(request());
    await expectFailure(EXPLORER_ACTION_INGRESS_FAILURE.WRONG_CAMPAIGN, () =>
      wrongCampaign.claim(claimInput({ campaignId: 'another-campaign' })));
    const wrongAction = new ExplorerActionIngressGate(new MemoryStorage());
    await wrongAction.open(request());
    await expectFailure(EXPLORER_ACTION_INGRESS_FAILURE.WRONG_ACTION, () =>
      wrongAction.claim(claimInput({
        actionSemanticHash: 'sha256:wrong' as typeof HASH,
      })));
  });

  await test('accepted revision drift rejects a stale claim', async () => {
    const gate = new ExplorerActionIngressGate(new MemoryStorage());
    await gate.open(request());
    await expectFailure(EXPLORER_ACTION_INGRESS_FAILURE.ACCEPTED_REVISION_DRIFT, () =>
      gate.claim(claimInput({ acceptedRevision: 8 })));
  });

  await test('competing duplicate claim fails closed', async () => {
    const gate = new ExplorerActionIngressGate(new MemoryStorage());
    await gate.open(request());
    gate.claim(claimInput());
    await expectFailure(EXPLORER_ACTION_INGRESS_FAILURE.DUPLICATE_COMPETING_CLAIM, () =>
      gate.claim(claimInput({ controlId: 'competing-control' })));
  });

  await test('unclaimed and wrong production receipts are rejected', async () => {
    const unclaimed = new ExplorerActionIngressGate(new MemoryStorage());
    await unclaimed.open(request());
    await expectFailure(EXPLORER_ACTION_INGRESS_FAILURE.UNCLAIMED_PRODUCTION_RECEIPT,
      () => unclaimed.registerProductionReceipt(productionReceipt()));

    const wrong = new ExplorerActionIngressGate(new MemoryStorage());
    await wrong.open(request());
    const claim = wrong.claim(claimInput());
    wrong.registerTrace(claim.claimId, 'trace-one');
    await expectFailure(EXPLORER_ACTION_INGRESS_FAILURE.WRONG_PRODUCTION_RECEIPT,
      () => wrong.registerProductionReceipt(productionReceipt({
        actionSemanticHash: 'sha256:another-action' as typeof HASH,
      })));
  });

  await test('receipt resolution is by the exact claimed trace identity', async () => {
    const gate = new ExplorerActionIngressGate(new MemoryStorage());
    const pending = request();
    await gate.open(pending);
    const waiting = gate.waitForReceipt(pending);
    const claim = gate.claim(claimInput());
    gate.registerTrace(claim.claimId, 'trace-one');
    await gate.registerProductionReceipt(productionReceipt());
    const correlated = await waiting;
    expect(correlated.productionReceipt.traceV2RootId === 'trace-one',
      'waiter resolved a non-correlated receipt');
    expect(devE2EMarkers(getDevE2EStateSnapshot()).includes(
      'e2e-explorer-action-receipt-smoke-whole-session-deletion-delete-whole-session',
    ), 'typed production receipt marker missing');
  });

  await test('competing trace registration and non-durable owner receipt fail closed', async () => {
    const traceGate = new ExplorerActionIngressGate(new MemoryStorage());
    await traceGate.open(request());
    const traceClaim = traceGate.claim(claimInput());
    traceGate.registerTrace(traceClaim.claimId, 'trace-one');
    await expectFailure(EXPLORER_ACTION_INGRESS_FAILURE.TRACE_IDENTITY_MISMATCH,
      () => traceGate.registerTrace(traceClaim.claimId, 'trace-two'));

    const durableGate = new ExplorerActionIngressGate(new MemoryStorage());
    await durableGate.open(request());
    const durableClaim = durableGate.claim(claimInput());
    durableGate.registerTrace(durableClaim.claimId, 'trace-one');
    await expectFailure(EXPLORER_ACTION_INGRESS_FAILURE.NON_DURABLE_PRODUCTION_RECEIPT,
      () => durableGate.registerProductionReceipt(productionReceipt({ durable: false })));
  });

  await test('cold reload restores waiting state without owner execution', async () => {
    __resetDevE2EStateForTest();
    const storage = new MemoryStorage();
    const first = new ExplorerActionIngressGate(storage);
    await first.open(request());
    let ownerCalls = 0;
    const reloaded = new ExplorerActionIngressGate(storage);
    const restored = await reloaded.restore();
    expect(restored?.status === 'pending', 'eligible pending request was not restored');
    expect(ownerCalls === 0, 'restore invoked a production owner');
    expect(storage.values.has(EXPLORER_ACTION_INGRESS_STORAGE_KEY),
      'restored request was not durable');
  });

  await test('scenario reset clears stale ingress state', async () => {
    const storage = new MemoryStorage();
    const gate = new ExplorerActionIngressGate(storage);
    await gate.open(request());
    await gate.clear();
    expect(gate.readStateForTest() === null, 'reset retained ingress state');
    expect(!storage.values.has(EXPLORER_ACTION_INGRESS_STORAGE_KEY),
      'reset retained durable ingress state');
  });

  console.log(`\nExplorer action ingress: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void main();
