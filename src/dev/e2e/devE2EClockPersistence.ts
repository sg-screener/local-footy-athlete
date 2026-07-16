import {
  assertDevE2EClockMatchesCheckpoint,
  clearDevE2EClock,
  getDevE2EClockReceipt,
  isDevE2EClockAvailable,
  parseDevE2EClockReceipt,
  setDevE2EClock,
  setDevE2EClockForSeed,
  type DevE2EClockReceipt,
} from './DevE2EClock';
import {
  readDevE2ECheckpointRecord,
  type DevE2ECheckpointRecord,
  type DevE2EKeyValueStorage,
} from './devE2ECheckpoint';
import type { DevE2ESeedId } from './devE2ESeedIds';
import {
  readDevE2EScenarioSessionRecord,
  type DevE2EScenarioSessionRecord,
} from './devE2EScenarioSession';
import {
  DEV_E2E_SCENARIO_REASON,
  DevE2EScenarioProtocolError,
} from './devE2EScenarioProtocol';

export const DEV_E2E_CLOCK_STORAGE_KEY = 'dev-e2e-clock-receipt-v1';

function defaultDevE2EStorage(): DevE2EKeyValueStorage {
  // Loaded only inside the development entry/clock path.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module = require('@react-native-async-storage/async-storage');
  return module.default ?? module;
}

export async function writeDevE2EClockReceipt(
  receipt: DevE2EClockReceipt,
  storage: DevE2EKeyValueStorage = defaultDevE2EStorage(),
): Promise<void> {
  await storage.setItem(DEV_E2E_CLOCK_STORAGE_KEY, JSON.stringify(receipt));
}

export async function readDevE2EClockReceipt(
  storage: DevE2EKeyValueStorage = defaultDevE2EStorage(),
): Promise<DevE2EClockReceipt | null> {
  const raw = await storage.getItem(DEV_E2E_CLOCK_STORAGE_KEY);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('DevE2EClock receipt corrupt: invalid JSON.');
  }
  return parseDevE2EClockReceipt(parsed);
}

export async function clearPersistedDevE2EClock(
  storage: DevE2EKeyValueStorage = defaultDevE2EStorage(),
): Promise<void> {
  clearDevE2EClock();
  await storage.removeItem(DEV_E2E_CLOCK_STORAGE_KEY);
}

export async function replacePersistedDevE2EClockForSeed(
  seedId: DevE2ESeedId,
  storage: DevE2EKeyValueStorage = defaultDevE2EStorage(),
): Promise<DevE2EClockReceipt> {
  const receipt = setDevE2EClockForSeed(seedId);
  if (!receipt) {
    throw new Error('DevE2EClock is unavailable in this build.');
  }
  try {
    await writeDevE2EClockReceipt(receipt, storage);
    return receipt;
  } catch (error) {
    clearDevE2EClock();
    throw error;
  }
}

/**
 * Cold-launch barrier. This module imports storage and clock protocol only;
 * persisted Zustand stores are deliberately imported after this resolves.
 */
export async function restoreDevE2EClockBeforeHydration(args: {
  storage?: DevE2EKeyValueStorage;
  readCheckpoint?: () => Promise<DevE2ECheckpointRecord | null>;
  readScenarioSession?: () => Promise<DevE2EScenarioSessionRecord | null>;
} = {}): Promise<boolean> {
  if (!isDevE2EClockAvailable()) return false;
  // Never let a stale in-memory clock survive a corrupt or mismatched durable
  // receipt. Successful validation below is the only restoration path.
  clearDevE2EClock();
  const storage = args.storage ?? defaultDevE2EStorage();
  const [receipt, checkpoint, scenarioSession] = await Promise.all([
    readDevE2EClockReceipt(storage),
    args.readCheckpoint
      ? args.readCheckpoint()
      : readDevE2ECheckpointRecord(storage),
    args.readScenarioSession
      ? args.readScenarioSession()
      : readDevE2EScenarioSessionRecord(storage),
  ]);
  if (!receipt && !checkpoint && !scenarioSession) {
    clearDevE2EClock();
    return false;
  }
  if (receipt && !checkpoint && !scenarioSession) {
    throw new Error('DevE2EClock reload mismatch: clock receipt has no active checkpoint.');
  }
  if (!receipt && scenarioSession) {
    throw new DevE2EScenarioProtocolError(
      DEV_E2E_SCENARIO_REASON.CLOCK_MISMATCH,
      'Dev E2E scenario session has no clock receipt.',
    );
  }
  if (!receipt && checkpoint) {
    throw new Error('DevE2EClock reload mismatch: active checkpoint has no clock receipt.');
  }
  if (scenarioSession) {
    if (receipt!.seedId !== scenarioSession.seedId ||
      receipt!.semanticFingerprint !== scenarioSession.clockFingerprint) {
      throw new DevE2EScenarioProtocolError(
        DEV_E2E_SCENARIO_REASON.CLOCK_MISMATCH,
        `Dev E2E scenario clock mismatch: session=${scenarioSession.clockFingerprint} receipt=${receipt!.semanticFingerprint}.`,
      );
    }
    const checkpointTraceCorrelates = checkpoint && (
      scenarioSession.activeActionTraceId
        ? checkpoint.activeActionTraceId ===
            scenarioSession.activeActionTraceId &&
          checkpoint.priorActionTraceId === scenarioSession.priorActionTraceId
        : checkpoint.activeActionTraceId ===
            scenarioSession.priorActionTraceId
    );
    if (checkpoint && (!checkpoint.scenarioId ||
      checkpoint.scenarioId !== scenarioSession.scenarioId ||
      checkpoint.checkpointStepId !== scenarioSession.checkpointStepId ||
      !checkpointTraceCorrelates)) {
      throw new DevE2EScenarioProtocolError(
        DEV_E2E_SCENARIO_REASON.SESSION_CHECKPOINT_MISMATCH,
        'Dev E2E scenario session and checkpoint do not correlate.',
      );
    }
  }
  if (checkpoint?.scenarioId && !scenarioSession) {
    throw new DevE2EScenarioProtocolError(
      DEV_E2E_SCENARIO_REASON.SESSION_CHECKPOINT_MISMATCH,
      'Dev E2E scenario checkpoint has no session.',
    );
  }
  let matchingReceipt: DevE2EClockReceipt;
  if (checkpoint && scenarioSession) {
    try {
      matchingReceipt = assertDevE2EClockMatchesCheckpoint(receipt, checkpoint);
    } catch (error) {
      throw new DevE2EScenarioProtocolError(
        DEV_E2E_SCENARIO_REASON.CLOCK_MISMATCH,
        error instanceof Error ? error.message : String(error),
      );
    }
  } else {
    matchingReceipt = checkpoint
      ? assertDevE2EClockMatchesCheckpoint(receipt, checkpoint)
      : receipt!;
  }
  if (!setDevE2EClock(matchingReceipt)) {
    throw new Error('DevE2EClock is unavailable in this build.');
  }
  return true;
}

export function readActiveDevE2EClockReceipt(): DevE2EClockReceipt | null {
  return getDevE2EClockReceipt();
}
