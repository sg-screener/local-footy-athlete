/**
 * coachMutationHistoryStore.ts — bounded record of successful, verified
 * coach mutations so the athlete can say "undo that" and we can revert
 * deterministically.
 *
 * SCOPE
 *   Every coach mutation that the executor confirms via dual-surface
 *   visible-program verification (Program tab + DayWorkout) writes ONE
 *   `MutationHistoryEntry` here. Failed/verified-no-op turns are NEVER
 *   recorded — the contract is "if it didn't land, it's not history".
 *
 * REVERT PLAN SHAPE
 *   Every supported op produces the same `RevertPlan` shape — a uniform
 *   "restore_snapshot" plan covering:
 *     * `dateOverrides` — per affected date, the prior `(workout, context)`
 *       pair. `workout: null` means "no override existed before, so call
 *       `removeManualOverride(date)`". Otherwise `setManualOverride(date,
 *       workout, context)`.
 *     * `modalityPreference` — the prior canonical-key entry. `entry: null`
 *       means "no preference existed before, so call
 *       `clearModalityPreference(canonicalKey)`". Otherwise call
 *       `setModalityPreference` with the saved entry.
 *
 *   This shape is uniform because every applier in the codebase replaces
 *   the WHOLE workout per date — there are no per-field diffs to undo.
 *
 * BOUNDS
 *   Entries[] is capped at HISTORY_LIMIT (default 50). The most recent
 *   non-reverted entry is always considered "the last change". Reverting
 *   marks the entry `revertedAt` so it can't be undone twice.
 *
 * WHY NOT JUST WHOLE-PROGRAM SNAPSHOTS
 *   The visible program is rebuilt from the engine + dateOverrides on
 *   every render. Persisting the full program would be redundant and
 *   wasteful. The smallest correct snapshot is the prior dateOverride
 *   entries for the affected dates plus (when relevant) the prior
 *   modality preference entry — that's exactly what RevertPlan stores.
 *
 * ARMOURED 2026-08-03 (`docs/STORE_ARMOUR_RECIPE_2026-08-03.md`): the history
 * is the record AGENTS.md requires for coach follow-up target resolution, and
 * every entry is a decision the athlete made plus the plan to revert it — so
 * every write of `entries` goes through `applyCoachMutationHistoryWrite`: one
 * door, typed refusals of the wipe shape, every writer on the tape, and a
 * quarantine boundary at the persistence writer. Store-ownership work only
 * (LR-6): what the executor records and the undo engine reverts is unchanged.
 * `coachMutationHistoryOwnershipTests` fails the build on a product writer
 * around the owner.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorageCompat } from './asyncStorageCompat';
import {
  decideQuarantinedWrite,
  quarantineRefusedPayload,
  registerQuarantineBoundary,
  releaseQuarantine,
} from './refusedPayloadQuarantine';
import {
  beginAthleteActionTrace,
  emitAthleteActionEvent,
} from '../utils/athleteActionDiagnostics';
import { logger } from '../utils/logger';
import type { Workout, OverrideContext } from '../types/domain';
import type { ModalityPreference } from './coachPreferencesStore';
import type { CalendarDayType } from './calendarStore';
import type {
  CoachMutateOperation,
  CoachCommandScope,
} from '../utils/coachCommandRouter';

/** Max number of entries kept in the history queue. */
export const HISTORY_LIMIT = 50;

/**
 * Per-date snapshot piece of a revert plan. `workout: null` means
 * "no override existed before the mutation" — undo calls
 * removeManualOverride(date). Otherwise undo calls
 * setManualOverride(date, workout, context).
 */
export interface DateOverrideSnapshot {
  date: string;
  workout: Workout | null;
  context: OverrideContext | null;
}

/**
 * Modality preference snapshot piece. `entry: null` means "no preference
 * existed before the mutation" — undo calls clearModalityPreference.
 * Otherwise undo calls setModalityPreference with this entry.
 */
export interface ModalityPreferenceSnapshot {
  /** Canonical key (lowercased + collapsed) the preference was stored under. */
  canonicalKey: string;
  /** Original session name (used for re-write because setModalityPreference
   *  re-canonicalises internally). Falls back to canonicalKey when unknown. */
  sessionName: string;
  /** The prior entry, or null if none existed. */
  entry: ModalityPreference | null;
}

export interface CalendarMarkSnapshot {
  date: string;
  mark: CalendarDayType | null;
}

/**
 * Uniform revert plan. Every supported op produces this shape. The undo
 * engine walks `dateOverrides` first, then (if present) restores the
 * modality preference. Both passes are best-effort write-throughs to the
 * live stores — the executor's verification step is what guarantees the
 * undo actually landed.
 */
export interface RevertPlan {
  kind: 'restore_snapshot';
  /** Dates whose override should be restored (or removed). */
  dateOverrides: DateOverrideSnapshot[];
  /** Optional preference snapshot — only present for modality-preference
   *  mutations. */
  modalityPreference?: ModalityPreferenceSnapshot;
  /** Optional calendar mark snapshot for mutations that alter rest/game/noGame
   *  marks instead of only dateOverrides. */
  calendarMarks?: CalendarMarkSnapshot[];
}

/** Categorical hint for verification — tells the undo engine which surface
 *  to probe to confirm the undo landed. */
export type MutationKind =
  | 'add_conditioning'
  | 'add_session'
  | 'remove_session'
  | 'remove_conditioning'
  | 'replace_exercise'
  | 'move_session'
  | 'modality_swap_once'
  | 'modality_preference'
  | 'bike_subtype_preference';

export interface MutationTouchedActivity {
  kind: 'conditioning' | 'exercise' | 'session';
  date: string;
  sessionName?: string;
  title: string;
  previousTitle?: string;
  modality?: string | null;
  intensity?: string;
  durationMinutes?: number;
  sets?: number;
  repsMin?: number;
  repsMax?: number;
  prescriptionType?: string;
  bikeLabel?: string | null;
  effortKind?: string;
  trainingIntent?: string;
}

/**
 * One persisted coach mutation. The executor writes this AFTER
 * dual-surface verification confirms the change landed.
 *
 * `userMessage` and `appliedReply` are recorded for log/debug parity with
 * the chat transcript — they help the athlete (and future-us) match a
 * history entry to a turn.
 */
export interface MutationHistoryEntry {
  /** Stable ULID-ish id ("mh-<timestamp>-<rand>"). */
  id: string;
  /** Wall-clock millis at write time. */
  timestamp: number;
  /** Router-emitted operation. */
  operation: CoachMutateOperation;
  /** Categorical bucket the undo engine uses to pick verification surfaces. */
  mutationKind: MutationKind;
  /** Original athlete turn — used for "undo my add conditioning" semantics
   *  and debug overlays. Truncated to 240 chars. */
  userMessage: string;
  /** Verified reply text the executor returned. Truncated to 240 chars. */
  appliedReply: string;
  /** Dates the mutation directly affected. Move ops carry both source +
   *  dest. Modality preference ops carry the eager-rewrite dates plus
   *  any per-date swap target. */
  affectedDates: string[];
  /**
   * Structured memory of what the athlete actually changed. This is the
   * durable target for follow-ups like "make them shorter", "replace it
   * with hills", "undo that", etc. Older entries may omit it.
   */
  touchedActivities?: MutationTouchedActivity[];
  /** Router scope, surfaced so the undo reply can stay coherent
   *  ("undid the recurring change", "undid that one-off swap"). */
  scope: CoachCommandScope;
  /** Deterministic plan for the undo engine. Uniform shape across ops. */
  revertPlan: RevertPlan;
  /**
   * When non-null, the entry has been reverted — `getLastUndoableMutation`
   * skips it. Set by `markReverted`.
   */
  revertedAt: number | null;
}

export interface MutationHistoryState {
  /** Newest-first list. */
  entries: MutationHistoryEntry[];

  /** Append a new entry. Drops the oldest entry past HISTORY_LIMIT. */
  recordMutation: (
    entry: Omit<MutationHistoryEntry, 'id' | 'timestamp' | 'revertedAt'> & {
      id?: string;
      timestamp?: number;
    },
  ) => MutationHistoryEntry;

  /** Most recent entry whose `revertedAt` is null. */
  getLastUndoableMutation: () => MutationHistoryEntry | null;

  /** Mark an entry reverted — consumed by undo flow. */
  markReverted: (id: string, revertedAt?: number) => void;

  /** Test/reset helper. */
  clearAll: () => void;
}

function newId(): string {
  // Cheap monotonic-ish id; we don't need cryptographic strength here,
  // just enough to disambiguate within a single millisecond.
  return `mh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function truncate(s: string | undefined, max: number): string {
  if (!s) return '';
  return s.length <= max ? s : s.slice(0, max - 1) + '\u2026';
}

export const COACH_MUTATION_HISTORY_PERSISTENCE_KEY = 'coach-mutation-history-store';

/**
 * THE STORE'S WRITER BOUNDARY, declared once (`docs/STORE_ARMOUR_RECIPE_
 * 2026-08-03.md`). A payload carries the athlete's material when at least one
 * history entry survives in it. Unreadable bytes prove nothing and answer no.
 */
registerQuarantineBoundary(COACH_MUTATION_HISTORY_PERSISTENCE_KEY, {
  carriesMaterial: (envelope) => {
    try {
      const state = (JSON.parse(envelope) as {
        state?: { entries?: MutationHistoryEntry[] };
      }).state;
      return (state?.entries ?? []).length > 0;
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
export const coachMutationHistoryGuardedStorage = {
  getItem: (name: string): Promise<string | null> => asyncStorageCompat.getItem(name),
  setItem: async (name: string, value: string): Promise<void> => {
    const decision = decideQuarantinedWrite(name, value);
    if (!decision.allowed) {
      emitAthleteActionEvent(beginAthleteActionTrace({
        source: 'system',
        actionType: 'program_change',
        route: 'coachMutationHistoryGuardedStorage.setItem',
      }, undefined, { forceRoot: true }), 'persistence_result', {
        persistenceOperation: 'write',
        persistenceStore: name,
        persistenceSucceeded: false,
        originalRejectionCode: decision.reason,
        rejectingBoundary: 'coachMutationHistoryGuardedStorage.setItem.quarantine',
        failureCategory: 'persistence_failure',
      });
      logger.error('[coachMutationHistoryStore] refused to persist over a quarantined payload.',
        { store: name, reason: decision.reason });
      return;
    }
    releaseQuarantine(name);
    await asyncStorageCompat.setItem(name, value);
  },
  removeItem: (name: string): Promise<void> => asyncStorageCompat.removeItem(name),
};

export const useCoachMutationHistoryStore = create<MutationHistoryState>()(
  persist(
    () => ({
      entries: [],

      // Every action is a thin builder of `next`; the door owns the write.

      recordMutation: (input) => {
        const entry: MutationHistoryEntry = {
          id: input.id ?? newId(),
          timestamp: input.timestamp ?? Date.now(),
          operation: input.operation,
          mutationKind: input.mutationKind,
          userMessage: truncate(input.userMessage, 240),
          appliedReply: truncate(input.appliedReply, 240),
          affectedDates: [...(input.affectedDates ?? [])],
          touchedActivities: input.touchedActivities?.map((activity) => ({ ...activity })),
          scope: input.scope,
          revertPlan: input.revertPlan,
          revertedAt: null,
        };
        // Newest-first, capped at HISTORY_LIMIT (drop tail).
        const next = [entry, ...useCoachMutationHistoryStore.getState().entries];
        if (next.length > HISTORY_LIMIT) next.length = HISTORY_LIMIT;
        applyCoachMutationHistoryWrite({ next, writer: 'executor_record' });
        return entry;
      },

      getLastUndoableMutation: () => {
        const entries = useCoachMutationHistoryStore.getState().entries;
        for (const e of entries) {
          if (e.revertedAt == null) return e;
        }
        return null;
      },

      markReverted: (id, revertedAt) => {
        const next = useCoachMutationHistoryStore.getState().entries.map((e) =>
          e.id === id && e.revertedAt == null
            ? { ...e, revertedAt: revertedAt ?? Date.now() }
            : e,
        );
        applyCoachMutationHistoryWrite({ next, writer: 'undo_engine' });
      },

      clearAll: () => {
        // A reset is the one write that may erase the history, and it says so.
        const resetActionId = beginCoachMutationHistoryResetAction('mutation_history_clear_all');
        try {
          applyCoachMutationHistoryWrite({ next: [], writer: 'reset', resetActionId });
        } finally {
          endCoachMutationHistoryResetAction(resetActionId);
        }
      },
    }),
    {
      name: COACH_MUTATION_HISTORY_PERSISTENCE_KEY,
      storage: createJSONStorage(() => coachMutationHistoryGuardedStorage),
    },
  ),
);

/* ══ THE MUTATION HISTORY WRITE OWNER ══
 *
 * The profile door's shape (`applyProfileOnboardingWrite`), applied by recipe
 * (`docs/STORE_ARMOUR_RECIPE_2026-08-03.md`):
 *
 *   1. ONE DOOR. Every write of `entries` goes through here — including the
 *      coach-mutation rollback restore, which is one of its writers, not an
 *      exception to it.
 *   2. THE DEFAULT IS NOT A VALUE. Writing the empty list over recorded
 *      mutations is refused, unless a reset action is IN FLIGHT. A REDUCED
 *      list is not the wipe — the HISTORY_LIMIT cap legitimately drops the
 *      tail, and `markReverted` rewrites entries without changing the count.
 *   3. AN IN-FLIGHT RESET, NOT A RESET THAT HAPPENED. A stale id is refused.
 *   4. EVERYTHING IS ON THE TAPE. Applied or refused, every write names its
 *      writer and the entry counts either side. Counts only — the athlete's
 *      words, the coach's reply and the affected dates are answers, and
 *      answers never leave the device.
 */

export type CoachMutationHistoryWriterId =
  | 'executor_record'
  | 'undo_engine'
  | 'coach_mutation_rollback'
  | 'reset';

export interface CoachMutationHistoryWriteOutcome {
  ok: boolean;
  reason?: 'default_over_answered_history' | 'reset_action_not_in_flight';
}

const resetActionsInFlight = new Set<string>();
let nextResetActionId = 1;

/**
 * Open a reset. The id is only good while the reset is running, which is what
 * makes a deferred write belonging to a finished reset refusable.
 */
export function beginCoachMutationHistoryResetAction(source: string): string {
  const id = `coach-mutation-history-reset:${source}:${nextResetActionId++}`;
  resetActionsInFlight.add(id);
  return id;
}

export function endCoachMutationHistoryResetAction(id: string): void {
  resetActionsInFlight.delete(id);
}

export function applyCoachMutationHistoryWrite(args: {
  next: MutationHistoryEntry[];
  writer: CoachMutationHistoryWriterId;
  resetActionId?: string;
}): CoachMutationHistoryWriteOutcome {
  const entryCountBefore = useCoachMutationHistoryStore.getState().entries.length;
  const record = (outcome: 'applied' | 'refused', reason?: string) => {
    emitAthleteActionEvent(beginAthleteActionTrace({
      source: 'system',
      actionType: 'program_change',
      route: 'applyCoachMutationHistoryWrite',
    }, undefined, { forceRoot: true }), 'coach_mutation_history_write', {
      writer: args.writer,
      outcome,
      entryCountBefore,
      entryCountAfter: useCoachMutationHistoryStore.getState().entries.length,
      ...(reason ? { internalResultCode: reason } : {}),
      ...(args.resetActionId ? { resetActionId: args.resetActionId } : {}),
    });
  };

  const nextIsTheDefault = args.next.length === 0;
  if (nextIsTheDefault && entryCountBefore > 0) {
    if (!args.resetActionId) {
      quarantineDiskCopyBestEffort();
      record('refused', 'default_over_answered_history');
      return { ok: false, reason: 'default_over_answered_history' };
    }
    if (!resetActionsInFlight.has(args.resetActionId)) {
      quarantineDiskCopyBestEffort();
      record('refused', 'reset_action_not_in_flight');
      return { ok: false, reason: 'reset_action_not_in_flight' };
    }
  }

  useCoachMutationHistoryStore.setState({ entries: args.next });
  record('applied');
  return { ok: true };
}

/**
 * The DISK copy, not the in-memory one — memory survives a refusal by
 * construction; the envelope on disk is what a later writer can destroy.
 */
function quarantineDiskCopyBestEffort(): void {
  void asyncStorageCompat.getItem(COACH_MUTATION_HISTORY_PERSISTENCE_KEY)
    .then((envelope) => quarantineRefusedPayload(COACH_MUTATION_HISTORY_PERSISTENCE_KEY, envelope))
    .catch(() => {});
}

/**
 * Snapshot helper for tests + the executor. Returns an immutable view of
 * the current entries.
 */
export function getMutationHistoryEntries(): MutationHistoryEntry[] {
  return useCoachMutationHistoryStore.getState().entries;
}
