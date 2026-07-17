import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertAthleteActionArtifactBundleV2 } from '../dev/e2e/athleteActionArtifactBundle';
import {
  assertExplorerScenarioArtifactBundleV1,
  buildExplorerFailureClusterSignature,
  collectExplorerScenarioArtifactBundleV1,
  EXPLORER_SCENARIO_ARTIFACT_FAILURE,
  explorerScenarioArtifactSemanticHash,
  type ExplorerScenarioArtifactBundleV1,
  ExplorerScenarioArtifactValidationError,
} from '../dev/e2e/explorerScenarioArtifactBundle';
import {
  EXPLORER_PRODUCTION_CAPABILITY_DECLARATIONS,
  type ExplorerScenarioContract,
  type ExplorerScenarioStep,
} from '../dev/e2e/explorerScenarioContracts';
import {
  explorerActionSemanticHash,
  explorerScenarioSemanticHash as canonicalExplorerScenarioSemanticHash,
  ExplorerScenarioContractValidationError,
} from '../dev/e2e/explorerScenarioContractValidation';
import {
  parseDevE2EScenarioSessionRecord,
  type DevE2EScenarioSessionRecord,
} from '../dev/e2e/devE2EScenarioSession';
import { semanticFingerprintV2 } from '../utils/semanticFingerprintV2';
import {
  EXPLORER_SCENARIO_ARTIFACT_WRITER_FAILURE,
  ExplorerScenarioArtifactWriterError,
  serializeExplorerScenarioArtifactBundleV1,
  type ExplorerScenarioArtifactWriterFileSystem,
  writeExplorerScenarioArtifactBundleV1,
} from '../../scripts/write-explorer-scenario-artifact-bundle';
import {
  cloneExplorerFixture,
  createValidExplorerScenarioArtifactInput,
  createValidExplorerScenarioArtifactBundle,
  EXPLORER_FIXTURE_SCENARIO_MANIFEST,
  EXPLORER_FIXTURE_STEP_IDS,
} from './explorerScenarioArtifactFixture';

let passed = 0;
let failed = 0;

function ok(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}`, detail ?? '');
  }
}

function expectValidationCode(
  name: string,
  expectedCode: string,
  value: ExplorerScenarioArtifactBundleV1,
): void {
  let actualCode: string | null = null;
  try {
    assertExplorerScenarioArtifactBundleV1(value);
  } catch (error) {
    actualCode = error instanceof ExplorerScenarioArtifactValidationError
      ? error.code
      : String(error);
  }
  ok(name, actualCode === expectedCode, { expectedCode, actualCode });
}

function recollect(
  bundle: ExplorerScenarioArtifactBundleV1,
): ExplorerScenarioArtifactBundleV1 {
  const { semanticHash: _semanticHash, ...draft } = bundle;
  return {
    ...draft,
    semanticHash: explorerScenarioArtifactSemanticHash(draft),
  };
}

function reverseObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value as Record<string, unknown>)
    .reverse()
    .map((key) => [key, reverseObjectKeys((value as Record<string, unknown>)[key])]));
}

function replaceActionBundleFile(
  actionBundle: ExplorerScenarioArtifactBundleV1['actions'][number]['actionArtifactBundle'],
  pathFragment: string,
  contents: string,
): void {
  const filePath = Object.keys(actionBundle.files).find((candidate) =>
    candidate.includes(pathFragment));
  if (!filePath) throw new Error(`fixture file not found: ${pathFragment}`);
  actionBundle.files[filePath] = contents;
  const manifestPath = `${actionBundle.root}/manifest.json`;
  const manifest = JSON.parse(actionBundle.files[manifestPath]) as {
    files: Array<{ path: string; fingerprint: string }>;
  };
  const relativePath = filePath.slice(actionBundle.root.length + 1);
  const entry = manifest.files.find((candidate) => candidate.path === relativePath);
  if (!entry) throw new Error(`fixture manifest entry not found: ${relativePath}`);
  entry.fingerprint = semanticFingerprintV2(contents);
  actionBundle.files[manifestPath] = `${JSON.stringify(manifest, null, 2)}\n`;
}

function main(): void {
  console.log('\n-- Explorer scenario artifact bundle invariants --');
  const valid = createValidExplorerScenarioArtifactBundle();
  let validAccepted = true;
  try {
    assertExplorerScenarioArtifactBundleV1(valid);
  } catch (error) {
    validAccepted = false;
    console.error(error);
  }
  ok('valid three-action/three-reload scenario is accepted',
    validAccepted && valid.actions.length === 3 &&
      valid.scenarioSessionEvidence.reloadReceipts.length === 3 &&
      valid.scenarioSessionEvidence.reloadCount === 3);
  ok('TraceV2 roots form the ordered prior-action chain',
    valid.actions.every((action, index) =>
      action.stepId === EXPLORER_FIXTURE_STEP_IDS[index] &&
      action.priorActionTraceId === (valid.actions[index - 1]?.traceV2RootId ?? null)));

  const canonicalReference = valid.resolvedScenarioManifestReference;
  ok('compatibility: scenario artifacts accept canonical Explorer manifests',
    canonicalReference.scenarioId === EXPLORER_FIXTURE_SCENARIO_MANIFEST.scenarioId &&
      canonicalReference.scenarioTier === EXPLORER_FIXTURE_SCENARIO_MANIFEST.tier &&
      canonicalReference.seedId === EXPLORER_FIXTURE_SCENARIO_MANIFEST.seedId &&
      canonicalReference.schemaVersion === EXPLORER_FIXTURE_SCENARIO_MANIFEST.schemaVersion &&
      canonicalReference.campaignSeed === EXPLORER_FIXTURE_SCENARIO_MANIFEST.campaignSeed);

  ok('compatibility: canonical manifest and action semantic hashes are used verbatim',
    canonicalReference.semanticHash ===
      canonicalExplorerScenarioSemanticHash(EXPLORER_FIXTURE_SCENARIO_MANIFEST) &&
      canonicalReference.steps.every((step, index) =>
        step.actionSemanticHash === explorerActionSemanticHash(
          EXPLORER_FIXTURE_SCENARIO_MANIFEST.steps[index].action,
        ) && valid.actions[index].intendedActionSemanticHash === step.actionSemanticHash));

  const expectedOracleOrder = EXPLORER_FIXTURE_SCENARIO_MANIFEST.steps
    .flatMap((step) => step.oracleAssertions.map((oracle) => oracle.oracleId));
  ok('compatibility: action order, oracle IDs, and checkpoint policies remain canonical',
    JSON.stringify(canonicalReference.steps.map((step) => step.stepId)) ===
      JSON.stringify(EXPLORER_FIXTURE_STEP_IDS) &&
      JSON.stringify(valid.oracles.map((oracle) => oracle.oracleId)) ===
        JSON.stringify(expectedOracleOrder) &&
      JSON.stringify(canonicalReference.steps.map((step) => step.checkpointPolicy)) ===
        JSON.stringify(EXPLORER_FIXTURE_SCENARIO_MANIFEST.steps.map((step) =>
          step.checkpointPolicy)));

  const repeatManifest = cloneExplorerFixture(EXPLORER_FIXTURE_SCENARIO_MANIFEST) as
    ExplorerScenarioContract & { steps: ExplorerScenarioStep[] };
  repeatManifest.steps[0] = {
    ...repeatManifest.steps[0],
    action: {
      type: 'week.repeat',
      target: { kind: 'week', weekId: 'week-2026-07-13' },
      args: {
        sourceWeekStart: '2026-07-13',
        targetWeekStart: '2026-07-20',
      },
      capability: { capabilityId: 'week.repeat', status: 'enabled' },
    },
    ingress: 'week-controls',
  };
  const repeatBundle = collectExplorerScenarioArtifactBundleV1(
    createValidExplorerScenarioArtifactInput(repeatManifest),
  );
  ok('compatibility: production-owned week.repeat capability is accepted',
    repeatBundle.resolvedScenarioManifestReference.steps[0].capability?.status === 'enabled' &&
      JSON.stringify(repeatBundle.resolvedScenarioManifestReference.capabilityDeclarations) ===
        JSON.stringify(EXPLORER_PRODUCTION_CAPABILITY_DECLARATIONS));

  const coachManifest = cloneExplorerFixture(EXPLORER_FIXTURE_SCENARIO_MANIFEST) as
    ExplorerScenarioContract & { steps: ExplorerScenarioStep[] };
  coachManifest.steps[0] = {
    ...coachManifest.steps[0],
    action: {
      type: 'coach.message',
      target: {
        kind: 'coach-message',
        conversationId: 'conversation-1',
        messageId: 'message-1',
      },
      args: {
        message: 'Move my strength session to Wednesday.',
        visibleWeekId: 'week-2026-07-13',
      },
      capability: { capabilityId: 'coach.message', status: 'enabled' },
    },
    ingress: 'coach-chat',
  };
  let coachCapabilityRejected = false;
  try {
    collectExplorerScenarioArtifactBundleV1(
      createValidExplorerScenarioArtifactInput(coachManifest),
    );
  } catch (error) {
    coachCapabilityRejected = error instanceof ExplorerScenarioContractValidationError &&
      error.issues.some((issue) => issue.code === 'capability-not-declared');
  }
  ok('compatibility: coach.message remains capability-disabled', coachCapabilityRejected);

  const untouchedInput = createValidExplorerScenarioArtifactInput();
  const unwrappedActionBundles = JSON.stringify(
    untouchedInput.actions.map((action) => action.actionArtifactBundle),
  );
  const untouchedBundle = collectExplorerScenarioArtifactBundleV1(untouchedInput);
  ok('compatibility: AthleteActionArtifactBundleV2 is wrapped without mutation',
    JSON.stringify(untouchedBundle.actions.map((action) => action.actionArtifactBundle)) ===
      unwrappedActionBundles && untouchedBundle.actions.every((action) => {
      assertAthleteActionArtifactBundleV2(action.actionArtifactBundle);
      return true;
    }));

  const sessionInput = createValidExplorerScenarioArtifactInput();
  const sessionBundle = collectExplorerScenarioArtifactBundleV1(sessionInput);
  const inputResetSession = sessionInput.scenarioSessionEvidence
    .scenarioSessionRecordAtReset as DevE2EScenarioSessionRecord;
  inputResetSession.reloadCount = 99;
  const parsedSessionReceipt = parseDevE2EScenarioSessionRecord(
    sessionBundle.scenarioSessionEvidence.scenarioSessionRecordAtReset,
  );
  ok('compatibility: scenario-session V2 fields are immutable receipts, not ownership',
    parsedSessionReceipt.reloadCount === 0 &&
      Object.keys(parsedSessionReceipt).sort().join(',') ===
        Object.keys(sessionBundle.scenarioSessionEvidence.scenarioSessionRecordAtReset)
          .sort().join(','));

  const compatibilityEnvironmentA = explorerScenarioArtifactSemanticHash({
    manifestSemanticHash: canonicalReference.semanticHash,
    absolutePath: '/Users/alice/worktree/scenario.json',
    metroPort: 8081,
    simulatorUdid: 'SIM-A',
    observedAt: '2026-07-17T01:02:03.000Z',
  });
  const compatibilityEnvironmentB = explorerScenarioArtifactSemanticHash({
    manifestSemanticHash: canonicalReference.semanticHash,
    absolutePath: '/home/runner/worktree/scenario.json',
    metroPort: 19000,
    simulatorUdid: 'SIM-B',
    observedAt: '2026-07-18T11:12:13.000Z',
  });
  ok('compatibility: environment-specific values do not affect semantic hashes',
    compatibilityEnvironmentA === compatibilityEnvironmentB);

  const missingScreenshot = cloneExplorerFixture(valid);
  delete (missingScreenshot.actions[1].screenshots as Partial<
    typeof missingScreenshot.actions[1]['screenshots']
  >).afterReload;
  expectValidationCode('missing after-reload screenshot is refused',
    EXPLORER_SCENARIO_ARTIFACT_FAILURE.SCREENSHOT_MISSING, missingScreenshot);

  const missingHierarchy = cloneExplorerFixture(valid);
  delete (missingHierarchy.actions[0].accessibilityHierarchies as Partial<
    typeof missingHierarchy.actions[0]['accessibilityHierarchies']
  >).afterAction;
  expectValidationCode('missing action hierarchy is refused',
    EXPLORER_SCENARIO_ARTIFACT_FAILURE.HIERARCHY_MISSING, missingHierarchy);

  const missingPhysicalReceipts = cloneExplorerFixture(valid);
  delete (missingPhysicalReceipts as Partial<ExplorerScenarioArtifactBundleV1>)
    .physicalEvidenceReceipts;
  expectValidationCode('passed scenario requires every physical evidence receipt',
    EXPLORER_SCENARIO_ARTIFACT_FAILURE.PHYSICAL_EVIDENCE_MISSING,
    missingPhysicalReceipts);

  const wrongPhysicalTrace = cloneExplorerFixture(valid);
  wrongPhysicalTrace.physicalEvidenceReceipts[1].traceId = 'trace-wrong-physical';
  expectValidationCode('physical receipt must match action trace identity',
    EXPLORER_SCENARIO_ARTIFACT_FAILURE.PHYSICAL_EVIDENCE_MISMATCH,
    wrongPhysicalTrace);

  const staleActionManifest = cloneExplorerFixture(valid);
  const staleScreenshotPath = Object.keys(
    staleActionManifest.actions[0].actionArtifactBundle.files,
  ).find((filePath) => filePath.includes('/screenshots/'))!;
  staleActionManifest.actions[0].actionArtifactBundle.files[staleScreenshotPath] =
    'changed-without-manifest-receipt';
  expectValidationCode('invalid action bundles are never silently omitted',
    EXPLORER_SCENARIO_ARTIFACT_FAILURE.ACTION_BUNDLE_INVALID,
    staleActionManifest);

  const brokenPrior = cloneExplorerFixture(valid);
  brokenPrior.actions[1].priorActionTraceId = 'trace-wrong-prior';
  expectValidationCode('broken priorActionTraceId is refused',
    EXPLORER_SCENARIO_ARTIFACT_FAILURE.TRACE_PRIOR_LINKAGE_BROKEN, brokenPrior);

  const nonMonotonicReload = cloneExplorerFixture(valid);
  nonMonotonicReload.scenarioSessionEvidence.reloadReceipts[1].reloadCount = 1;
  expectValidationCode('non-monotonic reload count is refused',
    EXPLORER_SCENARIO_ARTIFACT_FAILURE.RELOAD_COUNT_NON_MONOTONIC,
    nonMonotonicReload);

  const missingFingerprints = cloneExplorerFixture(valid);
  missingFingerprints.actions[2].fingerprints.afterReload.persistedStoreFingerprints = {};
  expectValidationCode('missing accepted or persisted fingerprints are refused',
    EXPLORER_SCENARIO_ARTIFACT_FAILURE.FINGERPRINT_MISSING,
    missingFingerprints);

  const failedHardInsidePassed = cloneExplorerFixture(valid);
  failedHardInsidePassed.oracles[1].passed = false;
  failedHardInsidePassed.oracles[1].failureCode = 'visible_projection_mismatch';
  failedHardInsidePassed.oracles[1].firstDivergentProjection = 'visible_week';
  expectValidationCode('failed hard oracle inside passed scenario is refused',
    EXPLORER_SCENARIO_ARTIFACT_FAILURE.PASSED_WITH_FAILED_HARD_ORACLE,
    failedHardInsidePassed);

  const clusteredFailureDraft = cloneExplorerFixture(valid);
  const clusteredOracle = clusteredFailureDraft.oracles.find((oracle) =>
    oracle.stepId === EXPLORER_FIXTURE_STEP_IDS[1])!;
  const clusteredAction = clusteredFailureDraft.actions.find((action) =>
    action.stepId === clusteredOracle.stepId)!;
  clusteredOracle.passed = false;
  clusteredOracle.failureCode = 'visible_projection_mismatch';
  clusteredOracle.firstDivergentProjection = 'visible_week';
  clusteredFailureDraft.result = {
    ...clusteredFailureDraft.result,
    disposition: 'product_failure',
    firstFailingStepId: clusteredOracle.stepId,
    firstFailingOracleId: clusteredOracle.oracleId,
    firstDivergentProjection: 'visible_week',
    failureClusterSignature: buildExplorerFailureClusterSignature({
      oracleId: clusteredOracle.oracleId,
      primaryFailureCode: clusteredOracle.failureCode,
      actionKind: clusteredAction.intendedActionReceipt.actionKind,
      productionSurface: clusteredAction.intendedActionReceipt.productionSurface,
      firstDivergentProjection: 'visible_week',
      firstFailingStepId: clusteredOracle.stepId,
    }),
  };
  const clusteredFailure = recollect(clusteredFailureDraft);
  ok('default failure-cluster signature uses only typed failure components',
    clusteredFailure.result.disposition === 'product_failure' &&
      clusteredFailure.result.failureClusterSignature !== null);

  const missingFirstDivergence = cloneExplorerFixture(valid);
  missingFirstDivergence.oracles[0].passed = false;
  missingFirstDivergence.oracles[0].failureCode = 'persisted_projection_mismatch';
  missingFirstDivergence.oracles[0].firstDivergentProjection = null;
  expectValidationCode('failed oracle without first-divergence data is refused',
    EXPLORER_SCENARIO_ARTIFACT_FAILURE.FIRST_DIVERGENT_PROJECTION_MISSING,
    missingFirstDivergence);

  const unevaluatedOracle = cloneExplorerFixture(valid);
  delete (unevaluatedOracle.oracles[0] as Partial<
    typeof unevaluatedOracle.oracles[0]
  >).evaluationStatus;
  expectValidationCode('unevaluated oracle is refused',
    EXPLORER_SCENARIO_ARTIFACT_FAILURE.ORACLE_UNEVALUATED,
    unevaluatedOracle);

  const missingFailingStep = cloneExplorerFixture(valid);
  missingFailingStep.result.disposition = 'infrastructure_failure';
  expectValidationCode('failed scenario without first failing step is refused',
    EXPLORER_SCENARIO_ARTIFACT_FAILURE.FIRST_FAILING_STEP_MISSING,
    missingFailingStep);

  const serialized = serializeExplorerScenarioArtifactBundleV1(valid);
  const reversed = reverseObjectKeys(cloneExplorerFixture(valid)) as
    ExplorerScenarioArtifactBundleV1;
  ok('deterministic serialization sorts every object key and preserves array order',
    serialized === serializeExplorerScenarioArtifactBundleV1(reversed));

  const normalizedHashA = explorerScenarioArtifactSemanticHash({
    stableId: 'same-evidence',
    localPath: '/Users/alice/project/artifact.json',
    observedAt: '2026-07-17T01:02:03.000Z',
    temporaryMetroPort: 8081,
    simulatorDeviceId: 'SIMULATOR-A',
    endpoint: 'http://localhost:8081/index.bundle',
  });
  const normalizedHashB = explorerScenarioArtifactSemanticHash({
    stableId: 'same-evidence',
    localPath: '/home/runner/project/artifact.json',
    observedAt: '2026-07-18T11:12:13.000Z',
    temporaryMetroPort: 19000,
    simulatorDeviceId: 'SIMULATOR-B',
    endpoint: 'http://localhost:19000/index.bundle',
  });
  const clockOwnedA = explorerScenarioArtifactSemanticHash({
    deterministicClockReceipt: { anchorInstant: '2026-07-13T00:00:00.000Z' },
  });
  const clockOwnedB = explorerScenarioArtifactSemanticHash({
    deterministicClockReceipt: { anchorInstant: '2026-07-14T00:00:00.000Z' },
  });
  ok('path, non-clock timestamp, Metro port, and simulator normalization is deterministic',
    normalizedHashA === normalizedHashB && clockOwnedA !== clockOwnedB,
    { normalizedHashA, normalizedHashB });

  const actionArtifactBase = cloneExplorerFixture(valid.actions[0].actionArtifactBundle);
  const mediaVariant = cloneExplorerFixture(actionArtifactBase);
  replaceActionBundleFile(mediaVariant, '/screenshots/', 'different-screenshot-bytes');
  replaceActionBundleFile(mediaVariant, '/accessibility-hierarchy/',
    '{"different":"hierarchy-bytes"}\n');
  const semanticVariant = cloneExplorerFixture(actionArtifactBase);
  replaceActionBundleFile(semanticVariant, '/expected-outcome.json',
    '{"accepted":false}\n');
  const baseActionSemanticHash = explorerScenarioArtifactSemanticHash({
    actionArtifactBundle: actionArtifactBase,
  });
  ok('scenario hash excludes media bytes but retains normalized action semantics',
    baseActionSemanticHash === explorerScenarioArtifactSemanticHash({
      actionArtifactBundle: mediaVariant,
    }) && baseActionSemanticHash !== explorerScenarioArtifactSemanticHash({
      actionArtifactBundle: semanticVariant,
    }));
  const physicalMediaA = explorerScenarioArtifactSemanticHash({
    screenshot: { relativeReference: 'scenario/seed.png', sha256: 'a'.repeat(64), byteSize: 10 },
    hierarchy: { relativeReference: 'scenario/seed.json', sha256: 'b'.repeat(64), byteSize: 20 },
  });
  const physicalMediaB = explorerScenarioArtifactSemanticHash({
    screenshot: { relativeReference: 'scenario/seed.png', sha256: 'c'.repeat(64), byteSize: 99 },
    hierarchy: { relativeReference: 'scenario/seed.json', sha256: 'd'.repeat(64), byteSize: 88 },
  });
  ok('physical receipt hashes do not redefine scenario semantics',
    physicalMediaA === physicalMediaB);

  const environmentHashedRaw = cloneExplorerFixture(valid);
  environmentHashedRaw.actions[0].intendedActionReceipt.semanticInput = {
    operation: 'move_session',
    localPath: '/Users/alice/project/scenario.json',
  };
  expectValidationCode('environment-specific data cannot be included in an intended-action hash',
    EXPLORER_SCENARIO_ARTIFACT_FAILURE.ENVIRONMENT_SPECIFIC_SEMANTIC_HASH_INPUT,
    environmentHashedRaw);

  const privateAthleteName = cloneExplorerFixture(valid) as
    ExplorerScenarioArtifactBundleV1 & { athleteName?: string };
  privateAthleteName.athleteName = 'Private Athlete';
  expectValidationCode('athlete names are privacy-forbidden',
    EXPLORER_SCENARIO_ARTIFACT_FAILURE.PRIVACY_FORBIDDEN_FIELD,
    privateAthleteName);
  const privateEmail = cloneExplorerFixture(valid) as
    ExplorerScenarioArtifactBundleV1 & { metadata?: { contact?: string } };
  privateEmail.metadata = { contact: 'private@example.test' };
  expectValidationCode('email values are privacy-forbidden',
    EXPLORER_SCENARIO_ARTIFACT_FAILURE.PRIVACY_FORBIDDEN_FIELD,
    privateEmail);

  const generatedDraft = cloneExplorerFixture(valid);
  generatedDraft.generatedCaseMetadata = {
    pairwiseDimensions: { actionKind: 'move_session', surface: 'calendar_card' },
    coveredPairIds: ['pair:action-kind:surface'],
    originalActionChain: generatedDraft.actions.map((action) => ({
      stepId: action.stepId,
      intendedActionSemanticHash: action.intendedActionSemanticHash,
    })),
    minimizedActionChain: generatedDraft.actions.slice(1).map((action) => ({
      stepId: action.stepId,
      intendedActionSemanticHash: action.intendedActionSemanticHash,
    })),
    shrinkLineage: [{
      attempt: 1,
      parentChainSemanticHash:
        explorerScenarioArtifactSemanticHash(['one', 'two', 'three']),
      candidateChainSemanticHash: explorerScenarioArtifactSemanticHash(['two', 'three']),
      result: 'retained',
    }],
    shrinkAttemptCount: 1,
  };
  const generated = recollect(generatedDraft);
  ok('generated-chain, pair coverage, and shrinking metadata are accepted',
    generated.generatedCaseMetadata?.shrinkAttemptCount === 1);
  const shrinkWithoutOriginal = cloneExplorerFixture(generated);
  delete shrinkWithoutOriginal.generatedCaseMetadata?.originalActionChain;
  expectValidationCode('shrink result without original action chain is refused',
    EXPLORER_SCENARIO_ARTIFACT_FAILURE.SHRINK_ORIGINAL_CHAIN_MISSING,
    shrinkWithoutOriginal);

  const blockedDraft = cloneExplorerFixture(valid);
  blockedDraft.actions = blockedDraft.actions.slice(0, 2);
  blockedDraft.physicalEvidenceReceipts =
    blockedDraft.physicalEvidenceReceipts.slice(0, 5);
  const completedStepIds = new Set(EXPLORER_FIXTURE_STEP_IDS.slice(0, 2));
  blockedDraft.oracles = blockedDraft.oracles.filter((oracle) =>
    completedStepIds.has(oracle.stepId as (typeof EXPLORER_FIXTURE_STEP_IDS)[number]));
  blockedDraft.scenarioSessionEvidence.checkpointRecords =
    blockedDraft.scenarioSessionEvidence.checkpointRecords.slice(0, 2);
  blockedDraft.scenarioSessionEvidence.reloadReceipts =
    blockedDraft.scenarioSessionEvidence.reloadReceipts.slice(0, 2);
  const blockedSession = blockedDraft.scenarioSessionEvidence.reloadReceipts[1]
    .scenarioSessionRecord as DevE2EScenarioSessionRecord;
  blockedSession.nextActionEligibility = {
    nextStepId: EXPLORER_FIXTURE_STEP_IDS[2],
    status: 'blocked',
    reasonCode: 'eligibility_witness_blocked',
    witnessIds: ['fixture:blocked-third-step'],
  };
  blockedDraft.scenarioSessionEvidence.finalScenarioSessionRecord = blockedSession;
  blockedDraft.scenarioSessionEvidence.reloadCount = 2;
  blockedDraft.scenarioSessionEvidence.completionStatus = {
    status: 'blocked',
    reasonCode: 'eligibility_witness_blocked',
  };
  blockedDraft.result = {
    ...blockedDraft.result,
    disposition: 'incomplete_artifact',
    firstFailingStepId: EXPLORER_FIXTURE_STEP_IDS[2],
  };
  const blocked = recollect(blockedDraft);
  ok('blocked scenario sessions preserve their ordered completed prefix',
    blocked.scenarioSessionEvidence.completionStatus.status === 'blocked' &&
      blocked.actions.length === 2);

  ok('embedded AthleteActionArtifactBundleV2 remains the unchanged singular contract',
    valid.actions.every((action) => {
      assertAthleteActionArtifactBundleV2(action.actionArtifactBundle);
      return JSON.stringify(Object.keys(action.actionArtifactBundle).sort()) ===
        JSON.stringify(['files', 'root']);
    }));

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'explorer-artifact-writer-'));
  const outputPath = path.join(temporaryDirectory, 'scenario.json');
  writeExplorerScenarioArtifactBundleV1(valid, outputPath);
  const originalContents = fs.readFileSync(outputPath, 'utf8');
  let overwriteCode: string | null = null;
  try {
    writeExplorerScenarioArtifactBundleV1(valid, outputPath);
  } catch (error) {
    overwriteCode = error instanceof ExplorerScenarioArtifactWriterError
      ? error.code
      : String(error);
  }
  ok('writer refuses overwrite and preserves the existing artifact',
    overwriteCode === EXPLORER_SCENARIO_ARTIFACT_WRITER_FAILURE.OVERWRITE_REFUSED &&
      fs.readFileSync(outputPath, 'utf8') === originalContents);

  const simulatedOutput = path.resolve('/virtual/explorer-scenario.json');
  const memoryFiles = new Map<string, string>([[simulatedOutput, 'existing-artifact']]);
  const removedTemporaryFiles: string[] = [];
  const failingFileSystem: ExplorerScenarioArtifactWriterFileSystem = {
    exists: (filePath) => memoryFiles.has(filePath),
    makeDirectory: () => {},
    writeExclusive: (filePath, contents) => {
      if (memoryFiles.has(filePath)) throw new Error('exclusive collision');
      memoryFiles.set(filePath, contents);
    },
    rename: () => { throw new Error('simulated rename failure'); },
    remove: (filePath) => {
      removedTemporaryFiles.push(filePath);
      memoryFiles.delete(filePath);
    },
  };
  let atomicFailureCode: string | null = null;
  try {
    writeExplorerScenarioArtifactBundleV1(valid, simulatedOutput, {
      overwrite: true,
      fileSystem: failingFileSystem,
    });
  } catch (error) {
    atomicFailureCode = error instanceof ExplorerScenarioArtifactWriterError
      ? error.code
      : String(error);
  }
  ok('atomic rename failure removes the temporary file and publishes no partial target',
    atomicFailureCode ===
      EXPLORER_SCENARIO_ARTIFACT_WRITER_FAILURE.ATOMIC_WRITE_FAILED &&
      removedTemporaryFiles.length === 1 &&
      memoryFiles.size === 1 &&
      memoryFiles.get(simulatedOutput) === 'existing-artifact');

  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  console.log(`\nExplorer scenario artifacts: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main();
