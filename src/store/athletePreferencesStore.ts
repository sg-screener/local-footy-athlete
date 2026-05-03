import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AthletePoolPrefs } from '../data/exercisePoolsStrength';
import type { InjuryKey } from '../data/exerciseTags';

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

/**
 * Read current prefs with a guaranteed-non-null default. Callers that pass
 * prefs to `buildWorkoutsFromCoach` should use this rather than reading the
 * store directly, so the call site never has to branch on undefined.
 */
export function getAthletePrefs(): AthletePoolPrefs {
  return useAthletePreferencesStore.getState().prefs;
}

export const useAthletePreferencesStore = create<AthletePreferencesState>()(
  persist(
    (set) => ({
      prefs: initialPrefs,

      addExclusion: (exerciseName) =>
        set((state) => {
          if (state.prefs.excluded.includes(exerciseName)) return state;
          return {
            prefs: {
              ...state.prefs,
              excluded: [...state.prefs.excluded, exerciseName],
            },
          };
        }),

      removeExclusion: (exerciseName) =>
        set((state) => ({
          prefs: {
            ...state.prefs,
            excluded: state.prefs.excluded.filter((n) => n !== exerciseName),
          },
        })),

      addPinned: (exerciseName) =>
        set((state) => {
          if (state.prefs.pinned.includes(exerciseName)) return state;
          return {
            prefs: {
              ...state.prefs,
              pinned: [...state.prefs.pinned, exerciseName],
            },
          };
        }),

      removePinned: (exerciseName) =>
        set((state) => ({
          prefs: {
            ...state.prefs,
            pinned: state.prefs.pinned.filter((n) => n !== exerciseName),
          },
        })),

      setActiveInjuries: (keys) =>
        set((state) => ({
          prefs: {
            ...state.prefs,
            activeInjuries: [...keys],
          },
        })),

      addActiveInjury: (key) =>
        set((state) => {
          const current = state.prefs.activeInjuries ?? [];
          if (current.includes(key)) return state;
          return {
            prefs: {
              ...state.prefs,
              activeInjuries: [...current, key],
            },
          };
        }),

      removeActiveInjury: (key) =>
        set((state) => {
          const current = state.prefs.activeInjuries ?? [];
          return {
            prefs: {
              ...state.prefs,
              activeInjuries: current.filter((k) => k !== key),
            },
          };
        }),

      clear: () =>
        set({
          prefs: initialPrefs,
        }),
    }),
    {
      name: 'athlete-preferences-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
