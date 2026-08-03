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

export interface CoachNote {
  id: string;
  note: string;
  createdAt: string;
}

/**
 * Coach Memory Store — durable coach notes about THIS athlete.
 *
 * ARMOURED 2026-08-03 (`docs/STORE_ARMOUR_RECIPE_2026-08-03.md`, fleet wave
 * 2a): a note is extracted from what the athlete told the coach; losing the
 * notes silently un-tells the coach everything the athlete taught it. Every
 * write of `notes` goes through `applyCoachMemoryWrite` — one door, typed
 * refusals of the wipe shape, every writer on the tape, and a quarantine
 * boundary at the persistence writer. `coachMemoryOwnershipTests` fails the
 * build on a writer around the owner.
 *
 * LR-6: store-ownership work only. What the pipeline decides to remember is
 * unchanged.
 */
interface CoachMemoryState {
  notes: CoachNote[];
  addNote: (note: string) => void;
  removeNote: (id: string) => void;
  clearNotes: () => void;
}

export const COACH_MEMORY_PERSISTENCE_KEY = 'coach-memory-store';

/**
 * THE STORE'S WRITER BOUNDARY, declared once. A payload carries the athlete's
 * material when any note survives in it. Unreadable bytes prove nothing and
 * answer no.
 */
registerQuarantineBoundary(COACH_MEMORY_PERSISTENCE_KEY, {
  carriesMaterial: (envelope) => {
    try {
      const state = (JSON.parse(envelope) as { state?: { notes?: CoachNote[] } }).state;
      return !!state && (state.notes ?? []).length > 0;
    } catch {
      return false;
    }
  },
});

/**
 * The single persistence writer. A REFUSAL MUST NEVER PERSIST THE STATE IT
 * REFUSED INTO (Sam, 2026-07-30): while a refused material payload is held,
 * a bare payload does not travel; a material one always passes and releases
 * the hold. Exported for the ownership suite.
 */
export const coachMemoryGuardedStorage = {
  getItem: (name: string): Promise<string | null> => asyncStorageCompat.getItem(name),
  setItem: async (name: string, value: string): Promise<void> => {
    const decision = decideQuarantinedWrite(name, value);
    if (!decision.allowed) {
      emitAthleteActionEvent(beginAthleteActionTrace({
        source: 'system',
        actionType: 'program_change',
        route: 'coachMemoryGuardedStorage.setItem',
      }, undefined, { forceRoot: true }), 'persistence_result', {
        persistenceOperation: 'write',
        persistenceStore: name,
        persistenceSucceeded: false,
        originalRejectionCode: decision.reason,
        rejectingBoundary: 'coachMemoryGuardedStorage.setItem.quarantine',
        failureCategory: 'persistence_failure',
      });
      logger.error('[coachMemoryStore] refused to persist over a quarantined payload.',
        { store: name, reason: decision.reason });
      return;
    }
    releaseQuarantine(name);
    await asyncStorageCompat.setItem(name, value);
  },
  removeItem: (name: string): Promise<void> => asyncStorageCompat.removeItem(name),
};

export const useCoachMemoryStore = create<CoachMemoryState>()(
  persist(
    () => ({
      notes: [],

      // Every action is a thin builder of `next`; the door owns the write.

      addNote: (note: string) => {
        applyCoachMemoryWrite({
          next: [
            ...useCoachMemoryStore.getState().notes,
            {
              id: Date.now().toString(),
              note,
              createdAt: new Date().toISOString(),
            },
          ],
          writer: 'coach_screen',
        });
      },

      removeNote: (id: string) => {
        applyNotesRemovalThroughDoor({
          next: useCoachMemoryStore.getState().notes.filter((n) => n.id !== id),
          source: 'remove_note',
        });
      },

      clearNotes: () => {
        // A reset is the one write that may erase the notes, and it says so.
        const resetActionId = beginCoachMemoryResetAction('coach_memory_store_clear');
        try {
          applyCoachMemoryWrite({ next: [], writer: 'reset', resetActionId });
        } finally {
          endCoachMemoryResetAction(resetActionId);
        }
      },
    }),
    {
      name: COACH_MEMORY_PERSISTENCE_KEY,
      storage: createJSONStorage(() => coachMemoryGuardedStorage),
    },
  ),
);

/* ══ THE COACH MEMORY WRITE OWNER ══
 *
 * The profile door's shape, applied by recipe:
 *
 *   1. ONE DOOR. Every write of `notes` goes through here.
 *   2. THE DEFAULT IS NOT A VALUE. Writing the built-in empty default over
 *      notes the coach holds is refused, unless the write carries a reset
 *      action that is IN FLIGHT.
 *   3. AN IN-FLIGHT RESET, NOT A RESET THAT HAPPENED. A stale id is refused.
 *   4. EVERYTHING IS ON THE TAPE. Applied or refused, every write names its
 *      writer and the note counts either side. Counts and labels only, never
 *      answers — what the coach remembers stays on the device.
 */

export type CoachMemoryWriterId = 'coach_screen' | 'reset';

export interface CoachMemoryWriteOutcome {
  ok: boolean;
  reason?: 'default_over_answered_notes' | 'reset_action_not_in_flight';
}

const resetActionsInFlight = new Set<string>();
let nextResetActionId = 1;

/**
 * Open a reset. The id is only good while the reset is running, which is what
 * makes a deferred write belonging to a finished reset refusable.
 */
export function beginCoachMemoryResetAction(source: string): string {
  const id = `coach-memory-reset:${source}:${nextResetActionId++}`;
  resetActionsInFlight.add(id);
  return id;
}

export function endCoachMemoryResetAction(id: string): void {
  resetActionsInFlight.delete(id);
}

export function applyCoachMemoryWrite(args: {
  next: CoachNote[];
  writer: CoachMemoryWriterId;
  resetActionId?: string;
}): CoachMemoryWriteOutcome {
  const before = useCoachMemoryStore.getState().notes.length;
  const record = (outcome: 'applied' | 'refused', reason?: string) => {
    const after = useCoachMemoryStore.getState().notes.length;
    emitAthleteActionEvent(beginAthleteActionTrace({
      source: args.writer === 'coach_screen' ? 'tap' : 'system',
      actionType: 'program_change',
      route: 'applyCoachMemoryWrite',
    }, undefined, { forceRoot: true }), 'coach_memory_write', {
      writer: args.writer,
      outcome,
      noteCountBefore: before,
      noteCountAfter: after,
      ...(reason ? { internalResultCode: reason } : {}),
      // `erasureActId`, not `resetActionId`: the diagnostics forbidden-key
      // filter drops any key containing "set" (recipe lesson 12), so the
      // reset act's name must travel under a filter-safe key or not at all.
      ...(args.resetActionId ? { erasureActId: args.resetActionId } : {}),
    });
  };

  if (args.next.length === 0 && before > 0) {
    if (!args.resetActionId) {
      quarantineDiskCopyBestEffort();
      record('refused', 'default_over_answered_notes');
      return { ok: false, reason: 'default_over_answered_notes' };
    }
    if (!resetActionsInFlight.has(args.resetActionId)) {
      quarantineDiskCopyBestEffort();
      record('refused', 'reset_action_not_in_flight');
      return { ok: false, reason: 'reset_action_not_in_flight' };
    }
  }

  useCoachMemoryStore.setState({ notes: args.next });
  record('applied');
  return { ok: true };
}

/**
 * REMOVING THE LAST ANSWER IS THE ATHLETE'S CHANGE, NOT THE WIPE (recipe
 * lesson 11 — this store family is where the lesson was found). A remove
 * action whose result happens to be the empty default is an attributed
 * erasure; refusing it would strand the athlete with a note the coach cannot
 * forget. The action declares the erasure with its own named reset act, so it
 * lands AND says so on the tape — the refusal stays aimed at what it was
 * built for: an UNATTRIBUTED default write.
 */
function applyNotesRemovalThroughDoor(args: {
  next: CoachNote[];
  source: string;
}): void {
  if (args.next.length > 0) {
    applyCoachMemoryWrite({ next: args.next, writer: 'coach_screen' });
    return;
  }
  const resetActionId = beginCoachMemoryResetAction(args.source);
  try {
    applyCoachMemoryWrite({ next: args.next, writer: 'coach_screen', resetActionId });
  } finally {
    endCoachMemoryResetAction(resetActionId);
  }
}

/**
 * The DISK copy, not the in-memory one — memory survives a refusal by
 * construction; the envelope on disk is what a later writer can destroy.
 * Best-effort and async: a quarantine that crashed the refusal it protects
 * would be worse than no quarantine.
 */
function quarantineDiskCopyBestEffort(): void {
  void asyncStorageCompat.getItem(COACH_MEMORY_PERSISTENCE_KEY)
    .then((envelope) => quarantineRefusedPayload(COACH_MEMORY_PERSISTENCE_KEY, envelope))
    .catch(() => {});
}
