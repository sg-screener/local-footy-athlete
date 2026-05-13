/**
 * coachUndoEngine.ts — deterministic application of a `RevertPlan` produced
 * by the mutation history store.
 *
 * The engine is intentionally narrow: it walks the plan, restores each
 * snapshot through the live store mutators, then re-reads the visible
 * projections to confirm the undo landed. It does NOT decide which plan
 * to run — that's the executor's `runUndoLastChange` branch.
 *
 * ─── Contract ────────────────────────────────────────────────────────
 *
 *  1. `dateOverrides` snapshots: `workout: null` → `removeManualOverride`,
 *     non-null → `setManualOverride(date, workout, context)`. Order is
 *     irrelevant because writes are independent per date.
 *
 *  2. `modalityPreference` snapshot: `entry: null` → `clearModalityPreference`,
 *     non-null → `setModalityPreference(sessionName, { from, to, bikeLabel })`.
 *
 *  3. Verification re-reads the visible Program-tab projection AND the
 *     DayWorkout projection for every affected date, comparing the
 *     workout name. Names match → that date verified. The preference
 *     side is verified by re-reading the prefs map.
 *
 *  4. The engine never throws; it returns a structured result so the
 *     caller can compose an honest reply (Done vs. "didn't land").
 */

import { useProgramStore } from '../store/programStore';
import {
  useCoachPreferencesStore,
  canonicalSessionKey,
  type ModalityPreference,
} from '../store/coachPreferencesStore';
import { buildScheduleStateImperative } from './coachWeekDiff';
import {
  buildProgramTabProjectedWeek,
  buildDayWorkoutProjectedDay,
} from './visibleProgramReadModel';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import type {
  RevertPlan,
  DateOverrideSnapshot,
  ModalityPreferenceSnapshot,
} from '../store/coachMutationHistoryStore';
import type { Workout, OverrideContext } from '../types/domain';
import type { ConditioningModality } from '../data/exerciseTags';
import type { BikeLabel } from './coachModalitySwap';
import { logger } from './logger';

// ─── Public types ───────────────────────────────────────────────────

export interface UndoDateVerification {
  date: string;
  /** Expected workout name from the snapshot (null when the snapshot had
   *  no override — the projection should fall back to engine output). */
  expectedName: string | null;
  /** Workout name observed on the Program-tab projection after undo. */
  programTabName: string | null;
  /** Workout name observed on the DayWorkout projection after undo. */
  dayWorkoutName: string | null;
  /** True when both surfaces agree with the snapshot. */
  matches: boolean;
}

export interface UndoVerificationResult {
  /** Per-date verification results, in the same order as the plan. */
  perDate: UndoDateVerification[];
  /** True when the modality preference snapshot was honoured. Only
   *  meaningful when the plan included a `modalityPreference`. Defaults
   *  to true when no preference snapshot was present. */
  preferenceMatches: boolean;
  /** True when every date verified AND the preference verified. */
  fullyVerified: boolean;
}

export interface ApplyUndoPlanResult {
  /** True when at least the writes ran without throwing. (Verification
   *  is reported separately.) */
  executed: boolean;
  /** Verification block — read straight after the writes. */
  verification: UndoVerificationResult;
}

export interface ApplyUndoPlanDeps {
  /** Replaces `programStore.setManualOverride`. */
  setManualOverride?: (
    date: string,
    workout: Workout,
    context?: OverrideContext,
  ) => void;
  /** Replaces `programStore.removeManualOverride`. */
  removeManualOverride?: (date: string) => void;
  /** Replaces `coachPreferencesStore.setModalityPreference`. */
  setModalityPreference?: (
    sessionName: string,
    pref: {
      from: ConditioningModality | null;
      to: ConditioningModality;
      bikeLabel?: BikeLabel | null;
    },
  ) => void;
  /** Replaces `coachPreferencesStore.clearModalityPreference`. */
  clearModalityPreference?: (sessionName: string) => void;
  /** Verifies a single date's projection matches the snapshot. */
  verifyDate?: (args: {
    date: string;
    todayISO: string;
    expectedName: string | null;
  }) => UndoDateVerification;
  /** Verifies the modality preference snapshot was honoured. */
  verifyPreference?: (snap: ModalityPreferenceSnapshot) => boolean;
}

// ─── Public entry point ─────────────────────────────────────────────

export function applyUndoPlan(
  plan: RevertPlan,
  opts: { todayISO: string; deps?: ApplyUndoPlanDeps },
): ApplyUndoPlanResult {
  const deps = opts.deps ?? {};
  const setOverride = deps.setManualOverride ?? defaultSetManualOverride;
  const removeOverride = deps.removeManualOverride ?? defaultRemoveManualOverride;
  const setPref = deps.setModalityPreference ?? defaultSetModalityPreference;
  const clearPref = deps.clearModalityPreference ?? defaultClearModalityPreference;
  const verifyDate = deps.verifyDate ?? defaultVerifyDate;
  const verifyPreference = deps.verifyPreference ?? defaultVerifyPreference;

  let executed = true;

  // 1. Restore date overrides — independent per date.
  for (const snap of plan.dateOverrides ?? []) {
    try {
      restoreDateOverride(snap, setOverride, removeOverride);
    } catch (e) {
      executed = false;
      logger.warn('[coach-undo-engine] restore_date_threw', {
        date: snap.date,
        error: (e as Error)?.message ?? String(e),
      });
    }
  }

  // 2. Restore modality preference (when present).
  if (plan.modalityPreference) {
    try {
      restoreModalityPreference(plan.modalityPreference, setPref, clearPref);
    } catch (e) {
      executed = false;
      logger.warn('[coach-undo-engine] restore_preference_threw', {
        canonicalKey: plan.modalityPreference.canonicalKey,
        error: (e as Error)?.message ?? String(e),
      });
    }
  }

  // 3. Verification — re-read the visible surfaces for every affected
  //    date, plus the preference map when present.
  const perDate = (plan.dateOverrides ?? []).map((snap) =>
    verifyDate({
      date: snap.date,
      todayISO: opts.todayISO,
      expectedName: snap.workout?.name ?? null,
    }),
  );
  const preferenceMatches = plan.modalityPreference
    ? verifyPreference(plan.modalityPreference)
    : true;
  const allDatesMatch = perDate.every((v) => v.matches);
  const fullyVerified = allDatesMatch && preferenceMatches;

  logger.debug('[coach-undo-engine] apply_complete', {
    dateCount: perDate.length,
    fullyVerified,
    allDatesMatch,
    preferenceMatches,
    perDate: perDate.map((v) => ({
      date: v.date,
      matches: v.matches,
      expected: v.expectedName,
      programTab: v.programTabName,
      dayWorkout: v.dayWorkoutName,
    })),
  });

  return {
    executed,
    verification: {
      perDate,
      preferenceMatches,
      fullyVerified,
    },
  };
}

// ─── Restore helpers ────────────────────────────────────────────────

function restoreDateOverride(
  snap: DateOverrideSnapshot,
  setOverride: NonNullable<ApplyUndoPlanDeps['setManualOverride']>,
  removeOverride: NonNullable<ApplyUndoPlanDeps['removeManualOverride']>,
): void {
  if (snap.workout == null) {
    removeOverride(snap.date);
    return;
  }
  setOverride(
    snap.date,
    snap.workout,
    snap.context ?? { intent: 'program_adjustment', label: 'coach undo' },
  );
}

function restoreModalityPreference(
  snap: ModalityPreferenceSnapshot,
  setPref: NonNullable<ApplyUndoPlanDeps['setModalityPreference']>,
  clearPref: NonNullable<ApplyUndoPlanDeps['clearModalityPreference']>,
): void {
  if (snap.entry == null) {
    clearPref(snap.sessionName || snap.canonicalKey);
    return;
  }
  setPref(snap.sessionName || snap.canonicalKey, {
    from: snap.entry.from,
    to: snap.entry.to,
    bikeLabel: snap.entry.bikeLabel ?? null,
  });
}

// ─── Default verifiers (live store reads) ───────────────────────────

function defaultVerifyDate(args: {
  date: string;
  todayISO: string;
  expectedName: string | null;
}): UndoDateVerification {
  const { date, todayISO, expectedName } = args;
  try {
    const programStore = useProgramStore.getState();
    const cuStore = useCoachUpdatesStore.getState();
    const baseState = buildScheduleStateImperative();
    const activeConstraints = (cuStore.activeConstraints ?? []).filter(
      (c) => c.status !== 'resolved',
    );
    const stateWithConstraints = { ...baseState, activeConstraints };
    const monday = mondayOfISO(date);
    const week = buildProgramTabProjectedWeek({
      mondayISO: monday,
      todayISO,
      state: stateWithConstraints,
      overrideContexts: programStore.overrideContexts ?? {},
    });
    const tabDay = week.find((d) => d.date === date) ?? null;
    const programTabName = tabDay?.workout?.name ?? null;

    const dayProjection = buildDayWorkoutProjectedDay({
      date,
      todayISO,
      state: stateWithConstraints,
      overrideContext: programStore.overrideContexts?.[date],
    });
    const dayWorkoutName = dayProjection?.workout?.name ?? null;

    const matches =
      sameName(programTabName, expectedName) &&
      sameName(dayWorkoutName, expectedName);

    return {
      date,
      expectedName,
      programTabName,
      dayWorkoutName,
      matches,
    };
  } catch (e) {
    logger.warn('[coach-undo-engine] default_verify_date_threw', {
      date,
      error: (e as Error)?.message ?? String(e),
    });
    return {
      date,
      expectedName,
      programTabName: null,
      dayWorkoutName: null,
      matches: false,
    };
  }
}

function defaultVerifyPreference(snap: ModalityPreferenceSnapshot): boolean {
  try {
    const map = useCoachPreferencesStore.getState().modalityPreferences;
    const entry = map[snap.canonicalKey] ?? null;
    if (snap.entry == null) {
      // Snapshot had no preference — verify the entry was cleared.
      return entry == null;
    }
    if (entry == null) return false;
    return (
      entry.from === snap.entry.from &&
      entry.to === snap.entry.to &&
      (entry.bikeLabel ?? null) === (snap.entry.bikeLabel ?? null)
    );
  } catch (e) {
    logger.warn('[coach-undo-engine] default_verify_preference_threw', {
      canonicalKey: snap.canonicalKey,
      error: (e as Error)?.message ?? String(e),
    });
    return false;
  }
}

// ─── Default mutators (live store writes) ───────────────────────────

function defaultSetManualOverride(
  date: string,
  workout: Workout,
  context?: OverrideContext,
): void {
  useProgramStore.getState().setManualOverride(date, workout, context);
}

function defaultRemoveManualOverride(date: string): void {
  useProgramStore.getState().removeManualOverride(date);
}

function defaultSetModalityPreference(
  sessionName: string,
  pref: {
    from: ConditioningModality | null;
    to: ConditioningModality;
    bikeLabel?: BikeLabel | null;
  },
): void {
  useCoachPreferencesStore
    .getState()
    .setModalityPreference(sessionName, {
      from: pref.from,
      to: pref.to,
      bikeLabel: pref.bikeLabel ?? null,
    });
}

function defaultClearModalityPreference(sessionName: string): void {
  useCoachPreferencesStore.getState().clearModalityPreference(sessionName);
}

// ─── Tiny date helpers (kept local to avoid module cycles) ─────────

function mondayOfISO(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  const dow = dt.getDay();
  const offset = dow === 0 ? -6 : -(dow - 1);
  dt.setDate(dt.getDate() + offset);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Compare workout names case-insensitively, treating null/empty as equal. */
function sameName(a: string | null, b: string | null): boolean {
  const norm = (s: string | null): string => (s ?? '').trim().toLowerCase();
  return norm(a) === norm(b);
}

/** Read a single date's current override + context — used by the executor's
 *  "snapshot before mutation" helpers. Pure read; safe in tests when stores
 *  aren't mounted (returns null/null). */
export function readCurrentDateOverride(date: string): {
  workout: Workout | null;
  context: OverrideContext | null;
} {
  try {
    const state = useProgramStore.getState();
    return {
      workout: state.dateOverrides?.[date] ?? null,
      context: state.overrideContexts?.[date] ?? null,
    };
  } catch {
    return { workout: null, context: null };
  }
}

/** Read the current modality preference for a session. */
export function readCurrentModalityPreference(sessionName: string): {
  canonicalKey: string;
  entry: ModalityPreference | null;
} {
  const canonicalKey = canonicalSessionKey(sessionName);
  try {
    const map = useCoachPreferencesStore.getState().modalityPreferences ?? {};
    return { canonicalKey, entry: map[canonicalKey] ?? null };
  } catch {
    return { canonicalKey, entry: null };
  }
}

/** Read the entire current modality-preferences map. */
export function readCurrentModalityPreferenceMap(): Record<string, ModalityPreference> {
  try {
    return useCoachPreferencesStore.getState().modalityPreferences ?? {};
  } catch {
    return {};
  }
}

/**
 * Read the entire current dateOverrides + contexts as a single map keyed
 * by date. Used by the executor's modality-orchestrator branch to diff
 * before/after state and identify which dates the orchestrator touched.
 *
 * Pure read; safe in tests when stores aren't mounted (returns empty map).
 */
export function readCurrentDateOverrideMap(): Map<
  string,
  { workout: Workout | null; context: OverrideContext | null }
> {
  const m = new Map<string, { workout: Workout | null; context: OverrideContext | null }>();
  try {
    const state = useProgramStore.getState();
    const overrides = state.dateOverrides ?? {};
    const contexts = state.overrideContexts ?? {};
    for (const date of Object.keys(overrides)) {
      m.set(date, { workout: overrides[date] ?? null, context: contexts[date] ?? null });
    }
  } catch { /* swallow */ }
  return m;
}
