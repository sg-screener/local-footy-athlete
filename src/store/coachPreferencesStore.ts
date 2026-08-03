/**
 * coachPreferencesStore.ts — recurring/future modality preferences set
 * by the coach pipeline.
 *
 * SCOPE
 *   These are session-name-keyed *recurring* swaps: "use bike instead
 *   of rower for Easy Aerobic Flush sessions going forward". Unlike
 *   per-date manual overrides, preferences are NEVER tied to a specific
 *   week — they ride along on the visible-program projection so future
 *   weeks reflect the rule the moment the athlete navigates to them.
 *
 * WHEN TO USE
 *   The orchestrator routes a modality-swap request here when the
 *   resolved target is in the past (already completed Wednesday in the
 *   current week, or earlier). Past sessions are never edited; the
 *   preference applies to TODAY-or-later instances of the same session
 *   name.
 *
 * WRITE PATH
 *   `setModalityPreference(sessionName, { from, to })` — overwrites any
 *   existing entry for that session name. We deliberately don't stack
 *   preferences (e.g. "row → bike, then bike → ski") to keep the
 *   athlete-visible state easy to reason about; the latest preference
 *   wins.
 *
 * READ PATH
 *   `projectVisibleDay` calls `getModalityPreferenceFor(sessionName)`
 *   while building the visible workout. If a preference exists and the
 *   day is today or later, the projection rewrites every conditioning
 *   exercise on the matching modality to its tier-preserving
 *   equivalent on the new modality.
 *
 * CANONICALISATION
 *   Session names are stored under their `canonicalSessionKey` form
 *   (lowercase, whitespace-collapsed, punctuation stripped) so
 *   "Easy Aerobic Flush" and "easy  aerobic-flush!" hit the same entry.
 *
 * ARMOURED 2026-08-03 (`docs/STORE_ARMOUR_RECIPE_2026-08-03.md`): a modality
 * preference is a decision the athlete gave through the coach, so every write
 * of `modalityPreferences` goes through `applyCoachModalityPrefsWrite` — one
 * door, typed refusals of the wipe shape, every writer on the tape, and a
 * quarantine boundary at the persistence writer. This is LR-2 store-ownership
 * work under Sam's sequencing ruling: it changes HOW the map is physically
 * written, never WHAT any coach path decides. `coachPreferencesOwnershipTests`
 * fails the build on a writer around the owner.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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
import type { ConditioningModality } from '../data/exerciseTags';
import type { BikeLabel } from '../utils/coachModalitySwap';
import { logger } from '../utils/logger';

export interface ModalityPreference {
  /** Optional source modality. When set, only conditioning whose
   *  modality matches `from` is rewritten; conditioning on other
   *  modalities is left alone. When null, every conditioning slot in
   *  the matching session is rewritten to `to`. */
  from: ConditioningModality | null;
  /** Destination modality every matching slot should land on. */
  to: ConditioningModality;
  /**
   * Optional bike subtype label the projection should render. Only
   * meaningful when `to === 'bike'` (or when `from === to === 'bike'`
   * for label-only corrections). Null/undefined keeps the engine
   * default ("Assault Bike").
   */
  bikeLabel?: BikeLabel | null;
  /** Wall-clock millis at write time — tests + UI can show "set on …". */
  createdAt: number;
}

export interface ModalityPreferencesState {
  /** Keyed by canonical session name (see `canonicalSessionKey`). */
  modalityPreferences: Record<string, ModalityPreference>;

  /** Upsert a preference for a session name. Overwrites any existing entry. */
  setModalityPreference: (sessionName: string, pref: Omit<ModalityPreference, 'createdAt'>) => void;
  /** Drop a single preference by session name. */
  clearModalityPreference: (sessionName: string) => void;
  /** Nuke every preference (test/reset). */
  clearAllModalityPreferences: () => void;
}

/** Lower-case + collapse whitespace + strip everything but a–z 0–9 + spaces. */
export function canonicalSessionKey(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Modality / dosage tokens that may decorate a session display name. We
 * strip TRAILING occurrences of these so
 *   "Easy Aerobic Flush (20min Rower)"
 * canonicalises down to "easy aerobic flush" before the alias-group walk.
 *
 * Token list intentionally small: every word here is a valid trailing
 * dosage suffix on a session display name. Adding generic words like
 * "training" or "session" would risk false positives.
 */
const TRAILING_MODALITY_TOKENS: ReadonlySet<string> = new Set([
  'row', 'rower', 'rowing',
  'bike', 'biking', 'cycling',
  'ski', 'skierg', 'skiing',
  'run', 'running', 'jog', 'jogging',
  'swim', 'swimming',
  'erg', 'cardio', 'finisher',
]);

/** Match a duration / distance token like "20min", "25min", "5km", "30s", "10mi". */
function isDurationToken(token: string): boolean {
  return /^\d+(min|mins|minute|minutes|sec|secs|s|km|m|mi|mile|miles)?$/i.test(token);
}

/** Strip everything in (...) from a display name. Whitespace is normalised. */
function stripParentheticals(name: string): string {
  return name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip trailing dosage / modality tokens from a canonical key.
 * Keeps at least 2 tokens to avoid collapsing legit short names like
 * "easy row" → "easy" (which would lose its alias-group identity).
 */
function stripTrailingDosageTokens(canonical: string): string {
  if (!canonical) return canonical;
  const words = canonical.split(' ');
  while (words.length > 2) {
    const last = words[words.length - 1];
    if (TRAILING_MODALITY_TOKENS.has(last) || isDurationToken(last)) {
      words.pop();
    } else {
      break;
    }
  }
  return words.join(' ');
}

/**
 * Return every canonical-key form to try when looking up a session name.
 * Order: most-specific → least-specific. Dedup-preserving.
 *
 *   "Easy Aerobic Flush (20min Rower)"
 *     1. raw           → "easy aerobic flush 20min rower"
 *     2. paren-stripped→ "easy aerobic flush"
 *     3. dosage-stripped from raw → "easy aerobic flush"
 *     4. dosage-stripped from paren-stripped → "easy aerobic flush"
 *
 * "Lower Body Strength + Aerobic Base finisher" → does NOT collapse to
 * "aerobic base" (only TRAILING dosage tokens are stripped, internal
 * "aerobic base" survives), so the standalone Easy Aerobic Flush
 * preference cannot leak into a strength session that happens to mention
 * an aerobic base finisher.
 */
export function canonicalSessionKeyCandidates(name: string): string[] {
  if (!name) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (k: string) => {
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  };

  const raw = canonicalSessionKey(name);
  add(raw);

  const parenStripped = canonicalSessionKey(stripParentheticals(name));
  add(parenStripped);

  add(stripTrailingDosageTokens(raw));
  add(stripTrailingDosageTokens(parenStripped));

  return out;
}

/**
 * Aliases that should resolve to the same preference. The orchestrator
 * stores under the resolved `targetSessionName` (typically `workout.name`,
 * e.g. "Easy Aerobic Flush"); the visible projection sometimes only sees
 * a normalized title like "Easy Row" or "Aerobic Base". Walking this
 * alias list lets a single preference apply across the family.
 *
 * We deliberately keep the alias map small and conservative — bigger
 * groups risk leaking preferences across unrelated sessions.
 */
const SESSION_NAME_ALIAS_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [
  // Easy aerobic flush family — block titles from sessionBuilder + canonical names
  [
    'easy aerobic flush',
    'aerobic flush',
    'aerobic base',
    'easy row',
    'easy bike',
    'easy ski',
    'zone 2 row',
    'zone 2 bike',
    'zone 2 conditioning',
  ],
  // Long base run / Z2 run family
  [
    'long nasal run',
    'long run',
    'aerobic run',
  ],
  // Hard interval erg family
  [
    'hard row intervals',
    'hard assault bike intervals',
    'hard skierg intervals',
    'row intervals',
    'assault bike intervals',
    'skierg intervals',
  ],
];

/**
 * Return every canonical key that should be checked against the
 * preference store for a given session name. Walks each canonical
 * candidate (raw, paren-stripped, dosage-stripped) and unions in every
 * alias-group sibling.
 *
 * The first entry is always the most-specific raw canonical form.
 */
export function aliasKeysForSessionName(sessionName: string): string[] {
  const candidates = canonicalSessionKeyCandidates(sessionName);
  if (candidates.length === 0) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  const add = (k: string) => {
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  };

  for (const cand of candidates) add(cand);

  // Layer in alias-group siblings for any candidate that lives in a group.
  for (const cand of candidates) {
    for (const group of SESSION_NAME_ALIAS_GROUPS) {
      if (group.includes(cand)) {
        for (const alias of group) add(alias);
      }
    }
  }
  return out;
}

export const COACH_PREFS_PERSISTENCE_KEY = 'coach-preferences-store';

/**
 * THE STORE'S WRITER BOUNDARY, declared once (`docs/STORE_ARMOUR_RECIPE_
 * 2026-08-03.md`). A payload carries the athlete's material when at least one
 * preference survives in it. Unreadable bytes prove nothing and answer no.
 */
registerQuarantineBoundary(COACH_PREFS_PERSISTENCE_KEY, {
  carriesMaterial: (envelope) => {
    try {
      const state = (JSON.parse(envelope) as {
        state?: { modalityPreferences?: Record<string, ModalityPreference> };
      }).state;
      return Object.keys(state?.modalityPreferences ?? {}).length > 0;
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
export const coachModalityPrefsGuardedStorage = {
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
          route: 'coachModalityPrefsGuardedStorage.setItem',
        }, undefined, { forceRoot: true }), 'persistence_result', {
          persistenceOperation: 'write',
          persistenceStore: name,
          persistenceSucceeded: false,
          originalRejectionCode: reason,
          rejectingBoundary: 'coachModalityPrefsGuardedStorage.setItem.quarantine',
          failureCategory: 'persistence_failure',
        });
        logger.error('[coachPreferencesStore] refused to persist over a quarantined payload.',
          { store: name, reason: reason });
      },
    }),
  removeItem: (name: string): Promise<void> => asyncStorageCompat.removeItem(name),
};

export const useCoachPreferencesStore = create<ModalityPreferencesState>()(
  persist(
    () => ({
      modalityPreferences: {},

      // Every action is a thin builder of `next`; the door owns the write.

      setModalityPreference: (sessionName, pref) => {
        const key = canonicalSessionKey(sessionName);
        if (!key) {
          logger.warn('[coach-preference-write] empty_canonical_key', { sessionName });
          return;
        }
        const current = useCoachPreferencesStore.getState().modalityPreferences;
        // Merge with any existing entry so a follow-up bike-label
        // correction ("regular bike, not assault") doesn't drop the
        // earlier `from`. Replacement still wins for the explicit fields.
        const existing = current[key];
        const entry: ModalityPreference = {
          from: pref.from !== undefined ? pref.from : existing?.from ?? null,
          to: pref.to,
          bikeLabel:
            pref.bikeLabel !== undefined ? pref.bikeLabel : existing?.bikeLabel ?? null,
          createdAt: Date.now(),
        };
        const next = { ...current, [key]: entry };
        logger.info('[coach-preference-write]', {
          sessionName,
          canonicalKey: key,
          from: entry.from,
          to: entry.to,
          bikeLabel: entry.bikeLabel,
          totalKeys: Object.keys(next).length,
        });
        applyCoachModalityPrefsWrite({ next, writer: 'coach_pipeline' });
      },

      clearModalityPreference: (sessionName) => {
        const key = canonicalSessionKey(sessionName);
        const current = useCoachPreferencesStore.getState().modalityPreferences;
        if (!key || !current[key]) return;
        const next = { ...current };
        delete next[key];
        // A targeted clear that empties the map is a legitimate erasure — the
        // undo engine restores "no preference existed before" this way — so it
        // is declared with its own reset act rather than refused. Clearing one
        // of several is a reduction and the act is simply unused (lesson 3).
        const resetActionId = beginCoachModalityPrefsResetAction('modality_preference_clear');
        try {
          applyCoachModalityPrefsWrite({ next, writer: 'coach_pipeline', resetActionId });
        } finally {
          endCoachModalityPrefsResetAction(resetActionId);
        }
      },

      clearAllModalityPreferences: () => {
        // A reset is the one write that may erase decisions, and it says so.
        const resetActionId = beginCoachModalityPrefsResetAction('coach_prefs_clear_all');
        try {
          applyCoachModalityPrefsWrite({ next: {}, writer: 'reset', resetActionId });
        } finally {
          endCoachModalityPrefsResetAction(resetActionId);
        }
      },
    }),
    {
      name: COACH_PREFS_PERSISTENCE_KEY,
      storage: createJSONStorage(() => coachModalityPrefsGuardedStorage),
    },
  ),
);

/* ══ THE MODALITY PREFERENCES WRITE OWNER ══
 *
 * The profile door's shape (`applyProfileOnboardingWrite`), applied by recipe
 * (`docs/STORE_ARMOUR_RECIPE_2026-08-03.md`):
 *
 *   1. ONE DOOR. Every write of `modalityPreferences` goes through here —
 *      including the coach-mutation rollback restore, which is one of its
 *      writers, not an exception to it.
 *   2. THE DEFAULT IS NOT A VALUE. Writing the empty map over preferences the
 *      athlete stated is refused, unless a reset action is IN FLIGHT. A
 *      REDUCED map is not the wipe — clearing one preference of several
 *      legitimately writes fewer entries.
 *   3. AN IN-FLIGHT RESET, NOT A RESET THAT HAPPENED. A stale id is refused.
 *   4. EVERYTHING IS ON THE TAPE. Applied or refused, every write names its
 *      writer and the preference counts either side. Counts only — a session
 *      name and a modality key ('bike', 'row') are the athlete's answers, and
 *      answers never leave the device.
 */

export type CoachModalityPrefsWriterId =
  | 'coach_pipeline'
  | 'coach_mutation_rollback'
  | 'reset';

export interface CoachModalityPrefsWriteOutcome {
  ok: boolean;
  reason?: 'default_over_answered_preferences' | 'reset_action_not_in_flight';
}

const resetActionsInFlight = new Set<string>();
let nextResetActionId = 1;

/**
 * Open a reset. The id is only good while the reset is running, which is what
 * makes a deferred write belonging to a finished reset refusable.
 */
export function beginCoachModalityPrefsResetAction(source: string): string {
  const id = `coach-prefs-reset:${source}:${nextResetActionId++}`;
  resetActionsInFlight.add(id);
  return id;
}

export function endCoachModalityPrefsResetAction(id: string): void {
  resetActionsInFlight.delete(id);
}

export function applyCoachModalityPrefsWrite(args: {
  next: Record<string, ModalityPreference>;
  writer: CoachModalityPrefsWriterId;
  resetActionId?: string;
}): CoachModalityPrefsWriteOutcome {
  const preferenceCountBefore =
    Object.keys(useCoachPreferencesStore.getState().modalityPreferences).length;
  const record = (outcome: 'applied' | 'refused', reason?: string) => {
    emitAthleteActionEvent(beginAthleteActionTrace({
      source: 'system',
      actionType: 'program_change',
      route: 'applyCoachModalityPrefsWrite',
    }, undefined, { forceRoot: true }), 'coach_prefs_write', {
      writer: args.writer,
      outcome,
      preferenceCountBefore,
      preferenceCountAfter:
        Object.keys(useCoachPreferencesStore.getState().modalityPreferences).length,
      ...(reason ? { internalResultCode: reason } : {}),
      ...(args.resetActionId ? { resetActionId: args.resetActionId } : {}),
    });
  };

  const nextIsTheDefault = Object.keys(args.next).length === 0;
  if (nextIsTheDefault && preferenceCountBefore > 0) {
    if (!args.resetActionId) {
      quarantineDiskCopyBestEffort();
      record('refused', 'default_over_answered_preferences');
      return { ok: false, reason: 'default_over_answered_preferences' };
    }
    if (!resetActionsInFlight.has(args.resetActionId)) {
      quarantineDiskCopyBestEffort();
      record('refused', 'reset_action_not_in_flight');
      return { ok: false, reason: 'reset_action_not_in_flight' };
    }
  }

  useCoachPreferencesStore.setState({ modalityPreferences: args.next });
  record('applied');
  return { ok: true };
}

/**
 * The DISK copy, not the in-memory one — memory survives a refusal by
 * construction; the envelope on disk is what a later writer can destroy.
 */
function quarantineDiskCopyBestEffort(): void {
  void asyncStorageCompat.getItem(COACH_PREFS_PERSISTENCE_KEY)
    .then((envelope) => quarantineRefusedPayload(COACH_PREFS_PERSISTENCE_KEY, envelope))
    .catch(() => {});
}

/**
 * Convenience read for the projection layer. Returns null when no
 * preference exists for the given session name. Walks the alias group
 * so a preference stored under "Easy Aerobic Flush" still resolves when
 * the projection only knows the conditioning-block title "Easy Row".
 */
export function getModalityPreferenceFor(
  sessionName: string,
  prefs?: Record<string, ModalityPreference>,
): ModalityPreference | null {
  if (!sessionName) return null;
  const map = prefs ?? useCoachPreferencesStore.getState().modalityPreferences;
  const candidates = aliasKeysForSessionName(sessionName);
  for (const key of candidates) {
    const hit = map[key];
    if (hit) {
      logger.info('[coach-preference-read] hit', {
        querySessionName: sessionName,
        candidates,
        matchedKey: key,
        from: hit.from,
        to: hit.to,
      });
      return hit;
    }
  }
  // Miss is high-volume — only log when at least one preference exists.
  if (Object.keys(map).length > 0) {
    logger.debug('[coach-preference-read] miss', {
      querySessionName: sessionName,
      candidates,
      storeKeys: Object.keys(map),
    });
  }
  return null;
}

/**
 * Snapshot helper for tests + the orchestrator's preference-application
 * loop. Returns an immutable view of the current preferences map.
 */
export function getModalityPreferences(): Record<string, ModalityPreference> {
  return useCoachPreferencesStore.getState().modalityPreferences;
}
