import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useResolvedDay, useVisibleDay } from '../../hooks/useSchedule';
import { useIsOverrideStale } from '../../hooks/useStaleOverrides';
import { useProgramStore } from '../../store/programStore';
import { useProfileStore } from '../../store/profileStore';
import { useCoachContextStateStore } from '../../store/coachContextStateStore';
import { extractModalitiesFromSession } from '../../utils/coachReferenceResolver';
import {
  formatLoadControlLabel,
  isTrueBodyweightExercise,
  resolveLoadControlMode,
  stepBandResistance as nextBandResistance,
  startingWeightForAthlete,
  type BandResistance,
  type LoadControlMode,
} from '../../utils/loadEstimation';
import { logger } from '../../utils/logger';
import {
  getTeamTrainingWorkoutState,
  normalizeTeamTrainingWorkoutForDisplay,
} from '../../utils/teamTraining';
import { projectDayDetail } from '../../rules/visibleDayDetail';
import type { SessionOutcomeTransactionReceipt } from '../../types/sessionOutcome';

// Enable LayoutAnimation on Android (idempotent — safe to call multiple times).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * How long the SessionCompleteMoment stays on screen after a successful
 * feedback save before `navigation.goBack()` fires.
 */
const SESSION_COMPLETE_DISMISS_MS = 2500;

/**
 * useDayWorkout — the day-workout screen's INPUT layer.
 *
 * It used to be two things: the input layer, and a composition that decided what
 * kind of day this was and how to split its exercise list. The second half is
 * gone (Task 6, buttons/UI unit) — it was the fourth projection of the athlete's
 * week and the one that told the third of the three stories Sam photographed.
 * Words and part lists come from `project()` now, through `projectDayDetail`.
 *
 * ## What is left, and it is all input
 * - Weight overrides (+/- buttons, manual edit, BW handling): undefined
 *   override = no override, null override = explicit bodyweight, number = loaded.
 * - Cue disclosure, the video-modal selection, the session-outcome receipt, the
 *   keyboard's editing state, and the finish/feedback flow.
 * - `startFinished` route param boots straight into the feedback flow for
 *   external logging shortcuts.
 *
 * Every one of those keys off the RAW workout's own rows (`exercise.exerciseId`,
 * row ids, exercise names), which is why `useResolvedDay` stays exactly where it
 * was rather than being replaced by the projection.
 *
 * Return shape is deliberately flat — consumers destructure what their JSX
 * needs, matching the HomeScreen hook pattern.
 */
export function useDayWorkout() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const date: string | undefined = route.params?.date;
  const routeWorkoutId: string | undefined = route.params?.workoutId;
  // When startFinished=true the screen boots directly into the post-session
  // flow (feedback panel).
  const startFinished: boolean = !!route.params?.startFinished;

  // ─── UI state local to the screen ───
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [expandedCues, setExpandedCues] = useState<Record<string, boolean>>({});
  const [isFinished, setIsFinished] = useState<boolean>(startFinished);
  // `justSaved` drives the post-save success moment. When the feedback panel
  // calls `handleFeedbackSaved` we flip this on, swap the feedback Card for
  // SessionCompleteMoment, and auto-dismiss the screen after a short beat so
  // the athlete sees the polished "Session logged" state before it fades out.
  const [justSaved, setJustSaved] = useState<boolean>(false);
  const [savedFeedbackReceipt, setSavedFeedbackReceipt] =
    useState<SessionOutcomeTransactionReceipt | null>(null);
  const savedDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Resolved data ───
  //
  // TWO READS, TWO JOBS, AND THEY ARE NOT INTERCHANGEABLE (Task 6).
  //
  // `useResolvedDay` is the INPUT state. Every input surface below keys off the
  // raw workout's own rows: weight overrides are stored per `exercise.exerciseId`,
  // the cue disclosure per row id, the video modal by exercise name, the session
  // receipt per date. Moving those onto projected rows would renumber the
  // athlete's saved weights, so the raw day stays exactly where it was.
  //
  // `useVisibleDay` is the WORDS and the PART LIST — the same projection the week
  // card renders, located by date (`projectWeekFor`, `hooks/useSchedule.ts`). The
  // screen's title, its attached-part line and its section list come from here and
  // from nothing else; the hook composes no account of the day any more.
  const resolved = useResolvedDay(date);
  const visibleDay = useVisibleDay(date);
  const rawWorkout = resolved?.workout ?? null;
  const workout = useMemo(
    () => normalizeTeamTrainingWorkoutForDisplay(rawWorkout),
    [rawWorkout],
  );
  const staleWarning = useIsOverrideStale(date);

  /** Toggle coaching cue visibility for an exercise. */
  const toggleCue = useCallback((exerciseId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCues((prev) => ({ ...prev, [exerciseId]: !prev[exerciseId] }));
  }, []);

  // ─── Weight overrides ───
  const weightOverrides = useProgramStore((s: any) =>
    date ? s.weightOverrides[date] : undefined,
  );
  const setWeightOverride = useProgramStore((s: any) => s.setWeightOverride);
  const bandResistanceOverrides = useProgramStore((s: any) =>
    date ? s.bandResistanceOverrides[date] : undefined,
  );
  const setBandResistanceOverride = useProgramStore(
    (s: any) => s.setBandResistanceOverride,
  );
  // A persisted session-outcome receipt for this date means the session was
  // already finished and saved. Reopening it must show a read-only completed
  // view, not "Finish Session" again (WORKOUT_2026-07-21 row 2.1 / GROUPB
  // finding 1). `justSaved` excludes the just-saved transient success moment,
  // which owns its own auto-dismissing SessionCompleteMoment.
  const persistedReceipt = useProgramStore((s: any) =>
    date ? (s.sessionFeedback[date]?.outcomeReceipt ?? null) : null,
  ) as SessionOutcomeTransactionReceipt | null;
  const isAlreadyComplete = !!persistedReceipt && !justSaved;
  const [editingWeightId, setEditingWeightId] = useState<string | null>(null);
  const [editingWeightText, setEditingWeightText] = useState('');

  // Track which exercise is being edited so commitWeightEdit can find it.
  const editingExerciseRef = useRef<any>(null);

  // Onboarding data for render-time load estimation (catches pre-existing programs).
  const onboardingData = useProfileStore((s: any) => s.onboardingData);

  const getLoadControlMode = useCallback(
    (exercise: any, selectedImplement?: string | null): LoadControlMode =>
      resolveLoadControlMode(exercise.exercise?.name || '', selectedImplement),
    [],
  );

  /** Is this exercise able to return to an unloaded bodyweight state? */
  const isBWExercise = useCallback((exercise: any): boolean => {
    const name = exercise.exercise?.name || '';
    return resolveLoadControlMode(name) === 'bodyweight_plus';
  }, []);

  const getBandResistance = useCallback(
    (exercise: any): BandResistance =>
      bandResistanceOverrides?.[exercise.exerciseId] ?? 'medium',
    [bandResistanceOverrides],
  );

  /**
   * Get the display weight for an exercise:
   *   override > template weight > onboarding estimate > null
   *
   * IMPORTANT: A null override is an *explicit* BW state (user decremented
   * to bodyweight). It must NOT fall through to template/estimate defaults.
   * Only an *undefined* override means "no override exists".
   */
  const getDisplayWeight = useCallback(
    (exercise: any): number | null => {
      const name = exercise.exercise?.name || '';

      // 1. User override (from +/- buttons or manual edit)
      //    undefined = no override → fall through to template/estimate
      //    null      = explicit BW → return null immediately
      //    number>0  = explicit loaded weight
      const overrideRaw = weightOverrides?.[exercise.exerciseId];
      if (overrideRaw !== undefined) {
        if (overrideRaw === null) return null; // explicit BW
        const overrideNum = Number(overrideRaw);
        if (!isNaN(overrideNum) && overrideNum > 0) return overrideNum;
        return null; // override is 0 → BW
      }

      // 2. Stored template weight — coerce defensively (AsyncStorage round-trips
      //    can turn numbers into strings).
      const raw = exercise.prescribedWeightKg;
      const storedNum = raw !== null && raw !== undefined ? Number(raw) : 0;
      if (!isNaN(storedNum) && storedNum > 0) return storedNum;

      // 3. Render-time fallback: estimate from onboarding data.
      //
      //    Goes through `startingWeightForAthlete`, NOT the raw estimator. This
      //    fallback used to call `estimateStartingWeight` directly and so
      //    skipped the beginner multiplier that the generation path applies —
      //    the same complete beginner read one number on a generated card and
      //    another on a card that fell through to here. One owner now answers
      //    for both (Sam, 2026-07-28).
      if (onboardingData && name) {
        if (isTrueBodyweightExercise(name)) return null;
        const estimated = startingWeightForAthlete(name, onboardingData);
        if (__DEV__) {
          // eslint-disable-next-line no-console
          logger.debug(
            `[LoadEst] "${name}" raw=${JSON.stringify(raw)} (${typeof raw}) estimated=${estimated}`,
          );
        }
        if (estimated !== null && estimated > 0) return estimated;
      }

      return null;
    },
    [weightOverrides, onboardingData],
  );

  /**
   * Format weight for display.
   *
   * RENDER-TRUTH (Sam, 2026-07-28): the label is formatted from the resolved
   * load AUTHORITY, not decided here. This function used to ask
   * `isTrueBodyweightExercise` for the label and `getDisplayWeight` for the
   * number independently, so the two could disagree about one exercise — which
   * is how the Dumbbell Pullovers card read "BW" for a dumbbell movement.
   * `formatLoadLabel` takes both from one resolution, so they cannot.
   */
  const formatWeight = useCallback(
    (exercise: any, selectedImplement?: string | null): string => {
      const mode = getLoadControlMode(exercise, selectedImplement);
      return formatLoadControlLabel(
        mode,
        getDisplayWeight(exercise),
        getBandResistance(exercise),
      );
    },
    [getBandResistance, getDisplayWeight, getLoadControlMode],
  );

  /** Increment weight by 2.5kg. BW → BW + 2.5kg. */
  const incrementWeight = useCallback(
    (exercise: any, selectedImplement?: string | null) => {
      if (!date) return;
      const mode = getLoadControlMode(exercise, selectedImplement);
      if (mode !== 'kilograms' && mode !== 'bodyweight_plus') return;
      const current = getDisplayWeight(exercise);
      const next = (current ?? 0) + 2.5;
      setWeightOverride(date, exercise.exerciseId, next);
    },
    [date, getDisplayWeight, getLoadControlMode, setWeightOverride],
  );

  /**
   * Decrement weight by 2.5kg.
   *   BW-capable exercises: … → 5 → 2.5 → BW (null). Stops at BW.
   *   Non-BW exercises:     … → 5 → 2.5. Stops at 2.5 (min loaded weight).
   * Never wraps, never resets to estimated default.
   */
  const decrementWeight = useCallback(
    (exercise: any, selectedImplement?: string | null) => {
      if (!date) return;
      const mode = getLoadControlMode(exercise, selectedImplement);
      if (mode !== 'kilograms' && mode !== 'bodyweight_plus') return;
      const current = getDisplayWeight(exercise);
      const isBW = mode === 'bodyweight_plus';

      if (isBW) {
        if (current === null || current <= 0) return;
        const next = current - 2.5;
        setWeightOverride(date, exercise.exerciseId, next <= 0 ? null : next);
      } else {
        if (current === null || current <= 2.5) return;
        const next = Math.max(2.5, current - 2.5);
        setWeightOverride(date, exercise.exerciseId, next);
      }
    },
    [date, getDisplayWeight, getLoadControlMode, setWeightOverride],
  );

  const changeBandResistance = useCallback(
    (exercise: any, direction: -1 | 1) => {
      if (!date) return;
      setBandResistanceOverride(
        date,
        exercise.exerciseId,
        nextBandResistance(getBandResistance(exercise), direction),
      );
    },
    [date, getBandResistance, setBandResistanceOverride],
  );

  const incrementBandResistance = useCallback(
    (exercise: any) => changeBandResistance(exercise, 1),
    [changeBandResistance],
  );

  const decrementBandResistance = useCallback(
    (exercise: any) => changeBandResistance(exercise, -1),
    [changeBandResistance],
  );

  /** Start manual weight editing for an exercise. */
  const startEditingWeight = useCallback(
    (exercise: any) => {
      const current = getDisplayWeight(exercise);
      editingExerciseRef.current = exercise;
      setEditingWeightId(exercise.exerciseId);
      setEditingWeightText(current === null || current === 0 ? '' : String(current));
    },
    [getDisplayWeight],
  );

  /** Commit the manual weight edit — called by onBlur and onSubmitEditing. */
  const commitWeightEdit = useCallback(() => {
    if (!date || !editingExerciseRef.current) return;
    const exercise = editingExerciseRef.current;
    const text = editingWeightText.trim().toLowerCase();

    // Clear editing state first to prevent duplicate saves.
    setEditingWeightId(null);
    editingExerciseRef.current = null;

    // BW / "bw" / "0" → explicit bodyweight.
    if (text === '' || text === 'bw' || text === '0') {
      setWeightOverride(date, exercise.exerciseId, null);
      return;
    }
    // BW+X pattern (e.g. "bw+10", "BW + 20").
    const bwPlusMatch = text.match(/^bw\s*\+\s*(\d+(?:\.\d+)?)$/);
    if (bwPlusMatch) {
      const extra = parseFloat(bwPlusMatch[1]);
      if (!isNaN(extra) && extra > 0) {
        setWeightOverride(date, exercise.exerciseId, extra);
      }
      return;
    }
    // Plain number.
    const num = parseFloat(text);
    if (!isNaN(num) && num >= 0) {
      setWeightOverride(date, exercise.exerciseId, num === 0 ? null : num);
    }
    // Invalid input — drop silently without saving.
  }, [date, editingWeightText, setWeightOverride]);

  /**
   * Dismiss any active weight edit when user starts scrolling.
   * Blurring the TextInput triggers onBlur → commitWeightEdit → saves value.
   */
  const handleScrollBeginDrag = useCallback(() => {
    if (editingWeightId) {
      Keyboard.dismiss();
    }
  }, [editingWeightId]);

  // ─── Navigation handlers ───
  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleFinishWorkout = useCallback(() => {
    setIsFinished(true);
  }, []);

  /**
   * Called by feedback panel Save button. Instead of navigating back
   * immediately, flip `justSaved` so the V2/Classic render layers swap the
   * feedback Card for SessionCompleteMoment, then dismiss the screen after a
   * short beat (SESSION_COMPLETE_DISMISS_MS). The delay is long enough to
   * register the check-mark spring + week-consistency copy without feeling
   * sticky.
   */
  const handleFeedbackSaved = useCallback((receipt: SessionOutcomeTransactionReceipt) => {
    if (savedDismissTimer.current) {
      clearTimeout(savedDismissTimer.current);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSavedFeedbackReceipt(receipt);
    setJustSaved(true);
    savedDismissTimer.current = setTimeout(() => {
      savedDismissTimer.current = null;
      navigation.goBack();
    }, SESSION_COMPLETE_DISMISS_MS);
  }, [navigation]);

  // Clear the auto-dismiss timer if the screen unmounts first (e.g. the
  // athlete hits the hardware back button before the delay fires).
  useEffect(() => {
    return () => {
      if (savedDismissTimer.current) {
        clearTimeout(savedDismissTimer.current);
        savedDismissTimer.current = null;
      }
    };
  }, []);

  // Phase 2: write the currently-opened workout into the coach context
  // store so the reference resolver can anchor "it"/"that session" to
  // this date when the athlete switches to the Coach tab. We stamp
  // modality tokens (rower / bike / run / sprint…) extracted from the
  // session name + exercise list so "the row" matches without us
  // re-reading the workout body in the resolver. See
  // src/store/coachContextStateStore.ts.
  const setLastOpenedWorkout = useCoachContextStateStore(
    (s) => s.setLastOpenedWorkout,
  );
  useEffect(() => {
    if (!date || !workout) return;
    const modalities = extractModalitiesFromSession({
      name: workout.name,
      exercises: workout.exercises,
    });
    setLastOpenedWorkout({
      date,
      sessionName: workout.name ?? 'session',
      modalities,
      source: 'day_workout',
    });
  }, [date, workout, setLastOpenedWorkout]);

  // ─── The detail surface, read from the one projection ───
  //
  // This memo used to be the day-detail composition over the raw workout — the fourth
  // projection of the athlete's week, computed at render, and the one that told
  // the third of the three stories Sam photographed. It is gone: the screen's
  // title, attached-part line and section list are `projectDayDetail(visibleDay)`,
  // a pure reading of `project()`.
  //
  // `dayDetailCompositionOwnershipTests` pins the consequence — `composeDayDetail`
  // has exactly ONE production caller now, `rules/projectVisibleWeek.ts`, and this
  // hook is not it.
  const detail = useMemo(() => projectDayDetail(visibleDay), [visibleDay]);

  // The team-training state read the input layer needs: `isTeamOnly` gates the
  // "Edit exercises" door and `buildEditableExercises`, both of which act on raw
  // rows. Read straight from the team-training owner — the same call
  // `composeDayDetail` made — rather than through a composition of the day.
  const isTeamOnly = useMemo(
    () => getTeamTrainingWorkoutState(rawWorkout).isTeamTrainingOnly,
    [rawWorkout],
  );

  return {
    // Route
    date,
    routeWorkoutId,

    // Resolved data
    workout,
    staleWarning,

    // UI state
    selectedExercise,
    setSelectedExercise,
    expandedCues,
    toggleCue,
    isFinished,
    justSaved,
    savedFeedbackReceipt,
    persistedReceipt,
    isAlreadyComplete,

    // Weight-override API
    editingWeightId,
    editingWeightText,
    setEditingWeightText,
    formatWeight,
    getDisplayWeight,
    getLoadControlMode,
    getBandResistance,
    isBWExercise,
    incrementWeight,
    decrementWeight,
    incrementBandResistance,
    decrementBandResistance,
    startEditingWeight,
    commitWeightEdit,

    // Handlers
    handleBack,
    handleFinishWorkout,
    handleFeedbackSaved,
    handleScrollBeginDrag,

    // The detail surface — projection-derived words and part list.
    detail,
    // An input-layer fact, NOT a composition of the day: `isTeamOnly` gates the
    // exercise-edit door, which acts on raw rows.
    isTeamOnly,
  };
}
