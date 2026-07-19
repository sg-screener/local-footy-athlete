import fs from 'fs';
import path from 'path';
import {
  EXPLORER_ACTIVE_TIME_BUDGET_FAILURE,
  EXPLORER_SCENARIO_ACTIVE_TIME_BUDGET_STORAGE_KEY,
  ExplorerScenarioActiveTimeBudget,
  ExplorerScenarioActiveTimeBudgetError,
  withExplorerExternalStageDeadline,
  type ExplorerActiveTimePauseToken,
} from '../dev/e2e/explorerScenarioActiveTimeBudget';
import {
  ExplorerActionIngressGate,
  createExplorerActionIngressRequest,
  explorerCanonicalTargetIds,
} from '../dev/e2e/explorerActionIngress';
import type { ExplorerExecutableAction } from '../dev/e2e/explorerActionBridge';
import { explorerActionSemanticHash } from
  '../dev/e2e/explorerScenarioContractValidation';
import { EXPLORER_NON_COACH_SMOKE_MANIFESTS } from
  '../dev/e2e/explorerSmokeScenarioManifests';
import {
  __resetDevE2EStateForTest,
  devE2EMarkers,
  getDevE2EStateSnapshot,
} from '../dev/e2e/devE2EState';

(globalThis as { __DEV__?: boolean }).__DEV__ = true;

interface RegisteredTest {
  readonly name: string;
  readonly run: () => void | Promise<void>;
}

const tests: RegisteredTest[] = [];

function test(name: string, run: () => void | Promise<void>): void {
  tests.push({ name, run });
}

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function expectFailure(
  operation: () => void | Promise<void>,
  reasonCode: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    expect(error instanceof ExplorerScenarioActiveTimeBudgetError &&
      error.reasonCode === reasonCode, `wrong failure: ${String(error)}`);
    return;
  }
  throw new Error(`expected failure: ${reasonCode}`);
}

class MemoryStorage {
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

function ingressRequest() {
  return createExplorerActionIngressRequest({
    campaignId: 'campaign-one',
    scenarioId: 'smoke-whole-session-deletion',
    stepId: 'delete-whole-session',
    actionSemanticHash: explorerActionSemanticHash(ACTION),
    expectedControlId: 'session-delete-action-session-one',
    expectedCanonicalTargetIds: explorerCanonicalTargetIds(ACTION),
    expectedAcceptedRevision: 5,
    priorActionTraceId: null,
    deterministicClockFingerprint: 'clock-one',
  });
}

function owner(now: { value: number }, storage?: MemoryStorage) {
  return new ExplorerScenarioActiveTimeBudget(() => now.value, storage ?? null);
}

test('45-second acknowledgement wait excludes the 30-second active budget', async () => {
  const now = { value: 0 };
  const budget = owner(now);
  budget.start('scenario-one', 30_000);
  await budget.runExternal(
    'physical_evidence_acknowledgement',
    'capture-one',
    async () => { now.value = 45_000; },
  );
  expect(budget.remaining() === 30_000, 'external acknowledgement consumed budget');
});

test('pending ingress and awaiting marker publish after external acknowledgement', async () => {
  __resetDevE2EStateForTest();
  const now = { value: 0 };
  const budget = owner(now);
  const gate = new ExplorerActionIngressGate(new MemoryStorage());
  const request = ingressRequest();
  budget.start(request.scenarioId, 30_000);
  await budget.runExternal(
    'physical_evidence_acknowledgement',
    'capture-seed',
    async () => { now.value = 45_000; },
  );
  await gate.open(request);
  expect(gate.readActiveRequest()?.requestId === request.requestId,
    'pending ingress was not durable after acknowledgement');
  expect(devE2EMarkers(getDevE2EStateSnapshot()).includes(
    `e2e-explorer-action-awaiting-${request.scenarioId}-${request.stepId}`,
  ), 'awaiting marker did not publish after durable ingress');
});

test('31 seconds of active work expires a 30-second budget', async () => {
  const now = { value: 0 };
  const budget = owner(now);
  budget.start('scenario-one', 30_000);
  now.value = 31_000;
  await expectFailure(
    () => budget.assert(),
    EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.EXPIRED,
  );
});

test('external acknowledgement retains its own stage deadline', async () => {
  await expectFailure(
    () => withExplorerExternalStageDeadline(
      'physical_evidence_acknowledgement',
      async () => await new Promise<never>(() => {}),
      {
        timeoutMs: 1,
        setTimer: (callback) => {
          callback();
          return 1 as unknown as ReturnType<typeof setTimeout>;
        },
        clearTimer: () => {},
      },
    ),
    EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.EXTERNAL_STAGE_DEADLINE,
  );
});

test('external UI ingress waiting excludes active time', async () => {
  const now = { value: 2_000 };
  const budget = owner(now);
  budget.start('scenario-one', 30_000);
  await budget.runExternal('external_action_ingress', 'request-one', async () => {
    now.value = 92_000;
  });
  expect(budget.remaining() === 30_000, 'UI ingress wait consumed active time');
});

test('production after a valid external claim consumes active time', async () => {
  const now = { value: 0 };
  const budget = owner(now);
  budget.start('scenario-one', 30_000);
  const token = budget.pause('external_action_ingress', 'request-one');
  now.value = 45_000;
  budget.resume(token);
  now.value = 76_000;
  await expectFailure(
    () => budget.assert(),
    EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.EXPIRED,
  );
});

test('render-observation waiting excludes active time', async () => {
  const now = { value: 1_000 };
  const budget = owner(now);
  budget.start('scenario-one', 30_000);
  await budget.runExternal('rendered_observation', 'trace-one', async () => {
    now.value = 61_000;
  });
  expect(budget.remaining() === 30_000, 'render wait consumed active time');
});

test('physical-evidence receipt waiting excludes active time', async () => {
  const now = { value: 1_000 };
  const budget = owner(now);
  budget.start('scenario-one', 30_000);
  await budget.runExternal('physical_evidence_capture', 'capture-two', async () => {
    now.value = 91_000;
  });
  expect(budget.remaining() === 30_000, 'physical receipt wait consumed active time');
});

test('nested pause ownership never double-credits wall time', () => {
  const now = { value: 0 };
  const budget = owner(now);
  budget.start('scenario-one', 30_000);
  now.value = 5_000;
  const outer = budget.pause('reload_receipt', 'reload-one');
  now.value = 15_000;
  const inner = budget.pause('physical_evidence_capture', 'capture-three');
  now.value = 45_000;
  budget.resume(outer);
  now.value = 75_000;
  budget.resume(inner);
  expect(budget.remaining() === 25_000, 'nested pauses double-subtracted time');
});

test('identical duplicate completion is idempotent', () => {
  const now = { value: 0 };
  const budget = owner(now);
  budget.start('scenario-one', 30_000);
  const token = budget.pause('external_action_ingress', 'request-one');
  expect(budget.resume(token), 'first completion did not resume');
  expect(!budget.resume(token), 'identical duplicate completion was not idempotent');
});

test('competing or mismatched resume fails closed', async () => {
  const now = { value: 0 };
  const budget = owner(now);
  budget.start('scenario-one', 30_000);
  const token = budget.pause('external_action_ingress', 'request-one');
  const mismatch: ExplorerActiveTimePauseToken = {
    ...token,
    scope: 'competing-request',
  };
  await expectFailure(
    () => budget.resume(mismatch),
    EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.TOKEN_MISMATCH,
  );
});

test('try/finally resumes accounting after external dependency failure', async () => {
  const now = { value: 0 };
  const budget = owner(now);
  budget.start('scenario-one', 30_000);
  try {
    await budget.runExternal('rendered_observation', 'trace-one', async () => {
      now.value = 45_000;
      throw new Error('render_dependency_failed');
    });
  } catch {
    // Expected dependency failure; accounting must already be active again.
  }
  now.value = 50_000;
  expect(budget.remaining() === 25_000, 'try/finally left accounting paused');
});

test('cold reload restores paused state without charging offline wall time', async () => {
  const storage = new MemoryStorage();
  const now = { value: 0 };
  const first = owner(now, storage);
  first.start('scenario-one', 30_000);
  now.value = 5_000;
  const token = first.pause('external_action_ingress', 'request-one');
  await first.flush();
  now.value = 125_000;
  const restored = owner(now, storage);
  const snapshot = await restored.restore();
  expect(snapshot?.status === 'paused' && restored.remaining() === 25_000,
    'offline wall time entered restored active elapsed time');
  restored.resume(token);
  now.value = 130_000;
  expect(restored.remaining() === 20_000, 'restored owner did not resume exactly');
});

test('scenario reset clears budget and all pause state durably', async () => {
  const storage = new MemoryStorage();
  const now = { value: 0 };
  const budget = owner(now, storage);
  budget.start('scenario-one', 30_000);
  budget.pause('external_action_ingress', 'request-one');
  budget.resetScenario('scenario-one');
  await budget.flush();
  expect(budget.snapshot() === null, 'scenario reset retained in-memory state');
  expect(!storage.values.has(EXPLORER_SCENARIO_ACTIVE_TIME_BUDGET_STORAGE_KEY),
    'scenario reset retained durable state');
});

test('stale pause token cannot resume a new scenario generation', async () => {
  const now = { value: 0 };
  const budget = owner(now);
  budget.start('scenario-one', 30_000);
  const stale = budget.pause('external_action_ingress', 'request-one');
  budget.resetScenario();
  budget.start('scenario-two', 30_000);
  await expectFailure(
    () => budget.resume(stale),
    EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.STALE_TOKEN,
  );
});

test('no mutation occurs before external action ingress claim', async () => {
  const gate = new ExplorerActionIngressGate(new MemoryStorage());
  let mutations = 0;
  const request = ingressRequest();
  await gate.open(request);
  expect(mutations === 0 && gate.readActiveRequest()?.requestId === request.requestId,
    'opening ingress executed a mutation');
  gate.claimAndStart({
    campaignId: request.campaignId,
    scenarioId: request.scenarioId,
    stepId: request.stepId,
    actionSemanticHash: request.actionSemanticHash,
    controlId: request.expectedControlId,
    canonicalTargetIds: request.expectedCanonicalTargetIds,
    acceptedRevision: request.expectedAcceptedRevision,
  }, () => { mutations += 1; });
  expect(mutations === 1, 'valid claim did not start exactly one owner');
});

test('awaiting marker exists before canonical owner can create a TraceV2 root', async () => {
  __resetDevE2EStateForTest();
  const gate = new ExplorerActionIngressGate(new MemoryStorage());
  const request = ingressRequest();
  let awaitingObservedByOwner = false;
  await gate.open(request);
  gate.claimAndStart({
    campaignId: request.campaignId,
    scenarioId: request.scenarioId,
    stepId: request.stepId,
    actionSemanticHash: request.actionSemanticHash,
    controlId: request.expectedControlId,
    canonicalTargetIds: request.expectedCanonicalTargetIds,
    acceptedRevision: request.expectedAcceptedRevision,
  }, () => {
    awaitingObservedByOwner = devE2EMarkers(getDevE2EStateSnapshot()).includes(
      `e2e-explorer-action-awaiting-${request.scenarioId}-${request.stepId}`,
    );
  });
  expect(awaitingObservedByOwner, 'canonical owner ran before awaiting publication');
});

test('synthetic direct adapter retains deterministic injected-time behavior', async () => {
  const now = { value: 10 };
  const budget = owner(now);
  budget.start('synthetic-scenario', 30_000);
  now.value += 4_000;
  await budget.runExternal('rendered_observation', 'synthetic-trace', async () => {
    now.value += 45_000;
  });
  now.value += 6_000;
  expect(budget.remaining() === 20_000,
    'synthetic deterministic clock lost active-only semantics');
});

test('release surface exposes no budget diagnostic or ingress route', () => {
  const root = path.resolve(__dirname, '..', '..');
  const app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
  const routes = fs.readFileSync(
    path.join(root, 'src/dev/e2e/devE2EEntryRoute.ts'),
    'utf8',
  );
  const source = fs.readFileSync(
    path.join(root, 'src/dev/e2e/explorerScenarioActiveTimeBudget.ts'),
    'utf8',
  );
  expect(!routes.includes('active-time-budget') && !routes.includes('budget_diagnostic'),
    'budget diagnostic route became public');
  expect(app.indexOf("require('./src/dev/e2e/devE2EEntry')") >
    app.indexOf('if (__DEV__)'), 'budget owner escaped the development entry guard');
  expect(source.includes("if (!available())"), 'live budget lacks release guard');
});

test('manifest budget semantics remain 30 seconds per active smoke step', () => {
  expect(EXPLORER_NON_COACH_SMOKE_MANIFESTS.every((manifest) =>
    manifest.budgetMs === 30_000 * manifest.steps.length),
  'manifest budget values or per-step active semantics changed');
});

void (async () => {
  let passed = 0;
  let failed = 0;
  console.log('\n-- Explorer Scenario Active-Time Budget --');
  for (const candidate of tests) {
    try {
      await candidate.run();
      passed += 1;
      console.log(`  ✓ ${candidate.name}`);
    } catch (error) {
      failed += 1;
      console.error(`  ✗ ${candidate.name}`, error);
    }
  }
  console.log(`\nExplorer active-time budget: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
})();
