(global as unknown as { __DEV__: boolean }).__DEV__ = true;

import {
  athleteActionTraceCoordinator,
  beginAthleteActionTrace,
  clearAthleteActionDiagnosticEvents,
  configureAthleteActionDiagnosticsForTests,
  emitAthleteActionEvent,
  exportAthleteActionTraceCheckpointV2,
  getAthleteActionTraceV2,
  resumeAthleteActionTraceCheckpointV2,
  runWithAthleteActionTrace,
} from '../utils/athleteActionDiagnostics';
import {
  AthleteActionTraceCoordinator,
  buildAthleteSemanticSnapshotV2,
  capturedTraceField,
  type AthleteSemanticStateV2,
} from '../dev/e2e/AthleteActionTraceCoordinator';
import {
  observeRenderedAthleteActionOutcome,
  registerAthleteActionUIOutcome,
} from '../dev/e2e/athleteActionUIObservation';
import { semanticFingerprintV2, sha256Hex } from '../utils/semanticFingerprintV2';

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

function enable(): void {
  configureAthleteActionDiagnosticsForTests({
    enabled: true,
    production: false,
    now: () => new Date('2026-07-16T12:00:00.000Z'),
    sink: () => undefined,
  });
  clearAthleteActionDiagnosticEvents();
}

function semanticState(): AthleteSemanticStateV2 {
  return {
    reversibleAdjustmentLedger: { adjustments: [{ id: 'owned-adjustment' }] },
    userRemovalConstraints: [{ id: 'removal' }],
    injuryEpisodes: [{ episodeId: 'episode', status: 'active', rawHealthDetails: 'SECRET_HEALTH' }],
    temporarySourceFacts: [{ id: 'temporary-fact' }],
    activeConstraints: [{ id: 'constraint' }],
    readiness: { '2026-07-16': { fatigue: 4 } },
    sessionFeedback: { '2026-07-15': { completion: 'full' } },
    coachNoteOwnership: [{ cardId: 'card' }],
    overlays: { '2026-07-13': { id: 'overlay' } },
    overrides: { '2026-07-14': { id: 'override' } },
    contracts: { '2026-07-13': { id: 'contract' } },
    provenance: [{ id: 'provenance' }],
    typedReductions: [{ id: 'reduction' }],
  };
}

async function main(): Promise<void> {
  console.log('\n-- AthleteActionTraceV2 invariants --');
  ok('SHA-256 implementation matches the standard abc vector',
    sha256Hex('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  ok('semantic fingerprints are explicitly versioned SHA-256 values',
    /^athlete-semantic-sha256-v2:[a-f0-9]{64}$/.test(semanticFingerprintV2({ b: 2, a: 1 })));

  const revisionOne = buildAthleteSemanticSnapshotV2(semanticState(), 1);
  const revisionTwo = buildAthleteSemanticSnapshotV2(semanticState(), 2);
  ok('accepted revision metadata is excluded from semantic identity',
    revisionOne.fingerprint === revisionTwo.fingerprint &&
      revisionOne.acceptedRevision !== revisionTwo.acceptedRevision);
  ok('every required semantic component receives the same fingerprint contract',
    Object.keys(revisionOne.componentFingerprints).length === 13 &&
      Object.values(revisionOne.componentFingerprints).every((fingerprint) =>
        fingerprint.startsWith('athlete-semantic-sha256-v2:')));

  const familyCoordinator = new AthleteActionTraceCoordinator(
    () => true,
    () => new Date('2026-07-16T12:00:00.000Z'),
  );
  const majorFamilies = [
    'game_day_change', 'practice_match_change', 'move_session', 'delete_session',
    'delete_component', 'add_session', 'clear_adjustment', 'injury_change',
    'readiness_change', 'equipment_change', 'session_feedback', 'repeat_week', 'rollover',
  ];
  majorFamilies.forEach((actionType) => familyCoordinator.startRoot({
    source: actionType === 'rollover' ? 'system' : 'tap',
    actionType,
    canonicalRequestedAction: { actionType, scope: 'one_action' },
  }));
  ok('each major action family owns exactly one root record',
    familyCoordinator.getRecords().length === majorFamilies.length &&
      familyCoordinator.getRecords().every((record) =>
        record.spans.filter((span) => span.parentSpanId === null).length === 1));
  const coachEquivalent = familyCoordinator.startRoot({
    source: 'coach',
    actionType: 'delete_component',
    canonicalRequestedAction: { actionType: 'delete_component', componentId: 'strength' },
  });
  const tapEquivalent = familyCoordinator.startRoot({
    source: 'tap',
    actionType: 'delete_component',
    canonicalRequestedAction: { actionType: 'delete_component', componentId: 'strength' },
  });
  ok('Coach and tap equivalent actions normalize to one canonical action shape',
    JSON.stringify(familyCoordinator.getRecord(coachEquivalent.traceId)?.root.canonicalRequestedAction) ===
      JSON.stringify(familyCoordinator.getRecord(tapEquivalent.traceId)?.root.canonicalRequestedAction));

  const failedDurabilityCoordinator = new AthleteActionTraceCoordinator(
    () => true,
    () => new Date('2026-07-16T12:00:00.000Z'),
  );
  const failedDurability = failedDurabilityCoordinator.startRoot({
    source: 'tap', actionType: 'move_session', sourceDate: '2026-07-14', targetDate: '2026-07-15',
  });
  failedDurabilityCoordinator.recordEvent(failedDurability, 'accepted_state_publication_result', {
    published: true,
  });
  failedDurabilityCoordinator.recordEvent(failedDurability, 'athlete_action_completed', {
    outcome: 'accepted',
  });
  failedDurabilityCoordinator.recordPersistence(failedDurability, {
    operation: 'readback',
    store: 'program-store',
    attempted: true,
    acknowledged: true,
    expectedFingerprint: capturedTraceField(semanticFingerprintV2({ candidate: true })),
    actualFingerprint: capturedTraceField(semanticFingerprintV2({ candidate: false })),
  });
  failedDurabilityCoordinator.markUINotApplicable(failedDurability.traceId, 'system projection action');
  const failedCheckpoint = failedDurabilityCoordinator.exportCheckpoint();
  failedDurabilityCoordinator.clear();
  failedDurabilityCoordinator.resumeCheckpoint(failedCheckpoint, {
    accepted: {}, persisted: {}, visible: {}, coachNotes: {}, verified: true,
  });
  let durableFailureRefused = false;
  try {
    failedDurabilityCoordinator.finalize(failedDurability.traceId, 'success');
  } catch {
    durableFailureRefused = true;
  }
  ok('durable failure cannot leave a terminal success',
    durableFailureRefused &&
      failedDurabilityCoordinator.getRecord(failedDurability.traceId)?.status === 'unfinished');

  const rejectedCoordinator = new AthleteActionTraceCoordinator(
    () => true,
    () => new Date('2026-07-16T12:00:00.000Z'),
  );
  const rejectedToken = rejectedCoordinator.startRoot({
    source: 'tap', actionType: 'delete_component',
  });
  rejectedCoordinator.recordEvent(rejectedToken, 'accepted_state_publication_result', {
    published: false,
  });
  rejectedCoordinator.recordEvent(rejectedToken, 'athlete_action_failed', {
    outcome: 'rejected',
  });
  rejectedCoordinator.recordPersistence(rejectedToken, {
    operation: 'read_before',
    store: 'program-store',
    attempted: true,
    acknowledged: true,
    expectedFingerprint: capturedTraceField(semanticFingerprintV2({ before: true })),
    actualFingerprint: capturedTraceField(semanticFingerprintV2({ before: true })),
  });
  rejectedCoordinator.recordRollback(rejectedToken, {
    memory: { verified: true },
    programEnvelope: { verified: true },
    mirrorEnvelopes: { verified: true },
    visibleProjection: { verified: true },
  });
  rejectedCoordinator.markUINotApplicable(rejectedToken.traceId, 'rejection has no result surface');
  const rejectedCheckpoint = rejectedCoordinator.exportCheckpoint();
  rejectedCoordinator.clear();
  rejectedCoordinator.resumeCheckpoint(rejectedCheckpoint, {
    accepted: {}, persisted: {}, visible: {}, coachNotes: {}, verified: true,
  });
  let terminalConflictRefused = false;
  try {
    rejectedCoordinator.finalize(rejectedToken.traceId, 'success');
  } catch {
    terminalConflictRefused = true;
  }
  ok('a requested durable failure can never be rewritten as terminal success',
    terminalConflictRefused &&
      rejectedCoordinator.getRecord(rejectedToken.traceId)?.status === 'finalized_failure');

  enable();
  const root = beginAthleteActionTrace({
    source: 'tap',
    actionType: 'move_session',
    route: 'test-control',
    sourceDate: '2026-07-14',
    targetDate: '2026-07-15',
    planEntryId: 'session-1',
    controlId: 'move-control',
  });
  let descendantTraceId = '';
  await runWithAthleteActionTrace(root, async () => {
    await Promise.resolve();
    const descendant = beginAthleteActionTrace({
      source: 'system',
      actionType: 'program_change',
      route: 'async-descendant',
    });
    descendantTraceId = descendant.traceId;
    runWithAthleteActionTrace(descendant, () => {
      emitAthleteActionEvent(descendant, 'repair_horizon_selected', {
        dependencyWeeksSelected: ['2026-07-13', '2026-07-20'],
      });
    });
  });
  const asyncRecord = getAthleteActionTraceV2(root.traceId);
  ok('async descendants preserve one root trace ID',
    descendantTraceId === root.traceId && asyncRecord?.spans.length === 2, asyncRecord?.spans);

  athleteActionTraceCoordinator.recordBefore({
    token: root,
    semantic: revisionOne,
    visibleCard: { dates: ['2026-07-14', '2026-07-15'] },
    visibleDetail: { dates: ['2026-07-14', '2026-07-15'] },
    persistedEnvelope: { revision: 1 },
  });
  emitAthleteActionEvent(root, 'repair_candidate_rejected', {
    candidateId: 'candidate-1',
    rejectedRuleIds: ['weekly_strength_minimum'],
    rejectionCodes: ['required_strength_count'],
    expected: { minimum: 2 },
    actual: { count: 1 },
    rejectingBoundary: 'accepted_week_gateway',
  });
  const rejected = getAthleteActionTraceV2(root.traceId)?.evidence.repairCandidates;
  ok('rejected candidates retain exact rule, code, expected and actual evidence',
    rejected?.status === 'captured' &&
      rejected.value.some((candidate) =>
        candidate.rejectedRuleIds[0] === 'weekly_strength_minimum' &&
        candidate.rejectedCodes[0] === 'required_strength_count' &&
        candidate.expected.status === 'captured' &&
        candidate.actual.status === 'captured'));

  emitAthleteActionEvent(root, 'accepted_state_publication_result', {
    published: true,
    acceptedStateVersion: 2,
  });
  athleteActionTraceCoordinator.recordPersistence(root, {
    operation: 'readback',
    store: 'program-store',
    attempted: true,
    acknowledged: true,
    expectedFingerprint: capturedTraceField(semanticFingerprintV2({ accepted: true })),
    actualFingerprint: capturedTraceField(semanticFingerprintV2({ accepted: true })),
  });
  const persistence = getAthleteActionTraceV2(root.traceId)?.evidence.persistence;
  ok('persistence readback fingerprint equals the published expectation',
    persistence?.status === 'captured' && persistence.value.some((entry) =>
      entry.operation === 'readback' &&
      entry.expectedFingerprint.status === 'captured' &&
      entry.actualFingerprint.status === 'captured' &&
      entry.expectedFingerprint.value === entry.actualFingerprint.value));
  athleteActionTraceCoordinator.recordRollback(root, {
    memory: { verified: true },
    programEnvelope: { verified: true },
    mirrorEnvelopes: { verified: true },
    visibleProjection: { verified: true },
  });
  const rollback = getAthleteActionTraceV2(root.traceId)?.evidence;
  ok('rollback evidence covers memory, ProgramStore, mirrors and visible projection',
    rollback?.rollbackMemory.status === 'captured' &&
      rollback.rollbackProgramEnvelope.status === 'captured' &&
      rollback.rollbackMirrorEnvelopes.status === 'captured' &&
      rollback.rollbackVisibleProjection.status === 'captured');
  registerAthleteActionUIOutcome({
    traceId: root.traceId,
    observationId: 'move-result',
    domainReturn: { message: 'SECRET_COACH_TEXT' },
    controlId: 'move-result',
  });
  const beforeRender = getAthleteActionTraceV2(root.traceId);
  ok('domain return is distinct from actual rendered UI observation',
    beforeRender?.evidence.uiObservation.status === 'captured' &&
      beforeRender.evidence.uiObservation.value.domainReturn.status === 'captured' &&
      beforeRender.evidence.uiObservation.value.actualRenderedText.status === 'missing');
  observeRenderedAthleteActionOutcome({
    traceId: root.traceId,
    observationId: 'move-result',
    renderedText: 'SECRET_COACH_TEXT',
    controlId: 'move-result',
    accessibilityNode: { id: 'move-result', label: 'SECRET_COACH_TEXT' },
    screenshotReference: 'screenshots/after.png',
    hierarchyReference: 'accessibility-hierarchy/after.json',
  });
  let refusedEarlySuccess = false;
  try {
    athleteActionTraceCoordinator.finalize(root.traceId, 'success');
  } catch {
    refusedEarlySuccess = true;
  }
  ok('terminal success is refused before reload verification', refusedEarlySuccess);
  ok('no terminal-authority success event exists before durable reload verification',
    !getAthleteActionTraceV2(root.traceId)?.events.some((event) => event.terminalAuthority));

  const checkpoint = exportAthleteActionTraceCheckpointV2();
  clearAthleteActionDiagnosticEvents();
  const resumed = resumeAthleteActionTraceCheckpointV2(checkpoint, {
    accepted: { fingerprint: 'accepted-after-reload' },
    persisted: { fingerprint: 'persisted-after-reload' },
    visible: { fingerprint: 'visible-after-reload' },
    coachNotes: { renderedCardIds: [] },
    acceptedRevision: 2,
    verified: true,
  });
  ok('reload resumes the same trace ID',
    resumed.length === 1 && resumed[0] === root.traceId &&
      getAthleteActionTraceV2(root.traceId)?.traceId === root.traceId);
  const resumedRecord = getAthleteActionTraceV2(root.traceId);
  ok('reversible-ledger fingerprint remains present after reload resume',
    resumedRecord?.evidence.semanticAcceptedBefore.status === 'captured' &&
      resumedRecord.evidence.semanticAcceptedBefore.value.componentFingerprints
        .reversibleAdjustmentLedger === revisionOne.componentFingerprints.reversibleAdjustmentLedger);
  ok('reload resume automatically finalizes a ready requested outcome',
    resumedRecord?.status === 'finalized_success');
  const final = athleteActionTraceCoordinator.finalize(root.traceId, 'success');
  ok('success finalizes only after durable, rendered and reload evidence',
    final.status === 'finalized_success' &&
      final.events.some((event) =>
        event.event === 'athlete_action_finalized_success' && event.terminalAuthority));
  const serialized = JSON.stringify(final);
  ok('default trace retains no raw Coach or health text',
    !serialized.includes('SECRET_COACH_TEXT') && !serialized.includes('SECRET_HEALTH'));

  configureAthleteActionDiagnosticsForTests({ enabled: true, production: true });
  clearAthleteActionDiagnosticEvents();
  beginAthleteActionTrace({ source: 'tap', actionType: 'program_change', route: 'release' });
  ok('production hard-disable creates no V2 record', athleteActionTraceCoordinator.getRecords().length === 0);

  configureAthleteActionDiagnosticsForTests(null);
  console.log(`\nAthleteActionTraceV2: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void main();
