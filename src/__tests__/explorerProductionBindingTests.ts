import {
  EXPLORER_PRODUCTION_OWNER_BY_ACTION,
  type ExplorerExecutableAction,
} from '../dev/e2e/explorerActionBridge';
import {
  EXPLORER_BOUND_ACTION_TYPES,
  ExplorerAdjustmentReceiptRegistry,
  createExplorerProductionBindings,
  type ExplorerCanonicalOwnerExecution,
  type ExplorerResolvedProductionTarget,
} from '../dev/e2e/explorerProductionBindings';
import {
  __resetExplorerRenderReceiptBindingsForTest,
} from '../dev/e2e/explorerRenderReceiptBindings';
import {
  EXPLORER_NON_COACH_SMOKE_MANIFESTS,
} from '../dev/e2e/explorerSmokeScenarioManifests';
import { explorerActionSemanticHash } from
  '../dev/e2e/explorerScenarioContractValidation';
import { buildDevE2ESeed } from '../dev/e2e/devE2ESeedRegistry';
import {
  beginAthleteActionTrace,
  clearAthleteActionDiagnosticEvents,
  configureAthleteActionDiagnosticsForTests,
  getAthleteActionTraceV2,
  getAthleteActionTracesV2,
} from '../utils/athleteActionDiagnostics';
import { registerAthleteActionUIOutcome } from
  '../dev/e2e/athleteActionUIObservation';

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
    type: 'readiness.set',
    target: { kind: 'readiness', readinessId: 'readiness-2026-07-13' },
    args: { date: '2026-07-13', fatigue: 2, soreness: 2, sleepQuality: 3 },
  },
  {
    type: 'readiness.clear',
    target: { kind: 'readiness', readinessId: 'readiness-2026-07-13' },
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
    target: {
      kind: 'session-feedback', sessionId: 'session-one', feedbackId: 'feedback-one',
    },
    args: {
      date: '2026-07-13', completion: 'full', feeling: 'manageable',
      soreness: 'none', difficulty: 4,
    },
  },
  {
    type: 'adjustment.restore',
    target: { kind: 'adjustment', adjustmentId: 'logical-adjustment-one' },
    args: { restoredOn: '2026-07-20' },
  },
  {
    type: 'week.repeat', target: { kind: 'week', weekId: '2026-07-13' },
    args: { sourceWeekStart: '2026-07-13', targetWeekStart: '2026-07-20' },
    capability: { capabilityId: 'week.repeat', status: 'enabled' },
  },
];

const EXPECTED_OWNER_BY_ACTION = {
  'fixture.add': 'executeFixtureMutationTransaction',
  'fixture.move': 'executeFixtureMutationTransaction',
  'fixture.remove': 'executeFixtureMutationTransaction',
  'session.move': 'commitAthleteSessionMoveTransaction',
  'session.delete': 'commitAthleteSessionDeletionTransaction',
  'component.delete': 'commitAthleteSessionDeletionTransaction',
  'injury.set': 'updateInjuryEpisode',
  'injury.resolve': 'resolveInjuryEpisode',
  'readiness.set': 'commitReadinessSignalTransaction',
  'readiness.clear': 'commitReadinessSignalTransaction',
  'equipment.set': 'transactTemporarySourceFact',
  'equipment.clear': 'transactTemporarySourceFact',
  'session-feedback.record': 'commitSessionOutcomeTransaction',
  'adjustment.restore': 'clearReversibleAdjustment',
  'week.repeat': 'repeatWeekIntoNextWeek',
} as const;

function canonicalIdentity(action: ExplorerExecutableAction): string {
  switch (action.target.kind) {
    case 'fixture': return action.target.fixtureId;
    case 'session': return action.target.sessionId;
    case 'component': return action.target.componentId;
    case 'injury-episode': return action.target.injuryEpisodeId;
    case 'readiness': return action.target.readinessId;
    case 'equipment-fact': return action.target.equipmentFactId;
    case 'session-feedback': return action.target.feedbackId;
    case 'adjustment': return 'exact-adjustment-from-producing-receipt';
    case 'week': return action.target.weekId;
  }
}

async function main(): Promise<void> {
  console.log('\n-- Explorer production bindings --');
  configureAthleteActionDiagnosticsForTests({
    enabled: false,
    production: false,
    now: () => new Date('2026-07-13T12:00:00.000Z'),
    sink: () => undefined,
  });
  clearAthleteActionDiagnosticEvents();
  const seed = buildDevE2ESeed('standard-in-season-week');
  const manifest = EXPLORER_NON_COACH_SMOKE_MANIFESTS[0];
  const step = manifest.steps[0];

  await test('all 15 declared bindings are installed exactly once', () => {
    expect(EXPLORER_BOUND_ACTION_TYPES.length === 15, 'wrong binding count');
    expect(new Set(EXPLORER_BOUND_ACTION_TYPES).size === 15, 'duplicate binding type');
    expect(ACTIONS.every((action) => EXPLORER_BOUND_ACTION_TYPES.includes(action.type)),
      'action fixture does not cover every binding');
    expect(JSON.stringify(EXPLORER_PRODUCTION_OWNER_BY_ACTION) ===
      JSON.stringify(EXPECTED_OWNER_BY_ACTION), 'canonical owner map changed');
  });

  await test('rejected, no-change, conflict and failure remain distinct receipts', async () => {
    const action = ACTIONS.find((candidate) => candidate.type === 'readiness.set')!;
    for (const status of ['rejected', 'no-change', 'conflict', 'failure'] as const) {
      __resetExplorerRenderReceiptBindingsForTest();
      let ownerCalls = 0;
      const bindings = createExplorerProductionBindings({
        dependencies: {
          readAcceptedRevision: () => 9,
          readDurableEnvelope: async () => '{"revision":9}',
          waitForPersistence: async () => undefined,
          resolveTarget: () => ({
            canonicalSemanticIdentity: canonicalIdentity(action),
            seed,
          }),
          invokeCanonicalOwner: async () => {
            ownerCalls += 1;
            return {
              status,
              reasonCode: `canonical_${status}`,
              canonicalReceipt: { status },
            };
          },
        },
      });
      const receipt = await bindings.actionBridge.execute(action, {
        claim: {
          scenarioId: manifest.scenarioId,
          stepId: step.stepId,
          intendedActionSemanticHash: explorerActionSemanticHash(action),
          expectedAcceptedRevision: 9,
          priorActionTraceId: null,
        },
      });
      expect(receipt.status === status, `${status} was collapsed to ${receipt.status}`);
      expect(receipt.reasonCode === `canonical_${status}`, `${status} reason was lost`);
      expect(receipt.acceptedRevisionBefore === 9 &&
        receipt.acceptedRevisionAfter === 9, `${status} changed revision`);
      expect(ownerCalls === 1, `${status} called the owner ${ownerCalls} times`);
    }
  });

  for (const action of ACTIONS) {
    await test(`${action.type} calls one canonical owner with captured revision`, async () => {
      __resetExplorerRenderReceiptBindingsForTest();
      let revision = 41;
      let ownerCalls = 0;
      let propagatedRevision: number | null = null;
      let resolvedTarget: ExplorerResolvedProductionTarget | null = null;
      const exactAdjustmentId = 'exact-adjustment-from-producing-receipt';
      const bindings = createExplorerProductionBindings({
        dependencies: {
          readAcceptedRevision: () => revision,
          readDurableEnvelope: async () => JSON.stringify({ revision }),
          waitForPersistence: async () => undefined,
          resolveTarget: (candidate) => ({
            canonicalSemanticIdentity: canonicalIdentity(candidate),
            seed,
            ...(candidate.type === 'adjustment.restore'
              ? { exactAdjustmentId, adjustmentKind: 'fixture_change' }
              : {}),
          }),
          invokeCanonicalOwner: async (candidate, target, acceptedRevision) => {
            ownerCalls += 1;
            propagatedRevision = acceptedRevision;
            resolvedTarget = target;
            const delta = candidate.type === 'session-feedback.record' ? 0 : 1;
            revision += delta;
            const output: ExplorerCanonicalOwnerExecution = {
              status: 'applied',
              reasonCode: null,
              canonicalReceipt: { ownerCall: ownerCalls },
              ...(candidate.type === 'session.move' ||
                candidate.type === 'session.delete' ||
                candidate.type === 'component.delete' ||
                candidate.type === 'week.repeat'
                ? { producedAdjustmentId: `produced:${candidate.type}` }
                : {}),
              ...(candidate.type === 'adjustment.restore'
                ? {
                    exactAdjustmentId: target.exactAdjustmentId,
                    adjustmentKind: target.adjustmentKind,
                  }
                : {}),
              ...(candidate.type === 'session-feedback.record'
                ? {
                    feedbackTransactionId: 'feedback-transaction-one',
                    progressionTargetSessionId: 'future-session-one',
                  }
                : {}),
            };
            return output;
          },
        },
      });
      const receipt = await bindings.actionBridge.execute(action, {
        claim: {
          scenarioId: manifest.scenarioId,
          stepId: step.stepId,
          intendedActionSemanticHash: explorerActionSemanticHash(action),
          expectedAcceptedRevision: 41,
          priorActionTraceId: 'prior-trace-one',
        },
      });
      expect(ownerCalls === 1, `owner called ${ownerCalls} times`);
      expect(propagatedRevision === 41, `revision propagated as ${propagatedRevision}`);
      expect(receipt.acceptedRevisionBefore === 41, 'receipt lost before revision');
      expect(receipt.acceptedRevisionAfter ===
        (action.type === 'session-feedback.record' ? 41 : 42),
      'receipt lost after revision');
      expect(receipt.owner === EXPLORER_PRODUCTION_OWNER_BY_ACTION[action.type],
        'canonical owner name mismatch');
      if (action.type === 'adjustment.restore') {
        expect(resolvedTarget?.exactAdjustmentId === exactAdjustmentId,
          'restore did not receive exact producing receipt ID');
      }
    });
  }

  await test('fixture chain restore binds only the manifest baseline receipt', () => {
    const chain = EXPLORER_NON_COACH_SMOKE_MANIFESTS.find((candidate) =>
      candidate.scenarioId ===
        'smoke-multi-reload-fixture-session-restoration-chain')!;
    const registry = new ExplorerAdjustmentReceiptRegistry();
    registry.recordProducedAdjustment({
      manifest: chain,
      sourceStepId: 'move-fixture',
      exactAdjustmentId: 'exact-fixture-adjustment',
    });
    registry.recordProducedAdjustment({
      manifest: chain,
      sourceStepId: 'delete-following-monday-session',
      exactAdjustmentId: 'unrelated-session-adjustment',
    });
    expect(registry.resolveExactAdjustmentId(
      chain.scenarioId,
      'receipt-from-move-fixture',
    ) === 'exact-fixture-adjustment', 'restore rebound to unrelated later adjustment');
  });

  await test('Repeat Week restore binds its exact producing receipt', () => {
    const repeat = EXPLORER_NON_COACH_SMOKE_MANIFESTS.find((candidate) =>
      candidate.scenarioId ===
        'smoke-repeat-week-phase-transition-and-restore')!;
    const registry = new ExplorerAdjustmentReceiptRegistry();
    registry.recordProducedAdjustment({
      manifest: repeat,
      sourceStepId: 'repeat-week',
      exactAdjustmentId: 'exact-repeat-week-adjustment',
    });
    expect(registry.resolveExactAdjustmentId(
      repeat.scenarioId,
      'receipt-from-repeat-week',
    ) === 'exact-repeat-week-adjustment', 'Repeat Week exact ID was not retained');
  });

  await test('one binding execution owns one TraceV2 root with exact prior linkage', async () => {
    __resetExplorerRenderReceiptBindingsForTest();
    configureAthleteActionDiagnosticsForTests({
      enabled: true,
      production: false,
      now: () => new Date('2026-07-13T12:00:00.000Z'),
      sink: () => undefined,
    });
    clearAthleteActionDiagnosticEvents();
    let revision = 17;
    const action = ACTIONS.find((candidate) => candidate.type === 'readiness.set')!;
    const bindings = createExplorerProductionBindings({
      dependencies: {
        readAcceptedRevision: () => revision,
        readDurableEnvelope: async () => JSON.stringify({ revision }),
        waitForPersistence: async () => undefined,
        resolveTarget: () => ({
          canonicalSemanticIdentity: canonicalIdentity(action),
          seed,
        }),
        invokeCanonicalOwner: async () => {
          revision += 1;
          return {
            status: 'applied',
            reasonCode: null,
            canonicalReceipt: { revision },
          };
        },
      },
    });
    const receipt = await bindings.actionBridge.execute(action, {
      claim: {
        scenarioId: manifest.scenarioId,
        stepId: step.stepId,
        intendedActionSemanticHash: explorerActionSemanticHash(action),
        expectedAcceptedRevision: 17,
        priorActionTraceId: 'prior-production-trace',
      },
    });
    const trace = getAthleteActionTraceV2(receipt.traceV2RootId);
    expect(getAthleteActionTracesV2().length === 1, 'binding created nested or duplicate roots');
    expect(trace?.root.scenarioRunId.status === 'captured' &&
      trace.root.scenarioRunId.value === manifest.scenarioId,
    'scenario identity was not captured on TraceV2');
    expect(trace?.root.scenarioStepId.status === 'captured' &&
      trace.root.scenarioStepId.value === step.stepId,
    'step identity was not captured on TraceV2');
    expect(trace?.root.priorActionTraceId.status === 'captured' &&
      trace.root.priorActionTraceId.value === 'prior-production-trace',
    'priorActionTraceId was not captured on TraceV2');
    expect(trace?.root.actionType.status === 'captured' &&
      trace.root.actionType.value === action.type &&
      trace.root.sourceSurface.status === 'captured' &&
      trace.root.sourceSurface.value === step.ingress,
    'TraceV2 root did not preserve canonical Explorer action/surface identity');
    configureAthleteActionDiagnosticsForTests({
      enabled: false,
      production: false,
      now: () => new Date('2026-07-13T12:00:00.000Z'),
      sink: () => undefined,
    });
    clearAthleteActionDiagnosticEvents();
  });

  await test('exact restoration receipt rehydrates through the prior TraceV2 chain', () => {
    configureAthleteActionDiagnosticsForTests({
      enabled: true,
      production: false,
      now: () => new Date('2026-07-13T12:00:00.000Z'),
      sink: () => undefined,
    });
    clearAthleteActionDiagnosticEvents();
    const chain = EXPLORER_NON_COACH_SMOKE_MANIFESTS.find((candidate) =>
      candidate.scenarioId ===
        'smoke-multi-reload-fixture-session-restoration-chain')!;
    const moveTrace = beginAthleteActionTrace({
      source: 'tap',
      actionType: 'game_day_change',
      route: 'explorer-production-binding:fixture.move',
      scenarioRunId: chain.scenarioId,
      scenarioStepId: 'move-fixture',
      seedId: chain.seedId,
      priorActionTraceId: null,
    }, undefined, { forceRoot: true });
    registerAthleteActionUIOutcome({
      traceId: moveTrace.traceId,
      observationId: 'move-observation',
      domainReturn: {
        resolvedCanonicalTarget: {
          producedAdjustmentId: 'exact-fixture-adjustment-after-reload',
        },
      },
    });
    const deleteTrace = beginAthleteActionTrace({
      source: 'tap',
      actionType: 'delete_session',
      route: 'explorer-production-binding:session.delete',
      scenarioRunId: chain.scenarioId,
      scenarioStepId: 'delete-following-monday-session',
      seedId: chain.seedId,
      priorActionTraceId: moveTrace.traceId,
    }, undefined, { forceRoot: true });
    registerAthleteActionUIOutcome({
      traceId: deleteTrace.traceId,
      observationId: 'delete-observation',
      domainReturn: {
        resolvedCanonicalTarget: {
          producedAdjustmentId: 'unrelated-session-adjustment-after-reload',
        },
      },
    });
    const registry = new ExplorerAdjustmentReceiptRegistry();
    const exact = registry.hydrateFromPriorTraceChain({
      manifest: chain,
      logicalAdjustmentId: 'receipt-from-move-fixture',
      priorActionTraceId: deleteTrace.traceId,
    });
    expect(exact === 'exact-fixture-adjustment-after-reload',
      `rehydration selected ${String(exact)}`);
    configureAthleteActionDiagnosticsForTests({
      enabled: false,
      production: false,
      now: () => new Date('2026-07-13T12:00:00.000Z'),
      sink: () => undefined,
    });
    clearAthleteActionDiagnosticEvents();
  });

  configureAthleteActionDiagnosticsForTests(null);
  __resetExplorerRenderReceiptBindingsForTest();
  console.log(`\nExplorer production bindings: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void main();
