import {
  EXPLORER_ORACLE_FAILURE_CODES,
  evaluateExplorerStepOracles,
  summarizeExplorerOracleEvaluations,
  type ExplorerCardDetailWitness,
  type ExplorerOracleEvaluationContext,
  type ExplorerOracleEvaluationReceipt,
  type ExplorerProjectionSnapshot,
} from '../dev/e2e/explorerOracleEvaluator';
import type {
  ExplorerInvariantId,
  ExplorerOracleAssertion,
} from '../dev/e2e/explorerOracleContracts';
import type {
  ExplorerAction,
  ExplorerJsonValue,
  ExplorerScenarioContract,
  ExplorerScenarioStep,
} from '../dev/e2e/explorerScenarioContracts';
import { semanticFingerprintV2 } from '../utils/semanticFingerprintV2';

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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type MutableContext = {
  -readonly [Key in keyof ExplorerOracleEvaluationContext]:
    ExplorerOracleEvaluationContext[Key];
};

function mutableContext(): MutableContext {
  return clone(baseContext()) as MutableContext;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child));
  }
  return value;
}

const ALL_INVARIANTS: readonly ExplorerInvariantId[] = [
  'no-false-success',
  'durable-readback-equals-accepted-state',
  'render-equals-accepted-state',
  'card-detail-equality',
  'trace-chain-contiguous',
  'source-fact-has-programming-effect',
  'fixture-anchor-valid',
  'restoration-equals-pre-mutation-state',
  'unrelated-state-unchanged',
  'coach-response-agrees-with-visible-plan',
  'same-seed-same-replay',
];

const DEFAULT_ACTION: ExplorerAction = {
  type: 'session.move',
  target: { kind: 'session', sessionId: 'session-1' },
  args: { fromDate: '2026-07-14', toDate: '2026-07-15' },
};

const ORACLES = [
  {
    oracleId: 'accepted',
    type: 'accepted-state-projection',
    selector: '/program',
    expectedValue: { weekId: 'week-1', sessions: ['session-1'] },
  },
  {
    oracleId: 'absence',
    type: 'absence',
    subject: 'accepted-state',
    selector: '/removed-session',
  },
  {
    oracleId: 'fingerprint',
    type: 'semantic-fingerprint',
    subject: 'accepted-state',
    relation: 'changed-from-before',
  },
  {
    oracleId: 'render',
    type: 'rendered-witness',
    testId: 'program-session-card',
    selector: '/rendered-session',
    relation: 'equals-accepted',
  },
  {
    oracleId: 'trace',
    type: 'trace-v2-production-receipt',
    schemaVersion: 2,
    terminalStatus: 'finalized_success',
  },
  {
    oracleId: 'prior-trace',
    type: 'prior-trace-linkage',
    priorStepId: 'prior-step',
  },
  {
    oracleId: 'persisted',
    type: 'persisted-accepted-equality',
    selector: '/program',
  },
  {
    oracleId: 'interpretation',
    type: 'interpretation-receipt',
    conversationId: 'conversation-1',
    messageId: 'message-1',
    expectedActionType: 'session.move',
  },
  {
    oracleId: 'metamorphic',
    type: 'metamorphic-equality',
    leftStepId: 'replay-left',
    rightStepId: 'replay-right',
    selector: '/program',
  },
  {
    oracleId: 'restoration',
    type: 'restoration-equality',
    baselineStepId: 'baseline-step',
    selector: '/program',
  },
  {
    oracleId: 'unrelated',
    type: 'unrelated-state-unchanged',
    selectors: ['/profile', '/future-week'],
  },
] as const satisfies readonly ExplorerOracleAssertion[];

function stepFor(
  oracle: ExplorerOracleAssertion,
  options: {
    readonly stepId?: string;
    readonly action?: ExplorerAction;
    readonly invariants?: readonly ExplorerInvariantId[];
  } = {},
): ExplorerScenarioStep {
  return {
    stepId: options.stepId ?? 'current-step',
    action: options.action ?? DEFAULT_ACTION,
    preconditions: [{
      predicateId: 'revision',
      type: 'accepted-revision',
      revision: 1,
    }],
    ingress: 'program-card',
    controlTestId: 'program-session-card',
    targetTestIds: ['program-session-detail'],
    checkpointPolicy: {
      kind: 'durable',
      reload: 'required',
      renderedProof: 'required',
    },
    expectedOutcome: {
      kind: 'accepted',
      stateChange: 'required',
      acceptedRevisionDelta: 1,
    },
    oracleAssertions: [oracle],
    requiredInvariants: (options.invariants ?? ALL_INVARIANTS) as [
      ExplorerInvariantId,
      ...ExplorerInvariantId[],
    ],
  };
}

function present(
  stepId: string,
  subject: ExplorerProjectionSnapshot['subject'],
  selector: string,
  value: ExplorerJsonValue,
  evidenceReferenceId: string,
): ExplorerProjectionSnapshot {
  return {
    stepId,
    subject,
    selector,
    presence: 'present',
    value,
    evidenceReferenceId,
  };
}

function absent(
  stepId: string,
  subject: ExplorerProjectionSnapshot['subject'],
  selector: string,
  evidenceReferenceId: string,
): ExplorerProjectionSnapshot {
  return {
    stepId,
    subject,
    selector,
    presence: 'absent',
    evidenceReferenceId,
  };
}

const PROGRAM = { weekId: 'week-1', sessions: ['session-1'] } as const;
const RENDERED = { sessionId: 'session-1', name: 'Strength' } as const;
const BASELINE = { adjustmentIds: [], weekId: 'week-1' } as const;
const BEFORE_FINGERPRINT = semanticFingerprintV2({ program: 'before' });
const AFTER_FINGERPRINT = semanticFingerprintV2({ program: 'after' });
const RENDERED_FINGERPRINT = semanticFingerprintV2(RENDERED);

function baseContext(stepId = 'current-step'): ExplorerOracleEvaluationContext {
  return {
    scenarioId: 'scenario-oracle-evaluator',
    stepId,
    evaluationPoint: 'after-reload',
    canonicalAcceptedStateProjections: [
      present(stepId, 'accepted-state', '/program', PROGRAM, 'accepted-program'),
      absent(stepId, 'accepted-state', '/removed-session', 'accepted-absence'),
      present(stepId, 'accepted-state', '/rendered-session', RENDERED, 'accepted-rendered'),
    ],
    persistedStateProjections: [
      present(stepId, 'persisted-state', '/program', PROGRAM, 'persisted-program'),
    ],
    semanticFingerprints: [
      {
        stepId,
        subject: 'accepted-state',
        phase: 'before',
        fingerprint: BEFORE_FINGERPRINT,
        evidenceReferenceId: 'fingerprint-before',
      },
      {
        stepId,
        subject: 'accepted-state',
        phase: 'after',
        fingerprint: AFTER_FINGERPRINT,
        evidenceReferenceId: 'fingerprint-after',
      },
      {
        stepId,
        subject: 'accepted-state',
        phase: 'accepted',
        fingerprint: AFTER_FINGERPRINT,
        evidenceReferenceId: 'fingerprint-accepted',
      },
    ],
    renderWitnessReceipts: [{
      stepId,
      testId: 'program-session-card',
      selector: '/rendered-session',
      presence: 'present',
      semanticFingerprint: RENDERED_FINGERPRINT,
      evidenceReferenceId: 'render-witness',
    }],
    traceV2ProductionReceipts: [
      {
        stepId: 'prior-step',
        traceId: 'trace-prior',
        schemaVersion: 2,
        terminalStatus: 'finalized_success',
        evidenceReferenceId: 'trace-prior-receipt',
      },
      {
        stepId,
        traceId: 'trace-current',
        schemaVersion: 2,
        terminalStatus: 'finalized_success',
        evidenceReferenceId: 'trace-current-receipt',
      },
    ],
    activeTraceId: 'trace-current',
    priorTraceId: 'trace-prior',
    interpretationReceipts: [{
      stepId,
      conversationId: 'conversation-1',
      messageId: 'message-1',
      actionType: 'session.move',
      evidenceReferenceId: 'interpretation-receipt',
    }],
    beforeProjections: [
      present('baseline-step', 'accepted-state', '/program', BASELINE, 'baseline-before'),
    ],
    afterProjections: [
      present('replay-left', 'accepted-state', '/program', PROGRAM, 'replay-left'),
      present('replay-right', 'accepted-state', '/program', PROGRAM, 'replay-right'),
    ],
    restoredProjections: [
      present(stepId, 'accepted-state', '/program', BASELINE, 'restored-program'),
    ],
    unchangedStateWitnesses: [
      {
        stepId,
        selector: '/profile',
        beforeFingerprint: 'profile:same',
        afterFingerprint: 'profile:same',
        evidenceReferenceId: 'unchanged-profile',
      },
      {
        stepId,
        selector: '/future-week',
        beforeFingerprint: 'future:same',
        afterFingerprint: 'future:same',
        evidenceReferenceId: 'unchanged-future',
      },
    ],
    fixtureAnchorWitnesses: [
      {
        stepId,
        selector: '/program',
        acceptedFingerprint: 'fixture:same',
        fixtureAnchorFingerprint: 'fixture:same',
        valid: true,
        evidenceReferenceId: 'fixture-program',
      },
      {
        stepId,
        selector: '/removed-session',
        acceptedFingerprint: 'fixture:absence',
        fixtureAnchorFingerprint: 'fixture:absence',
        valid: true,
        evidenceReferenceId: 'fixture-absence',
      },
    ],
    cardDetailWitnesses: [{
      stepId,
      selector: '/rendered-session',
      cardPresence: 'present',
      detailPresence: 'present',
      cardFingerprint: RENDERED_FINGERPRINT,
      detailFingerprint: RENDERED_FINGERPRINT,
      evidenceReferenceId: 'card-detail-witness',
    }],
  };
}

function evaluate(
  oracle: ExplorerOracleAssertion,
  context = baseContext(),
  options: Parameters<typeof stepFor>[1] = {},
): ExplorerOracleEvaluationReceipt {
  const receipts = evaluateExplorerStepOracles(stepFor(oracle, options), context);
  expect(receipts.length === 1, 'expected exactly one evaluation receipt');
  return receipts[0];
}

function failingContext(oracle: ExplorerOracleAssertion): ExplorerOracleEvaluationContext {
  const context = mutableContext();
  switch (oracle.type) {
    case 'accepted-state-projection':
      context.canonicalAcceptedStateProjections = [
        present('current-step', 'accepted-state', '/program', { wrong: true }, 'accepted-program'),
        ...context.canonicalAcceptedStateProjections.slice(1),
      ];
      break;
    case 'absence':
      context.canonicalAcceptedStateProjections = context.canonicalAcceptedStateProjections.map(
        (candidate) => candidate.selector === oracle.selector
          ? present('current-step', 'accepted-state', oracle.selector, { present: true }, 'present')
          : candidate,
      );
      break;
    case 'semantic-fingerprint':
      context.semanticFingerprints = context.semanticFingerprints.map((candidate) =>
        candidate.phase === 'after'
          ? { ...candidate, fingerprint: BEFORE_FINGERPRINT }
          : candidate);
      break;
    case 'rendered-witness':
      context.renderWitnessReceipts = [{
        ...context.renderWitnessReceipts[0],
        presence: 'present',
        semanticFingerprint: 'render:different',
      }];
      break;
    case 'trace-v2-production-receipt':
      context.traceV2ProductionReceipts = context.traceV2ProductionReceipts.map((candidate) =>
        candidate.stepId === 'current-step'
          ? { ...candidate, terminalStatus: 'finalized_failure' }
          : candidate);
      break;
    case 'prior-trace-linkage':
      context.priorTraceId = 'trace-wrong-prior';
      break;
    case 'persisted-accepted-equality':
      context.persistedStateProjections = [
        present('current-step', 'persisted-state', '/program', { wrong: true }, 'persisted'),
      ];
      break;
    case 'interpretation-receipt':
      context.interpretationReceipts = context.interpretationReceipts.map((receipt) => ({
        ...receipt,
        actionType: 'session.delete',
      }));
      break;
    case 'metamorphic-equality':
      context.afterProjections = context.afterProjections.map((candidate) =>
        candidate.stepId === oracle.rightStepId
          ? present(
              oracle.rightStepId,
              'accepted-state',
              oracle.selector,
              { weekId: 'different' },
              'replay-right',
            )
          : candidate);
      break;
    case 'restoration-equality':
      context.restoredProjections = [
        present('current-step', 'accepted-state', '/program', { notRestored: true }, 'restored'),
      ];
      break;
    case 'unrelated-state-unchanged':
      context.unchangedStateWitnesses = context.unchangedStateWitnesses.map((witness) =>
        witness.selector === '/future-week'
          ? { ...witness, afterFingerprint: 'future:changed' }
          : witness);
      break;
    default: {
      const exhaustive: never = oracle;
      return exhaustive;
    }
  }
  return context;
}

function contextWithoutRequiredEvidence(
  oracle: ExplorerOracleAssertion,
): ExplorerOracleEvaluationContext {
  const context = mutableContext();
  switch (oracle.type) {
    case 'accepted-state-projection':
    case 'absence':
      context.canonicalAcceptedStateProjections = [];
      break;
    case 'semantic-fingerprint':
      context.semanticFingerprints = [];
      break;
    case 'rendered-witness':
      context.renderWitnessReceipts = [];
      break;
    case 'trace-v2-production-receipt':
    case 'prior-trace-linkage':
      context.traceV2ProductionReceipts = [];
      break;
    case 'persisted-accepted-equality':
      context.persistedStateProjections = [];
      break;
    case 'interpretation-receipt':
      context.interpretationReceipts = [];
      break;
    case 'metamorphic-equality':
      context.afterProjections = [];
      break;
    case 'restoration-equality':
      context.beforeProjections = [];
      context.restoredProjections = [];
      break;
    case 'unrelated-state-unchanged':
      context.unchangedStateWitnesses = [];
      break;
    default: {
      const exhaustive: never = oracle;
      return exhaustive;
    }
  }
  return context;
}

const EXPECTED_FAILURES: Readonly<
  Record<ExplorerOracleAssertion['type'], string>
> = {
  'accepted-state-projection': 'projection_mismatch',
  absence: 'expected_absence_but_present',
  'semantic-fingerprint': 'fingerprint_mismatch',
  'rendered-witness': 'render_identity_mismatch',
  'trace-v2-production-receipt': 'trace_result_mismatch',
  'prior-trace-linkage': 'prior_trace_link_broken',
  'persisted-accepted-equality': 'persistence_mismatch',
  'interpretation-receipt': 'projection_mismatch',
  'metamorphic-equality': 'metamorphic_mismatch',
  'restoration-equality': 'restoration_mismatch',
  'unrelated-state-unchanged': 'unrelated_state_changed',
};

ORACLES.forEach((oracle) => {
  test(`passes ${oracle.type}`, () => {
    const receipt = evaluate(oracle);
    expect(receipt.passed, `${oracle.type} should pass: ${receipt.failureCode}`);
    expect(receipt.failureCode === null, 'passing receipt must not carry a failure code');
  });

  test(`fails ${oracle.type}`, () => {
    const receipt = evaluate(oracle, failingContext(oracle));
    expect(!receipt.passed, `${oracle.type} should fail`);
    expect(
      receipt.failureCode === EXPECTED_FAILURES[oracle.type],
      `${oracle.type} failure code was ${receipt.failureCode}`,
    );
  });

  test(`fails ${oracle.type} closed when required evidence is missing`, () => {
    const receipt = evaluate(oracle, contextWithoutRequiredEvidence(oracle));
    expect(!receipt.passed, `${oracle.type} must fail closed`);
    expect(receipt.failureCode !== null, 'missing evidence must have a typed failure');
  });
});

test('semantic fingerprint relations support unchanged and equals-accepted', () => {
  const unchanged = clone(baseContext()) as MutableContext;
  unchanged.semanticFingerprints = unchanged.semanticFingerprints.map((candidate) =>
    candidate.phase === 'after'
      ? { ...candidate, fingerprint: BEFORE_FINGERPRINT }
      : candidate);
  const unchangedOracle: ExplorerOracleAssertion = {
    oracleId: 'unchanged-fingerprint',
    type: 'semantic-fingerprint',
    subject: 'accepted-state',
    relation: 'unchanged-from-before',
  };
  expect(evaluate(unchangedOracle, unchanged).passed, 'unchanged relation failed');

  const equalsAccepted = mutableContext();
  equalsAccepted.semanticFingerprints = [
    ...equalsAccepted.semanticFingerprints,
    {
      stepId: 'current-step',
      subject: 'visible-card',
      phase: 'after',
      fingerprint: AFTER_FINGERPRINT,
      evidenceReferenceId: 'visible-card-after',
    },
  ];
  const equalsOracle: ExplorerOracleAssertion = {
    oracleId: 'equals-accepted-fingerprint',
    type: 'semantic-fingerprint',
    subject: 'visible-card',
    relation: 'equals-accepted',
  };
  expect(evaluate(equalsOracle, equalsAccepted).passed, 'equals-accepted relation failed');
});

test('render witnesses support explicit present and absent relations', () => {
  const presentOracle: ExplorerOracleAssertion = {
    oracleId: 'render-present',
    type: 'rendered-witness',
    testId: 'program-session-card',
    selector: '/rendered-session',
    relation: 'present',
  };
  expect(
    evaluate(presentOracle, baseContext(), {
      invariants: ['render-equals-accepted-state'],
    }).passed,
    'present render relation failed',
  );
  const absentContext = mutableContext();
  absentContext.renderWitnessReceipts = [{
    stepId: 'current-step',
    testId: 'program-session-card',
    selector: '/not-rendered',
    presence: 'absent',
    evidenceReferenceId: 'render-absence',
  }];
  const absentOracle: ExplorerOracleAssertion = {
    oracleId: 'render-absent',
    type: 'rendered-witness',
    testId: 'program-session-card',
    selector: '/not-rendered',
    relation: 'absent',
  };
  expect(
    evaluate(absentOracle, absentContext, {
      invariants: ['render-equals-accepted-state'],
    }).passed,
    'absent render relation failed',
  );
});

test('absence evaluates visible card and detail witnesses explicitly', () => {
  const context = mutableContext();
  context.cardDetailWitnesses = [{
    stepId: 'current-step',
    selector: '/hidden-session',
    cardPresence: 'absent',
    detailPresence: 'absent',
    cardFingerprint: null,
    detailFingerprint: null,
    evidenceReferenceId: 'hidden-card-detail',
  }];
  (['visible-card', 'visible-detail'] as const).forEach((subject) => {
    const oracle: ExplorerOracleAssertion = {
      oracleId: `absence-${subject}`,
      type: 'absence',
      subject,
      selector: '/hidden-session',
    };
    expect(
      evaluate(oracle, context, { invariants: ['no-false-success'] }).passed,
      `${subject} absence failed`,
    );
  });
});

test('TraceV2 finalized failure receipts are evaluated as typed results', () => {
  const context = mutableContext();
  context.traceV2ProductionReceipts = context.traceV2ProductionReceipts.map((receipt) =>
    receipt.stepId === 'current-step'
      ? { ...receipt, terminalStatus: 'finalized_failure' }
      : receipt);
  const oracle: ExplorerOracleAssertion = {
    oracleId: 'trace-failure',
    type: 'trace-v2-production-receipt',
    schemaVersion: 2,
    terminalStatus: 'finalized_failure',
  };
  expect(evaluate(oracle, context).passed, 'typed finalized failure receipt was rejected');
});

test('accepted and persisted projection mismatch is explicit', () => {
  const oracle = ORACLES[6];
  const receipt = evaluate(oracle, failingContext(oracle));
  expect(receipt.failureCode === 'persistence_mismatch', 'persistence mismatch not selected');
  expect(receipt.firstDivergentProjection === '/program', 'wrong persistence divergence');
});

test('broken priorActionTraceId is explicit', () => {
  const receipt = evaluate(ORACLES[5], failingContext(ORACLES[5]));
  expect(receipt.failureCode === 'prior_trace_link_broken', 'broken chain was accepted');
  expect(
    receipt.invariantIdsAffected.includes('trace-chain-contiguous'),
    'trace invariant was not mapped',
  );
});

test('missing render witness cannot pass from accepted state alone', () => {
  const context = mutableContext();
  context.renderWitnessReceipts = [];
  const receipt = evaluate(ORACLES[3], context);
  expect(receipt.failureCode === 'render_witness_missing', 'missing render proof passed');
});

test('restoration uses exact semantic equality', () => {
  const context = mutableContext();
  context.restoredProjections = [present(
    'current-step',
    'accepted-state',
    '/program',
    { weekId: 'week-1', adjustmentIds: [] },
    'restored-reordered',
  )];
  expect(evaluate(ORACLES[9], context).passed, 'key order should not change exact equality');
  context.restoredProjections = [present(
    'current-step',
    'accepted-state',
    '/program',
    { weekId: 'week-1', adjustmentIds: [], hiddenDrift: true },
    'restored-drifted',
  )];
  expect(
    evaluate(ORACLES[9], context).failureCode === 'restoration_mismatch',
    'restoration drift was accepted',
  );
});

test('unrelated state drift reports the first selector in oracle order', () => {
  const context = mutableContext();
  context.unchangedStateWitnesses = context.unchangedStateWitnesses.map((witness) => ({
    ...witness,
    afterFingerprint: `${witness.afterFingerprint}:drift`,
  }));
  const receipt = evaluate(ORACLES[10], context);
  expect(receipt.failureCode === 'unrelated_state_changed', 'drift was not detected');
  expect(receipt.firstDivergentProjection === '/profile', 'first selector was not stable');
});

test('card and detail mismatch fails the rendered oracle', () => {
  const context = mutableContext();
  const witness = context.cardDetailWitnesses[0] as ExplorerCardDetailWitness;
  context.cardDetailWitnesses = [{ ...witness, detailFingerprint: 'detail:different' }];
  const receipt = evaluate(ORACLES[3], context);
  expect(receipt.failureCode === 'render_identity_mismatch', 'card/detail drift was accepted');
  expect(
    receipt.invariantIdsAffected.includes('card-detail-equality'),
    'card/detail invariant was not mapped',
  );
});

test('same-seed replay mismatch maps to the replay invariant', () => {
  const receipt = evaluate(ORACLES[8], failingContext(ORACLES[8]));
  expect(receipt.failureCode === 'metamorphic_mismatch', 'replay mismatch was accepted');
  expect(
    receipt.invariantIdsAffected.includes('same-seed-same-replay'),
    'same-seed invariant was not mapped',
  );
});

function twoStepScenario(): Pick<ExplorerScenarioContract, 'steps'> {
  const first = stepFor(ORACLES[0], { stepId: 'step-a' });
  const second = {
    ...stepFor(ORACLES[4], { stepId: 'step-b' }),
    oracleAssertions: [ORACLES[4], ORACLES[6]],
  } as ExplorerScenarioStep;
  return { steps: [first, second] } as Pick<ExplorerScenarioContract, 'steps'>;
}

function receiptStub(
  stepId: string,
  oracleId: string,
  passedValue: boolean,
  divergent: string | null = null,
): ExplorerOracleEvaluationReceipt {
  return {
    scenarioId: 'scenario-order',
    stepId,
    oracleId,
    evaluationPoint: 'after-reload',
    passed: passedValue,
    expectedFingerprintOrValue: { kind: 'value', value: 'expected' },
    actualFingerprintOrValue: { kind: 'value', value: 'actual' },
    failureCode: passedValue ? null : 'projection_mismatch',
    firstDivergentProjection: divergent,
    evidenceReferenceIds: [],
    invariantIdsAffected: [],
  };
}

test('scenario summary ordering follows manifest step and oracle order', () => {
  const summary = summarizeExplorerOracleEvaluations(twoStepScenario(), [
    receiptStub('step-b', 'persisted', true),
    receiptStub('step-a', 'accepted', true),
    receiptStub('step-b', 'trace', true),
  ]);
  equal(
    summary.orderedEvaluationReceipts.map((receipt) => receipt.oracleId),
    ['accepted', 'trace', 'persisted'],
    'summary order changed',
  );
});

test('evaluator does not mutate frozen inputs', () => {
  const context = deepFreeze(baseContext());
  const step = deepFreeze(stepFor(ORACLES[0]));
  const beforeContext = JSON.stringify(context);
  const beforeStep = JSON.stringify(step);
  evaluateExplorerStepOracles(step, context);
  expect(JSON.stringify(context) === beforeContext, 'context mutated');
  expect(JSON.stringify(step) === beforeStep, 'manifest step mutated');
});

test('repeated evaluation is deterministic', () => {
  const context = baseContext();
  const step = stepFor(ORACLES[3]);
  equal(
    evaluateExplorerStepOracles(step, context),
    evaluateExplorerStepOracles(step, context),
    'repeated evaluation changed',
  );
});

test('first failing step and oracle follow manifest order', () => {
  const summary = summarizeExplorerOracleEvaluations(twoStepScenario(), [
    receiptStub('step-b', 'trace', false, '/trace-v2'),
    receiptStub('step-a', 'accepted', false, '/program'),
    receiptStub('step-b', 'persisted', false, '/persisted'),
  ]);
  expect(summary.firstFailingStepId === 'step-a', 'wrong first failing step');
  expect(summary.firstFailingOracleId === 'accepted', 'wrong first failing oracle');
  expect(summary.firstDivergentProjection === '/program', 'wrong first divergence');
  expect(summary.hardFailureCount === 3, 'hard failures were not counted');
});

test('capability-disabled coach.message fails without reading reply text', () => {
  const action: ExplorerAction = {
    type: 'coach.message',
    target: {
      kind: 'coach-message',
      conversationId: 'conversation-1',
      messageId: 'message-1',
    },
    args: {
      message: 'private raw Coach message that must not appear',
      visibleWeekId: 'week-1',
    },
    capability: { capabilityId: 'coach.message', status: 'disabled' },
  };
  const receipt = evaluate(ORACLES[7], baseContext(), { action });
  expect(receipt.failureCode === 'unsupported_capability', 'disabled Coach capability passed');
  expect(
    !JSON.stringify(receipt).includes(action.args.message),
    'raw Coach message leaked into evaluation output',
  );
});

test('production-enabled week.repeat accepts a matching TraceV2 receipt', () => {
  const action: ExplorerAction = {
    type: 'week.repeat',
    target: { kind: 'week', weekId: 'week-1' },
    args: { sourceWeekStart: '2026-07-13', targetWeekStart: '2026-07-20' },
    capability: { capabilityId: 'week.repeat', status: 'enabled' },
  };
  const receipt = evaluate(ORACLES[4], baseContext(), { action });
  expect(receipt.passed, `enabled Repeat Week receipt failed: ${receipt.failureCode}`);
});

test('reply wording cannot substitute for a production receipt', () => {
  const context = mutableContext() as MutableContext & {
    replyText?: string;
  };
  context.traceV2ProductionReceipts = [];
  context.replyText = 'Success! I changed your plan.';
  const receipt = evaluate(ORACLES[4], context);
  expect(receipt.failureCode === 'trace_receipt_missing', 'reply wording inferred success');
  expect(!JSON.stringify(receipt).includes(context.replyText), 'reply text leaked into output');
});

test('unknown runtime evidence is ignored without changing semantics', () => {
  const baseline = evaluate(ORACLES[0]);
  const context = mutableContext() as MutableContext & {
    unknownRuntimeReceipt?: unknown;
  };
  context.unknownRuntimeReceipt = {
    status: 'passed',
    message: 'must not affect the oracle',
  };
  context.canonicalAcceptedStateProjections = [
    ...context.canonicalAcceptedStateProjections,
    present('unrelated-step', 'accepted-state', '/unknown', { value: 99 }, 'unknown-evidence'),
  ];
  equal(evaluate(ORACLES[0], context), baseline, 'unknown evidence changed the receipt');
});

test('invalid runtime evaluation points fail closed', () => {
  const context = {
    ...baseContext(),
    evaluationPoint: 'during-action',
  } as unknown as ExplorerOracleEvaluationContext;
  const receipt = evaluate(
    ORACLES[0],
    context,
  );
  expect(receipt.failureCode === 'invalid_evaluation_point', 'invalid point was accepted');
});

test('required fixture-anchor evidence fails closed and maps its invariant', () => {
  const context = mutableContext();
  context.fixtureAnchorWitnesses = [];
  const receipt = evaluate(ORACLES[0], context);
  expect(receipt.failureCode === 'actual_projection_missing', 'fixture anchor absence passed');
  expect(
    receipt.invariantIdsAffected.includes('fixture-anchor-valid'),
    'fixture anchor invariant was not mapped',
  );
});

test('arbitrary projection values and absolute paths are not emitted', () => {
  const privateValue = { injuryDescription: 'private injury detail' };
  const oracle: ExplorerOracleAssertion = {
    oracleId: 'privacy',
    type: 'accepted-state-projection',
    selector: '/private',
    expectedValue: privateValue,
  };
  const context = mutableContext();
  context.canonicalAcceptedStateProjections = [
    ...context.canonicalAcceptedStateProjections,
    present(
      'current-step',
      'accepted-state',
      '/private',
      privateValue,
      '/Users/example/private-evidence.json',
    ),
  ];
  context.fixtureAnchorWitnesses = [{
    stepId: 'current-step',
    selector: '/private',
    acceptedFingerprint: 'fixture:private',
    fixtureAnchorFingerprint: 'fixture:private',
    valid: true,
    evidenceReferenceId: '/Users/example/private-fixture.json',
  }];
  const receipt = evaluate(oracle, context);
  expect(receipt.passed, 'private projection should still compare exactly');
  const serialized = JSON.stringify(receipt);
  expect(!serialized.includes('private injury detail'), 'private value leaked');
  expect(!serialized.includes('/Users/example'), 'absolute path leaked');
});

test('failure code catalog contains every required typed code exactly', () => {
  equal(EXPLORER_ORACLE_FAILURE_CODES, [
    'expected_projection_missing',
    'actual_projection_missing',
    'projection_mismatch',
    'expected_absence_but_present',
    'fingerprint_mismatch',
    'render_witness_missing',
    'render_identity_mismatch',
    'trace_receipt_missing',
    'trace_result_mismatch',
    'prior_trace_link_broken',
    'persistence_mismatch',
    'interpretation_receipt_missing',
    'metamorphic_mismatch',
    'restoration_mismatch',
    'unrelated_state_changed',
    'invalid_evaluation_point',
    'unsupported_capability',
  ], 'failure code catalog drifted');
});

console.log(`\nExplorer oracle evaluator: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
