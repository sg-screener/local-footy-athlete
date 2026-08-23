import { useProfileStore } from './profileStore';
import { useProgramStore, PROGRAM_STORE_PERSISTENCE_KEY } from './programStore';
import { useCalendarStore } from './calendarStore';
import { useReadinessStore } from './readinessStore';
import { useCoachStore } from './coachStore';
import { useCoachMemoryStore } from './coachMemoryStore';
import { useCoachMutationHistoryStore } from './coachMutationHistoryStore';
import { useCoachPreferencesStore } from './coachPreferencesStore';
import { useCoachUpdatesStore } from './coachUpdatesStore';
import { useAthletePreferencesStore } from './athletePreferencesStore';
import { useDecisionLedgerStore, DECISION_LEDGER_PERSISTENCE_KEY } from './decisionLedgerStore';
import { useJournalNoteStore, JOURNAL_NOTE_PERSISTENCE_KEY } from './journalNoteStore';
import { useSessionStopwatchStore } from './sessionStopwatchStore';
import { asyncStorageCompat } from './asyncStorageCompat';
import { logger } from '../utils/logger';

/**
 * The app-boot hydration gate.
 *
 * `useInitializeApp` previously released the UI after a flat 300ms timer that
 * checked nothing (docs/ONBOARDING_PERSISTENCE_DIAGNOSIS_2026-07-24.md §3.3),
 * so the app could — and always did — mount onboarding before AsyncStorage had
 * been read. This owner replaces elapsed time with the only fact that matters:
 * has every persisted store finished hydrating.
 *
 * A store whose hydration *rejects* never flips zustand's `hasHydrated`
 * (middleware.js's `.catch` leaves the flag false and never fires the finish
 * listeners), so the gate reports `failed` rather than stalling forever. Boot
 * then shows an honest, retryable error instead of quietly entering onboarding
 * on top of storage that is not working.
 */

export type AppHydrationStatus = 'hydrating' | 'ready' | 'failed';

export interface AppHydrationState {
  readonly status: AppHydrationStatus;
  readonly failedStores: readonly string[];
}

interface PersistedStoreHandle {
  readonly key: string;
  readonly hasHydrated: () => boolean;
  readonly rehydrate: () => Promise<unknown>;
  readonly onFinishHydration: (listener: () => void) => () => void;
}

interface PersistApi {
  persist: {
    hasHydrated: () => boolean;
    rehydrate: () => Promise<unknown> | unknown;
    onFinishHydration: (listener: (state: unknown) => void) => () => void;
  };
}

function handle(key: string, store: unknown): PersistedStoreHandle {
  const persist = (store as PersistApi).persist;
  return {
    key,
    hasHydrated: () => persist.hasHydrated(),
    rehydrate: async () => persist.rehydrate(),
    onFinishHydration: (listener) => persist.onFinishHydration(() => listener()),
  };
}

/**
 * Every persisted store, keyed by its persist name. `onboardingReliabilityTests`
 * D1 asserts this covers every `persist(...)` store in src/store, so a new
 * persisted store cannot silently escape the boot gate.
 */
export const PERSISTED_STORE_HYDRATION_REGISTRY: readonly PersistedStoreHandle[] = [
  handle('profile-store', useProfileStore),
  handle(PROGRAM_STORE_PERSISTENCE_KEY, useProgramStore),
  handle('calendar-storage', useCalendarStore),
  handle('readiness-store', useReadinessStore),
  handle('coach-store', useCoachStore),
  handle('coach-memory-store', useCoachMemoryStore),
  handle('coach-mutation-history-store', useCoachMutationHistoryStore),
  handle('coach-preferences-store', useCoachPreferencesStore),
  handle('coach-updates', useCoachUpdatesStore),
  handle('athlete-preferences-store', useAthletePreferencesStore),
  // The rebuild's decision ledger (R1.1): an input store, hydrated before
  // first render like every other input.
  handle(DECISION_LEDGER_PERSISTENCE_KEY, useDecisionLedgerStore),
  // The Journal's notes (journal slice 2): an input store, hydrated before
  // first render like every other input.
  handle(JOURNAL_NOTE_PERSISTENCE_KEY, useJournalNoteStore),
  // R-132: the session stopwatch's timing acts — hydrated before first render
  // so a relaunch mid-session resumes the same count from disk.
  handle('session-stopwatch-store', useSessionStopwatchStore),
];

/**
 * Persist keys of RETIRED stores (Sam's §6 ruling, 2026-08-03 — the shell
 * retirement). `auth-store` and `ui-store` persisted only never-written
 * defaults: no product writer ever existed on a reachable screen (the MVP
 * sign-in screens and the design-version toggle were dead code from birth to
 * the Phase 1.6 purge), so any device envelope under these keys holds only
 * the built-in defaults. The L15 read-ingress lift for a shape that never
 * carried a value is DELETION: removing the envelope at boot means the
 * retired shape can never be read back by anything.
 *
 * A future sign-in flow or UI store rebuilds armoured under
 * docs/STORE_ARMOUR_RECIPE_2026-08-03.md — and takes its key OFF this list
 * in the same commit it registers here, or boot would eat its state.
 */
export const RETIRED_STORE_PERSIST_KEYS: readonly string[] = [
  'auth-store',
  'ui-store',
];

/**
 * Remove the retired stores' stale persist envelopes. Best-effort per key —
 * a storage layer that cannot delete must not block boot; the next boot
 * retries by construction.
 */
export async function removeRetiredStoreEnvelopes(): Promise<void> {
  await Promise.all(RETIRED_STORE_PERSIST_KEYS.map((key) =>
    asyncStorageCompat.removeItem(key).catch(() => undefined)));
}

/**
 * A store that neither finishes nor rejects (a storage layer that never
 * answers) must not hang boot forever. Exceeding this is reported as a
 * failure — visibly — never as readiness.
 */
const HYDRATION_TIMEOUT_MS = 10_000;

let state: AppHydrationState = { status: 'hydrating', failedStores: [] };
const listeners = new Set<(next: AppHydrationState) => void>();
let settlement: Promise<AppHydrationState> | null = null;

function publish(next: AppHydrationState): void {
  state = next;
  listeners.forEach((listener) => listener(state));
}

export function getAppHydrationState(): AppHydrationState {
  return state;
}

export function subscribeToAppHydration(
  listener: (next: AppHydrationState) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const HYDRATION_POLL_MS = 25;

/**
 * A store is settled only when its own `hasHydrated()` says so.
 *
 * `onFinishHydration` is not sufficient: `programStore` wraps `hasHydrated` as
 * "raw hydration AND accepted-state acceptance" (programStore.ts:2070), and the
 * acceptance runs after the finish listeners fire. Trusting the listener alone
 * would release boot while the accepted program was still being rebuilt —
 * exactly the class of premature release this gate exists to remove.
 */
async function settleStore(store: PersistedStoreHandle): Promise<boolean> {
  const deadline = Date.now() + HYDRATION_TIMEOUT_MS;
  while (!store.hasHydrated()) {
    if (Date.now() >= deadline) return false;
    await new Promise<void>((resolve) => setTimeout(resolve, HYDRATION_POLL_MS));
  }
  return true;
}

/** Resolve once every persisted store has hydrated, or reported failure. */
export function awaitAppHydration(): Promise<AppHydrationState> {
  if (settlement) return settlement;
  settlement = (async () => {
    // The retired shells' stale envelopes leave before the app settles —
    // deletion is their read-ingress lift (see RETIRED_STORE_PERSIST_KEYS).
    await removeRetiredStoreEnvelopes();
    const outcomes = await Promise.all(
      PERSISTED_STORE_HYDRATION_REGISTRY.map(async (store) => ({
        key: store.key,
        hydrated: await settleStore(store),
      })),
    );
    const failedStores = outcomes.filter((o) => !o.hydrated).map((o) => o.key);
    if (failedStores.length > 0) {
      logger.error('[boot][hydration] persisted stores did not hydrate', { failedStores });
    }
    if (failedStores.length === 0) {
      // R1.3 (shell rebuild): boot reads inputs and DERIVES. The old
      // hydration-acceptance machinery is gone; the derived world is rebuilt
      // in memory here, after every input store has settled.
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { runQuiescentBoot } = require('./quiescentBoot');
        await runQuiescentBoot();
      } catch (error) {
        logger.error('[boot][hydration] the derived-world rebuild failed', { error });
        publish({ status: 'failed', failedStores: ['derived-world'] });
        return state;
      }
    }
    publish({
      status: failedStores.length === 0 ? 'ready' : 'failed',
      failedStores,
    });
    return state;
  })();
  return settlement;
}

/** Retry a failed boot — used by the boot error screen's Try Again. */
export function retryAppHydration(): Promise<AppHydrationState> {
  settlement = null;
  publish({ status: 'hydrating', failedStores: [] });
  const retried = (async () => {
    await Promise.all(
      PERSISTED_STORE_HYDRATION_REGISTRY
        .filter((store) => !store.hasHydrated())
        .map((store) => store.rehydrate().catch(() => undefined)),
    );
    settlement = null;
    return awaitAppHydration();
  })();
  settlement = retried;
  return retried;
}
