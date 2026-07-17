import {
  EXPLORER_SHRINK_MAX_REPRESENTED_DURATION_MS,
  beginExplorerChainShrink,
  consumeExplorerShrinkReplayReceipts,
  createExplorerShrinkBudgetReceipt,
  proposeExplorerShrinkCandidate,
  type ExplorerShrinkCandidate,
  type ExplorerShrinkReplayReceipt,
  type ExplorerShrinkSession,
} from '../dev/e2e/explorerChainShrinker';
import {
  buildExplorerFailureClusterSignature,
  sameExplorerFailureClusterSignature,
  type ExplorerFailureClusterComponents,
  type ExplorerFailureClusterSignature,
} from '../dev/e2e/explorerFailureClusterSignature';
import {
  deriveExplorerChainEligibilityBaseline,
  generateExplorerSeededChainManifests,
  isExplorerChainEligible,
} from '../dev/e2e/explorerSeededChainGenerator';
import type { ExplorerScenarioContract } from '../dev/e2e/explorerScenarioContracts';
import { explorerScenarioSemanticHash } from '../dev/e2e/explorerScenarioContractValidation';

let passed = 0;
let failed = 0;

function test(name: string, run: () => void): void {
  try {
    run();
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

function equal(actual: unknown, expected: unknown, message: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nexpected=${expectedJson}\nactual=${actualJson}`);
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child));
  }
  return value;
}

function signatureFor(
  scenario: ExplorerScenarioContract,
  stepIndex: number,
  overrides: Partial<ExplorerFailureClusterComponents> = {},
): ExplorerFailureClusterSignature {
  const step = scenario.steps[stepIndex];
  return buildExplorerFailureClusterSignature({
    oracleId: `${step.stepId}-render`,
    primaryFailureCode: 'visible-projection-mismatch',
    actionKind: step.action.type,
    productionSurface: step.ingress,
    firstDivergentProjection: '/program/weeks/0',
    firstFailingStepId: step.stepId,
    ...overrides,
  });
}

function receipts(
  candidate: ExplorerShrinkCandidate,
  signature: ExplorerFailureClusterSignature | null,
  options: { readonly eligible?: boolean; readonly reproduced?: boolean } = {},
): readonly [ExplorerShrinkReplayReceipt, ExplorerShrinkReplayReceipt] {
  const shared = {
    candidateSemanticHash: candidate.scenarioSemanticHash,
    eligible: options.eligible ?? true,
    reproduced: options.reproduced ?? true,
    failureSignature: signature,
  };
  return [
    { ...shared, replayId: `replay-${candidate.attempt}-a`, reproductionOrdinal: 1 },
    { ...shared, replayId: `replay-${candidate.attempt}-b`, reproductionOrdinal: 2 },
  ];
}

function propose(
  session: ExplorerShrinkSession,
  elapsed = session.attemptCount,
): { session: ExplorerShrinkSession; candidate: ExplorerShrinkCandidate } {
  const proposal = proposeExplorerShrinkCandidate(
    session,
    createExplorerShrinkBudgetReceipt(`budget-${elapsed}`, elapsed),
  );
  if (!proposal.candidate) {
    throw new Error(`Expected shrink candidate, stopped=${proposal.session.stopReason}`);
  }
  return { session: proposal.session, candidate: proposal.candidate };
}

console.log('\n-- Explorer chain shrinker and failure clustering --');

const original = generateExplorerSeededChainManifests(0x51a7).chains[0].scenario;

test('failure clustering uses exactly the six typed components and no reply wording', () => {
  const components: ExplorerFailureClusterComponents = {
    oracleId: 'oracle-primary',
    primaryFailureCode: 'visible-projection-mismatch',
    actionKind: 'session.move',
    productionSurface: 'session-editor',
    firstDivergentProjection: '/program/weeks/0',
    firstFailingStepId: 'step-primary',
  };
  const first = buildExplorerFailureClusterSignature({
    ...components,
    replyWording: 'Changed it for you.',
  } as ExplorerFailureClusterComponents);
  const second = buildExplorerFailureClusterSignature({
    ...components,
    replyWording: 'Completely different words.',
  } as ExplorerFailureClusterComponents);
  expect(sameExplorerFailureClusterSignature(first, second),
    'reply wording changed the failure cluster');
  expect(!sameExplorerFailureClusterSignature(first,
    buildExplorerFailureClusterSignature({
      ...components,
      firstFailingStepId: 'another-step',
    })), 'first failing step did not affect clustering');
  equal(Object.keys(first.components), [
    'oracleId',
    'primaryFailureCode',
    'actionKind',
    'productionSurface',
    'firstDivergentProjection',
    'firstFailingStepId',
  ], 'failure signature contains unexpected semantic components');
});

test('valid shrink acceptance requires two same-cluster deterministic reproductions', () => {
  const signature = signatureFor(original, 7);
  let session = beginExplorerChainShrink(original, signature);
  const proposal = propose(session);
  session = proposal.session;
  const mismatch = signatureFor(original, 7, { primaryFailureCode: 'reload-loss' });
  const rejected = consumeExplorerShrinkReplayReceipts(
    session,
    [receipts(proposal.candidate, signature)[0], receipts(proposal.candidate, mismatch)[1]],
  );
  expect(rejected.lineage[0].result === 'rejected',
    'mismatched failure signatures retained a candidate');
  expect(explorerScenarioSemanticHash(rejected.currentScenario) ===
    explorerScenarioSemanticHash(original), 'rejected candidate changed the chain');
});

test('shrinker removes a noncausal suffix while preserving seed and signature', () => {
  const signature = signatureFor(original, 7);
  const started = beginExplorerChainShrink(original, signature);
  const proposal = propose(started);
  expect(proposal.candidate.strategy === 'suffix-removal', 'suffix removal was not first');
  expect(proposal.candidate.scenario.steps.length === 8,
    'suffix candidate did not stop at the first failing step');
  expect(proposal.candidate.scenario.campaignSeed === original.campaignSeed,
    'suffix candidate changed campaign seed');
  expect(proposal.candidate.scenario.seedId === original.seedId,
    'suffix candidate changed seed identity');
  const retained = consumeExplorerShrinkReplayReceipts(
    proposal.session,
    receipts(proposal.candidate, signature),
  );
  expect(retained.currentScenario.steps.length === 8, 'valid suffix shrink was not retained');
  expect(retained.lineage[0].result === 'retained', 'suffix lineage is not retained');
});

test('shrinker removes eligible noncausal interior actions', () => {
  const signature = signatureFor(original, 11);
  let session = beginExplorerChainShrink(original, signature);
  const proposal = propose(session);
  session = proposal.session;
  expect(proposal.candidate.strategy === 'interior-removal',
    `expected interior removal, received ${proposal.candidate.strategy}`);
  expect(proposal.candidate.scenario.steps.length === original.steps.length - 1,
    'interior candidate did not remove one action');
  const baseline = deriveExplorerChainEligibilityBaseline(original);
  expect(isExplorerChainEligible(proposal.candidate.scenario, baseline),
    'shrinker emitted an ineligible interior candidate');
  session = consumeExplorerShrinkReplayReceipts(
    session,
    receipts(proposal.candidate, signature),
  );
  expect(session.currentScenario.steps.length === original.steps.length - 1,
    'eligible interior removal was not retained');
});

test('shrinker simplifies payloads after structural candidates are rejected', () => {
  const signature = signatureFor(original, 11);
  let session = beginExplorerChainShrink(original, signature);
  let payload: ExplorerShrinkCandidate | null = null;
  for (let guard = 0; guard < 30 && payload === null; guard += 1) {
    const proposal = propose(session, guard);
    session = proposal.session;
    if (proposal.candidate.strategy === 'payload-simplification') {
      payload = proposal.candidate;
      break;
    }
    session = consumeExplorerShrinkReplayReceipts(
      session,
      receipts(proposal.candidate, null, { reproduced: false }),
    );
  }
  expect(payload !== null, 'no payload simplification candidate was produced');
  const payloadCandidate = payload as ExplorerShrinkCandidate;
  expect(payloadCandidate.scenario.steps.length === original.steps.length,
    'payload simplification changed chain length');
  const changed = payloadCandidate.scenario.steps.some((step, index) =>
    JSON.stringify(step.action.args) !== JSON.stringify(original.steps[index].action.args));
  expect(changed, 'payload simplification did not change a payload');
  const baseline = deriveExplorerChainEligibilityBaseline(original);
  expect(isExplorerChainEligible(payloadCandidate.scenario, baseline),
    'payload simplification violated eligibility');
  session = consumeExplorerShrinkReplayReceipts(
    session,
    receipts(payloadCandidate, signature),
  );
  expect(session.lineage[session.lineage.length - 1]?.result === 'retained',
    'same-signature payload simplification was not retained');
});

test('attempt budget stops candidate production at the configured cap', () => {
  const signature = signatureFor(original, 11);
  let session = beginExplorerChainShrink(original, signature, { maxAttempts: 1 });
  const first = propose(session);
  session = consumeExplorerShrinkReplayReceipts(
    first.session,
    receipts(first.candidate, null, { reproduced: false }),
  );
  const stopped = proposeExplorerShrinkCandidate(
    session,
    createExplorerShrinkBudgetReceipt('budget-attempt-stop', 2),
  );
  expect(stopped.candidate === null, 'attempt-exhausted session emitted a candidate');
  expect(stopped.session.stopReason === 'attempt-budget-exhausted',
    `wrong attempt stop reason: ${stopped.session.stopReason}`);
  expect(stopped.session.attemptCount === 1, 'attempt count exceeded configured cap');
});

test('external 30-minute budget receipt stops candidate production', () => {
  const signature = signatureFor(original, 11);
  const session = beginExplorerChainShrink(original, signature);
  const stopped = proposeExplorerShrinkCandidate(
    session,
    createExplorerShrinkBudgetReceipt(
      'budget-duration-stop',
      EXPLORER_SHRINK_MAX_REPRESENTED_DURATION_MS,
    ),
  );
  expect(stopped.candidate === null, 'duration-exhausted session emitted a candidate');
  expect(stopped.session.stopReason === 'external-duration-budget-exhausted',
    `wrong duration stop reason: ${stopped.session.stopReason}`);
  expect(stopped.session.attemptCount === 0, 'duration stop consumed an attempt');
});

test('shrinker APIs do not mutate chains, sessions, receipts or budgets', () => {
  const originalClone = JSON.parse(JSON.stringify(original));
  const frozenOriginal = deepFreeze(JSON.parse(JSON.stringify(original)) as ExplorerScenarioContract);
  const signature = deepFreeze(signatureFor(frozenOriginal, 7));
  const started = deepFreeze(beginExplorerChainShrink(frozenOriginal, signature));
  const budget = deepFreeze(createExplorerShrinkBudgetReceipt('immutable-budget', 0));
  const proposal = proposeExplorerShrinkCandidate(started, budget);
  expect(proposal.candidate !== null, 'immutable input did not produce a candidate');
  const replay = deepFreeze(receipts(proposal.candidate as ExplorerShrinkCandidate, signature));
  consumeExplorerShrinkReplayReceipts(deepFreeze(proposal.session), replay);
  equal(frozenOriginal, originalClone, 'original chain was mutated');
  expect(started.pendingCandidate === null && started.attemptCount === 0,
    'input shrink session was mutated');
  expect(budget.representedElapsedMs === 0, 'budget receipt was mutated');
  expect(replay[0].reproductionOrdinal === 1 && replay[1].reproductionOrdinal === 2,
    'replay receipts were mutated');
});

console.log(`\nExplorer shrinker/clustering: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
