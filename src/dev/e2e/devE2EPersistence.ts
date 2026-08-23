import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfileStore } from '../../store/profileStore';
import { useProgramStore, projectProgramPersistedInputs } from '../../store/programStore';
import {
  calendarPersistedInputs,
  useCalendarStore,
} from '../../store/calendarStore';
import { useReadinessStore } from '../../store/readinessStore';
import { useCoachPreferencesStore } from '../../store/coachPreferencesStore';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import { useAthletePreferencesStore } from '../../store/athletePreferencesStore';
import { semanticFingerprint } from './semanticFingerprint';
import {
  clearDevE2ECheckpointRecord,
  readDevE2ECheckpointRecord,
  writeDevE2ECheckpointRecord,
  type DevE2ECheckpointRecord,
  type DevE2EFingerprintMap,
} from './devE2ECheckpoint';
import {
  clearDevE2EScenarioSessionRecord,
  readDevE2EScenarioSessionRecord,
  writeDevE2EScenarioSessionRecord,
  type DevE2EScenarioSessionRecord,
} from './devE2EScenarioSession';

export {
  DEV_E2E_CHECKPOINT_STORAGE_KEY,
  type DevE2ECheckpointRecord,
  type DevE2EFingerprintMap,
} from './devE2ECheckpoint';
export {
  DEV_E2E_SCENARIO_SESSION_STORAGE_KEY,
  type DevE2EScenarioSessionRecord,
} from './devE2EScenarioSession';

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
    /**
     * THE INPUTS, AND ONLY THE INPUTS — corrected 2026-08-10, and the correction
     * is the first defect the run-through instrument ever found.
     *
     * ## What it used to do, and why it could never pass
     *
     * It compared an in-memory fingerprint of `currentProgram`,
     * `currentMicrocycle`, `todayWorkout`, `dateOverrides`, `weekScopedOverlays`,
     * `acceptedMaterialContext` and the rest against **what is on disk** — and
     * **R1.3 stopped storing every one of them.** The program store's
     * `partialize` has been INPUTS ONLY since the shell rebuild; the program,
     * the overlays, the overrides and the accepted context are DERIVED at boot
     * and never persisted (`docs/SHELL_REBUILD_PLAN_2026-08-05.md`).
     *
     * So memory held objects, disk held nothing for those keys, and the
     * convergence loop ran to its ten-second deadline and threw **"Persisted
     * semantic state did not converge: program-store"** — on every seed, forever.
     * **It was not an app defect. It was the harness holding a belief the
     * architecture had retired**, and nothing re-checked it.
     *
     * `LAW-instrumentation-alive` again: an instrument written against a shape
     * that changed underneath it. It is the reason the rig could not complete a
     * pass even once the dialog was gone.
     *
     * ## Why THIS shape, and why it is the north star's own test
     *
     * `docs/NORTH_STAR.md`: **store only decisions, derive everything else.** A
     * check that asserts stored state MIRRORS memory is asserting the opposite —
     * it would fail the architecture on purpose. Fingerprinting the INPUTS asks
     * the only question persistence still owes an answer to: *did the athlete's
     * decisions, facts and results reach the disk?* Everything else is supposed
     * to be absent, and its absence is correctness rather than loss.
     *
     * ⚠ **THIS SENTENCE USED TO SAY "mirrors `partialize` field for field. If
     * that list ever grows a key, this one grows with it" — AND NOTHING MADE IT
     * GROW.** `acceptedBlocks` was added to both of the store's own projections
     * on 2026-08-17 and not to this hand-written copy, so from that day every
     * seeded world reported `acceptedBlocks` on disk and absent in memory, the
     * convergence loop ran to its deadline, and **the whole simulator rig died
     * at the seed step** (measured on glass 2026-08-18 at `main @ c2aaf313`).
     *
     * It no longer mirrors anything: it CALLS the store's own projection, so the
     * list cannot drift again. A `partialize` that grew an OUTPUT is still the
     * north-star violation this check exists to catch — and it is caught the
     * same way, because both sides now ask the identical question of the two
     * different sources.
     */
    select: (state) => projectProgramPersistedInputs(state as Record<string, any>),
  },
  {
    key: 'calendar-storage',
    store: useCalendarStore as unknown as PersistedStore,
    // The live store also carries the derived fixture projection. Compare only
    // what this envelope owns, or a correctly rebuilt recurring game appears
    // as a persistence failure merely because it is absent from the duplicate.
    select: (state) => ({ markedDays: calendarPersistedInputs(state.markedDays) }),
  },
  {
    key: 'readiness-store',
    store: useReadinessStore as unknown as PersistedStore,
    select: (state) => ({ signalsByDate: state.signalsByDate ?? {} }),
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
    }),
  },
  {
    key: 'athlete-preferences-store',
    store: useAthletePreferencesStore as unknown as PersistedStore,
    select: (state) => ({ prefs: state.prefs ?? { excluded: [], pinned: [] } }),
  },
  // ui-store RETIRED with its store (Sam's §6 ruling, 2026-08-03).
];

const LEGACY_DEV_E2E_CHECKPOINT_STORAGE_KEY = 'dev-e2e-checkpoint-v1';
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

/**
 * One selection, printable. Long enough to see WHICH key differs, short enough
 * that a program-store envelope does not bury the line it is explaining.
 */
function previewSelection(value: unknown): string {
  let text: string;
  try {
    text = JSON.stringify(value) ?? String(value);
  } catch {
    return '<unserialisable>';
  }
  return text.length > 600 ? `${text.slice(0, 600)}… (${text.length} chars)` : text;
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
      // THE MESSAGE CARRIES THE DISAGREEMENT, NOT JUST ITS ADDRESS
      // (2026-08-10). This error has now been hit twice in two days —
      // `program-store` on the rig's first working run, `calendar-storage` on
      // its second — and BOTH TIMES it named a store and stopped, so both
      // times someone had to reconstruct by hand what two hashes disagreed
      // about. A fingerprint is a claim; the claim's evidence is the two
      // values, and this is dev-only code that can afford to print them.
      throw new Error(
        `Persisted semantic state did not converge: ${mismatches.join(', ')}\n`
        + (await Promise.all(mismatches.map(async (key) => {
          const descriptor = semanticStores.find((entry) => entry.key === key)!;
          return `  ${key}\n`
            + `    memory: ${previewSelection(descriptor.select(descriptor.store.getState()))}\n`
            + `    disk:   ${previewSelection(descriptor.select(await readPersistedState(key)))}`;
        }))).join('\n'),
      );
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    persisted = await readDevE2EPersistedFingerprints();
  }
  return persisted;
}

export async function writeDevE2ECheckpoint(record: DevE2ECheckpointRecord): Promise<void> {
  await writeDevE2ECheckpointRecord(record);
}

export async function readDevE2ECheckpoint(): Promise<DevE2ECheckpointRecord | null> {
  return readDevE2ECheckpointRecord();
}

export async function clearDevE2ECheckpoint(): Promise<void> {
  await Promise.all([
    clearDevE2ECheckpointRecord(),
    AsyncStorage.removeItem(LEGACY_DEV_E2E_CHECKPOINT_STORAGE_KEY),
  ]);
}

export async function writeDevE2EScenarioSession(
  record: DevE2EScenarioSessionRecord,
): Promise<void> {
  await writeDevE2EScenarioSessionRecord(record);
}

export async function readDevE2EScenarioSession(): Promise<
  DevE2EScenarioSessionRecord | null
> {
  return readDevE2EScenarioSessionRecord();
}

export async function clearDevE2EScenarioSession(): Promise<void> {
  await clearDevE2EScenarioSessionRecord();
}
