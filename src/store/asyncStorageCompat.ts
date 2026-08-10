import AsyncStorage from '@react-native-async-storage/async-storage';
import { ledgerReplayActive, recordDroppedDurableWrite } from './ledgerReplayLatch';

const nodeFallback = new Map<string, string>();
let nextStageId = 1;
let activeStage: { id: number; keys: Set<string> } | null = null;

export interface AsyncStorageWriteStageToken {
  readonly id: number;
}

function unavailableWebStorage(error: unknown): boolean {
  return error instanceof ReferenceError && /window is not defined/i.test(error.message);
}

/**
 * Plain sucrase-node tests load AsyncStorage's web build without a browser.
 * Keep that environment deterministic while preserving every real storage
 * rejection (only the specific missing-window error uses this fallback).
 */
export const asyncStorageDurable = {
  async getItem(name: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(name);
    } catch (error) {
      if (unavailableWebStorage(error)) return nodeFallback.get(name) ?? null;
      throw error;
    }
  },
  async setItem(name: string, value: string): Promise<void> {
    // R1.3 (shell rebuild): THE BOOT DOES NOT WRITE. While the replay latch
    // is held, disk is already the truth of inputs and outputs are never
    // persisted — every durable write drops at this one deepest boundary.
    if (ledgerReplayActive()) {
      // Deliberate, and no longer silent — see `recordDroppedDurableWrite`.
      recordDroppedDurableWrite(name);
      return;
    }
    try {
      await AsyncStorage.setItem(name, value);
    } catch (error) {
      if (unavailableWebStorage(error)) {
        nodeFallback.set(name, value);
        return;
      }
      throw error;
    }
  },
  async removeItem(name: string): Promise<void> {
    if (ledgerReplayActive()) {
      recordDroppedDurableWrite(name);
      return;
    }
    try {
      await AsyncStorage.removeItem(name);
    } catch (error) {
      if (unavailableWebStorage(error)) {
        nodeFallback.delete(name);
        return;
      }
      throw error;
    }
  },
};

/**
 * In-flight durable writes.
 *
 * Zustand's persist middleware fires `void setItem()` and never awaits it
 * (node_modules/zustand/middleware.js:509-512), so nothing in the app could
 * tell an answer held in memory from an answer that had actually reached disk.
 * A relaunch landing in that window is the confirmed onboarding data-loss
 * mechanism (docs/ONBOARDING_PERSISTENCE_DIAGNOSIS_2026-07-24.md §4).
 *
 * Registering each write here makes the fire-and-forget queue *observable*
 * without duplicating zustand's serialisation: callers that need durability
 * before proceeding await `flushPendingStorageWrites()`. Rejections are held
 * so the flush can surface them rather than leaving an unhandled rejection.
 */
const pendingWrites = new Set<Promise<void>>();

export function trackDurableWrite(write: Promise<void>): Promise<void> {
  // Swallow here only so an un-flushed caller cannot crash the app; the
  // rejection is re-raised to whoever awaits the flush.
  const tracked = write.finally(() => {
    pendingWrites.delete(tracked);
  });
  pendingWrites.add(tracked);
  void tracked.catch(() => undefined);
  return write;
}

export function pendingStorageWriteCount(): number {
  return pendingWrites.size;
}

/**
 * Resolve once every durable write started so far has settled — including
 * writes started *while* flushing, since a store subscription can trigger
 * another persist during the drain. Rejects with the first write failure.
 */
export async function flushPendingStorageWrites(): Promise<void> {
  let firstFailure: unknown = null;
  while (pendingWrites.size > 0) {
    const batch = [...pendingWrites];
    const results = await Promise.allSettled(batch);
    for (const result of results) {
      if (result.status === 'rejected' && firstFailure === null) {
        firstFailure = result.reason;
      }
    }
  }
  if (firstFailure !== null) throw firstFailure;
}

export const asyncStorageCompat = {
  getItem: asyncStorageDurable.getItem,
  setItem(name: string, value: string): Promise<void> {
    if (activeStage?.keys.has(name)) return Promise.resolve();
    return trackDurableWrite(asyncStorageDurable.setItem(name, value));
  },
  removeItem(name: string): Promise<void> {
    if (activeStage?.keys.has(name)) return Promise.resolve();
    return trackDurableWrite(asyncStorageDurable.removeItem(name));
  },
};

export function beginAsyncStorageWriteStage(
  keys: readonly string[],
): AsyncStorageWriteStageToken {
  if (activeStage) throw new Error('async_storage_write_stage_already_active');
  const token = { id: nextStageId++ };
  activeStage = { id: token.id, keys: new Set(keys) };
  return token;
}

export function endAsyncStorageWriteStage(token: AsyncStorageWriteStageToken): void {
  if (!activeStage || activeStage.id !== token.id) {
    throw new Error('async_storage_write_stage_not_active');
  }
  activeStage = null;
}
