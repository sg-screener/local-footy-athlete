import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Polygon } from 'react-native-svg';
import { Text } from '../../components/common/Text';
import { Card, Button, IconButton, SectionLabel, Sheet } from '../../components/ui';
import { GuidedInjuryFlowSheet } from './GuidedInjuryFlowSheet';
import ExerciseVideoModal from '../../components/ExerciseVideoModal';
import { StaleOverrideBanner } from '../../components/StaleOverrideBanner';
import { KeyboardSafeArea } from '../../components/keyboard/KeyboardSafeArea';
import { getCoachNoteDisplay } from '../../utils/coachNoteSummary';
import { SessionFeedbackPanel } from '../../components/SessionFeedbackPanel';
import { SessionCompleteMoment } from '../../components/SessionCompleteMoment';
import { MobilityPrehabFlowSection } from '../../components/MobilityPrehabFlowSection';
import { getSmokeRuntimeSignal } from '../../utils/smokeBootstrap';
import { shortWeekdayDateLabel, todayISOLocal } from '../../utils/appDate';
import {
  executeProgramControlAction,
  executeProgramControlActionDurably,
} from '../../utils/programControlActions';
import {
  observeRenderedAthleteActionOutcome,
  registerAthleteActionUIOutcome,
} from '../../dev/e2e/athleteActionUIObservation';
import { formatExerciseDisplayName } from '../../utils/exerciseDisplay';
import { classifyBibleInjurySeverity } from '../../rules/injurySeverityBands';
import {
  buildGuidedInjuryConstraint,
  guidedInjuryBucketForArea,
  type GuidedInjuryFlowResult,
} from '../../utils/guidedInjuryControl';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import { useProfileStore } from '../../store/profileStore';
import { useReadinessStore } from '../../store/readinessStore';
import {
  getTapSwapChoices,
  resolveTapSwapEnvironment,
  type TapSwapChoice,
  type TapSwapHierarchyTier,
  type TapSwapPrimaryInjury,
  type TapSwapReason,
} from '../../utils/tapSwapHierarchy';
import type { RecoveryAddonBlock } from '../../types/domain';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { useDayWorkout } from './useDayWorkout';
import { selectMobilityPrehabFlow } from '../../utils/mobilityPrehabFlow';
import { useAthleteContext, useResolvedWeekForDate } from '../../hooks/useSchedule';
import {
  buildDayWorkoutSmokeContractErrorResult,
  deriveDayWorkoutSmokeContract,
  type DayWorkoutSmokeContractResult,
} from './dayWorkoutSmokeContract';
import {
  buildCueText,
  cleanNotes,
  formatRest,
  inferRecoveryPrescriptionType,
  formatRecoveryPrescription,
  formatStrengthSetsReps,
  formatConditioningRowPrescription,
} from './dayWorkoutHelpers';
import { isTeamTrainingItem } from '../../utils/teamTraining';
import {
  buildSessionTemplate,
  sessionListLabels,
  type SessionTemplateItem,
} from '../../utils/sessionTemplate';
import { deriveVisibleWorkoutIdentity } from '../../utils/visibleWorkoutIdentity';
import { stableTestIdToken } from '../../utils/stableTestId';
import { explorerTestId } from '../../utils/stableTestId';
import { ExplorerRenderWitness } from '../../components/ExplorerRenderWitness';
import { AppTextInput } from '../../components/keyboard/AppTextInput';

type EditableExercise = {
  key: string;
  name: string;
  targetId?: string;
  raw?: any;
};

type SuggestedExercise = {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  weight?: number;
  notes?: string;
  prescriptionType?: 'reps' | 'duration' | 'duration_minutes' | 'distance';
  perSide?: boolean;
  restSeconds?: number;
};

type SuggestedSwap =
  | {
      kind: 'exercise';
      suggestion: SuggestedExercise;
      hierarchyTier: TapSwapHierarchyTier;
      reason: string;
    }
  | {
      kind: 'rest';
      hierarchyTier: 'rest';
      reason: string;
    };

type ExercisePickAction = 'swap' | 'remove' | 'concern';
type ExerciseConcern = 'No equipment' | 'Too hard / too easy';
type SwapReason =
  | 'No equipment'
  | 'Injury / pain'
  | 'Too hard'
  | 'Too easy'
  | "Don't like it"
  | 'Other';
type AddExerciseKind =
  | 'Upper body'
  | 'Lower body'
  | 'Midline'
  | 'Prehab'
  | 'Mobility'
  | 'Conditioning finisher'
  | 'Other';
type InjuryArea =
  | 'Shoulder'
  | 'Elbow'
  | 'Wrist'
  | 'Lower back'
  | 'Hip'
  | 'Groin'
  | 'Knee'
  | 'Hamstring'
  | 'Ankle'
  | 'Other';
type InjurySeverity = 'Mild' | 'Moderate' | 'Severe';

type FutureScopeStep =
  | { kind: 'future_scope'; action: 'remove'; exercise: EditableExercise }
  | {
      kind: 'future_scope';
      action: 'swap';
      exercise: EditableExercise;
      suggestion: SuggestedExercise;
      reason: SwapReason | ExerciseConcern | 'Injury / pain';
      injuryArea?: InjuryArea;
      injurySeverity?: InjurySeverity;
    }
  | {
      kind: 'future_scope';
      action: 'add';
      addKind: AddExerciseKind;
      suggestion: SuggestedExercise;
    };

type ExerciseEditStep =
  | { kind: 'closed' }
  | { kind: 'menu' }
  | { kind: 'exercise_menu'; exercise: EditableExercise }
  | { kind: 'pick_exercise'; action: ExercisePickAction }
  | { kind: 'swap_reason'; exercise: EditableExercise }
  | { kind: 'add_kind' }
  | { kind: 'confirm_remove'; exercise: EditableExercise }
  | {
      kind: 'confirm_swap';
      exercise: EditableExercise;
      suggestion: SuggestedSwap;
      reason: SwapReason | ExerciseConcern | 'Injury / pain';
      injuryArea?: InjuryArea;
      injurySeverity?: InjurySeverity;
    }
  | {
      kind: 'confirm_add';
      addKind: AddExerciseKind;
      suggestion: SuggestedExercise;
    }
  | FutureScopeStep
  | { kind: 'concern_reason'; exercise: EditableExercise }
  | { kind: 'injury_area'; exercise: EditableExercise }
  | { kind: 'injury_severity'; exercise: EditableExercise; area: InjuryArea }
  | { kind: 'coach_fallback'; title: string; message: string; prefill: string }
  | { kind: 'result'; ok: boolean; title: string; message: string };

const SWAP_REASONS: SwapReason[] = [
  'No equipment',
  'Injury / pain',
  'Too hard',
  'Too easy',
  "Don't like it",
  'Other',
];

const ADD_EXERCISE_KINDS: AddExerciseKind[] = [
  'Upper body',
  'Lower body',
  'Midline',
  'Prehab',
  'Mobility',
  'Conditioning finisher',
  'Other',
];

const INJURY_AREAS: InjuryArea[] = [
  'Shoulder',
  'Elbow',
  'Wrist',
  'Lower back',
  'Hip',
  'Groin',
  'Knee',
  'Hamstring',
  'Ankle',
  'Other',
];

const INJURY_SEVERITIES: InjurySeverity[] = ['Mild', 'Moderate', 'Severe'];

function getExerciseName(exercise: any, fallback = 'Exercise'): string {
  return String(exercise?.exercise?.name || exercise?.name || fallback).trim();
}

function displayExerciseName(name: string | null | undefined, fallback = 'Exercise'): string {
  return formatExerciseDisplayName(name) || fallback;
}

function buildEditableExercises(workout: any, isTeamOnly: boolean): EditableExercise[] {
  if (!workout || isTeamOnly) return [];
  return (workout.exercises ?? [])
    .filter((exercise: any) => !isTeamTrainingItem(exercise))
    .map((exercise: any) => {
      const targetId = exercise.id || exercise.exerciseId || exercise.exercise?.id;
      if (!targetId) return null;
      return {
        key: String(targetId),
        name: getExerciseName(exercise),
        targetId: String(targetId),
        raw: exercise,
      };
    })
    .filter((exercise: EditableExercise | null): exercise is EditableExercise =>
      exercise !== null && !!exercise.name);
}

function baseSuggestion(
  name: string,
  raw?: any,
  overrides: Partial<SuggestedExercise> = {},
): SuggestedExercise {
  const sets = Number(raw?.prescribedSets) || 3;
  const repsMin = Number(raw?.prescribedRepsMin) || 8;
  const repsMax = Number(raw?.prescribedRepsMax) || Math.max(repsMin, 10);
  return {
    name,
    sets,
    repsMin,
    repsMax,
    weight: overrides.weight ?? raw?.prescribedWeightKg,
    notes: overrides.notes,
    prescriptionType: overrides.prescriptionType ?? raw?.prescriptionType,
    perSide: overrides.perSide ?? raw?.perSide,
    restSeconds: overrides.restSeconds ?? raw?.restSeconds,
    ...overrides,
  };
}

function tapSwapReason(reason: SwapReason | ExerciseConcern): TapSwapReason {
  if (reason === 'No equipment') return 'no_equipment';
  if (reason === 'Injury / pain') return 'injury_or_pain';
  if (reason === 'Too hard' || reason === 'Too hard / too easy') return 'too_hard';
  if (reason === 'Too easy') return 'too_easy';
  if (reason === "Don't like it") return 'preference';
  return 'other';
}

function injurySeverityNumber(severity: InjurySeverity): number {
  if (severity === 'Mild') return 2;
  if (severity === 'Moderate') return 6;
  return 9;
}

function suggestedSwapFromChoice(
  exercise: EditableExercise,
  choice: TapSwapChoice,
): SuggestedSwap {
  if (choice.kind === 'rest' || !choice.name) {
    return {
      kind: 'rest',
      hierarchyTier: 'rest',
      reason: choice.reason,
    };
  }
  return {
    kind: 'exercise',
    suggestion: baseSuggestion(
      choice.name,
      exercise.raw,
      choice.prescription ?? {},
    ),
    hierarchyTier: choice.hierarchyTier,
    reason: choice.reason,
  };
}

function guidedAreaToExerciseArea(area: string): InjuryArea {
  const key = area.toLowerCase();
  if (/shoulder|chest|ribs|neck|upper body/.test(key)) return 'Shoulder';
  if (/elbow/.test(key)) return 'Elbow';
  if (/wrist|hand/.test(key)) return 'Wrist';
  if (/lower back|upper back|back|abs|side|midline/.test(key)) return 'Lower back';
  if (/hip/.test(key)) return 'Hip';
  if (/groin|adductor/.test(key)) return 'Groin';
  if (/knee|quad/.test(key)) return 'Knee';
  if (/hamstring|hammy/.test(key)) return 'Hamstring';
  if (/ankle|foot|calf|achilles/.test(key)) return 'Ankle';
  return 'Other';
}

/**
 * Map the Bible's four severity bands onto the app's three-value
 * `InjurySeverity`. The MAPPING is local — the app has always had three names
 * for four bands — but the BAND EDGES are not: they belong to
 * `rules/injurySeverityBands.ts`, whose header says consumers "should not own
 * their own numeric thresholds". This site used to restate them as 8 and 4.
 */
function guidedSeverityToExerciseSeverity(result: GuidedInjuryFlowResult): InjurySeverity {
  if (result.seriousSymptoms) return 'Severe';
  switch (classifyBibleInjurySeverity(result.severity).band) {
    case 'pause_affected_8_10': return 'Severe';
    case 'restrict_and_refer_6_7':
    case 'reduce_affected_4_5': return 'Moderate';
    default: return 'Mild';
  }
}

function suggestAddExercise(
  kind: AddExerciseKind,
  existingExercises: EditableExercise[],
): SuggestedExercise | null {
  if (kind === 'Other') return null;
  const existing = new Set(existingExercises.map((exercise) => exercise.name.toLowerCase()));
  const candidates: Record<Exclude<AddExerciseKind, 'Other'>, SuggestedExercise[]> = {
    'Upper body': [
      { name: 'Face Pulls', sets: 2, repsMin: 12, repsMax: 15, notes: 'Keep it controlled.' },
      { name: 'Push-Ups', sets: 2, repsMin: 8, repsMax: 12 },
    ],
    'Lower body': [
      // Sam ruled 2026-07-25: "Split Squat" named a progression the curated
      // vocabulary does not have, so the suggestion points at Reverse Lunges
      // rather than at Bulgarian Split Squats — mapping it to Bulgarian would
      // have handed a beginner the HARDER variant, which is the opposite of what
      // the split-squat suggestion was for.
      { name: 'Reverse Lunges', sets: 2, repsMin: 8, repsMax: 10, perSide: true },
      { name: 'Hip Thrust', sets: 2, repsMin: 10, repsMax: 12 },
    ],
    Midline: [
      { name: 'Pallof Press', sets: 2, repsMin: 10, repsMax: 12, perSide: true },
      { name: 'Dead Bug', sets: 2, repsMin: 8, repsMax: 10, perSide: true },
    ],
    Prehab: [
      { name: 'Copenhagen Plank (Half)', sets: 2, repsMin: 20, repsMax: 30, prescriptionType: 'duration', perSide: true },
      // Sam ruled 2026-07-25: Single-Leg Calf Raise. The PRESCRIPTION had to move
      // with the name — the old entry was a 30-45s isometric hold, and the
      // curated raise is 12-15 reps per side. Keeping the duration would have
      // prescribed "30-45 seconds" of a rep-counted movement. Dose matches the
      // curated pool entry (CALVES_POOL), including its 3-second lowering.
      { name: 'Single-Leg Calf Raise', sets: 2, repsMin: 12, repsMax: 15, prescriptionType: 'reps', perSide: true, notes: '3-second lowering.' },
    ],
    Mobility: [
      // Sam ruled 2026-07-25: Hip 90/90 Stretch. Flow-capable suggestions are a
      // POSSIBLE FUTURE BUILD, not now — this table emits single exercises, so a
      // suggestion naming a whole composed flow has nowhere to land.
      // The prescription moved with the name: 5-8 MINUTES of a flow becomes
      // 30-45 SECONDS per side of a stretch, matching MOBILITY_POOL.
      { name: 'Hip 90/90 Stretch', sets: 2, repsMin: 30, repsMax: 45, prescriptionType: 'duration', perSide: true, notes: 'Breathe into the stretch.' },
      // Sam approved 2026-07-25: "T-Spine Openers" was the same drill under a
      // name the app could not cue, so it now names the curated entry.
      { name: 'Open Book Thoracic Rotation', sets: 2, repsMin: 6, repsMax: 8, perSide: true },
    ],
    'Conditioning finisher': [
      // Sam approved 2026-07-25: both finishers named formats that did not exist
      // in the vocabulary, so both rendered blank. They now name the curated
      // conditioning entries; the notes carry the "easy, not a test" intent that
      // the invented "Finisher" suffix used to.
      { name: 'Easy Bike', sets: 1, repsMin: 8, repsMax: 10, prescriptionType: 'duration_minutes', notes: 'Easy-moderate pace.' },
      { name: 'Tempo Run', sets: 1, repsMin: 8, repsMax: 10, prescriptionType: 'duration_minutes', notes: 'Smooth, not a test.' },
    ],
  };
  return candidates[kind].find((candidate) => !existing.has(candidate.name.toLowerCase())) ?? null;
}

function suggestionPrescription(suggestion: SuggestedExercise): string {
  const reps =
    suggestion.repsMin === suggestion.repsMax
      ? `${suggestion.repsMin}`
      : `${suggestion.repsMin}-${suggestion.repsMax}`;
  if (suggestion.prescriptionType === 'duration') {
    return `${suggestion.sets} x ${reps}s${suggestion.perSide ? ' / side' : ''}`;
  }
  if (suggestion.prescriptionType === 'duration_minutes') {
    return `${suggestion.sets} x ${reps} min${suggestion.perSide ? ' / side' : ''}`;
  }
  if (suggestion.prescriptionType === 'distance') {
    return `${suggestion.sets} x ${reps}m${suggestion.perSide ? ' / side' : ''}`;
  }
  return `${suggestion.sets} x ${reps}${suggestion.perSide ? ' / side' : ''}`;
}

/**
 * DayWorkoutScreenV2 — redesigned session screen matching HomeScreenV2.
 *
 * ## Design direction
 * - Bolder header: muted eyebrow ("MONDAY"), big title and session-type subtitle.
 * - Exercise cards: larger readable names, integrated accent play IconButton,
 *   cleaner two-column stats grid (Sets×Reps | Weight), polished segmented
 *   weight control, collapsible coaching cues.
 * - Superset/paired grouping: wrapped in a Card(tone="accent") container with
 *   a subtle lime tint so the pairing reads at a glance.
 * - Conditioning: descriptive phase Cards with lime phase labels.
 * - Recovery: structured prescription lines in accent, integrated play button.
 * - Finish moment: full-width primary Button (size="lg", glow) in its own
 *   elevated section at the bottom of the scroll — the "ship it" cue.
 *
 * ## Logic parity
 * All state lives in `useDayWorkout`; this file is presentation only.
 * Swapping between Classic and V2 produces identical session data, only the
 * rendering differs.
 */
export default function DayWorkoutScreenV2() {
  const {
    date,
    routeWorkoutId,
    workout,
    staleWarning,
    selectedExercise,
    setSelectedExercise,
    expandedCues,
    toggleCue,
    isFinished,
    justSaved,
    savedFeedbackReceipt,
    persistedReceipt,
    isAlreadyComplete,
    editingWeightId,
    editingWeightText,
    setEditingWeightText,
    formatWeight,
    incrementWeight,
    decrementWeight,
    startEditingWeight,
    commitWeightEdit,
    handleBack,
    handleFinishWorkout,
    handleFeedbackSaved,
    handleScrollBeginDrag,
    handleReviewStale,
    exerciseCount,
    isTeamOnly,
    isRecovery,
    isConditioning,
    isCombinedDay,
    strengthExercises,
  } = useDayWorkout();

  const smokeCoachBikeFlow =
    __DEV__ && getSmokeRuntimeSignal().flow === 'coach-bike-flow';
  const [exerciseEditStep, setExerciseEditStep] =
    React.useState<ExerciseEditStep>({ kind: 'closed' });
  const [injuryFlowExercise, setInjuryFlowExercise] =
    React.useState<EditableExercise | null>(null);
  const [
    pendingComponentDeletionObservation,
    setPendingComponentDeletionObservation,
  ] = React.useState<{
    traceId: string;
    observationId: string;
    componentId: string;
    targetId?: string;
    exerciseKey: string;
  } | null>(null);

  const editableExercises = React.useMemo(
    () => buildEditableExercises(workout, isTeamOnly),
    [workout, isTeamOnly],
  );

  /**
   * The one list. Composed once from the whole workout — see
   * `src/utils/sessionTemplate.ts` for why this is an owner rather than a
   * render helper.
   */
  const sessionTemplate = React.useMemo(
    () => buildSessionTemplate(workout),
    [workout],
  );

  /**
   * The collapsed Mobility & Prehab flow. Game week is read off the resolved
   * week this date belongs to — a real signal the schedule already owns, rather
   * than a flag the flow would otherwise have to guess at (and so never use).
   */
  const seasonPhase = useProfileStore(
    (s: any) => s.onboardingData?.seasonPhase ?? null,
  );
  const resolvedWeek = useResolvedWeekForDate(date);
  const isGameWeek = React.useMemo(
    () => resolvedWeek.some((day) => day.indicator === 'game'),
    [resolvedWeek],
  );
  const flowAthlete = useAthleteContext();
  const mobilityFlow = React.useMemo(
    () => selectMobilityPrehabFlow({
      workout,
      seasonPhase,
      isGameWeek,
      athlete: flowAthlete,
      date,
    }),
    [workout, seasonPhase, isGameWeek, flowAthlete, date],
  );
  React.useEffect(() => {
    if (!pendingComponentDeletionObservation) return;
    const targetStillRendered = editableExercises.some((exercise) =>
      pendingComponentDeletionObservation.targetId
        ? exercise.targetId === pendingComponentDeletionObservation.targetId
        : exercise.key === pendingComponentDeletionObservation.exerciseKey);
    if (targetStillRendered) return;
    const resultTestID = explorerTestId.componentDeleteResult(
      workout.id,
      pendingComponentDeletionObservation.componentId,
    );
    observeRenderedAthleteActionOutcome({
      traceId: pendingComponentDeletionObservation.traceId,
      observationId: pendingComponentDeletionObservation.observationId,
      renderedText: {
        componentId: pendingComponentDeletionObservation.componentId,
        targetStillRendered,
        visibleComponentIds: editableExercises.map((exercise) =>
          exercise.targetId ?? exercise.key),
      },
      controlId: resultTestID,
      accessibilityNode: {
        resultTestID,
        workoutExerciseRowTestIDs: editableExercises.map((exercise) =>
          `workout-exercise-row-${stableTestIdToken(exercise.targetId ?? exercise.key)}`),
      },
      screenshotReference:
        'screenshots/trace-v2-component-deletion-after-mutation.png',
      hierarchyReference:
        'accessibility-hierarchy/trace-v2-component-deletion-after-mutation.json',
    });
    setPendingComponentDeletionObservation(null);
  }, [editableExercises, pendingComponentDeletionObservation, workout.id]);

  const closeExerciseEditor = React.useCallback(
    () => setExerciseEditStep({ kind: 'closed' }),
    [],
  );

  const openExerciseEditor = React.useCallback(() => {
    if (isTeamOnly || editableExercises.length === 0) return;
    setExerciseEditStep({ kind: 'menu' });
  }, [editableExercises.length, isTeamOnly]);

  const openSpecificExerciseEditor = React.useCallback((exercise: any) => {
    const editable = buildEditableExercises({ exercises: [exercise] }, false)[0];
    if (!editable) return;
    setExerciseEditStep({ kind: 'exercise_menu', exercise: editable });
  }, []);

  const askCoachForExerciseEdit = React.useCallback(
    (prefill: string) => {
      closeExerciseEditor();
      handleReviewStale(prefill);
    },
    [closeExerciseEditor, handleReviewStale],
  );

  const workoutLabel = workout?.name ?? 'this session';
  const dateLabel = date ?? 'today';

  const showExerciseEditFallback = React.useCallback(
    (title: string, message: string, prefill: string) => {
      setExerciseEditStep({ kind: 'coach_fallback', title, message, prefill });
    },
    [],
  );

  const openExerciseInjuryFlow = React.useCallback((exercise: EditableExercise) => {
    setExerciseEditStep({ kind: 'closed' });
    setInjuryFlowExercise(exercise);
  }, []);

  const suggestTapSwap = React.useCallback(
    (
      exercise: EditableExercise,
      reason: SwapReason | ExerciseConcern,
      primaryInjury: TapSwapPrimaryInjury | null = null,
    ): SuggestedSwap => {
      const dateISO = date ?? todayISOLocal();
      const environment = resolveTapSwapEnvironment({
        date: dateISO,
        profile: useProfileStore.getState().onboardingData,
        activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
        readinessSignal: useReadinessStore.getState().signalsByDate[dateISO],
        primaryInjury,
      });
      const choice = getTapSwapChoices({
        originalExercise: exercise.name,
        reason: tapSwapReason(reason),
        environment,
        primaryInjury,
        existingExerciseNames: editableExercises.map((item) => item.name),
      })[0];
      return suggestedSwapFromChoice(exercise, choice);
    },
    [date, editableExercises],
  );

  const prepareSwap = React.useCallback(
    (exercise: EditableExercise, reason: SwapReason) => {
      if (reason === 'Injury / pain') {
        openExerciseInjuryFlow(exercise);
        return;
      }
      setExerciseEditStep({
        kind: 'confirm_swap',
        exercise,
        suggestion: suggestTapSwap(exercise, reason),
        reason,
      });
    },
    [openExerciseInjuryFlow, suggestTapSwap],
  );

  const prepareAdd = React.useCallback(
    (kind: AddExerciseKind) => {
      const suggestion = suggestAddExercise(kind, editableExercises);
      if (!suggestion) {
        showExerciseEditFallback(
          'Ask Coach',
          'I need a bit more detail before changing this safely.',
          `Add one ${kind.toLowerCase()} exercise or small block to ${workoutLabel} on ${dateLabel}.`,
        );
        return;
      }
      setExerciseEditStep({ kind: 'confirm_add', addKind: kind, suggestion });
    },
    [dateLabel, editableExercises, showExerciseEditFallback, workoutLabel],
  );

  const prepareConcern = React.useCallback(
    (exercise: EditableExercise, concern: ExerciseConcern) => {
      const reason: SwapReason = concern === 'No equipment' ? 'No equipment' : 'Too hard';
      setExerciseEditStep({
        kind: 'confirm_swap',
        exercise,
        suggestion: suggestTapSwap(exercise, reason),
        reason: concern,
      });
    },
    [suggestTapSwap],
  );

  const prepareInjurySwap = React.useCallback(
    (exercise: EditableExercise, area: InjuryArea, severity: InjurySeverity) => {
      const bucket = guidedInjuryBucketForArea(area);
      const primaryInjury = bucket
        ? { bucket, severity: injurySeverityNumber(severity) }
        : null;
      setExerciseEditStep({
        kind: 'confirm_swap',
        exercise,
        suggestion: suggestTapSwap(exercise, 'Injury / pain', primaryInjury),
        reason: 'Injury / pain',
        injuryArea: area,
        injurySeverity: severity,
      });
    },
    [suggestTapSwap],
  );

  const applyExerciseGuidedInjury = React.useCallback(
    async (result: GuidedInjuryFlowResult) => {
      const exercise = injuryFlowExercise;
      if (!date || !exercise) return;
      const constraint = buildGuidedInjuryConstraint(result, { todayISO: date });
      const trainingPaused = constraint.adjustmentLevel === 'training_paused';
      const actionResult = await executeProgramControlActionDurably({
        type: 'set_injury_modifier',
        source: { screen: 'session_detail', surface: 'exercise_injury_flow', initiatedBy: 'tap' },
        scope: 'current_and_future',
        payload: { constraint },
        requiresRebuild: false,
        createsActiveModifier: true,
        oneOffOnly: false,
      }, { todayISO: date });
      setInjuryFlowExercise(null);

      if (trainingPaused || !actionResult.ok) {
        setExerciseEditStep({
          kind: 'result',
          ok: actionResult.ok,
          title: trainingPaused ? 'Training paused for injury' : 'Injury adjustment active',
          message: trainingPaused
            ? 'Affected training is paused until you get medical or physio advice.'
            : 'Affected work will be avoided. Coach Notes will show this until you clear it.',
        });
        return;
      }

      const area = guidedAreaToExerciseArea(result.area);
      const severity = guidedSeverityToExerciseSeverity(result);
      const primaryInjury = constraint.bucket
        ? { bucket: constraint.bucket as TapSwapPrimaryInjury['bucket'], severity: constraint.severity }
        : null;
      setExerciseEditStep({
        kind: 'confirm_swap',
        exercise,
        suggestion: suggestTapSwap(exercise, 'Injury / pain', primaryInjury),
        reason: 'Injury / pain',
        injuryArea: area,
        injurySeverity: severity,
      });
    },
    [date, injuryFlowExercise, suggestTapSwap],
  );

  const applySwapToday = React.useCallback(
    (step: Extract<ExerciseEditStep, { kind: 'confirm_swap' }>) => {
      if (!date) return;
      const result = step.suggestion.kind === 'rest'
        ? executeProgramControlAction({
            type: 'remove_exercise',
            source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
            scope: 'today_only',
            payload: {
              date,
              exercise: step.exercise.name,
              exerciseId: step.exercise.targetId,
            },
            requiresRebuild: false,
            createsActiveModifier: false,
            oneOffOnly: true,
          })
        : executeProgramControlAction({
            type: 'swap_exercise',
            source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
            scope: 'today_only',
            payload: {
              date,
              fromExercise: step.exercise.name,
              fromExerciseId: step.exercise.targetId,
              toExercise: step.suggestion.suggestion,
            },
            requiresRebuild: false,
            createsActiveModifier: false,
            oneOffOnly: true,
          });
      if (result.ok) {
        if (step.suggestion.kind === 'rest') {
          setExerciseEditStep({
            kind: 'future_scope',
            action: 'remove',
            exercise: step.exercise,
          });
          return;
        }
        setExerciseEditStep({
          kind: 'future_scope',
          action: 'swap',
          exercise: step.exercise,
          suggestion: step.suggestion.suggestion,
          reason: step.reason,
          injuryArea: step.injuryArea,
          injurySeverity: step.injurySeverity,
        });
        return;
      }
      setExerciseEditStep({
        kind: 'result',
        ok: false,
        title: 'Could not swap exercise',
        message: result.message ?? 'Nothing changed.',
      });
    },
    [date],
  );

  const applyAddToday = React.useCallback(
    (step: Extract<ExerciseEditStep, { kind: 'confirm_add' }>) => {
      if (!date) return;
      const result = executeProgramControlAction({
        type: 'add_exercise',
        source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
        scope: 'today_only',
        payload: {
          date,
          exercise: step.suggestion,
        },
        requiresRebuild: false,
        createsActiveModifier: false,
        oneOffOnly: true,
      });
      if (result.ok) {
        setExerciseEditStep({
          kind: 'future_scope',
          action: 'add',
          addKind: step.addKind,
          suggestion: step.suggestion,
        });
        return;
      }
      setExerciseEditStep({
        kind: 'result',
        ok: false,
        title: 'Could not add exercise',
        message: result.message ?? 'Nothing changed.',
      });
    },
    [date],
  );

  const saveFutureExerciseAdjustment = React.useCallback(
    (step: FutureScopeStep) => {
      if (step.action === 'remove') {
        const result = executeProgramControlAction({
          type: 'add_exercise_preference',
          source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
          scope: 'future_weeks',
          payload: {
            exercise: step.exercise.name,
            preferenceKind: 'avoid_exercise',
          },
          requiresRebuild: false,
          createsActiveModifier: true,
          oneOffOnly: false,
        });
        if (!result.ok) {
          setExerciseEditStep({
            kind: 'result',
            ok: false,
            title: 'Could not save future change',
            message: result.message ?? 'Today’s session is still updated.',
          });
          return;
        }
        setExerciseEditStep({
          kind: 'result',
          ok: true,
          title: 'Future adjustment saved',
          message: `Avoid ${displayExerciseName(step.exercise.name)} in similar sessions.`,
        });
        return;
      }

      if (step.action === 'swap') {
        const result = executeProgramControlAction({
          type: 'add_exercise_preference',
          source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
          scope: 'future_weeks',
          payload: {
            exercise: step.exercise.name,
            alternative: step.suggestion.name,
            preferenceKind: 'preferred_alternative',
          },
          requiresRebuild: false,
          createsActiveModifier: true,
          oneOffOnly: false,
        });
        if (!result.ok) {
          setExerciseEditStep({
            kind: 'result',
            ok: false,
            title: 'Could not save future change',
            message: result.message ?? 'Today’s session is still updated.',
          });
          return;
        }
        const label = step.injuryArea
          ? `Replace ${displayExerciseName(step.exercise.name)} with ${displayExerciseName(step.suggestion.name)} when ${step.injuryArea.toLowerCase()} is irritated.`
          : `Replace ${displayExerciseName(step.exercise.name)} with ${displayExerciseName(step.suggestion.name)} where appropriate.`;
        setExerciseEditStep({
          kind: 'result',
          ok: true,
          title: 'Future adjustment saved',
          message: label,
        });
        return;
      }

      const result = executeProgramControlAction({
        type: 'add_exercise_preference',
        source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
        scope: 'future_weeks',
        payload: {
          exercise: step.suggestion.name,
          alternative: step.suggestion.name,
          focus: step.addKind.toLowerCase(),
          preferenceKind: 'add_focus',
        },
        requiresRebuild: false,
        createsActiveModifier: true,
        oneOffOnly: false,
      });
      if (!result.ok) {
        setExerciseEditStep({
          kind: 'result',
          ok: false,
          title: 'Could not save future change',
          message: result.message ?? 'Today’s session is still updated.',
        });
        return;
      }
      const focus = step.addKind.toLowerCase();
      const label = `Add extra ${focus} work in similar sessions.`;
      setExerciseEditStep({
        kind: 'result',
        ok: true,
        title: 'Future adjustment saved',
        message: label,
      });
    },
    [],
  );

  const closeFutureScopeTodayOnly = React.useCallback(() => {
    closeExerciseEditor();
  }, [closeExerciseEditor]);

  const removeExerciseToday = React.useCallback(
    async (exercise: EditableExercise) => {
      if (!date) return;
      const result = await executeProgramControlActionDurably({
        type: 'remove_exercise',
        source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
        scope: 'today_only',
        payload: {
          date,
          exercise: exercise.name,
          exerciseId: exercise.targetId,
        },
        requiresRebuild: false,
        createsActiveModifier: false,
        oneOffOnly: true,
      });
      if (result.ok) {
        if (result.traceId) {
          const componentId = exercise.targetId ?? exercise.key;
          const observationId = `day-workout-component-deletion:${result.traceId}`;
          registerAthleteActionUIOutcome({
            traceId: result.traceId,
            observationId,
            domainReturn: {
              ok: result.ok,
              date,
              componentId,
            },
            controlId: explorerTestId.componentDeleteResult(workout.id, componentId),
          });
          setPendingComponentDeletionObservation({
            traceId: result.traceId,
            observationId,
            componentId,
            targetId: exercise.targetId,
            exerciseKey: exercise.key,
          });
        }
        setExerciseEditStep({ kind: 'future_scope', action: 'remove', exercise });
        return;
      }
      setExerciseEditStep({
        kind: 'result',
        ok: false,
        title: 'Could not remove exercise',
        message: result.message ?? 'Nothing changed.',
      });
    },
    [date, workout.id],
  );

  const askCoachForTeamTraining = React.useCallback(
    (message: string) => {
      askCoachForExerciseEdit(`${message} Session: ${workoutLabel}. Date: ${dateLabel}.`);
    },
    [askCoachForExerciseEdit, dateLabel, workoutLabel],
  );
  // Wrap derivation in try/catch so a thrown contract still produces a
  // failed marker with reason=contract-error instead of leaving the
  // screen silent.
  const smokeContract: DayWorkoutSmokeContractResult = React.useMemo(() => {
    try {
      return deriveDayWorkoutSmokeContract({
        workout,
        date,
        workoutId: routeWorkoutId,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        `[smoke-dayworkout-contract] derive-error ${(e as Error)?.message ?? String(e)}`,
      );
      return buildDayWorkoutSmokeContractErrorResult({
        error: e,
        date,
        workoutId: routeWorkoutId,
      });
    }
  }, [workout, date, routeWorkoutId]);

  React.useEffect(() => {
    if (!smokeCoachBikeFlow) return;
    // eslint-disable-next-line no-console
    console.warn(
      smokeContract.state === 'ready'
        ? `[smoke-dayworkout-contract] ready ${smokeContract.label}`
        : `[smoke-dayworkout-contract] failed ${smokeContract.label}`,
    );
  }, [smokeCoachBikeFlow, smokeContract.state, smokeContract.label]);

  // ── Missing-workout fallback ──
  if (!workout) {
    return (
      <SafeAreaView style={styles.container}>
        {smokeCoachBikeFlow
          ? renderDayWorkoutSmokeContractMarkers(smokeContract)
          : null}
        <View style={styles.headerTopRow}>
          <IconButton
            onPress={handleBack}
            accessibilityLabel="Back"
            tone="default"
            icon={<ChevronLeft />}
          />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Workout not found</Text>
          <Text style={styles.emptyBody}>
            Go back and try again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  const visibleWorkoutTitle = deriveVisibleWorkoutIdentity(workout).title;

  // Header subtitle — "Recovery", "Upper Push", "Upper Push + Conditioning", etc.
  const subtitleText = isRecovery
    ? 'Recovery'
    : isCombinedDay
    ? `${workout.workoutType} + Conditioning`
    : workout.workoutType;

  // Subtitle meta count — only show when a real list is rendered.
  const metaCount = isTeamOnly
    ? 0
    : isCombinedDay
    ? strengthExercises.length
    : isConditioning || isRecovery
    ? 0
    : exerciseCount;

  // Combined "Fri 3/7 · 6 exercises · Strength" subtitle. All fragments are
  // merged into a single line of plain body text — no stacked labels, no
  // uppercase chips. Date leads (matching the dated day rows on the
  // Program tab), then count so the athlete's eye lands on volume.
  const dateFragment = date ? shortWeekdayDateLabel(date) : '';
  const countFragment =
    metaCount > 0 ? `${metaCount} exercise${metaCount !== 1 ? 's' : ''}` : '';
  const combinedSubtitle = [dateFragment, countFragment, subtitleText]
    .filter(Boolean)
    .join(' · ');

  return (
    <SafeAreaView style={styles.container} testID="workout-screen">
      <ExplorerRenderWitness testID={explorerTestId.sessionDetail(workout.id)} />
      {editableExercises.map((exercise) => (
        <ExplorerRenderWitness
          key={`component-identity-${exercise.key}`}
          testID={explorerTestId.componentIdentity(
            workout.id,
            exercise.targetId ?? exercise.key,
          )}
        />
      ))}
      {/*
        Top-of-screen mirror of the contract markers, mounted as a
        sibling of the header. The IDENTICAL markers also render
        beside day-workout-title below so they share that title's
        gate. Either path proves the marker can reach Maestro; if
        BOTH paths fail something is fundamentally wrong with the
        screen render itself (caught upstream by day-workout-title's
        own visibility assertion).
        NOTE: only ONE set of testIDs will be visible at a time —
        React Native's hit-test resolves to whichever is on top in
        the layout. The inline-with-title set is the canonical one;
        this top-level mirror exists purely as a redundancy.
        Actually, the two sets would create duplicate testIDs which
        Maestro treats as "ambiguous match" → fails the assertVisible.
        Drop this top-level mirror; the inline marker is sufficient.
      */}
      {/* ─── Sticky header ─── */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <IconButton
            onPress={handleBack}
            accessibilityLabel="Back"
            tone="default"
            icon={<ChevronLeft />}
          />
        </View>
        <View style={styles.headerContent}>
          {/* Pro mode header: title → single metadata sentence. */}
          <Text
            style={styles.headerTitle}
            numberOfLines={2}
            testID="day-workout-title"
            accessibilityLabel={`Workout: ${visibleWorkoutTitle}`}
          >
            {visibleWorkoutTitle}
          </Text>
          {/*
            DayWorkout smoke contract markers — mounted in the EXACT
            same render path as day-workout-title (sibling inside the
            same headerContent View) so they share its render gate.
            Maestro asserts:
              assertVisible smoke-dayworkout-contract-mounted
              assertVisible smoke-dayworkout-contract-ready
              assertNotVisible smoke-dayworkout-contract-failed
            If day-workout-title rendered but the markers below didn't,
            the only explanation is a runtime exception between the
            two — which the React error boundary would surface anyway.
            The renderer NEVER returns null and ALWAYS emits the
            mounted marker, so no silent state is possible.
          */}
          {smokeCoachBikeFlow
            ? renderDayWorkoutSmokeContractMarkers(smokeContract)
            : null}
          {combinedSubtitle ? (
            <Text style={styles.headerSubtitle}>
              {combinedSubtitle}
            </Text>
          ) : null}
          {/*
            Session-level change door. The weekly Program card owns
            day/session edits; inside an opened workout this link edits
            exercises only. Lives in the sticky header so it stays
            reachable at any scroll depth. Quiet lime link, never a CTA.
          */}
          {date && !isTeamOnly && editableExercises.length > 0 ? (
            <Pressable
              onPress={openExerciseEditor}
              style={({ pressed }) => [
                styles.makeChangeLink,
                pressed && { opacity: 0.7 },
              ]}
              testID="day-workout-make-change-link"
            >
              <Text style={styles.makeChangeText}>Edit exercises</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/*
        The whole day scroll routes through the shared keyboard owner so the
        inline weight editor's numeric keypad gets the one Done bar and
        scroll-into-view (census finding #9). `dismissOnBackgroundTap` is off —
        the body is a tappable session list, not a form. Device-verify (L10).
      */}
      <KeyboardSafeArea
        style={styles.scroll}
        dismissOnBackgroundTap={false}
        scrollProps={{
          contentContainerStyle: styles.scrollContent,
          showsVerticalScrollIndicator: false,
          onScrollBeginDrag: handleScrollBeginDrag,
        }}
      >
        {/* Stale override warning */}
        {staleWarning ? (
          <View style={styles.banner}>
            <StaleOverrideBanner
              warning={staleWarning}
              onReview={(prefill) => handleReviewStale(prefill)}
            />
          </View>
        ) : null}

        {/* Coach-authored attribution — ONE concise sentence at most, plus
            an optional "Show changes" disclosure for the audit log. The
            severity-aware tail comes from activeConstraints; the per-
            exercise removed/replaced/focus list is hidden by default. */}
        <CoachNoteBanner
          notes={workout.coachNotes ?? []}
          workoutName={visibleWorkoutTitle}
          workoutType={workout.workoutType}
        />

        {/* Session description (rare — usually null) */}
        {workout.description ? (
          <Text
            style={styles.sessionDescription}
            testID="day-workout-description"
          >
            {workout.description}
          </Text>
        ) : null}

        {/*
          ── The session body ──

          D13: the session is ONE list. `buildSessionTemplate` is the single
          composition owner — it reads the whole workout once and emits every
          applicable row in D2 order, each carrying its role badge. The screen
          no longer decides what to mount; it renders what the owner returned.

          This is why team training can no longer go missing on a conditioning
          day (spec §2 item 4c): there is no branch left that could swallow it.

          Recovery-type days are the one ruled exception (§6 item 3) — they keep
          their own simple template, badge-free, with the add-on box intact.
        */}
        {sessionTemplate.mode === 'recovery' ? (
          <>
            {/*
              No power primer here. It used to reach recovery days only because
              it rendered ABOVE the old branch split — an accident of layout,
              not a prescription. Sam ruled 2026-07-27 that power work does not
              belong on a recovery day, so the legacy behaviour was preserving a
              bug rather than conserving content.
            */}
            <RecoveryBlock
              exercises={workout.exercises ?? []}
              expandedCues={expandedCues}
              toggleCue={toggleCue}
              onSelectExercise={setSelectedExercise}
              onChangeExercise={openSpecificExerciseEditor}
            />
            <RecoveryAddonSection
              addons={workout.recoveryAddons ?? []}
              expandedCues={expandedCues}
              toggleCue={toggleCue}
            />
          </>
        ) : (
          <>
            {/*
              Sits ABOVE the first list row, collapsed. Optional, never logged,
              never gates Finish — see MobilityPrehabFlowSection for why it is
              styled to read as available rather than as a first task.
            */}
            <MobilityPrehabFlowSection flow={mobilityFlow} />
            <SessionList
              items={sessionTemplate.items}
              expandedCues={expandedCues}
              toggleCue={toggleCue}
              editingWeightId={editingWeightId}
              editingWeightText={editingWeightText}
              setEditingWeightText={setEditingWeightText}
              formatWeight={formatWeight}
              incrementWeight={incrementWeight}
              decrementWeight={decrementWeight}
              startEditingWeight={startEditingWeight}
              commitWeightEdit={commitWeightEdit}
              onSelectExercise={setSelectedExercise}
              onChangeExercise={openSpecificExerciseEditor}
            />
          </>
        )}

        {/* ── Reopen of a completed session → read-only summary ── */}
        {isAlreadyComplete && date ? (
          <View style={styles.feedbackSection}>
            <SessionCompleteMoment
              date={date}
              receipt={persistedReceipt}
              headline="Session complete"
            />
          </View>
        ) : /* ── Post-finish: feedback → success moment → auto-dismiss ── */
        isFinished && date ? (
          <View style={styles.feedbackSection}>
            {justSaved ? (
              <SessionCompleteMoment date={date} receipt={savedFeedbackReceipt} />
            ) : (
              <SessionFeedbackPanel date={date} workout={workout} onSave={handleFeedbackSaved} />
            )}
          </View>
        ) : null}

        {/* ── Finish moment (hidden once the session is complete) ── */}
        {!isFinished && !isAlreadyComplete ? (
          <FinishMoment onPress={handleFinishWorkout} />
        ) : null}
      </KeyboardSafeArea>

      <ExerciseVideoModal
        visible={!!selectedExercise}
        exerciseName={selectedExercise || ''}
        onClose={() => setSelectedExercise(null)}
      />

      <ExerciseEditSheet
        visible={exerciseEditStep.kind !== 'closed'}
        sessionId={workout.id}
        step={exerciseEditStep}
        editableExercises={editableExercises}
        onClose={closeExerciseEditor}
        onStep={setExerciseEditStep}
        onSwapReason={prepareSwap}
        onAddKind={prepareAdd}
        onConcern={prepareConcern}
        onInjuryStart={openExerciseInjuryFlow}
        onInjurySeverity={prepareInjurySwap}
        onApplySwapToday={applySwapToday}
        onApplyAddToday={applyAddToday}
        onRemoveToday={removeExerciseToday}
        onFutureScope={saveFutureExerciseAdjustment}
        onTodayOnly={closeFutureScopeTodayOnly}
        onAskCoachTeam={askCoachForTeamTraining}
      />
      <GuidedInjuryFlowSheet
        visible={injuryFlowExercise !== null}
        onClose={() => setInjuryFlowExercise(null)}
        onComplete={applyExerciseGuidedInjury}
        titlePrefix={displayExerciseName(injuryFlowExercise?.name, 'Injury / pain')}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

/**
 * DayWorkout smoke contract markers — mounted directly in the same
 * render path as testID="day-workout-title" so the markers and the
 * title share the exact same gate. Maestro's order is:
 *   1. assertVisible day-workout-title
 *   2. assertVisible smoke-dayworkout-contract-mounted
 *   3. assertVisible smoke-dayworkout-contract-ready
 *   4. assertNotVisible smoke-dayworkout-contract-failed
 *
 * Renders THREE markers (no silent state allowed):
 *   • smoke-dayworkout-contract-mounted — always renders in smoke
 *     mode, regardless of workout / derivation. Proves the mount
 *     point reached the live UI tree.
 *   • smoke-dayworkout-contract-ready   — only when result.state === 'ready'.
 *   • smoke-dayworkout-contract-failed  — only when result.state === 'failed'.
 *
 * All markers use real native Views with collapsable={false}, real
 * backgroundColor, ≥30×30 px, MAX-INT zIndex/elevation.
 */
function renderDayWorkoutSmokeContractMarkers(
  result: DayWorkoutSmokeContractResult,
) {
  const isReady = result.state === 'ready';
  return (
    <View
      accessible={false}
      collapsable={false}
      pointerEvents="none"
      style={styles.smokeContractMarkerRoot}
      testID="smoke-dayworkout-contract-root"
    >
      {/* Mount probe — proves the render path reached this JSX. */}
      <View
        accessible={true}
        accessibilityLabel={`smoke-dayworkout-contract-mounted ${result.label}`}
        collapsable={false}
        pointerEvents="none"
        style={styles.smokeContractMounted}
        testID="smoke-dayworkout-contract-mounted"
      >
        <Text style={styles.smokeContractMarkerText}>
          {`smoke-dayworkout-contract-mounted ${result.label}`}
        </Text>
      </View>
      {isReady ? (
        <View
          accessible={true}
          accessibilityLabel={result.label}
          collapsable={false}
          pointerEvents="none"
          style={[styles.smokeContractMarker, styles.smokeContractReady]}
          testID="smoke-dayworkout-contract-ready"
        >
          <Text style={styles.smokeContractMarkerText}>{result.label}</Text>
        </View>
      ) : (
        <View
          accessible={true}
          accessibilityLabel={result.label}
          collapsable={false}
          pointerEvents="none"
          style={[styles.smokeContractMarker, styles.smokeContractFailed]}
          testID="smoke-dayworkout-contract-failed"
        >
          <Text style={styles.smokeContractMarkerText}>{result.label}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * CoachNoteBanner — single concise sentence at the top of the screen.
 *
 * Why this exists:
 *   The engine's coachNotes are an audit log: "Removed Back Squat",
 *   "Replaced Deadlift with Goblet Squat", "Focus: Upper body". Pre-MVP
 *   we rendered every line. The result was a wall of bullets the
 *   athlete had to scan before starting the warm-up — exactly the kind
 *   of overwhelm the App Store rejection callout flagged.
 *
 *   Now we collapse N notes into ONE summary line. If the engine
 *   emitted a restriction/rule note, we show that concise note by
 *   default. Generic adjustment flags are intentionally hidden.
 *
 *   Detail lines (the original audit log) sit behind a "Show changes"
 *   toggle for the curious athlete or QA — they're not removed, just
 *   hidden by default.
 */
function CoachNoteBanner({
  notes,
  workoutName,
  workoutType,
}: {
  notes: string[];
  workoutName?: string;
  workoutType?: string;
}) {
  const [showDetails, setShowDetails] = React.useState(false);

  const summary = getCoachNoteDisplay(notes, { workoutName, workoutType });
  if (!summary.summaryLine) return null;
  const hasDetails = summary.shouldShowDetails;

  return (
    <View style={styles.coachNotesBanner} testID="coach-note-banner">
      <Text style={styles.coachNotesEyebrow}>COACH UPDATE</Text>
      <Text
        style={styles.coachNotesText}
        numberOfLines={2}
        ellipsizeMode="tail"
        testID="coach-note-banner-line"
      >
        {summary.summaryLine}
      </Text>

      {hasDetails && (
        <Pressable
          onPress={() => setShowDetails((v) => !v)}
          style={styles.coachNotesToggle}
          testID="coach-note-banner-toggle"
          hitSlop={8}
        >
          <Text style={styles.coachNotesToggleText}>
            {showDetails ? 'Hide changes' : 'Show changes'}
          </Text>
        </Pressable>
      )}

      {showDetails && hasDetails && (
        <View style={styles.coachNotesDetails} testID="coach-note-banner-details">
          {summary.detailLines.map((line, i) => (
            <Text
              key={`coach-detail-${i}`}
              style={styles.coachNotesDetailLine}
            >
              • {line}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * The one list.
 *
 * Every item the composition owner emitted, rendered in the order it emitted
 * them. There are no section headers and no boxes: what separates one row from
 * the next is whitespace, exactly as the flat exercise list already did.
 *
 * The only grouping left is the superset rail — a pairing is a real
 * prescription fact ("do these back to back"), not decoration, so consecutive
 * members of one group are wrapped in the existing lime rail. Every other
 * structural device the screen used to draw was a category header, and
 * categories are now carried by each row's own badge.
 */
interface SessionListProps {
  items: SessionTemplateItem[];
  expandedCues: Record<string, boolean>;
  toggleCue: (exerciseId: string) => void;
  editingWeightId: string | null;
  editingWeightText: string;
  setEditingWeightText: (s: string) => void;
  formatWeight: (ex: any) => string;
  incrementWeight: (ex: any) => void;
  decrementWeight: (ex: any) => void;
  startEditingWeight: (ex: any) => void;
  commitWeightEdit: () => void;
  onSelectExercise: (name: string) => void;
  onChangeExercise: (exercise: any) => void;
}
function SessionList({
  items,
  expandedCues,
  toggleCue,
  editingWeightId,
  editingWeightText,
  setEditingWeightText,
  formatWeight,
  incrementWeight,
  decrementWeight,
  startEditingWeight,
  commitWeightEdit,
  onSelectExercise,
  onChangeExercise,
}: SessionListProps) {
  if (items.length === 0) return null;

  // Numbers are a property of the LIST, not of a row — a superset takes one
  // slot however its members are ordered — so they are computed once, up here.
  const labels = sessionListLabels(items);

  const renderItem = (item: SessionTemplateItem, key: string, index: number) => {
    if (item.kind === 'team_training') {
      return <TeamTrainingBanner key={key} />;
    }
    if (item.kind === 'conditioning_choice') {
      return (
        <ConditioningChoiceRow
          key={key}
          options={item.options}
          onChangeExercise={onChangeExercise}
        />
      );
    }
    if (item.presentation === 'conditioning_phase') {
      return (
        <ConditioningPhaseRow
          key={key}
          exercise={item.row}
          onChangeExercise={onChangeExercise}
        />
      );
    }
    if (item.presentation === 'addon') {
      return (
        <AddonRow
          key={key}
          exercise={item.row}
          expandedCues={expandedCues}
          toggleCue={toggleCue}
        />
      );
    }
    return (
      <StrengthExerciseCard
        key={key}
        exercise={item.row}
        label={labels[index] ?? ''}
        isGrouped={!!item.superset}
        isLastInGroup={
          !item.superset || item.superset.index === item.superset.size - 1
        }
        expandedCues={expandedCues}
        toggleCue={toggleCue}
        editingWeightId={editingWeightId}
        editingWeightText={editingWeightText}
        setEditingWeightText={setEditingWeightText}
        formatWeight={formatWeight}
        incrementWeight={incrementWeight}
        decrementWeight={decrementWeight}
        startEditingWeight={startEditingWeight}
        commitWeightEdit={commitWeightEdit}
        onSelectExercise={onSelectExercise}
        onChangeExercise={onChangeExercise}
      />
    );
  };

  // Where the optional cluster starts. The owner guarantees it is contiguous and
  // last, so ONE index is all the renderer needs to know — it never decides which
  // rows the header covers, it only draws the boundary the owner already set.
  const optionalStart = items.findIndex(
    (item) => item.kind === 'exercise' && item.optional,
  );

  // Walk the flat list once, wrapping consecutive members of a superset group
  // in the pairing rail. The owner already guarantees they are adjacent.
  const rendered: React.ReactNode[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (i === optionalStart) {
      rendered.push(<OptionalWorkHeader key="optional-work-header" />);
    }
    const groupId =
      item.kind === 'exercise' && item.superset ? item.superset.groupId : null;
    if (!groupId) {
      rendered.push(renderItem(item, `session-item-${i}`, i));
      continue;
    }
    const members: SessionTemplateItem[] = [];
    let j = i;
    while (
      j < items.length &&
      items[j].kind === 'exercise' &&
      (items[j] as Extract<SessionTemplateItem, { kind: 'exercise' }>).superset
        ?.groupId === groupId
    ) {
      members.push(items[j]);
      j += 1;
    }
    rendered.push(
      <View key={`superset-${groupId}-${i}`} style={styles.pairWrap}>
        <View style={styles.pairTag}>
          <Text style={styles.pairTagText}>SUPERSET</Text>
        </View>
        {members.map((member, offset) =>
          renderItem(member, `session-item-${i + offset}`, i + offset),
        )}
      </View>,
    );
    i = j - 1;
  }

  return <View style={styles.exerciseList}>{rendered}</View>;
}

/**
 * The one header the optional cluster gets.
 *
 * Sam's run-7 ruling 1. The meaning it carries — this is no-penalty, skip it if
 * it adds fatigue — used to be repeated on every add-on row as an "Optional"
 * eyebrow, and again as a pill on the recovery branch's add-on card. Saying it
 * once above the group says it exactly as well and stops the word competing with
 * the exercise names underneath it.
 *
 * Both branches share this component so the wording cannot drift apart: recovery
 * days keep their own simple template (§6 item 3), but not their own vocabulary
 * for the same idea.
 */
function OptionalWorkHeader() {
  return (
    <Text style={styles.optionalWorkHeader} testID="optional-work-header">
      Optional work
    </Text>
  );
}

/**
 * Power work as the first list row.
 *
 * The old box carried a "POWER / EXPLOSIVE PRIMER" header and a "Before
 * strength" / "Pair with main lift" placement tag. Both are retired: placement
 * is now just list order, and the category is the badge. What survives is the
 * content the athlete acts on — the prescription, the options to choose
 * between, and the coaching notes.
 */

/**
 * An add-on exercise, now an ordinary row inside the optional cluster.
 *
 * The "Optional Recovery Add-on" box is gone and so is the per-row eyebrow that
 * replaced it — the group header above the cluster carries the no-penalty
 * meaning once (Sam, run-7 ruling 1).
 *
 * Its coaching text comes from the curated cue layer via `buildCueText`, exactly
 * like every other row. It used to come from a note string hardcoded in
 * `recoveryAddonBuilder`, which is how "Quiet tempo, no bouncing" reached the
 * athlete without passing through Sam's cues (run-7 ruling 3).
 */
function AddonRow({
  exercise,
  expandedCues,
  toggleCue,
}: {
  exercise: any;
  expandedCues: Record<string, boolean>;
  toggleCue: (exerciseId: string) => void;
}) {
  const token = stableTestIdToken(exercise?.id);
  const name = exercise?.name;
  return (
    <View style={styles.exerciseCard} testID={`workout-exercise-row-${token}`}>
      <View style={styles.exerciseHeaderRow}>
        <View style={styles.exerciseNameWrap}>
          <Text style={styles.exerciseName} numberOfLines={2}>
            {displayExerciseName(name)}
          </Text>
        </View>
      </View>
      <Text
        style={styles.statsPrimary}
        testID={`workout-exercise-prescription-${token}`}
      >
        {exercise?.prescription}
      </Text>
      <CueDisclosure
        exerciseId={String(exercise?.id ?? '')}
        cueText={buildCueText(name)}
        expandedCues={expandedCues}
        toggleCue={toggleCue}
      />
    </View>
  );
}

/**
 * The combined-day "choose one of N" picker as a single list row.
 *
 * §6 item 4: no separate box and no carve-out from "one list" — one
 * Conditioning-badged row that expands in place to reveal the choice. When
 * there is only one option there is nothing to choose, so it opens straight
 * away rather than asking for a tap that reveals a single answer.
 */
function ConditioningChoiceRow({
  options,
  onChangeExercise,
}: {
  options: Array<{ title: string; description: string; rows: any[] }>;
  onChangeExercise: (exercise: any) => void;
}) {
  const isChoice = options.length > 1;
  const [expanded, setExpanded] = React.useState(!isChoice);
  const rowCount = options.reduce((sum, option) => sum + option.rows.length, 0);
  if (rowCount === 0) return null;

  return (
    <View style={styles.exerciseCard} testID="conditioning-choice-row">
      <Pressable
        onPress={isChoice ? () => setExpanded((prev) => !prev) : undefined}
        accessibilityRole={isChoice ? 'button' : undefined}
        accessibilityLabel={
          isChoice
            ? `${expanded ? 'Hide' : 'Show'} the ${options.length} conditioning options`
            : undefined
        }
        style={styles.exerciseHeaderRow}
      >
        <View style={styles.exerciseNameWrap}>
          <Text style={styles.exerciseName} numberOfLines={2}>
            {isChoice ? `Choose one of ${options.length}` : options[0].title}
          </Text>
        </View>
        {isChoice ? (
          <Text style={styles.disclosureChevron}>{expanded ? '−' : '+'}</Text>
        ) : null}
      </Pressable>
      {expanded
        ? options.map((option, optionIndex) => (
            <View key={`cond-opt-${optionIndex}`} style={styles.conditioningOption}>
              {isChoice ? (
                <Text style={styles.conditioningOptionTitle}>{option.title}</Text>
              ) : null}
              {option.description ? (
                <Text style={styles.conditioningOptionDescription}>
                  {option.description}
                </Text>
              ) : null}
              {option.rows.map((exercise: any, idx: number) => (
                <ConditioningRow
                  key={exercise.id}
                  exercise={exercise}
                  idx={idx}
                  onChangeExercise={onChangeExercise}
                />
              ))}
            </View>
          ))
        : null}
    </View>
  );
}

/**
 * A single exercise row. Renders:
 *   [1] Exercise Name                  [Change] [▶ play]
 *   Sets × Reps       Weight
 *                     [-] [value] [+]
 *   (optional rest hint)
 *   (curated coaching cue)
 *
 * The leading index is the athlete's waypoint through the list — "1", "2", and
 * "1a"/"1b" for a superset pair. It briefly gave way to a role badge; Sam ruled
 * the index back on 2026-07-27, because the D2 ordering already says what
 * matters and a "MAIN LIFT" label earned nothing the position did not.
 */
interface StrengthExerciseCardProps {
  exercise: any;
  label: string;
  isGrouped: boolean;
  isLastInGroup?: boolean;
  expandedCues: Record<string, boolean>;
  toggleCue: (exerciseId: string) => void;
  editingWeightId: string | null;
  editingWeightText: string;
  setEditingWeightText: (s: string) => void;
  formatWeight: (ex: any) => string;
  incrementWeight: (ex: any) => void;
  decrementWeight: (ex: any) => void;
  startEditingWeight: (ex: any) => void;
  commitWeightEdit: () => void;
  onSelectExercise: (name: string) => void;
  onChangeExercise: (exercise: any) => void;
}
function StrengthExerciseCard({
  exercise,
  label,
  isGrouped,
  isLastInGroup = true,
  expandedCues,
  toggleCue,
  editingWeightId,
  editingWeightText,
  setEditingWeightText,
  formatWeight,
  incrementWeight,
  decrementWeight,
  startEditingWeight,
  commitWeightEdit,
  onSelectExercise,
  onChangeExercise,
}: StrengthExerciseCardProps) {
  const exerciseName = exercise.exercise?.name || `Exercise`;
  const exerciseDisplayName = displayExerciseName(exerciseName);
  const setsReps = formatStrengthSetsReps(exercise);
  const restLabel = exercise.restSeconds >= 90 ? formatRest(exercise.restSeconds) : null;
  const cueText = buildCueText(exerciseName);
  const isEditing = editingWeightId === exercise.exerciseId;
  const exerciseToken = stableTestIdToken(exercise.id || exercise.exerciseId);

  return (
    <Card
      tone={isGrouped ? 'raised' : 'default'}
      radius="xl"
      padding="xs"
      testID={`workout-exercise-row-${exerciseToken}`}
      style={[
        styles.exerciseCard,
        isGrouped && styles.exerciseCardGrouped,
        isGrouped && isLastInGroup && styles.exerciseCardGroupedLast,
      ]}
    >
      <ExerciseHeaderRow
        label={label}
        name={exerciseDisplayName}
        onPlay={() => onSelectExercise(exerciseName)}
        onChange={
          isTeamTrainingItem(exercise) ? undefined : () => onChangeExercise(exercise)
        }
      />

      {/*
       * Pro mode stats — single horizontal line. Sets × Reps on the left
       * as plain body text (no "SETS × REPS" label), weight control on
       * the right. Reads left-to-right: "what am I doing, what load?".
       */}
      <View style={styles.statsRow}>
        <Text
          style={styles.statsPrimary}
          testID={`workout-exercise-prescription-${exerciseToken}`}
        >
          {setsReps}
        </Text>
        <View
          style={{ width: 1, height: 1 }}
          testID={`exercise-set-count-${exerciseToken}-${exercise.prescribedSets}`}
        />
        <View style={styles.weightControl}>
          <Pressable
            onPress={() => decrementWeight(exercise)}
            style={styles.weightBtnLeft}
            hitSlop={{ top: 8, bottom: 8, left: 8 }}
            accessibilityLabel="Decrease weight"
          >
            <Text style={styles.weightBtnText}>−</Text>
          </Pressable>
          {isEditing ? (
            <AppTextInput
              style={styles.weightInput}
              value={editingWeightText}
              onChangeText={setEditingWeightText}
              onBlur={commitWeightEdit}
              onSubmitEditing={commitWeightEdit}
              placeholder="BW"
              placeholderTextColor="#5A5A5A"
              keyboardType="decimal-pad"
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
            />
          ) : (
            <Pressable
              onPress={() => startEditingWeight(exercise)}
              style={styles.weightValueWrap}
              accessibilityLabel="Edit weight"
            >
              <Text style={styles.weightValueText}>{formatWeight(exercise)}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => incrementWeight(exercise)}
            style={styles.weightBtnRight}
            hitSlop={{ top: 8, bottom: 8, right: 8 }}
            accessibilityLabel="Increase weight"
          >
            <Text style={styles.weightBtnText}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* Rest hint */}
      {restLabel ? (
        <View style={styles.detailsRow}>
          <Text style={styles.restHint}>{restLabel}</Text>
        </View>
      ) : null}

      {/* Curated coaching cue, collapsed by default (Sam, run-7 ruling 2).
          Generator per-exercise notes are still deliberately NOT rendered: the
          curated layer owns every athlete-visible word; generation provides
          structure only (sets/reps/weight/type). Stage 3 ownership ruling. */}
      <CueDisclosure
        exerciseId={String(exercise.id ?? exercise.exerciseId ?? '')}
        cueText={cueText}
        expandedCues={expandedCues}
        toggleCue={toggleCue}
      />
    </Card>
  );
}

/**
 * Recovery branch — structured prescription + integrated play button.
 */
interface RecoveryBlockProps {
  exercises: any[];
  expandedCues: Record<string, boolean>;
  toggleCue: (exerciseId: string) => void;
  onSelectExercise: (name: string) => void;
  onChangeExercise: (exercise: any) => void;
}
function RecoveryBlock({
  exercises,
  expandedCues,
  toggleCue,
  onSelectExercise,
  onChangeExercise,
}: RecoveryBlockProps) {
  return (
    <View style={styles.exerciseList}>
      {exercises.map((exercise, index) => {
        const exerciseName = exercise.exercise?.name || `Exercise ${index + 1}`;
        const exerciseDisplayName = displayExerciseName(exerciseName, `Exercise ${index + 1}`);
        const pType = inferRecoveryPrescriptionType(exercise, exerciseName);
        const prescriptionLabel = formatRecoveryPrescription(exercise, pType);
        const setsPrefix =
          exercise.prescribedSets > 1 ? `${exercise.prescribedSets} × ` : '';
        const restLabel = formatRest(exercise.restSeconds);
        const cueText = buildCueText(exerciseName);
        const exerciseToken = stableTestIdToken(exercise.id || exercise.exerciseId);

        return (
          <Card
            key={exercise.id}
            tone="default"
            radius="xl"
            padding="md"
            testID={`workout-exercise-row-${exerciseToken}`}
            style={styles.exerciseCard}
          >
            <ExerciseHeaderRow
              label={`${index + 1}`}
              name={exerciseDisplayName}
              onPlay={() => onSelectExercise(exerciseName)}
              onChange={
                isTeamTrainingItem(exercise) ? undefined : () => onChangeExercise(exercise)
              }
            />

            <View style={styles.recoveryPrescriptionRow}>
              <Text
                style={styles.recoveryPrescription}
                testID={`workout-exercise-prescription-${exerciseToken}`}
              >
                {setsPrefix}
                {prescriptionLabel}
              </Text>
              {restLabel ? (
                <Text style={styles.recoveryRest}>{restLabel}</Text>
              ) : null}
            </View>

            {/* Curated cue only, collapsed by default (run-7 ruling 2);
                generator notes are not rendered (Stage 3 ownership: the
                curated layer owns the words). */}
            <CueDisclosure
              exerciseId={String(exercise.id ?? exercise.exerciseId ?? '')}
              cueText={cueText}
              expandedCues={expandedCues}
              toggleCue={toggleCue}
            />
          </Card>
        );
      })}
    </View>
  );
}

/**
 * Recovery days keep their own simple template (§6 item 3), so the add-on box
 * survives here where it died in the badged list. What it does NOT keep is its
 * own vocabulary for a shared idea: it mounts the same `OptionalWorkHeader` as
 * the list branch, and the per-card "Optional" pill is gone — it was the same
 * per-row label ruling 1 retired, wearing a different shape.
 */
interface RecoveryAddonSectionProps {
  addons: RecoveryAddonBlock[];
  expandedCues: Record<string, boolean>;
  toggleCue: (exerciseId: string) => void;
}
function RecoveryAddonSection({
  addons,
  expandedCues,
  toggleCue,
}: RecoveryAddonSectionProps) {
  if (addons.length === 0) return null;

  return (
    <View style={styles.recoveryAddonSection}>
      <OptionalWorkHeader />
      {addons.map((addon) => (
        <Card
          key={addon.id}
          tone="default"
          radius="lg"
          padding="md"
          style={styles.recoveryAddonCard}
        >
          <View style={styles.recoveryAddonHeader}>
            <View style={styles.recoveryAddonTitleWrap}>
              <Text style={styles.recoveryAddonEyebrow}>{addon.label}</Text>
              <Text style={styles.recoveryAddonTitle}>{addon.durationMinutes} min support work</Text>
            </View>
          </View>
          {addon.placementNote ? (
            <Text style={styles.recoveryAddonMeta}>{addon.placementNote}</Text>
          ) : null}
          <View style={styles.recoveryAddonExercises}>
            {addon.exercises.map((exercise) => (
              <View
                key={exercise.id}
                style={styles.recoveryAddonExercise}
                testID={`workout-exercise-row-${stableTestIdToken(exercise.id)}`}
              >
                <Text style={styles.recoveryAddonExerciseName}>{exercise.name}</Text>
                <Text
                  style={styles.recoveryAddonPrescription}
                  testID={`workout-exercise-prescription-${stableTestIdToken(exercise.id)}`}
                >
                  {exercise.prescription}
                </Text>
                {/* Same curated source as every other row (run-7 ruling 3) —
                    this used to print a note string hardcoded in the builder. */}
                <CueDisclosure
                  exerciseId={String(exercise.id ?? '')}
                  cueText={buildCueText(exercise.name)}
                  expandedCues={expandedCues}
                  toggleCue={toggleCue}
                />
              </View>
            ))}
          </View>
          <Text style={styles.recoveryAddonSkip}>Skip with no penalty if it adds fatigue.</Text>
        </Card>
      ))}
    </View>
  );
}

/**
 * One conditioning phase, as a flat-list row.
 *
 * Was a tinted "phase card" inside the conditioning branch. The tint carried
 * the category, so it retires with the box — the badge says Conditioning now,
 * and the row sits on the page like every other row.
 */
function ConditioningPhaseRow({
  exercise,
  onChangeExercise,
}: {
  exercise: any;
  onChangeExercise: (exercise: any) => void;
}) {
  const phaseName = exercise.exercise?.name || 'Phase';
  const phaseDisplayName = displayExerciseName(phaseName, 'Phase');
  const description = exercise.notes || exercise.exercise?.description || '';
  const restLabel = formatRest(exercise.restSeconds, 'recovery');
  const exerciseToken = stableTestIdToken(exercise.id || exercise.exerciseId);

  return (
    <View
      style={styles.exerciseCard}
      testID={`workout-exercise-row-${exerciseToken}`}
    >
      <View style={styles.exerciseHeaderRow}>
        <View style={styles.exerciseNameWrap}>
          <Text style={styles.exerciseName} numberOfLines={2}>
            {phaseDisplayName}
          </Text>
        </View>
        {!isTeamTrainingItem(exercise) ? (
          <ExerciseChangeAction onPress={() => onChangeExercise(exercise)} />
        ) : null}
      </View>
      {description ? (
        <Text
          style={styles.conditioningPhaseBody}
          testID={`workout-exercise-prescription-${exerciseToken}`}
        >
          {description}
        </Text>
      ) : null}
      {restLabel ? <Text style={styles.conditioningRest}>{restLabel}</Text> : null}
    </View>
  );
}

/**
 * A single conditioning row inside a combined-day option card.
 */
interface ConditioningRowProps {
  exercise: any;
  idx: number;
  onChangeExercise?: (exercise: any) => void;
}
function ConditioningRow({ exercise, idx, onChangeExercise }: ConditioningRowProps) {
  const name = exercise.exercise?.name || `Phase ${idx + 1}`;
  const displayName = displayExerciseName(name, `Phase ${idx + 1}`);
  const notes = exercise.notes || '';
  const prescription = formatConditioningRowPrescription(exercise);
  const exerciseToken = stableTestIdToken(exercise.id || exercise.exerciseId);

  return (
    <View
      style={styles.conditioningRow}
      testID={`workout-exercise-row-${exerciseToken}`}
    >
      <View style={styles.conditioningBullet} />
      <View style={{ flex: 1 }}>
        <View style={styles.conditioningRowHeader}>
          <Text style={styles.conditioningRowName}>{displayName}</Text>
          {onChangeExercise && !isTeamTrainingItem(exercise) ? (
            <ExerciseChangeAction onPress={() => onChangeExercise(exercise)} />
          ) : null}
        </View>
        {prescription ? (
          <Text
            style={styles.conditioningRowPrescription}
            testID={`workout-exercise-prescription-${exerciseToken}`}
          >
            {prescription}
          </Text>
        ) : null}
        {notes ? (
          <Text style={styles.conditioningRowNotes}>{cleanNotes(notes)}</Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Team training — a non-badged inline banner (§6 item 2).
 *
 * It sits at its ordering position in the flat list but carries no role badge:
 * it isn't athlete-prescribed work the way the six badged categories are, it's
 * a commitment the week already knows about. The "Team Training" section header
 * goes with every other box header; the banner keeps its accent tint precisely
 * because it is NOT one of the list's exercise rows.
 */
function TeamTrainingBanner() {
  return (
    <Card
      tone="accent"
      radius="lg"
      padding="md"
      style={styles.teamTrainingCard}
      testID="team-training-section"
    >
      <Text style={styles.teamTrainingTitle}>Club/team field session.</Text>
      <Text style={styles.teamTrainingBody}>
        We'll account for the load in your week.
      </Text>
    </Card>
  );
}

/**
 * Common exercise header: [label] Name ........ [play]
 *
 * The play target is a small, low-opacity affordance — present but never
 * competing with the exercise name. Pressing brightens it (opacity → 1,
 * fill intensifies) so the athlete gets visual confirmation of the tap.
 */
interface ExerciseHeaderRowProps {
  /** The row's index — "1", "2", "1a". Empty for rows that were never numbered. */
  label?: string;
  name: string;
  onPlay: () => void;
  onChange?: () => void;
}
function ExerciseHeaderRow({ label, name, onPlay, onChange }: ExerciseHeaderRowProps) {
  return (
    <>
      <View style={styles.exerciseHeaderRow}>
        {label ? (
          <View style={styles.exerciseLabelBadge}>
            <Text style={styles.exerciseLabelText}>{label}</Text>
          </View>
        ) : null}
        <Pressable
          style={styles.exerciseNameWrap}
          onPress={onPlay}
          accessibilityRole="button"
          accessibilityLabel={`Play ${name} demo`}
        >
          <Text style={styles.exerciseName} numberOfLines={2}>
            {name}
          </Text>
        </Pressable>
        {onChange ? <ExerciseChangeAction onPress={onChange} /> : null}
        <PlayButton onPress={onPlay} accessibilityLabel={`Play ${name} demo`} />
      </View>
    </>
  );
}

function ExerciseChangeAction({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Change exercise"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={({ pressed }) => [
        styles.exerciseChangeAction,
        pressed && { opacity: 0.65 },
      ]}
    >
      <Text style={styles.exerciseChangeText}>Change</Text>
    </Pressable>
  );
}

/**
 * Pro-mode play button — smaller, muted at rest, brightens only on press.
 * Replaces the previous IconButton(tone="accent") so the lime accent only
 * shows up as tactile feedback, never as resting visual weight.
 */
interface PlayButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
}
function PlayButton({ onPress, accessibilityLabel }: PlayButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={({ pressed }) => [
        styles.playBtn,
        pressed && styles.playBtnActive,
      ]}
    >
      <PlayIcon />
    </Pressable>
  );
}

/**
 * The curated cue, collapsed behind a "Form cues" disclosure.
 *
 * ## Why this reverses the always-visible ruling
 *
 * Sam's run-7 ruling 2. The cue used to render unconditionally, and that rule
 * had a specific reason: AI-generated per-exercise notes were rendering on the
 * same rows, so collapsing the cue would have let the generator's words outrank
 * Sam's. Stage 3 killed the AI notes — the curated layer is now the ONLY source
 * of a row's coaching text — so the reason expired, and what was left was the
 * same sentence repeated down every row of the session. This is noise reduction,
 * not a change of ownership: the words behind the disclosure are still Sam's,
 * still reached through `buildCueText` and canonicalisation.
 *
 * It replaces a `CueToggle` that was already here but unreachable — it only
 * collapsed when a row had generator notes, and no row has had those since
 * Stage 3, so in practice it always took its always-visible branch.
 *
 * ## One implementation, three row types
 *
 * Strength, recovery and add-on rows all mount THIS component. They previously
 * each rendered their own `{cueText ? <Text> : null}`, which is how the two
 * render layers drifted; the shared component means "collapsed by default" is
 * one fact rather than three copies that have to agree.
 *
 * A row with no curated cue renders nothing at all — never an empty disclosure
 * that opens onto blank space.
 */
interface CueDisclosureProps {
  cueText: string | null;
  exerciseId: string;
  expandedCues: Record<string, boolean>;
  toggleCue: (exerciseId: string) => void;
}
function CueDisclosure({
  cueText,
  exerciseId,
  expandedCues,
  toggleCue,
}: CueDisclosureProps) {
  if (!cueText) return null;
  const expanded = !!expandedCues[exerciseId];
  return (
    <View style={styles.cueContainer}>
      <Pressable
        onPress={() => toggleCue(exerciseId)}
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
        style={styles.cueToggleRow}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? 'Hide form cues' : 'Show form cues'}
        testID={`exercise-cue-toggle-${stableTestIdToken(exerciseId)}`}
      >
        <Text style={styles.cueToggleText}>
          {expanded ? '▾ Form cues' : '▸ Form cues'}
        </Text>
      </Pressable>
      {expanded ? <Text style={styles.cueText}>{cueText}</Text> : null}
    </View>
  );
}

/**
 * Finish-session CTA — the "ship it" moment.
 *
 * Pro mode: the button stands alone. No eyebrow label, no supporting
 * text — the label "Finish Session" says everything the athlete needs to
 * know at this position in the scroll. The glow stays (per the app-wide
 * rule: glow is reserved for completion / success, and finishing a
 * session is exactly that completion moment).
 */
interface FinishMomentProps {
  onPress: () => void;
}
function FinishMoment({ onPress }: FinishMomentProps) {
  return (
    <View style={styles.finishSection}>
      <Button
        label="Finish Session"
        size="lg"
        onPress={onPress}
        testID="finish-session-action"
      />
    </View>
  );
}

interface ExerciseEditSheetProps {
  visible: boolean;
  sessionId: string;
  step: ExerciseEditStep;
  editableExercises: EditableExercise[];
  onClose: () => void;
  onStep: (step: ExerciseEditStep) => void;
  onSwapReason: (exercise: EditableExercise, reason: SwapReason) => void;
  onAddKind: (kind: AddExerciseKind) => void;
  onConcern: (exercise: EditableExercise, concern: ExerciseConcern) => void;
  onInjuryStart: (exercise: EditableExercise) => void;
  onInjurySeverity: (
    exercise: EditableExercise,
    area: InjuryArea,
    severity: InjurySeverity,
  ) => void;
  onApplySwapToday: (step: Extract<ExerciseEditStep, { kind: 'confirm_swap' }>) => void;
  onApplyAddToday: (step: Extract<ExerciseEditStep, { kind: 'confirm_add' }>) => void;
  onRemoveToday: (exercise: EditableExercise) => void;
  onFutureScope: (step: FutureScopeStep) => void;
  onTodayOnly: () => void;
  onAskCoachTeam: (message: string) => void;
}

function ExerciseEditSheet({
  visible,
  sessionId,
  step,
  editableExercises,
  onClose,
  onStep,
  onSwapReason,
  onAddKind,
  onConcern,
  onInjuryStart,
  onInjurySeverity,
  onApplySwapToday,
  onApplyAddToday,
  onRemoveToday,
  onFutureScope,
  onTodayOnly,
  onAskCoachTeam,
}: ExerciseEditSheetProps) {
  if (!visible || step.kind === 'closed') return null;

  const goBack = () => {
    if (step.kind === 'exercise_menu') {
      onStep({ kind: 'menu' });
      return;
    }
    if (
      step.kind === 'pick_exercise' ||
      step.kind === 'add_kind' ||
      step.kind === 'result'
    ) {
      onStep({ kind: 'menu' });
      return;
    }
    if (step.kind === 'swap_reason' || step.kind === 'confirm_remove' || step.kind === 'confirm_swap') {
      onStep({ kind: 'exercise_menu', exercise: step.exercise });
      return;
    }
    if (step.kind === 'confirm_add') {
      onStep({ kind: 'add_kind' });
      return;
    }
    if (step.kind === 'concern_reason') {
      onStep({ kind: 'exercise_menu', exercise: step.exercise });
      return;
    }
    if (step.kind === 'injury_area') {
      onStep({ kind: 'concern_reason', exercise: step.exercise });
      return;
    }
    if (step.kind === 'injury_severity') {
      onStep({ kind: 'injury_area', exercise: step.exercise });
      return;
    }
    if (step.kind === 'future_scope') {
      onTodayOnly();
      return;
    }
    if (step.kind === 'coach_fallback') {
      onStep({ kind: 'menu' });
      return;
    }
    onClose();
  };

  const showBack =
    step.kind !== 'menu' &&
    step.kind !== 'result';

  const renderExercisePicker = (action: ExercisePickAction) => {
    if (editableExercises.length === 0) {
      return (
        <>
          <Text style={styles.exerciseEditBody}>
            There are no editable gym exercises in this session.
          </Text>
          <Button
            label="Ask Coach"
            variant="secondary"
            size="md"
            onPress={() => onAskCoachTeam('I need help changing this session.')}
          />
        </>
      );
    }
    return editableExercises.map((exercise) => (
      <ExerciseSheetOption
        key={exercise.key}
        label={displayExerciseName(exercise.name)}
        testID={action === 'remove'
          ? explorerTestId.componentDeleteIngress(
              sessionId,
              exercise.targetId ?? exercise.key,
            )
          : explorerTestId.componentIdentity(sessionId, exercise.targetId ?? exercise.key)}
        onPress={() => {
          if (action === 'swap') onStep({ kind: 'swap_reason', exercise });
          if (action === 'remove') onStep({ kind: 'confirm_remove', exercise });
          if (action === 'concern') onStep({ kind: 'concern_reason', exercise });
        }}
      />
    ));
  };

  const renderStep = () => {
    switch (step.kind) {
      case 'menu':
        return (
          <>
            <ExerciseSheetOption
              label="Swap an exercise"
              sub="Pick one exercise and choose why it needs changing"
              onPress={() => onStep({ kind: 'pick_exercise', action: 'swap' })}
            />
            <ExerciseSheetOption
              label="Add an exercise"
              sub="Add one exercise or small block to this session"
              onPress={() => onStep({ kind: 'add_kind' })}
            />
            <ExerciseSheetOption
              label="Remove an exercise"
              sub="Remove one exercise from today’s session"
              onPress={() => onStep({ kind: 'pick_exercise', action: 'remove' })}
            />
            <ExerciseSheetOption
              label="Something hurts / no equipment"
              sub="Make a guided change inside this session"
              onPress={() => onStep({ kind: 'pick_exercise', action: 'concern' })}
            />
          </>
        );
      case 'exercise_menu':
        return (
          <>
            <ExerciseSheetOption
              label="Swap exercise"
              onPress={() => onStep({ kind: 'swap_reason', exercise: step.exercise })}
            />
            <ExerciseSheetOption
              label="Remove exercise"
              testID={explorerTestId.componentDeleteIngress(
                sessionId,
                step.exercise.targetId ?? step.exercise.key,
              )}
              onPress={() => onStep({ kind: 'confirm_remove', exercise: step.exercise })}
            />
            <ExerciseSheetOption
              label="Something hurts"
              onPress={() => onInjuryStart(step.exercise)}
            />
            <ExerciseSheetOption
              label="No equipment"
              onPress={() => onConcern(step.exercise, 'No equipment')}
            />
            <ExerciseSheetOption
              label="Too hard / too easy"
              onPress={() => onConcern(step.exercise, 'Too hard / too easy')}
            />
          </>
        );
      case 'pick_exercise':
        return <>{renderExercisePicker(step.action)}</>;
      case 'swap_reason':
        return (
          <>
            {SWAP_REASONS.map((reason) => (
              <ExerciseSheetOption
                key={reason}
                label={reason}
                onPress={() => onSwapReason(step.exercise, reason)}
              />
            ))}
          </>
        );
      case 'add_kind':
        return (
          <>
            {ADD_EXERCISE_KINDS.map((kind) => (
              <ExerciseSheetOption
                key={kind}
                label={kind}
                onPress={() => onAddKind(kind)}
              />
            ))}
          </>
        );
      case 'confirm_remove':
        return (
          <>
            <Text style={styles.exerciseEditBody}>
              This will remove it from today’s session.
            </Text>
            <Button
              label="Remove exercise"
              variant="danger"
              size="md"
              onPress={() => onRemoveToday(step.exercise)}
              testID={explorerTestId.componentDeleteConfirm(
                sessionId,
                step.exercise.targetId ?? step.exercise.key,
              )}
            />
            <Button
              label="Cancel"
              variant="secondary"
              size="md"
              onPress={onClose}
              style={styles.exerciseEditSecondaryButton}
            />
          </>
        );
      case 'confirm_swap': {
        const isRestFallback = step.suggestion.kind === 'rest';
        const replacement = step.suggestion.kind === 'exercise'
          ? step.suggestion.suggestion
          : null;
        return (
          <>
            <Text style={styles.exerciseEditBody}>
              {isRestFallback
                ? `No safe useful substitute is available for ${displayExerciseName(step.exercise.name)}. Remove this exercise and rest the slot for today.`
                : `Replace ${displayExerciseName(step.exercise.name)} with ${displayExerciseName(replacement?.name)} for today’s session.`}
            </Text>
            <View style={styles.exerciseEditSuggestionCard}>
              <Text style={styles.exerciseEditSuggestionName}>
                {isRestFallback ? 'Rest this exercise slot' : displayExerciseName(replacement?.name)}
              </Text>
              <Text style={styles.exerciseEditSuggestionMeta}>
                {isRestFallback
                  ? 'Rest is only used because no safe useful work remains.'
                  : suggestionPrescription(replacement!)}
              </Text>
            </View>
            <Button
              label="Apply change"
              variant="primary"
              size="md"
              onPress={() => onApplySwapToday(step)}
            />
            <Button
              label="Cancel"
              variant="secondary"
              size="md"
              onPress={onClose}
              style={styles.exerciseEditSecondaryButton}
            />
          </>
        );
      }
      case 'confirm_add':
        return (
          <>
            <Text style={styles.exerciseEditBody}>
              Add {displayExerciseName(step.suggestion.name)} to today’s session.
            </Text>
            <View style={styles.exerciseEditSuggestionCard}>
              <Text style={styles.exerciseEditSuggestionName}>{displayExerciseName(step.suggestion.name)}</Text>
              <Text style={styles.exerciseEditSuggestionMeta}>
                {suggestionPrescription(step.suggestion)}
              </Text>
            </View>
            <Button
              label="Add exercise"
              variant="primary"
              size="md"
              onPress={() => onApplyAddToday(step)}
            />
            <Button
              label="Cancel"
              variant="secondary"
              size="md"
              onPress={onClose}
              style={styles.exerciseEditSecondaryButton}
            />
          </>
        );
      case 'future_scope':
        return (
          <>
            {step.action === 'remove' ? (
              <ExplorerRenderWitness
                testID={explorerTestId.componentDeleteResult(
                  sessionId,
                  step.exercise.targetId ?? step.exercise.key,
                )}
              />
            ) : null}
            <Text style={styles.exerciseEditBody}>{futureScopeBody(step)}</Text>
            <Text style={styles.exerciseEditQuestion}>
              Apply this change to future weeks?
            </Text>
            <ExerciseSheetOption
              label="Today only"
              sub="Keep this as a one-off change"
              testID={step.action === 'remove'
                ? explorerTestId.componentDeleteScope(
                    sessionId,
                    step.exercise.targetId ?? step.exercise.key,
                    'today',
                  )
                : undefined}
              onPress={onTodayOnly}
            />
            <ExerciseSheetOption
              label="Future weeks too"
              sub="Save this as an ongoing adjustment"
              testID={step.action === 'remove'
                ? explorerTestId.componentDeleteScope(
                    sessionId,
                    step.exercise.targetId ?? step.exercise.key,
                    'future',
                  )
                : undefined}
              onPress={() => onFutureScope(step)}
            />
          </>
        );
      case 'concern_reason':
        return (
          <>
            <ExerciseSheetOption
              label="Something hurts"
              onPress={() => onInjuryStart(step.exercise)}
            />
            <ExerciseSheetOption
              label="No equipment"
              onPress={() => onConcern(step.exercise, 'No equipment')}
            />
            <ExerciseSheetOption
              label="Too hard / too easy"
              onPress={() => onConcern(step.exercise, 'Too hard / too easy')}
            />
          </>
        );
      case 'injury_area':
        return (
          <>
            {INJURY_AREAS.map((area) => (
              <ExerciseSheetOption
                key={area}
                label={area}
                onPress={() => onStep({ kind: 'injury_severity', exercise: step.exercise, area })}
              />
            ))}
          </>
        );
      case 'injury_severity':
        return (
          <>
            {INJURY_SEVERITIES.map((severity) => (
              <ExerciseSheetOption
                key={severity}
                label={severity}
                onPress={() => onInjurySeverity(step.exercise, step.area, severity)}
              />
            ))}
          </>
        );
      case 'coach_fallback':
        return (
          <>
            <Text style={styles.exerciseEditBody}>{step.message}</Text>
            <Button
              label="Ask Coach"
              variant="primary"
              size="md"
              onPress={() => onAskCoachTeam(step.prefill)}
            />
            <Button
              label="Cancel"
              variant="secondary"
              size="md"
              onPress={onClose}
              style={styles.exerciseEditSecondaryButton}
            />
          </>
        );
      case 'result':
        return (
          <>
            <Text style={styles.exerciseEditBody}>{step.message}</Text>
            <Button
              label="Done"
              variant={step.ok ? 'primary' : 'secondary'}
              size="md"
              onPress={onClose}
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      contentStyle={styles.exerciseEditSheet}
      testID="exercise-edit-sheet"
    >
      {showBack ? (
        <Pressable
          onPress={goBack}
          style={styles.exerciseEditBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.exerciseEditBackText}>Back</Text>
        </Pressable>
      ) : null}
      <Text style={styles.exerciseEditTitle}>{exerciseEditTitle(step)}</Text>
      {exerciseEditSubtitle(step) ? (
        <Text style={styles.exerciseEditSubtitle}>{exerciseEditSubtitle(step)}</Text>
      ) : null}
      <View style={styles.exerciseEditOptions}>{renderStep()}</View>
    </Sheet>
  );
}

function exerciseEditTitle(step: ExerciseEditStep): string {
  switch (step.kind) {
    case 'menu':
      return 'Edit exercises';
    case 'exercise_menu':
      return displayExerciseName(step.exercise.name);
    case 'pick_exercise':
      return 'Which exercise?';
    case 'swap_reason':
      return 'Why do you want to swap it?';
    case 'add_kind':
      return 'What do you want to add?';
    case 'confirm_remove':
      return 'Remove this exercise?';
    case 'confirm_swap':
      return 'Swap exercise?';
    case 'confirm_add':
      return 'Add exercise?';
    case 'future_scope':
      if (step.action === 'remove') return 'Exercise removed';
      if (step.action === 'swap') return 'Exercise swapped';
      return 'Exercise added';
    case 'concern_reason':
      return 'What needs changing?';
    case 'injury_area':
      return 'What area is bothering you?';
    case 'injury_severity':
      return 'How bad is it?';
    case 'coach_fallback':
      return step.title;
    case 'result':
      return step.title;
    default:
      return 'Edit exercises';
  }
}

function exerciseEditSubtitle(step: ExerciseEditStep): string | null {
  switch (step.kind) {
    case 'menu':
      return 'Make a focused change inside this session.';
    case 'exercise_menu':
      return 'Change this exercise only.';
    case 'pick_exercise':
      return 'Team training entries are left alone.';
    case 'swap_reason':
    case 'confirm_remove':
    case 'confirm_swap':
    case 'concern_reason':
    case 'injury_area':
      return displayExerciseName(step.exercise.name);
    case 'confirm_add':
      return step.addKind;
    case 'add_kind':
      return 'Add one exercise or small block, not another full session.';
    case 'injury_severity':
      return `${displayExerciseName(step.exercise.name)} · ${step.area}`;
    case 'future_scope':
      return 'Default is today only.';
    case 'coach_fallback':
      return 'Coach fallback';
    default:
      return null;
  }
}

function futureScopeBody(step: FutureScopeStep): string {
  if (step.action === 'remove') {
    return `${displayExerciseName(step.exercise.name)} was removed from today’s session.`;
  }
  if (step.action === 'swap') {
    return `${displayExerciseName(step.exercise.name)} was replaced with ${displayExerciseName(step.suggestion.name)} in today’s session.`;
  }
  return `${displayExerciseName(step.suggestion.name)} was added to today’s session.`;
}

interface ExerciseSheetOptionProps {
  label: string;
  sub?: string;
  testID?: string;
  onPress: () => void;
}
function ExerciseSheetOption({ label, sub, testID, onPress }: ExerciseSheetOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={testID ?? label}
      style={({ pressed }) => [
        styles.exerciseEditOption,
        pressed && styles.exerciseEditOptionPressed,
      ]}
    >
      <View style={styles.exerciseEditOptionTextWrap}>
        <Text style={styles.exerciseEditOptionLabel}>{label}</Text>
        {sub ? <Text style={styles.exerciseEditOptionSub}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M15 18l-6-6 6-6" />
    </Svg>
  );
}

function PlayIcon() {
  // Small solid play triangle, lime-on-dark. Sized to match the 22×22
  // outline ring — the triangle sits centered with comfortable inner
  // padding so the affordance remains tappable but visually quiet.
  return (
    <Svg width={10} height={10} viewBox="0 0 12 12">
      <Polygon points="3,2 3,10 10,6" fill="#C8FF00" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0C0C0C' },
  smokeContractMarkerRoot: {
    // Container holds the mount probe + ready/failed marker. Real
    // size (60×30) + absolute position so it survives any parent
    // layout collapse (the renderer is mounted as a sibling of
    // day-workout-title inside the header).
    position: 'absolute',
    top: 96,
    left: 96,
    width: 64,
    height: 30,
    zIndex: 2147483647,
    elevation: 2147483647,
  },
  smokeContractMounted: {
    // Cyan 30×30 mount probe — always rendered in smoke mode.
    position: 'absolute',
    top: 0,
    left: 0,
    width: 30,
    height: 30,
    backgroundColor: '#00B8D4',
    zIndex: 2147483647,
    elevation: 2147483647,
  },
  smokeContractMarker: {
    // Ready/failed state marker — offset from the mount probe so
    // Maestro hit-tests can distinguish them.
    position: 'absolute',
    top: 0,
    left: 32,
    width: 30,
    height: 30,
    zIndex: 2147483647,
    elevation: 2147483647,
  },
  smokeContractReady: {
    backgroundColor: '#00C853',
  },
  smokeContractFailed: {
    backgroundColor: '#FF1744',
  },
  smokeContractMarkerText: {
    fontSize: 1,
    color: 'transparent',
  },

  // ── Header ──
  // The bottom divider mirrors the Finish section's whisper line: a
  // hairline at #121212 (just above the #0C0C0C screen background).
  // Together these two lines bracket the session — a quiet open, a
  // quiet close — and create rhythm without adding visual weight.
  // paddingBottom dropped md → sm so the header metadata sits visually
  // closer to the first exercise block; combined with the scroll's
  // tighter paddingTop, the session content reads as a direct
  // continuation of the header.
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#121212',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerContent: {},
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  // Metadata line — single sentence under the title, left-aligned.
  // marginTop (3) keeps it visually bound to the title. Same fontSize
  // used for the inline Why link below so both spans sit on the same
  // typographic line.
  headerSubtitle: {
    color: '#8A8A8A',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
    marginTop: 3,
  },
  // Change-door link — mirrors HomeScreenV2's makeChangeLink/-Text so the
  // change vocabulary looks identical on every surface it appears on.
  makeChangeLink: {
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  makeChangeText: { color: '#C8FF00', fontSize: 13, fontWeight: '600' },

  // ── Scroll body ──
  scroll: { flex: 1 },
  scrollContent: {
    // Split padding so the gap between the header's metadata row and the
    // first exercise block stays tight (~12–16px) without crowding the
    // "SUPERSET" label. Horizontal + bottom padding unchanged.
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
  },
  banner: { marginBottom: spacing.md },

  // Coach-update banner — explains *why* this session was changed.
  // A quietly-elevated card with a lime "COACH UPDATE" eyebrow + one
  // line per note. Sits above the exercise list so attribution lands
  // before the athlete starts the workout. Mobile-friendly: compact
  // padding, no decorations, single accent colour to match the rest
  // of the screen's coach-state vocabulary.
  coachNotesBanner: {
    backgroundColor: 'rgba(200, 255, 0, 0.06)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(200, 255, 0, 0.55)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: 4,
  },
  coachNotesEyebrow: {
    color: colors.accent.lime,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    opacity: 0.85,
  },
  coachNotesText: {
    color: '#E8F5B0',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  coachNotesToggle: {
    paddingTop: 4,
    alignSelf: 'flex-start',
  },
  coachNotesToggleText: {
    color: colors.accent.lime,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    opacity: 0.85,
  },
  coachNotesDetails: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(200, 255, 0, 0.18)',
    gap: 2,
  },
  coachNotesDetailLine: {
    color: '#C4D88A',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '400',
  },

  sessionDescription: {
    color: '#B0B0B0',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.md,
  },

  // ── Empty state ──
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  emptyBody: {
    color: '#9A9A9A',
    fontSize: 14,
    textAlign: 'center',
  },

  // ── Section labels ──
  sectionLabel: { marginBottom: spacing.sm, marginTop: spacing.xs },

  // ── Exercise list ──
  //
  // Fully flat. Each exercise sits on the screen background with zero
  // surface contrast — transparent fill, zero-width border (so there's
  // no 1px slot either), zero shadow. The Card primitive is now a pure
  // layout/press shell; every visual trace of a "card" is erased. What
  // separates one exercise from the next is whitespace alone: the list
  // gap opens up to 10px so the document reads as a training list
  // written on a dark page, not a stack of widgets.
  exerciseList: { gap: 10 },
  exerciseCard: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    ...shadows.none,
  },

  // ── Superset / paired wrapper ──
  //
  // Pro mode: a thin lime left rail that reads as structure, not
  // highlight. Further quieted in this pass: alpha 0.22 → 0.14 (lower
  // opacity = darker against the page), which lets the rail recede to
  // a near-invisible guide. paddingLeft tightens 10 → 6 so the rail
  // aligns much closer to the exercise number column — "these items
  // are indexed together" reads structurally at a glance. paddingBottom
  // (6) is slightly larger than paddingTop (2) so the rail extends a
  // whisker past the last paired row, giving a soft visual end rather
  // than a hard clip. marginTop/Bottom (6) keeps the ~16px air around
  // the block; the SUPERSET eyebrow sits above inside the rail indent.
  pairWrap: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(200, 255, 0, 0.14)',
    paddingLeft: 6,
    paddingTop: 2,
    paddingBottom: 6,
    gap: 0,
    marginTop: 6,
    marginBottom: 6,
  },
  pairTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginBottom: 2,
  },
  // SUPERSET label — brightness stepped down (0.7 → 0.55) so it sits at
  // a similar visual weight to the muted rail beside it. Neither element
  // dominates; they co-operate as a quiet structural frame.
  pairTagText: {
    color: colors.accent.lime,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    opacity: 0.55,
  },
  // Grouped rows are already transparent from the base exerciseCard
  // override; no additional surface treatment needed. Last-in-group
  // marker kept for future hooks but currently no-op.
  exerciseCardGrouped: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  exerciseCardGroupedLast: {},

  // ── Exercise header row ──
  // Label (index) is now plain text, not a chip — the index is information,
  // not decoration. Tighter bottom gap pulls the stats row closer so the
  // exercise reads as one coherent block rather than a stack of rows.
  exerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  exerciseLabelBadge: {
    minWidth: 18,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  // Number labels are navigational waypoints, not dominant signals. Smaller
  // size, lighter weight, and a dimmer grey so the athlete's eye lands on
  // the exercise name immediately; the index is available when they need it
  // but never competes for attention.
  exerciseLabelText: {
    color: '#5A5A5A',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  exerciseNameWrap: {
    flex: 1,
  },
  exerciseName: {
    color: '#F2F2F2',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
    lineHeight: 20,
  },
  exerciseChangeAction: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  exerciseChangeText: {
    color: '#8A8A8A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Muted play target — outline affordance, no resting fill at all.
  // Pushed one more step down: 22×22 ring at opacity 0.45 with a faint
  // ring (alpha 0.22). At this weight the play icon is a secondary tool
  // the athlete can reach for — it never pulls focus from the exercise
  // title beside it. Pressed state still snaps the ring to full lime as
  // tactile feedback (fill + border brighten, opacity → 1).
  playBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 0, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.45,
  },
  playBtnActive: {
    backgroundColor: 'rgba(200, 255, 0, 0.18)',
    borderColor: 'rgba(200, 255, 0, 0.55)',
    opacity: 1,
  },

  // ── Stats row (Pro mode) ──
  // One horizontal line: sets × reps on the left, weight control on the
  // right. No column labels. Space-between gives the left text natural
  // breathing room without forced flex column widths.
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  statsPrimary: {
    color: '#F2F2F2',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Weight segmented control ──
  //
  // Further quieted for the continuous-list treatment. Border alpha drops
  // ~25% (0.16 → 0.12), divider lines on the ± buttons drop to match
  // (0.10 → 0.075). Explicit shadows.none guarantees no elevation or
  // glow. Footprint shrinks one more step: button cells 30 → 28, value
  // wrap padding 10 → 8 / 52 → 48 min-width. Functionality is untouched
  // — same handlers, same edit flow, just less visual footprint.
  weightControl: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 0, 0.12)',
    backgroundColor: 'rgba(200, 255, 0, 0.025)',
    overflow: 'hidden',
    alignSelf: 'flex-start',
    ...shadows.none,
  },
  weightBtnLeft: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(200, 255, 0, 0.075)',
  },
  weightBtnRight: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(200, 255, 0, 0.075)',
  },
  weightBtnText: {
    color: colors.accent.lime,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
    opacity: 0.8,
  },
  weightValueWrap: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
  },
  weightValueText: {
    color: '#F2F2F2',
    fontSize: 13.5,
    fontWeight: '700',
  },
  weightInput: {
    color: '#F2F2F2',
    fontSize: 13.5,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 48,
    textAlign: 'center',
  },

  // ── Notes / rest ──
  // Tightened against the stats row above. Notes and rest hint both
  // recede into quiet secondary greys — legible, but never competing
  // with the primary numbers in the row above. Line heights nudged
  // down by 1px (17 → 16) for a denser read while keeping the text
  // comfortably readable.
  detailsRow: {
    marginTop: 6,
    gap: 2,
  },
  exerciseNotes: {
    color: '#6E6E6E',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  restHint: {
    color: '#6A6A6A',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // ── Cue toggle ──
  cueContainer: { marginTop: 6 },
  cueToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  cueToggleText: {
    color: '#5A5A5A',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cueText: {
    marginTop: 2,
    color: '#6E6E6E',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },

  // ── Recovery ──
  recoveryPrescriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 2,
    marginTop: 2,
  },
  recoveryPrescription: {
    color: colors.accent.lime,
    fontSize: 15,
    fontWeight: '700',
  },
  recoveryRest: {
    color: '#7A7A7A',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  recoveryAddonSection: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  recoveryAddonCard: {
    borderColor: 'rgba(200, 255, 0, 0.16)',
    backgroundColor: 'rgba(200, 255, 0, 0.045)',
  },
  recoveryAddonHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  recoveryAddonTitleWrap: {
    flex: 1,
    gap: 2,
  },
  recoveryAddonEyebrow: {
    color: '#A7A7A7',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  recoveryAddonTitle: {
    color: '#F2F2F2',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  recoveryAddonMeta: {
    color: '#9A9A9A',
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  recoveryAddonExercises: {
    gap: spacing.sm,
  },
  recoveryAddonExercise: {
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    gap: 2,
  },
  recoveryAddonExerciseName: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    lineHeight: 18,
  },
  recoveryAddonPrescription: {
    color: colors.accent.lime,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  recoveryAddonSkip: {
    color: '#6E6E6E',
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: spacing.sm,
  },

  // ── Conditioning (pure) ──
  conditioningPhaseBody: {
    color: '#D0D0D0',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  conditioningRest: {
    color: '#7A7A7A',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: spacing.xs,
  },

  // ── Power, as the first list row ──
  //
  // Options sit on the page with the same zero-surface treatment as every
  // exercise row; only the dose takes the lime, matching the weight control.
  powerOptions: { gap: 2, marginTop: 4 },

  // ── The optional cluster's one header ──
  //
  // Eyebrow scale, not heading scale. It divides the list rather than opening a
  // new section: the work below it is still the same session, just no-penalty.
  // Held quiet so it separates without competing with the exercise names — the
  // reason a label on every row was worse than a label on the group.
  optionalWorkHeader: {
    color: '#5A5A5A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },

  // ── In-list conditioning choice ──
  disclosureChevron: {
    color: '#7A7A7A',
    fontSize: 20,
    fontWeight: '400',
    paddingHorizontal: spacing.xs,
  },
  conditioningOption: { gap: spacing.xs, marginTop: spacing.xs },
  chooseOneLabel: {
    color: '#B0B0B0',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  conditioningOptionTitle: {
    color: colors.accent.lime,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  conditioningOptionDescription: {
    color: '#C8C8C8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.xs,
  },
  conditioningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  conditioningBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent.lime,
    marginTop: 6,
    flexShrink: 0,
    opacity: 0.9,
  },
  conditioningRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  conditioningRowName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  conditioningRowPrescription: {
    color: colors.accent.lime,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  conditioningRowNotes: {
    color: '#8A8A8A',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  // ── Team Training block ──
  teamTrainingCard: {
    gap: spacing.sm,
    borderColor: 'rgba(200, 255, 0, 0.18)',
    backgroundColor: 'rgba(200, 255, 0, 0.06)',
  },
  teamTrainingTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  teamTrainingBody: {
    color: '#C8C8C8',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },

  // ── Feedback + Finish ──
  // The finish section is the explicit "end of session" anchor. The
  // divider above the button drops to #121212 — just barely above the
  // #0C0C0C screen background — so it reads as a whispered fade line,
  // not a ruled edge. Combined with the generous xxl/lg whitespace, the
  // separation registers as "the session ends here" without adding any
  // new surface contrast to the screen.
  feedbackSection: { marginTop: spacing.lg },
  finishSection: {
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#121212',
    ...shadows.none,
  },

  // ── Exercise edit sheet ──
  exerciseEditSheet: {
    paddingBottom: 36,
  },
  exerciseEditBack: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginBottom: 2,
  },
  exerciseEditBackText: {
    color: colors.accent.lime,
    fontSize: 13,
    fontWeight: '700',
  },
  exerciseEditTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  exerciseEditSubtitle: {
    color: '#8A8A8A',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 5,
  },
  exerciseEditOptions: {
    gap: 10,
    marginTop: spacing.md,
  },
  exerciseEditOption: {
    minHeight: 52,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#1B1B1B',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  exerciseEditOptionPressed: {
    backgroundColor: 'rgba(200, 255, 0, 0.06)',
    borderColor: 'rgba(200, 255, 0, 0.28)',
  },
  exerciseEditOptionTextWrap: {
    gap: 3,
  },
  exerciseEditOptionLabel: {
    color: '#F2F2F2',
    fontSize: 15,
    fontWeight: '700',
  },
  exerciseEditOptionSub: {
    color: '#8A8A8A',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  exerciseEditBody: {
    color: '#C8C8C8',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 2,
  },
  exerciseEditQuestion: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  exerciseEditSuggestionCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 0, 0.16)',
    backgroundColor: 'rgba(200, 255, 0, 0.05)',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: 4,
  },
  exerciseEditSuggestionName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  exerciseEditSuggestionMeta: {
    color: colors.accent.lime,
    fontSize: 12,
    fontWeight: '700',
  },
  exerciseEditSecondaryButton: {
    marginTop: 2,
  },
});
