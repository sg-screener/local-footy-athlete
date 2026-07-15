import AsyncStorage from '@react-native-async-storage/async-storage';

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

export const asyncStorageCompat = {
  getItem: asyncStorageDurable.getItem,
  async setItem(name: string, value: string): Promise<void> {
    if (activeStage?.keys.has(name)) return;
    await asyncStorageDurable.setItem(name, value);
  },
  async removeItem(name: string): Promise<void> {
    if (activeStage?.keys.has(name)) return;
    await asyncStorageDurable.removeItem(name);
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
