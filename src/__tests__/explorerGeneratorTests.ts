import {
  EXPLORER_CAPABILITY_MATRIX,
  EXPLORER_CAPABILITY_MATRIX_SEMANTIC_HASH,
  explorerCapabilityRowSignature,
  isExplorerCapabilityRowFeasible,
} from '../dev/e2e/explorerCapabilityMatrix';
import {
  EXPLORER_PAIRWISE_TARGET_MAX_ROWS,
  EXPLORER_PAIRWISE_TARGET_MIN_ROWS,
  generateExplorerPairwiseManifests,
} from '../dev/e2e/explorerPairwiseGenerator';
import {
  EXPLORER_SEEDED_CHAIN_ACTION_COUNT,
  EXPLORER_SEEDED_CHAIN_COUNT,
  EXPLORER_SEEDED_CHAIN_RELOAD_ACTIONS,
  deriveExplorerChainEligibilityBaseline,
  generateExplorerSeededChainManifests,
  isExplorerChainEligible,
} from '../dev/e2e/explorerSeededChainGenerator';
import { explorerScenarioSemanticHash } from '../dev/e2e/explorerScenarioContractValidation';
import type { ExplorerAction } from '../dev/e2e/explorerScenarioContracts';

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

function idsFor(
  actions: readonly ExplorerAction[],
  type: ExplorerAction['type'],
): readonly string[] {
  return actions.flatMap((action) => {
    if (action.type !== type) return [];
    switch (action.target.kind) {
      case 'fixture': return [action.target.fixtureId];
      case 'session': return [action.target.sessionId];
      case 'component': return [action.target.sessionId, action.target.componentId];
      case 'injury-episode': return [action.target.injuryEpisodeId];
      case 'readiness': return [action.target.readinessId];
      case 'equipment-fact': return [action.target.equipmentFactId];
      case 'session-feedback': return [action.target.sessionId, action.target.feedbackId];
      case 'adjustment': return [action.target.adjustmentId];
      case 'week': return [action.target.weekId];
      case 'coach-message': return [action.target.conversationId, action.target.messageId];
      default: {
        const exhaustive: never = action.target;
        return exhaustive;
      }
    }
  });
}

console.log('\n-- Explorer deterministic generators --');

const campaignSeed = 0x5eed2026;
const matrixBefore = JSON.stringify(EXPLORER_CAPABILITY_MATRIX);
const pairwise = generateExplorerPairwiseManifests(campaignSeed);
const chains = generateExplorerSeededChainManifests(campaignSeed);

test('pairwise generation is deterministic and does not mutate the capability matrix', () => {
  equal(generateExplorerPairwiseManifests(campaignSeed), pairwise,
    'same campaign seed changed pairwise generation');
  expect(JSON.stringify(EXPLORER_CAPABILITY_MATRIX) === matrixBefore,
    'pairwise generation mutated the capability matrix');
});

test('initial pairwise matrix stays in the bounded 40-80 row target', () => {
  expect(pairwise.rows.length >= EXPLORER_PAIRWISE_TARGET_MIN_ROWS,
    `pairwise row count below target: ${pairwise.rows.length}`);
  expect(pairwise.rows.length <= EXPLORER_PAIRWISE_TARGET_MAX_ROWS,
    `pairwise row count above target: ${pairwise.rows.length}`);
});

test('all and only feasible pairs are covered', () => {
  const covered = new Set(pairwise.rows.flatMap((row) => row.coveredPairIds));
  expect(pairwise.coverage.percentage === 100, 'pairwise percentage is not 100');
  expect(pairwise.coverage.coveredFeasiblePairs === pairwise.coverage.totalFeasiblePairs,
    'reported feasible-pair coverage is incomplete');
  equal([...covered].sort(), pairwise.feasiblePairIds,
    'covered pairs differ from the feasible-pair registry');
  pairwise.rows.forEach((row) => {
    expect(isExplorerCapabilityRowFeasible(row.dimensions),
      `infeasible row emitted: ${row.rowId}`);
  });
});

test('excluded pairs carry explicit deterministic receipts', () => {
  expect(pairwise.excludedPairReceipts.length > 0, 'expected at least one excluded pair');
  pairwise.excludedPairReceipts.forEach((receipt) => {
    expect(receipt.reason === 'no-feasible-complete-row', 'wrong exclusion reason');
    expect(receipt.constraintIds.length > 0, `missing exclusion constraints: ${receipt.pairId}`);
    expect(!pairwise.feasiblePairIds.includes(receipt.pairId),
      `excluded pair is marked feasible: ${receipt.pairId}`);
  });
  const again = generateExplorerPairwiseManifests(campaignSeed);
  equal(again.excludedPairReceipts, pairwise.excludedPairReceipts,
    'excluded-pair receipt order is unstable');
});

test('pairwise rows contain no duplicates and carry stable semantic hashes', () => {
  const signatures = pairwise.rows.map((row) =>
    explorerCapabilityRowSignature(row.dimensions));
  expect(new Set(signatures).size === signatures.length, 'duplicate pairwise row emitted');
  expect(pairwise.capabilityMatrixSemanticHash === EXPLORER_CAPABILITY_MATRIX_SEMANTIC_HASH,
    'capability matrix hash mismatch');
  pairwise.rows.forEach((row) => {
    expect(row.scenarioSemanticHash === explorerScenarioSemanticHash(row.scenario),
      `unstable scenario hash: ${row.rowId}`);
    expect(row.manifestSemanticHash.startsWith('athlete-semantic-sha256-v2:'),
      `invalid manifest semantic hash: ${row.rowId}`);
  });
});

test('initial matrix and campaign semantic hashes are pinned', () => {
  expect(pairwise.rows.length === 66, `initial pairwise row count drifted: ${pairwise.rows.length}`);
  expect(pairwise.feasiblePairIds.length === 648,
    `initial feasible pair count drifted: ${pairwise.feasiblePairIds.length}`);
  expect(pairwise.excludedPairReceipts.length === 62,
    `initial excluded pair count drifted: ${pairwise.excludedPairReceipts.length}`);
  expect(EXPLORER_CAPABILITY_MATRIX_SEMANTIC_HASH ===
    'athlete-semantic-sha256-v2:fcffc0164456cf015e36cf889d171cab17d0b0672e79fa4a6ceda37f425bdc57',
  'capability matrix semantic hash drifted');
  expect(pairwise.semanticHash ===
    'athlete-semantic-sha256-v2:7915160cc9594a4a73f40dda7443ddccc5a272756c537b88f13c0f73b8358de2',
  'pairwise generation semantic hash drifted');
  expect(chains.semanticHash ===
    'athlete-semantic-sha256-v2:0b54297b580d331e59b9285e870bd3c18368b73b2d9d671a8085e2a62f49f57e',
  'seeded-chain generation semantic hash drifted');
});

test('same campaign seed gives the same 32 typed chain manifests', () => {
  const repeated = generateExplorerSeededChainManifests(campaignSeed);
  equal(repeated, chains, 'same campaign seed changed chain manifests');
  expect(chains.chains.length === EXPLORER_SEEDED_CHAIN_COUNT,
    `expected 32 chains, received ${chains.chains.length}`);
});

test('different campaign seeds vary chain manifests', () => {
  const varied = generateExplorerSeededChainManifests(campaignSeed + 1);
  expect(varied.semanticHash !== chains.semanticHash,
    'different campaign seeds produced the same generation hash');
  expect(varied.chains.some((chain, index) =>
    chain.manifestSemanticHash !== chains.chains[index].manifestSemanticHash),
  'different campaign seeds did not vary any chain');
});

test('every chain has exactly 12 actions and reloads after 4, 8 and 12 only', () => {
  chains.chains.forEach((chain) => {
    expect(chain.scenario.steps.length === EXPLORER_SEEDED_CHAIN_ACTION_COUNT,
      `${chain.chainId} action count is not 12`);
    equal(chain.reloadCheckpoints.map((receipt) => receipt.afterAction),
      EXPLORER_SEEDED_CHAIN_RELOAD_ACTIONS,
      `${chain.chainId} reload receipt placement changed`);
    chain.scenario.steps.forEach((step, index) => {
      expect(step.checkpointPolicy.kind === 'durable', `${step.stepId} is not durable`);
      if (step.checkpointPolicy.kind !== 'durable') return;
      const expected = EXPLORER_SEEDED_CHAIN_RELOAD_ACTIONS.includes(
        (index + 1) as 4 | 8 | 12,
      ) ? 'required' : 'not-required';
      expect(step.checkpointPolicy.reload === expected,
        `${step.stepId} has reload=${step.checkpointPolicy.reload}, expected ${expected}`);
    });
  });
});

test('disabled Coach actions are never emitted', () => {
  chains.chains.forEach((chain) => {
    expect(!chain.scenario.steps.some((step) => step.action.type === 'coach.message'),
      `${chain.chainId} emitted coach.message while disabled`);
  });
});

test('every chain covers all required action domains and remains eligible', () => {
  chains.chains.forEach((chain) => {
    const types = chain.scenario.steps.map((step) => step.action.type);
    const required = [
      (type: string) => type.startsWith('fixture.'),
      (type: string) => type.startsWith('session.') && type !== 'session-feedback.record',
      (type: string) => type === 'component.delete',
      (type: string) => type.startsWith('injury.'),
      (type: string) => type.startsWith('readiness.'),
      (type: string) => type.startsWith('equipment.'),
      (type: string) => type === 'session-feedback.record',
      (type: string) => type === 'adjustment.restore',
      (type: string) => type === 'week.repeat',
    ];
    expect(required.every((predicate) => types.some(predicate)),
      `${chain.chainId} omitted a required action domain`);
    const baseline = deriveExplorerChainEligibilityBaseline(chain.scenario);
    expect(isExplorerChainEligible(chain.scenario, baseline),
      `${chain.chainId} violates typed eligibility`);
  });
});

test('canonical target identities survive chained mutations', () => {
  chains.chains.forEach((chain) => {
    const actions = chain.scenario.steps.map((step) => step.action);
    const fixtureIds = actions.flatMap((action) =>
      action.target.kind === 'fixture' ? [action.target.fixtureId] : []);
    const sessionIds = actions.flatMap((action) => {
      if (action.target.kind === 'session' || action.target.kind === 'component' ||
        action.target.kind === 'session-feedback') return [action.target.sessionId];
      return [];
    });
    expect(new Set(fixtureIds).size === 1, `${chain.chainId} changed fixture identity`);
    expect(new Set(sessionIds).size === 1, `${chain.chainId} changed session identity`);
    [
      'injury.set',
      'injury.resolve',
      'readiness.set',
      'readiness.clear',
      'equipment.set',
      'equipment.clear',
    ].forEach((type) => {
      const ids = idsFor(actions, type as ExplorerAction['type']);
      if (ids.length > 0) expect(new Set(ids).size === 1,
        `${chain.chainId} changed identity for ${type}`);
    });
  });
});

test('chain and action hashes are stable canonical receipts', () => {
  chains.chains.forEach((chain) => {
    expect(chain.scenarioSemanticHash === explorerScenarioSemanticHash(chain.scenario),
      `${chain.chainId} scenario hash mismatch`);
    expect(chain.actionSemanticHashes.length === chain.scenario.steps.length,
      `${chain.chainId} action hash count mismatch`);
    expect(chain.manifestSemanticHash.startsWith('athlete-semantic-sha256-v2:'),
      `${chain.chainId} manifest hash contract mismatch`);
  });
});

console.log(`\nExplorer generators: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
