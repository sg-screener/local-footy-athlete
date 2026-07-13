import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useResolvedDay } from '../../hooks/useSchedule';
import { useIsOverrideStale } from '../../hooks/useStaleOverrides';
import { useProgramStore } from '../../store/programStore';
import { useProfileStore } from '../../store/profileStore';
import { useCoachContextStateStore } from '../../store/coachContextStateStore';
import { extractModalitiesFromSession } from '../../utils/coachReferenceResolver';
import { isTrueBodyweightExercise, estimateStartingWeight } from '../../utils/loadEstimation';
import {
  DESCRIPTIVE_CONDITIONING_TYPES,
  LEGACY_FLAVOUR_TITLE,
  DAY_NAMES,
} from './dayWorkoutHelpers';
import { logger } from '../../utils/logger';
import {
  getTeamTrainingWorkoutState,
  normalizeTeamTrainingWorkoutForDisplay,
} from '../../utils/teamTraining';
import { getSessionComponentRows } from '../../utils/sessionComponents';
import { projectConditioningVisibleIdentity } from '../../utils/conditioningVisibleIdentity';

// Enable LayoutAnimation on Android (idempotent — safe to call multiple times).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * How long the SessionCompleteMoment stays on screen after a successful
 * feedback save before `navigation.goBack()` fires. Shared by both the V2
 * and Classic render layers because they both consume this hook.
 */
const SESSION_COMPLETE_DISMISS_MS = 2500;

/**
 * useDayWorkout — shared orchestration for DayWorkoutScreen (Classic + V2).
 *
 * Reads the route date, resolves the day, derives the session category
 * (team-only / recovery / conditioning / combined / strength), and wires
 * all the weight-override and feedback-flow handlers. The Classic and V2
 * render layers consume this identically — only the visuals differ.
 *
 * ## Behaviour contract
 * Reproduces the inline DayWorkoutScreen logic bit-for-bit:
 * - Weight overrides (+/- buttons, manual edit, BW handling): undefined
 *   override = no override, null override = explicit bodyweight, number = loaded.
 * - startFinished route param boots straight into the feedback flow for
 *   external logging shortcuts.
 * - Conditioning options resolution: structured `conditioningBlock` first,
 *   legacy keyword-tail fallback second, empty array otherwise.
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
  const savedDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Resolved data ───
  const resolved = useResolvedDay(date);
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
  const [editingWeightId, setEditingWeightId] = useState<string | null>(null);
  const [editingWeightText, setEditingWeightText] = useState('');

  // Track which exercise is being edited so commitWeightEdit can find it.
  const editingExerciseRef = useRef<any>(null);

  // Onboarding data for render-time load estimation (catches pre-existing programs).
  const onboardingData = useProfileStore((s: any) => s.onboardingData);

  /** Is this exercise a true bodyweight exercise? */
  const isBWExercise = useCallback((exercise: any): boolean => {
    const name = exercise.exercise?.name || '';
    return isTrueBodyweightExercise(name);
  }, []);

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
      if (onboardingData && name) {
        if (isTrueBodyweightExercise(name)) return null;
        const estimated = estimateStartingWeight(name, onboardingData);
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

  /** Format weight for display — only true BW exercises show BW / BW + Xkg. */
  const formatWeight = useCallback(
    (exercise: any): string => {
      const weightKg = getDisplayWeight(exercise);
      const isBW = isBWExercise(exercise);

      if (isBW) {
        if (weightKg && weightKg > 0) return `BW + ${weightKg}kg`;
        return 'BW';
      }

      if (weightKg === null || weightKg === undefined || weightKg === 0) return '-';
      return `${weightKg}kg`;
    },
    [getDisplayWeight, isBWExercise],
  );

  /** Increment weight by 2.5kg. BW → BW + 2.5kg. */
  const incrementWeight = useCallback(
    (exercise: any) => {
      if (!date) return;
      const current = getDisplayWeight(exercise);
      const next = (current ?? 0) + 2.5;
      setWeightOverride(date, exercise.exerciseId, next);
    },
    [date, getDisplayWeight, setWeightOverride],
  );

  /**
   * Decrement weight by 2.5kg.
   *   BW-capable exercises: … → 5 → 2.5 → BW (null). Stops at BW.
   *   Non-BW exercises:     … → 5 → 2.5. Stops at 2.5 (min loaded weight).
   * Never wraps, never resets to estimated default.
   */
  const decrementWeight = useCallback(
    (exercise: any) => {
      if (!date) return;
      const current = getDisplayWeight(exercise);
      const isBW = isBWExercise(exercise);

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
    [date, getDisplayWeight, isBWExercise, setWeightOverride],
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
  const handleFeedbackSaved = useCallback(() => {
    if (savedDismissTimer.current) {
      clearTimeout(savedDismissTimer.current);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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

  /** Explicit stale-banner fallback → coach tab with context. */
  const handleReviewStale = useCallback(
    (prefill: string) => {
      navigation.navigate('CoachTab', {
        screen: 'Coach',
        params: { prefill },
      });
    },
    [navigation],
  );

  // ─── Derived session categorisation + content resolution ───
  //
  // All of the "what kind of workout is this, and how do we split the
  // exercise list" logic happens here so both Classic and V2 consume the
  // same resolved structures and can focus purely on rendering.
  const derived = useMemo(() => {
    if (!workout) {
      return {
        exerciseCount: 0,
        dayName: '',
        isTeamOnly: false,
        isRecovery: false,
        isConditioning: false,
        isCombinedDay: false,
        strengthExercises: [] as any[],
        supportExercises: [] as any[],
        conditioningExercises: [] as any[],
        conditioningOptions: [] as ResolvedConditioningOption[],
        conditioningRowCount: 0,
      };
    }

    const teamState = getTeamTrainingWorkoutState(rawWorkout);
    const exerciseCount = teamState.renderableExercises.length;
    const dayName = DAY_NAMES[workout.dayOfWeek] || '';

    // Team Training is a session commitment, not a gym exercise. The
    // shared state object filters malformed legacy rows out of every
    // render branch and tells the UI whether a separate Team Training
    // card should be shown.
    const hasTeamTraining = teamState.hasTeamTraining;
    const isTeamOnly = teamState.isTeamTrainingOnly;

    // Recovery sessions — structured prescriptions, play buttons, formatted
    // sets/duration/reps. Detect via workoutType OR sessionTier to catch
    // AI-generated sessions with the wrong workoutType but correct tier.
    const isRecovery =
      !isTeamOnly &&
      (workout.workoutType === 'Recovery' ||
        (workout as any).sessionTier === 'recovery');

    // Conditioning sessions — descriptive phase cards, no numbered exercises.
    // Recovery wins when both would match (AI may tag recovery as Conditioning).
    const isConditioning =
      !isTeamOnly &&
      DESCRIPTIVE_CONDITIONING_TYPES.has(workout.workoutType) &&
      !isRecovery;

    // ── Combined S+C day: resolve conditioning from workout.conditioningBlock ──
    //
    // The builder attaches a structured `conditioningBlock` with a single
    // intent and one or more training-equivalent options. Each option owns
    // its title, description, and the ids of the WorkoutExercise rows it
    // renders — so header and rows can never drift.
    const isCombinedDay =
      !!workout.hasCombinedConditioning && !isConditioning && !isRecovery;
    const condBlock = workout.conditioningBlock;
    const conditioningIdentity = projectConditioningVisibleIdentity(workout);
    const componentRows = getSessionComponentRows(workout);
    const strengthExercises = componentRows.strengthRows;
    const supportExercises = componentRows.supportRows;
    const conditioningExercises = componentRows.conditioningRows;
    let conditioningOptions: ResolvedConditioningOption[] = [];

    if (isCombinedDay && condBlock) {
      // Structured path — drive rows from resolved exerciseIds only.
      conditioningOptions = condBlock.options.map((opt: any) => {
        const optIds = new Set<string>(opt.exerciseIds);
        return {
          title: conditioningIdentity?.attachedLabel ?? opt.title,
          description: opt.description,
          rows: conditioningExercises.filter((ex: any) => optIds.has(ex.id)),
        };
      });
    } else if (isCombinedDay && conditioningExercises.length > 0) {
      // Legacy fallback uses the shared component owner to separate the tail;
      // trunk/support rows cannot leak into conditioning.
      const legacyTitle =
        (workout.conditioningFlavour &&
          LEGACY_FLAVOUR_TITLE[workout.conditioningFlavour]) ||
        'Conditioning';
      conditioningOptions = [
        {
          title: conditioningIdentity?.attachedLabel ?? legacyTitle,
          description: '',
          rows: conditioningExercises,
        },
      ];
    }

    const conditioningRowCount = conditioningOptions.reduce(
      (sum, o) => sum + o.rows.length,
      0,
    );

    return {
      exerciseCount,
      dayName,
      isTeamOnly,
      isRecovery,
      isConditioning,
      isCombinedDay,
      hasTeamTraining,
      strengthExercises,
      supportExercises,
      conditioningExercises,
      conditioningOptions,
      conditioningRowCount,
    };
  }, [rawWorkout, workout]);

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

    // Weight-override API
    editingWeightId,
    editingWeightText,
    setEditingWeightText,
    formatWeight,
    getDisplayWeight,
    isBWExercise,
    incrementWeight,
    decrementWeight,
    startEditingWeight,
    commitWeightEdit,

    // Handlers
    handleBack,
    handleFinishWorkout,
    handleFeedbackSaved,
    handleScrollBeginDrag,
    handleReviewStale,

    // Derived
    ...derived,
  };
}

export type ResolvedConditioningOption = {
  title: string;
  description: string;
  rows: any[];
};
