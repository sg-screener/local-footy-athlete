import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfileStore } from '../../store/profileStore';
import { useProgramStore } from '../../store/programStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useReadinessStore } from '../../store/readinessStore';
import { useCoachStore } from '../../store/coachStore';
import { useCoachMemoryStore } from '../../store/coachMemoryStore';
import { useCoachMutationHistoryStore } from '../../store/coachMutationHistoryStore';
import { useCoachPreferencesStore } from '../../store/coachPreferencesStore';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import { useAthletePreferencesStore } from '../../store/athletePreferencesStore';
import { useUIStore } from '../../store/uiStore';
import { isDevE2ESeedId, type DevE2ESeedId } from './devE2ESeedIds';
import { semanticFingerprint } from './semanticFingerprint';

type PersistedStore = {
  getState: () => any;
  persist: {
    hasHydrated: () => boolean;
    rehydrate: () => Promise<unknown> | unknown;
  };
};

interface SemanticStoreDescriptor {
  key: string;
  store: PersistedStore;
  select: (state: any) => unknown;
}

const semanticStores: SemanticStoreDescriptor[] = [
  {
    key: 'profile-store',
    store: useProfileStore as unknown as PersistedStore,
    select: (state) => ({
      onboardingData: state.onboardingData,
      isOnboardingComplete: state.isOnboardingComplete,
      isLoading: state.isLoading,
      error: state.error,
    }),
  },
  {
    key: 'program-store',
    store: useProgramStore as unknown as PersistedStore,
    select: (state) => ({
      currentProgram: state.currentProgram,
      currentMicrocycle: state.currentMicrocycle,
      todayWorkout: state.todayWorkout,
      isGenerating: state.isGenerating,
      isLoading: state.isLoading,
      error: state.error,
      blockState: state.blockState,
      acceptedMaterialContext: state.acceptedMaterialContext,
      dateOverrides: state.dateOverrides,
      overrideContexts: state.overrideContexts,
      weekScopedOverlays: state.weekScopedOverlays,
      userRemovalConstraints: state.userRemovalConstraints,
      exposureContractsByWeek: state.exposureContractsByWeek,
      sessionFeedback: state.sessionFeedback,
      weightOverrides: state.weightOverrides,
    }),
  },
  {
    key: 'calendar-storage',
    store: useCalendarStore as unknown as PersistedStore,
    select: (state) => ({ markedDays: state.markedDays ?? {} }),
  },
  {
    key: 'readiness-store',
    store: useReadinessStore as unknown as PersistedStore,
    select: (state) => ({ signalsByDate: state.signalsByDate ?? {} }),
  },
  {
    key: 'coach-store',
    store: useCoachStore as unknown as PersistedStore,
    select: (state) => ({
      conversations: state.conversations ?? [],
      activeConversation: state.activeConversation ?? null,
      messages: state.messages ?? [],
      isStreaming: state.isStreaming,
      isLoading: state.isLoading,
      error: state.error,
    }),
  },
  {
    key: 'coach-memory-store',
    store: useCoachMemoryStore as unknown as PersistedStore,
    select: (state) => ({ notes: state.notes ?? [] }),
  },
  {
    key: 'coach-mutation-history-store',
    store: useCoachMutationHistoryStore as unknown as PersistedStore,
    select: (state) => ({ entries: state.entries ?? [] }),
  },
  {
    key: 'coach-preferences-store',
    store: useCoachPreferencesStore as unknown as PersistedStore,
    select: (state) => ({ modalityPreferences: state.modalityPreferences ?? {} }),
  },
  {
    key: 'coach-updates',
    store: useCoachUpdatesStore as unknown as PersistedStore,
    select: (state) => ({
      updatesByWeek: state.updatesByWeek ?? {},
      activeConstraints: state.activeConstraints ?? [],
      activeInjury: state.activeInjury ?? null,
    }),
  },
  {
    key: 'athlete-preferences-store',
    store: useAthletePreferencesStore as unknown as PersistedStore,
    select: (state) => ({ prefs: state.prefs ?? { excluded: [], pinned: [] } }),
  },
  {
    key: 'ui-store',
    store: useUIStore as unknown as PersistedStore,
    select: (state) => ({
      isOnline: state.isOnline,
      activeTab: state.activeTab,
      theme: state.theme,
      designVersion: state.designVersion,
    }),
  },
];

export type DevE2EFingerprintMap = Record<string, string>;

export const DEV_E2E_CHECKPOINT_STORAGE_KEY = 'dev-e2e-checkpoint-v1';

export interface DevE2ECheckpointRecord {
  version: 1;
  seedId: DevE2ESeedId;
  checkpointId: DevE2ESeedId;
  fingerprints: DevE2EFingerprintMap;
}

async function waitForStoreHydration(descriptor: SemanticStoreDescriptor): Promise<void> {
  if (descriptor.store.persist.hasHydrated()) return;
  await descriptor.store.persist.rehydrate();
  if (!descriptor.store.persist.hasHydrated()) {
    throw new Error(`Dev E2E store did not hydrate: ${descriptor.key}`);
  }
}

export async function waitForDevE2EHydration(): Promise<void> {
  await Promise.all(semanticStores.map(waitForStoreHydration));
}

export function captureDevE2EMemoryFingerprints(): DevE2EFingerprintMap {
  return Object.fromEntries(semanticStores.map((descriptor) => [
    descriptor.key,
    semanticFingerprint(descriptor.select(descriptor.store.getState())),
  ]));
}

async function readPersistedState(key: string): Promise<any> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return {};
  const envelope = JSON.parse(raw);
  return envelope?.state ?? {};
}

export async function readDevE2EPersistedFingerprints(): Promise<DevE2EFingerprintMap> {
  const entries = await Promise.all(semanticStores.map(async (descriptor) => {
    const state = await readPersistedState(descriptor.key);
    return [descriptor.key, semanticFingerprint(descriptor.select(state))] as const;
  }));
  return Object.fromEntries(entries);
}

export function fingerprintMapsMatch(
  left: DevE2EFingerprintMap,
  right: DevE2EFingerprintMap,
): boolean {
  const keys = Object.keys(left).sort();
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => left[key] === right[key]);
}

/**
 * Zustand persistence is asynchronous and exposes no flush promise. Readiness
 * therefore polls semantic equality, never elapsed time. The timeout only
 * turns a broken write into an error; it can never make the marker ready.
 */
export async function waitForDevE2EPersistence(
  expected: DevE2EFingerprintMap = captureDevE2EMemoryFingerprints(),
  timeoutMs: number = 10_000,
): Promise<DevE2EFingerprintMap> {
  const deadline = Date.now() + timeoutMs;
  let persisted = await readDevE2EPersistedFingerprints();
  while (!fingerprintMapsMatch(expected, persisted)) {
    if (Date.now() >= deadline) {
      const mismatches = Object.keys(expected)
        .filter((key) => expected[key] !== persisted[key]);
      throw new Error(`Persisted semantic state did not converge: ${mismatches.join(', ')}`);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    persisted = await readDevE2EPersistedFingerprints();
  }
  return persisted;
}

export async function writeDevE2ECheckpoint(record: DevE2ECheckpointRecord): Promise<void> {
  await AsyncStorage.setItem(DEV_E2E_CHECKPOINT_STORAGE_KEY, JSON.stringify(record));
}

export async function readDevE2ECheckpoint(): Promise<DevE2ECheckpointRecord | null> {
  const raw = await AsyncStorage.getItem(DEV_E2E_CHECKPOINT_STORAGE_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as Partial<DevE2ECheckpointRecord>;
  if (parsed.version !== 1 ||
    !parsed.seedId || !isDevE2ESeedId(parsed.seedId) ||
    !parsed.checkpointId || !isDevE2ESeedId(parsed.checkpointId) ||
    !parsed.fingerprints || typeof parsed.fingerprints !== 'object') {
    return null;
  }
  return parsed as DevE2ECheckpointRecord;
}

export async function clearDevE2ECheckpoint(): Promise<void> {
  await AsyncStorage.removeItem(DEV_E2E_CHECKPOINT_STORAGE_KEY);
}
