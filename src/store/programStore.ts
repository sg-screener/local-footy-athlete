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
import {
  deriveStoredBlockStateFromProgram,
  getBlockNumberForDate,
  type StoredProgramBlockState,
} from '../utils/programBlockState';
import type { ConditioningPerformanceLog } from '../utils/conditioningLogging';
import type { StrengthExercisePerformanceLog } from '../utils/strengthLogging';
import type { SessionComponentKind } from '../utils/sessionComponents';
import { todayISOLocal } from '../utils/appDate';
import type { WeeklyExposureContract } from '../rules/weeklyExposureContract';
import {
  migrateLegacyWeeklyExposureContractV2,
  type WeeklyExposureContractV2,
} from '../rules/weeklyExposureContractV2';
import { applyGenerationSafetyToSection18Contract } from '../rules/section18SafetyPolicy';
import {
  finaliseSection18SafetyWeek,
  finaliseSection18SafetyWorkout,
} from '../rules/section18SafetyFinaliser';
import {
  ensureProgramSeasonPhaseClock,
  resolveSeasonPhaseClock,
  type SeasonPhaseClock,
} from '../rules/seasonPhaseClock';

/**
 * ProgramStore is the final persistence boundary for every generated/edit
 * path. Dynamic loading avoids a store-initialisation cycle while ensuring the
 * same validator runs for program, overlay, and manual-override writes.
 */
function postValidateProgram(program: TrainingProgram): TrainingProgram {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .validateLiveProgramWrite(program);
}

function postValidateMicrocycle(microcycle: Microcycle): Microcycle {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .validateLiveMicrocycleWrite(microcycle);
}

function postValidateWorkout(
  date: string,
  workout: Workout,
  options: { restoreMissingPlanPatterns?: boolean } = {},
): Workout {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .validateLiveWorkoutWrite(date, workout, options);
}

function postValidateNullableWorkout(date: string, workout: Workout | null): Workout | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .validateLiveNullableWorkoutWrite(date, workout);
}

function postValidateWeekOverlay(overlay: WeekScopedWorkoutOverlay): WeekScopedWorkoutOverlay {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .validateLiveWeekOverlayWrite(overlay);
}

function resolveDateMutationExposureContract(
  date: string,
  workout: Workout,
): { weekStart: string; contract: WeeklyExposureContract } | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .resolveLiveDateMutationExposureContract(date, workout);
}

function resolveEditedWeekExposureContract(
  weekStart: string,
): { weekStart: string; contract: WeeklyExposureContract } | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .resolveLiveEditedWeekExposureContract(weekStart);
}

function mondayForDate(date: string): string {
  const value = new Date(`${date.slice(0, 10)}T12:00:00`);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

/**
 * Persistence is a legacy ingress boundary, not a second programming owner.
 * Old store envelopes may pre-date typed strength intent and canonical
 * component sections, so rehydrate them once through the same finaliser used
 * by generation and edits. Existing modern typed intent wins inside that
 * finaliser; display/scalar fields are compatibility inputs only.
 */
function canonicaliseHydratedWorkout(
  workout: Workout,
  phase?: string,
  weekKind?: Microcycle['weekKind'],
): Workout {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { finaliseWorkoutAfterMutation } = require('../utils/workoutCanonicalisation');
  const canonicalPhase = /pre/i.test(phase ?? '')
    ? 'Pre-season'
    : /off/i.test(phase ?? '')
      ? 'Off-season'
      : /in/i.test(phase ?? '')
        ? 'In-season'
        : undefined;
  return finaliseWorkoutAfterMutation(workout, {
    phase: canonicalPhase,
    weekKind,
    // Persisted allocation ownership is legitimate ingress. This preserves
    // explicit legacy contribution arrays even before plan-entry IDs existed.
    planIntentValid: true,
    referenceWorkout: workout,
    section18EvidenceMode: 'preserve_legacy_unknown',
  }).workout;
}

function canonicaliseHydratedMicrocycle(
  microcycle: Microcycle,
  phase?: string,
  phaseClock?: SeasonPhaseClock,
): Microcycle {
  const selectedPhase = phaseClock?.selectedPhase ?? (
    /pre/i.test(phase ?? '') ? 'Pre-season' :
      /off|base/i.test(phase ?? '') ? 'Off-season' :
        /in/i.test(phase ?? '') ? 'In-season' : null
  );
  const phaseResolution = selectedPhase && phaseClock
    ? resolveSeasonPhaseClock({
        selectedPhase,
        targetWeekStartISO: microcycle.startDate,
        persistedClock: phaseClock,
      })
    : null;
  let exposureContractV2 = microcycle.exposureContractV2 ?? (
    microcycle.exposureContract
      ? migrateLegacyWeeklyExposureContractV2(microcycle.exposureContract, {
          blockNumber: microcycle.miniCycleNumber,
          weekInBlock: ((Math.max(1, microcycle.weekNumber) - 1) % 4) + 1,
          globalWeek: microcycle.weekNumber,
        })
      : undefined
  );
  if (exposureContractV2 && phaseResolution) {
    const expectedSubphase = exposureContractV2.identity.anchorState === 'practice_match'
      ? 'practice_match_week'
      : phaseResolution.subphase ?? exposureContractV2.identity.expectedSubphase;
    exposureContractV2 = {
      ...exposureContractV2,
      identity: {
        ...exposureContractV2.identity,
        seasonPhase: phaseClock!.selectedPhase,
        expectedSubphase,
        phaseWeek: phaseResolution.phaseWeekNumber,
        phaseEntryWeekStartISO: phaseClock!.phaseEntryWeekStartISO,
        phaseClockSelectedPhase: phaseClock!.selectedPhase,
        phaseWeekProvenance: 'preserved_persisted_state',
        weekKind: phaseResolution.weekKind,
      },
    };
  }
  let workouts = microcycle.workouts ?? [];
  if (exposureContractV2) {
    exposureContractV2 = applyGenerationSafetyToSection18Contract({
      contract: exposureContractV2,
    });
    const safety = finaliseSection18SafetyWeek({
      contract: exposureContractV2,
      workouts,
      weekStart: microcycle.startDate.slice(0, 10),
      canonicalContext: {
        phase: exposureContractV2.identity.seasonPhase,
        weekKind: phaseResolution?.weekKind ?? microcycle.weekKind,
        section18EvidenceMode: 'preserve_legacy_unknown',
      },
    });
    workouts = safety.workouts;
    exposureContractV2 = safety.contract;
  } else {
    workouts = workouts.map((workout) =>
      canonicaliseHydratedWorkout(workout, phase, phaseResolution?.weekKind ?? microcycle.weekKind));
  }
  return {
    ...microcycle,
    weekKind: phaseResolution?.weekKind ?? microcycle.weekKind,
    intensityMultiplier: phaseResolution
      ? phaseResolution.weekKind === 'deload'
        ? phaseClock?.selectedPhase === 'Off-season' ? 0.85 : 0.9
        : 1
      : microcycle.intensityMultiplier,
    workouts,
    exposureContractV2,
  };
}

export function canonicaliseHydratedProgram(program: TrainingProgram): TrainingProgram {
  const clockedProgram = ensureProgramSeasonPhaseClock(program);
  return {
    ...clockedProgram,
    microcycles: (clockedProgram.microcycles ?? []).map((microcycle) =>
      canonicaliseHydratedMicrocycle(
        microcycle,
        clockedProgram.programPhase,
        clockedProgram.seasonPhaseClock,
      )),
  };
}

function canonicaliseHydratedSafetyWorkout(
  workout: Workout,
  contract: WeeklyExposureContractV2 | undefined,
  phase?: string,
): Workout {
  return contract
    ? finaliseSection18SafetyWorkout({
        contract,
        workout,
        canonicalContext: {
          phase: contract.identity.seasonPhase,
          section18EvidenceMode: 'preserve_legacy_unknown',
        },
      }).workout
    : canonicaliseHydratedWorkout(workout, phase);
}

function canonicaliseHydratedState(
  persistedState: Partial<ProgramState>,
): Partial<ProgramState> {
  const currentProgram = persistedState.currentProgram
    ? canonicaliseHydratedProgram(persistedState.currentProgram)
    : persistedState.currentProgram;
  const phase = currentProgram?.seasonPhaseClock?.selectedPhase ?? currentProgram?.programPhase;
  const currentMicrocycle = persistedState.currentMicrocycle
    ? canonicaliseHydratedMicrocycle(
        persistedState.currentMicrocycle,
        phase,
        currentProgram?.seasonPhaseClock,
      )
    : persistedState.currentMicrocycle;
  const weekScopedOverlays = persistedState.weekScopedOverlays
    ? Object.fromEntries(Object.entries(persistedState.weekScopedOverlays).map(([weekStart, overlay]) => [
        weekStart,
        (() => {
          let exposureContractV2 = overlay.exposureContractV2 ?? (
            overlay.exposureContract
              ? migrateLegacyWeeklyExposureContractV2(overlay.exposureContract)
              : undefined
          );
          if (exposureContractV2) {
            exposureContractV2 = applyGenerationSafetyToSection18Contract({
              contract: exposureContractV2,
            });
          }
          return {
            ...overlay,
            exposureContractV2,
            workoutsByDate: Object.fromEntries(
              Object.entries(overlay.workoutsByDate).map(([date, workout]) => [
                date,
                workout
                  ? canonicaliseHydratedSafetyWorkout(workout, exposureContractV2, phase)
                  : null,
              ]),
            ),
          };
        })(),
      ]))
    : persistedState.weekScopedOverlays;
  const safetyContractForDate = (date: string): WeeklyExposureContractV2 | undefined => {
    const overlay = weekScopedOverlays?.[mondayForDate(date)];
    if (overlay?.exposureContractV2) return overlay.exposureContractV2;
    const programMicrocycle = currentProgram?.microcycles.find((microcycle) =>
      date >= microcycle.startDate.slice(0, 10) && date <= microcycle.endDate.slice(0, 10));
    if (programMicrocycle?.exposureContractV2) return programMicrocycle.exposureContractV2;
    if (
      currentMicrocycle &&
      date >= currentMicrocycle.startDate.slice(0, 10) &&
      date <= currentMicrocycle.endDate.slice(0, 10)
    ) {
      return currentMicrocycle.exposureContractV2;
    }
    return undefined;
  };
  const dateOverrides = persistedState.dateOverrides
    ? Object.fromEntries(Object.entries(persistedState.dateOverrides).map(([date, workout]) => [
        date,
        canonicaliseHydratedSafetyWorkout(workout, safetyContractForDate(date), phase),
      ]))
    : persistedState.dateOverrides;
  return {
    ...persistedState,
    currentProgram,
    currentMicrocycle,
    todayWorkout: persistedState.todayWorkout
      ? canonicaliseHydratedSafetyWorkout(
          persistedState.todayWorkout,
          safetyContractForDate(todayISOLocal()),
          phase,
        )
      : persistedState.todayWorkout,
    dateOverrides,
    weekScopedOverlays,
  };
}

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
  blockState: StoredProgramBlockState | null;

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

  /** Target-week contracts reconciled by explicit date-level edits. */
  exposureContractsByWeek: Record<string, WeeklyExposureContract>;

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
  setBlockState: (blockState: StoredProgramBlockState | null) => void;
  ensureBlockState: (dateISO?: string) => StoredProgramBlockState;
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
      blockState: null,
      dateOverrides: {},
      overrideContexts: {},
      weekScopedOverlays: {},
      exposureContractsByWeek: {},
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
      setCurrentProgram: (program) => {
        const validatedProgram = program
          ? postValidateProgram(ensureProgramSeasonPhaseClock(program))
          : null;
        set(() => ({
          currentProgram: validatedProgram,
          currentMicrocycle: null,
          todayWorkout: null,
          weekScopedOverlays: {},
          exposureContractsByWeek: {},
          blockState: validatedProgram
            ? deriveStoredBlockStateFromProgram(validatedProgram, undefined)
            : null,
        }));
        if (validatedProgram) {
          const refreshed = new Map<string, WeeklyExposureContract>();
          for (const date of Object.keys(useProgramStore.getState().dateOverrides)) {
            const weekStart = mondayForDate(date);
            if (refreshed.has(weekStart)) continue;
            const resolution = resolveEditedWeekExposureContract(weekStart);
            if (resolution) refreshed.set(weekStart, resolution.contract);
          }
          useProgramStore.setState({ exposureContractsByWeek: Object.fromEntries(refreshed) });
        }
      },

      setBlockState: (blockState) => set({ blockState }),

      ensureBlockState: (dateISO) => {
        const state = useProgramStore.getState();
        if (state.blockState) return state.blockState;
        const derived = deriveStoredBlockStateFromProgram(state.currentProgram, dateISO);
        useProgramStore.setState({ blockState: derived });
        return derived;
      },

      setCurrentMicrocycle: (microcycle) => set({
        currentMicrocycle: microcycle ? postValidateMicrocycle(microcycle) : null,
      }),

      setTodayWorkout: (workout) => set({
        todayWorkout: workout
          ? postValidateNullableWorkout(todayISOLocal(), workout)
          : null,
      }),

      setGenerating: (generating) => set({ isGenerating: generating }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      setManualOverride: (date, workout, context?) => {
        // Raw storage primitive. User-facing tap/coach edit paths must run
        // pre-commit risk checks before reaching this; undo/rebuild/system
        // cleanup paths intentionally keep direct access. The final active-
        // constraint validator still runs here so no producer can reintroduce
        // unsafe work after its own checks.
        const validatedWorkout = postValidateWorkout(date, workout, {
          // A manual override is the explicit edited result. Preserve planned
          // intent for diagnostics, but never resurrect content the edit
          // deliberately removed.
          restoreMissingPlanPatterns: false,
        });
        const exposureResolution = resolveDateMutationExposureContract(date, validatedWorkout);
        set((state) => ({
          dateOverrides: { ...state.dateOverrides, [date]: validatedWorkout },
          exposureContractsByWeek: exposureResolution
            ? {
                ...state.exposureContractsByWeek,
                [exposureResolution.weekStart]: exposureResolution.contract,
              }
            : state.exposureContractsByWeek,
          overrideContexts: context
            ? { ...state.overrideContexts, [date]: context }
            : state.overrideContexts,
        }));
      },

      removeManualOverride: (date) => {
        const weekStart = mondayForDate(date);
        set((state) => {
          const updatedOverrides = { ...state.dateOverrides };
          delete updatedOverrides[date];
          const updatedContexts = { ...state.overrideContexts };
          delete updatedContexts[date];
          const exposureContractsByWeek = { ...state.exposureContractsByWeek };
          delete exposureContractsByWeek[weekStart];
          return {
            dateOverrides: updatedOverrides,
            overrideContexts: updatedContexts,
            exposureContractsByWeek,
          };
        });
        const resolution = resolveEditedWeekExposureContract(weekStart);
        if (resolution) {
          useProgramStore.setState((state) => ({
            exposureContractsByWeek: {
              ...state.exposureContractsByWeek,
              [weekStart]: resolution.contract,
            },
          }));
        }
      },

      clearManualOverrides: () => set({
        dateOverrides: {},
        overrideContexts: {},
        exposureContractsByWeek: {},
      }),

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

      setWeekScopedOverlay: (overlay) => {
        const validatedOverlay = postValidateWeekOverlay(overlay);
        set((state) => ({
          weekScopedOverlays: {
            ...state.weekScopedOverlays,
            [validatedOverlay.weekStart]: validatedOverlay,
          },
        }));
      },

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

          const updatedMicrocycle = postValidateMicrocycle({
            ...state.currentMicrocycle,
            workouts: updatedWorkouts,
          });

          // Also update todayWorkout if it's the same workout
          const updatedToday =
            state.todayWorkout?.id === workoutId
              ? postValidateNullableWorkout(
                  todayISOLocal(),
                  { ...state.todayWorkout, exercises: [...state.todayWorkout.exercises, exercise] },
                )
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

        const updatedMicrocycle = postValidateMicrocycle({
          ...state.currentMicrocycle,
          workouts: updatedWorkouts,
          updatedAt: new Date().toISOString(),
        });

        // Also update todayWorkout if it falls on the same dayOfWeek
        const todayDay = new Date().getDay();
        const updatedToday = todayDay === dayOfWeek
          ? postValidateNullableWorkout(
              todayISOLocal(),
              updatedMicrocycle.workouts.find((w) => w.dayOfWeek === dayOfWeek) || state.todayWorkout,
            )
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
          blockState: null,
          dateOverrides: {},
          overrideContexts: {},
          weekScopedOverlays: {},
          exposureContractsByWeek: {},
          sessionFeedback: {},
          weightOverrides: {},
        });
      },
    }),
    {
      name: 'program-store',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const persistedState = canonicaliseHydratedState(
          (persisted as Partial<ProgramState> | undefined) ?? {},
        );
        const merged = { ...current, ...persistedState } as ProgramState;
        if (!merged.blockState) {
          merged.blockState = deriveStoredBlockStateFromProgram(merged.currentProgram);
        }
        return merged;
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error) return;
        // Both hydration orders are safe: persisted Contract v2 was conformed
        // in merge, then currently-active constraints are projected once the
        // Zustand state is live.
        require('../utils/postGenerationConstraintValidation')
          .revalidateLiveStoredProgramSafety();
      },
    },
  ),
);

export function getCurrentBlockNumberForGeneration(dateISO?: string): number {
  const state = useProgramStore.getState();
  const blockState = state.blockState ?? state.ensureBlockState(dateISO);
  const targetISO = dateISO ?? new Date().toISOString().split('T')[0];
  return getBlockNumberForDate(
    blockState.blockStartDate,
    blockState.blockNumber,
    targetISO,
  );
}

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
