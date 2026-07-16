import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Polygon } from 'react-native-svg';
import { Text } from '../../components/common/Text';
import { Card, Button, IconButton, SectionLabel, Sheet } from '../../components/ui';
import { GuidedInjuryFlowSheet } from './GuidedInjuryFlowSheet';
import ExerciseVideoModal from '../../components/ExerciseVideoModal';
import { StaleOverrideBanner } from '../../components/StaleOverrideBanner';
import { getCoachNoteDisplay } from '../../utils/coachNoteSummary';
import { SessionFeedbackPanel } from '../../components/SessionFeedbackPanel';
import { SessionCompleteMoment } from '../../components/SessionCompleteMoment';
import { PowerPrimerSection } from '../../components/PowerPrimerSection';
import { TrunkSupportSection } from '../../components/TrunkSupportSection';
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
  buildStrengthLabels,
  groupStrengthExercises,
  formatStrengthSetsReps,
  formatConditioningRowPrescription,
} from './dayWorkoutHelpers';
import { isTeamTrainingItem } from '../../utils/teamTraining';
import { deriveVisibleWorkoutIdentity } from '../../utils/visibleWorkoutIdentity';
import { stableTestIdToken } from '../../utils/stableTestId';

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
  | 'Core'
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
  'Core',
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
    .map((exercise: any, index: number) => {
      const targetId = exercise.id || exercise.exerciseId || exercise.exercise?.id;
      return {
        key: String(targetId || `${getExerciseName(exercise)}-${index}`),
        name: getExerciseName(exercise, `Exercise ${index + 1}`),
        targetId: targetId ? String(targetId) : undefined,
        raw: exercise,
      };
    })
    .filter((exercise: EditableExercise) => !!exercise.name);
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

function guidedSeverityToExerciseSeverity(result: GuidedInjuryFlowResult): InjurySeverity {
  if (result.seriousSymptoms || result.severity >= 8) return 'Severe';
  if (result.severity >= 4) return 'Moderate';
  return 'Mild';
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
      { name: 'Split Squat', sets: 2, repsMin: 8, repsMax: 10, perSide: true },
      { name: 'Hip Thrust', sets: 2, repsMin: 10, repsMax: 12 },
    ],
    Core: [
      { name: 'Pallof Press', sets: 2, repsMin: 10, repsMax: 12, perSide: true },
      { name: 'Dead Bug', sets: 2, repsMin: 8, repsMax: 10, perSide: true },
    ],
    Prehab: [
      { name: 'Copenhagen Plank', sets: 2, repsMin: 20, repsMax: 30, prescriptionType: 'duration', perSide: true },
      { name: 'Calf Isometric Hold', sets: 2, repsMin: 30, repsMax: 45, prescriptionType: 'duration' },
    ],
    Mobility: [
      { name: 'Hip Mobility Flow', sets: 1, repsMin: 5, repsMax: 8, prescriptionType: 'duration_minutes', notes: 'Move easy.' },
      { name: 'T-Spine Openers', sets: 2, repsMin: 6, repsMax: 8, perSide: true },
    ],
    'Conditioning finisher': [
      { name: 'Bike Flush Finisher', sets: 1, repsMin: 8, repsMax: 10, prescriptionType: 'duration_minutes', notes: 'Easy-moderate pace.' },
      { name: 'Tempo Run Finisher', sets: 1, repsMin: 8, repsMax: 10, prescriptionType: 'duration_minutes', notes: 'Smooth, not a test.' },
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
    hasTeamTraining,
    strengthExercises,
    supportExercises,
    conditioningExercises,
    conditioningOptions,
    conditioningRowCount,
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
  React.useEffect(() => {
    if (!pendingComponentDeletionObservation) return;
    const targetStillRendered = editableExercises.some((exercise) =>
      pendingComponentDeletionObservation.targetId
        ? exercise.targetId === pendingComponentDeletionObservation.targetId
        : exercise.key === pendingComponentDeletionObservation.exerciseKey);
    if (targetStillRendered) return;
    observeRenderedAthleteActionOutcome({
      traceId: pendingComponentDeletionObservation.traceId,
      observationId: pendingComponentDeletionObservation.observationId,
      renderedText: {
        componentId: pendingComponentDeletionObservation.componentId,
        targetStillRendered,
        visibleComponentIds: editableExercises.map((exercise) =>
          exercise.targetId ?? exercise.key),
      },
      controlId: 'day-workout-visible-exercises',
      accessibilityNode: {
        workoutExerciseRowTestIDs: editableExercises.map((exercise) =>
          `workout-exercise-row-${stableTestIdToken(exercise.targetId ?? exercise.key)}`),
      },
      screenshotReference:
        'screenshots/trace-v2-component-deletion-after-mutation.png',
      hierarchyReference:
        'accessibility-hierarchy/trace-v2-component-deletion-after-mutation.json',
    });
    setPendingComponentDeletionObservation(null);
  }, [editableExercises, pendingComponentDeletionObservation]);

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
          'Message the coach',
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
          const observationId = `day-workout-component-deletion:${result.traceId}`;
          registerAthleteActionUIOutcome({
            traceId: result.traceId,
            observationId,
            domainReturn: {
              ok: result.ok,
              date,
              componentId: exercise.targetId ?? exercise.key,
            },
            controlId: 'day-workout-visible-exercises',
          });
          setPendingComponentDeletionObservation({
            traceId: result.traceId,
            observationId,
            componentId: exercise.targetId ?? exercise.key,
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
    [date],
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
  const combinedSubtitle = [dateFragment, countFragment, workout.powerBlock?.title, subtitleText]
    .filter(Boolean)
    .join(' · ');

  return (
    <SafeAreaView style={styles.container} testID="workout-screen">
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={handleScrollBeginDrag}
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

        {/* Typed pre-lift power work stays visible and separate from strength. */}
        <PowerPrimerSection block={workout.powerBlock} />

        {/* ── Main body: three render branches ── */}
        {isConditioning ? (
          <ConditioningPhases
            exercises={conditioningExercises}
            onChangeExercise={openSpecificExerciseEditor}
          />
        ) : isRecovery ? (
          <RecoveryBlock
            exercises={workout.exercises ?? []}
            expandedCues={expandedCues}
            toggleCue={toggleCue}
            onSelectExercise={setSelectedExercise}
            onChangeExercise={openSpecificExerciseEditor}
          />
        ) : (
          <StrengthBlock
            strengthExercises={strengthExercises}
            conditioningOptions={conditioningOptions}
            conditioningRowCount={conditioningRowCount}
            isCombinedDay={isCombinedDay}
            hasTeamTraining={hasTeamTraining}
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
        )}

        <TrunkSupportSection rows={supportExercises} />

        <RecoveryAddonSection addons={workout.recoveryAddons ?? []} />

        {/* ── Post-finish: feedback → success moment → auto-dismiss ── */}
        {isFinished && date ? (
          <View style={styles.feedbackSection}>
            {justSaved ? (
              <SessionCompleteMoment date={date} />
            ) : (
              <SessionFeedbackPanel date={date} workout={workout} onSave={handleFeedbackSaved} />
            )}
          </View>
        ) : null}

        {/* ── Finish moment ── */}
        {!isFinished ? (
          <FinishMoment onPress={handleFinishWorkout} />
        ) : null}
      </ScrollView>

      <ExerciseVideoModal
        visible={!!selectedExercise}
        exerciseName={selectedExercise || ''}
        onClose={() => setSelectedExercise(null)}
      />

      <ExerciseEditSheet
        visible={exerciseEditStep.kind !== 'closed'}
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
 * Strength branch — includes combined-day conditioning block underneath.
 */
interface StrengthBlockProps {
  strengthExercises: any[];
  conditioningOptions: any[];
  conditioningRowCount: number;
  isCombinedDay: boolean;
  hasTeamTraining: boolean;
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
function StrengthBlock({
  strengthExercises,
  conditioningOptions,
  conditioningRowCount,
  isCombinedDay,
  hasTeamTraining,
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
}: StrengthBlockProps) {
  const labels = buildStrengthLabels(strengthExercises);
  const groups = groupStrengthExercises(strengthExercises);

  return (
    <View>
      {(isCombinedDay || hasTeamTraining) && strengthExercises.length > 0 ? (
        <SectionLabel style={styles.sectionLabel}>Strength</SectionLabel>
      ) : null}

      {strengthExercises.length > 0 ? (
        <View style={styles.exerciseList}>
          {groups.map((group) => {
            // Standalone exercise - no group wrapper needed.
            if (!group.groupId || group.indices.length < 2) {
              return group.indices.map((idx) => (
                <StrengthExerciseCard
                  key={strengthExercises[idx].id}
                  exercise={strengthExercises[idx]}
                  label={labels[idx]}
                  isGrouped={false}
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
              ));
            }
            // Paired/superset wrapper
            return (
              <View key={`group-${group.groupId}`} style={styles.pairWrap}>
                <View style={styles.pairTag}>
                  <Text style={styles.pairTagText}>SUPERSET</Text>
                </View>
                {group.indices.map((idx, i) => (
                  <StrengthExerciseCard
                    key={strengthExercises[idx].id}
                    exercise={strengthExercises[idx]}
                    label={labels[idx]}
                    isGrouped
                    isLastInGroup={i === group.indices.length - 1}
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
                ))}
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Combined day: conditioning options appended below strength */}
      {isCombinedDay && conditioningOptions.length > 0 && conditioningRowCount > 0 ? (
        <View style={styles.conditioningSection}>
          <SectionLabel style={styles.sectionLabel}>Conditioning</SectionLabel>
          {conditioningOptions.length > 1 ? (
            <Text style={styles.chooseOneLabel}>Choose one:</Text>
          ) : null}
          {conditioningOptions.map((opt, optIdx) => (
            <Card
              key={`cond-opt-${optIdx}`}
              tone="accent"
              radius="lg"
              padding="md"
              style={styles.conditioningOptionCard}
            >
              <Text style={styles.conditioningOptionTitle}>{opt.title}</Text>
              {opt.description ? (
                <Text style={styles.conditioningOptionDescription}>{opt.description}</Text>
              ) : null}
              {opt.rows.map((exercise: any, idx: number) => (
                <ConditioningRow
                  key={exercise.id}
                  exercise={exercise}
                  idx={idx}
                  onChangeExercise={onChangeExercise}
                />
              ))}
            </Card>
          ))}
        </View>
      ) : null}

      {hasTeamTraining ? <TeamTrainingBlock /> : null}
    </View>
  );
}

/**
 * A single strength exercise card. Renders:
 *   [label] Exercise Name              [▶ play]
 *   Sets × Reps       Weight
 *                     [-] [value] [+]
 *   (optional notes + rest)
 *   (optional collapsible form cues)
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
  const displayNotes = cleanNotes(exercise.notes);
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
            <TextInput
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

      {/* Notes + rest */}
      {displayNotes || restLabel ? (
        <View style={styles.detailsRow}>
          {displayNotes ? (
            <Text style={styles.exerciseNotes}>{displayNotes}</Text>
          ) : null}
          {restLabel ? <Text style={styles.restHint}>{restLabel}</Text> : null}
        </View>
      ) : null}

      {/* Collapsible coaching cue */}
      {cueText ? (
        <CueToggle
          cueText={cueText}
          exerciseId={exercise.id}
          hasNotes={!!displayNotes}
          expanded={displayNotes ? !!expandedCues[exercise.id] : true}
          onToggle={toggleCue}
        />
      ) : null}
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
        const displayNotes = cleanNotes(exercise.notes);
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

            {displayNotes ? (
              <Text style={styles.exerciseNotes}>{displayNotes}</Text>
            ) : null}

            {cueText ? (
              <CueToggle
                cueText={cueText}
                exerciseId={exercise.id}
                hasNotes={!!displayNotes}
                expanded={displayNotes ? !!expandedCues[exercise.id] : true}
                onToggle={toggleCue}
              />
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

interface RecoveryAddonSectionProps {
  addons: RecoveryAddonBlock[];
}
function RecoveryAddonSection({ addons }: RecoveryAddonSectionProps) {
  if (addons.length === 0) return null;

  return (
    <View style={styles.recoveryAddonSection}>
      <SectionLabel style={styles.sectionLabel}>Optional Recovery Add-on</SectionLabel>
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
            <Text style={styles.recoveryAddonPill}>Optional</Text>
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
                {exercise.notes ? (
                  <Text style={styles.recoveryAddonNotes}>{exercise.notes}</Text>
                ) : null}
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
 * Conditioning session — descriptive phase cards.
 */
interface ConditioningPhasesProps {
  exercises: any[];
  onChangeExercise: (exercise: any) => void;
}
function ConditioningPhases({ exercises, onChangeExercise }: ConditioningPhasesProps) {
  return (
    <View style={styles.exerciseList}>
      {exercises.map((exercise, index) => {
        const phaseName = exercise.exercise?.name || `Phase ${index + 1}`;
        const phaseDisplayName = displayExerciseName(phaseName, `Phase ${index + 1}`);
        const description = exercise.notes || exercise.exercise?.description || '';
        const restLabel = formatRest(exercise.restSeconds, 'recovery');
        const exerciseToken = stableTestIdToken(exercise.id || exercise.exerciseId);

        return (
          <Card
            key={exercise.id}
            tone="accent"
            radius="xl"
            padding="md"
            testID={`workout-exercise-row-${exerciseToken}`}
            style={styles.conditioningPhaseCard}
          >
            <View style={styles.conditioningPhaseHeader}>
              <Text style={styles.conditioningPhaseName}>{phaseDisplayName}</Text>
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
            {restLabel ? (
              <Text style={styles.conditioningRest}>{restLabel}</Text>
            ) : null}
          </Card>
        );
      })}
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

function TeamTrainingBlock() {
  return (
    <View style={styles.teamTrainingSection} testID="team-training-section">
      <SectionLabel style={styles.sectionLabel}>Team Training</SectionLabel>
      <Card
        tone="accent"
        radius="lg"
        padding="md"
        style={styles.teamTrainingCard}
      >
        <Text style={styles.teamTrainingTitle}>Club/team field session.</Text>
        <Text style={styles.teamTrainingBody}>
          We'll account for the load in your week.
        </Text>
      </Card>
    </View>
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
  label: string;
  name: string;
  onPlay: () => void;
  onChange?: () => void;
}
function ExerciseHeaderRow({ label, name, onPlay, onChange }: ExerciseHeaderRowProps) {
  return (
    <View style={styles.exerciseHeaderRow}>
      <View style={styles.exerciseLabelBadge}>
        <Text style={styles.exerciseLabelText}>{label}</Text>
      </View>
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
 * Collapsible form-cue toggle. When there are no notes, cue shows by default.
 */
interface CueToggleProps {
  cueText: string;
  exerciseId: string;
  hasNotes: boolean;
  expanded: boolean;
  onToggle: (exerciseId: string) => void;
}
function CueToggle({ cueText, exerciseId, hasNotes, expanded, onToggle }: CueToggleProps) {
  if (!hasNotes) {
    return <Text style={styles.cueText}>{cueText}</Text>;
  }
  return (
    <View style={styles.cueContainer}>
      <Pressable
        onPress={() => onToggle(exerciseId)}
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
        style={styles.cueToggleRow}
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
            <Text style={styles.exerciseEditBody}>{futureScopeBody(step)}</Text>
            <Text style={styles.exerciseEditQuestion}>
              Apply this change to future weeks?
            </Text>
            <ExerciseSheetOption
              label="Today only"
              sub="Keep this as a one-off change"
              onPress={onTodayOnly}
            />
            <ExerciseSheetOption
              label="Future weeks too"
              sub="Save a smarter ongoing adjustment"
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
              label="Message the coach"
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
  onPress: () => void;
}
function ExerciseSheetOption({ label, sub, onPress }: ExerciseSheetOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
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
  recoveryAddonPill: {
    color: colors.accent.lime,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
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
  recoveryAddonNotes: {
    color: '#7A7A7A',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  recoveryAddonSkip: {
    color: '#6E6E6E',
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: spacing.sm,
  },

  // ── Conditioning (pure) ──
  conditioningPhaseCard: {},
  conditioningPhaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  conditioningPhaseName: {
    flex: 1,
    color: colors.accent.lime,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
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

  // ── Combined-day conditioning block ──
  conditioningSection: { marginTop: spacing.xl, gap: spacing.sm },
  chooseOneLabel: {
    color: '#B0B0B0',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  conditioningOptionCard: { gap: spacing.xs },
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
  teamTrainingSection: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
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
