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
  setDevE2ECheckpointReady,
  setDevE2EReloadReady,
  setDevE2ESeedError,
  setDevE2ESeedLoading,
  setDevE2ESeedReady,
} from './devE2EState';

export interface DevE2ECoordinatorDeps {
  waitForHydration: () => Promise<void>;
  resetLocalState: () => void;
  waitForPersistence: () => Promise<DevE2EFingerprintMap>;
  buildSeed: (seedId: DevE2ESeedId) => DevE2ESeed;
  writeProfile: (seed: DevE2ESeed) => void;
  installProgram: (seed: DevE2ESeed) => void;
  applyAuxiliaryState: (items: readonly DevE2EAuxiliaryState[]) => void;
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
        this.deps.resetLocalState();
        await this.deps.clearCheckpoint();
        await this.deps.waitForPersistence();
        const seed = this.deps.buildSeed(seedId);
        this.deps.writeProfile(seed);
        this.deps.installProgram(seed);
        this.deps.applyAuxiliaryState(seed.auxiliaryState);
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
        setDevE2ESeedError(error, seedId);
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
        const fingerprints = this.deps.captureMemoryFingerprints();
        await this.deps.waitForPersistence();
        const current = this.deps.captureMemoryFingerprints();
        if (!this.deps.fingerprintMapsMatch(fingerprints, current)) {
          throw new Error(
            `Accepted state changed while the checkpoint was being persisted: ${fingerprintMismatchReason(fingerprints, current)}`,
          );
        }
        await this.deps.writeCheckpoint({
          version: 1,
          seedId: this.activeSeedId,
          checkpointId,
          fingerprints,
        });
        setDevE2ECheckpointReady(checkpointId);
        return true;
      } catch (error) {
        setDevE2ESeedError(error, checkpointId);
        throw error;
      }
    });
  }

  async validateReloadCheckpoint(): Promise<boolean> {
    if (!this.isDev) return false;
    return this.enqueue(async () => {
      try {
        // Start both durable reads before awaiting store hydration. ProgramStore
        // legitimately migrates its internal overlay envelope while hydrating;
        // the checkpoint receipt proves the exact pre-migration bytes survived.
        const checkpointRead = this.deps.readCheckpoint();
        const persistedFingerprintRead = this.deps.readPersistedFingerprints();
        await this.deps.waitForHydration();
        const [checkpoint, persisted] = await Promise.all([
          checkpointRead,
          persistedFingerprintRead,
        ]);
        if (!checkpoint || !isDevE2ESeedId(checkpoint.seedId)) return false;
        if (!this.deps.fingerprintMapsMatch(checkpoint.fingerprints, persisted)) {
          throw new Error(
            `Reload persisted fingerprint mismatch for ${checkpoint.seedId}: ${fingerprintMismatchReason(checkpoint.fingerprints, persisted)}`,
          );
        }
        await this.deps.waitForPersistence();
        setDevE2EReloadReady(checkpoint.seedId, checkpoint.checkpointId);
        return true;
      } catch (error) {
        setDevE2ESeedError(error);
        throw error;
      }
    });
  }
}
