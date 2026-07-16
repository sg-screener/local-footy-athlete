import {
  AthleteActionTraceCoordinator,
  type AthleteActionTraceRecordV2,
} from '../dev/e2e/AthleteActionTraceCoordinator';
import { collectAthleteActionArtifactBundleV2 } from '../dev/e2e/athleteActionArtifactBundle';
import { clusterAthleteActionFailure } from '../dev/e2e/athleteActionFailureClustering';
import { createDevE2EClockReceiptForSeed } from '../dev/e2e/DevE2EClock';
import type { DevE2ECheckpointRecord, DevE2EFingerprintMap } from '../dev/e2e/devE2ECheckpoint';
import { DEV_E2E_SCENARIO_PROTOCOL_VERSION } from '../dev/e2e/devE2EScenarioProtocol';
import type { DevE2EScenarioSessionRecord } from '../dev/e2e/devE2EScenarioSession';
import {
  collectExplorerScenarioArtifactBundleV1,
  type ExplorerArtifactReferenceV1,
  type ExplorerScenarioActionEvidenceV1,
  type ExplorerScenarioArtifactCollectionInputV1,
  type ExplorerScenarioArtifactBundleV1,
  type ExplorerScenarioIntendedActionReceiptV1,
} from '../dev/e2e/explorerScenarioArtifactBundle';
import {
  EXPLORER_SCENARIO_SCHEMA_VERSION,
  type ExplorerAction,
  type ExplorerScenarioContract,
  type ExplorerScenarioStep,
} from '../dev/e2e/explorerScenarioContracts';
import { explorerActionSemanticHash } from '../dev/e2e/explorerScenarioContractValidation';
import { semanticFingerprintV2 } from '../utils/semanticFingerprintV2';

export const EXPLORER_FIXTURE_SCENARIO_ID = 'scenario-artifact-three-step';
export const EXPLORER_FIXTURE_SEED_ID = 'lower-body-deletion' as const;
export const EXPLORER_FIXTURE_STEP_IDS = [
  'move-session',
  'delete-component',
  'log-session-feedback',
] as const;

const EXPLORER_FIXTURE_ACTIONS = [
  {
    type: 'session.move',
    target: { kind: 'session', sessionId: 'session-strength-1' },
    args: { fromDate: '2026-07-14', toDate: '2026-07-15' },
  },
  {
    type: 'component.delete',
    target: {
      kind: 'component',
      sessionId: 'session-strength-1',
      componentId: 'component-accessory-1',
    },
    args: { date: '2026-07-15' },
  },
  {
    type: 'session-feedback.record',
    target: {
      kind: 'session-feedback',
      sessionId: 'session-conditioning-1',
      feedbackId: 'feedback-conditioning-1',
    },
    args: {
      date: '2026-07-16',
      completion: 'full',
      feeling: 'manageable',
      soreness: 'mild',
      difficulty: 6,
    },
  },
] as const satisfies readonly ExplorerAction[];

const ACTION_SURFACES = [
  'program-card',
  'program-detail',
  'session-feedback',
] as const;

function manifestStep(index: number): ExplorerScenarioStep {
  const stepId = EXPLORER_FIXTURE_STEP_IDS[index];
  const action = EXPLORER_FIXTURE_ACTIONS[index];
  const controlTestId = `explorer-control-${index + 1}`;
  const targetTestId = `explorer-target-${index + 1}`;
  return {
    stepId,
    action,
    preconditions: [{
      predicateId: `${stepId}-revision`,
      type: 'accepted-revision',
      revision: index + 1,
    }],
    ingress: ACTION_SURFACES[index],
    controlTestId,
    targetTestIds: [targetTestId],
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
        oracleId: `${stepId}-rendered`,
        type: 'rendered-witness',
        testId: targetTestId,
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
    requiredInvariants: [
      'no-false-success',
      'durable-readback-equals-accepted-state',
      'render-equals-accepted-state',
      'trace-chain-contiguous',
      'same-seed-same-replay',
    ],
  };
}

export const EXPLORER_FIXTURE_SCENARIO_MANIFEST: ExplorerScenarioContract = {
  schemaVersion: EXPLORER_SCENARIO_SCHEMA_VERSION,
  scenarioId: EXPLORER_FIXTURE_SCENARIO_ID,
  tier: 'golden',
  seedId: EXPLORER_FIXTURE_SEED_ID,
  tags: ['explorer', 'scenario-artifact'],
  campaignSeed: 1729,
  budgetMs: 15_000,
  steps: [manifestStep(0), manifestStep(1), manifestStep(2)],
};

function ref(artifactId: string): ExplorerArtifactReferenceV1 {
  return {
    artifactId,
    contentFingerprint: semanticFingerprintV2({ artifactId, bytes: 'fixture-only' }),
  };
}

function passedActionCluster() {
  return clusterAthleteActionFailure({
    expectedMaterialChange: true,
    acceptedSemanticChanged: true,
    reportedSuccess: true,
    durableReadbackMatched: true,
    rejected: false,
    rejectionExpected: false,
    postReloadMatched: true,
    coachNoteMatchedAcceptedOwnership: true,
    restorationRequested: false,
    restorationMatchedOwnedBeforeState: true,
    fixtureMutation: false,
    fixtureHorizonValid: true,
    directAndChainedCompared: false,
    directAndChainedMatched: true,
    sourceFactCreated: false,
    programmingEffectExpected: false,
    programmingEffectObserved: false,
    coachingOutcomeAcceptable: true,
    resultCommunicationClear: true,
    equivalentControlsCompared: false,
    equivalentControlsConsistent: true,
  });
}

function sessionRecord(args: {
  stepId: string | null;
  activeTraceId: string | null;
  priorTraceId: string | null;
  reloadCount: number;
  acceptedFingerprint: string;
  persistedFingerprints: DevE2EFingerprintMap;
  clockFingerprint: string;
  nextStepId: string | null;
  status: 'eligible' | 'complete' | 'blocked';
  reasonCode: string;
}): DevE2EScenarioSessionRecord {
  return {
    protocolVersion: DEV_E2E_SCENARIO_PROTOCOL_VERSION,
    scenarioId: EXPLORER_FIXTURE_SCENARIO_ID,
    seedId: EXPLORER_FIXTURE_SEED_ID,
    checkpointStepId: args.stepId,
    activeActionTraceId: args.activeTraceId,
    priorActionTraceId: args.priorTraceId,
    reloadCount: args.reloadCount,
    currentAcceptedSemanticFingerprint: args.acceptedFingerprint,
    persistedStoreFingerprints: args.persistedFingerprints,
    clockFingerprint: args.clockFingerprint,
    nextActionEligibility: {
      nextStepId: args.nextStepId,
      status: args.status,
      reasonCode: args.reasonCode,
      witnessIds: [`fixture:${args.nextStepId ?? 'complete'}`],
    },
    updatedAt: new Date(Date.parse('2026-07-13T12:00:00.000Z') + args.reloadCount)
      .toISOString(),
  };
}

function checkpointRecord(
  stepId: string,
  trace: AthleteActionTraceRecordV2,
  priorTraceId: string | null,
  fingerprints: DevE2EFingerprintMap,
  clockFingerprint: string,
): DevE2ECheckpointRecord {
  return {
    version: 2,
    seedId: EXPLORER_FIXTURE_SEED_ID,
    checkpointId: EXPLORER_FIXTURE_SEED_ID,
    fingerprints,
    clockFingerprint,
    unfinishedAthleteActionTraces: {
      version: 2,
      fingerprintContract: trace.fingerprintContract,
      records: [trace],
    },
    scenarioId: EXPLORER_FIXTURE_SCENARIO_ID,
    checkpointStepId: stepId,
    activeActionTraceId: trace.traceId,
    priorActionTraceId: priorTraceId,
  };
}

export function cloneExplorerFixture<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createValidExplorerScenarioArtifactInput(
  scenarioManifest: ExplorerScenarioContract = EXPLORER_FIXTURE_SCENARIO_MANIFEST,
):
ExplorerScenarioArtifactCollectionInputV1 {
  const clockReceipt = createDevE2EClockReceiptForSeed(
    EXPLORER_FIXTURE_SEED_ID,
    '2026-07-13T00:00:00.000Z',
  );
  const coordinator = new AthleteActionTraceCoordinator(
    () => true,
    () => new Date('2026-07-13T12:00:00.000Z'),
  );
  const actions: ExplorerScenarioActionEvidenceV1[] = [];
  const checkpoints = [];
  const reloadReceipts = [];
  let priorTraceId: string | null = null;
  let beforeAccepted = 'accepted:initial';
  let beforePersisted: DevE2EFingerprintMap = { program: 'persisted:initial' };

  EXPLORER_FIXTURE_STEP_IDS.forEach((stepId, index) => {
    const manifestAction = scenarioManifest.steps[index].action;
    const manifestIngress = scenarioManifest.steps[index].ingress;
    const token = coordinator.startRoot({
      source: 'tap',
      actionType: manifestAction.type,
      campaignId: 'explorer-v1',
      scenarioRunId: EXPLORER_FIXTURE_SCENARIO_ID,
      scenarioStepId: stepId,
      seedId: EXPLORER_FIXTURE_SEED_ID,
      buildId: 'build-fixture-001',
      priorActionTraceId: priorTraceId,
      canonicalRequestedAction: {
        actionKind: manifestAction.type,
        targetStableId: `target-${index + 1}`,
      },
      sourceSurface: manifestIngress,
      controlId: `control-${index + 1}`,
    });
    const trace = coordinator.getRecord(token.traceId)!;
    const actionBundle = collectAthleteActionArtifactBundleV2({
      campaignId: 'explorer-v1',
      scenarioRunId: EXPLORER_FIXTURE_SCENARIO_ID,
      scenarioSeed: { seedId: EXPLORER_FIXTURE_SEED_ID },
      actionScriptYaml: `action: ${manifestAction.type}`,
      expectedOutcome: { accepted: true },
      screenshots: { [`${stepId}-after.png`]: `fixture-screenshot-${index}` },
      accessibilityHierarchies: {
        [`${stepId}-after.json`]: { id: `result-${index + 1}` },
      },
      trace,
      clockEvidence: { semanticFingerprint: clockReceipt.semanticFingerprint },
      acceptedFingerprints: { program: `accepted:${index + 1}` },
      persistedFingerprints: { program: `persisted:${index + 1}` },
      postReloadResult: { matched: true },
      failureCluster: passedActionCluster(),
    });
    const afterAccepted = `accepted:after:${index + 1}`;
    const afterPersisted = { program: `persisted:after:${index + 1}` };
    const reloadAccepted = `accepted:reload:${index + 1}`;
    const reloadPersisted = { program: `persisted:reload:${index + 1}` };
    const intendedActionReceipt: ExplorerScenarioIntendedActionReceiptV1 = {
      actionKind: manifestAction.type,
      productionSurface: manifestIngress,
      semanticInput: {
        targetStableId: `target-${index + 1}`,
        operation: manifestAction.type,
      },
    };
    actions.push({
      stepId,
      intendedActionReceipt,
      intendedActionSemanticHash: explorerActionSemanticHash(manifestAction),
      actualProductionReceiptReference: ref(`production-receipt:${stepId}`),
      actionArtifactBundle: actionBundle,
      traceV2RootId: trace.traceId,
      priorActionTraceId: priorTraceId,
      fingerprints: {
        beforeAction: {
          acceptedSemanticFingerprint: beforeAccepted,
          persistedStoreFingerprints: beforePersisted,
        },
        afterAction: {
          acceptedSemanticFingerprint: afterAccepted,
          persistedStoreFingerprints: afterPersisted,
        },
        afterReload: {
          acceptedSemanticFingerprint: reloadAccepted,
          persistedStoreFingerprints: reloadPersisted,
        },
      },
      selectorsUsed: [{
        selectorId: `selector:${stepId}`,
        strategy: 'test_id',
      }],
      screenshots: {
        afterAction: ref(`screenshot:${stepId}:after-action`),
        afterReload: ref(`screenshot:${stepId}:after-reload`),
      },
      accessibilityHierarchies: {
        afterAction: ref(`hierarchy:${stepId}:after-action`),
        afterReload: ref(`hierarchy:${stepId}:after-reload`),
      },
    });
    const checkpointSession = sessionRecord({
      stepId,
      activeTraceId: trace.traceId,
      priorTraceId,
      reloadCount: index,
      acceptedFingerprint: afterAccepted,
      persistedFingerprints: afterPersisted,
      clockFingerprint: clockReceipt.semanticFingerprint,
      nextStepId: stepId,
      status: 'blocked',
      reasonCode: 'action_in_progress',
    });
    checkpoints.push({
      scenarioId: EXPLORER_FIXTURE_SCENARIO_ID,
      stepId,
      reloadCount: index,
      checkpointRecord: checkpointRecord(
        stepId,
        trace,
        priorTraceId,
        afterPersisted,
        clockReceipt.semanticFingerprint,
      ),
      scenarioSessionRecord: checkpointSession,
    });
    const nextStepId = EXPLORER_FIXTURE_STEP_IDS[index + 1] ?? null;
    const reloadSession = sessionRecord({
      stepId,
      activeTraceId: null,
      priorTraceId: trace.traceId,
      reloadCount: index + 1,
      acceptedFingerprint: reloadAccepted,
      persistedFingerprints: reloadPersisted,
      clockFingerprint: clockReceipt.semanticFingerprint,
      nextStepId,
      status: nextStepId ? 'eligible' : 'complete',
      reasonCode: nextStepId ? 'eligible' : 'scenario_complete',
    });
    reloadReceipts.push({
      protocolVersion: 1 as const,
      receiptId: `reload-receipt:${stepId}`,
      scenarioId: EXPLORER_FIXTURE_SCENARIO_ID,
      stepId,
      reloadCount: index + 1,
      traceV2RootId: trace.traceId,
      acceptedSemanticFingerprint: reloadAccepted,
      persistedStoreFingerprints: reloadPersisted,
      clockFingerprint: clockReceipt.semanticFingerprint,
      scenarioSessionRecord: reloadSession,
    });
    priorTraceId = trace.traceId;
    beforeAccepted = reloadAccepted;
    beforePersisted = reloadPersisted;
  });

  const resetSession = sessionRecord({
    stepId: null,
    activeTraceId: null,
    priorTraceId: null,
    reloadCount: 0,
    acceptedFingerprint: 'accepted:initial',
    persistedFingerprints: { program: 'persisted:initial' },
    clockFingerprint: clockReceipt.semanticFingerprint,
    nextStepId: EXPLORER_FIXTURE_STEP_IDS[0],
    status: 'eligible',
    reasonCode: 'eligible',
  });
  const finalSession = reloadReceipts[reloadReceipts.length - 1]
    .scenarioSessionRecord;

  return {
    scenarioManifest,
    identity: {
      repositoryCommit: '9f28da0d51a62106bc85d12a14868c216de8b96d',
      buildIdentifier: 'build-fixture-001',
      deterministicClockReceipt: clockReceipt,
    },
    seedEvidence: {
      witnessReport: {
        seedId: EXPLORER_FIXTURE_SEED_ID,
        complete: true,
        witnesses: [{
          witnessId: 'witness:seed-installed',
          status: 'passed',
          evidenceFingerprint: semanticFingerprintV2({ installed: true }),
        }],
      },
      initialAcceptedSemanticFingerprint: 'accepted:initial',
      initialPersistedStoreFingerprints: { program: 'persisted:initial' },
      initialScreenshotReference: ref('screenshot:seed-initial'),
      initialAccessibilityHierarchyReference: ref('hierarchy:seed-initial'),
    },
    scenarioSessionEvidence: {
      protocolVersion: DEV_E2E_SCENARIO_PROTOCOL_VERSION,
      scenarioSessionRecordAtReset: resetSession,
      checkpointRecords: checkpoints,
      reloadReceipts,
      finalScenarioSessionRecord: finalSession,
      reloadCount: 3,
      completionStatus: {
        status: 'complete',
        reasonCode: 'scenario_complete',
      },
    },
    actions,
    oracles: scenarioManifest.steps.flatMap((step, index) =>
      step.oracleAssertions.map((oracle) => ({
        oracleId: oracle.oracleId,
        stepId: step.stepId,
        evaluationPoint: 'after_reload' as const,
        enforcement: 'hard' as const,
        evaluationStatus: 'evaluated' as const,
        expectedValue: {
          representation: 'semantic_fingerprint' as const,
          fingerprint: `accepted:reload:${index + 1}`,
        },
        actualValueOrFingerprint: {
          representation: 'semantic_fingerprint' as const,
          fingerprint: `accepted:reload:${index + 1}`,
        },
        passed: true,
        failureCode: null,
        firstDivergentProjection: null,
      }))),
    result: {
      disposition: 'passed',
      firstFailingStepId: null,
      firstFailingOracleId: null,
      firstDivergentProjection: null,
      failureClusterSignature: null,
      runnerLogReference: ref('runner-log:scenario-artifact-three-step'),
      reproductionCommand: 'npm run test:explorer-scenario-artifacts',
    },
  };
}

export function createValidExplorerScenarioArtifactBundle():
ExplorerScenarioArtifactBundleV1 {
  return collectExplorerScenarioArtifactBundleV1(
    createValidExplorerScenarioArtifactInput(),
  );
}
