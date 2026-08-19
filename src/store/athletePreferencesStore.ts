import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AthletePoolPrefs } from '../data/exercisePoolsStrength';
import type { InjuryKey } from '../data/exerciseTags';
import {
  excludedExerciseNamesOn,
  restoreExclusion,
  upsertExclusion,
  type ExerciseExclusion,
} from '../rules/exerciseExclusions';
import { todayISOLocal } from '../utils/appDate';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
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
  /**
   * ⚠ **NOT THE DOOR ANY MORE.** Kept because the coach path and the reset
   * suite still call it, and because an exclusion with no scope is still a real
   * athlete answer — it is recorded as `until_changed`, which is exactly what
   * this action has always meant. Every ATHLETE-facing removal goes through
   * `utils/exerciseExclusionOwner.applyExerciseExclusionDecision`, which is the
   * only writer that can express Sam's three scopes.
   */
  addExclusion: (exerciseName: string) => void;
  removeExclusion: (exerciseName: string) => void;
  /** THE SCOPED DOOR. One decision per exercise; a second answer updates it. */
  setExclusion: (exclusion: ExerciseExclusion) => void;

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
  exclusions: [],
};

/** The store's built-in default, exported so writers can be compared against it. */
export const INITIAL_ATHLETE_PREFS: AthletePoolPrefs = initialPrefs;

export const ATHLETE_PREFS_PERSISTENCE_KEY = 'athlete-preferences-store';

/**
 * Read current prefs with a guaranteed-non-null default. Callers that pass
 * prefs to `buildWorkoutsFromCoach` should use this rather than reading the
 * store directly, so the call site never has to branch on undefined.
 *
 * ── `excluded` IS PROJECTED HERE, ON A DATE, AND NOWHERE ELSE ──────────────
 *
 * The stored fact is `exclusions` (scope + expiry). Every reader that just wants
 * "which names are out" asks this function, and gets the answer FOR A DAY —
 * which is what makes a `today_only` decision stop applying tomorrow with no
 * expiry sweep, no scheduled job and no second writer. An exclusion that
 * expires does so by arithmetic, so nothing can forget to run.
 *
 * `dateISO` defaults to today because that is what every existing caller meant.
 * Generation passes the week it is authoring — see
 * `services/api/generateProgram.ts`.
 */
export function getAthletePrefs(dateISO: string = todayISOLocal()): AthletePoolPrefs {
  const prefs = useAthletePreferencesStore.getState().prefs;
  return { ...prefs, excluded: excludedExerciseNamesOn(prefs.exclusions, dateISO) };
}

/**
 * THE OBJECT A WRITER MUST BUILD ITS `next` FROM.
 *
 * Every action used to start from `getAthletePrefs()`, which is now a
 * PROJECTION — spreading it back into a write would persist the derived
 * `excluded` array beside the decisions that produced it, and the app would once
 * again hold two answers to "is this excluded". Writers take the stored object;
 * readers take the projection.
 */
function storedPrefs(): AthletePoolPrefs {
  return useAthletePreferencesStore.getState().prefs;
}

function canonicalExclusionIdentity(name: string): string {
  return canonicalExerciseName(String(name ?? '').trim());
}

/** The stored decisions themselves, unprojected. Status and the owner read this. */
export function getAthleteExclusions(): readonly ExerciseExclusion[] {
  return useAthletePreferencesStore.getState().prefs.exclusions ?? [];
}

/**
 * WHAT A HYDRATED ENVELOPE MEANS, DECIDED IN ONE PLACE.
 *
 * Devices in the wild carry `prefs.excluded: string[]` — bare names, no scope,
 * written before Block Two. They are folded into `exclusions` as
 * `until_changed`, which is what the old code did behave like, and the bare
 * array is cleared so there is exactly ONE stored copy of the decision. Leaving
 * both would be two answers to "is this excluded", and the derived projection
 * would race the stale array on the very next write.
 *
 * Exported so `athletePreferencesOwnershipTests` can prove the migration
 * against a real legacy envelope rather than trusting the persist middleware.
 */
export function normaliseHydratedPrefs(
  persisted: Partial<AthletePoolPrefs> | null | undefined,
  hydratedOnISO: string = todayISOLocal(),
): AthletePoolPrefs {
  const base: AthletePoolPrefs = {
    ...initialPrefs,
    ...(persisted ?? {}),
    excluded: [],
    pinned: [...(persisted?.pinned ?? [])],
  };
  // THE BARE-NAME UPGRADE IS DELETED (demolition area 4). `excluded: string[]`
  // was the pre-scope shape; anything stored in it belongs to a build no
  // athlete is running. Scoped `exclusions` is the only stored form.
  return { ...base, exclusions: [...(persisted?.exclusions ?? [])] };
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
      // `exclusions` is counted BESIDE the legacy `excluded` array, not instead
      // of it: a pre-Block-Two envelope still carries answers in the old field
      // and must not read as bare just because the new field is empty.
      return !!prefs && ((prefs.excluded ?? []).length > 0 || prefs.pinned.length > 0
        || (prefs.exclusions ?? []).length > 0
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
          route: 'athletePrefsGuardedStorage.setItem',
        }, undefined, { forceRoot: true }), 'persistence_result', {
          persistenceOperation: 'write',
          persistenceStore: name,
          persistenceSucceeded: false,
          originalRejectionCode: reason,
          rejectingBoundary: 'athletePrefsGuardedStorage.setItem.quarantine',
          failureCategory: 'persistence_failure',
        });
        logger.error('[athletePreferencesStore] refused to persist over a quarantined payload.',
          { store: name, reason: reason });
      },
    }),
  removeItem: (name: string): Promise<void> => asyncStorageCompat.removeItem(name),
};

export const useAthletePreferencesStore = create<AthletePreferencesState>()(
  persist(
    () => ({
      prefs: initialPrefs,

      // Every action is a thin builder of `next`; the door owns the write.

      addExclusion: (exerciseName) => {
        // An unscoped add is the `until_changed` answer — the only meaning this
        // action has ever had. Routed through the same upsert as the scoped door
        // so it cannot produce a second record for an exercise already excluded.
        useAthletePreferencesStore.getState().setExclusion({
          exercise: canonicalExclusionIdentity(exerciseName),
          scope: 'until_changed',
          decidedOnISO: todayISOLocal(),
          activeThroughISO: null,
          blockNumber: null,
        });
      },

      setExclusion: (exclusion) => {
        const prefs = storedPrefs();
        applyAthletePrefsWrite({
          next: { ...prefs, exclusions: upsertExclusion(prefs.exclusions, exclusion) },
          writer: 'preference_control',
        });
      },

      removeExclusion: (exerciseName) => {
        const prefs = storedPrefs();
        applyRemovalThroughDoor({
          next: { ...prefs, exclusions: restoreExclusion(prefs.exclusions, exerciseName) },
          source: 'remove_exclusion',
        });
      },

      addPinned: (exerciseName) => {
        const prefs = storedPrefs();
        if (prefs.pinned.includes(exerciseName)) return;
        applyAthletePrefsWrite({
          next: { ...prefs, pinned: [...prefs.pinned, exerciseName] },
          writer: 'preference_control',
        });
      },

      removePinned: (exerciseName) => {
        const prefs = storedPrefs();
        applyRemovalThroughDoor({
          next: { ...prefs, pinned: prefs.pinned.filter((n) => n !== exerciseName) },
          source: 'remove_pinned',
        });
      },

      setActiveInjuries: (keys) => {
        const prefs = storedPrefs();
        applyRemovalThroughDoor({
          next: { ...prefs, activeInjuries: [...keys] },
          source: 'set_active_injuries',
        });
      },

      addActiveInjury: (key) => {
        const prefs = storedPrefs();
        const current = prefs.activeInjuries ?? [];
        if (current.includes(key)) return;
        applyAthletePrefsWrite({
          next: { ...prefs, activeInjuries: [...current, key] },
          writer: 'preference_control',
        });
      },

      removeActiveInjury: (key) => {
        const prefs = storedPrefs();
        const current = prefs.activeInjuries ?? [];
        applyRemovalThroughDoor({
          next: { ...prefs, activeInjuries: current.filter((k) => k !== key) },
          source: 'remove_active_injury',
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
      /**
       * THE LEGACY FOLD HAPPENS AT HYDRATION, SYNCHRONOUSLY, IN THE MERGE.
       *
       * Not in `onRehydrateStorage`: that fires AFTER the state is installed, so
       * for one tick the store would hold both a legacy `excluded` array and an
       * empty `exclusions` list, and any reader running in that tick — boot
       * regeneration is exactly such a reader — would see an athlete with no
       * exclusions and put every banned exercise straight back in the program.
       */
      merge: (persisted, current) => ({
        ...current,
        prefs: normaliseHydratedPrefs(
          (persisted as { prefs?: Partial<AthletePoolPrefs> } | undefined)?.prefs,
        ),
      }),
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
    // THE DECISIONS ARE THE MATERIAL, not the projection. `excluded` is derived
    // and empty in the stored object, so counting it alone would have told the
    // wipe guard that an athlete with ten scoped exclusions holds no answers —
    // and the guard would then have let the empty default land over them.
    excluded: (prefs.exclusions ?? []).length + (prefs.excluded ?? []).length,
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
      // `erasureActId`, not `resetActionId`: the diagnostics forbidden-key
      // filter drops any key containing "set" (recipe lesson 12), so the
      // reset act's name must travel under a filter-safe key or not at all.
      ...(args.resetActionId ? { erasureActId: args.resetActionId } : {}),
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
 * REMOVING THE LAST ANSWER IS THE ATHLETE'S CHANGE, NOT THE WIPE (found by
 * the coach-store application, 2026-08-03 — recipe lesson 11). A remove
 * action whose result happens to be the empty default is an attributed,
 * athlete-initiated erasure; refusing it would strand the athlete with an
 * exclusion they cannot take back. The action declares the erasure with its
 * own named reset act, so it lands AND says so on the tape — the refusal
 * stays aimed at what it was built for: an UNATTRIBUTED default write.
 */
function applyRemovalThroughDoor(args: {
  next: AthletePoolPrefs;
  source: string;
}): void {
  if (!isTheBuiltInDefault(args.next)) {
    applyAthletePrefsWrite({ next: args.next, writer: 'preference_control' });
    return;
  }
  const resetActionId = beginAthletePrefsResetAction(args.source);
  try {
    applyAthletePrefsWrite({
      next: args.next,
      writer: 'preference_control',
      resetActionId,
    });
  } finally {
    endAthletePrefsResetAction(resetActionId);
  }
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
