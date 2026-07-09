import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  TrainingProgram,
  Microcycle,
  Workout,
  WorkoutExercise,
  OverrideContext,
  WeekScopedWorkoutOverlay,
} from '../types/domain';
import { logger } from '../utils/logger';
import type { ConditioningPerformanceLog } from '../utils/conditioningLogging';
import type { StrengthExercisePerformanceLog } from '../utils/strengthLogging';
import type { SessionComponentKind } from '../utils/sessionComponents';

// ─── Session Feedback ───

export type FeedbackFeeling = 'very_easy' | 'easy' | 'good' | 'hard' | 'very_hard';
export type FeedbackCompletion = 'full' | 'partial' | 'skipped';
export type FeedbackSoreness = 'none' | 'mild' | 'moderate' | 'high';
export type FeedbackPartialReason =
  | 'ran_out_of_time'
  | 'felt_sore_tight'
  | 'too_hard_today'
  | 'equipment_unavailable'
  | 'other';
export type FeedbackSkipReason =
  | 'busy_no_time'
  | 'sore_tight'
  | 'injured_niggle'
  | 'sick_low_energy'
  | 'didnt_feel_like_it'
  | 'equipment_unavailable'
  | 'other';

export interface SessionFeedbackComponent {
  componentId: string;
  kind: SessionComponentKind;
  label: string;
  completion: FeedbackCompletion;
  partialReason?: FeedbackPartialReason;
  skipReason?: FeedbackSkipReason;
}

export interface SessionFeedback {
  dateStr: string;
  completion: FeedbackCompletion;
  /**
   * Component-level completions for combined sessions. Top-level completion
   * remains as a backward-compatible aggregate only.
   */
  components?: SessionFeedbackComponent[];
  /** Session effort. Omitted for skipped sessions to avoid fake exertion data. */
  feeling?: FeedbackFeeling;
  /** RPE-style difficulty rating (1–10). Optional for backward compat. */
  difficulty?: number;
  /** Post-session soreness level. Optional for backward compat. */
  soreness?: FeedbackSoreness;
  /** Optional reason when an athlete completed only part of the session. */
  partialReason?: FeedbackPartialReason;
  /** Required reason when an athlete skips the session from the feedback form. */
  skipReason?: FeedbackSkipReason;
  /**
   * Optional performance data for trackable conditioning sessions.
   * Easy/recovery sessions intentionally keep using completion + feeling only.
   */
  conditioning?: ConditioningPerformanceLog;
  /** Main-lift snapshot captured on save for future progression/diary use. */
  strength?: StrengthExercisePerformanceLog[];
  notes?: string;
}

interface ProgramState {
  currentProgram: TrainingProgram | null;
  currentMicrocycle: Microcycle | null;
  todayWorkout: Workout | null;
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;

  /**
   * Manual workout overrides — ONLY for explicit human/coach edits.
   *
   * Automatic adjustments (game proximity: G+1 recovery, G-1 reduction, etc.)
   * are DERIVED at read time by sessionResolver.ts, never stored here.
   *
   * Key: ISO date 'YYYY-MM-DD', Value: manually-authored Workout
   *
   * NOTE: Persisted under the key 'dateOverrides' for backward compatibility
   * with existing AsyncStorage data. The property name is 'dateOverrides' in
   * the store but semantically represents manual overrides only.
   */
  dateOverrides: Record<string, Workout>;

  /**
   * Optional structured context for each manual override.
   * Key: ISO date (same key as dateOverrides). Value: OverrideContext.
   * Used for stale-override detection — tells us WHY the override was created.
   */
  overrideContexts: Record<string, OverrideContext>;

  /**
   * System-authored week overlays.
   *
   * Used for one-off game / practice-match rebuilds: the selected week can
   * use the engine's with-game/no-game candidate without mutating the shared
   * base program template that future weeks resolve from.
   *
   * Key: Monday ISO date for the overlay week.
   */
  weekScopedOverlays: Record<string, WeekScopedWorkoutOverlay>;

  /**
   * Session feedback — lightweight post-session capture.
   * Key: ISO date 'YYYY-MM-DD'. Value: SessionFeedback.
   * Fed into progression context on subsequent sessions.
   */
  sessionFeedback: Record<string, SessionFeedback>;

  /**
   * Per-session weight overrides — tracks what weight was actually used.
   *
   * Key: ISO date 'YYYY-MM-DD'.
   * Value: Record of exerciseId → performed weight in kg (null = bodyweight).
   *
   * NOT the same as template weights — these are per-session actuals.
   * Used by progression to determine baseline for future sessions:
   *   "Last time you did this exercise you used X kg, so today starts there."
   *
   * Never overwrites template prescriptions. Read-time only.
   */
  weightOverrides: Record<string, Record<string, number | null>>;

  setCurrentProgram: (program: TrainingProgram | null) => void;
  setCurrentMicrocycle: (microcycle: Microcycle | null) => void;
  setTodayWorkout: (workout: Workout | null) => void;
  setGenerating: (generating: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addExerciseToWorkout: (workoutId: string, exercise: WorkoutExercise) => void;

  /**
   * Replace an exercise in the microcycle template by dayOfWeek + name match.
   * This is a TEMPLATE edit — it changes the program itself, not a date override.
   * Used by the AI coach for single-exercise substitutions.
   */
  replaceExerciseInWorkout: (
    dayOfWeek: number,
    oldExerciseName: string,
    newExercise: WorkoutExercise,
  ) => boolean;

  /** Set a manual override for a specific date (human/coach edit only) */
  setManualOverride: (date: string, workout: Workout, context?: OverrideContext) => void;
  /** Remove a manual override for a specific date */
  removeManualOverride: (date: string) => void;
  /** Clear all manual overrides (called on full program regeneration) */
  clearManualOverrides: () => void;
  /** Dismiss a stale-override warning (user chose "keep") */
  dismissStaleWarning: (date: string) => void;

  /** Set/replace a system-authored week overlay */
  setWeekScopedOverlay: (overlay: WeekScopedWorkoutOverlay) => void;
  /** Remove a system-authored week overlay by Monday ISO key */
  removeWeekScopedOverlay: (weekStart: string) => void;
  /** Clear all system-authored week overlays */
  clearWeekScopedOverlays: () => void;

  /** Save session feedback for a date */
  setSessionFeedback: (date: string, feedback: SessionFeedback) => void;
  /** Remove feedback for a date */
  removeSessionFeedback: (date: string) => void;

  /** Set the performed weight for an exercise on a specific date */
  setWeightOverride: (date: string, exerciseId: string, weightKg: number | null) => void;
  /** Remove a weight override for an exercise on a date */
  removeWeightOverride: (date: string, exerciseId: string) => void;

  clear: () => void;
}

export const useProgramStore = create<ProgramState>()(
  persist(
    (set) => ({
      currentProgram: null,
      currentMicrocycle: null,
      todayWorkout: null,
      isGenerating: false,
      isLoading: false,
      error: null,
      dateOverrides: {},
      overrideContexts: {},
      weekScopedOverlays: {},
      sessionFeedback: {},
      weightOverrides: {},

      // Override lifecycle is NOT owned by this setter (2026-07-08).
      // It used to silently wipe dateOverrides/overrideContexts ("new
      // block = fresh slate") — which meant EVERY rebuild destroyed
      // away-day clears, injury swaps and the athlete's manual edits no
      // matter what the rebuild logic decided (the root cause of the
      // "removed Monday resurrects after adding a game" class of bug).
      // Clearing decisions now belong to the canonical sweep
      // (utils/weekRebuild.decideOverrideSweep) or an EXPLICIT
      // clearManualOverrides() where a true fresh slate is intended
      // (onboarding completion, program create, profile reset).
      setCurrentProgram: (program) =>
        set({
          currentProgram: program,
          currentMicrocycle: null,
          todayWorkout: null,
          weekScopedOverlays: {},
        }),

      setCurrentMicrocycle: (microcycle) => set({ currentMicrocycle: microcycle }),

      setTodayWorkout: (workout) => set({ todayWorkout: workout }),

      setGenerating: (generating) => set({ isGenerating: generating }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      setManualOverride: (date, workout, context?) =>
        set((state) => ({
          dateOverrides: { ...state.dateOverrides, [date]: workout },
          overrideContexts: context
            ? { ...state.overrideContexts, [date]: context }
            : state.overrideContexts,
        })),

      removeManualOverride: (date) =>
        set((state) => {
          const updatedOverrides = { ...state.dateOverrides };
          delete updatedOverrides[date];
          const updatedContexts = { ...state.overrideContexts };
          delete updatedContexts[date];
          return { dateOverrides: updatedOverrides, overrideContexts: updatedContexts };
        }),

      clearManualOverrides: () => set({ dateOverrides: {}, overrideContexts: {} }),

      setSessionFeedback: (date, feedback) =>
        set((state) => ({
          sessionFeedback: { ...state.sessionFeedback, [date]: feedback },
        })),

      removeSessionFeedback: (date) =>
        set((state) => {
          const updated = { ...state.sessionFeedback };
          delete updated[date];
          return { sessionFeedback: updated };
        }),

      setWeightOverride: (date, exerciseId, weightKg) =>
        set((state) => ({
          weightOverrides: {
            ...state.weightOverrides,
            [date]: {
              ...(state.weightOverrides[date] || {}),
              [exerciseId]: weightKg,
            },
          },
        })),

      removeWeightOverride: (date, exerciseId) =>
        set((state) => {
          const dateOverrides = { ...(state.weightOverrides[date] || {}) };
          delete dateOverrides[exerciseId];
          const allOverrides = { ...state.weightOverrides };
          if (Object.keys(dateOverrides).length === 0) {
            delete allOverrides[date];
          } else {
            allOverrides[date] = dateOverrides;
          }
          return { weightOverrides: allOverrides };
        }),

      dismissStaleWarning: (date) =>
        set((state) => ({
          // Write a 'dismissed' context so neither structured nor heuristic
          // detection will flag this override again. The override itself is untouched.
          overrideContexts: {
            ...state.overrideContexts,
            [date]: { intent: 'dismissed' },
          },
        })),

      setWeekScopedOverlay: (overlay) =>
        set((state) => ({
          weekScopedOverlays: {
            ...state.weekScopedOverlays,
            [overlay.weekStart]: overlay,
          },
        })),

      removeWeekScopedOverlay: (weekStart) =>
        set((state) => {
          const updated = { ...state.weekScopedOverlays };
          delete updated[weekStart];
          return { weekScopedOverlays: updated };
        }),

      clearWeekScopedOverlays: () => set({ weekScopedOverlays: {} }),

      addExerciseToWorkout: (workoutId, exercise) =>
        set((state) => {
          if (!state.currentMicrocycle) return state;

          const updatedWorkouts = state.currentMicrocycle.workouts.map((w) => {
            if (w.id !== workoutId) return w;
            return {
              ...w,
              exercises: [...w.exercises, exercise],
            };
          });

          const updatedMicrocycle = {
            ...state.currentMicrocycle,
            workouts: updatedWorkouts,
          };

          // Also update todayWorkout if it's the same workout
          const updatedToday =
            state.todayWorkout?.id === workoutId
              ? { ...state.todayWorkout, exercises: [...state.todayWorkout.exercises, exercise] }
              : state.todayWorkout;

          return {
            currentMicrocycle: updatedMicrocycle,
            todayWorkout: updatedToday,
          };
        }),

      replaceExerciseInWorkout: (dayOfWeek, oldExerciseName, newExercise) => {
        const state = useProgramStore.getState();
        if (!state.currentMicrocycle) {
          logger.warn('[programStore] replaceExerciseInWorkout: no currentMicrocycle');
          return false;
        }

        const oldNameLower = oldExerciseName.toLowerCase();
        let swapped = false;

        const updatedWorkouts = state.currentMicrocycle.workouts.map((w) => {
          if (w.dayOfWeek !== dayOfWeek) return w;

          const updatedExercises = w.exercises.map((ex) => {
            const exName = (ex.exercise?.name || ex.exerciseId || '').toLowerCase();
            if (exName.includes(oldNameLower) || oldNameLower.includes(exName)) {
              swapped = true;
              logger.debug(`[programStore] Swapped "${ex.exercise?.name}" → "${newExercise.exercise?.name}" on day ${dayOfWeek}`);
              return {
                ...newExercise,
                id: ex.id, // preserve slot ID
                workoutId: ex.workoutId,
                exerciseOrder: ex.exerciseOrder,
              };
            }
            return ex;
          });

          return { ...w, exercises: updatedExercises, updatedAt: new Date().toISOString() };
        });

        if (!swapped) {
          logger.warn(`[programStore] replaceExerciseInWorkout: "${oldExerciseName}" not found on day ${dayOfWeek}`);
          return false;
        }

        const updatedMicrocycle = {
          ...state.currentMicrocycle,
          workouts: updatedWorkouts,
          updatedAt: new Date().toISOString(),
        };

        // Also update todayWorkout if it falls on the same dayOfWeek
        const todayDay = new Date().getDay();
        const updatedToday = todayDay === dayOfWeek
          ? updatedWorkouts.find((w) => w.dayOfWeek === dayOfWeek) || state.todayWorkout
          : state.todayWorkout;

        useProgramStore.setState({
          currentMicrocycle: updatedMicrocycle,
          todayWorkout: updatedToday,
        });

        return true;
      },

      clear: () => {
        set({
          currentProgram: null,
          currentMicrocycle: null,
          todayWorkout: null,
          isGenerating: false,
          isLoading: false,
          error: null,
          dateOverrides: {},
          overrideContexts: {},
          weekScopedOverlays: {},
          sessionFeedback: {},
          weightOverrides: {},
        });
      },
    }),
    {
      name: 'program-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/**
 * Get the most recent performed weight for an exercise (across all dates).
 * Returns undefined if the exercise has never been weight-overridden.
 *
 * Standalone function (not a store method) to avoid circular type references.
 * Used by progression to determine baseline weight for future sessions.
 */
export function getLastPerformedWeight(exerciseId: string): number | null | undefined {
  const state = useProgramStore.getState();
  const dates = Object.keys(state.weightOverrides).sort().reverse();
  for (const d of dates) {
    const exerciseWeights = state.weightOverrides[d];
    if (exerciseWeights && exerciseId in exerciseWeights) {
      return exerciseWeights[exerciseId];
    }
  }
  return undefined;
}
