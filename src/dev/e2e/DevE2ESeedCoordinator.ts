import { isDevE2ESeedId, type DevE2ESeedId } from './devE2ESeedIds';
import type {
  DevE2EAuxiliaryState,
  DevE2ESeed,
  DevE2EWitness,
  DevE2EWitnessState,
} from './devE2ESeedRegistry';
import type {
  DevE2ECheckpointRecord,
  DevE2EFingerprintMap,
} from './devE2EPersistence';
import {
  assertDevE2EClockMatchesCheckpoint,
  type DevE2EClockReceipt,
} from './DevE2EClock';
import {
  setDevE2ECheckpointReady,
  setDevE2EReloadReady,
  setDevE2EScenarioCheckpointReady,
  setDevE2EScenarioError,
  setDevE2EScenarioReady,
  setDevE2EScenarioReloadReady,
  setDevE2ESeedError,
  setDevE2ESeedLoading,
  setDevE2ESeedReady,
} from './devE2EState';
import type {
  AthleteActionReloadEvidenceV2,
  AthleteActionTraceCheckpointV2,
} from './AthleteActionTraceCoordinator';
import {
  deterministicDevE2EScenarioUpdatedAt,
  devE2EScenarioReasonCode,
  expectedDevE2ENextStep,
  isDevE2EScenarioProtocolId,
  validateDevE2EScenarioManifest,
  DEV_E2E_SCENARIO_REASON,
  DevE2EScenarioProtocolError,
  type DevE2EScenarioEligibilityContext,
  type DevE2EScenarioEligibilityDecision,
  type DevE2EScenarioManifest,
} from './devE2EScenarioProtocol';
import {
  devE2EAcceptedSemanticFingerprint,
  type DevE2EScenarioSessionRecord,
} from './devE2EScenarioSession';

export interface DevE2ECoordinatorDeps {
  /** Scenario-session V2 consumes the already-verified campaign prerequisite. */
  requireScenarioBootstrap: () => Promise<void>;
  waitForHydration: () => Promise<void>;
  resetLocalState: () => void;
  clearClock: () => Promise<void>;
  installClock: (seedId: DevE2ESeedId) => Promise<DevE2EClockReceipt>;
  readClockReceipt: () => DevE2EClockReceipt | null;
  readTodayISO: () => string;
  waitForPersistence: (
    expected?: DevE2EFingerprintMap,
    timeoutMs?: number,
  ) => Promise<DevE2EFingerprintMap>;
  buildSeed: (seedId: DevE2ESeedId) => DevE2ESeed;
  writeProfile: (seed: DevE2ESeed) => void;
  installProgram: (seed: DevE2ESeed) => void;
  applyAuxiliaryState: (items: readonly DevE2EAuxiliaryState[]) => Promise<void> | void;
  completeOnboarding: () => void;
  readWitnessState: () => DevE2EWitnessState;
  validateWitnesses: (
    seedId: DevE2ESeedId,
    witnesses: readonly DevE2EWitness[],
    state: DevE2EWitnessState,
  ) => string[];
  captureMemoryFingerprints: () => DevE2EFingerprintMap;
  fingerprintMapsMatch: (
    left: DevE2EFingerprintMap,
    right: DevE2EFingerprintMap,
  ) => boolean;
  writeCheckpoint: (record: DevE2ECheckpointRecord) => Promise<void>;
  readCheckpoint: () => Promise<DevE2ECheckpointRecord | null>;
  readPersistedFingerprints: () => Promise<DevE2EFingerprintMap>;
  clearCheckpoint: () => Promise<void>;
  writeScenarioSession: (record: DevE2EScenarioSessionRecord) => Promise<void>;
  readScenarioSession: () => Promise<DevE2EScenarioSessionRecord | null>;
  clearScenarioSession: () => Promise<void>;
  resolveScenarioManifest: (scenarioId: string) => DevE2EScenarioManifest | null;
  evaluateScenarioEligibility: (
    context: DevE2EScenarioEligibilityContext,
  ) => DevE2EScenarioEligibilityDecision;
  activateScenarioSession: (
    session: DevE2EScenarioSessionRecord,
    manifest: DevE2EScenarioManifest,
  ) => boolean;
  readActiveScenarioSession: () => DevE2EScenarioSessionRecord | null;
  clearScenarioRuntime: () => void;
  captureUnfinishedAthleteActionTraces: () => AthleteActionTraceCheckpointV2;
  resumeAthleteActionTraces: (
    checkpoint: AthleteActionTraceCheckpointV2 | null | undefined,
    evidence: AthleteActionReloadEvidenceV2,
  ) => string[];
  captureReloadEvidence: (
    memory: DevE2EFingerprintMap,
    persisted: DevE2EFingerprintMap,
  ) => AthleteActionReloadEvidenceV2;
}

function fingerprintMismatchReason(
  expected: DevE2EFingerprintMap,
  actual: DevE2EFingerprintMap,
): string {
  return Array.from(new Set([...Object.keys(expected), ...Object.keys(actual)]))
    .sort()
    .filter((key) => expected[key] !== actual[key])
    .map((key) => `${key} expected=${expected[key] ?? '<missing>'} actual=${actual[key] ?? '<missing>'}`)
    .join('; ');
}

function traceIdsMatch(expected: readonly string[], actual: readonly string[]): boolean {
  const sortedExpected = [...expected].sort();
  const sortedActual = [...actual].sort();
  return sortedExpected.length === sortedActual.length &&
    sortedExpected.every((traceId, index) => traceId === sortedActual[index]);
}

function scenarioFailure(reasonCode: string, message: string): DevE2EScenarioProtocolError {
  return new DevE2EScenarioProtocolError(reasonCode, message);
}

/**
 * Deterministic protocol owner. Store/API wiring lives in the default adapter;
 * keeping this class pure makes release refusal and ordering independently
 * testable without importing React Native or Zustand.
 */
export class DevE2ESeedCoordinator {
  private operation: Promise<unknown> = Promise.resolve();
  private activeSeedId: DevE2ESeedId | null = null;

  constructor(
    private readonly isDev: boolean,
    private readonly deps: DevE2ECoordinatorDeps,
  ) {}

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.operation.then(operation, operation);
    this.operation = next.then(() => undefined, () => undefined);
    return next;
  }

  async reset(seedIdValue: string): Promise<boolean> {
    if (!this.isDev || !isDevE2ESeedId(seedIdValue)) return false;
    const seedId = seedIdValue;
    return this.enqueue(async () => {
      setDevE2ESeedLoading(seedId);
      try {
        this.activeSeedId = null;
        await this.deps.waitForHydration();
        await this.deps.clearCheckpoint();
        await this.deps.clearScenarioSession();
        this.deps.clearScenarioRuntime();
        await this.deps.clearClock();
        this.deps.resetLocalState();
        const accepted = this.deps.captureMemoryFingerprints();
        await this.deps.waitForPersistence(accepted);
        const stableAccepted = this.deps.captureMemoryFingerprints();
        if (!this.deps.fingerprintMapsMatch(accepted, stableAccepted)) {
          throw new Error(
            `Accepted state changed while reset persistence converged: ${fingerprintMismatchReason(accepted, stableAccepted)}`,
          );
        }
        const clockReceipt = await this.deps.installClock(seedId);
        const seed = this.deps.buildSeed(seedId);
        if (clockReceipt.seedId !== seed.id || this.deps.readTodayISO() !== seed.anchorDate) {
          throw new Error(
            `Seed clock witness failed: seed=${seed.id} today=${this.deps.readTodayISO()} anchor=${seed.anchorDate}.`,
          );
        }
        this.deps.writeProfile(seed);
        this.deps.installProgram(seed);
        await this.deps.applyAuxiliaryState(seed.auxiliaryState);
        this.deps.completeOnboarding();
        const failures = this.deps.validateWitnesses(
          seedId,
          seed.witnesses,
          this.deps.readWitnessState(),
        );
        if (failures.length > 0) {
          throw new Error(`Seed witness validation failed: ${failures.join(', ')}`);
        }
        await this.deps.waitForPersistence();
        this.activeSeedId = seedId;
        setDevE2ESeedReady(seedId);
        return true;
      } catch (error) {
        try {
          await this.deps.clearClock();
        } catch {
          // Preserve the original deterministic reset failure.
        }
        setDevE2ESeedError(error, seedId);
        throw error;
      }
    });
  }

  async resetScenario(scenarioIdValue: string): Promise<boolean> {
    if (!this.isDev || !isDevE2EScenarioProtocolId(scenarioIdValue)) return false;
    const resolved = this.deps.resolveScenarioManifest(scenarioIdValue);
    if (!resolved) return false;
    const manifest = validateDevE2EScenarioManifest(resolved);
    return this.enqueue(async () => {
      try {
        await this.deps.requireScenarioBootstrap();
        setDevE2ESeedLoading(manifest.seedId);
        this.activeSeedId = null;
        await this.deps.waitForHydration();
        await this.deps.clearCheckpoint();
        await this.deps.clearScenarioSession();
        this.deps.clearScenarioRuntime();
        await this.deps.clearClock();
        this.deps.resetLocalState();
        const emptyAccepted = this.deps.captureMemoryFingerprints();
        await this.deps.waitForPersistence(emptyAccepted);
        const stableEmptyAccepted = this.deps.captureMemoryFingerprints();
        if (!this.deps.fingerprintMapsMatch(
          emptyAccepted,
          stableEmptyAccepted,
        )) {
          throw scenarioFailure(
            DEV_E2E_SCENARIO_REASON.STALE_FINGERPRINT,
            `Accepted state changed while scenario reset cleared persistence: ${fingerprintMismatchReason(emptyAccepted, stableEmptyAccepted)}`,
          );
        }
        const clockReceipt = await this.deps.installClock(manifest.seedId);
        const seed = this.deps.buildSeed(manifest.seedId);
        if (clockReceipt.seedId !== seed.id || this.deps.readTodayISO() !== seed.anchorDate) {
          throw scenarioFailure(
            DEV_E2E_SCENARIO_REASON.CLOCK_MISMATCH,
            `Seed clock witness failed: seed=${seed.id} today=${this.deps.readTodayISO()} anchor=${seed.anchorDate}.`,
          );
        }
        this.deps.writeProfile(seed);
        this.deps.installProgram(seed);
        await this.deps.applyAuxiliaryState(seed.auxiliaryState);
        this.deps.completeOnboarding();
        const failures = this.deps.validateWitnesses(
          manifest.seedId,
          seed.witnesses,
          this.deps.readWitnessState(),
        );
        if (failures.length > 0) {
          throw scenarioFailure(
            DEV_E2E_SCENARIO_REASON.MANIFEST_INVALID,
            `Seed witness validation failed: ${failures.join(', ')}`,
          );
        }
        const accepted = this.deps.captureMemoryFingerprints();
        const persisted = await this.deps.waitForPersistence(accepted);
        const stableAccepted = this.deps.captureMemoryFingerprints();
        if (!this.deps.fingerprintMapsMatch(accepted, stableAccepted)) {
          throw scenarioFailure(
            DEV_E2E_SCENARIO_REASON.STALE_FINGERPRINT,
            `Accepted state changed while scenario reset persistence converged: ${fingerprintMismatchReason(accepted, stableAccepted)}`,
          );
        }
        const nextStep = expectedDevE2ENextStep(manifest, null);
        if (!nextStep) {
          throw scenarioFailure(
            DEV_E2E_SCENARIO_REASON.MANIFEST_INVALID,
            `Dev E2E scenario has no first step: ${manifest.scenarioId}.`,
          );
        }
        const baseSession: DevE2EScenarioSessionRecord = {
          protocolVersion: 2,
          scenarioId: manifest.scenarioId,
          seedId: manifest.seedId,
          checkpointStepId: null,
          activeActionTraceId: null,
          priorActionTraceId: null,
          reloadCount: 0,
          currentAcceptedSemanticFingerprint:
            devE2EAcceptedSemanticFingerprint(stableAccepted),
          persistedStoreFingerprints: persisted,
          clockFingerprint: clockReceipt.semanticFingerprint,
          nextActionEligibility: {
            nextStepId: nextStep.stepId,
            status: 'blocked',
            reasonCode: DEV_E2E_SCENARIO_REASON.NEXT_ACTION_BLOCKED,
            witnessIds: [],
          },
          updatedAt: deterministicDevE2EScenarioUpdatedAt({
            clockReceipt,
            manifest,
            checkpointStepId: null,
            reloadCount: 0,
          }),
        };
        const eligibility = this.deps.evaluateScenarioEligibility({
          phase: 'reset',
          manifest,
          session: baseSession,
          nextStep,
        });
        const session: DevE2EScenarioSessionRecord = {
          ...baseSession,
          nextActionEligibility: {
            nextStepId: nextStep.stepId,
            status: eligibility.status,
            reasonCode: eligibility.reasonCode,
            witnessIds: [...eligibility.witnessIds],
          },
        };
        await this.deps.writeScenarioSession(session);
        if (!this.deps.activateScenarioSession(session, manifest)) {
          throw scenarioFailure(
            DEV_E2E_SCENARIO_REASON.NEXT_ACTION_BLOCKED,
            'Dev E2E scenario runtime is unavailable.',
          );
        }
        this.activeSeedId = manifest.seedId;
        setDevE2EScenarioReady({
          scenarioId: manifest.scenarioId,
          seedId: manifest.seedId,
          nextStepId: session.nextActionEligibility.nextStepId,
          eligibilityStatus: session.nextActionEligibility.status,
          eligibilityReasonCode: session.nextActionEligibility.reasonCode,
        });
        return true;
      } catch (error) {
        try {
          await this.deps.clearClock();
        } catch {
          // Preserve the original deterministic reset failure.
        }
        this.deps.clearScenarioRuntime();
        setDevE2EScenarioError(
          devE2EScenarioReasonCode(error) ?? DEV_E2E_SCENARIO_REASON.CORRUPT_SESSION,
          error,
          manifest.scenarioId,
        );
        throw error;
      }
    });
  }

  async checkpoint(checkpointIdValue: string): Promise<boolean> {
    if (!this.isDev || !isDevE2ESeedId(checkpointIdValue)) return false;
    const checkpointId = checkpointIdValue;
    return this.enqueue(async () => {
      try {
        await this.deps.waitForHydration();
        if (!this.activeSeedId) {
          throw new Error('Checkpoint requires a ready seed in the current app run.');
        }
        const clockReceipt = this.deps.readClockReceipt();
        if (!clockReceipt || clockReceipt.seedId !== this.activeSeedId) {
          throw new Error('Checkpoint requires the active seed clock receipt.');
        }
        const fingerprints = this.deps.captureMemoryFingerprints();
        await this.deps.waitForPersistence();
        const current = this.deps.captureMemoryFingerprints();
        if (!this.deps.fingerprintMapsMatch(fingerprints, current)) {
          throw new Error(
            `Accepted state changed while the checkpoint was being persisted: ${fingerprintMismatchReason(fingerprints, current)}`,
          );
        }
        await this.deps.writeCheckpoint({
          version: 2,
          seedId: this.activeSeedId,
          checkpointId,
          fingerprints,
          clockFingerprint: clockReceipt.semanticFingerprint,
          unfinishedAthleteActionTraces:
            this.deps.captureUnfinishedAthleteActionTraces(),
        });
        setDevE2ECheckpointReady(checkpointId);
        return true;
      } catch (error) {
        setDevE2ESeedError(error, checkpointId);
        throw error;
      }
    });
  }

  async checkpointScenario(
    scenarioIdValue: string,
    checkpointStepIdValue: string,
  ): Promise<boolean> {
    if (!this.isDev ||
      !isDevE2EScenarioProtocolId(scenarioIdValue) ||
      !isDevE2EScenarioProtocolId(checkpointStepIdValue)) return false;
    return this.enqueue(async () => {
      try {
        await this.deps.waitForHydration();
        const session = this.deps.readActiveScenarioSession();
        if (!session || session.scenarioId !== scenarioIdValue) {
          throw scenarioFailure(
            DEV_E2E_SCENARIO_REASON.CORRUPT_SESSION,
            `Checkpoint requires active scenario ${scenarioIdValue}.`,
          );
        }
        const resolved = this.deps.resolveScenarioManifest(session.scenarioId);
        if (!resolved) {
          throw scenarioFailure(
            DEV_E2E_SCENARIO_REASON.MANIFEST_NOT_FOUND,
            `Dev E2E scenario manifest not found: ${session.scenarioId}.`,
          );
        }
        const manifest = validateDevE2EScenarioManifest(resolved);
        if (session.checkpointStepId === checkpointStepIdValue) {
          throw scenarioFailure(
            DEV_E2E_SCENARIO_REASON.CHECKPOINT_DUPLICATE,
            `Dev E2E scenario checkpoint is duplicate: ${checkpointStepIdValue}.`,
          );
        }
        const expectedStep = expectedDevE2ENextStep(
          manifest,
          session.checkpointStepId,
        );
        if (!expectedStep || expectedStep.stepId !== checkpointStepIdValue ||
          session.nextActionEligibility.nextStepId !== checkpointStepIdValue) {
          throw scenarioFailure(
            DEV_E2E_SCENARIO_REASON.CHECKPOINT_OUT_OF_ORDER,
            `Dev E2E scenario checkpoint out of order: expected=${expectedStep?.stepId ?? '<complete>'} actual=${checkpointStepIdValue}.`,
          );
        }
        if (session.nextActionEligibility.status !== 'eligible') {
          throw scenarioFailure(
            DEV_E2E_SCENARIO_REASON.NEXT_ACTION_BLOCKED,
            `Dev E2E scenario checkpoint step was not eligible when its action began: ${checkpointStepIdValue}.`,
          );
        }
        if (!session.activeActionTraceId) {
          throw scenarioFailure(
            DEV_E2E_SCENARIO_REASON.ACTIVE_ACTION_TRACE_MISSING,
            `Dev E2E scenario checkpoint has no active TraceV2 action: ${checkpointStepIdValue}.`,
          );
        }
        const clockReceipt = this.deps.readClockReceipt();
        if (!clockReceipt ||
          clockReceipt.seedId !== session.seedId ||
          clockReceipt.semanticFingerprint !== session.clockFingerprint) {
          throw scenarioFailure(
            DEV_E2E_SCENARIO_REASON.CLOCK_MISMATCH,
            'Checkpoint requires the active scenario clock receipt.',
          );
        }
        const fingerprints = this.deps.captureMemoryFingerprints();
        const persisted = await this.deps.waitForPersistence(fingerprints);
        const current = this.deps.captureMemoryFingerprints();
        if (!this.deps.fingerprintMapsMatch(fingerprints, current)) {
          throw scenarioFailure(
            DEV_E2E_SCENARIO_REASON.STALE_FINGERPRINT,
            `Accepted state changed while the checkpoint was being persisted: ${fingerprintMismatchReason(fingerprints, current)}`,
          );
        }
        const unfinishedAthleteActionTraces =
          this.deps.captureUnfinishedAthleteActionTraces();
        const checkpointTraceIds = unfinishedAthleteActionTraces.records
          .map((record) => record.traceId);
        if (!checkpointTraceIds.includes(session.activeActionTraceId)) {
          throw scenarioFailure(
            DEV_E2E_SCENARIO_REASON.TRACE_CORRELATION_MISMATCH,
            `Dev E2E scenario active trace is absent from checkpoint evidence: ${session.activeActionTraceId}.`,
          );
        }
        const nextStep = expectedDevE2ENextStep(
          manifest,
          checkpointStepIdValue,
        );
        const nextActionEligibility = nextStep
          ? {
              nextStepId: nextStep.stepId,
              status: 'blocked' as const,
              reasonCode: DEV_E2E_SCENARIO_REASON.RELOAD_REQUIRED,
              witnessIds: [
                `checkpoint:${checkpointStepIdValue}`,
                `trace:${session.activeActionTraceId}`,
                `persistence:${devE2EAcceptedSemanticFingerprint(persisted)}`,
              ],
            }
          : {
              nextStepId: null,
              status: 'complete' as const,
              reasonCode: DEV_E2E_SCENARIO_REASON.COMPLETE,
              witnessIds: [
                `checkpoint:${checkpointStepIdValue}`,
                `trace:${session.activeActionTraceId}`,
                `persistence:${devE2EAcceptedSemanticFingerprint(persisted)}`,
              ],
            };
        const updatedSession: DevE2EScenarioSessionRecord = {
          ...session,
          checkpointStepId: checkpointStepIdValue,
          currentAcceptedSemanticFingerprint:
            devE2EAcceptedSemanticFingerprint(current),
          persistedStoreFingerprints: persisted,
          nextActionEligibility,
          updatedAt: deterministicDevE2EScenarioUpdatedAt({
            clockReceipt,
            manifest,
            checkpointStepId: checkpointStepIdValue,
            reloadCount: session.reloadCount,
          }),
        };
        await this.deps.writeCheckpoint({
          version: 2,
          seedId: session.seedId,
          checkpointId: session.seedId,
          fingerprints: persisted,
          clockFingerprint: clockReceipt.semanticFingerprint,
          unfinishedAthleteActionTraces,
          scenarioId: session.scenarioId,
          checkpointStepId: checkpointStepIdValue,
          activeActionTraceId: session.activeActionTraceId,
          priorActionTraceId: session.priorActionTraceId,
        });
        await this.deps.writeScenarioSession(updatedSession);
        if (!this.deps.activateScenarioSession(updatedSession, manifest)) {
          throw scenarioFailure(
            DEV_E2E_SCENARIO_REASON.NEXT_ACTION_BLOCKED,
            'Dev E2E scenario runtime is unavailable.',
          );
        }
        setDevE2EScenarioCheckpointReady({
          scenarioId: updatedSession.scenarioId,
          seedId: updatedSession.seedId,
          checkpointStepId: checkpointStepIdValue,
          reloadCount: updatedSession.reloadCount,
          nextStepId: nextActionEligibility.nextStepId,
          eligibilityStatus: nextActionEligibility.status,
          eligibilityReasonCode: nextActionEligibility.reasonCode,
        });
        return true;
      } catch (error) {
        setDevE2EScenarioError(
          devE2EScenarioReasonCode(error) ?? DEV_E2E_SCENARIO_REASON.CORRUPT_SESSION,
          error,
          scenarioIdValue,
        );
        throw error;
      }
    });
  }

  async validateReloadCheckpoint(): Promise<boolean> {
    if (!this.isDev) return false;
    return this.enqueue(async () => {
      let scenarioId: string | null = null;
      try {
        // Start all durable reads before awaiting store hydration. ProgramStore
        // legitimately migrates its internal overlay envelope while hydrating;
        // these receipts prove the exact pre-migration bytes survived.
        const checkpointRead = this.deps.readCheckpoint();
        const scenarioSessionRead = this.deps.readScenarioSession();
        const persistedFingerprintRead = this.deps.readPersistedFingerprints();
        await this.deps.waitForHydration();
        const [checkpoint, scenarioSession, persisted] = await Promise.all([
          checkpointRead,
          scenarioSessionRead,
          persistedFingerprintRead,
        ]);
        scenarioId = scenarioSession?.scenarioId ?? checkpoint?.scenarioId ?? null;

        if (scenarioSession) {
          const resolved = this.deps.resolveScenarioManifest(
            scenarioSession.scenarioId,
          );
          if (!resolved) {
            throw scenarioFailure(
              DEV_E2E_SCENARIO_REASON.MANIFEST_NOT_FOUND,
              `Dev E2E scenario manifest not found: ${scenarioSession.scenarioId}.`,
            );
          }
          const manifest = validateDevE2EScenarioManifest(resolved);
          if (manifest.seedId !== scenarioSession.seedId) {
            throw scenarioFailure(
              DEV_E2E_SCENARIO_REASON.CORRUPT_SESSION,
              'Dev E2E scenario session seed does not match its manifest.',
            );
          }
          const clockReceipt = this.deps.readClockReceipt();
          if (!clockReceipt ||
            clockReceipt.seedId !== scenarioSession.seedId ||
            clockReceipt.semanticFingerprint !== scenarioSession.clockFingerprint) {
            throw scenarioFailure(
              DEV_E2E_SCENARIO_REASON.CLOCK_MISMATCH,
              'Dev E2E scenario session clock does not match the restored receipt.',
            );
          }
          if (!this.deps.fingerprintMapsMatch(
            scenarioSession.persistedStoreFingerprints,
            persisted,
          ) || scenarioSession.currentAcceptedSemanticFingerprint !==
            devE2EAcceptedSemanticFingerprint(
              scenarioSession.persistedStoreFingerprints,
            )) {
            throw scenarioFailure(
              DEV_E2E_SCENARIO_REASON.STALE_FINGERPRINT,
              `Reload persisted fingerprint mismatch for ${scenarioSession.scenarioId}: ${fingerprintMismatchReason(scenarioSession.persistedStoreFingerprints, persisted)}`,
            );
          }
          if (!checkpoint) {
            if (scenarioSession.checkpointStepId ||
              scenarioSession.activeActionTraceId ||
              scenarioSession.priorActionTraceId ||
              scenarioSession.reloadCount !== 0) {
              throw scenarioFailure(
                DEV_E2E_SCENARIO_REASON.SESSION_CHECKPOINT_MISMATCH,
                'Dev E2E scenario session requires a checkpoint receipt.',
              );
            }
            const current = this.deps.captureMemoryFingerprints();
            const convergedPersisted = await this.deps.waitForPersistence(current);
            const stableCurrent = this.deps.captureMemoryFingerprints();
            if (!this.deps.fingerprintMapsMatch(current, stableCurrent)) {
              throw scenarioFailure(
                DEV_E2E_SCENARIO_REASON.STALE_FINGERPRINT,
                `Accepted state changed while reload persistence converged: ${fingerprintMismatchReason(current, stableCurrent)}`,
              );
            }
            const nextStep = expectedDevE2ENextStep(manifest, null);
            if (!nextStep) {
              throw scenarioFailure(
                DEV_E2E_SCENARIO_REASON.MANIFEST_INVALID,
                `Dev E2E scenario has no first step: ${manifest.scenarioId}.`,
              );
            }
            const decision = this.deps.evaluateScenarioEligibility({
              phase: 'reload',
              manifest,
              session: scenarioSession,
              nextStep,
            });
            const restoredSession: DevE2EScenarioSessionRecord = {
              ...scenarioSession,
              currentAcceptedSemanticFingerprint:
                devE2EAcceptedSemanticFingerprint(stableCurrent),
              persistedStoreFingerprints: convergedPersisted,
              nextActionEligibility: {
                nextStepId: nextStep.stepId,
                status: decision.status,
                reasonCode: decision.reasonCode,
                witnessIds: [...decision.witnessIds],
              },
            };
            await this.deps.writeScenarioSession(restoredSession);
            if (!this.deps.activateScenarioSession(restoredSession, manifest)) {
              throw scenarioFailure(
                DEV_E2E_SCENARIO_REASON.NEXT_ACTION_BLOCKED,
                'Dev E2E scenario runtime is unavailable.',
              );
            }
            this.activeSeedId = restoredSession.seedId;
            setDevE2EScenarioReady({
              scenarioId: restoredSession.scenarioId,
              seedId: restoredSession.seedId,
              nextStepId: restoredSession.nextActionEligibility.nextStepId,
              eligibilityStatus: restoredSession.nextActionEligibility.status,
              eligibilityReasonCode:
                restoredSession.nextActionEligibility.reasonCode,
            });
            return true;
          }
          const checkpointedActionTraceId =
            scenarioSession.activeActionTraceId ??
            scenarioSession.priorActionTraceId;
          const checkpointTraceCorrelates = scenarioSession.activeActionTraceId
            ? checkpoint.activeActionTraceId ===
                scenarioSession.activeActionTraceId &&
              checkpoint.priorActionTraceId ===
                scenarioSession.priorActionTraceId
            : checkpoint.activeActionTraceId ===
                scenarioSession.priorActionTraceId;
          if (!checkpoint.scenarioId ||
            checkpoint.scenarioId !== scenarioSession.scenarioId ||
            checkpoint.checkpointStepId !== scenarioSession.checkpointStepId ||
            !checkpointTraceCorrelates ||
            !checkpointedActionTraceId) {
            throw scenarioFailure(
              DEV_E2E_SCENARIO_REASON.SESSION_CHECKPOINT_MISMATCH,
              'Dev E2E scenario session and checkpoint do not correlate.',
            );
          }
          try {
            assertDevE2EClockMatchesCheckpoint(clockReceipt, checkpoint);
          } catch (error) {
            throw scenarioFailure(
              DEV_E2E_SCENARIO_REASON.CLOCK_MISMATCH,
              error instanceof Error ? error.message : String(error),
            );
          }
          if (scenarioSession.activeActionTraceId && (
            !this.deps.fingerprintMapsMatch(
              checkpoint.fingerprints,
              persisted,
            ) || !this.deps.fingerprintMapsMatch(
              checkpoint.fingerprints,
              scenarioSession.persistedStoreFingerprints,
            )
          )) {
            throw scenarioFailure(
              DEV_E2E_SCENARIO_REASON.STALE_FINGERPRINT,
              `Reload persisted fingerprint mismatch for ${scenarioSession.scenarioId}: ${fingerprintMismatchReason(checkpoint.fingerprints, persisted)}`,
            );
          }
          const current = this.deps.captureMemoryFingerprints();
          const convergedPersisted = await this.deps.waitForPersistence(current);
          const stableCurrent = this.deps.captureMemoryFingerprints();
          if (!this.deps.fingerprintMapsMatch(current, stableCurrent)) {
            throw scenarioFailure(
              DEV_E2E_SCENARIO_REASON.STALE_FINGERPRINT,
              `Accepted state changed while reload persistence converged: ${fingerprintMismatchReason(current, stableCurrent)}`,
            );
          }
          const evidence = this.deps.captureReloadEvidence(
            stableCurrent,
            convergedPersisted,
          );
          const resumedTraceIds = this.deps.resumeAthleteActionTraces(
            checkpoint.unfinishedAthleteActionTraces,
            evidence,
          );
          const checkpointTraceIds =
            checkpoint.unfinishedAthleteActionTraces.records
              .map((record) => record.traceId);
          if (!checkpointTraceIds.includes(checkpointedActionTraceId) ||
            !resumedTraceIds.includes(checkpointedActionTraceId) ||
            !traceIdsMatch(checkpointTraceIds, resumedTraceIds)) {
            throw scenarioFailure(
              DEV_E2E_SCENARIO_REASON.TRACE_CORRELATION_MISMATCH,
              `Reload TraceV2 resume mismatch: active=${checkpointedActionTraceId} checkpoint=${checkpointTraceIds.sort().join(',')} resumed=${[...resumedTraceIds].sort().join(',')}`,
            );
          }
          const nextStep = expectedDevE2ENextStep(
            manifest,
            scenarioSession.checkpointStepId,
          );
          let nextActionEligibility = scenarioSession.nextActionEligibility;
          if (nextStep) {
            const decision = this.deps.evaluateScenarioEligibility({
              phase: 'reload',
              manifest,
              session: scenarioSession,
              nextStep,
            });
            nextActionEligibility = {
              nextStepId: nextStep.stepId,
              status: decision.status,
              reasonCode: decision.reasonCode,
              witnessIds: [...decision.witnessIds],
            };
          } else {
            nextActionEligibility = {
              nextStepId: null,
              status: 'complete',
              reasonCode: DEV_E2E_SCENARIO_REASON.COMPLETE,
              witnessIds: [
                `checkpoint:${scenarioSession.checkpointStepId}`,
                `trace:${checkpointedActionTraceId}`,
                `reload:${scenarioSession.reloadCount + 1}`,
              ],
            };
          }
          const reloadedSession: DevE2EScenarioSessionRecord = {
            ...scenarioSession,
            activeActionTraceId: null,
            priorActionTraceId: checkpointedActionTraceId,
            reloadCount: scenarioSession.reloadCount + 1,
            currentAcceptedSemanticFingerprint:
              devE2EAcceptedSemanticFingerprint(stableCurrent),
            persistedStoreFingerprints: convergedPersisted,
            nextActionEligibility,
            updatedAt: deterministicDevE2EScenarioUpdatedAt({
              clockReceipt,
              manifest,
              checkpointStepId: scenarioSession.checkpointStepId,
              reloadCount: scenarioSession.reloadCount + 1,
            }),
          };
          await this.deps.writeScenarioSession(reloadedSession);
          if (!this.deps.activateScenarioSession(reloadedSession, manifest)) {
            throw scenarioFailure(
              DEV_E2E_SCENARIO_REASON.NEXT_ACTION_BLOCKED,
              'Dev E2E scenario runtime is unavailable.',
            );
          }
          this.activeSeedId = reloadedSession.seedId;
          setDevE2EScenarioReloadReady({
            scenarioId: reloadedSession.scenarioId,
            seedId: reloadedSession.seedId,
            checkpointStepId: reloadedSession.checkpointStepId!,
            reloadCount: reloadedSession.reloadCount,
            nextStepId: reloadedSession.nextActionEligibility.nextStepId,
            eligibilityStatus: reloadedSession.nextActionEligibility.status,
            eligibilityReasonCode:
              reloadedSession.nextActionEligibility.reasonCode,
          });
          return true;
        }

        if (!checkpoint || !isDevE2ESeedId(checkpoint.seedId)) return false;
        assertDevE2EClockMatchesCheckpoint(this.deps.readClockReceipt(), checkpoint);
        if (!this.deps.fingerprintMapsMatch(checkpoint.fingerprints, persisted)) {
          throw new Error(
            `Reload persisted fingerprint mismatch for ${checkpoint.seedId}: ${fingerprintMismatchReason(checkpoint.fingerprints, persisted)}`,
          );
        }
        const current = this.deps.captureMemoryFingerprints();
        const convergedPersisted = await this.deps.waitForPersistence(current);
        const stableCurrent = this.deps.captureMemoryFingerprints();
        if (!this.deps.fingerprintMapsMatch(current, stableCurrent)) {
          throw new Error(
            `Accepted state changed while reload persistence converged: ${fingerprintMismatchReason(current, stableCurrent)}`,
          );
        }
        const evidence = this.deps.captureReloadEvidence(
          stableCurrent,
          convergedPersisted,
        );
        const resumedTraceIds = this.deps.resumeAthleteActionTraces(
          checkpoint.unfinishedAthleteActionTraces,
          evidence,
        );
        const checkpointTraceIds = checkpoint.unfinishedAthleteActionTraces.records
          .map((record) => record.traceId);
        if (!traceIdsMatch(checkpointTraceIds, resumedTraceIds)) {
          throw new Error(
            `Reload TraceV2 resume mismatch: checkpoint=${checkpointTraceIds.sort().join(',')} resumed=${[...resumedTraceIds].sort().join(',')}`,
          );
        }
        this.activeSeedId = checkpoint.seedId;
        setDevE2EReloadReady(checkpoint.seedId, checkpoint.checkpointId);
        return true;
      } catch (error) {
        const reasonCode = devE2EScenarioReasonCode(error);
        if (reasonCode || scenarioId) {
          setDevE2EScenarioError(
            reasonCode ?? DEV_E2E_SCENARIO_REASON.CORRUPT_SESSION,
            error,
            scenarioId,
          );
        } else {
          setDevE2ESeedError(error);
        }
        throw error;
      }
    });
  }
}
