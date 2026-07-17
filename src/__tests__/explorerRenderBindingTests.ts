import {
  bindExplorerRenderExpectationToManifestStep,
  buildExplorerRenderExpectation,
  explorerRenderExpectationIsSatisfied,
  readExplorerCorrelatedRenderReceipt,
  recordExplorerRenderedExpectation,
  registerExplorerRenderExpectation,
  __resetExplorerRenderReceiptBindingsForTest,
  type ExplorerRenderAcceptedSnapshot,
  type ExplorerRenderExpectation,
} from '../dev/e2e/explorerRenderReceiptBindings';
import {
  EXPLORER_NON_COACH_SMOKE_MANIFESTS,
} from '../dev/e2e/explorerSmokeScenarioManifests';
import type {
  ExplorerExecutableAction,
  ExplorerProductionActionReceipt,
} from '../dev/e2e/explorerActionBridge';
import { explorerActionSemanticHash } from
  '../dev/e2e/explorerScenarioContractValidation';
import {
  beginAthleteActionTrace,
  clearAthleteActionDiagnosticEvents,
  configureAthleteActionDiagnosticsForTests,
} from '../utils/athleteActionDiagnostics';

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

function identity(action: ExplorerExecutableAction): string {
  switch (action.target.kind) {
    case 'fixture': return action.target.fixtureId;
    case 'session': return action.target.sessionId;
    case 'component': return action.target.componentId;
    case 'injury-episode': return action.target.injuryEpisodeId;
    case 'readiness': return action.target.readinessId;
    case 'equipment-fact': return action.target.equipmentFactId;
    case 'session-feedback': return action.target.feedbackId;
    case 'adjustment': return `exact:${action.target.adjustmentId}`;
    case 'week': return action.target.weekId;
  }
}

function expectationFor(
  action: ExplorerExecutableAction,
  scenarioId: string,
  stepId: string,
  step: (typeof EXPLORER_NON_COACH_SMOKE_MANIFESTS)[number]['steps'][number],
): ExplorerRenderExpectation {
  const adjustmentId = `adjustment:${scenarioId}:${stepId}`;
  return bindExplorerRenderExpectationToManifestStep(
    buildExplorerRenderExpectation({
      action,
      traceV2RootId: `trace:${scenarioId}:${stepId}`,
      canonicalSemanticIdentity: identity(action),
      producedAdjustmentId: action.type === 'session.move' ||
        action.type === 'session.delete' ||
        action.type === 'component.delete' ||
        action.type === 'week.repeat'
        ? adjustmentId
        : null,
      exactAdjustmentId: action.type === 'adjustment.restore'
        ? identity(action)
        : null,
      adjustmentKind: action.type === 'adjustment.restore' &&
        scenarioId.includes('repeat-week')
        ? 'repeat_week'
        : 'fixture_change',
      feedbackTransactionId: action.type === 'session-feedback.record'
        ? `feedback-transaction:${stepId}`
        : null,
      progressionTargetSessionId: action.type === 'session-feedback.record'
        ? 'future-progression-session'
        : null,
    }),
    step,
  );
}

function satisfiedSnapshot(
  expectation: ExplorerRenderExpectation,
): ExplorerRenderAcceptedSnapshot {
  const witness = expectation.stateWitness;
  const snapshot: ExplorerRenderAcceptedSnapshot = {
    markedDays: {},
    injuryEpisodes: [],
    readinessSignalsByDate: {},
    temporarySourceFacts: [],
    reversibleAdjustments: [],
    sessionFeedback: {},
    weekScopedOverlayIds: {},
    visibleSessions: [],
  };
  switch (witness.kind) {
    case 'fixture':
      return {
        ...snapshot,
        markedDays: {
          ...(witness.targetDate ? { [witness.targetDate]: 'game' } : {}),
        },
      };
    case 'session-mutation':
      return {
        ...snapshot,
        reversibleAdjustments: [{
          id: witness.adjustmentId, kind: witness.mutation, status: 'active',
        }],
        visibleSessions: witness.mutation === 'delete'
          ? []
          : [{
              date: witness.mutation === 'move'
                ? witness.targetDate!
                : witness.sourceDate,
              sessionId: witness.sessionId,
              componentIds: [],
            }],
      };
    case 'injury':
      return {
        ...snapshot,
        injuryEpisodes: [{
          episodeId: witness.episodeId,
          status: witness.expectedStatus,
        }],
      };
    case 'readiness':
      return {
        ...snapshot,
        readinessSignalsByDate: witness.expectedStatus === 'active'
          ? { [witness.date]: { readinessId: witness.readinessId } }
          : {},
      };
    case 'equipment':
      return {
        ...snapshot,
        temporarySourceFacts: [{
          factId: witness.factId, status: witness.expectedStatus,
        }],
      };
    case 'session-feedback':
      return {
        ...snapshot,
        sessionFeedback: {
          [witness.date]: {
            outcomeReceipt: { transactionId: witness.transactionId },
          },
        },
        visibleSessions: witness.progressionTargetSessionId
          ? [{
              date: '2026-07-20',
              sessionId: witness.progressionTargetSessionId,
              componentIds: [],
            }]
          : [],
      };
    case 'adjustment':
      return {
        ...snapshot,
        reversibleAdjustments: [{
          id: witness.adjustmentId,
          kind: witness.adjustmentKind,
          status: 'cleared',
        }],
      };
    case 'repeat-week':
      return {
        ...snapshot,
        reversibleAdjustments: [{
          id: witness.adjustmentId, kind: 'repeat_week', status: 'active',
        }],
        weekScopedOverlayIds: { [witness.targetWeekStart]: 'repeat-overlay' },
      };
  }
}

function productionReceipt(args: {
  action: ExplorerExecutableAction;
  traceId: string;
  expectation: ExplorerRenderExpectation;
}): ExplorerProductionActionReceipt {
  return {
    actionType: args.action.type,
    actionSemanticHash: explorerActionSemanticHash(args.action),
    target: args.action.target,
    status: 'applied',
    owner: 'test-owner',
    receiptId: `receipt:${args.traceId}`,
    traceV2RootId: args.traceId,
    acceptedRevisionBefore: 1,
    acceptedRevisionAfter: 2,
    reasonCode: null,
    durable: true,
    productionReceipt: { explorerRenderExpectation: args.expectation },
  };
}

async function main(): Promise<void> {
  console.log('\n-- Explorer render receipt bindings --');

  await test('all nine manifests have accepted-state semantic render gates', () => {
    const expectations = EXPLORER_NON_COACH_SMOKE_MANIFESTS.flatMap((manifest) =>
      manifest.steps.map((step) => expectationFor(
        step.action as ExplorerExecutableAction,
        manifest.scenarioId,
        step.stepId,
        step,
      )));
    expect(expectations.length === 15, `expected 15 render gates, got ${expectations.length}`);
    expect(expectations.every((expectation) =>
      explorerRenderExpectationIsSatisfied(
        expectation,
        satisfiedSnapshot(expectation),
      )), 'a semantic accepted-state gate did not pass its exact witness');
  });

  await test('manifest control and target IDs remain part of exact correlation', () => {
    for (const manifest of EXPLORER_NON_COACH_SMOKE_MANIFESTS) {
      for (const step of manifest.steps) {
        const expectation = expectationFor(
          step.action as ExplorerExecutableAction,
          manifest.scenarioId,
          step.stepId,
          step,
        );
        expect(expectation.primaryControlId === step.controlTestId,
          `primary control mismatch for ${step.stepId}`);
        expect((step.targetTestIds ?? []).every((testId) =>
          expectation.requiredControlIds.includes(testId)),
        `target render ID missing for ${step.stepId}`);
      }
    }
  });

  configureAthleteActionDiagnosticsForTests({
    enabled: true,
    production: false,
    now: () => new Date('2026-07-13T12:00:00.000Z'),
    sink: () => undefined,
  });
  clearAthleteActionDiagnosticEvents();

  await test('receipt requires exact trace, observation, control and semantic identity', () => {
    __resetExplorerRenderReceiptBindingsForTest();
    const manifest = EXPLORER_NON_COACH_SMOKE_MANIFESTS.find((candidate) =>
      candidate.scenarioId === 'smoke-readiness-set-and-clear')!;
    const step = manifest.steps[0];
    const action = step.action as ExplorerExecutableAction;
    const trace = beginAthleteActionTrace({
      source: 'tap',
      actionType: 'readiness_change',
      route: 'explorer-render-test',
      scenarioRunId: manifest.scenarioId,
      scenarioStepId: step.stepId,
      seedId: manifest.seedId,
      priorActionTraceId: null,
    }, undefined, { forceRoot: true });
    const expectation = {
      ...expectationFor(action, manifest.scenarioId, step.stepId, step),
      traceV2RootId: trace.traceId,
    };
    const receipt = productionReceipt({
      action,
      traceId: trace.traceId,
      expectation,
    });
    registerExplorerRenderExpectation(expectation, receipt.productionReceipt);
    recordExplorerRenderedExpectation({
      expectation,
      renderedControlIds: expectation.requiredControlIds,
      canonicalSemanticIdentity: expectation.canonicalSemanticIdentity,
      accessibilityNode: { role: 'text' },
    });
    const correlated = readExplorerCorrelatedRenderReceipt(receipt);
    expect(correlated?.traceV2RootId === trace.traceId, 'trace did not correlate');
    expect(correlated?.observationId === expectation.observationId,
      'observation did not correlate');
    expect(correlated?.controlId === expectation.primaryControlId,
      'control did not correlate');
    expect(correlated?.canonicalSemanticIdentity ===
      expectation.canonicalSemanticIdentity, 'semantic identity did not correlate');
    expect(correlated?.complete === true, 'semantic render was not complete');
    expect(correlated?.externalArtifacts.complete === false,
      'missing external artifacts were falsely marked complete');
    expect(correlated?.externalArtifacts.screenshot === 'missing' &&
      correlated.externalArtifacts.accessibilityHierarchy === 'missing',
    'missing external artifact state was not explicit');
  });

  await test('live references are captured only when explicitly supplied', () => {
    __resetExplorerRenderReceiptBindingsForTest();
    const manifest = EXPLORER_NON_COACH_SMOKE_MANIFESTS[0];
    const step = manifest.steps[0];
    const action = step.action as ExplorerExecutableAction;
    const trace = beginAthleteActionTrace({
      source: 'tap',
      actionType: 'delete_session',
      route: 'explorer-render-live-artifact-test',
    }, undefined, { forceRoot: true });
    const expectation = {
      ...expectationFor(action, manifest.scenarioId, step.stepId, step),
      traceV2RootId: trace.traceId,
    };
    const receipt = productionReceipt({ action, traceId: trace.traceId, expectation });
    registerExplorerRenderExpectation(expectation, receipt.productionReceipt);
    recordExplorerRenderedExpectation({
      expectation,
      renderedControlIds: expectation.requiredControlIds,
      canonicalSemanticIdentity: expectation.canonicalSemanticIdentity,
      accessibilityNode: { role: 'text' },
      screenshotReference: 'screenshots/after-action.png',
      hierarchyReference: 'accessibility-hierarchy/after-action.json',
    });
    const correlated = readExplorerCorrelatedRenderReceipt(receipt);
    expect(correlated?.externalArtifacts.complete === true,
      'explicit live references were not retained');
  });

  configureAthleteActionDiagnosticsForTests(null);
  clearAthleteActionDiagnosticEvents();
  __resetExplorerRenderReceiptBindingsForTest();
  console.log(`\nExplorer render receipt bindings: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void main();
