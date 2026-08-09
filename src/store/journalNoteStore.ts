import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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
 * THE JOURNAL'S FREE NOTES — the athlete's own words about a week.
 *
 * THE ONE THING THIS STORE IS, AND THE ONE THING IT IS NOT. A note is an
 * ANSWER: the athlete typed it, so it is an input and the north star allows it.
 * A note NEVER derives program state — no constraint composition, no influence
 * on generation, repair or placement. That is the Journal design's
 * non-negotiable, and it is a structural claim this file can keep because
 * nothing here exports anything a resolver could read: the store holds text and
 * tags, and the only consumer is the Journal surface.
 *
 * WHY ITS OWN STORE, rather than riding `SessionFeedback` like the post-game
 * rating will. A note is per-WEEK and arrives from the Monday card; a session
 * outcome is per-DAY and arrives from the completion flow. Different key,
 * different moment, different door. Putting a weekly fact on a daily record
 * would be the two-owners-of-one-fact shape the north star names.
 *
 * ARMOURED AT BIRTH (`docs/STORE_ARMOUR_RECIPE_2026-08-03.md`), not later:
 * every write of `notes` goes through `applyJournalNoteWrite`, typed refusals
 * of the wipe shape, every writer on the tape, a quarantine boundary at the
 * persistence writer. The recipe's own lesson is that a store retro-fitted with
 * armour has already had time to grow writers around the door.
 */

/**
 * THE TAG VOCABULARY — the base design's five plus the addendum's three, all
 * selected under Sam's full-scope ruling ("I want it all in the journal").
 *
 * A CLOSED UNION ON PURPOSE. Free-text tags would be a second, unauthored
 * vocabulary growing on the athlete's device, and the Journal's whole copy
 * discipline is that words are authored. The NOTE is free text; the TAGS are
 * not.
 */
export const JOURNAL_NOTE_TAGS = [
  'recovery',
  'mobility',
  'injury',
  'diet',
  'work_stress',
  'sleep',
  'illness',
  'travel',
] as const;

export type JournalNoteTag = typeof JOURNAL_NOTE_TAGS[number];

export function parseJournalNoteTag(value: unknown): JournalNoteTag | null {
  return typeof value === 'string' && (JOURNAL_NOTE_TAGS as readonly string[]).includes(value)
    ? value as JournalNoteTag
    : null;
}

export interface JournalNote {
  /** Stable id, minted by the door — never by a surface. */
  readonly id: string;
  /** The Monday of the week this note is about. */
  readonly weekStart: string;
  /** The athlete's own words. Free text, recorded, never parsed for meaning. */
  readonly text: string;
  readonly tags: readonly JournalNoteTag[];
  /** ISO datetime the note was recorded. */
  readonly createdAt: string;
}

interface JournalNoteState {
  notes: readonly JournalNote[];
  clear: () => void;
}

const initialNotes: readonly JournalNote[] = [];

/** The store's built-in default, exported so writers can compare against it. */
export const INITIAL_JOURNAL_NOTES: readonly JournalNote[] = initialNotes;

export const JOURNAL_NOTE_PERSISTENCE_KEY = 'journal-note-store';

export function getJournalNotes(): readonly JournalNote[] {
  return useJournalNoteStore.getState().notes;
}

/** Every note the athlete wrote about one week, newest first. */
export function journalNotesForWeek(weekStart: string): readonly JournalNote[] {
  return getJournalNotes()
    .filter((note) => note.weekStart === weekStart)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** How many distinct weeks carry a note — a read, never a stored counter. */
export function journalNoteWeekCount(): number {
  return new Set(getJournalNotes().map((note) => note.weekStart)).size;
}

/**
 * THE STORE'S WRITER BOUNDARY. A payload carries the athlete's material when
 * any note survives in it. Unreadable bytes prove nothing and answer no.
 */
registerQuarantineBoundary(JOURNAL_NOTE_PERSISTENCE_KEY, {
  carriesMaterial: (envelope) => {
    try {
      const state = (JSON.parse(envelope) as { state?: { notes?: unknown[] } }).state;
      return Array.isArray(state?.notes) && state.notes.length > 0;
    } catch {
      return false;
    }
  },
});

/**
 * The single persistence writer. A REFUSAL MUST NEVER PERSIST THE STATE IT
 * REFUSED INTO (Sam, 2026-07-30): while a refused material payload is held, a
 * bare payload does not travel; a material one always passes and releases it.
 */
export const journalNoteGuardedStorage = {
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
          route: 'journalNoteGuardedStorage.setItem',
        }, undefined, { forceRoot: true }), 'persistence_result', {
          persistenceOperation: 'write',
          persistenceStore: name,
          persistenceSucceeded: false,
          originalRejectionCode: reason,
          rejectingBoundary: 'journalNoteGuardedStorage.setItem.quarantine',
          failureCategory: 'persistence_failure',
        });
        logger.error('[journalNoteStore] refused to persist over a quarantined payload.',
          { store: name, reason });
      },
    }),
  removeItem: (name: string): Promise<void> => asyncStorageCompat.removeItem(name),
};

export const useJournalNoteStore = create<JournalNoteState>()(
  persist(
    () => ({
      notes: initialNotes,

      clear: () => {
        // A reset is the one write that may erase answers, and it says so.
        const resetActionId = beginJournalNoteResetAction('journal_note_store_clear');
        try {
          applyJournalNoteWrite({
            next: initialNotes,
            writer: 'reset',
            resetActionId,
          });
        } finally {
          endJournalNoteResetAction(resetActionId);
        }
      },
    }),
    {
      name: JOURNAL_NOTE_PERSISTENCE_KEY,
      storage: createJSONStorage(() => journalNoteGuardedStorage),
    },
  ),
);

/* ══ THE NOTE WRITE OWNER ══
 *
 * The recipe's door, applied:
 *   1. ONE DOOR. Every write of `notes` goes through here.
 *   2. THE DEFAULT IS NOT A VALUE. Emptying notes that hold answers is refused
 *      unless the write carries a reset action that is IN FLIGHT.
 *   3. AN IN-FLIGHT RESET, NOT A RESET THAT HAPPENED. A stale id is refused.
 *   4. EVERYTHING IS ON THE TAPE — applied or refused, writer named, material
 *      COUNTS either side. Counts and labels only: the note's TEXT is the
 *      athlete's answer and never leaves the device on a diagnostic.
 */

export type JournalNoteWriterId =
  | 'journal_note_control'
  | 'reset'
  | 'dev_seed';

export interface JournalNoteWriteOutcome {
  ok: boolean;
  reason?: 'default_over_answered_notes' | 'reset_action_not_in_flight';
}

const resetActionsInFlight = new Set<string>();
let nextResetActionId = 1;

export function beginJournalNoteResetAction(source: string): string {
  const id = `journal-note-reset:${source}:${nextResetActionId++}`;
  resetActionsInFlight.add(id);
  return id;
}

export function endJournalNoteResetAction(id: string): void {
  resetActionsInFlight.delete(id);
}

export function applyJournalNoteWrite(args: {
  next: readonly JournalNote[];
  writer: JournalNoteWriterId;
  resetActionId?: string;
}): JournalNoteWriteOutcome {
  const before = useJournalNoteStore.getState().notes.length;
  const record = (outcome: 'applied' | 'refused', reason?: string) => {
    const after = useJournalNoteStore.getState().notes.length;
    emitAthleteActionEvent(beginAthleteActionTrace({
      source: args.writer === 'journal_note_control' ? 'tap' : 'system',
      actionType: 'program_change',
      route: 'applyJournalNoteWrite',
    }, undefined, { forceRoot: true }), 'journal_note_write', {
      writer: args.writer,
      outcome,
      noteCountBefore: before,
      noteCountAfter: after,
      ...(reason ? { internalResultCode: reason } : {}),
      // `erasureActId`, not `resetActionId`: the diagnostics forbidden-key
      // filter drops any key containing "set" (recipe lesson 12).
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

  useJournalNoteStore.setState({ notes: args.next });
  record('applied');
  return { ok: true };
}

/**
 * THE ATHLETE'S DOOR — record one note about one week.
 *
 * Returns the outcome rather than throwing, because a surface that cannot show
 * a refusal is a surface that pretends. Empty or whitespace-only text is
 * refused BEFORE the door: a blank note is not an answer, and recording one
 * would put an empty row in front of the athlete forever.
 */
export function recordJournalNote(args: {
  weekStart: string;
  text: string;
  tags: readonly JournalNoteTag[];
  nowISO: string;
}): JournalNoteWriteOutcome & { note?: JournalNote } {
  const text = args.text.trim();
  if (text.length === 0) return { ok: false };

  const current = getJournalNotes();
  const note: JournalNote = {
    // The DOOR mints the id, never a surface — one owner of identity.
    id: `journal-note:${args.weekStart}:${args.nowISO}:${current.length + 1}`,
    weekStart: args.weekStart,
    text,
    // Deduped and vocabulary-checked here, so a surface cannot introduce a tag.
    tags: Array.from(new Set(args.tags)).filter((tag) => parseJournalNoteTag(tag) !== null),
    createdAt: args.nowISO,
  };
  const outcome = applyJournalNoteWrite({
    next: [...current, note],
    writer: 'journal_note_control',
  });
  return outcome.ok ? { ...outcome, note } : outcome;
}

/**
 * REMOVING THE LAST NOTE IS THE ATHLETE'S CHANGE, NOT THE WIPE (recipe lesson
 * 11). An attributed removal that happens to empty the store declares its own
 * reset act, so it lands AND says so on the tape; the refusal stays aimed at an
 * UNATTRIBUTED default write.
 */
export function removeJournalNote(id: string): JournalNoteWriteOutcome {
  const next = getJournalNotes().filter((note) => note.id !== id);
  if (next.length > 0) {
    return applyJournalNoteWrite({ next, writer: 'journal_note_control' });
  }
  const resetActionId = beginJournalNoteResetAction('remove_last_note');
  try {
    return applyJournalNoteWrite({ next, writer: 'journal_note_control', resetActionId });
  } finally {
    endJournalNoteResetAction(resetActionId);
  }
}

/**
 * The DISK copy, not the in-memory one — memory survives a refusal by
 * construction; the envelope on disk is what a later writer can destroy.
 */
function quarantineDiskCopyBestEffort(): void {
  void asyncStorageCompat.getItem(JOURNAL_NOTE_PERSISTENCE_KEY)
    .then((envelope) => quarantineRefusedPayload(JOURNAL_NOTE_PERSISTENCE_KEY, envelope))
    .catch(() => {});
}
