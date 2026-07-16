import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertAthleteActionArtifactBundleV2 } from '../dev/e2e/athleteActionArtifactBundle';
import {
  assertExplorerScenarioArtifactBundleV1,
  buildExplorerFailureClusterSignature,
  collectExplorerScenarioArtifactBundleV1,
  EXPLORER_SCENARIO_ARTIFACT_FAILURE,
  explorerScenarioSemanticHash,
  type ExplorerScenarioArtifactBundleV1,
  ExplorerScenarioArtifactValidationError,
} from '../dev/e2e/explorerScenarioArtifactBundle';
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
  createValidExplorerScenarioArtifactBundle,
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
  const { schemaVersion: _schemaVersion, semanticHash: _semanticHash, ...input } = bundle;
  return collectExplorerScenarioArtifactBundleV1(input);
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
  clusteredFailureDraft.oracles[1].passed = false;
  clusteredFailureDraft.oracles[1].failureCode = 'visible_projection_mismatch';
  clusteredFailureDraft.oracles[1].firstDivergentProjection = 'visible_week';
  clusteredFailureDraft.result = {
    ...clusteredFailureDraft.result,
    disposition: 'product_failure',
    firstFailingStepId: clusteredFailureDraft.oracles[1].stepId,
    firstFailingOracleId: clusteredFailureDraft.oracles[1].oracleId,
    firstDivergentProjection: 'visible_week',
    failureClusterSignature: buildExplorerFailureClusterSignature({
      oracleId: clusteredFailureDraft.oracles[1].oracleId,
      primaryFailureCode: clusteredFailureDraft.oracles[1].failureCode,
      actionKind: clusteredFailureDraft.actions[1].intendedActionReceipt.actionKind,
      productionSurface:
        clusteredFailureDraft.actions[1].intendedActionReceipt.productionSurface,
      firstDivergentProjection: 'visible_week',
      firstFailingStepId: clusteredFailureDraft.oracles[1].stepId,
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

  const normalizedHashA = explorerScenarioSemanticHash({
    stableId: 'same-evidence',
    localPath: '/Users/alice/project/artifact.json',
    observedAt: '2026-07-17T01:02:03.000Z',
    temporaryMetroPort: 8081,
    simulatorDeviceId: 'SIMULATOR-A',
    endpoint: 'http://localhost:8081/index.bundle',
  });
  const normalizedHashB = explorerScenarioSemanticHash({
    stableId: 'same-evidence',
    localPath: '/home/runner/project/artifact.json',
    observedAt: '2026-07-18T11:12:13.000Z',
    temporaryMetroPort: 19000,
    simulatorDeviceId: 'SIMULATOR-B',
    endpoint: 'http://localhost:19000/index.bundle',
  });
  const clockOwnedA = explorerScenarioSemanticHash({
    deterministicClockReceipt: { anchorInstant: '2026-07-13T00:00:00.000Z' },
  });
  const clockOwnedB = explorerScenarioSemanticHash({
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
  const baseActionSemanticHash = explorerScenarioSemanticHash({
    actionArtifactBundle: actionArtifactBase,
  });
  ok('scenario hash excludes media bytes but retains normalized action semantics',
    baseActionSemanticHash === explorerScenarioSemanticHash({
      actionArtifactBundle: mediaVariant,
    }) && baseActionSemanticHash !== explorerScenarioSemanticHash({
      actionArtifactBundle: semanticVariant,
    }));

  const environmentHashedRaw = cloneExplorerFixture(valid);
  environmentHashedRaw.actions[0].intendedActionReceipt.semanticInput = {
    operation: 'move_session',
    localPath: '/Users/alice/project/scenario.json',
  };
  environmentHashedRaw.actions[0].intendedActionSemanticHash = semanticFingerprintV2({
    contract: 'explorer-scenario-artifact-v1',
    value: {
      kind: 'intended_action_receipt',
      ...environmentHashedRaw.actions[0].intendedActionReceipt,
    },
  });
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
      parentChainSemanticHash: explorerScenarioSemanticHash(['one', 'two', 'three']),
      candidateChainSemanticHash: explorerScenarioSemanticHash(['two', 'three']),
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
  blockedDraft.oracles = blockedDraft.oracles.slice(0, 2);
  blockedDraft.scenarioSessionEvidence.checkpointRecords =
    blockedDraft.scenarioSessionEvidence.checkpointRecords.slice(0, 2);
  blockedDraft.scenarioSessionEvidence.reloadReceipts =
    blockedDraft.scenarioSessionEvidence.reloadReceipts.slice(0, 2);
  const blockedSession = blockedDraft.scenarioSessionEvidence.reloadReceipts[1]
    .scenarioSessionRecord;
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
