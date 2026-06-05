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
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

export const useCoachMutationHistoryStore = create<MutationHistoryState>()(
  persist(
    (set, get) => ({
      entries: [],

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
        set((state) => {
          // Newest-first, capped at HISTORY_LIMIT (drop tail).
          const next = [entry, ...state.entries];
          if (next.length > HISTORY_LIMIT) next.length = HISTORY_LIMIT;
          return { entries: next };
        });
        return entry;
      },

      getLastUndoableMutation: () => {
        const entries = get().entries;
        for (const e of entries) {
          if (e.revertedAt == null) return e;
        }
        return null;
      },

      markReverted: (id, revertedAt) => {
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === id && e.revertedAt == null
              ? { ...e, revertedAt: revertedAt ?? Date.now() }
              : e,
          ),
        }));
      },

      clearAll: () => set({ entries: [] }),
    }),
    {
      name: 'coach-mutation-history-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/**
 * Snapshot helper for tests + the executor. Returns an immutable view of
 * the current entries.
 */
export function getMutationHistoryEntries(): MutationHistoryEntry[] {
  return useCoachMutationHistoryStore.getState().entries;
}
