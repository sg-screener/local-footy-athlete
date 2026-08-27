import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorageCompat } from './asyncStorageCompat';
import { readinessInputsForPersistence } from './compatibilityPersistence';
import type { ReadinessSignal } from '../utils/readiness';
import { normalizeAcceptedKeyedMap } from './acceptedStateColdStart';
import {
  decideQuarantinedWrite,
  guardedDurableWrite,
  quarantineRefusedPayload,
  registerQuarantineBoundary,
  releaseQuarantine,
} from './refusedPayloadQuarantine';
import {
  beginAthleteActionTrace,
  emitAthleteActionEvent,
} from '../utils/athleteActionDiagnostics';
import { logger } from '../utils/logger';

/**
 * Readiness Store — the downstream compatibility mirror of the accepted
 * canonical readiness facts. ProgramStore's accepted context is the sole
 * publisher; this store exists so established readers (`useSchedule`,
 * `selectActiveProgramModifiers`, screens) keep one place to look.
 *
 * ARMOURED 2026-08-03 (`docs/STORE_ARMOUR_RECIPE_2026-08-03.md`): a readiness
 * signal is a FACT the athlete stated about their body on a date, so every
 * write of `signalsByDate` goes through `applyReadinessSignalsWrite` — one
 * door, typed refusals of the wipe shape, every writer on the tape, and a
 * quarantine boundary at the persistence writer.
 * `readinessStoreOwnershipTests` fails the build on a writer around the owner.
 *
 * Because every product writer PROJECTS canonical accepted state — and an
 * empty signal map is the most common real state (no check-in today) — each
 * runs under a named reset act. The refusal guards the bare-wipe class: a
 * `{}` written by anything that is not projecting an accepted decision.
 */
interface ReadinessState {
  signalsByDate: Record<string, ReadinessSignal>;
  setReadinessSignal: (
    date: string,
    signal: Omit<Partial<ReadinessSignal>, 'date' | 'updatedAt'>,
  ) => void;
  clearReadinessSignal: (date: string) => void;
  /**
   * Drop signals for dates strictly before `dateISO`. Only today's signal
   * is ever read (see selectActiveProgramModifiers / useSchedule), so past
   * signals go dormant the next day but were never deleted — this bounds
   * the store instead of letting them accumulate forever.
   */
  pruneBefore: (dateISO: string) => void;
  clear: () => void;
}

export const READINESS_PERSISTENCE_KEY = 'readiness-store';

/**
 * THE STORE'S WRITER BOUNDARY, declared once. A payload carries the athlete's
 * material when at least one signal survives in it. Unreadable bytes prove
 * nothing and answer no.
 */
registerQuarantineBoundary(READINESS_PERSISTENCE_KEY, {
  carriesMaterial: (envelope) => {
    try {
      const state = (JSON.parse(envelope) as {
        state?: { signalsByDate?: Record<string, ReadinessSignal> };
      }).state;
      return Object.keys(state?.signalsByDate ?? {}).length > 0;
    } catch {
      return false;
    }
  },
});

/**
 * The single persistence writer. A REFUSAL MUST NEVER PERSIST THE STATE IT
 * REFUSED INTO (Sam, 2026-07-30): while a refused material payload is held,
 * a bare payload does not travel; a material one always passes and releases
 * the hold. Exported for the ownership suite, which proves this store's
 * boundary rather than trusting the law's fixture cell.
 */
export const readinessGuardedStorage = {
  getItem: (name: string): Promise<string | null> => asyncStorageCompat.getItem(name),
  setItem: (name: string, value: string): Promise<void> =>
    // Not async — zustand voids this call; guardedDurableWrite returns the
    // base write's own (handled) promise. See refusedPayloadQuarantine.ts.
    guardedDurableWrite({
      storeKey: name,
      envelope: value,
      base: asyncStorageCompat,
      onRefused: (reason) => {
        emitAthleteActionEvent(beginAthleteActionTrace({
          source: 'system',
          actionType: 'program_change',
          route: 'readinessGuardedStorage.setItem',
        }, undefined, { forceRoot: true }), 'persistence_result', {
          persistenceOperation: 'write',
          persistenceStore: name,
          persistenceSucceeded: false,
          originalRejectionCode: reason,
          rejectingBoundary: 'readinessGuardedStorage.setItem.quarantine',
          failureCategory: 'persistence_failure',
        });
        logger.error('[readinessStore] refused to persist over a quarantined payload.',
          { store: name, reason: reason });
      },
    }),
  removeItem: (name: string): Promise<void> => asyncStorageCompat.removeItem(name),
};

function canonicalFactReadinessProjection(): Record<string, ReadinessSignal> | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const accepted = require('./acceptedStateColdStart').normalizeAcceptedMaterialContext(
    require('./programStore').useProgramStore.getState().acceptedMaterialContext,
  );
  return accepted.revision > 0 || accepted.temporarySourceFacts.length > 0
    ? accepted.readinessSignalsByDate
    : null;
}

/**
 * Downstream compatibility only. ProgramStore's accepted context is the sole
 * publisher; stale callers are overwritten by its current projection. The
 * projection may legitimately be EMPTY (the athlete cleared their only
 * signal), so it writes under a reset act — canonical truth replacing a stale
 * alias is a legitimate erasure, and it says so.
 */
function replaceWithCanonicalReadinessProjection(
  _date: string,
  _patch: Omit<Partial<ReadinessSignal>, 'date' | 'updatedAt'> | null,
): void {
  const projection = canonicalFactReadinessProjection();
  if (!projection) return;
  const resetActionId = beginReadinessResetAction('canonical_projection');
  try {
    applyReadinessSignalsWrite({
      next: projection,
      writer: 'compatibility_projection',
      resetActionId,
    });
  } finally {
    endReadinessResetAction(resetActionId);
  }
}

export const useReadinessStore = create<ReadinessState>()(
  persist(
    () => ({
      signalsByDate: {},

      // Every action is a thin projection request; the door owns the write.

      setReadinessSignal: (date, signal) => {
        replaceWithCanonicalReadinessProjection(date, signal);
      },

      clearReadinessSignal: (date) => {
        replaceWithCanonicalReadinessProjection(date, null);
      },

      pruneBefore: (dateISO) => {
        replaceWithCanonicalReadinessProjection(dateISO, null);
      },

      clear: () => {
        replaceWithCanonicalReadinessProjection('', null);
      },
    }),
    {
      name: READINESS_PERSISTENCE_KEY,
      storage: createJSONStorage(() => readinessGuardedStorage),
      partialize: state => ({ signalsByDate: readinessInputsForPersistence(state.signalsByDate) }),
      merge: (persisted, current) => {
        const incoming = (persisted as Partial<ReadinessState> | undefined) ?? {};
        return {
          ...current,
          ...incoming,
          signalsByDate: normalizeAcceptedKeyedMap<ReadinessSignal>(incoming.signalsByDate),
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return;
        // Compatibility hydration is downstream-only. Once ProgramStore has
        // accepted canonical state, replace any stale persisted readiness
        // alias with that projection; never publish this store upstream.
        // At revision zero retain the raw mirror long enough for ProgramStore,
        // the sole migration owner, to consume it in either hydration order.
        replaceWithCanonicalReadinessProjection('', null);
      },
    },
  ),
);

/* ══ THE READINESS WRITE OWNER ══
 *
 * The profile door's shape (`applyProfileOnboardingWrite`), applied by recipe
 * (`docs/STORE_ARMOUR_RECIPE_2026-08-03.md`):
 *
 *   1. ONE DOOR. Every write of `signalsByDate` goes through here — the
 *      accepted transaction's publish, the coach-mutation rollback restore
 *      and the store's own canonical projections are its writers, not
 *      exceptions to it.
 *   2. THE DEFAULT IS NOT A VALUE. Writing the empty map over signals the
 *      athlete stated is refused, unless a reset action is IN FLIGHT. A
 *      REDUCED map is not the wipe — pruning past days and clearing one
 *      signal are decisions, and refusing reduction would refuse the athlete.
 *   3. AN IN-FLIGHT RESET, NOT A RESET THAT HAPPENED. A stale id is refused.
 *      Writers inside a transaction may not know the act that opened them, so
 *      the door falls back to the act currently in flight — an id is still
 *      required to exist NOW, which is the property that matters.
 *   4. EVERYTHING IS ON THE TAPE. Applied or refused, every write names its
 *      writer and the signal counts either side. Counts only — a check-in
 *      DATE and how the athlete FELT are answers, and answers never leave
 *      the device.
 */

export type ReadinessWriterId =
  | 'accepted_transaction'
  | 'coach_mutation_mirror'
  | 'compatibility_projection'
  | 'reset';

export interface ReadinessWriteOutcome {
  ok: boolean;
  reason?: 'default_over_answered_signals' | 'reset_action_not_in_flight';
}

const resetActionsInFlight = new Set<string>();
let nextResetActionId = 1;

/**
 * Open a reset. The id is only good while the reset is running, which is what
 * makes a deferred write belonging to a finished reset refusable.
 */
export function beginReadinessResetAction(source: string): string {
  const id = `readiness-reset:${source}:${nextResetActionId++}`;
  resetActionsInFlight.add(id);
  return id;
}

export function endReadinessResetAction(id: string): void {
  resetActionsInFlight.delete(id);
}

/** The reset act currently in flight, if exactly one writer opened it. */
function activeReadinessResetActionId(): string | undefined {
  for (const id of resetActionsInFlight) return id;
  return undefined;
}

export function applyReadinessSignalsWrite(args: {
  next: Record<string, ReadinessSignal>;
  writer: ReadinessWriterId;
  resetActionId?: string;
}): ReadinessWriteOutcome {
  const currentSignals = normalizeAcceptedKeyedMap<ReadinessSignal>(
    useReadinessStore.getState().signalsByDate,
  );
  const nextSignals = normalizeAcceptedKeyedMap<ReadinessSignal>(args.next);
  const signalCountBefore = Object.keys(currentSignals).length;
  const record = (outcome: 'applied' | 'refused', reason?: string, resetActionId?: string) => {
    emitAthleteActionEvent(beginAthleteActionTrace({
      source: 'system',
      actionType: 'readiness_change',
      route: 'applyReadinessSignalsWrite',
    }, undefined, { forceRoot: true }), 'readiness_write', {
      writer: args.writer,
      outcome,
      signalCountBefore,
      signalCountAfter: Object.keys(normalizeAcceptedKeyedMap<ReadinessSignal>(
        useReadinessStore.getState().signalsByDate,
      )).length,
      ...(reason ? { internalResultCode: reason } : {}),
      ...(resetActionId ? { resetActionId } : {}),
    });
  };

  const nextIsTheDefault = Object.keys(nextSignals).length === 0;
  const effectiveResetActionId = args.resetActionId ?? activeReadinessResetActionId();
  if (nextIsTheDefault && signalCountBefore > 0) {
    if (!effectiveResetActionId) {
      quarantineDiskCopyBestEffort();
      record('refused', 'default_over_answered_signals');
      return { ok: false, reason: 'default_over_answered_signals' };
    }
    if (!resetActionsInFlight.has(effectiveResetActionId)) {
      quarantineDiskCopyBestEffort();
      record('refused', 'reset_action_not_in_flight');
      return { ok: false, reason: 'reset_action_not_in_flight' };
    }
  }

  useReadinessStore.setState({ signalsByDate: nextSignals });
  record('applied', undefined, effectiveResetActionId);
  return { ok: true };
}

/**
 * The DISK copy, not the in-memory one — memory survives a refusal by
 * construction; the envelope on disk is what a later writer can destroy.
 */
function quarantineDiskCopyBestEffort(): void {
  void asyncStorageCompat.getItem(READINESS_PERSISTENCE_KEY)
    .then((envelope) => quarantineRefusedPayload(READINESS_PERSISTENCE_KEY, envelope))
    .catch(() => {});
}
