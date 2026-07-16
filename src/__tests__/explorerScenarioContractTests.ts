import {
  EXPLORER_DEFAULT_CAPABILITY_STATUS,
  EXPLORER_SCENARIO_SCHEMA_VERSION,
  type ExplorerAction,
  type ExplorerCapabilityDeclaration,
  type ExplorerEligibilityPredicate,
  type ExplorerScenarioContract,
  type ExplorerScenarioStep,
} from '../dev/e2e/explorerScenarioContracts';
import {
  EXPLORER_ORACLE_TYPES,
  EXPLORER_REQUIRED_INVARIANT_IDS,
  type ExplorerOracleAssertion,
} from '../dev/e2e/explorerOracleContracts';
import {
  ExplorerScenarioContractValidationError,
  explorerScenarioSemanticHash,
  normalizeExplorerScenarioContract,
  stableExplorerScenarioContractJson,
  validateExplorerAction,
  validateExplorerEligibilityPredicate,
  validateExplorerOracleAssertion,
  validateExplorerScenarioContract,
  validateExplorerScenarioContracts,
} from '../dev/e2e/explorerScenarioContractValidation';

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

function expectContractError(
  run: () => unknown,
  options: { code?: string; pathIncludes?: string } = {},
): void {
  try {
    run();
  } catch (error) {
    expect(
      error instanceof ExplorerScenarioContractValidationError,
      'expected ExplorerScenarioContractValidationError',
    );
    const contractError = error as ExplorerScenarioContractValidationError;
    if (options.code) {
      expect(
        contractError.issues.some((candidate) => candidate.code === options.code),
        `expected issue code ${options.code}; got ${contractError.issues
          .map((candidate) => candidate.code)
          .join(', ')}`,
      );
    }
    if (options.pathIncludes) {
      expect(
        contractError.issues.some((candidate) =>
          candidate.path.includes(options.pathIncludes as string)),
        `expected issue path containing ${options.pathIncludes}`,
      );
    }
    return;
  }
  throw new Error('expected contract validation to reject the input');
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const ACTIONS: readonly ExplorerAction[] = [
  {
    type: 'fixture.add',
    target: { kind: 'fixture', fixtureId: 'fixture-new' },
    args: { date: '2026-07-18', fixtureKind: 'game', opponentId: 'opponent-city' },
  },
  {
    type: 'fixture.move',
    target: { kind: 'fixture', fixtureId: 'fixture-1' },
    args: { fromDate: '2026-07-18', toDate: '2026-07-19' },
  },
  {
    type: 'fixture.remove',
    target: { kind: 'fixture', fixtureId: 'fixture-1' },
    args: { date: '2026-07-18' },
  },
  {
    type: 'session.move',
    target: { kind: 'session', sessionId: 'session-1' },
    args: { fromDate: '2026-07-14', toDate: '2026-07-15' },
  },
  {
    type: 'session.delete',
    target: { kind: 'session', sessionId: 'session-1' },
    args: { date: '2026-07-14' },
  },
  {
    type: 'component.delete',
    target: { kind: 'component', sessionId: 'session-1', componentId: 'component-strength' },
    args: { date: '2026-07-14' },
  },
  {
    type: 'injury.set',
    target: { kind: 'injury-episode', injuryEpisodeId: 'injury-1' },
    args: {
      effectiveDate: '2026-07-14',
      bodyRegionId: 'hamstring',
      severity: 'moderate',
      laterality: 'left',
    },
  },
  {
    type: 'injury.resolve',
    target: { kind: 'injury-episode', injuryEpisodeId: 'injury-1' },
    args: { resolvedDate: '2026-07-21' },
  },
  {
    type: 'readiness.set',
    target: { kind: 'readiness', readinessId: 'readiness-2026-07-14' },
    args: { date: '2026-07-14', fatigue: 3, soreness: 2, sleepQuality: 4 },
  },
  {
    type: 'readiness.clear',
    target: { kind: 'readiness', readinessId: 'readiness-2026-07-14' },
    args: { date: '2026-07-14' },
  },
  {
    type: 'equipment.set',
    target: { kind: 'equipment-fact', equipmentFactId: 'equipment-1' },
    args: {
      fromDate: '2026-07-14',
      toDate: '2026-07-20',
      availableEquipmentIds: ['bodyweight'],
      unavailableEquipmentIds: ['barbell'],
    },
  },
  {
    type: 'equipment.clear',
    target: { kind: 'equipment-fact', equipmentFactId: 'equipment-1' },
    args: { clearedOn: '2026-07-21' },
  },
  {
    type: 'session-feedback.record',
    target: { kind: 'session-feedback', sessionId: 'session-1', feedbackId: 'feedback-1' },
    args: {
      date: '2026-07-14',
      completion: 'full',
      feeling: 'manageable',
      soreness: 'mild',
      difficulty: 6,
    },
  },
  {
    type: 'adjustment.restore',
    target: { kind: 'adjustment', adjustmentId: 'adjustment-1' },
    args: { restoredOn: '2026-07-15' },
  },
  {
    type: 'week.repeat',
    target: { kind: 'week', weekId: 'week-2026-07-13' },
    args: { sourceWeekStart: '2026-07-13', targetWeekStart: '2026-07-20' },
    capability: { capabilityId: 'week.repeat', status: 'disabled' },
  },
  {
    type: 'coach.message',
    target: {
      kind: 'coach-message',
      conversationId: 'conversation-1',
      messageId: 'message-1',
    },
    args: { message: 'Move my strength session to Wednesday.', visibleWeekId: 'week-2026-07-13' },
    capability: { capabilityId: 'coach.message', status: 'disabled' },
  },
];

const PREDICATES: readonly ExplorerEligibilityPredicate[] = [
  { predicateId: 'accepted-week-count', type: 'accepted-week-count', operator: 'equals', count: 1 },
  { predicateId: 'phase-signature', type: 'phase-signature', signature: 'in-season-standard' },
  {
    predicateId: 'fixture-exists',
    type: 'fixture-exists',
    fixtureId: 'fixture-1',
    date: '2026-07-18',
  },
  {
    predicateId: 'fixture-absent',
    type: 'fixture-absent',
    fixtureId: 'fixture-new',
    date: '2026-07-19',
  },
  {
    predicateId: 'session-exists',
    type: 'session-exists',
    sessionId: 'session-1',
    date: '2026-07-14',
  },
  {
    predicateId: 'component-exists',
    type: 'component-exists',
    sessionId: 'session-1',
    componentId: 'component-strength',
    date: '2026-07-14',
  },
  {
    predicateId: 'eligible-target-date',
    type: 'eligible-target-date',
    date: '2026-07-15',
    forActionType: 'session.move',
  },
  {
    predicateId: 'source-fact-exists',
    type: 'source-fact-exists',
    sourceFactId: 'injury-fact-1',
    sourceFactType: 'injury',
  },
  {
    predicateId: 'source-fact-absent',
    type: 'source-fact-absent',
    sourceFactId: 'equipment-fact-2',
    sourceFactType: 'equipment',
  },
  {
    predicateId: 'reversible-adjustment-status',
    type: 'reversible-adjustment-status',
    adjustmentId: 'adjustment-1',
    status: 'active',
  },
  { predicateId: 'accepted-revision', type: 'accepted-revision', revision: 4 },
  {
    predicateId: 'card-detail-equality',
    type: 'card-detail-equality',
    sessionId: 'session-1',
    date: '2026-07-14',
  },
  {
    predicateId: 'coach-receipt',
    type: 'coach-interpretation-receipt-available',
    conversationId: 'conversation-1',
    messageId: 'message-1',
  },
];

const ORACLES: readonly ExplorerOracleAssertion[] = [
  {
    oracleId: 'accepted-state-projection',
    type: 'accepted-state-projection',
    selector: '/program/weeks/0',
    expectedValue: { weekId: 'week-1' },
  },
  {
    oracleId: 'absence',
    type: 'absence',
    subject: 'accepted-state',
    selector: '/program/sessions/session-1',
  },
  {
    oracleId: 'semantic-fingerprint',
    type: 'semantic-fingerprint',
    subject: 'accepted-state',
    relation: 'changed-from-before',
  },
  {
    oracleId: 'rendered-witness',
    type: 'rendered-witness',
    testId: 'explorer-target',
    selector: '/program/weeks/0/sessions/0',
    relation: 'equals-accepted',
  },
  {
    oracleId: 'trace-receipt',
    type: 'trace-v2-production-receipt',
    schemaVersion: 2,
    terminalStatus: 'finalized_success',
  },
  { oracleId: 'prior-trace', type: 'prior-trace-linkage', priorStepId: 'baseline' },
  {
    oracleId: 'persisted-equality',
    type: 'persisted-accepted-equality',
    selector: '/program',
  },
  {
    oracleId: 'interpretation-receipt',
    type: 'interpretation-receipt',
    conversationId: 'conversation-1',
    messageId: 'message-1',
    expectedActionType: 'coach.message',
  },
  {
    oracleId: 'metamorphic-equality',
    type: 'metamorphic-equality',
    leftStepId: 'baseline',
    rightStepId: 'restore',
    selector: '/program/weeks/0',
  },
  {
    oracleId: 'restoration-equality',
    type: 'restoration-equality',
    baselineStepId: 'baseline',
    selector: '/program',
  },
  {
    oracleId: 'unrelated-unchanged',
    type: 'unrelated-state-unchanged',
    selectors: ['/profile', '/program/weeks/1'],
  },
];

function slugForAction(action: ExplorerAction): string {
  return action.type.replace(/[.]/g, '-');
}

function acceptedStep(action: ExplorerAction, stepId: string): ExplorerScenarioStep {
  const isDisabled = (
    action.type === 'week.repeat' || action.type === 'coach.message'
  ) && action.capability.status === 'disabled';
  if (isDisabled) {
    return {
      stepId,
      action,
      preconditions: [
        { predicateId: `${stepId}-revision`, type: 'accepted-revision', revision: 1 },
      ],
      ingress: action.type === 'coach.message' ? 'coach-chat' : 'week-controls',
      controlTestId: 'explorer-control',
      checkpointPolicy: { kind: 'none', reason: 'capability-disabled' },
      expectedOutcome: {
        kind: 'capability-disabled',
        stateChange: 'forbidden',
        capabilityId: action.capability.capabilityId,
      },
      oracleAssertions: [],
      requiredInvariants: ['same-seed-same-replay'],
    };
  }
  return {
    stepId,
    action,
    preconditions: [
      { predicateId: `${stepId}-revision`, type: 'accepted-revision', revision: 1 },
    ],
    ingress: action.type === 'coach.message' ? 'coach-chat' : 'program-card',
    controlTestId: 'explorer-control',
    targetTestIds: ['explorer-target'],
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
    oracleAssertions: [
      {
        oracleId: `${stepId}-render`,
        type: 'rendered-witness',
        testId: 'explorer-target',
        selector: '/program/weeks/0',
        relation: 'equals-accepted',
      },
      {
        oracleId: `${stepId}-trace`,
        type: 'trace-v2-production-receipt',
        schemaVersion: 2,
        terminalStatus: 'finalized_success',
      },
      {
        oracleId: `${stepId}-persisted`,
        type: 'persisted-accepted-equality',
        selector: '/program',
      },
    ],
    requiredInvariants: [...EXPLORER_REQUIRED_INVARIANT_IDS] as [
      (typeof EXPLORER_REQUIRED_INVARIANT_IDS)[number],
      ...(typeof EXPLORER_REQUIRED_INVARIANT_IDS)[number][],
    ],
  };
}

function scenarioWithSteps(
  scenarioId: string,
  steps: readonly [ExplorerScenarioStep, ...ExplorerScenarioStep[]],
): ExplorerScenarioContract {
  return {
    schemaVersion: EXPLORER_SCENARIO_SCHEMA_VERSION,
    scenarioId,
    tier: 'golden',
    seedId: 'standard-in-season-week',
    tags: ['explorer', 'contracts'],
    campaignSeed: 1729,
    budgetMs: 15_000,
    steps,
  };
}

function baseScenario(): ExplorerScenarioContract {
  return scenarioWithSteps(
    'explorer-contract-base',
    [acceptedStep(ACTIONS[0], 'fixture-add')],
  );
}

console.log('\n-- Explorer action, manifest, eligibility and oracle contracts --');

test('week.repeat and coach.message default capabilities are disabled', () => {
  expect(EXPLORER_DEFAULT_CAPABILITY_STATUS['week.repeat'] === 'disabled', 'week.repeat enabled');
  expect(EXPLORER_DEFAULT_CAPABILITY_STATUS['coach.message'] === 'disabled', 'coach.message enabled');
});

ACTIONS.forEach((action) => {
  test(`accepts complete ${action.type} action and scenario contract`, () => {
    expect(validateExplorerAction(action).type === action.type, 'action type changed');
    const scenario = scenarioWithSteps(
      `positive-${slugForAction(action)}`,
      [acceptedStep(action, slugForAction(action))],
    );
    expect(
      validateExplorerScenarioContract(scenario).scenarioId === scenario.scenarioId,
      'scenario was not returned',
    );
  });
});

PREDICATES.forEach((predicate) => {
  test(`accepts ${predicate.type} eligibility predicate`, () => {
    expect(
      validateExplorerEligibilityPredicate(predicate).type === predicate.type,
      'predicate type changed',
    );
  });
});

ORACLES.forEach((oracle) => {
  test(`accepts ${oracle.type} oracle definition`, () => {
    expect(validateExplorerOracleAssertion(oracle).type === oracle.type, 'oracle type changed');
  });
});

test('oracle catalog covers every required oracle variant', () => {
  expect(
    new Set(ORACLES.map((oracle) => oracle.type)).size === EXPLORER_ORACLE_TYPES.length,
    'oracle coverage is incomplete',
  );
});

test('accepted, absence, fingerprint, rendered, receipt, persisted and unrelated oracles compose', () => {
  const scenario = baseScenario();
  const step = clone(scenario.steps[0]) as ExplorerScenarioStep & {
    oracleAssertions: ExplorerOracleAssertion[];
  };
  step.oracleAssertions.push(
    ORACLES[0],
    ORACLES[1],
    ORACLES[2],
    { ...ORACLES[10], oracleId: 'unrelated-composed' } as ExplorerOracleAssertion,
  );
  validateExplorerScenarioContract(scenarioWithSteps('oracle-composition', [step]));
});

test('prior linkage, metamorphic equality and restoration equality compose across ordered steps', () => {
  const baseline = acceptedStep(ACTIONS[3], 'baseline');
  const restore = clone(acceptedStep(ACTIONS[13], 'restore')) as ExplorerScenarioStep & {
    oracleAssertions: ExplorerOracleAssertion[];
  };
  restore.oracleAssertions.push(ORACLES[5], ORACLES[8], ORACLES[9]);
  validateExplorerScenarioContract(
    scenarioWithSteps('restoration-oracles', [baseline, restore]),
  );
});

test('interpretation receipt composes when coach.message has an explicit owner declaration', () => {
  const action = clone(ACTIONS[15]) as Extract<ExplorerAction, { type: 'coach.message' }>;
  (action as unknown as { capability: { status: string } }).capability.status = 'enabled';
  const step = clone(acceptedStep(action, 'coach-message')) as ExplorerScenarioStep & {
    oracleAssertions: ExplorerOracleAssertion[];
  };
  step.oracleAssertions.push(ORACLES[7]);
  const declarations: readonly ExplorerCapabilityDeclaration[] = [{
    capabilityId: 'coach.message',
    owner: 'test-only-owner',
    contractVersion: 'test-v1',
  }];
  validateExplorerScenarioContract(
    scenarioWithSteps('coach-interpretation-oracle', [step]),
    { declaredCapabilities: declarations },
  );
});

ACTIONS.forEach((action) => {
  Object.keys(action.args).forEach((argument) => {
    test(`rejects ${action.type} without required argument ${argument}`, () => {
      const candidate = clone(action) as unknown as {
        args: Record<string, unknown>;
      };
      delete candidate.args[argument];
      expectContractError(
        () => validateExplorerAction(candidate),
        { code: 'missing-field', pathIncludes: `args.${argument}` },
      );
    });
  });
  Object.keys(action.target)
    .filter((identity) => identity !== 'kind')
    .forEach((identity) => {
      test(`rejects ${action.type} without canonical target identity ${identity}`, () => {
        const candidate = clone(action) as unknown as {
          target: Record<string, unknown>;
        };
        delete candidate.target[identity];
        expectContractError(
          () => validateExplorerAction(candidate),
          { code: 'missing-field', pathIncludes: `target.${identity}` },
        );
      });
    });
});

const ACTION_DATE_FIELDS: ReadonlyArray<{
  readonly actionIndex: number;
  readonly keys: readonly string[];
}> = [
  { actionIndex: 0, keys: ['date'] },
  { actionIndex: 1, keys: ['fromDate', 'toDate'] },
  { actionIndex: 2, keys: ['date'] },
  { actionIndex: 3, keys: ['fromDate', 'toDate'] },
  { actionIndex: 4, keys: ['date'] },
  { actionIndex: 5, keys: ['date'] },
  { actionIndex: 6, keys: ['effectiveDate'] },
  { actionIndex: 7, keys: ['resolvedDate'] },
  { actionIndex: 8, keys: ['date'] },
  { actionIndex: 9, keys: ['date'] },
  { actionIndex: 10, keys: ['fromDate', 'toDate'] },
  { actionIndex: 11, keys: ['clearedOn'] },
  { actionIndex: 12, keys: ['date'] },
  { actionIndex: 13, keys: ['restoredOn'] },
  { actionIndex: 14, keys: ['sourceWeekStart', 'targetWeekStart'] },
];

ACTION_DATE_FIELDS.forEach(({ actionIndex, keys }) => {
  keys.forEach((key) => {
    const action = ACTIONS[actionIndex];
    test(`rejects invalid ISO date in ${action.type}.${key}`, () => {
      const candidate = clone(action) as unknown as { args: Record<string, unknown> };
      candidate.args[key] = '2026-02-30';
      expectContractError(
        () => validateExplorerAction(candidate),
        { code: 'invalid-value', pathIncludes: key },
      );
    });
  });
});

test('rejects invalid ISO dates in eligibility predicates', () => {
  const candidate = clone(PREDICATES[2]) as unknown as Record<string, unknown>;
  candidate.date = '2026-13-01';
  expectContractError(
    () => validateExplorerEligibilityPredicate(candidate),
    { code: 'invalid-value', pathIncludes: 'date' },
  );
});

test('rejects duplicate scenario IDs', () => {
  const scenario = baseScenario();
  expectContractError(
    () => validateExplorerScenarioContracts([scenario, clone(scenario)]),
    { code: 'duplicate-id' },
  );
});

test('rejects duplicate step IDs', () => {
  const first = acceptedStep(ACTIONS[0], 'duplicate-step');
  const second = acceptedStep(ACTIONS[1], 'duplicate-step');
  expectContractError(
    () => validateExplorerScenarioContract(
      scenarioWithSteps('duplicate-steps', [first, second]),
    ),
    { code: 'duplicate-id', pathIncludes: 'steps' },
  );
});

test('rejects duplicate oracle IDs across different steps', () => {
  const first = acceptedStep(ACTIONS[0], 'first');
  const second = clone(acceptedStep(ACTIONS[1], 'second')) as ExplorerScenarioStep & {
    oracleAssertions: ExplorerOracleAssertion[];
  };
  second.oracleAssertions[0] = {
    ...second.oracleAssertions[0],
    oracleId: first.oracleAssertions[0].oracleId,
  } as ExplorerOracleAssertion;
  expectContractError(
    () => validateExplorerScenarioContract(
      scenarioWithSteps('duplicate-oracles', [first, second]),
    ),
    { code: 'duplicate-id', pathIncludes: 'oracleId' },
  );
});

test('rejects unknown fields at manifest, action, target, args and oracle boundaries', () => {
  const cases: unknown[] = [];
  cases.push({ ...baseScenario(), runtimeOnly: true });
  cases.push({ ...ACTIONS[0], runtimeOnly: true });
  cases.push({ ...ACTIONS[0], target: { ...ACTIONS[0].target, label: 'fixture' } });
  cases.push({ ...ACTIONS[0], args: { ...ACTIONS[0].args, timezone: 'local' } });
  cases.push({ ...ORACLES[0], screenshotBytes: 'abc' });
  cases.forEach((candidate, index) => {
    const validator = index === 0
      ? validateExplorerScenarioContract
      : index === 4
        ? validateExplorerOracleAssertion
        : validateExplorerAction;
    expectContractError(() => validator(candidate), { code: 'unknown-field' });
  });
});

test('rejects unknown action, predicate, oracle, checkpoint and outcome variants', () => {
  expectContractError(
    () => validateExplorerAction({ type: 'fixture.teleport', target: {}, args: {} }),
    { code: 'unknown-variant' },
  );
  expectContractError(
    () => validateExplorerEligibilityPredicate({ predicateId: 'mystery', type: 'always' }),
    { code: 'unknown-variant' },
  );
  expectContractError(
    () => validateExplorerOracleAssertion({ oracleId: 'mystery', type: 'visual-magic' }),
    { code: 'unknown-variant' },
  );
  const checkpoint = clone(baseScenario()) as unknown as {
    steps: Array<{ checkpointPolicy: unknown }>;
  };
  checkpoint.steps[0].checkpointPolicy = { kind: 'eventually' };
  expectContractError(
    () => validateExplorerScenarioContract(checkpoint),
    { code: 'unknown-variant', pathIncludes: 'checkpointPolicy' },
  );
  const outcome = clone(baseScenario()) as unknown as {
    steps: Array<{ expectedOutcome: unknown }>;
  };
  outcome.steps[0].expectedOutcome = { kind: 'maybe' };
  expectContractError(
    () => validateExplorerScenarioContract(outcome),
    { code: 'unknown-variant', pathIncludes: 'expectedOutcome' },
  );
});

test('rejects empty scenarios and empty preconditions rather than falling back to eligible', () => {
  const empty = { ...baseScenario(), steps: [] };
  expectContractError(
    () => validateExplorerScenarioContract(empty),
    { code: 'invalid-value', pathIncludes: 'steps' },
  );
  const noPreconditions = clone(baseScenario()) as unknown as {
    steps: Array<{ preconditions: unknown[] }>;
  };
  noPreconditions.steps[0].preconditions = [];
  expectContractError(
    () => validateExplorerScenarioContract(noPreconditions),
    { code: 'invalid-value', pathIncludes: 'preconditions' },
  );
});

test('rejects accepted outcomes paired with rejected checkpoints', () => {
  const candidate = clone(baseScenario()) as unknown as {
    steps: Array<{ checkpointPolicy: unknown }>;
  };
  candidate.steps[0].checkpointPolicy = { kind: 'rejected', renderedProof: 'required' };
  expectContractError(
    () => validateExplorerScenarioContract(candidate),
    { code: 'invalid-combination' },
  );
});

test('rejects rendered witnesses with a not-required rendered checkpoint', () => {
  const candidate = clone(baseScenario()) as unknown as {
    steps: Array<{ checkpointPolicy: { renderedProof: string } }>;
  };
  candidate.steps[0].checkpointPolicy.renderedProof = 'not-required';
  expectContractError(
    () => validateExplorerScenarioContract(candidate),
    { code: 'invalid-combination', pathIncludes: 'oracleAssertions' },
  );
});

test('rejects prior-trace linkage on the first step', () => {
  const candidate = clone(baseScenario()) as unknown as {
    steps: Array<{ stepId: string; oracleAssertions: ExplorerOracleAssertion[] }>;
  };
  candidate.steps[0].oracleAssertions.push({
    oracleId: 'invalid-prior',
    type: 'prior-trace-linkage',
    priorStepId: candidate.steps[0].stepId,
  });
  expectContractError(
    () => validateExplorerScenarioContract(candidate),
    { code: 'invalid-combination' },
  );
});

test('rejects interpretation receipts on non-Coach actions', () => {
  const candidate = clone(baseScenario()) as unknown as {
    steps: Array<{ oracleAssertions: ExplorerOracleAssertion[] }>;
  };
  candidate.steps[0].oracleAssertions.push(ORACLES[7]);
  expectContractError(
    () => validateExplorerScenarioContract(candidate),
    { code: 'invalid-combination' },
  );
});

test('rejects restoration equality on non-restoration actions', () => {
  const baseline = acceptedStep(ACTIONS[0], 'baseline');
  const second = clone(acceptedStep(ACTIONS[3], 'second')) as ExplorerScenarioStep & {
    oracleAssertions: ExplorerOracleAssertion[];
  };
  second.oracleAssertions.push({
    ...ORACLES[9],
    oracleId: 'invalid-restoration',
  } as ExplorerOracleAssertion);
  expectContractError(
    () => validateExplorerScenarioContract(
      scenarioWithSteps('invalid-restoration', [baseline, second]),
    ),
    { code: 'invalid-combination' },
  );
});

test('rejects TraceV2 terminal receipts that disagree with the expected outcome', () => {
  const candidate = clone(baseScenario()) as unknown as {
    steps: Array<{ oracleAssertions: ExplorerOracleAssertion[] }>;
  };
  const receipt = candidate.steps[0].oracleAssertions.find(
    (oracle) => oracle.type === 'trace-v2-production-receipt',
  ) as unknown as { terminalStatus: string };
  receipt.terminalStatus = 'finalized_failure';
  expectContractError(
    () => validateExplorerScenarioContract(candidate),
    { code: 'invalid-combination' },
  );
});

test('rejects missing rendered witness for actions requiring rendered proof', () => {
  const candidate = clone(baseScenario()) as unknown as {
    steps: Array<{ oracleAssertions: ExplorerOracleAssertion[] }>;
  };
  candidate.steps[0].oracleAssertions = candidate.steps[0].oracleAssertions.filter(
    (oracle) => oracle.type !== 'rendered-witness',
  );
  expectContractError(
    () => validateExplorerScenarioContract(candidate),
    { code: 'invalid-combination', pathIncludes: 'oracleAssertions' },
  );
});

test('rejects durable checkpoints without persisted/accepted equality', () => {
  const candidate = clone(baseScenario()) as unknown as {
    steps: Array<{ oracleAssertions: ExplorerOracleAssertion[] }>;
  };
  candidate.steps[0].oracleAssertions = candidate.steps[0].oracleAssertions.filter(
    (oracle) => oracle.type !== 'persisted-accepted-equality',
  );
  expectContractError(
    () => validateExplorerScenarioContract(candidate),
    { code: 'invalid-combination', pathIncludes: 'oracleAssertions' },
  );
});

test('rejects enabled week.repeat and coach.message without owner declarations', () => {
  [ACTIONS[14], ACTIONS[15]].forEach((source) => {
    const action = clone(source) as Extract<
      ExplorerAction,
      { type: 'week.repeat' | 'coach.message' }
    >;
    (action as unknown as { capability: { status: string } }).capability.status = 'enabled';
    expectContractError(
      () => validateExplorerAction(action),
      { code: 'capability-not-declared', pathIncludes: 'capability' },
    );
  });
});

test('rejects empty and malformed control, target and oracle selectors', () => {
  const emptyControl = clone(baseScenario()) as unknown as {
    steps: Array<{ controlTestId: string }>;
  };
  emptyControl.steps[0].controlTestId = '';
  expectContractError(
    () => validateExplorerScenarioContract(emptyControl),
    { code: 'invalid-value', pathIncludes: 'controlTestId' },
  );

  const malformedTarget = clone(baseScenario()) as unknown as {
    steps: Array<{ targetTestIds: string[] }>;
  };
  malformedTarget.steps[0].targetTestIds = ['Bad selector'];
  expectContractError(
    () => validateExplorerScenarioContract(malformedTarget),
    { code: 'invalid-value', pathIncludes: 'targetTestIds' },
  );

  expectContractError(
    () => validateExplorerOracleAssertion({
      ...ORACLES[0],
      selector: 'program/weeks/0',
    }),
    { code: 'invalid-value', pathIncludes: 'selector' },
  );
});

test('stable normalization ignores runtime timestamps, artifact bytes and environment paths', () => {
  const scenario = baseScenario();
  const unstableEnvelope = {
    ...scenario,
    runtimeTimestamp: '2099-01-01T00:00:00.000Z',
    screenshotBytes: new Uint8Array([1, 2, 3]),
    hierarchyBytes: new Uint8Array([4, 5, 6]),
    environmentPath: '/Users/one-machine/private/worktree',
  } as unknown as ExplorerScenarioContract;
  expect(
    explorerScenarioSemanticHash(scenario) === explorerScenarioSemanticHash(unstableEnvelope),
    'excluded runtime fields changed the semantic hash',
  );
});

test('stable normalization rejects Date, binary, non-finite and circular semantic inputs', () => {
  const withDate = clone(baseScenario()) as unknown as {
    steps: Array<{ oracleAssertions: unknown[] }>;
  };
  withDate.steps[0].oracleAssertions.push({
    oracleId: 'date-value',
    type: 'accepted-state-projection',
    selector: '/program',
    expectedValue: new Date('2026-07-14T00:00:00.000Z'),
  });
  expectContractError(
    () => validateExplorerScenarioContract(withDate),
    { code: 'unstable-normalization' },
  );

  const withBinary = clone(baseScenario()) as unknown as {
    steps: Array<{ oracleAssertions: unknown[] }>;
  };
  withBinary.steps[0].oracleAssertions.push({
    oracleId: 'binary-value',
    type: 'accepted-state-projection',
    selector: '/program',
    expectedValue: { payload: new Uint8Array([1, 2]) },
  });
  expectContractError(
    () => validateExplorerScenarioContract(withBinary),
    { code: 'unstable-normalization' },
  );

  const withNaN = clone(baseScenario()) as unknown as {
    steps: Array<{ expectedOutcome: { acceptedRevisionDelta: number } }>;
  };
  withNaN.steps[0].expectedOutcome.acceptedRevisionDelta = Number.NaN;
  expectContractError(
    () => normalizeExplorerScenarioContract(withNaN as unknown as ExplorerScenarioContract),
    { code: 'unstable-normalization' },
  );

  const circularValue: Record<string, unknown> = {};
  circularValue.self = circularValue;
  const withCircular = clone(baseScenario()) as unknown as {
    steps: Array<{ oracleAssertions: unknown[] }>;
  };
  withCircular.steps[0].oracleAssertions.push({
    oracleId: 'circular-value',
    type: 'accepted-state-projection',
    selector: '/program',
    expectedValue: circularValue,
  });
  expectContractError(
    () => normalizeExplorerScenarioContract(withCircular as unknown as ExplorerScenarioContract),
    { code: 'unstable-normalization' },
  );
});

test('normalization is stable across object key insertion order', () => {
  const scenario = baseScenario();
  const reordered: ExplorerScenarioContract = {
    steps: scenario.steps,
    budgetMs: scenario.budgetMs,
    campaignSeed: scenario.campaignSeed,
    tags: scenario.tags,
    seedId: scenario.seedId,
    tier: scenario.tier,
    scenarioId: scenario.scenarioId,
    schemaVersion: scenario.schemaVersion,
  };
  expect(
    stableExplorerScenarioContractJson(scenario) ===
      stableExplorerScenarioContractJson(reordered),
    'object insertion order changed normalization',
  );
});

test('semantic hashes include order, canonical args, preconditions, checkpoints, outcomes, invariants and oracles', () => {
  const first = acceptedStep(ACTIONS[0], 'first');
  const second = acceptedStep(ACTIONS[1], 'second');
  const base = scenarioWithSteps('hash-coverage', [first, second]);
  const baseHash = explorerScenarioSemanticHash(base);
  const mutations: ExplorerScenarioContract[] = [];

  const reordered = clone(base) as unknown as { steps: ExplorerScenarioStep[] };
  reordered.steps = [reordered.steps[1], reordered.steps[0]];
  mutations.push(reordered as unknown as ExplorerScenarioContract);

  const args = clone(base) as unknown as {
    steps: Array<{ action: { args: Record<string, unknown> } }>;
  };
  args.steps[0].action.args.opponentId = 'opponent-rangers';
  mutations.push(args as unknown as ExplorerScenarioContract);

  const preconditions = clone(base) as unknown as {
    steps: Array<{ preconditions: Array<{ revision: number }> }>;
  };
  preconditions.steps[0].preconditions[0].revision = 2;
  mutations.push(preconditions as unknown as ExplorerScenarioContract);

  const checkpoint = clone(base) as unknown as {
    steps: Array<{ checkpointPolicy: { reload: string } }>;
  };
  checkpoint.steps[0].checkpointPolicy.reload = 'not-required';
  mutations.push(checkpoint as unknown as ExplorerScenarioContract);

  const outcome = clone(base) as unknown as {
    steps: Array<{ expectedOutcome: { acceptedRevisionDelta: number } }>;
  };
  outcome.steps[0].expectedOutcome.acceptedRevisionDelta = 2;
  mutations.push(outcome as unknown as ExplorerScenarioContract);

  const invariants = clone(base) as unknown as {
    steps: Array<{ requiredInvariants: string[] }>;
  };
  invariants.steps[0].requiredInvariants = ['no-false-success'];
  mutations.push(invariants as unknown as ExplorerScenarioContract);

  const oracles = clone(base) as unknown as {
    steps: Array<{ oracleAssertions: Array<Record<string, unknown>> }>;
  };
  oracles.steps[0].oracleAssertions[0].relation = 'present';
  mutations.push(oracles as unknown as ExplorerScenarioContract);

  expect(
    mutations.every((mutation) => explorerScenarioSemanticHash(mutation) !== baseHash),
    'one or more semantic contract fields were omitted from the hash',
  );
});

console.log(`\nExplorer scenario contract tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
