import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CoachConversation, CoachMessage } from '../types/domain';
import { asyncStorageCompat } from './asyncStorageCompat';
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
 * Coach Store — the athlete's chat history with the coach.
 *
 * ARMOURED 2026-08-03 (`docs/STORE_ARMOUR_RECIPE_2026-08-03.md`, fleet wave
 * 2a): the messages are the athlete's own words and the coach's replies
 * explaining why their week changed; they are restored across relaunches and
 * AGENTS.md names recent chat as a follow-up target-resolution input. Every
 * write of the material slice (`conversations`, `messages`) goes through
 * `applyCoachStoreWrite` — one door, typed refusals of the wipe shape, every
 * writer on the tape, and a quarantine boundary at the persistence writer.
 * `coachStoreOwnershipTests` fails the build on a writer around the owner.
 *
 * LR-6: store-ownership work only. What any coach path DOES is unchanged.
 *
 * `activeConversation` is a navigation RIDER — a pointer holding a copy of one
 * conversation whose originals live in the material slices. It travels through
 * the door so `setActiveConversation` stays one write, but never counts toward
 * the wipe decision. `isStreaming` / `isLoading` / `error` are UI-only and
 * keep their plain `set`.
 */
interface CoachState {
  conversations: CoachConversation[];
  activeConversation: CoachConversation | null;
  messages: CoachMessage[];
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  setConversations: (conversations: CoachConversation[]) => void;
  setActiveConversation: (conversation: CoachConversation | null) => void;
  setMessages: (messages: CoachMessage[]) => void;
  addMessage: (message: CoachMessage) => void;
  setStreaming: (streaming: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const COACH_STORE_PERSISTENCE_KEY = 'coach-store';

/**
 * THE STORE'S WRITER BOUNDARY, declared once. A payload carries the athlete's
 * material when any of the chat survives in it — one message, or one
 * conversation. Unreadable bytes prove nothing and answer no.
 */
registerQuarantineBoundary(COACH_STORE_PERSISTENCE_KEY, {
  carriesMaterial: (envelope) => {
    try {
      const state = (JSON.parse(envelope) as {
        state?: { conversations?: CoachConversation[]; messages?: CoachMessage[] };
      }).state;
      return !!state
        && ((state.conversations ?? []).length > 0 || (state.messages ?? []).length > 0);
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
export const coachStoreGuardedStorage = {
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
          route: 'coachStoreGuardedStorage.setItem',
        }, undefined, { forceRoot: true }), 'persistence_result', {
          persistenceOperation: 'write',
          persistenceStore: name,
          persistenceSucceeded: false,
          originalRejectionCode: reason,
          rejectingBoundary: 'coachStoreGuardedStorage.setItem.quarantine',
          failureCategory: 'persistence_failure',
        });
        logger.error('[coachStore] refused to persist over a quarantined payload.',
          { store: name, reason: reason });
      },
    }),
  removeItem: (name: string): Promise<void> => asyncStorageCompat.removeItem(name),
};

export const useCoachStore = create<CoachState>()(
  persist(
    (set) => ({
      conversations: [],
      activeConversation: null,
      messages: [],
      isStreaming: false,
      isLoading: false,
      error: null,

      // Every material action is a thin builder of `next`; the door owns the
      // write. UI-only flags keep their plain `set`.

      setConversations: (conversations) => {
        applyCoachStoreWrite({ next: { conversations }, writer: 'coach_screen' });
      },

      setActiveConversation: (conversation) => {
        applyCoachStoreWrite({
          next: {
            activeConversation: conversation,
            messages: conversation?.messages || [],
          },
          writer: 'coach_screen',
        });
      },

      setMessages: (messages) => {
        applyCoachStoreWrite({ next: { messages }, writer: 'coach_screen' });
      },

      addMessage: (message) => {
        applyCoachStoreWrite({
          next: { messages: [...useCoachStore.getState().messages, message] },
          writer: 'coach_screen',
        });
      },

      setStreaming: (streaming) => set({ isStreaming: streaming }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      clear: () => {
        // A reset is the one write that may erase the chat, and it says so.
        const resetActionId = beginCoachStoreResetAction('coach_store_clear');
        try {
          applyCoachStoreWrite({
            next: { conversations: [], activeConversation: null, messages: [] },
            writer: 'reset',
            resetActionId,
          });
        } finally {
          endCoachStoreResetAction(resetActionId);
        }
        set({ isStreaming: false, isLoading: false, error: null });
      },
    }),
    {
      name: COACH_STORE_PERSISTENCE_KEY,
      storage: createJSONStorage(() => coachStoreGuardedStorage),
    },
  ),
);

/* ══ THE COACH CHAT WRITE OWNER ══
 *
 * The profile door's shape, applied by recipe:
 *
 *   1. ONE DOOR. Every write of `conversations` / `messages` goes through here
 *      (`activeConversation` rides along, never deciding anything).
 *   2. THE DEFAULT IS NOT A VALUE. Writing the built-in empty default over a
 *      chat that holds messages is refused, unless the write carries a reset
 *      action that is IN FLIGHT.
 *   3. AN IN-FLIGHT RESET, NOT A RESET THAT HAPPENED. A stale id is refused.
 *   4. EVERYTHING IS ON THE TAPE. Applied or refused, every write names its
 *      writer and the material counts either side. Counts and labels only,
 *      never answers — the athlete's words stay on the device.
 */

export type CoachStoreWriterId = 'coach_screen' | 'reset';

export interface CoachStoreWriteOutcome {
  ok: boolean;
  reason?: 'default_over_answered_chat' | 'reset_action_not_in_flight';
}

/** A patch write: only the keys present travel (the coach-updates lesson). */
export interface CoachStoreMaterialPatch {
  conversations?: CoachConversation[];
  messages?: CoachMessage[];
  activeConversation?: CoachConversation | null;
}

const resetActionsInFlight = new Set<string>();
let nextResetActionId = 1;

/**
 * Open a reset. The id is only good while the reset is running, which is what
 * makes a deferred write belonging to a finished reset refusable.
 */
export function beginCoachStoreResetAction(source: string): string {
  const id = `coach-store-reset:${source}:${nextResetActionId++}`;
  resetActionsInFlight.add(id);
  return id;
}

export function endCoachStoreResetAction(id: string): void {
  resetActionsInFlight.delete(id);
}

function materialCounts(state: {
  conversations: CoachConversation[]; messages: CoachMessage[];
}): { conversations: number; messages: number } {
  return {
    conversations: state.conversations.length,
    messages: state.messages.length,
  };
}

export function applyCoachStoreWrite(args: {
  next: CoachStoreMaterialPatch;
  writer: CoachStoreWriterId;
  resetActionId?: string;
}): CoachStoreWriteOutcome {
  const current = useCoachStore.getState();
  const before = materialCounts(current);
  const record = (outcome: 'applied' | 'refused', reason?: string) => {
    const after = materialCounts(useCoachStore.getState());
    emitAthleteActionEvent(beginAthleteActionTrace({
      source: args.writer === 'coach_screen' ? 'tap' : 'system',
      actionType: 'program_change',
      route: 'applyCoachStoreWrite',
    }, undefined, { forceRoot: true }), 'coach_store_write', {
      writer: args.writer,
      outcome,
      conversationCountBefore: before.conversations,
      conversationCountAfter: after.conversations,
      messageCountBefore: before.messages,
      messageCountAfter: after.messages,
      ...(reason ? { internalResultCode: reason } : {}),
      // `erasureActId`, not `resetActionId`: the diagnostics forbidden-key
      // filter drops any key containing "set" (recipe lesson 12), so the
      // reset act's name must travel under a filter-safe key or not at all.
      ...(args.resetActionId ? { erasureActId: args.resetActionId } : {}),
    });
  };

  // The effective material state this patch would leave behind.
  const effective = {
    conversations: args.next.conversations ?? current.conversations,
    messages: args.next.messages ?? current.messages,
  };
  const beforeIsMaterial = before.conversations + before.messages > 0;
  const nextIsTheDefault =
    effective.conversations.length === 0 && effective.messages.length === 0;
  if (nextIsTheDefault && beforeIsMaterial) {
    if (!args.resetActionId) {
      quarantineDiskCopyBestEffort();
      record('refused', 'default_over_answered_chat');
      return { ok: false, reason: 'default_over_answered_chat' };
    }
    if (!resetActionsInFlight.has(args.resetActionId)) {
      quarantineDiskCopyBestEffort();
      record('refused', 'reset_action_not_in_flight');
      return { ok: false, reason: 'reset_action_not_in_flight' };
    }
  }

  useCoachStore.setState({
    ...(args.next.conversations !== undefined
      ? { conversations: args.next.conversations } : {}),
    ...(args.next.messages !== undefined ? { messages: args.next.messages } : {}),
    ...(args.next.activeConversation !== undefined
      ? { activeConversation: args.next.activeConversation } : {}),
  });
  record('applied');
  return { ok: true };
}

/**
 * The DISK copy, not the in-memory one — memory survives a refusal by
 * construction; the envelope on disk is what a later writer can destroy.
 * Best-effort and async: a quarantine that crashed the refusal it protects
 * would be worse than no quarantine.
 */
function quarantineDiskCopyBestEffort(): void {
  void asyncStorageCompat.getItem(COACH_STORE_PERSISTENCE_KEY)
    .then((envelope) => quarantineRefusedPayload(COACH_STORE_PERSISTENCE_KEY, envelope))
    .catch(() => {});
}
