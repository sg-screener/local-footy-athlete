import {
  AthleteActionTraceCoordinator,
} from '../dev/e2e/AthleteActionTraceCoordinator';
import {
  assertAthleteActionArtifactBundleV2,
  collectAthleteActionArtifactBundleV2,
} from '../dev/e2e/athleteActionArtifactBundle';
import {
  ATHLETE_ACTION_FAILURE_CODES,
  clusterAthleteActionFailure,
} from '../dev/e2e/athleteActionFailureClustering';

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

function main(): void {
  console.log('\n-- Athlete action artifact and clustering invariants --');
  const coordinator = new AthleteActionTraceCoordinator(
    () => true,
    () => new Date('2026-07-16T12:00:00.000Z'),
  );
  const token = coordinator.startRoot({
    source: 'coach',
    actionType: 'delete_component',
    campaignId: 'bounded-v2',
    scenarioRunId: 'component-delete-001',
    seedId: 'lower-body-deletion',
    buildId: 'ec5a6cd',
    sourceSurface: 'coach_chat',
    controlId: 'coach-send-button',
  });
  const trace = coordinator.getRecord(token.traceId)!;
  const cluster = clusterAthleteActionFailure({
    expectedMaterialChange: true,
    acceptedSemanticChanged: false,
    reportedSuccess: true,
    durableReadbackMatched: false,
    rejected: true,
    rejectionExpected: false,
    postReloadMatched: false,
    coachNoteMatchedAcceptedOwnership: false,
    restorationRequested: true,
    restorationMatchedOwnedBeforeState: false,
    fixtureMutation: true,
    fixtureHorizonValid: false,
    directAndChainedCompared: true,
    directAndChainedMatched: false,
    sourceFactCreated: true,
    programmingEffectExpected: true,
    programmingEffectObserved: false,
    coachingOutcomeAcceptable: false,
    resultCommunicationClear: false,
    equivalentControlsCompared: true,
    equivalentControlsConsistent: false,
  });
  ok('all twelve bounded failure codes are implemented in stable order',
    JSON.stringify(cluster.codes) === JSON.stringify(ATHLETE_ACTION_FAILURE_CODES), cluster.codes);

  const bundle = collectAthleteActionArtifactBundleV2({
    campaignId: 'bounded-v2',
    scenarioRunId: 'component-delete-001',
    scenarioSeed: { seedId: 'lower-body-deletion', rawHealthDetails: 'SECRET_HEALTH' },
    actionScriptYaml: 'action: delete_component\nmessage: remove my SECRET_COACH_TEXT block',
    expectedOutcome: { message: 'SECRET_RESULT_COPY', accepted: true },
    screenshots: { 'after.png': 'base64-screenshot-witness' },
    accessibilityHierarchies: { 'after.json': { id: 'result', label: 'redacted-by-runner' } },
    trace,
    clockEvidence: {
      seedId: 'lower-body-deletion',
      timezone: 'Australia/Melbourne',
      receiptFingerprint: 'clock-sha256',
      checkpointClockFingerprint: 'clock-sha256',
    },
    acceptedFingerprints: { program: 'sha256-accepted' },
    persistedFingerprints: { program: 'sha256-persisted' },
    postReloadResult: { matched: true },
    failureCluster: clusterAthleteActionFailure({
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
    }),
  });
  ok('collector emits the complete bounded artifact layout',
    Object.keys(bundle.files).some((path) => path.endsWith('/manifest.json')) &&
      Object.keys(bundle.files).some((path) => path.endsWith('/clock-evidence.json')) &&
      Object.keys(bundle.files).some((path) => path.includes('/screenshots/')) &&
      Object.keys(bundle.files).some((path) => path.includes('/accessibility-hierarchy/')));
  ok('bundle carries clock and TraceV2 fingerprint evidence',
    Object.entries(bundle.files).some(([path, contents]) =>
      path.endsWith('/clock-evidence.json') &&
      contents.includes('"receiptFingerprint": "clock-sha256"') &&
      contents.includes('"checkpointClockFingerprint": "clock-sha256"')) &&
    Object.entries(bundle.files).some(([path, contents]) =>
      path.endsWith('/athlete-action-trace-v2.json') &&
      contents.includes('"fingerprintContract": "athlete-semantic-sha256-v2"')));
  const serialized = JSON.stringify(bundle.files);
  ok('default artifacts contain no raw Coach text or raw health details',
    !serialized.includes('SECRET_COACH_TEXT') &&
      !serialized.includes('SECRET_HEALTH') &&
      !serialized.includes('SECRET_RESULT_COPY'));

  const missingScreenshot = {
    ...bundle,
    files: Object.fromEntries(Object.entries(bundle.files)
      .filter(([path]) => !path.includes('/screenshots/'))),
  };
  let refused = false;
  try {
    assertAthleteActionArtifactBundleV2(missingScreenshot);
  } catch (error) {
    refused = String(error).includes('athlete_action_artifact_contract_missing');
  }
  ok('a missing required artifact fails the scenario contract', refused);

  console.log(`\nAthlete action artifacts/clustering: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main();
