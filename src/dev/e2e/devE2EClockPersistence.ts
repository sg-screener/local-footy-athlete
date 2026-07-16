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
} = {}): Promise<boolean> {
  if (!isDevE2EClockAvailable()) return false;
  // Never let a stale in-memory clock survive a corrupt or mismatched durable
  // receipt. Successful validation below is the only restoration path.
  clearDevE2EClock();
  const storage = args.storage ?? defaultDevE2EStorage();
  const [receipt, checkpoint] = await Promise.all([
    readDevE2EClockReceipt(storage),
    args.readCheckpoint
      ? args.readCheckpoint()
      : readDevE2ECheckpointRecord(storage),
  ]);
  if (!receipt && !checkpoint) {
    clearDevE2EClock();
    return false;
  }
  if (receipt && !checkpoint) {
    throw new Error('DevE2EClock reload mismatch: clock receipt has no active checkpoint.');
  }
  if (!receipt && checkpoint) {
    throw new Error('DevE2EClock reload mismatch: active checkpoint has no clock receipt.');
  }
  const matchingReceipt = assertDevE2EClockMatchesCheckpoint(receipt, checkpoint!);
  if (!setDevE2EClock(matchingReceipt)) {
    throw new Error('DevE2EClock is unavailable in this build.');
  }
  return true;
}

export function readActiveDevE2EClockReceipt(): DevE2EClockReceipt | null {
  return getDevE2EClockReceipt();
}
