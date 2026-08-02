import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorageCompat } from './asyncStorageCompat';
import { normalizeAcceptedKeyedMap } from './acceptedStateColdStart';
import { todayISOLocal } from '../utils/appDate';
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

/**
 * Calendar Store — Game Day Management
 *
 * Stores manually-set overrides by date:
 *   'game'   → explicit game (user added or moved here)
 *   'rest'   → user-forced rest day
 *   'noGame' → explicit no-fixture override. It suppresses the recurring
 *              in-season game or pre-season practice match that would
 *              otherwise render on profile.usualGameDay.
 *
 * During In-season, the resolver renders a VIRTUAL game on
 * profile.usualGameDay every week automatically, sourced from
 * profile (not this store). That virtual game is suppressed when:
 *   - any other day in that week has an explicit 'game' mark, or
 *   - the usualGameDay itself has a 'noGame' mark.
 *
 * Date keys are ISO strings: 'YYYY-MM-DD'
 */

export type CalendarDayType = 'game' | 'rest' | 'noGame';

/**
 * Compatibility projection for onboarding, legacy Coach/undo and hydration.
 * Live fixture add/move/remove UI is owned by FixtureMutationTransaction.
 */
function commitMark(
  date: string,
  mark: CalendarDayType | null,
  expectedCurrentMark?: CalendarDayType,
  todayISO?: string,
): void {
  // Dynamic loading keeps the accepted transaction owner above the legacy
  // compatibility mirror without creating a store-initialisation cycle.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('./acceptedStateTransaction').commitCalendarMarkTransaction({
    date,
    mark,
    expectedCurrentMark,
    todayISO,
  });
}

interface CalendarState {
  // Map of date string → day type
  markedDays: Record<string, CalendarDayType>;

  // Currently selected date (for modal interaction)
  selectedDate: string | null;

  // Actions
  /**
   * COMPATIBILITY-ONLY FIXTURE WRITE.
   * Live Home fixture UI must use FixtureMutationTransaction.
   */
  setGameDay: (date: string, todayISO?: string) => void;
  /**
   * COMPATIBILITY-ONLY FIXTURE WRITE.
   * Live Home fixture UI must use FixtureMutationTransaction.
   */
  removeGameDay: (date: string) => void;
  setRestDay: (date: string) => void;
  removeRestDay: (date: string) => void;
  /** COMPATIBILITY-ONLY fixture suppression write; not a live Home UI door. */
  setNoGame: (date: string) => void;
  /** COMPATIBILITY-ONLY fixture suppression write; not a live Home UI door. */
  removeNoGame: (date: string) => void;
  setSelectedDate: (date: string | null) => void;
  getGameDaysInRange: (startDate: string, endDate: string) => string[];
  getNextGameDay: (fromDate?: string) => string | null;
  /**
   * Wipe all 'game' and 'noGame' overrides (leaves 'rest' marks intact).
   * Used when leaving In-season so no stale game state survives.
   * COMPATIBILITY-ONLY phase-transition cleanup; not a live fixture-control
   * add/move/remove door.
   */
  clearAllGames: () => void;
  clear: () => void;
}

export const CALENDAR_PERSISTENCE_KEY = 'calendar-storage';

/**
 * THE STORE'S WRITER BOUNDARY, declared once (`docs/STORE_ARMOUR_RECIPE_
 * 2026-08-03.md`). A payload carries the athlete's material when at least one
 * mark survives in it. Unreadable bytes prove nothing and answer no.
 */
registerQuarantineBoundary(CALENDAR_PERSISTENCE_KEY, {
  carriesMaterial: (envelope) => {
    try {
      const state = (JSON.parse(envelope) as {
        state?: { markedDays?: Record<string, CalendarDayType> };
      }).state;
      return Object.keys(state?.markedDays ?? {}).length > 0;
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
export const calendarGuardedStorage = {
  getItem: (name: string): Promise<string | null> => asyncStorageCompat.getItem(name),
  setItem: async (name: string, value: string): Promise<void> => {
    const decision = decideQuarantinedWrite(name, value);
    if (!decision.allowed) {
      emitAthleteActionEvent(beginAthleteActionTrace({
        source: 'system',
        actionType: 'program_change',
        route: 'calendarGuardedStorage.setItem',
      }, undefined, { forceRoot: true }), 'persistence_result', {
        persistenceOperation: 'write',
        persistenceStore: name,
        persistenceSucceeded: false,
        originalRejectionCode: decision.reason,
        rejectingBoundary: 'calendarGuardedStorage.setItem.quarantine',
        failureCategory: 'persistence_failure',
      });
      logger.error('[calendarStore] refused to persist over a quarantined payload.',
        { store: name, reason: decision.reason });
      return;
    }
    releaseQuarantine(name);
    await asyncStorageCompat.setItem(name, value);
  },
  removeItem: (name: string): Promise<void> => asyncStorageCompat.removeItem(name),
};

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      markedDays: {},
      selectedDate: null,

      setGameDay: (date, todayISO) => commitMark(date, 'game', undefined, todayISO),

      removeGameDay: (date) => commitMark(date, null, 'game'),

      setRestDay: (date) => commitMark(date, 'rest'),

      removeRestDay: (date) => commitMark(date, null, 'rest'),

      setNoGame: (date) => commitMark(date, 'noGame'),

      removeNoGame: (date) => commitMark(date, null, 'noGame'),

      setSelectedDate: (date) => set({ selectedDate: date }),

      getGameDaysInRange: (startDate, endDate) => {
        const { markedDays } = get();
        return Object.entries(markedDays)
          .filter(([date, type]) => type === 'game' && date >= startDate && date <= endDate)
          .map(([date]) => date)
          .sort();
      },

      getNextGameDay: (fromDate) => {
        const { markedDays } = get();
        const from = fromDate || todayISOLocal();
        const gameDays = Object.entries(markedDays)
          .filter(([date, type]) => type === 'game' && date >= from)
          .map(([date]) => date)
          .sort();
        return gameDays[0] || null;
      },

      clearAllGames: () => {
        const current = get().markedDays;
        const updated: Record<string, CalendarDayType> = {};
        const affectedDates: string[] = [];
        for (const [date, type] of Object.entries(current)) {
          if (type === 'game' || type === 'noGame') {
            affectedDates.push(date);
            continue;
          }
          updated[date] = type;
        }
        if (affectedDates.length === 0) return;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitCalendarStateTransaction({
          reason: 'calendar:clear_all_games',
          markedDays: updated,
          affectedDates,
          fixtureChangedDates: affectedDates,
        });
      },

      clear: () => {
        const affectedDates = Object.keys(get().markedDays);
        if (affectedDates.length > 0) {
          // A reset is the one write that may erase marks, and it says so.
          // The act stays open across the transaction so the door's write —
          // which happens inside the commit — is admitted and named.
          const resetActionId = beginCalendarResetAction('calendar_store_clear');
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            require('./acceptedStateTransaction').commitCalendarStateTransaction({
              reason: 'calendar:clear',
              markedDays: {},
              affectedDates,
              fixtureChangedDates: affectedDates,
            });
          } finally {
            endCalendarResetAction(resetActionId);
          }
        }
        set({ selectedDate: null });
      },
    }),
    {
      name: CALENDAR_PERSISTENCE_KEY,
      storage: createJSONStorage(() => calendarGuardedStorage),
      partialize: (state) => ({ markedDays: state.markedDays }),
      merge: (persisted, current) => {
        const incoming = (persisted as Partial<CalendarState> | undefined) ?? {};
        return {
          ...current,
          ...incoming,
          markedDays: normalizeAcceptedKeyedMap<CalendarDayType>(incoming.markedDays),
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return;
        const affectedDates = Object.keys(state.markedDays);
        if (affectedDates.length === 0) return;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitCalendarStateTransaction({
          reason: 'calendar:hydration_acceptance',
          markedDays: state.markedDays,
          affectedDates,
          fixtureChangedDates: affectedDates.filter((date) =>
            state.markedDays[date] === 'game' || state.markedDays[date] === 'noGame'),
        });
      },
    }
  )
);

/* ══ THE CALENDAR WRITE OWNER ══
 *
 * The profile door's shape (`applyProfileOnboardingWrite`), applied by recipe
 * (`docs/STORE_ARMOUR_RECIPE_2026-08-03.md`):
 *
 *   1. ONE DOOR. Every write of `markedDays` goes through here — including
 *      the accepted-state transaction's publish and the coach-mutation
 *      rollback restore, which are two of its writers, not exceptions to it.
 *   2. THE DEFAULT IS NOT A VALUE. Writing the empty map over marks the
 *      athlete stated is refused, unless a reset action is IN FLIGHT. A
 *      REDUCED map is not the wipe — `clearAllGames` legitimately writes
 *      fewer marks, and refusing reduction would refuse the athlete.
 *   3. AN IN-FLIGHT RESET, NOT A RESET THAT HAPPENED. A stale id is refused.
 *      Writers inside a transaction may not know the act that opened them, so
 *      the door falls back to the act currently in flight — an id is still
 *      required to exist NOW, which is the property that matters.
 *   4. EVERYTHING IS ON THE TAPE. Applied or refused, every write names its
 *      writer and the mark counts either side. Counts only — a marked DATE is
 *      an answer, and answers never leave the device.
 */

export type CalendarWriterId =
  | 'accepted_transaction'
  | 'coach_mutation_mirror'
  | 'reset';

export interface CalendarWriteOutcome {
  ok: boolean;
  reason?: 'default_over_answered_marks' | 'reset_action_not_in_flight';
}

const resetActionsInFlight = new Set<string>();
let nextResetActionId = 1;

/**
 * Open a reset. The id is only good while the reset is running, which is what
 * makes a deferred write belonging to a finished reset refusable.
 */
export function beginCalendarResetAction(source: string): string {
  const id = `calendar-reset:${source}:${nextResetActionId++}`;
  resetActionsInFlight.add(id);
  return id;
}

export function endCalendarResetAction(id: string): void {
  resetActionsInFlight.delete(id);
}

/** The reset act currently in flight, if exactly one writer opened it. */
function activeCalendarResetActionId(): string | undefined {
  for (const id of resetActionsInFlight) return id;
  return undefined;
}

export function applyCalendarMarkedDaysWrite(args: {
  next: Record<string, CalendarDayType>;
  writer: CalendarWriterId;
  resetActionId?: string;
}): CalendarWriteOutcome {
  const markCountBefore = Object.keys(useCalendarStore.getState().markedDays).length;
  const record = (outcome: 'applied' | 'refused', reason?: string, resetActionId?: string) => {
    emitAthleteActionEvent(beginAthleteActionTrace({
      source: 'system',
      actionType: 'program_change',
      route: 'applyCalendarMarkedDaysWrite',
    }, undefined, { forceRoot: true }), 'calendar_write', {
      writer: args.writer,
      outcome,
      markCountBefore,
      markCountAfter: Object.keys(useCalendarStore.getState().markedDays).length,
      ...(reason ? { internalResultCode: reason } : {}),
      // `erasureActId`, not `resetActionId` — the diagnostics forbidden-key
      // filter drops any key containing "set" (recipe lesson 12).
      ...(resetActionId ? { erasureActId: resetActionId } : {}),
    });
  };

  const nextIsTheDefault = Object.keys(args.next).length === 0;
  const effectiveResetActionId = args.resetActionId ?? activeCalendarResetActionId();
  if (nextIsTheDefault && markCountBefore > 0) {
    if (!effectiveResetActionId) {
      quarantineDiskCopyBestEffort();
      record('refused', 'default_over_answered_marks');
      return { ok: false, reason: 'default_over_answered_marks' };
    }
    if (!resetActionsInFlight.has(effectiveResetActionId)) {
      quarantineDiskCopyBestEffort();
      record('refused', 'reset_action_not_in_flight');
      return { ok: false, reason: 'reset_action_not_in_flight' };
    }
  }

  useCalendarStore.setState({ markedDays: args.next });
  record('applied', undefined, effectiveResetActionId);
  return { ok: true };
}

/**
 * The DISK copy, not the in-memory one — memory survives a refusal by
 * construction; the envelope on disk is what a later writer can destroy.
 */
function quarantineDiskCopyBestEffort(): void {
  void asyncStorageCompat.getItem(CALENDAR_PERSISTENCE_KEY)
    .then((envelope) => quarantineRefusedPayload(CALENDAR_PERSISTENCE_KEY, envelope))
    .catch(() => {});
}
