(global as unknown as { __DEV__: boolean }).__DEV__ = true;

import {
  DevE2ESeedCoordinator,
  type DevE2ECoordinatorDeps,
} from '../dev/e2e/DevE2ESeedCoordinator';
import {
  clearDevE2EClock,
  createDevE2EClockReceiptForSeed,
  getDevE2EClockReceipt,
  type DevE2EClockReceipt,
} from '../dev/e2e/DevE2EClock';
import {
  DEV_E2E_SCENARIO_PROTOCOL_VERSION,
  DEV_E2E_SCENARIO_REASON,
  type DevE2EScenarioManifest,
} from '../dev/e2e/devE2EScenarioProtocol';
import {
  DEV_E2E_SCENARIO_SESSION_STORAGE_KEY,
  devE2EAcceptedSemanticFingerprint,
  parseDevE2EScenarioSessionRecord,
  readDevE2EScenarioSessionRecord,
  writeDevE2EScenarioSessionRecord,
  type DevE2EScenarioSessionRecord,
} from '../dev/e2e/devE2EScenarioSession';
import {
  writeDevE2ECheckpointRecord,
  type DevE2ECheckpointRecord,
  type DevE2EFingerprintMap,
  type DevE2EKeyValueStorage,
} from '../dev/e2e/devE2ECheckpoint';
import {
  restoreDevE2EClockBeforeHydration,
  writeDevE2EClockReceipt,
} from '../dev/e2e/devE2EClockPersistence';
import {
  activateDevE2EScenarioRuntime,
  __resetDevE2EScenarioRuntimeForTest,
  claimDevE2EScenarioAction,
  clearDevE2EScenarioRuntime,
  readActiveDevE2EScenarioSession,
  registerDevE2EScenarioActionTrace,
} from '../dev/e2e/devE2EScenarioRuntime';
import {
  __resetDevE2EStateForTest,
  devE2EMarkers,
  getDevE2EStateSnapshot,
} from '../dev/e2e/devE2EState';
import type { DevE2ESeed } from '../dev/e2e/devE2ESeedRegistry';
import { DEV_E2E_SEED_IDS } from '../dev/e2e/devE2ESeedIds';
import { DEV_E2E_SCENARIO_MANIFESTS } from '../dev/e2e/devE2EScenarioManifestRegistry';
import { AthleteActionTraceCoordinator } from '../dev/e2e/AthleteActionTraceCoordinator';

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? `: ${detail}` : ''}`);
    console.log(`  ✗ ${name}`);
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

class MemoryStorage implements DevE2EKeyValueStorage {
  readonly values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

const MANIFEST: DevE2EScenarioManifest = {
  protocolVersion: DEV_E2E_SCENARIO_PROTOCOL_VERSION,
  scenarioId: 'explorer-three-action',
  seedId: 'standard-in-season-week',
  steps: [
    {
      stepId: 'move-one',
      action: { actionType: 'move_session', sources: ['tap'] },
      eligibilityWitnessIds: ['witness-move-one'],
    },
    {
      stepId: 'delete-two',
      action: { actionType: 'delete_component', sources: ['tap'] },
      eligibilityWitnessIds: ['witness-delete-two'],
    },
    {
      stepId: 'feedback-three',
      action: { actionType: 'session_feedback', sources: ['tap'] },
      eligibilityWitnessIds: ['witness-feedback-three'],
    },
  ],
};

function seed(): DevE2ESeed {
  return {
    id: MANIFEST.seedId,
    anchorDate: '2026-07-13',
    profile: { firstName: 'Scenario' },
    program: {
      id: 'dev-e2e-standard-in-season-week',
      userId: 'dev-e2e-athlete',
      name: 'Scenario protocol seed',
      description: 'Scenario protocol seed',
      programPhase: 'In-Season',
      startDate: '2026-07-13T12:00:00.000Z',
      endDate: '2026-07-19T12:00:00.000Z',
      microcycles: [{
        id: 'scenario-week',
        programId: 'dev-e2e-standard-in-season-week',
        weekNumber: 1,
        startDate: '2026-07-13T12:00:00.000Z',
        endDate: '2026-07-19T12:00:00.000Z',
        miniCycleNumber: 1,
        intensityMultiplier: 1,
        workouts: [],
        createdAt: '2026-07-13T12:00:00.000Z',
        updatedAt: '2026-07-13T12:00:00.000Z',
      }],
      primaryFocus: 'Scenario',
      isActive: true,
      createdAt: '2026-07-13T12:00:00.000Z',
      updatedAt: '2026-07-13T12:00:00.000Z',
    },
    auxiliaryState: [],
    witnesses: [],
  };
}

interface Harness {
  deps: DevE2ECoordinatorDeps;
  coordinator: () => DevE2ESeedCoordinator;
  startAction: (
    actionType: 'move_session' | 'delete_component' | 'session_feedback',
    state: string,
  ) => string;
  coldProcess: () => void;
  setPersisted: (fingerprints: DevE2EFingerprintMap) => void;
  setBlockedStep: (stepId: string | null) => void;
  getSession: () => DevE2EScenarioSessionRecord | null;
  getCheckpoint: () => DevE2ECheckpointRecord | null;
  getClock: () => DevE2EClockReceipt | null;
  buildCalls: () => number;
  getTrace: ReturnType<typeof createHarnessTraceReader>;
}

function createHarnessTraceReader(
  coordinator: AthleteActionTraceCoordinator,
) {
  return (traceId: string) => coordinator.getRecord(traceId);
}

function createHarness(): Harness {
  let memory: DevE2EFingerprintMap = { state: 'empty' };
  let persisted: DevE2EFingerprintMap = { state: 'empty' };
  let checkpoint: DevE2ECheckpointRecord | null = null;
  let scenarioSession: DevE2EScenarioSessionRecord | null = null;
  let activeClock: DevE2EClockReceipt | null = null;
  let blockedStepId: string | null = null;
  let seedBuildCalls = 0;
  const traceCoordinator = new AthleteActionTraceCoordinator(
    () => true,
    () => new Date('2026-07-13T12:00:00.000Z'),
  );

  const deps: DevE2ECoordinatorDeps = {
    waitForHydration: async () => {},
    resetLocalState: () => {
      traceCoordinator.clear();
      memory = { state: 'empty' };
    },
    clearClock: async () => { activeClock = null; },
    installClock: async () => {
      activeClock = createDevE2EClockReceiptForSeed(
        MANIFEST.seedId,
        '2026-07-13T00:00:00.000Z',
      );
      return activeClock;
    },
    readClockReceipt: () => activeClock,
    readTodayISO: () => '2026-07-13',
    waitForPersistence: async (expected = memory) => {
      persisted = clone(expected);
      return clone(persisted);
    },
    buildSeed: () => {
      seedBuildCalls += 1;
      return seed();
    },
    writeProfile: () => {},
    installProgram: () => { memory = { state: 'seeded' }; },
    applyAuxiliaryState: () => {},
    completeOnboarding: () => {},
    readWitnessState: () => ({
      program: null,
      profile: {},
      calendarMarks: {},
      activeInjury: null,
      activeConstraints: [],
      sessionFeedback: {},
    }),
    validateWitnesses: () => [],
    captureMemoryFingerprints: () => clone(memory),
    fingerprintMapsMatch: (left, right) =>
      JSON.stringify(left) === JSON.stringify(right),
    writeCheckpoint: async (record) => { checkpoint = clone(record); },
    readCheckpoint: async () => checkpoint ? clone(checkpoint) : null,
    readPersistedFingerprints: async () => clone(persisted),
    clearCheckpoint: async () => { checkpoint = null; },
    writeScenarioSession: async (record) => {
      scenarioSession = parseDevE2EScenarioSessionRecord(clone(record));
    },
    readScenarioSession: async () =>
      scenarioSession ? clone(scenarioSession) : null,
    clearScenarioSession: async () => { scenarioSession = null; },
    resolveScenarioManifest: (scenarioId) =>
      scenarioId === MANIFEST.scenarioId ? MANIFEST : null,
    evaluateScenarioEligibility: ({ nextStep }) => blockedStepId === nextStep.stepId
      ? {
          status: 'blocked',
          reasonCode: 'witness_blocked',
          witnessIds: [`blocked:${nextStep.stepId}`],
        }
      : {
          status: 'eligible',
          reasonCode: DEV_E2E_SCENARIO_REASON.ELIGIBLE,
          witnessIds: [...nextStep.eligibilityWitnessIds],
        },
    activateScenarioSession: activateDevE2EScenarioRuntime,
    readActiveScenarioSession: readActiveDevE2EScenarioSession,
    clearScenarioRuntime: clearDevE2EScenarioRuntime,
    captureUnfinishedAthleteActionTraces: () => traceCoordinator.exportCheckpoint(),
    resumeAthleteActionTraces: (unfinished, evidence) =>
      traceCoordinator.resumeCheckpoint(unfinished, evidence),
    captureReloadEvidence: (accepted, durable) => ({
      accepted,
      persisted: durable,
      visible: { state: accepted.state },
      coachNotes: { renderedCardIds: [] },
      verified: true,
    }),
  };

  return {
    deps,
    coordinator: () => new DevE2ESeedCoordinator(true, deps),
    startAction: (actionType, state) => {
      const claim = claimDevE2EScenarioAction({
        source: 'tap',
        actionType,
      });
      if (!claim) throw new Error(`scenario claim missing for ${actionType}`);
      const trace = traceCoordinator.startRoot({
        source: 'tap',
        actionType,
        route: `scenario-${state}`,
        scenarioRunId: claim.scenarioId,
        scenarioStepId: claim.scenarioStepId,
        seedId: claim.seedId,
        priorActionTraceId: claim.priorActionTraceId,
      });
      registerDevE2EScenarioActionTrace(claim, trace.traceId);
      memory = { state };
      return trace.traceId;
    },
    coldProcess: () => {
      traceCoordinator.clear();
      __resetDevE2EScenarioRuntimeForTest();
      __resetDevE2EStateForTest();
    },
    setPersisted: (fingerprints) => { persisted = clone(fingerprints); },
    setBlockedStep: (stepId) => { blockedStepId = stepId; },
    getSession: () => scenarioSession ? clone(scenarioSession) : null,
    getCheckpoint: () => checkpoint ? clone(checkpoint) : null,
    getClock: () => activeClock,
    buildCalls: () => seedBuildCalls,
    getTrace: createHarnessTraceReader(traceCoordinator),
  };
}

async function main(): Promise<void> {
  __resetDevE2EScenarioRuntimeForTest();
  __resetDevE2EStateForTest();
  ok('default scenario manifests add no seed families',
    DEV_E2E_SCENARIO_MANIFESTS.length === DEV_E2E_SEED_IDS.length &&
      DEV_E2E_SCENARIO_MANIFESTS.every((manifest) =>
        DEV_E2E_SEED_IDS.includes(manifest.seedId)));

  const harness = createHarness();
  let coordinator = harness.coordinator();
  ok('scenario reset installs one seed',
    await coordinator.resetScenario(MANIFEST.scenarioId));
  ok('scenario reset creates reloadCount 0',
    harness.getSession()?.reloadCount === 0);
  ok('scenario and first-action eligibility markers are published',
    devE2EMarkers(getDevE2EStateSnapshot()).includes(
      `e2e-scenario-ready-${MANIFEST.scenarioId}`,
    ) &&
      devE2EMarkers(getDevE2EStateSnapshot()).includes(
        `e2e-next-action-eligible-${MANIFEST.scenarioId}-move-one`,
      ));
  const clockFingerprint = harness.getClock()?.semanticFingerprint;

  const firstTraceId = harness.startAction('move_session', 'after-move');
  ok('first checkpoint is accepted in manifest order',
    await coordinator.checkpointScenario(MANIFEST.scenarioId, 'move-one'));
  ok('checkpoint marker includes scenario and step identity',
    devE2EMarkers(getDevE2EStateSnapshot()).includes(
      `e2e-checkpoint-ready-${MANIFEST.scenarioId}-move-one`,
    ));
  ok('checkpoint persists the current TraceV2 correlation',
    harness.getCheckpoint()?.activeActionTraceId === firstTraceId &&
      harness.getSession()?.activeActionTraceId === firstTraceId);

  let duplicateRejected = false;
  try {
    await coordinator.checkpointScenario(MANIFEST.scenarioId, 'move-one');
  } catch {
    duplicateRejected = true;
  }
  ok('duplicate checkpoint is explicitly rejected',
    duplicateRejected &&
      devE2EMarkers(getDevE2EStateSnapshot()).includes(
        'e2e-scenario-error-checkpoint_duplicate',
      ));

  let preReloadActionBlocked = false;
  try {
    claimDevE2EScenarioAction({
      source: 'tap',
      actionType: 'delete_component',
    });
  } catch {
    preReloadActionBlocked = true;
  }
  ok('next action cannot begin before its post-reload eligibility marker',
    preReloadActionBlocked);

  harness.coldProcess();
  coordinator = harness.coordinator();
  ok('first cold reload restores the scenario', await coordinator.validateReloadCheckpoint());
  ok('reload marker includes scenario, checkpoint and reload count',
    devE2EMarkers(getDevE2EStateSnapshot()).includes(
      `e2e-reload-ready-${MANIFEST.scenarioId}-move-one-1`,
    ));
  ok('first reload increments reloadCount without reseeding',
    harness.getSession()?.reloadCount === 1 && harness.buildCalls() === 1);
  ok('clock identity is preserved across the first reload',
    harness.getClock()?.semanticFingerprint === clockFingerprint);

  const secondTraceId = harness.startAction('delete_component', 'after-delete');
  const secondTrace = harness.getTrace(secondTraceId);
  ok('second action owns a new root linked to the prior action trace',
    secondTraceId !== firstTraceId &&
      secondTrace?.root.priorActionTraceId.status === 'captured' &&
      secondTrace.root.priorActionTraceId.value === firstTraceId);
  ok('second checkpoint is accepted without reseeding',
    await coordinator.checkpointScenario(MANIFEST.scenarioId, 'delete-two'));

  harness.coldProcess();
  coordinator = harness.coordinator();
  ok('second cold reload restores the scenario', await coordinator.validateReloadCheckpoint());
  ok('second reload preserves TraceV2 correlation and no reseed',
    harness.getSession()?.priorActionTraceId === secondTraceId &&
      harness.getSession()?.reloadCount === 2 &&
      harness.buildCalls() === 1);

  const thirdTraceId = harness.startAction('session_feedback', 'after-feedback');
  const thirdTrace = harness.getTrace(thirdTraceId);
  ok('third action is a distinct root linked to the second trace',
    thirdTraceId !== secondTraceId &&
      thirdTrace?.root.priorActionTraceId.status === 'captured' &&
      thirdTrace.root.priorActionTraceId.value === secondTraceId);
  ok('final checkpoint marks the scenario complete',
    await coordinator.checkpointScenario(MANIFEST.scenarioId, 'feedback-three') &&
      devE2EMarkers(getDevE2EStateSnapshot()).includes(
        `e2e-scenario-complete-${MANIFEST.scenarioId}`,
      ));

  harness.coldProcess();
  coordinator = harness.coordinator();
  ok('third cold reload restores the completed scenario',
    await coordinator.validateReloadCheckpoint());
  ok('scenario completion survives another reload',
    harness.getSession()?.reloadCount === 3 &&
      harness.getSession()?.nextActionEligibility.status === 'complete' &&
      devE2EMarkers(getDevE2EStateSnapshot()).includes(
        `e2e-scenario-complete-${MANIFEST.scenarioId}`,
      ));
  ok('three ordered actions and three reloads use one seed install',
    harness.buildCalls() === 1);
  ok('deterministic updatedAt advances from the fixed clock identity',
    harness.getSession()?.updatedAt === '2026-07-13T02:00:00.006Z');
  harness.coldProcess();
  coordinator = harness.coordinator();
  ok('completed scenario survives an additional cold reload',
    await coordinator.validateReloadCheckpoint() &&
      harness.getSession()?.reloadCount === 4 &&
      harness.getSession()?.nextActionEligibility.status === 'complete' &&
      harness.getSession()?.updatedAt === '2026-07-13T02:00:00.007Z' &&
      harness.buildCalls() === 1);

  const outOfOrder = createHarness();
  let outOfOrderCoordinator = outOfOrder.coordinator();
  await outOfOrderCoordinator.resetScenario(MANIFEST.scenarioId);
  outOfOrder.startAction('move_session', 'out-of-order');
  let outOfOrderRejected = false;
  try {
    await outOfOrderCoordinator.checkpointScenario(
      MANIFEST.scenarioId,
      'delete-two',
    );
  } catch {
    outOfOrderRejected = true;
  }
  ok('out-of-order checkpoint fails closed with its exact marker',
    outOfOrderRejected &&
      devE2EMarkers(getDevE2EStateSnapshot()).includes(
        'e2e-scenario-error-checkpoint_out_of_order',
      ) &&
      outOfOrder.getCheckpoint() === null);

  const stale = createHarness();
  let staleCoordinator = stale.coordinator();
  await staleCoordinator.resetScenario(MANIFEST.scenarioId);
  stale.startAction('move_session', 'stale-after-move');
  await staleCoordinator.checkpointScenario(MANIFEST.scenarioId, 'move-one');
  stale.setPersisted({ state: 'stale' });
  stale.coldProcess();
  staleCoordinator = stale.coordinator();
  let staleRejected = false;
  try {
    await staleCoordinator.validateReloadCheckpoint();
  } catch {
    staleRejected = true;
  }
  ok('stale persisted fingerprints fail closed',
    staleRejected &&
      devE2EMarkers(getDevE2EStateSnapshot()).includes(
        'e2e-scenario-error-stale_fingerprint',
      ));

  const blocked = createHarness();
  let blockedCoordinator = blocked.coordinator();
  await blockedCoordinator.resetScenario(MANIFEST.scenarioId);
  blocked.startAction('move_session', 'blocked-after-move');
  await blockedCoordinator.checkpointScenario(MANIFEST.scenarioId, 'move-one');
  blocked.setBlockedStep('delete-two');
  blocked.coldProcess();
  blockedCoordinator = blocked.coordinator();
  await blockedCoordinator.validateReloadCheckpoint();
  let blockedActionRejected = false;
  try {
    claimDevE2EScenarioAction({
      source: 'tap',
      actionType: 'delete_component',
    });
  } catch {
    blockedActionRejected = true;
  }
  ok('blocked next action cannot create a TraceV2 root',
    blockedActionRejected &&
      devE2EMarkers(getDevE2EStateSnapshot()).includes(
        'e2e-scenario-error-next_action_blocked',
      ));

  const storage = new MemoryStorage();
  const completedSession = harness.getSession()!;
  const completedCheckpoint = harness.getCheckpoint()!;
  const completedClock = harness.getClock()!;
  ok('persisted scenario session uses the exact V2 protocol schema',
    Object.keys(completedSession).sort().join(',') === [
      'activeActionTraceId',
      'checkpointStepId',
      'clockFingerprint',
      'currentAcceptedSemanticFingerprint',
      'nextActionEligibility',
      'persistedStoreFingerprints',
      'priorActionTraceId',
      'protocolVersion',
      'reloadCount',
      'scenarioId',
      'seedId',
      'updatedAt',
    ].sort().join(',') &&
      Object.keys(completedSession.nextActionEligibility).sort().join(',') ===
        ['nextStepId', 'reasonCode', 'status', 'witnessIds'].sort().join(','));
  await writeDevE2EScenarioSessionRecord(completedSession, storage);
  ok('scenario session record round-trips through its dedicated storage key',
    storage.values.has(DEV_E2E_SCENARIO_SESSION_STORAGE_KEY) &&
      (await readDevE2EScenarioSessionRecord(storage))?.reloadCount === 4);
  await writeDevE2ECheckpointRecord(completedCheckpoint, storage);
  await writeDevE2EClockReceipt(completedClock, storage);
  clearDevE2EClock();
  ok('pre-hydration clock restore accepts the post-reload session form',
    await restoreDevE2EClockBeforeHydration({ storage }) &&
      getDevE2EClockReceipt()?.semanticFingerprint ===
        completedClock.semanticFingerprint);
  storage.values.set(DEV_E2E_SCENARIO_SESSION_STORAGE_KEY, JSON.stringify({
    ...completedSession,
    nextActionEligibility: {
      ...completedSession.nextActionEligibility,
      status: 'eligible',
    },
  }));
  let corruptRejected = false;
  try {
    await readDevE2EScenarioSessionRecord(storage);
  } catch (error) {
    corruptRejected = (error as { reasonCode?: string }).reasonCode ===
      DEV_E2E_SCENARIO_REASON.CORRUPT_SESSION;
  }
  ok('corrupt scenario session is rejected with the exact reason code',
    corruptRejected);
  __resetDevE2EStateForTest();
  const corruptCoordinator = new DevE2ESeedCoordinator(true, {
    ...harness.deps,
    readCheckpoint: async () => null,
    readScenarioSession: async () => parseDevE2EScenarioSessionRecord({
      protocolVersion: 2,
    }),
  });
  let corruptReloadRejected = false;
  try {
    await corruptCoordinator.validateReloadCheckpoint();
  } catch {
    corruptReloadRejected = true;
  }
  ok('corrupt cold-launch session publishes its exact fail-closed marker',
    corruptReloadRejected &&
      devE2EMarkers(getDevE2EStateSnapshot()).includes(
        'e2e-scenario-error-corrupt_session',
      ));
  ok('accepted semantic fingerprint is derived from persisted store fingerprints',
    completedSession.currentAcceptedSemanticFingerprint ===
      devE2EAcceptedSemanticFingerprint(
        completedSession.persistedStoreFingerprints,
      ));

  const releaseCalls: string[] = [];
  const release = new DevE2ESeedCoordinator(false, {
    ...harness.deps,
    resolveScenarioManifest: () => {
      releaseCalls.push('manifest');
      return MANIFEST;
    },
    readScenarioSession: async () => {
      releaseCalls.push('session');
      return completedSession;
    },
  });
  ok('release coordinator cannot activate scenario sessions',
    !(await release.resetScenario(MANIFEST.scenarioId)) &&
      !(await release.checkpointScenario(MANIFEST.scenarioId, 'move-one')) &&
      !(await release.validateReloadCheckpoint()) &&
      releaseCalls.length === 0);
  (global as unknown as { __DEV__: boolean }).__DEV__ = false;
  ok('release runtime refuses a durable scenario session',
    !activateDevE2EScenarioRuntime(completedSession, MANIFEST) &&
      claimDevE2EScenarioAction({
        source: 'tap',
        actionType: 'move_session',
      }) === null);
  (global as unknown as { __DEV__: boolean }).__DEV__ = true;

  __resetDevE2EScenarioRuntimeForTest();
  __resetDevE2EStateForTest();

  console.log(`\nDev E2E scenario session V2: ${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.log(`  • ${failure}`));
    process.exit(1);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
