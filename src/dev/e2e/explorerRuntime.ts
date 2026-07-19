import {
  ExplorerActionBridgeError,
  assertExplorerActionExecutable,
  type ExplorerActionClaimReceipt,
  type ExplorerProductionActionReceipt,
} from './explorerActionBridge';
import {
  createExplorerActionIngressRequest,
  explorerCanonicalTargetIds,
  type ExplorerActionIngressRequest,
} from './explorerActionIngress';
import {
  evaluateExplorerStepEligibility,
  type ExplorerEligibilityWitnessState,
  type ExplorerStepEligibilityReceipt,
} from './explorerEligibility';
import {
  evaluateExplorerStepOracles,
  summarizeExplorerOracleEvaluations,
  type ExplorerOracleEvaluationContext,
  type ExplorerOracleEvaluationReceipt,
} from './explorerOracleEvaluator';
import type {
  ExplorerScenarioActionEvidenceV1,
  ExplorerScenarioArtifactBundleV1,
  ExplorerScenarioCheckpointEvidenceV1,
  ExplorerScenarioReloadReceiptV1,
  ExplorerScenarioSeedEvidenceV1,
} from './explorerScenarioArtifactBundle';
import {
  EXPLORER_SCENARIO_ARTIFACT_FAILURE,
  ExplorerScenarioArtifactValidationError,
} from './explorerScenarioArtifactBundle';
import {
  explorerActionSemanticHash,
  explorerScenarioSemanticHash,
  validateExplorerScenarioContract,
  type ExplorerActionSemanticHash,
  type ExplorerScenarioSemanticHash,
} from './explorerScenarioContractValidation';
import {
  EXPLORER_PRODUCTION_CAPABILITY_DECLARATIONS,
  type ExplorerScenarioContract,
  type ExplorerScenarioStep,
} from './explorerScenarioContracts';
import {
  createExplorerPhysicalCaptureRequest,
  explorerEvidenceArtifactReference,
  validateExplorerPhysicalEvidenceReceipt,
  type ExplorerPhysicalCaptureRequestV1,
  type ExplorerPhysicalEvidenceReceiptV1,
} from './explorerPhysicalEvidence';

export const EXPLORER_RUNTIME_PROTOCOL_VERSION = 1 as const;

export const EXPLORER_RUNTIME_REASON = Object.freeze({
  COMPLETE: 'scenario_complete',
  MANIFEST_NOT_FOUND: 'manifest_not_found',
  MANIFEST_INVALID: 'manifest_invalid',
  SEED_RESET_FAILED: 'seed_reset_failed',
  SEED_WITNESS_FAILED: 'seed_witness_failed',
  RESEED_FORBIDDEN: 'scenario_reseed_forbidden',
  ELIGIBILITY_FAILED: 'eligibility_failed',
  MISSING_RENDER_WITNESS: 'missing_render_witness',
  ACTION_RECEIPT_MISSING: 'action_receipt_missing',
  MANIFEST_RECEIPT_MISMATCH: 'manifest_production_receipt_mismatch',
  ACCEPTED_PERSISTED_MISMATCH: 'accepted_persisted_state_mismatch',
  TRACE_LINKAGE_BROKEN: 'trace_v2_linkage_broken',
  HARD_ORACLE_FAILED: 'hard_oracle_failed',
  CHECKPOINT_FAILED: 'checkpoint_failed',
  RELOAD_ORDER_INVALID: 'reload_checkpoint_order_invalid',
  ARTIFACT_ASSEMBLY_FAILED: 'artifact_assembly_failed',
  INCOMPLETE_ARTIFACT: 'incomplete_artifact',
  BUDGET_EXPIRED: 'budget_expired',
  DUPLICATED_MUTATION_REQUIRED: 'duplicated_mutation_logic_required',
} as const);

export type ExplorerRuntimeReasonCode =
  (typeof EXPLORER_RUNTIME_REASON)[keyof typeof EXPLORER_RUNTIME_REASON] | string;

export interface ExplorerRuntimeEligibilityMarker {
  readonly markerId: string;
  readonly scenarioId: string;
  readonly stepId: string;
  readonly actionSemanticHash: ExplorerActionSemanticHash;
  readonly witnessIds: readonly string[];
}

export interface ExplorerRuntimeSeedResetReceipt {
  readonly resetId: string;
  readonly seedId: string;
  readonly seedEvidence: ExplorerScenarioSeedEvidenceV1;
}

export interface ExplorerRuntimeRenderReceipt {
  readonly traceV2RootId: string;
  readonly observedTestIds: readonly string[];
  readonly complete: boolean;
  readonly incompleteArtifact?: boolean;
  readonly controlId?: string;
  readonly observationId?: string;
  readonly canonicalSemanticIdentity?: string;
  readonly externalArtifacts?: {
    readonly screenshot: 'captured' | 'missing';
    readonly accessibilityHierarchy: 'captured' | 'missing';
    readonly complete: boolean;
  };
}

export interface ExplorerRuntimeCheckpointReceipt {
  readonly checkpointEvidence: ExplorerScenarioCheckpointEvidenceV1;
  readonly order: number;
}

export interface ExplorerRuntimeReloadReceipt {
  readonly reloadReceipt: ExplorerScenarioReloadReceiptV1;
  readonly order: number;
}

export interface ExplorerRuntimeActionRecord {
  readonly stepId: string;
  readonly intendedActionSemanticHash: ExplorerActionSemanticHash;
  readonly productionReceipt: ExplorerProductionActionReceipt;
  readonly renderReceipt: ExplorerRuntimeRenderReceipt;
  readonly eligibility: ExplorerStepEligibilityReceipt;
  readonly afterActionOracleReceipts: readonly ExplorerOracleEvaluationReceipt[];
  readonly afterReloadOracleReceipts: readonly ExplorerOracleEvaluationReceipt[];
  readonly checkpoint: ExplorerRuntimeCheckpointReceipt;
  readonly reload: ExplorerRuntimeReloadReceipt;
  readonly artifactEvidence: ExplorerScenarioActionEvidenceV1;
  readonly physicalEvidence: {
    readonly afterAction: ExplorerPhysicalEvidenceReceiptV1;
    readonly afterReload: ExplorerPhysicalEvidenceReceiptV1;
  };
}

export interface ExplorerRuntimeArtifactAssemblyV1 {
  readonly protocolVersion: typeof EXPLORER_RUNTIME_PROTOCOL_VERSION;
  readonly manifest: ExplorerScenarioContract;
  readonly manifestSemanticHash: ExplorerScenarioSemanticHash;
  readonly seedEvidence: ExplorerScenarioSeedEvidenceV1 | null;
  readonly intendedActionSemanticHashes: readonly ExplorerActionSemanticHash[];
  readonly productionReceipts: readonly ExplorerProductionActionReceipt[];
  readonly traceV2RootChain: readonly string[];
  readonly checkpoints: readonly ExplorerScenarioCheckpointEvidenceV1[];
  readonly reloadReceipts: readonly ExplorerScenarioReloadReceiptV1[];
  readonly oracleReceipts: readonly ExplorerOracleEvaluationReceipt[];
  readonly actionEvidence: readonly ExplorerScenarioActionEvidenceV1[];
  readonly physicalEvidenceReceipts: readonly ExplorerPhysicalEvidenceReceiptV1[];
  readonly firstDivergentStepId: string | null;
  readonly firstDivergentProjection: string | null;
  readonly completion: {
    readonly status: 'complete' | 'blocked';
    readonly reasonCode: ExplorerRuntimeReasonCode;
  };
}

export interface ExplorerRuntimeResult {
  readonly status: 'complete' | 'blocked';
  readonly reasonCode: ExplorerRuntimeReasonCode;
  readonly manifestSemanticHash: ExplorerScenarioSemanticHash | null;
  readonly failedStepId: string | null;
  readonly firstDivergentProjection: string | null;
  readonly actionRecords: readonly ExplorerRuntimeActionRecord[];
  readonly artifactAssembly: ExplorerRuntimeArtifactAssemblyV1 | null;
  readonly artifactBundle: ExplorerScenarioArtifactBundleV1 | null;
}

export interface ExplorerRuntimeActionArtifactInput {
  readonly manifest: ExplorerScenarioContract;
  readonly step: ExplorerScenarioStep;
  readonly receipt: ExplorerProductionActionReceipt;
  readonly renderReceipt: ExplorerRuntimeRenderReceipt;
  readonly checkpoint: ExplorerRuntimeCheckpointReceipt;
  readonly reload: ExplorerRuntimeReloadReceipt;
  readonly oracleReceipts: readonly ExplorerOracleEvaluationReceipt[];
}

export interface ExplorerRuntimeCommonDependencies {
  /** Returns raw data; runtime validation and hashing always happen before reset. */
  readonly loadManifest: (scenarioId: string) => unknown | null;
  readonly resetSeedOnce: (seedId: string) => Promise<ExplorerRuntimeSeedResetReceipt>;
  readonly readEligibilityWitnessState: (
    manifest: ExplorerScenarioContract,
    step: ExplorerScenarioStep,
  ) => Promise<ExplorerEligibilityWitnessState>;
  readonly publishEligibilityMarker: (
    marker: ExplorerRuntimeEligibilityMarker,
  ) => Promise<void> | void;
  readonly waitForReactRender: (args: {
    readonly manifest: ExplorerScenarioContract;
    readonly step: ExplorerScenarioStep;
    readonly receipt: ExplorerProductionActionReceipt;
  }) => Promise<ExplorerRuntimeRenderReceipt | null>;
  readonly captureOracleContext: (args: {
    readonly manifest: ExplorerScenarioContract;
    readonly step: ExplorerScenarioStep;
    readonly point: 'after-action' | 'after-reload';
    readonly receipt: ExplorerProductionActionReceipt;
    readonly priorActionTraceId: string | null;
  }) => Promise<ExplorerOracleEvaluationContext>;
  readonly checkpointScenarioStep: (args: {
    readonly manifest: ExplorerScenarioContract;
    readonly step: ExplorerScenarioStep;
    readonly receipt: ExplorerProductionActionReceipt;
    readonly order: number;
  }) => Promise<ExplorerRuntimeCheckpointReceipt>;
  /** scenario-session V2 is the sole implementation behind this dependency. */
  readonly coldReloadScenarioSessionV2: (args: {
    readonly manifest: ExplorerScenarioContract;
    readonly step: ExplorerScenarioStep;
    readonly checkpoint: ExplorerRuntimeCheckpointReceipt;
    readonly order: number;
  }) => Promise<ExplorerRuntimeReloadReceipt>;
  readonly assembleActionEvidence: (
    input: ExplorerRuntimeActionArtifactInput,
  ) => Promise<ExplorerScenarioActionEvidenceV1>;
  readonly assembleScenarioArtifact: (
    assembly: ExplorerRuntimeArtifactAssemblyV1,
  ) => Promise<ExplorerScenarioArtifactBundleV1>;
  readonly physicalEvidence: {
    readonly campaignId: string;
    readonly integratedRepositorySha: string;
    readonly deterministicClockFingerprint: () => string;
    readonly requestCapture: (
      request: ExplorerPhysicalCaptureRequestV1,
    ) => Promise<ExplorerPhysicalEvidenceReceiptV1>;
  };
  readonly nowMs?: () => number;
}

/** Pure/injected tests may execute a deterministic adapter directly. */
export interface ExplorerSyntheticRuntimeDependencies
  extends ExplorerRuntimeCommonDependencies {
  readonly actionExecutionMode: 'synthetic-direct-adapter';
  readonly executeProductionAction: (
    action: Exclude<ExplorerScenarioStep['action'], { readonly type: 'coach.message' }>,
    claim: ExplorerActionClaimReceipt,
  ) => Promise<ExplorerProductionActionReceipt>;
}

/** The live host persists and waits; it has no production execution capability. */
export interface ExplorerLiveRuntimeDependencies
  extends ExplorerRuntimeCommonDependencies {
  readonly actionExecutionMode: 'live-external-action-ingress';
  readonly persistActionIngressRequest: (
    request: ExplorerActionIngressRequest,
  ) => Promise<void>;
  readonly waitForExternalActionIngress: (
    request: ExplorerActionIngressRequest,
  ) => Promise<ExplorerProductionActionReceipt>;
}

export type ExplorerRuntimeDependencies =
  | ExplorerSyntheticRuntimeDependencies
  | ExplorerLiveRuntimeDependencies;

function artifactFailureReason(error: unknown): ExplorerRuntimeReasonCode {
  return error instanceof ExplorerScenarioArtifactValidationError && (
    error.code === EXPLORER_SCENARIO_ARTIFACT_FAILURE.SCREENSHOT_MISSING ||
    error.code === EXPLORER_SCENARIO_ARTIFACT_FAILURE.HIERARCHY_MISSING
  )
    ? EXPLORER_RUNTIME_REASON.INCOMPLETE_ARTIFACT
    : EXPLORER_RUNTIME_REASON.ARTIFACT_ASSEMBLY_FAILED;
}

async function capturePhysicalEvidence(args: {
  deps: ExplorerRuntimeDependencies;
  manifest: ExplorerScenarioContract;
  manifestSemanticHash: ExplorerScenarioSemanticHash;
  step?: ExplorerScenarioStep;
  stepOrdinal?: number;
  capturePhase: 'seed-reset' | 'after-action' | 'after-reload';
  reloadCount: number;
  traceId: string | null;
  controlId: string | null;
  observationId: string | null;
  canonicalSemanticIdentity: string;
}): Promise<ExplorerPhysicalEvidenceReceiptV1> {
  const clockFingerprint = args.deps.physicalEvidence.deterministicClockFingerprint();
  const request = createExplorerPhysicalCaptureRequest({
    campaignId: args.deps.physicalEvidence.campaignId,
    scenarioId: args.manifest.scenarioId,
    ...(args.step ? { stepId: args.step.stepId } : {}),
    ...(args.stepOrdinal === undefined ? {} : { stepOrdinal: args.stepOrdinal }),
    capturePhase: args.capturePhase,
    reloadCount: args.reloadCount,
    traceId: args.traceId,
    controlId: args.controlId,
    observationId: args.observationId,
    expectedSemanticIdentity: {
      manifestSemanticHash: args.manifestSemanticHash,
      actionSemanticHash: args.step
        ? explorerActionSemanticHash(args.step.action)
        : null,
      canonicalSemanticIdentity: args.canonicalSemanticIdentity,
    },
    deterministicClockFingerprint: clockFingerprint,
  });
  const receipt = await args.deps.physicalEvidence.requestCapture(request);
  return validateExplorerPhysicalEvidenceReceipt({
    request,
    receipt,
    expectedIntegratedRepositorySha:
      args.deps.physicalEvidence.integratedRepositorySha,
    currentDeterministicClockFingerprint: clockFingerprint,
  });
}

function markerFor(
  manifest: ExplorerScenarioContract,
  step: ExplorerScenarioStep,
  eligibility: ExplorerStepEligibilityReceipt,
): ExplorerRuntimeEligibilityMarker {
  const actionSemanticHash = explorerActionSemanticHash(step.action);
  return {
    markerId: `e2e-explorer-next-action-eligible-${manifest.scenarioId}-${step.stepId}`,
    scenarioId: manifest.scenarioId,
    stepId: step.stepId,
    actionSemanticHash,
    witnessIds: [...eligibility.witnessIds],
  };
}

const AFTER_ACTION_ORACLES = new Set([
  'accepted-state-projection',
  'absence',
  'semantic-fingerprint',
  'rendered-witness',
  'unrelated-state-unchanged',
]);

function stepAtPoint(
  step: ExplorerScenarioStep,
  point: 'after-action' | 'after-reload',
): ExplorerScenarioStep {
  const afterAction = point === 'after-action';
  return {
    ...step,
    oracleAssertions: step.oracleAssertions.filter((oracle) =>
      AFTER_ACTION_ORACLES.has(oracle.type) === afterAction),
  };
}

function evaluateAtPoint(
  step: ExplorerScenarioStep,
  context: ExplorerOracleEvaluationContext,
  point: 'after-action' | 'after-reload',
): readonly ExplorerOracleEvaluationReceipt[] {
  if (context.evaluationPoint !== point) {
    throw new Error(`oracle_context_point_mismatch:${point}:${context.evaluationPoint}`);
  }
  return evaluateExplorerStepOracles(stepAtPoint(step, point), context);
}

function receiptAgreesWithManifest(
  step: ExplorerScenarioStep,
  receipt: ExplorerProductionActionReceipt,
): boolean {
  if (step.expectedOutcome.kind === 'accepted') {
    return receipt.status === 'applied' &&
      receipt.acceptedRevisionAfter - receipt.acceptedRevisionBefore ===
        step.expectedOutcome.acceptedRevisionDelta;
  }
  if (step.expectedOutcome.kind === 'rejected') {
    return receipt.status === 'rejected' &&
      receipt.reasonCode === step.expectedOutcome.reasonCode;
  }
  return false;
}

function buildAssembly(args: {
  manifest: ExplorerScenarioContract;
  manifestSemanticHash: ExplorerScenarioSemanticHash;
  seedEvidence: ExplorerScenarioSeedEvidenceV1 | null;
  records: readonly ExplorerRuntimeActionRecord[];
  attemptedReceipts?: readonly ExplorerProductionActionReceipt[];
  status: 'complete' | 'blocked';
  reasonCode: ExplorerRuntimeReasonCode;
  failedStepId: string | null;
  firstDivergentProjection: string | null;
  physicalEvidenceReceipts?: readonly ExplorerPhysicalEvidenceReceiptV1[];
}): ExplorerRuntimeArtifactAssemblyV1 {
  return {
    protocolVersion: EXPLORER_RUNTIME_PROTOCOL_VERSION,
    manifest: args.manifest,
    manifestSemanticHash: args.manifestSemanticHash,
    seedEvidence: args.seedEvidence,
    intendedActionSemanticHashes: args.manifest.steps.map((step) =>
      explorerActionSemanticHash(step.action)),
    productionReceipts: args.attemptedReceipts ??
      args.records.map((record) => record.productionReceipt),
    traceV2RootChain: (args.attemptedReceipts ??
      args.records.map((record) => record.productionReceipt)).map((receipt) =>
        receipt.traceV2RootId),
    checkpoints: args.records.map((record) => record.checkpoint.checkpointEvidence),
    reloadReceipts: args.records.map((record) => record.reload.reloadReceipt),
    oracleReceipts: args.records.flatMap((record) => [
      ...record.afterActionOracleReceipts,
      ...record.afterReloadOracleReceipts,
    ]),
    actionEvidence: args.records.map((record) => record.artifactEvidence),
    physicalEvidenceReceipts: args.physicalEvidenceReceipts ?? args.records.flatMap((record) => [
      record.physicalEvidence.afterAction,
      record.physicalEvidence.afterReload,
    ]),
    firstDivergentStepId: args.failedStepId,
    firstDivergentProjection: args.firstDivergentProjection,
    completion: { status: args.status, reasonCode: args.reasonCode },
  };
}

function blocked(args: {
  manifest: ExplorerScenarioContract;
  manifestSemanticHash: ExplorerScenarioSemanticHash;
  seedEvidence: ExplorerScenarioSeedEvidenceV1 | null;
  records: readonly ExplorerRuntimeActionRecord[];
  attemptedReceipts?: readonly ExplorerProductionActionReceipt[];
  reasonCode: ExplorerRuntimeReasonCode;
  failedStepId: string | null;
  firstDivergentProjection?: string | null;
}): ExplorerRuntimeResult {
  const firstDivergentProjection = args.firstDivergentProjection ?? null;
  return {
    status: 'blocked',
    reasonCode: args.reasonCode,
    manifestSemanticHash: args.manifestSemanticHash,
    failedStepId: args.failedStepId,
    firstDivergentProjection,
    actionRecords: [...args.records],
    artifactAssembly: buildAssembly({
      ...args,
      status: 'blocked',
      firstDivergentProjection,
    }),
    artifactBundle: null,
  };
}

/**
 * Canonical Explorer runtime. It coordinates receipts and evidence only; every
 * domain mutation is delegated to the typed action bridge's production owner.
 */
export async function runExplorerScenario(
  scenarioId: string,
  deps: ExplorerRuntimeDependencies,
): Promise<ExplorerRuntimeResult> {
  const rawManifest = deps.loadManifest(scenarioId);
  if (rawManifest === null) {
    return {
      status: 'blocked',
      reasonCode: EXPLORER_RUNTIME_REASON.MANIFEST_NOT_FOUND,
      manifestSemanticHash: null,
      failedStepId: null,
      firstDivergentProjection: null,
      actionRecords: [],
      artifactAssembly: null,
      artifactBundle: null,
    };
  }
  let manifest: ExplorerScenarioContract;
  let manifestSemanticHash: ExplorerScenarioSemanticHash;
  try {
    manifest = validateExplorerScenarioContract(rawManifest, {
      declaredCapabilities: EXPLORER_PRODUCTION_CAPABILITY_DECLARATIONS,
    });
    manifestSemanticHash = explorerScenarioSemanticHash(manifest);
  } catch {
    return {
      status: 'blocked',
      reasonCode: EXPLORER_RUNTIME_REASON.MANIFEST_INVALID,
      manifestSemanticHash: null,
      failedStepId: null,
      firstDivergentProjection: null,
      actionRecords: [],
      artifactAssembly: null,
      artifactBundle: null,
    };
  }

  const nowMs = deps.nowMs ?? Date.now;
  const startedAtMs = nowMs();
  const budgetExpired = () => nowMs() - startedAtMs >= manifest.budgetMs;

  const records: ExplorerRuntimeActionRecord[] = [];
  const attemptedReceipts: ExplorerProductionActionReceipt[] = [];
  if (budgetExpired()) {
    return blocked({
      manifest,
      manifestSemanticHash,
      seedEvidence: null,
      records,
      reasonCode: EXPLORER_RUNTIME_REASON.BUDGET_EXPIRED,
      failedStepId: null,
    });
  }
  let seedReceipt: ExplorerRuntimeSeedResetReceipt;
  try {
    seedReceipt = await deps.resetSeedOnce(manifest.seedId);
  } catch {
    return blocked({
      manifest,
      manifestSemanticHash,
      seedEvidence: null,
      records,
      reasonCode: EXPLORER_RUNTIME_REASON.SEED_RESET_FAILED,
      failedStepId: null,
    });
  }
  if (seedReceipt.seedId !== manifest.seedId ||
    !seedReceipt.seedEvidence.witnessReport.complete ||
    seedReceipt.seedEvidence.witnessReport.witnesses.some((witness) =>
      witness.status !== 'passed')) {
    return blocked({
      manifest,
      manifestSemanticHash,
      seedEvidence: seedReceipt.seedEvidence,
      records,
      reasonCode: EXPLORER_RUNTIME_REASON.SEED_WITNESS_FAILED,
      failedStepId: null,
    });
  }
  let seedPhysicalEvidence: ExplorerPhysicalEvidenceReceiptV1;
  try {
    seedPhysicalEvidence = await capturePhysicalEvidence({
      deps,
      manifest,
      manifestSemanticHash,
      capturePhase: 'seed-reset',
      reloadCount: 0,
      traceId: null,
      controlId: null,
      observationId: null,
      canonicalSemanticIdentity: manifestSemanticHash,
    });
  } catch {
    return blocked({
      manifest,
      manifestSemanticHash,
      seedEvidence: seedReceipt.seedEvidence,
      records,
      reasonCode: EXPLORER_RUNTIME_REASON.INCOMPLETE_ARTIFACT,
      failedStepId: null,
    });
  }
  seedReceipt = {
    ...seedReceipt,
    seedEvidence: {
      ...seedReceipt.seedEvidence,
      initialScreenshotReference:
        explorerEvidenceArtifactReference(seedPhysicalEvidence.screenshot),
      initialAccessibilityHierarchyReference:
        explorerEvidenceArtifactReference(seedPhysicalEvidence.hierarchy),
    },
  };
  const physicalEvidenceReceipts: ExplorerPhysicalEvidenceReceiptV1[] = [
    seedPhysicalEvidence,
  ];

  let priorActionTraceId: string | null = null;
  for (let index = 0; index < manifest.steps.length; index += 1) {
    const step = manifest.steps[index];
    if (budgetExpired()) {
      return blocked({
        manifest,
        manifestSemanticHash,
        seedEvidence: seedReceipt.seedEvidence,
        records,
        attemptedReceipts,
        reasonCode: EXPLORER_RUNTIME_REASON.BUDGET_EXPIRED,
        failedStepId: step.stepId,
      });
    }
    let witnessState: ExplorerEligibilityWitnessState;
    let eligibility: ExplorerStepEligibilityReceipt;
    try {
      witnessState = await deps.readEligibilityWitnessState(manifest, step);
      eligibility = evaluateExplorerStepEligibility({ step, state: witnessState });
    } catch (error) {
      return blocked({
        manifest,
        manifestSemanticHash,
        seedEvidence: seedReceipt.seedEvidence,
        records,
        attemptedReceipts,
        reasonCode: EXPLORER_RUNTIME_REASON.ELIGIBILITY_FAILED,
        failedStepId: step.stepId,
      });
    }
    if (eligibility.status !== 'eligible') {
      return blocked({
        manifest,
        manifestSemanticHash,
        seedEvidence: seedReceipt.seedEvidence,
        records,
        reasonCode: eligibility.reasonCode,
        failedStepId: step.stepId,
      });
    }
    const marker = markerFor(manifest, step, eligibility);
    const claim: ExplorerActionClaimReceipt = {
      campaignId: deps.physicalEvidence.campaignId,
      scenarioId: manifest.scenarioId,
      stepId: step.stepId,
      intendedActionSemanticHash: marker.actionSemanticHash,
      expectedAcceptedRevision: witnessState.acceptedRevision,
      priorActionTraceId,
    };
    let ingressRequest: ExplorerActionIngressRequest | null = null;
    try {
      if (deps.actionExecutionMode === 'live-external-action-ingress') {
        ingressRequest = createExplorerActionIngressRequest({
          campaignId: deps.physicalEvidence.campaignId,
          scenarioId: manifest.scenarioId,
          stepId: step.stepId,
          actionSemanticHash: marker.actionSemanticHash,
          expectedControlId: step.controlTestId,
          expectedCanonicalTargetIds: explorerCanonicalTargetIds(step.action),
          expectedAcceptedRevision: witnessState.acceptedRevision,
          priorActionTraceId,
          deterministicClockFingerprint:
            deps.physicalEvidence.deterministicClockFingerprint(),
        });
        await deps.persistActionIngressRequest(ingressRequest);
        await deps.publishEligibilityMarker(marker);
      } else {
        await deps.publishEligibilityMarker(marker);
      }
    } catch (error) {
      return blocked({
        manifest,
        manifestSemanticHash,
        seedEvidence: seedReceipt.seedEvidence,
        records,
        attemptedReceipts,
        reasonCode: EXPLORER_RUNTIME_REASON.ELIGIBILITY_FAILED,
        failedStepId: step.stepId,
      });
    }
    let productionReceipt: ExplorerProductionActionReceipt;
    try {
      assertExplorerActionExecutable(step.action);
      if (deps.actionExecutionMode === 'live-external-action-ingress') {
        if (!ingressRequest) throw new Error('action_ingress_request_missing');
        productionReceipt = await deps.waitForExternalActionIngress(ingressRequest);
      } else {
        productionReceipt = await deps.executeProductionAction(step.action, claim);
      }
    } catch (error) {
      return blocked({
        manifest,
        manifestSemanticHash,
        seedEvidence: seedReceipt.seedEvidence,
        records,
        reasonCode: error instanceof ExplorerActionBridgeError
          ? error.reasonCode
          : EXPLORER_RUNTIME_REASON.ACTION_RECEIPT_MISSING,
        failedStepId: step.stepId,
      });
    }
    if (!receiptAgreesWithManifest(step, productionReceipt)) {
      attemptedReceipts.push(productionReceipt);
      return blocked({
        manifest,
        manifestSemanticHash,
        seedEvidence: seedReceipt.seedEvidence,
        records,
        attemptedReceipts,
        reasonCode: EXPLORER_RUNTIME_REASON.MANIFEST_RECEIPT_MISMATCH,
        failedStepId: step.stepId,
      });
    }
    attemptedReceipts.push(productionReceipt);
    if (productionReceipt.traceV2RootId === priorActionTraceId) {
      return blocked({
        manifest,
        manifestSemanticHash,
        seedEvidence: seedReceipt.seedEvidence,
        records,
        attemptedReceipts,
        reasonCode: EXPLORER_RUNTIME_REASON.TRACE_LINKAGE_BROKEN,
        failedStepId: step.stepId,
      });
    }
    let renderReceipt: ExplorerRuntimeRenderReceipt | null;
    try {
      renderReceipt = await deps.waitForReactRender({
        manifest,
        step,
        receipt: productionReceipt,
      });
    } catch (error) {
      renderReceipt = null;
    }
    if (!renderReceipt || !renderReceipt.complete ||
      renderReceipt.traceV2RootId !== productionReceipt.traceV2RootId) {
      return blocked({
        manifest,
        manifestSemanticHash,
        seedEvidence: seedReceipt.seedEvidence,
        records,
        attemptedReceipts,
        reasonCode: renderReceipt?.incompleteArtifact
          ? EXPLORER_RUNTIME_REASON.INCOMPLETE_ARTIFACT
          : EXPLORER_RUNTIME_REASON.MISSING_RENDER_WITNESS,
        failedStepId: step.stepId,
      });
    }

    let afterActionPhysicalEvidence: ExplorerPhysicalEvidenceReceiptV1;
    try {
      afterActionPhysicalEvidence = await capturePhysicalEvidence({
        deps,
        manifest,
        manifestSemanticHash,
        step,
        stepOrdinal: index + 1,
        capturePhase: 'after-action',
        reloadCount: index,
        traceId: productionReceipt.traceV2RootId,
        controlId: renderReceipt.controlId ?? step.controlTestId,
        observationId: renderReceipt.observationId ??
          `explorer-render:${productionReceipt.traceV2RootId}:${step.stepId}`,
        canonicalSemanticIdentity: renderReceipt.canonicalSemanticIdentity ??
          marker.actionSemanticHash,
      });
      physicalEvidenceReceipts.push(afterActionPhysicalEvidence);
      // The semantic render receipt becomes launch-complete only after the
      // exact physical request has an acknowledged screenshot and hierarchy.
      renderReceipt = {
        ...renderReceipt,
        externalArtifacts: {
          screenshot: 'captured',
          accessibilityHierarchy: 'captured',
          complete: true,
        },
      };
    } catch {
      return blocked({
        manifest,
        manifestSemanticHash,
        seedEvidence: seedReceipt.seedEvidence,
        records,
        attemptedReceipts,
        reasonCode: EXPLORER_RUNTIME_REASON.INCOMPLETE_ARTIFACT,
        failedStepId: step.stepId,
      });
    }

    let afterAction: readonly ExplorerOracleEvaluationReceipt[];
    let afterActionSummary: ReturnType<typeof summarizeExplorerOracleEvaluations>;
    try {
      const afterActionContext = await deps.captureOracleContext({
        manifest,
        step,
        point: 'after-action',
        receipt: productionReceipt,
        priorActionTraceId,
      });
      afterAction = evaluateAtPoint(step, afterActionContext, 'after-action');
      afterActionSummary = summarizeExplorerOracleEvaluations(manifest, afterAction);
    } catch {
      return blocked({
        manifest,
        manifestSemanticHash,
        seedEvidence: seedReceipt.seedEvidence,
        records,
        attemptedReceipts,
        reasonCode: EXPLORER_RUNTIME_REASON.HARD_ORACLE_FAILED,
        failedStepId: step.stepId,
      });
    }
    if (!afterActionSummary.passed) {
      return blocked({
        manifest,
        manifestSemanticHash,
        seedEvidence: seedReceipt.seedEvidence,
        records,
        attemptedReceipts,
        reasonCode: EXPLORER_RUNTIME_REASON.HARD_ORACLE_FAILED,
        failedStepId: step.stepId,
        firstDivergentProjection: afterActionSummary.firstDivergentProjection,
      });
    }

    let checkpoint: ExplorerRuntimeCheckpointReceipt;
    try {
      checkpoint = await deps.checkpointScenarioStep({
        manifest,
        step,
        receipt: productionReceipt,
        order: index + 1,
      });
    } catch {
      return blocked({
        manifest,
        manifestSemanticHash,
        seedEvidence: seedReceipt.seedEvidence,
        records,
        attemptedReceipts,
        reasonCode: EXPLORER_RUNTIME_REASON.CHECKPOINT_FAILED,
        failedStepId: step.stepId,
      });
    }
    let reload: ExplorerRuntimeReloadReceipt;
    try {
      reload = await deps.coldReloadScenarioSessionV2({
        manifest,
        step,
        checkpoint,
        order: index + 1,
      });
    } catch {
      return blocked({
        manifest,
        manifestSemanticHash,
        seedEvidence: seedReceipt.seedEvidence,
        records,
        attemptedReceipts,
        reasonCode: EXPLORER_RUNTIME_REASON.RELOAD_ORDER_INVALID,
        failedStepId: step.stepId,
      });
    }
    if (checkpoint.order !== index + 1 || reload.order !== index + 1 ||
      reload.reloadReceipt.stepId !== step.stepId ||
      reload.reloadReceipt.reloadCount !== index + 1) {
      return blocked({
        manifest,
        manifestSemanticHash,
        seedEvidence: seedReceipt.seedEvidence,
        records,
        attemptedReceipts,
        reasonCode: EXPLORER_RUNTIME_REASON.RELOAD_ORDER_INVALID,
        failedStepId: step.stepId,
      });
    }

    let afterReloadPhysicalEvidence: ExplorerPhysicalEvidenceReceiptV1;
    try {
      afterReloadPhysicalEvidence = await capturePhysicalEvidence({
        deps,
        manifest,
        manifestSemanticHash,
        step,
        stepOrdinal: index + 1,
        capturePhase: 'after-reload',
        reloadCount: index + 1,
        traceId: productionReceipt.traceV2RootId,
        controlId: renderReceipt.controlId ?? step.controlTestId,
        observationId: renderReceipt.observationId ??
          `explorer-render:${productionReceipt.traceV2RootId}:${step.stepId}`,
        canonicalSemanticIdentity: renderReceipt.canonicalSemanticIdentity ??
          marker.actionSemanticHash,
      });
      physicalEvidenceReceipts.push(afterReloadPhysicalEvidence);
    } catch {
      return blocked({
        manifest,
        manifestSemanticHash,
        seedEvidence: seedReceipt.seedEvidence,
        records,
        attemptedReceipts,
        reasonCode: EXPLORER_RUNTIME_REASON.INCOMPLETE_ARTIFACT,
        failedStepId: step.stepId,
      });
    }

    let afterReload: readonly ExplorerOracleEvaluationReceipt[];
    let afterReloadSummary: ReturnType<typeof summarizeExplorerOracleEvaluations>;
    try {
      const afterReloadContext = await deps.captureOracleContext({
        manifest,
        step,
        point: 'after-reload',
        receipt: productionReceipt,
        priorActionTraceId,
      });
      afterReload = evaluateAtPoint(step, afterReloadContext, 'after-reload');
      afterReloadSummary = summarizeExplorerOracleEvaluations(manifest, afterReload);
    } catch {
      return blocked({
        manifest,
        manifestSemanticHash,
        seedEvidence: seedReceipt.seedEvidence,
        records,
        attemptedReceipts,
        reasonCode: EXPLORER_RUNTIME_REASON.HARD_ORACLE_FAILED,
        failedStepId: step.stepId,
      });
    }
    if (!afterReloadSummary.passed) {
      return blocked({
        manifest,
        manifestSemanticHash,
        seedEvidence: seedReceipt.seedEvidence,
        records,
        attemptedReceipts,
        reasonCode: afterReload.some((oracle) =>
          oracle.failureCode === 'persistence_mismatch')
          ? EXPLORER_RUNTIME_REASON.ACCEPTED_PERSISTED_MISMATCH
          : afterReload.some((oracle) =>
              oracle.failureCode === 'prior_trace_link_broken')
            ? EXPLORER_RUNTIME_REASON.TRACE_LINKAGE_BROKEN
            : EXPLORER_RUNTIME_REASON.HARD_ORACLE_FAILED,
        failedStepId: step.stepId,
        firstDivergentProjection: afterReloadSummary.firstDivergentProjection,
      });
    }

    let artifactEvidence: ExplorerScenarioActionEvidenceV1;
    try {
      artifactEvidence = await deps.assembleActionEvidence({
        manifest,
        step,
        receipt: productionReceipt,
        renderReceipt,
        checkpoint,
        reload,
        oracleReceipts: [...afterAction, ...afterReload],
      });
      artifactEvidence = {
        ...artifactEvidence,
        screenshots: {
          afterAction: explorerEvidenceArtifactReference(
            afterActionPhysicalEvidence.screenshot,
          ),
          afterReload: explorerEvidenceArtifactReference(
            afterReloadPhysicalEvidence.screenshot,
          ),
        },
        accessibilityHierarchies: {
          afterAction: explorerEvidenceArtifactReference(
            afterActionPhysicalEvidence.hierarchy,
          ),
          afterReload: explorerEvidenceArtifactReference(
            afterReloadPhysicalEvidence.hierarchy,
          ),
        },
      };
    } catch (error) {
      return blocked({
        manifest,
        manifestSemanticHash,
        seedEvidence: seedReceipt.seedEvidence,
        records,
        attemptedReceipts,
        reasonCode: artifactFailureReason(error),
        failedStepId: step.stepId,
      });
    }
    records.push({
      stepId: step.stepId,
      intendedActionSemanticHash: marker.actionSemanticHash,
      productionReceipt,
      renderReceipt,
      eligibility,
      afterActionOracleReceipts: afterAction,
      afterReloadOracleReceipts: afterReload,
      checkpoint,
      reload,
      artifactEvidence,
      physicalEvidence: {
        afterAction: afterActionPhysicalEvidence,
        afterReload: afterReloadPhysicalEvidence,
      },
    });
    if (budgetExpired()) {
      return blocked({
        manifest,
        manifestSemanticHash,
        seedEvidence: seedReceipt.seedEvidence,
        records,
        attemptedReceipts,
        reasonCode: EXPLORER_RUNTIME_REASON.BUDGET_EXPIRED,
        failedStepId: step.stepId,
      });
    }
    priorActionTraceId = productionReceipt.traceV2RootId;
  }

  // Scenario-end is the final hard-oracle gate over the canonical receipts
  // collected at their owning after-action and after-reload boundaries. It
  // deliberately does not manufacture duplicate oracle receipts.
  const scenarioEndSummary = summarizeExplorerOracleEvaluations(
    manifest,
    records.flatMap((record) => [
      ...record.afterActionOracleReceipts,
      ...record.afterReloadOracleReceipts,
    ]),
  );
  if (!scenarioEndSummary.passed) {
    return blocked({
      manifest,
      manifestSemanticHash,
      seedEvidence: seedReceipt.seedEvidence,
      records,
      attemptedReceipts,
      reasonCode: EXPLORER_RUNTIME_REASON.HARD_ORACLE_FAILED,
      failedStepId: scenarioEndSummary.firstFailingStepId,
      firstDivergentProjection: scenarioEndSummary.firstDivergentProjection,
    });
  }

  const artifactAssembly = buildAssembly({
    manifest,
    manifestSemanticHash,
    seedEvidence: seedReceipt.seedEvidence,
    records,
    attemptedReceipts,
    status: 'complete',
    reasonCode: EXPLORER_RUNTIME_REASON.COMPLETE,
    failedStepId: null,
    firstDivergentProjection: null,
    physicalEvidenceReceipts,
  });
  if (!deps.assembleScenarioArtifact) {
    return {
      status: 'blocked',
      reasonCode: EXPLORER_RUNTIME_REASON.INCOMPLETE_ARTIFACT,
      manifestSemanticHash,
      failedStepId: manifest.steps[manifest.steps.length - 1]?.stepId ?? null,
      firstDivergentProjection: null,
      actionRecords: records,
      artifactAssembly: {
        ...artifactAssembly,
        completion: {
          status: 'blocked',
          reasonCode: EXPLORER_RUNTIME_REASON.INCOMPLETE_ARTIFACT,
        },
      },
      artifactBundle: null,
    };
  }
  let artifactBundle: ExplorerScenarioArtifactBundleV1;
  try {
    artifactBundle = await deps.assembleScenarioArtifact(artifactAssembly);
  } catch (error) {
    const reasonCode = artifactFailureReason(error);
    return {
      status: 'blocked',
      reasonCode,
      manifestSemanticHash,
      failedStepId: manifest.steps[manifest.steps.length - 1]?.stepId ?? null,
      firstDivergentProjection: null,
      actionRecords: records,
      artifactAssembly: {
        ...artifactAssembly,
        completion: {
          status: 'blocked',
          reasonCode,
        },
      },
      artifactBundle: null,
    };
  }
  return {
    status: 'complete',
    reasonCode: EXPLORER_RUNTIME_REASON.COMPLETE,
    manifestSemanticHash,
    failedStepId: null,
    firstDivergentProjection: null,
    actionRecords: records,
    artifactAssembly,
    artifactBundle,
  };
}
