import {
  EXPLORER_ACTION_BRIDGE_FAILURE,
  EXPLORER_PRODUCTION_OWNER_BY_ACTION,
  ExplorerActionBridgeError,
  assertExplorerActionExecutable,
  createExplorerActionBridge,
  mapExplorerCanonicalOutcome,
  type ExplorerExecutableAction,
  type ExplorerExecutableActionType,
  type ExplorerProductionActionAdapters,
  type ExplorerProductionOwnerResult,
} from '../dev/e2e/explorerActionBridge';
import {
  EXPLORER_ELIGIBILITY_REASON,
  evaluateExplorerStepEligibility,
  type ExplorerEligibilityWitnessState,
} from '../dev/e2e/explorerEligibility';
import {
  EXPLORER_RUNTIME_REASON,
  runExplorerScenario,
  type ExplorerRuntimeDependencies,
} from '../dev/e2e/explorerRuntime';
import { EXPLORER_NON_COACH_SMOKE_MANIFESTS } from
  '../dev/e2e/explorerSmokeScenarioManifests';
import {
  EXPLORER_PRODUCTION_CAPABILITY_DECLARATIONS,
  EXPLORER_SCENARIO_SCHEMA_VERSION,
  type ExplorerAction,
  type ExplorerScenarioContract,
  type ExplorerScenarioStep,
} from '../dev/e2e/explorerScenarioContracts';
import {
  explorerActionSemanticHash,
  validateExplorerScenarioContract,
} from '../dev/e2e/explorerScenarioContractValidation';
import type { ExplorerOracleEvaluationContext } from
  '../dev/e2e/explorerOracleEvaluator';
import type {
  ExplorerScenarioActionEvidenceV1,
  ExplorerScenarioArtifactBundleV1,
  ExplorerScenarioCheckpointEvidenceV1,
  ExplorerScenarioReloadReceiptV1,
  ExplorerScenarioSeedEvidenceV1,
} from '../dev/e2e/explorerScenarioArtifactBundle';
import { semanticFingerprintV2 } from '../utils/semanticFingerprintV2';

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

const ACTIONS: readonly ExplorerExecutableAction[] = [
  {
    type: 'fixture.add', target: { kind: 'fixture', fixtureId: 'fixture-new' },
    args: { date: '2026-07-18', fixtureKind: 'game', opponentId: 'opponent' },
  },
  {
    type: 'fixture.move', target: { kind: 'fixture', fixtureId: 'fixture-one' },
    args: { fromDate: '2026-07-18', toDate: '2026-07-19' },
  },
  {
    type: 'fixture.remove', target: { kind: 'fixture', fixtureId: 'fixture-one' },
    args: { date: '2026-07-18' },
  },
  {
    type: 'session.move', target: { kind: 'session', sessionId: 'session-one' },
    args: { fromDate: '2026-07-13', toDate: '2026-07-14' },
  },
  {
    type: 'session.delete', target: { kind: 'session', sessionId: 'session-one' },
    args: { date: '2026-07-13' },
  },
  {
    type: 'component.delete',
    target: { kind: 'component', sessionId: 'session-one', componentId: 'component-one' },
    args: { date: '2026-07-13' },
  },
  {
    type: 'injury.set',
    target: { kind: 'injury-episode', injuryEpisodeId: 'injury-one' },
    args: {
      effectiveDate: '2026-07-13', bodyRegionId: 'hamstring', severity: 'minor',
      laterality: 'right',
    },
  },
  {
    type: 'injury.resolve',
    target: { kind: 'injury-episode', injuryEpisodeId: 'injury-one' },
    args: { resolvedDate: '2026-07-20' },
  },
  {
    type: 'readiness.set', target: { kind: 'readiness', readinessId: 'ready-one' },
    args: { date: '2026-07-13', fatigue: 2, soreness: 2, sleepQuality: 3 },
  },
  {
    type: 'readiness.clear', target: { kind: 'readiness', readinessId: 'ready-one' },
    args: { date: '2026-07-13' },
  },
  {
    type: 'equipment.set',
    target: { kind: 'equipment-fact', equipmentFactId: 'equipment-one' },
    args: {
      fromDate: '2026-07-13', toDate: '2026-07-19',
      availableEquipmentIds: ['bodyweight'], unavailableEquipmentIds: ['barbell'],
    },
  },
  {
    type: 'equipment.clear',
    target: { kind: 'equipment-fact', equipmentFactId: 'equipment-one' },
    args: { clearedOn: '2026-07-13' },
  },
  {
    type: 'session-feedback.record',
    target: { kind: 'session-feedback', sessionId: 'session-one', feedbackId: 'feedback-one' },
    args: {
      date: '2026-07-13', completion: 'full', feeling: 'manageable',
      soreness: 'none', difficulty: 4,
    },
  },
  {
    type: 'adjustment.restore',
    target: { kind: 'adjustment', adjustmentId: 'adjustment-one' },
    args: { restoredOn: '2026-07-20' },
  },
  {
    type: 'week.repeat', target: { kind: 'week', weekId: '2026-07-13' },
    args: { sourceWeekStart: '2026-07-13', targetWeekStart: '2026-07-20' },
    capability: { capabilityId: 'week.repeat', status: 'enabled' },
  },
];

function buildAdapters(args: {
  mutateResult?: (
    action: ExplorerExecutableAction,
    result: ExplorerProductionOwnerResult,
  ) => ExplorerProductionOwnerResult;
} = {}): ExplorerProductionActionAdapters {
  const entries = ACTIONS.map((registeredAction) => {
    const actionType = registeredAction.type;
    return [actionType, {
      actionType,
      owner: EXPLORER_PRODUCTION_OWNER_BY_ACTION[actionType],
      invokeProductionOwner: async (
        action: ExplorerExecutableAction,
        context: { claim: { expectedAcceptedRevision: number } },
      ) => {
        const base: ExplorerProductionOwnerResult = {
          actionType: action.type,
          actionSemanticHash: explorerActionSemanticHash(action),
          target: action.target,
          status: 'applied',
          owner: EXPLORER_PRODUCTION_OWNER_BY_ACTION[action.type],
          receiptId: `receipt-${action.type}`,
          traceV2RootId: `trace-${action.type}`,
          acceptedRevisionBefore: context.claim.expectedAcceptedRevision,
          acceptedRevisionAfter: context.claim.expectedAcceptedRevision +
            (action.type === 'session-feedback.record' ? 0 : 1),
          reasonCode: null,
          durable: true,
          productionReceipt: { transaction: action.type },
        };
        return (args.mutateResult?.(action, base) ?? base) as never;
      },
    }];
  });
  return Object.fromEntries(entries) as unknown as ExplorerProductionActionAdapters;
}

function oneStep(): ExplorerScenarioStep {
  return {
    stepId: 'set-readiness',
    action: ACTIONS.find((action) => action.type === 'readiness.set')!,
    preconditions: [{
      predicateId: 'week-count', type: 'accepted-week-count', operator: 'at-least', count: 1,
    }],
    ingress: 'readiness-editor',
    controlTestId: 'readiness-control',
    targetTestIds: ['readiness-render'],
    checkpointPolicy: { kind: 'durable', reload: 'required', renderedProof: 'required' },
    expectedOutcome: { kind: 'accepted', stateChange: 'required', acceptedRevisionDelta: 1 },
    oracleAssertions: [
      {
        oracleId: 'readiness-rendered', type: 'rendered-witness',
        testId: 'readiness-render', selector: '/accepted/readiness', relation: 'equals-accepted',
      },
      {
        oracleId: 'readiness-trace', type: 'trace-v2-production-receipt',
        schemaVersion: 2, terminalStatus: 'finalized_success',
      },
      {
        oracleId: 'readiness-persisted', type: 'persisted-accepted-equality',
        selector: '/accepted/readiness',
      },
    ],
    requiredInvariants: [
      'no-false-success', 'render-equals-accepted-state',
      'durable-readback-equals-accepted-state',
    ],
  };
}

function runtimeManifest(stepCount = 1): ExplorerScenarioContract {
  const steps = Array.from({ length: stepCount }, (_, index) => {
    const base = oneStep();
    const stepId = `set-readiness-${index + 1}`;
    const action: ExplorerAction = {
      ...base.action,
      target: { kind: 'readiness', readinessId: `readiness-${index + 1}` },
      args: {
        date: `2026-07-${String(13 + index).padStart(2, '0')}`,
        fatigue: 2,
        soreness: 2,
        sleepQuality: 3,
      },
    };
    return {
      ...base,
      stepId,
      action,
      oracleAssertions: [
        {
          oracleId: `${stepId}-rendered`, type: 'rendered-witness' as const,
          testId: 'readiness-render', selector: `/accepted/readiness/${index + 1}`,
          relation: 'equals-accepted' as const,
        },
        {
          oracleId: `${stepId}-trace`, type: 'trace-v2-production-receipt' as const,
          schemaVersion: 2 as const, terminalStatus: 'finalized_success' as const,
        },
        {
          oracleId: `${stepId}-persisted`, type: 'persisted-accepted-equality' as const,
          selector: `/accepted/readiness/${index + 1}`,
        },
        ...(index === 0 ? [] : [{
          oracleId: `${stepId}-prior`, type: 'prior-trace-linkage' as const,
          priorStepId: `set-readiness-${index}`,
        }]),
      ],
    };
  }) as [ExplorerScenarioStep, ...ExplorerScenarioStep[]];
  return validateExplorerScenarioContract({
    schemaVersion: EXPLORER_SCENARIO_SCHEMA_VERSION,
    scenarioId: `runtime-${stepCount}-steps`,
    tier: 'smoke',
    seedId: 'standard-in-season-week',
    tags: ['explorer', 'runtime'],
    budgetMs: 30_000,
    steps,
  }, { declaredCapabilities: EXPLORER_PRODUCTION_CAPABILITY_DECLARATIONS });
}

const SEED_EVIDENCE = {
  witnessReport: {
    seedId: 'standard-in-season-week', complete: true,
    witnesses: [{ witnessId: 'seed', status: 'passed', evidenceFingerprint: 'seed-fp' }],
  },
  initialAcceptedSemanticFingerprint: 'accepted-initial',
  initialPersistedStoreFingerprints: { program: 'program-initial' },
  initialScreenshotReference: { artifactId: 'initial.png', contentFingerprint: 'initial-image' },
  initialAccessibilityHierarchyReference: {
    artifactId: 'initial.xml', contentFingerprint: 'initial-hierarchy',
  },
} as ExplorerScenarioSeedEvidenceV1;

function oracleContext(args: {
  manifest: ExplorerScenarioContract;
  step: ExplorerScenarioStep;
  point: 'after-action' | 'after-reload';
}): ExplorerOracleEvaluationContext {
  const index = args.manifest.steps.findIndex((step) => step.stepId === args.step.stepId);
  const selector = `/accepted/readiness/${index + 1}`;
  const value = { stepId: args.step.stepId };
  const fingerprint = semanticFingerprintV2(value);
  const traceReceipts = args.manifest.steps.slice(0, index + 1).map((step, traceIndex) => ({
    evidenceReferenceId: `trace-ref-${step.stepId}`,
    stepId: step.stepId,
    traceId: `trace-readiness.set-${traceIndex + 1}`,
    schemaVersion: 2,
    terminalStatus: 'finalized_success' as const,
  }));
  return {
    scenarioId: args.manifest.scenarioId,
    stepId: args.step.stepId,
    evaluationPoint: args.point,
    canonicalAcceptedStateProjections: [{
      evidenceReferenceId: `accepted-${args.step.stepId}`,
      stepId: args.step.stepId,
      subject: 'accepted-state',
      selector,
      presence: 'present',
      value,
    }],
    persistedStateProjections: [{
      evidenceReferenceId: `persisted-${args.step.stepId}`,
      stepId: args.step.stepId,
      subject: 'persisted-state',
      selector,
      presence: 'present',
      value,
    }],
    semanticFingerprints: [],
    renderWitnessReceipts: [{
      evidenceReferenceId: `render-${args.step.stepId}`,
      stepId: args.step.stepId,
      testId: 'readiness-render',
      selector,
      presence: 'present',
      semanticFingerprint: fingerprint,
    }],
    traceV2ProductionReceipts: traceReceipts,
    activeTraceId: `trace-readiness.set-${index + 1}`,
    priorTraceId: index === 0 ? null : `trace-readiness.set-${index}`,
    interpretationReceipts: [],
    beforeProjections: [],
    afterProjections: [],
    restoredProjections: [],
    unchangedStateWitnesses: [],
    fixtureAnchorWitnesses: [],
    cardDetailWitnesses: [],
  };
}

function runtimeDeps(
  manifest: ExplorerScenarioContract,
  options: { missingRender?: boolean } = {},
): ExplorerRuntimeDependencies & { counts: Record<string, number> } {
  const counts: Record<string, number> = {
    reset: 0, marker: 0, claim: 0, action: 0, checkpoint: 0, reload: 0, artifact: 0,
  };
  const adapters = buildAdapters({
    mutateResult: (action, result) => ({
      ...result,
      receiptId: `receipt-${action.type}-${counts.action}`,
      traceV2RootId: `trace-${action.type}-${counts.action}`,
    }),
  });
  const underlyingBridge = createExplorerActionBridge(adapters);
  const deps: ExplorerRuntimeDependencies & { counts: Record<string, number> } = {
    counts,
    loadManifest: (scenarioId) => scenarioId === manifest.scenarioId ? manifest : null,
    resetSeedOnce: async (seedId) => {
      counts.reset += 1;
      return { resetId: 'reset-one', seedId, seedEvidence: SEED_EVIDENCE };
    },
    readEligibilityWitnessState: async (_scenario, step) => {
      const index = manifest.steps.findIndex((candidate) => candidate.stepId === step.stepId);
      return {
        acceptedRevision: index + 1,
        witnessRevision: index + 1,
        acceptedWeekCount: 1,
        availableCapabilities: ['week.repeat'],
        availableRenderTestIds: options.missingRender
          ? []
          : [step.controlTestId, ...(step.targetTestIds ?? [])],
      };
    },
    publishEligibilityMarker: (marker) => {
      counts.marker += 1;
      expect(
        marker.markerId ===
          `e2e-explorer-next-action-eligible-${manifest.scenarioId}-${marker.stepId}`,
        'eligibility marker identity drifted',
      );
    },
    claimIntendedAction: (_marker, claim) => {
      counts.claim += 1;
      expect(claim.priorActionTraceId === (counts.claim === 1
        ? null
        : `trace-readiness.set-${counts.claim - 1}`), 'claim prior trace mismatch');
    },
    actionBridge: {
      execute: async (action, context) => {
        counts.action += 1;
        return underlyingBridge.execute(action, context);
      },
    },
    waitForReactRender: async ({ step, receipt }) => ({
      traceV2RootId: receipt.traceV2RootId,
      observedTestIds: [step.controlTestId, ...(step.targetTestIds ?? [])],
      complete: true,
    }),
    captureOracleContext: async ({ step, point }) =>
      oracleContext({ manifest, step, point }),
    checkpointScenarioStep: async ({ step, order }) => {
      counts.checkpoint += 1;
      return {
        order,
        checkpointEvidence: {
          scenarioId: manifest.scenarioId,
          stepId: step.stepId,
        } as unknown as ExplorerScenarioCheckpointEvidenceV1,
      };
    },
    coldReloadScenarioSessionV2: async ({ step, order }) => {
      counts.reload += 1;
      return {
        order,
        reloadReceipt: {
          scenarioId: manifest.scenarioId,
          stepId: step.stepId,
          reloadCount: order,
          traceV2RootId: `trace-readiness.set-${order}`,
        } as unknown as ExplorerScenarioReloadReceiptV1,
      };
    },
    assembleActionEvidence: async ({ step }) => {
      counts.artifact += 1;
      return { stepId: step.stepId } as ExplorerScenarioActionEvidenceV1;
    },
    assembleScenarioArtifact: async () => ({
      schemaVersion: 1,
      semanticHash: 'sha256:test',
    } as ExplorerScenarioArtifactBundleV1),
  };
  return deps;
}

console.log('\n-- Typed Explorer runtime, action bridge and smoke manifests --');

void test('compiles exactly nine non-Coach smoke manifests and fifteen actions', () => {
  const actions = EXPLORER_NON_COACH_SMOKE_MANIFESTS.flatMap((manifest) => manifest.steps);
  expect(EXPLORER_NON_COACH_SMOKE_MANIFESTS.length === 9, 'smoke manifest count changed');
  expect(actions.length === 15, `expected 15 actions, received ${actions.length}`);
  expect(actions.every((step) => step.action.type !== 'coach.message'), 'Coach replay was compiled');
  expect(
    EXPLORER_NON_COACH_SMOKE_MANIFESTS.find((manifest) =>
      manifest.seedId === 'multi-reload-fixture-chain')?.steps.length === 3,
    'three-reload fixture chain was not compiled',
  );
});

void test('all non-Coach action adapters return exact typed production receipts', async () => {
  const bridge = createExplorerActionBridge(buildAdapters());
  for (const action of ACTIONS) {
    const hash = explorerActionSemanticHash(action);
    const receipt = await bridge.execute(action, {
      claim: {
        scenarioId: 'bridge-actions',
        stepId: `step-${action.type.replace('.', '-')}`,
        intendedActionSemanticHash: hash,
        expectedAcceptedRevision: 1,
        priorActionTraceId: null,
      },
    });
    expect(receipt.actionType === action.type, `${action.type} receipt type changed`);
    expect(receipt.actionSemanticHash === hash, `${action.type} receipt hash changed`);
    expect(
      receipt.owner === EXPLORER_PRODUCTION_OWNER_BY_ACTION[action.type],
      `${action.type} escaped its production owner`,
    );
  }
});

void test('maps applied, rejected, no-change, conflict and failure without reply text', () => {
  const map = (outcome: string) => mapExplorerCanonicalOutcome({
    outcome,
    applied: ['committed'],
    rejected: ['safely_rejected'],
    noChange: ['no_op'],
    conflicts: ['conflicted'],
  });
  expect(map('committed') === 'applied', 'applied mapping failed');
  expect(map('safely_rejected') === 'rejected', 'rejected mapping failed');
  expect(map('no_op') === 'no-change', 'no-change mapping failed');
  expect(map('conflicted') === 'conflict', 'conflict mapping failed');
  expect(map('Looks successful!') === 'failure', 'reply wording manufactured success');
});

void test('rejects target and action receipt mismatches', async () => {
  const action = ACTIONS[0];
  const bridge = createExplorerActionBridge(buildAdapters({
    mutateResult: (_candidate, result) => ({
      ...result,
      target: { kind: 'fixture', fixtureId: 'wrong-fixture' },
    }) as ExplorerProductionOwnerResult,
  }));
  try {
    await bridge.execute(action, {
      claim: {
        scenarioId: 'mismatch', stepId: 'step',
        intendedActionSemanticHash: explorerActionSemanticHash(action),
        expectedAcceptedRevision: 1, priorActionTraceId: null,
      },
    });
  } catch (error) {
    expect(error instanceof ExplorerActionBridgeError, 'wrong bridge error type');
    expect(
      (error as ExplorerActionBridgeError).reasonCode ===
        EXPLORER_ACTION_BRIDGE_FAILURE.TARGET_MISMATCH,
      'wrong bridge mismatch code',
    );
    return;
  }
  throw new Error('mismatched production receipt was accepted');
});

void test('coach.message remains capability-disabled', () => {
  const action: ExplorerAction = {
    type: 'coach.message',
    target: { kind: 'coach-message', conversationId: 'conversation', messageId: 'message' },
    args: { message: 'Replay this', visibleWeekId: 'week' },
    capability: { capabilityId: 'coach.message', status: 'disabled' },
  };
  try {
    assertExplorerActionExecutable(action);
  } catch (error) {
    expect(error instanceof ExplorerActionBridgeError, 'Coach disable error missing');
    return;
  }
  throw new Error('coach.message became executable');
});

void test('eligibility fails closed for missing, stale and missing-render witnesses', () => {
  const step = oneStep();
  const base: ExplorerEligibilityWitnessState = {
    acceptedRevision: 1,
    witnessRevision: 1,
    acceptedWeekCount: 1,
    availableRenderTestIds: [step.controlTestId, ...(step.targetTestIds ?? [])],
  };
  expect(evaluateExplorerStepEligibility({ step, state: base }).status === 'eligible',
    'complete witnesses were blocked');
  const missing = { ...base, acceptedWeekCount: undefined };
  expect(
    evaluateExplorerStepEligibility({ step, state: missing }).reasonCode ===
      EXPLORER_ELIGIBILITY_REASON.MISSING_WITNESS,
    'missing witness did not fail closed',
  );
  expect(
    evaluateExplorerStepEligibility({
      step,
      state: { ...base, witnessRevision: 0 },
    }).reasonCode === EXPLORER_ELIGIBILITY_REASON.STALE_WITNESS,
    'stale witness did not fail closed',
  );
  expect(
    evaluateExplorerStepEligibility({
      step,
      state: { ...base, availableRenderTestIds: [] },
    }).reasonCode === EXPLORER_ELIGIBILITY_REASON.MISSING_RENDER_WITNESS,
    'missing render observer did not block',
  );
});

void test('validates and hashes the manifest before deterministic reset', async () => {
  let resetCalls = 0;
  const result = await runExplorerScenario('invalid', {
    loadManifest: () => ({ scenarioId: 'invalid' }),
    resetSeedOnce: async () => {
      resetCalls += 1;
      throw new Error('reset must not run');
    },
  } as unknown as ExplorerRuntimeDependencies);
  expect(result.reasonCode === EXPLORER_RUNTIME_REASON.MANIFEST_INVALID,
    'invalid manifest reason changed');
  expect(resetCalls === 0, 'seed reset happened before manifest validation');
});

void test('runs ordered after-action/reload oracles and a three-reload chain once', async () => {
  const manifest = runtimeManifest(3);
  const deps = runtimeDeps(manifest);
  const result = await runExplorerScenario(manifest.scenarioId, deps);
  expect(result.status === 'complete', `runtime blocked: ${result.reasonCode}`);
  expect(result.artifactBundle !== null, 'complete runtime omitted artifact bundle');
  expect(deps.counts.reset === 1, 'scenario reseeded');
  expect(deps.counts.action === 3, 'action count changed');
  expect(deps.counts.checkpoint === 3 && deps.counts.reload === 3,
    'three-reload checkpoint progression changed');
  expect(result.actionRecords.every((record) =>
    record.afterActionOracleReceipts.length === 1 &&
    record.afterReloadOracleReceipts.length >= 2), 'oracle evaluation points changed');
  expect(result.actionRecords.every((record) =>
    record.checkpoint.checkpointEvidence.scenarioId === manifest.scenarioId &&
    record.checkpoint.checkpointEvidence.stepId === record.stepId &&
    record.reload.reloadReceipt.scenarioId === manifest.scenarioId &&
    record.reload.reloadReceipt.stepId === record.stepId &&
    record.renderReceipt.traceV2RootId === record.productionReceipt.traceV2RootId &&
    record.reload.reloadReceipt.traceV2RootId === record.productionReceipt.traceV2RootId),
  'action, trace, render, checkpoint and reload identities were not linked');
  expect(result.artifactAssembly?.productionReceipts.length === 3,
    'production receipts were not aggregated');
  expect(result.artifactAssembly?.traceV2RootChain.join(',') ===
    'trace-readiness.set-1,trace-readiness.set-2,trace-readiness.set-3',
  'TraceV2 root chain changed');
  expect(result.artifactAssembly?.reloadReceipts.map((receipt) =>
    receipt.reloadCount).join(',') === '1,2,3', 'reload receipts were not ordered');
});

void test('blocks missing render witnesses before action execution', async () => {
  const manifest = runtimeManifest(1);
  const deps = runtimeDeps(manifest, { missingRender: true });
  const result = await runExplorerScenario(manifest.scenarioId, deps);
  expect(result.status === 'blocked', 'missing render witness completed');
  expect(result.reasonCode === EXPLORER_ELIGIBILITY_REASON.MISSING_RENDER_WITNESS,
    'missing render reason changed');
  expect(deps.counts.action === 0, 'action ran without a render observer');
  expect(result.artifactAssembly?.completion.status === 'blocked',
    'blocked artifact assembly missing');
});

void test('keeps an attempted receipt when React render observation never arrives', async () => {
  const manifest = runtimeManifest(1);
  const deps = runtimeDeps(manifest);
  deps.waitForReactRender = async () => null;
  const result = await runExplorerScenario(manifest.scenarioId, deps);
  expect(result.reasonCode === EXPLORER_RUNTIME_REASON.MISSING_RENDER_WITNESS,
    'post-action missing render reason changed');
  expect(result.artifactAssembly?.productionReceipts.length === 1,
    'blocked artifact dropped the actual production receipt');
  expect(result.artifactAssembly?.traceV2RootChain.length === 1,
    'blocked artifact dropped the TraceV2 root');
});

void test('never returns complete when scenario artifact assembly is absent', async () => {
  const manifest = runtimeManifest(1);
  const deps = runtimeDeps(manifest);
  const result = await runExplorerScenario(manifest.scenarioId, {
    ...deps,
    assembleScenarioArtifact: undefined,
  } as unknown as ExplorerRuntimeDependencies);
  expect(result.status === 'blocked', 'runtime passed without scenario artifact assembly');
  expect(result.reasonCode === EXPLORER_RUNTIME_REASON.INCOMPLETE_ARTIFACT,
    'missing bundle did not produce incomplete_artifact');
  expect(result.artifactBundle === null, 'missing assembler manufactured a bundle');
});

void test('maps missing live screenshot or hierarchy to incomplete_artifact', async () => {
  const manifest = runtimeManifest(1);
  const deps = runtimeDeps(manifest);
  deps.waitForReactRender = async ({ receipt }) => ({
    traceV2RootId: receipt.traceV2RootId,
    observedTestIds: [],
    complete: false,
    incompleteArtifact: true,
  });
  const result = await runExplorerScenario(manifest.scenarioId, deps);
  expect(result.reasonCode === EXPLORER_RUNTIME_REASON.INCOMPLETE_ARTIFACT,
    'missing physical capture was reported as a product pass/failure');
});

void test('manifest budget expiry blocks all later actions without reseeding', async () => {
  const manifest = runtimeManifest(2);
  const deps = runtimeDeps(manifest);
  const times = [0, 0, manifest.budgetMs];
  deps.nowMs = () => times.shift() ?? manifest.budgetMs;
  const result = await runExplorerScenario(manifest.scenarioId, deps);
  expect(result.reasonCode === EXPLORER_RUNTIME_REASON.BUDGET_EXPIRED,
    'expired manifest budget did not fail closed');
  expect(deps.counts.action === 0, 'an action ran after budget expiry');
  expect(deps.counts.reset === 1, 'budget handling reseeded the scenario');
});

void test('repeated bridge execution produces deterministic receipt identity', async () => {
  const action = ACTIONS[8];
  const bridge = createExplorerActionBridge(buildAdapters());
  const claim = {
    scenarioId: 'deterministic', stepId: 'set-readiness',
    intendedActionSemanticHash: explorerActionSemanticHash(action),
    expectedAcceptedRevision: 1, priorActionTraceId: null,
  };
  const first = await bridge.execute(action, { claim });
  const second = await bridge.execute(action, { claim });
  expect(JSON.stringify(first) === JSON.stringify(second),
    'same typed input produced different bridge receipts');
});

setTimeout(() => {
  console.log(`\nExplorer runtime: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}, 0);
