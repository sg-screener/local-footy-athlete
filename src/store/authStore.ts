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

/**
 * ARMOURED 2026-08-03 (`docs/STORE_ARMOUR_RECIPE_2026-08-03.md`, fleet tail).
 *
 * The material slice is SESSION IDENTITY — `user`, `session`,
 * `isAuthenticated`. Tokens are not training answers, but losing a login
 * strands the athlete outside their own data, so an unattributed write of the
 * signed-out default over a live session is exactly the wipe shape. Every
 * write of the slice goes through `applyAuthSessionWrite`; `signOut` is the
 * athlete's own erasure and declares itself with a named reset act (recipe
 * lesson 11) rather than being refused.
 *
 * TAPE PRIVACY IS ABSOLUTE HERE: the tape carries flags and counts only —
 * NEVER a token, an email, or an identity value. The ownership suite asserts
 * it with real-shaped values acted in.
 *
 * NOTE (recorded honestly): no product code currently writes this store —
 * `signOut`/`clear` are its only callers (resetCoach, dev seed) and no sign-in
 * flow exists yet. The armour makes the writes owned before that flow arrives;
 * whether the store should instead be retired is parked in
 * `docs/PARKED_QUESTIONS_2026-08-01.md`, not decided here.
 */
interface AuthState {
  user: { id: string; email: string } | null;
  session: { accessToken: string; refreshToken: string } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setUser: (user: AuthState['user']) => void;
  setSession: (session: AuthState['session']) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  signOut: () => void;
  clear: () => void;
}

/** The material slice — what an athlete would lose. */
export interface AuthSessionSlice {
  user: AuthState['user'];
  session: AuthState['session'];
  isAuthenticated: boolean;
}

/** The store's built-in signed-out default, exported for comparison. */
export const INITIAL_AUTH_SESSION: AuthSessionSlice = {
  user: null,
  session: null,
  isAuthenticated: false,
};

export const AUTH_STORE_PERSISTENCE_KEY = 'auth-store';

function currentSlice(): AuthSessionSlice {
  const state = useAuthStore.getState();
  return {
    user: state.user,
    session: state.session,
    isAuthenticated: state.isAuthenticated,
  };
}

function sliceIsMaterial(slice: {
  user?: AuthSessionSlice['user'];
  session?: AuthSessionSlice['session'];
} | null | undefined): boolean {
  if (!slice) return false;
  return !!slice.user?.id
    || !!slice.session?.accessToken
    || !!slice.session?.refreshToken;
}

/**
 * THE STORE'S WRITER BOUNDARY, declared once. A payload carries the athlete's
 * material when a session token or a user identity survives in it — the login
 * whose silent loss would strand them. Unreadable bytes prove nothing.
 */
registerQuarantineBoundary(AUTH_STORE_PERSISTENCE_KEY, {
  carriesMaterial: (envelope) => {
    try {
      const state = (JSON.parse(envelope) as { state?: {
        user?: AuthSessionSlice['user'];
        session?: AuthSessionSlice['session'];
      } }).state;
      return sliceIsMaterial(state);
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
export const authGuardedStorage = {
  getItem: (name: string): Promise<string | null> => asyncStorageCompat.getItem(name),
  setItem: async (name: string, value: string): Promise<void> => {
    const decision = decideQuarantinedWrite(name, value);
    if (!decision.allowed) {
      emitAthleteActionEvent(beginAthleteActionTrace({
        source: 'system',
        actionType: 'program_change',
        route: 'authGuardedStorage.setItem',
      }, undefined, { forceRoot: true }), 'persistence_result', {
        persistenceOperation: 'write',
        persistenceStore: name,
        persistenceSucceeded: false,
        originalRejectionCode: decision.reason,
        rejectingBoundary: 'authGuardedStorage.setItem.quarantine',
        failureCategory: 'persistence_failure',
      });
      logger.error('[authStore] refused to persist over a quarantined payload.',
        { store: name, reason: decision.reason });
      return;
    }
    releaseQuarantine(name);
    await asyncStorageCompat.setItem(name, value);
  },
  removeItem: (name: string): Promise<void> => asyncStorageCompat.removeItem(name),
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Every action is a thin builder of `next`; the door owns the write.
      // A future sign-in flow that tears a session down field-by-field will
      // be refused at the last field — deliberately: sign-out has a name.

      setUser: (user) => {
        applyAuthSessionWrite({
          next: { ...currentSlice(), user },
          writer: 'auth_flow',
        });
      },

      setSession: (session) => {
        applyAuthSessionWrite({
          next: { ...currentSlice(), session },
          writer: 'auth_flow',
        });
      },

      setAuthenticated: (authenticated) => {
        applyAuthSessionWrite({
          next: { ...currentSlice(), isAuthenticated: authenticated },
          writer: 'auth_flow',
        });
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      signOut: () => {
        // The athlete's own erasure, and it says so (recipe lesson 11):
        // refusing a sign-out would strand them signed in on a shared device.
        const resetActionId = beginAuthResetAction('sign_out');
        try {
          applyAuthSessionWrite({
            next: INITIAL_AUTH_SESSION,
            writer: 'sign_out',
            resetActionId,
          });
        } finally {
          endAuthResetAction(resetActionId);
        }
        set({ error: null });
      },

      clear: () => {
        // A reset is the one write that may erase the session, and it says so.
        const resetActionId = beginAuthResetAction('auth_store_clear');
        try {
          applyAuthSessionWrite({
            next: INITIAL_AUTH_SESSION,
            writer: 'reset',
            resetActionId,
          });
        } finally {
          endAuthResetAction(resetActionId);
        }
        set({ isLoading: false, error: null });
      },
    }),
    {
      name: AUTH_STORE_PERSISTENCE_KEY,
      storage: createJSONStorage(() => authGuardedStorage),
    },
  ),
);

/* ══ THE AUTH SESSION WRITE OWNER ══
 *
 * The profile door's shape, applied by recipe:
 *
 *   1. ONE DOOR. Every write of `user`/`session`/`isAuthenticated` goes
 *      through here. `isLoading`/`error` are UI state and keep their plain
 *      `set` — the sweep asserts those sets never carry the slice.
 *   2. THE DEFAULT IS NOT A VALUE. Writing the signed-out default over a live
 *      session is refused, unless the write carries a reset action that is
 *      IN FLIGHT (a sign-out, or the full app reset).
 *   3. AN IN-FLIGHT RESET, NOT A RESET THAT HAPPENED. A stale id is refused.
 *   4. EVERYTHING IS ON THE TAPE — as FLAGS. `hadUser`, `hadSession`,
 *      `authenticated` either side; never a token, an email, or an id. The
 *      reset act's name travels as `erasureActId` (recipe lesson 12 — the
 *      diagnostics filter eats any key containing "set").
 */

export type AuthWriterId = 'auth_flow' | 'sign_out' | 'reset' | 'dev_seed';

export interface AuthSessionWriteOutcome {
  ok: boolean;
  reason?: 'default_over_answered_session' | 'reset_action_not_in_flight';
}

const resetActionsInFlight = new Set<string>();
let nextResetActionId = 1;

/**
 * Open a reset. The id is only good while the reset is running, which is what
 * makes a deferred write belonging to a finished reset refusable.
 */
export function beginAuthResetAction(source: string): string {
  const id = `auth-reset:${source}:${nextResetActionId++}`;
  resetActionsInFlight.add(id);
  return id;
}

export function endAuthResetAction(id: string): void {
  resetActionsInFlight.delete(id);
}

function isTheBuiltInDefault(slice: AuthSessionSlice): boolean {
  return slice.user === null && slice.session === null && !slice.isAuthenticated;
}

export function applyAuthSessionWrite(args: {
  next: AuthSessionSlice;
  writer: AuthWriterId;
  resetActionId?: string;
}): AuthSessionWriteOutcome {
  const before = currentSlice();
  const record = (outcome: 'applied' | 'refused', reason?: string) => {
    const after = currentSlice();
    emitAthleteActionEvent(beginAthleteActionTrace({
      // Sign-out is the athlete's own tap; everything else is flow machinery.
      source: args.writer === 'sign_out' ? 'tap' : 'system',
      actionType: 'program_change',
      route: 'applyAuthSessionWrite',
    }, undefined, { forceRoot: true }), 'auth_write', {
      writer: args.writer,
      outcome,
      // FLAGS ONLY — a token, an email and an id are identity values and
      // never travel. The ownership suite asserts this with real values.
      hadUserBefore: !!before.user,
      hadUserAfter: !!after.user,
      hadSessionBefore: !!before.session,
      hadSessionAfter: !!after.session,
      authenticatedBefore: before.isAuthenticated,
      authenticatedAfter: after.isAuthenticated,
      ...(reason ? { internalResultCode: reason } : {}),
      // `erasureActId`, not `resetActionId` (recipe lesson 12).
      ...(args.resetActionId ? { erasureActId: args.resetActionId } : {}),
    });
  };

  if (isTheBuiltInDefault(args.next) && sliceIsMaterial(before)) {
    if (!args.resetActionId) {
      quarantineDiskCopyBestEffort();
      record('refused', 'default_over_answered_session');
      return { ok: false, reason: 'default_over_answered_session' };
    }
    if (!resetActionsInFlight.has(args.resetActionId)) {
      quarantineDiskCopyBestEffort();
      record('refused', 'reset_action_not_in_flight');
      return { ok: false, reason: 'reset_action_not_in_flight' };
    }
  }

  useAuthStore.setState({
    user: args.next.user,
    session: args.next.session,
    isAuthenticated: args.next.isAuthenticated,
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
  void asyncStorageCompat.getItem(AUTH_STORE_PERSISTENCE_KEY)
    .then((envelope) => quarantineRefusedPayload(AUTH_STORE_PERSISTENCE_KEY, envelope))
    .catch(() => {});
}
