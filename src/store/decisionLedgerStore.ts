import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AthleteDecision, DecisionLedgerEntry, DecisionProvenance } from '../types/decisionLedger';
import { asyncStorageCompat } from './asyncStorageCompat';
import {
  guardedDurableWrite,
  quarantineRefusedPayload,
  registerQuarantineBoundary,
} from './refusedPayloadQuarantine';
import {
  beginAthleteActionTrace,
  emitAthleteActionEvent,
} from '../utils/athleteActionDiagnostics';
import { logger } from '../utils/logger';

/**
 * THE DECISION LEDGER — the shell rebuild's one new persisted store (R1.1,
 * `docs/SHELL_REBUILD_PLAN_2026-08-05.md`).
 *
 * Persisted state is inputs only. Every athlete edit is ONE appended entry
 * here (typed decision, verbatim payload, provenance, device-clock instant);
 * the visible week is derived from the ledger and the other inputs — never
 * stored. A delete writes hundreds of bytes to one store, which is the whole
 * answer to the 30-second delete.
 *
 * Born armoured (`docs/STORE_ARMOUR_RECIPE_2026-08-03.md`): one door with
 * typed refusals, every write on the tape, a quarantine boundary at the
 * persistence writer, and `decisionLedgerOwnershipTests` failing the build on
 * any writer around the owner.
 *
 * The ledger's own law, beyond the recipe: APPEND-ONLY. A write that drops or
 * edits an existing entry is the ledger's wipe shape even when the result is
 * non-empty (`ledger_rewrite_without_reset`). Undo appends a reversal entry;
 * compaction is a named future unit, not a writer.
 */

interface DecisionLedgerState {
  entries: DecisionLedgerEntry[];
  clear: () => void;
}

export const DECISION_LEDGER_PERSISTENCE_KEY = 'decision-ledger-store';

/** Read the ledger. The array is the store's material slice — treat as frozen. */
export function decisionLedgerEntries(): readonly DecisionLedgerEntry[] {
  return useDecisionLedgerStore.getState().entries;
}

/**
 * THE STORE'S WRITER BOUNDARY, declared once. A payload carries the athlete's
 * material when at least one decision survives in it. Unreadable bytes prove
 * nothing and answer no.
 */
registerQuarantineBoundary(DECISION_LEDGER_PERSISTENCE_KEY, {
  carriesMaterial: (envelope) => {
    try {
      const state = (JSON.parse(envelope) as { state?: { entries?: unknown[] } }).state;
      return (state?.entries ?? []).length > 0;
    } catch {
      return false;
    }
  },
});

/**
 * The single persistence writer. A REFUSAL MUST NEVER PERSIST THE STATE IT
 * REFUSED INTO (Sam, 2026-07-30): while a refused material payload is held, a
 * bare payload does not travel; a material one always passes and releases the
 * hold. Exported for the ownership suite, which proves this store's boundary.
 */
export const decisionLedgerGuardedStorage = {
  getItem: (name: string): Promise<string | null> => asyncStorageCompat.getItem(name),
  setItem: (name: string, value: string): Promise<void> =>
    guardedDurableWrite({
      storeKey: name,
      envelope: value,
      base: asyncStorageCompat,
      onRefused: (reason) => {
        emitAthleteActionEvent(beginAthleteActionTrace({
          source: 'system',
          actionType: 'program_change',
          route: 'decisionLedgerGuardedStorage.setItem',
        }, undefined, { forceRoot: true }), 'persistence_result', {
          persistenceOperation: 'write',
          persistenceStore: name,
          persistenceSucceeded: false,
          originalRejectionCode: reason,
          rejectingBoundary: 'decisionLedgerGuardedStorage.setItem.quarantine',
          failureCategory: 'persistence_failure',
        });
        logger.error('[decisionLedgerStore] refused to persist over a quarantined payload.',
          { store: name, reason });
      },
    }),
  removeItem: (name: string): Promise<void> => asyncStorageCompat.removeItem(name),
};

export const useDecisionLedgerStore = create<DecisionLedgerState>()(
  persist(
    () => ({
      entries: [],
      clear: () => {
        // A reset is the one write that may erase decisions, and it says so.
        const resetActionId = beginDecisionLedgerResetAction('decision_ledger_store_clear');
        try {
          applyDecisionLedgerWrite({ next: [], writer: 'reset', resetActionId });
        } finally {
          endDecisionLedgerResetAction(resetActionId);
        }
      },
    }),
    {
      name: DECISION_LEDGER_PERSISTENCE_KEY,
      storage: createJSONStorage(() => decisionLedgerGuardedStorage),
      partialize: (state) => ({ entries: state.entries }) as DecisionLedgerState,
    },
  ),
);

/* ══ THE LEDGER WRITE OWNER ══
 *
 * The recipe's door, with the ledger's own third refusal:
 *
 *   1. ONE DOOR. Every write of `entries` goes through here.
 *   2. THE DEFAULT IS NOT A VALUE. Writing the empty ledger over recorded
 *      decisions refuses without an IN-FLIGHT reset act.
 *   3. AN IN-FLIGHT RESET, NOT A RESET THAT HAPPENED. A stale id is refused.
 *   4. APPEND-ONLY. `next` must extend the current entries unchanged (same
 *      ids, same bytes, in order); anything else is a rewrite and refuses
 *      without a reset act — undo appends a reversal, it never rewrites.
 *   5. EVERYTHING IS ON THE TAPE. Counts and door labels only, never answers
 *      — dates, template ids and payload values stay on the device.
 */

export type DecisionLedgerWriterId =
  | 'program_control'
  | 'fixture_door'
  | 'migration'
  | 'reset'
  /** LR-29's undo door — the only writer of `reversal` entries. */
  | 'undo_door'
  /**
   * The missed-session commitment question's door — the only writer of
   * `weekly_commitment_answer` entries (`store/weeklyCommitmentAnswer.ts`).
   */
  | 'weekly_commitment_door'
  | 'harness';

export interface DecisionLedgerWriteOutcome {
  ok: boolean;
  reason?:
    | 'default_over_answered_ledger'
    | 'reset_action_not_in_flight'
    | 'ledger_rewrite_without_reset';
}

const resetActionsInFlight = new Set<string>();
let nextResetActionId = 1;
let nextEntrySequence = 1;

// THE REPLAY LATCH (R1.3) lives in ledgerReplayLatch.ts (import-free, so the
// storage compat layer and the action log consult it without cycles). While
// held, appends no-op: REPLAY READS THE LEDGER, IT NEVER WRITES IT.
export { beginLedgerReplay, endLedgerReplay, ledgerReplayActive } from './ledgerReplayLatch';
// eslint-disable-next-line no-duplicate-imports
import { ledgerReplayActive } from './ledgerReplayLatch';

/**
 * Open a reset. The id is only good while the reset is running, which is what
 * makes a deferred write belonging to a finished reset refusable.
 */
export function beginDecisionLedgerResetAction(source: string): string {
  const id = `decision-ledger-reset:${source}:${nextResetActionId++}`;
  resetActionsInFlight.add(id);
  return id;
}

export function endDecisionLedgerResetAction(id: string): void {
  resetActionsInFlight.delete(id);
}

/** `next` extends `current` unchanged: every existing entry survives byte-identical, in order. */
function extendsUnchanged(current: readonly DecisionLedgerEntry[], next: readonly DecisionLedgerEntry[]): boolean {
  if (next.length < current.length) return false;
  for (let index = 0; index < current.length; index += 1) {
    if (JSON.stringify(next[index]) !== JSON.stringify(current[index])) return false;
  }
  return true;
}

export function applyDecisionLedgerWrite(args: {
  next: DecisionLedgerEntry[];
  writer: DecisionLedgerWriterId;
  resetActionId?: string;
}): DecisionLedgerWriteOutcome {
  const current = useDecisionLedgerStore.getState().entries;
  const record = (outcome: 'applied' | 'refused', reason?: string) => {
    const after = useDecisionLedgerStore.getState().entries;
    const appended = outcome === 'applied' && after.length > current.length
      ? after[after.length - 1]
      : undefined;
    const appendedKind = appended
      ? (appended.decision.kind === 'plan_change'
        ? appended.decision.change.kind
        : appended.decision.kind)
      : undefined;
    emitAthleteActionEvent(beginAthleteActionTrace({
      source: args.writer === 'program_control' || args.writer === 'fixture_door'
        ? 'tap' : 'system',
      actionType: 'program_change',
      route: 'applyDecisionLedgerWrite',
    }, undefined, { forceRoot: true }), 'decision_ledger_write', {
      writer: args.writer,
      outcome,
      entryCountBefore: current.length,
      entryCountAfter: after.length,
      ...(appendedKind ? { decisionKind: appendedKind } : {}),
      ...(reason ? { internalResultCode: reason } : {}),
      // `erasureActId`, not `resetActionId`: the diagnostics forbidden-key
      // filter drops any key containing "set" (recipe lesson 12).
      ...(args.resetActionId ? { erasureActId: args.resetActionId } : {}),
    });
  };

  const resetInFlight = (): DecisionLedgerWriteOutcome | null => {
    if (!args.resetActionId) return null;
    if (resetActionsInFlight.has(args.resetActionId)) return { ok: true };
    return { ok: false, reason: 'reset_action_not_in_flight' };
  };

  if (current.length > 0 && args.next.length === 0) {
    const reset = resetInFlight();
    if (!reset) {
      quarantineDiskCopyBestEffort();
      record('refused', 'default_over_answered_ledger');
      return { ok: false, reason: 'default_over_answered_ledger' };
    }
    if (!reset.ok) {
      quarantineDiskCopyBestEffort();
      record('refused', reset.reason);
      return reset;
    }
  } else if (!extendsUnchanged(current, args.next)) {
    const reset = resetInFlight();
    if (!reset) {
      quarantineDiskCopyBestEffort();
      record('refused', 'ledger_rewrite_without_reset');
      return { ok: false, reason: 'ledger_rewrite_without_reset' };
    }
    if (!reset.ok) {
      quarantineDiskCopyBestEffort();
      record('refused', reset.reason);
      return reset;
    }
  }

  useDecisionLedgerStore.setState({ entries: args.next });
  record('applied');
  return { ok: true };
}

export interface AppendDecisionOutcome extends DecisionLedgerWriteOutcome {
  entry?: DecisionLedgerEntry;
}

/**
 * The appender every door uses: builds the entry (identity + device-clock
 * instant), appends through the owner, returns the entry that landed.
 */
export function appendDecisionEntry(args: {
  decision: AthleteDecision;
  provenance: DecisionProvenance;
  writer: DecisionLedgerWriterId;
  occurredAt?: string;
}): AppendDecisionOutcome {
  if (ledgerReplayActive()) return { ok: true };
  const entry: DecisionLedgerEntry = {
    id: `dl-${nextEntrySequence++}`,
    occurredAt: args.occurredAt ?? new Date().toISOString(),
    provenance: args.provenance,
    decision: args.decision,
  };
  const outcome = applyDecisionLedgerWrite({
    next: [...useDecisionLedgerStore.getState().entries, entry],
    writer: args.writer,
  });
  return outcome.ok ? { ...outcome, entry } : outcome;
}

/**
 * The DISK copy, not the in-memory one — memory survives a refusal by
 * construction; the envelope on disk is what a later writer can destroy.
 */
function quarantineDiskCopyBestEffort(): void {
  void asyncStorageCompat.getItem(DECISION_LEDGER_PERSISTENCE_KEY)
    .then((envelope) => quarantineRefusedPayload(DECISION_LEDGER_PERSISTENCE_KEY, envelope))
    .catch(() => {});
}
