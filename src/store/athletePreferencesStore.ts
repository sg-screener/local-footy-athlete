import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AthletePoolPrefs } from '../data/exercisePoolsStrength';
import type { InjuryKey } from '../data/exerciseTags';
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
 * Athlete Preferences Store — Per-athlete pool overrides.
 *
 * Kept separate from `profileStore` because these fields mutate more often
 * than profile basics (name, email, training location) — an athlete might
 * flag an active injury week-to-week, exclude a hated exercise after a single
 * bad experience, or pin a favourite that becomes a staple. Profile basics
 * get set at onboarding and rarely change.
 *
 * The prefs fold into pool rotation via `buildWorkoutsFromCoach`'s optional
 * 6th arg. Empty defaults are a complete no-op through the rotation pipeline.
 *
 * ARMOURED 2026-08-03 (`docs/STORE_ARMOUR_RECIPE_2026-08-03.md`): exclusions,
 * pins and active injuries are answers the athlete gave, so every write of
 * `prefs` goes through `applyAthletePrefsWrite` — one door, typed refusals of
 * the wipe shape, every writer on the tape, and a quarantine boundary at the
 * persistence writer. `athletePreferencesOwnershipTests` fails the build on a
 * writer around the owner.
 *
 * Shape mirrors the rest of the app's single-athlete store pattern (one
 * active user at a time). Multi-athlete support would re-key every store
 * in parallel.
 */
interface AthletePreferencesState {
  prefs: AthletePoolPrefs;

  // ─── Exclusion (hard exclude) ───
  addExclusion: (exerciseName: string) => void;
  removeExclusion: (exerciseName: string) => void;

  // ─── Pinning (rotation bias) ───
  addPinned: (exerciseName: string) => void;
  removePinned: (exerciseName: string) => void;

  // ─── Active injury filter ───
  setActiveInjuries: (keys: readonly InjuryKey[]) => void;
  addActiveInjury: (key: InjuryKey) => void;
  removeActiveInjury: (key: InjuryKey) => void;

  clear: () => void;
}

/** Default — empty prefs mean a pure no-op through the rotation pipeline. */
const initialPrefs: AthletePoolPrefs = {
  excluded: [],
  pinned: [],
};

/** The store's built-in default, exported so writers can be compared against it. */
export const INITIAL_ATHLETE_PREFS: AthletePoolPrefs = initialPrefs;

export const ATHLETE_PREFS_PERSISTENCE_KEY = 'athlete-preferences-store';

/**
 * Read current prefs with a guaranteed-non-null default. Callers that pass
 * prefs to `buildWorkoutsFromCoach` should use this rather than reading the
 * store directly, so the call site never has to branch on undefined.
 */
export function getAthletePrefs(): AthletePoolPrefs {
  return useAthletePreferencesStore.getState().prefs;
}

/**
 * THE STORE'S WRITER BOUNDARY, declared once. A payload carries the athlete's
 * material when any answer survives in it — one exclusion, one pin, one
 * active injury. Unreadable bytes prove nothing and answer no.
 */
registerQuarantineBoundary(ATHLETE_PREFS_PERSISTENCE_KEY, {
  carriesMaterial: (envelope) => {
    try {
      const state = (JSON.parse(envelope) as { state?: { prefs?: AthletePoolPrefs } }).state;
      const prefs = state?.prefs;
      return !!prefs && (prefs.excluded.length > 0 || prefs.pinned.length > 0
        || (prefs.activeInjuries ?? []).length > 0);
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
export const athletePrefsGuardedStorage = {
  getItem: (name: string): Promise<string | null> => asyncStorageCompat.getItem(name),
  setItem: async (name: string, value: string): Promise<void> => {
    const decision = decideQuarantinedWrite(name, value);
    if (!decision.allowed) {
      emitAthleteActionEvent(beginAthleteActionTrace({
        source: 'system',
        actionType: 'program_change',
        route: 'athletePrefsGuardedStorage.setItem',
      }, undefined, { forceRoot: true }), 'persistence_result', {
        persistenceOperation: 'write',
        persistenceStore: name,
        persistenceSucceeded: false,
        originalRejectionCode: decision.reason,
        rejectingBoundary: 'athletePrefsGuardedStorage.setItem.quarantine',
        failureCategory: 'persistence_failure',
      });
      logger.error('[athletePreferencesStore] refused to persist over a quarantined payload.',
        { store: name, reason: decision.reason });
      return;
    }
    releaseQuarantine(name);
    await asyncStorageCompat.setItem(name, value);
  },
  removeItem: (name: string): Promise<void> => asyncStorageCompat.removeItem(name),
};

export const useAthletePreferencesStore = create<AthletePreferencesState>()(
  persist(
    () => ({
      prefs: initialPrefs,

      // Every action is a thin builder of `next`; the door owns the write.

      addExclusion: (exerciseName) => {
        const prefs = getAthletePrefs();
        if (prefs.excluded.includes(exerciseName)) return;
        applyAthletePrefsWrite({
          next: { ...prefs, excluded: [...prefs.excluded, exerciseName] },
          writer: 'preference_control',
        });
      },

      removeExclusion: (exerciseName) => {
        const prefs = getAthletePrefs();
        applyAthletePrefsWrite({
          next: { ...prefs, excluded: prefs.excluded.filter((n) => n !== exerciseName) },
          writer: 'preference_control',
        });
      },

      addPinned: (exerciseName) => {
        const prefs = getAthletePrefs();
        if (prefs.pinned.includes(exerciseName)) return;
        applyAthletePrefsWrite({
          next: { ...prefs, pinned: [...prefs.pinned, exerciseName] },
          writer: 'preference_control',
        });
      },

      removePinned: (exerciseName) => {
        const prefs = getAthletePrefs();
        applyAthletePrefsWrite({
          next: { ...prefs, pinned: prefs.pinned.filter((n) => n !== exerciseName) },
          writer: 'preference_control',
        });
      },

      setActiveInjuries: (keys) => {
        const prefs = getAthletePrefs();
        applyAthletePrefsWrite({
          next: { ...prefs, activeInjuries: [...keys] },
          writer: 'preference_control',
        });
      },

      addActiveInjury: (key) => {
        const prefs = getAthletePrefs();
        const current = prefs.activeInjuries ?? [];
        if (current.includes(key)) return;
        applyAthletePrefsWrite({
          next: { ...prefs, activeInjuries: [...current, key] },
          writer: 'preference_control',
        });
      },

      removeActiveInjury: (key) => {
        const prefs = getAthletePrefs();
        const current = prefs.activeInjuries ?? [];
        applyAthletePrefsWrite({
          next: { ...prefs, activeInjuries: current.filter((k) => k !== key) },
          writer: 'preference_control',
        });
      },

      clear: () => {
        // A reset is the one write that may erase answers, and it says so.
        const resetActionId = beginAthletePrefsResetAction('athlete_prefs_store_clear');
        try {
          applyAthletePrefsWrite({
            next: initialPrefs,
            writer: 'reset',
            resetActionId,
          });
        } finally {
          endAthletePrefsResetAction(resetActionId);
        }
      },
    }),
    {
      name: ATHLETE_PREFS_PERSISTENCE_KEY,
      storage: createJSONStorage(() => athletePrefsGuardedStorage),
    },
  ),
);

/* ══ THE PREFS WRITE OWNER ══
 *
 * The profile door's shape (`applyProfileOnboardingWrite`), applied by recipe:
 *
 *   1. ONE DOOR. Every write of `prefs` goes through here.
 *   2. THE DEFAULT IS NOT A VALUE. Writing the built-in empty default over
 *      prefs that hold answers is refused, unless the write carries a reset
 *      action that is IN FLIGHT.
 *   3. AN IN-FLIGHT RESET, NOT A RESET THAT HAPPENED. A stale id is refused.
 *   4. EVERYTHING IS ON THE TAPE. Applied or refused, every write names its
 *      writer and the material counts either side. Counts and labels only,
 *      never answers — exercise names and injury keys stay on the device.
 */

export type AthletePrefsWriterId =
  | 'preference_control'
  | 'coach_action'
  | 'reset'
  | 'dev_seed';

export interface AthletePrefsWriteOutcome {
  ok: boolean;
  reason?: 'default_over_answered_prefs' | 'reset_action_not_in_flight';
}

const resetActionsInFlight = new Set<string>();
let nextResetActionId = 1;

/**
 * Open a reset. The id is only good while the reset is running, which is what
 * makes a deferred write belonging to a finished reset refusable.
 */
export function beginAthletePrefsResetAction(source: string): string {
  const id = `athlete-prefs-reset:${source}:${nextResetActionId++}`;
  resetActionsInFlight.add(id);
  return id;
}

export function endAthletePrefsResetAction(id: string): void {
  resetActionsInFlight.delete(id);
}

function materialCounts(prefs: AthletePoolPrefs): {
  excluded: number; pinned: number; activeInjuries: number;
} {
  return {
    excluded: prefs.excluded.length,
    pinned: prefs.pinned.length,
    activeInjuries: (prefs.activeInjuries ?? []).length,
  };
}

function isTheBuiltInDefault(prefs: AthletePoolPrefs): boolean {
  const counts = materialCounts(prefs);
  return counts.excluded === 0 && counts.pinned === 0 && counts.activeInjuries === 0;
}

export function applyAthletePrefsWrite(args: {
  next: AthletePoolPrefs;
  writer: AthletePrefsWriterId;
  resetActionId?: string;
}): AthletePrefsWriteOutcome {
  const before = materialCounts(useAthletePreferencesStore.getState().prefs);
  const record = (outcome: 'applied' | 'refused', reason?: string) => {
    const after = materialCounts(useAthletePreferencesStore.getState().prefs);
    emitAthleteActionEvent(beginAthleteActionTrace({
      source: args.writer === 'preference_control' ? 'tap' : 'system',
      actionType: 'program_change',
      route: 'applyAthletePrefsWrite',
    }, undefined, { forceRoot: true }), 'athlete_prefs_write', {
      writer: args.writer,
      outcome,
      excludedCountBefore: before.excluded,
      excludedCountAfter: after.excluded,
      pinnedCountBefore: before.pinned,
      pinnedCountAfter: after.pinned,
      activeInjuryCountBefore: before.activeInjuries,
      activeInjuryCountAfter: after.activeInjuries,
      ...(reason ? { internalResultCode: reason } : {}),
      ...(args.resetActionId ? { resetActionId: args.resetActionId } : {}),
    });
  };

  const beforeIsMaterial = before.excluded + before.pinned + before.activeInjuries > 0;
  if (isTheBuiltInDefault(args.next) && beforeIsMaterial) {
    if (!args.resetActionId) {
      quarantineDiskCopyBestEffort();
      record('refused', 'default_over_answered_prefs');
      return { ok: false, reason: 'default_over_answered_prefs' };
    }
    if (!resetActionsInFlight.has(args.resetActionId)) {
      quarantineDiskCopyBestEffort();
      record('refused', 'reset_action_not_in_flight');
      return { ok: false, reason: 'reset_action_not_in_flight' };
    }
  }

  useAthletePreferencesStore.setState({ prefs: args.next });
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
  void asyncStorageCompat.getItem(ATHLETE_PREFS_PERSISTENCE_KEY)
    .then((envelope) => quarantineRefusedPayload(ATHLETE_PREFS_PERSISTENCE_KEY, envelope))
    .catch(() => {});
}
