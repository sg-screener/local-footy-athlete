/**
 * SessionFeedbackPanel — Post-session feedback capture.
 *
 * Completion-first flow. The answer to "Did you complete it?" determines
 * which follow-up questions are valid for this session.
 *
 * Save button appears only when the required fields for the selected
 * completion state are answered.
 * On save: persists feedback, calls onSave() so the parent can navigate away.
 *
 * Feedback feeds into the progression context on subsequent sessions
 * via feelingToRPE(), soreness-based adaptation, and deriveCompletionQuality().
 *
 * ## V2 presentation
 * Wrapped in a V2 `Card` with a darker-raised surface so it reads as a
 * distinct post-session moment. Heading steps up to a bolder scale with a
 * small uppercase eyebrow ("SESSION COMPLETE"). Chip rows use the same
 * semantic colours as Classic but with softer fill/border treatment that
 * matches the rest of the V2 design language (rounded `lg` radius, subtle
 * selected glow). Save button uses the V2 primary `Button` with built-in
 * accent glow so the "ship it" moment feels earned.
 *
 * Prop contract is unchanged; Classic and V2 DayWorkout layers both render
 * this without modification.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  type TextStyle,
} from 'react-native';
import { Text } from './common/Text';
import { Card, Button, SectionLabel } from './ui';
import { stableTestIdToken } from '../utils/stableTestId';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import type { Workout } from '../types/domain';
import {
  useProgramStore,
  type FeedbackFeeling,
  type FeedbackCompletion,
  type FeedbackSoreness,
  type SessionFeedback,
} from '../store/programStore';
import {
  EXPECTATION_OPTIONS,
  EXPECTATION_REASON_OPTIONS,
  FEEDBACK_FORM_SECTION_LABELS,
  GAME_FEEL_OPTIONS,
  PARTIAL_REASON_OPTIONS,
  SKIP_REASON_OPTIONS,
  buildSessionFeedbackPayload,
  canSaveFeedbackDraft,
  completionMapFromFeedback,
  componentReasonsFromFeedback,
  deriveAggregateCompletion,
  getVisibleFeedbackSections,
  sanitizeComponentReasons,
  sanitizeFeedbackDraftForCompletion,
  sanitizeFeedbackDraftForComponents,
  type ComponentFeedbackReasonState,
  type FeedbackFormDraft,
  type FeedbackFormSectionId,
} from '../utils/sessionFeedbackForm';
import {
  getConditioningLoggingConfig,
  type ConditioningLogField,
  type ConditioningLogMode,
  type ConditioningPerformanceLog,
} from '../utils/conditioningLogging';
import {
  componentQuestionLabel,
  componentPartialReasonLabel,
  componentSkipReasonLabel,
  getSessionComponents,
  type SessionComponent,
} from '../utils/sessionComponents';
import { buildStrengthPerformanceLogs, collectLoggedStrengthSets } from '../utils/strengthLogging';
import { useWorkoutLogStore } from '../store/workoutLogStore';
import {
  commitSessionOutcomeTransaction,
  createRecordSessionOutcomeIntentFromFeedback,
  sessionOutcomeRecordableRefusal,
} from '../store/sessionOutcomeTransaction';
import type { SessionOutcomeTransactionReceipt } from '../types/sessionOutcome';
import { registerAthleteActionUIOutcome } from '../dev/e2e/athleteActionUIObservation';
import { explorerTestId } from '../utils/stableTestId';
import { isTeamTrainingSession } from '../utils/teamTraining';
import { TEAM_NIGHT_SIZE_OPTIONS, type TeamNightSize } from '../rules/teamNightSize';
import { classifyDaySessions } from '../rules/sessionTaxonomy';
import {
  expectationAsksWhy,
  type FeedbackExpectation,
  type FeedbackExpectationReason,
  type FeedbackGameFeel,
} from '../types/sessionOutcome';
import { AppTextInput } from '../components/keyboard/AppTextInput';
import { logger } from '../utils/logger';

interface Props {
  /** ISO date string 'YYYY-MM-DD' for the session */
  date: string;
  /** Resolved workout for deciding whether richer conditioning logging is useful. */
  workout?: Workout | null;
  /** Called after feedback is saved. Parent uses this to navigate back. */
  onSave?: (receipt: SessionOutcomeTransactionReceipt) => void;
}

// ─── Feeling options (4 choices — maps to existing backend keys) ───

const FEELING_OPTIONS: { key: FeedbackFeeling; label: string; color: string }[] = [
  { key: 'easy',      label: 'Easy',      color: '#81C784' },
  { key: 'good',      label: 'Solid',     color: '#C8FF00' },
  { key: 'hard',      label: 'Hard',      color: '#FFB74D' },
  { key: 'very_hard', label: 'Very Hard', color: '#EF5350' },
];

// ─── Soreness options ───

const SORENESS_OPTIONS: { key: FeedbackSoreness; label: string; color: string }[] = [
  { key: 'none',     label: 'None',     color: '#81C784' },
  { key: 'mild',     label: 'Mild',     color: '#C8FF00' },
  { key: 'moderate', label: 'Moderate', color: '#FFB74D' },
  { key: 'high',     label: 'High',     color: '#EF5350' },
];

// ─── Completion options ───

const COMPLETION_OPTIONS: { key: FeedbackCompletion; label: string }[] = [
  { key: 'full',    label: 'Fully' },
  { key: 'partial', label: 'Partially' },
  { key: 'skipped', label: 'Skipped' },
];

const MODE_OPTIONS: { key: ConditioningLogMode; label: string }[] = [
  { key: 'run', label: 'Run' },
  { key: 'bike', label: 'Bike' },
  { key: 'assault_bike', label: 'Assault' },
  { key: 'rower', label: 'Rower' },
  { key: 'ski', label: 'Ski' },
  { key: 'swim', label: 'Swim' },
  { key: 'mixed', label: 'Mixed' },
  { key: 'other', label: 'Other' },
];

function textFromNumber(value: number | undefined): string {
  return value === undefined || value === null ? '' : String(value);
}

function parseNumberField(value: string): number | undefined {
  const cleaned = value.trim().replace(',', '.');
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

function parseIntegerField(value: string): number | undefined {
  const parsed = parseNumberField(value);
  if (parsed === undefined) return undefined;
  return Math.round(parsed);
}

function parseRpe(value: string): number | undefined {
  const parsed = parseNumberField(value);
  if (parsed === undefined) return undefined;
  return Math.max(1, Math.min(10, Math.round(parsed)));
}

function draftFromExistingFeedback(
  existing: SessionFeedback | null | undefined,
  components: SessionComponent[],
): FeedbackFormDraft {
  const componentCompletions = completionMapFromFeedback(existing, components);
  const componentReasons = componentReasonsFromFeedback(existing, components);
  if (components.length > 0) {
    return sanitizeFeedbackDraftForComponents(
      {
        completion: deriveAggregateCompletion(
          components,
          componentCompletions,
          existing?.completion ?? null,
        ),
        componentCompletions,
        componentReasons,
        feeling: existing?.feeling ?? null,
        soreness: existing?.soreness ?? null,
        partialReason: existing?.partialReason ?? null,
        skipReason: existing?.skipReason ?? null,
      },
      components,
    );
  }

  return sanitizeFeedbackDraftForCompletion(
    {
      completion: existing?.completion ?? null,
      componentCompletions,
      componentReasons,
      feeling: existing?.feeling ?? null,
      soreness: existing?.soreness ?? null,
      partialReason: existing?.partialReason ?? null,
      skipReason: existing?.skipReason ?? null,
    },
    existing?.completion ?? null,
  );
}

export const SessionFeedbackPanel: React.FC<Props> = ({ date, workout, onSave }) => {
  const existing = useProgramStore((s: any) => s.sessionFeedback[date]) as
    | SessionFeedback
    | undefined;
  const weightOverrides = useProgramStore((s: any) => s.weightOverrides[date]);
  const conditioningConfig = useMemo(
    () => getConditioningLoggingConfig(workout),
    [workout],
  );
  const sessionComponents = useMemo(
    () => getSessionComponents(workout),
    [workout],
  );
  const existingDraft = draftFromExistingFeedback(existing, sessionComponents);

  const [feeling, setFeeling] = useState<FeedbackFeeling | null>(existingDraft.feeling);
  const [soreness, setSoreness] = useState<FeedbackSoreness | null>(existingDraft.soreness);
  const [completion, setCompletion] = useState<FeedbackCompletion | null>(existingDraft.completion);
  const [componentCompletions, setComponentCompletions] = useState<
    Record<string, FeedbackCompletion | null>
  >(existingDraft.componentCompletions ?? {});
  const [componentReasons, setComponentReasons] = useState<
    Record<string, ComponentFeedbackReasonState>
  >(existingDraft.componentReasons ?? {});
  const [teamNightSize, setTeamNightSize] = useState<TeamNightSize | null>(
    existing?.teamNightSize ?? null,
  );
  const [gameFeel, setGameFeel] = useState<FeedbackGameFeel | null>(
    existing?.gameFeel ?? null,
  );
  const [expectation, setExpectation] = useState<FeedbackExpectation | null>(
    existing?.expectation ?? null,
  );
  const [expectationReason, setExpectationReason] = useState<FeedbackExpectationReason | null>(
    existing?.expectationReason ?? null,
  );
  const [partialReason, setPartialReason] = useState(existingDraft.partialReason);
  const [skipReason, setSkipReason] = useState(existingDraft.skipReason);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [showNotes, setShowNotes] = useState(!!existing?.notes);
  const [conditioningMode, setConditioningMode] = useState<ConditioningLogMode | null>(
    existing?.conditioning?.mode ?? conditioningConfig.suggestedMode ?? null,
  );
  const [totalTimeMinutes, setTotalTimeMinutes] = useState(
    textFromNumber(existing?.conditioning?.totalTimeMinutes),
  );
  const [distanceMeters, setDistanceMeters] = useState(
    textFromNumber(existing?.conditioning?.distanceMeters),
  );
  const [calories, setCalories] = useState(textFromNumber(existing?.conditioning?.calories));
  const [roundsCompleted, setRoundsCompleted] = useState(
    textFromNumber(existing?.conditioning?.roundsCompleted),
  );
  const [intervalsCompleted, setIntervalsCompleted] = useState(
    textFromNumber(existing?.conditioning?.intervalsCompleted),
  );
  const [bestInterval, setBestInterval] = useState(existing?.conditioning?.bestInterval ?? '');
  const [averagePace, setAveragePace] = useState(existing?.conditioning?.averagePace ?? '');
  const [conditioningRpe, setConditioningRpe] = useState(
    textFromNumber(existing?.conditioning?.rpe),
  );

  // Re-sync local state when navigating to a different date
  useEffect(() => {
    const nextDraft = draftFromExistingFeedback(existing, sessionComponents);
    const conditioning = existing?.conditioning;
    setFeeling(nextDraft.feeling);
    setSoreness(nextDraft.soreness);
    setCompletion(nextDraft.completion);
    setComponentCompletions(nextDraft.componentCompletions ?? {});
    setComponentReasons(nextDraft.componentReasons ?? {});
    setTeamNightSize(existing?.teamNightSize ?? null);
    setGameFeel(existing?.gameFeel ?? null);
    setExpectation(existing?.expectation ?? null);
    setExpectationReason(existing?.expectationReason ?? null);
    setPartialReason(nextDraft.partialReason);
    setSkipReason(nextDraft.skipReason);
    setNotes(existing?.notes ?? '');
    setShowNotes(!!existing?.notes);
    setConditioningMode(conditioning?.mode ?? conditioningConfig.suggestedMode ?? null);
    setTotalTimeMinutes(textFromNumber(conditioning?.totalTimeMinutes));
    setDistanceMeters(textFromNumber(conditioning?.distanceMeters));
    setCalories(textFromNumber(conditioning?.calories));
    setRoundsCompleted(textFromNumber(conditioning?.roundsCompleted));
    setIntervalsCompleted(textFromNumber(conditioning?.intervalsCompleted));
    setBestInterval(conditioning?.bestInterval ?? '');
    setAveragePace(conditioning?.averagePace ?? '');
    setConditioningRpe(textFromNumber(conditioning?.rpe));
  }, [date, existing, sessionComponents, conditioningConfig.suggestedMode]);

  const feedbackDraft: FeedbackFormDraft = {
    completion,
    componentCompletions,
    componentReasons,
    teamNightSize,
    gameFeel,
    expectation,
    expectationReason,
    feeling,
    soreness,
    partialReason,
    skipReason,
  };
  const activeCompletion = deriveAggregateCompletion(
    sessionComponents,
    componentCompletions,
    completion,
  );
  const draftIsComplete = canSaveFeedbackDraft({ ...feedbackDraft, completion: activeCompletion });
  // THE DOOR'S OWN RULE, ASKED — never re-implemented here (finding 4). A
  // control offered for an act its door will refuse is a dead control, and the
  // athlete taps it and nothing happens.
  const recordableRefusal = sessionOutcomeRecordableRefusal(date);
  const canSave = draftIsComplete && !recordableRefusal;
  // A refusal the athlete must be TOLD about. `null` until a save is refused;
  // the door's authored sentence, never a second one written here.
  const [saveRefusal, setSaveRefusal] = useState<string | null>(null);
  const hasComponentFlow = sessionComponents.length > 0;
  const conditioningComponentCompletion = componentCompletions.conditioning ?? completion;
  const strengthComponentCompletion = componentCompletions.strength ?? activeCompletion;
  const conditioningWasPerformed =
    conditioningComponentCompletion === 'full' ||
    conditioningComponentCompletion === 'partial';
  // DERIVED, not a new prop. The panel already resolves the workout, and
  // `isTeamTrainingSession` is the app's existing owner of "is this a team night" — a
  // second answer threaded down from a caller is exactly the two-owners shape the repo
  // keeps paying for.
  const isTeamNight = useMemo(() => isTeamTrainingSession(workout), [workout]);
  // THE SAME MOVE FOR "IS THIS A GAME", AND IT NEEDED SAYING OUT LOUD: the app
  // has FOUR spellings of that predicate today (`coachCommandRouter:1326`,
  // `scheduleDebug:379`, `weekStructureValidator:127`,
  // `projectVisibleWeek:137`) and no owner. `classifyDaySessions` IS the owner —
  // its own header says detection has one home — so this asks it rather than
  // adding a fifth `workoutType === 'Game'`.
  const isGameDay = useMemo(
    () => classifyDaySessions(workout).some((unit) => unit.category === 'game'),
    [workout],
  );
  const visibleSections = useMemo(
    () => getVisibleFeedbackSections(activeCompletion, {
      includeConditioningPerformance:
        conditioningConfig.level === 'trackable' && conditioningWasPerformed,
      isTeamTrainingDay: isTeamNight,
      isGameDay,
      expectation,
    }),
    [activeCompletion, conditioningConfig.level, conditioningWasPerformed, isTeamNight,
      isGameDay, expectation],
  );
  const hasSection = useCallback(
    (id: FeedbackFormSectionId) => visibleSections.some((section) => section.id === id),
    [visibleSections],
  );
  const showConditioningPerformance = hasSection('conditioning');

  const resetConditioningFields = useCallback(() => {
    setConditioningMode(conditioningConfig.suggestedMode ?? null);
    setTotalTimeMinutes('');
    setDistanceMeters('');
    setCalories('');
    setRoundsCompleted('');
    setIntervalsCompleted('');
    setBestInterval('');
    setAveragePace('');
    setConditioningRpe('');
  }, [conditioningConfig.suggestedMode]);

  const handleCompletionChange = useCallback((nextCompletion: FeedbackCompletion) => {
    const nextDraft = sanitizeFeedbackDraftForCompletion(
      {
        completion,
        componentCompletions,
        componentReasons,
        feeling,
        soreness,
        partialReason,
        skipReason,
      },
      nextCompletion,
    );
    setCompletion(nextDraft.completion);
    setFeeling(nextDraft.feeling);
    setSoreness(nextDraft.soreness);
    setPartialReason(nextDraft.partialReason);
    setSkipReason(nextDraft.skipReason);
    if (nextCompletion === 'skipped') {
      resetConditioningFields();
    }
  }, [
    completion,
    componentCompletions,
    componentReasons,
    feeling,
    soreness,
    partialReason,
    skipReason,
    resetConditioningFields,
  ]);

  const handleComponentCompletionChange = useCallback((
    componentId: string,
    nextCompletion: FeedbackCompletion,
  ) => {
    const nextComponentCompletions = {
      ...componentCompletions,
      [componentId]: nextCompletion,
    };
    const nextDraft = sanitizeFeedbackDraftForComponents(
      {
        completion: deriveAggregateCompletion(
          sessionComponents,
          nextComponentCompletions,
          completion,
        ),
        componentCompletions: nextComponentCompletions,
        componentReasons,
        feeling,
        soreness,
        partialReason,
        skipReason,
      },
      sessionComponents,
    );

    setComponentCompletions(nextDraft.componentCompletions ?? {});
    setComponentReasons(nextDraft.componentReasons ?? {});
    setCompletion(nextDraft.completion);
    setFeeling(nextDraft.feeling);
    setSoreness(nextDraft.soreness);
    setPartialReason(nextDraft.partialReason);
    setSkipReason(nextDraft.skipReason);

    const nextConditioningCompletion =
      nextDraft.componentCompletions?.conditioning ?? nextDraft.completion;
    if (
      nextDraft.completion === 'skipped' ||
      (componentId === 'conditioning' && nextConditioningCompletion === 'skipped')
    ) {
      resetConditioningFields();
    }
  }, [
    componentCompletions,
    componentReasons,
    sessionComponents,
    completion,
    feeling,
    soreness,
    partialReason,
    skipReason,
    resetConditioningFields,
  ]);

  const setComponentReason = useCallback((
    componentId: string,
    reason: ComponentFeedbackReasonState,
  ) => {
    const nextReasons = sanitizeComponentReasons(
      {
        ...componentReasons,
        [componentId]: reason,
      },
      componentCompletions,
      sessionComponents,
    );
    setComponentReasons(nextReasons);
  }, [componentReasons, componentCompletions, sessionComponents]);

  const handleComponentPartialReasonChange = useCallback((
    componentId: string,
    nextReason: NonNullable<ComponentFeedbackReasonState['partialReason']>,
  ) => {
    setComponentReason(componentId, {
      partialReason: nextReason,
      skipReason: null,
    });
  }, [setComponentReason]);

  const handleComponentSkipReasonChange = useCallback((
    componentId: string,
    nextReason: NonNullable<ComponentFeedbackReasonState['skipReason']>,
  ) => {
    setComponentReason(componentId, {
      partialReason: null,
      skipReason: nextReason,
    });
  }, [setComponentReason]);

  const buildConditioningLog = useCallback((): ConditioningPerformanceLog | undefined => {
    if (!showConditioningPerformance) return undefined;

    const log: ConditioningPerformanceLog = {
      sessionName: conditioningConfig.title,
    };
    if (conditioningMode) log.mode = conditioningMode;

    const parsedTime = parseNumberField(totalTimeMinutes);
    const parsedDistance = parseNumberField(distanceMeters);
    const parsedCalories = parseNumberField(calories);
    const parsedRounds = parseIntegerField(roundsCompleted);
    const parsedIntervals = parseIntegerField(intervalsCompleted);
    const parsedRpe = parseRpe(conditioningRpe);

    if (parsedTime !== undefined) log.totalTimeMinutes = parsedTime;
    if (parsedDistance !== undefined) log.distanceMeters = parsedDistance;
    if (parsedCalories !== undefined) log.calories = parsedCalories;
    if (parsedRounds !== undefined) log.roundsCompleted = parsedRounds;
    if (parsedIntervals !== undefined) log.intervalsCompleted = parsedIntervals;
    if (bestInterval.trim()) log.bestInterval = bestInterval.trim();
    if (averagePace.trim()) log.averagePace = averagePace.trim();
    if (parsedRpe !== undefined) log.rpe = parsedRpe;

    return Object.keys(log).length > 1 ? log : undefined;
  }, [
    showConditioningPerformance,
    conditioningConfig.title,
    conditioningMode,
    totalTimeMinutes,
    distanceMeters,
    calories,
    roundsCompleted,
    intervalsCompleted,
    bestInterval,
    averagePace,
    conditioningRpe,
  ]);

  const handleSave = useCallback(async () => {
    if (!canSave || !activeCompletion) return;
    setSaveRefusal(null);
    try {
    const conditioning = buildConditioningLog();
    const conditioningRpeValue = conditioning?.rpe;
    const strengthCompletion =
      strengthComponentCompletion === 'full' || strengthComponentCompletion === 'partial'
        ? strengthComponentCompletion
        : null;
    const logState = useWorkoutLogStore.getState();
    const loggedStrengthSets = collectLoggedStrengthSets(
      workout,
      logState.loggedSets,
      logState.activeWorkout?.id,
    );
    const strength = !strengthCompletion
      ? []
      : buildStrengthPerformanceLogs(workout, weightOverrides, strengthCompletion, loggedStrengthSets);
    const feedback = buildSessionFeedbackPayload({
      dateStr: date,
      completion: activeCompletion,
      componentCompletions,
      componentReasons,
      components: sessionComponents,
      // Only ever sent on a team night. `isTeamNight` is the same flag that decides
      // whether the question was ASKED, so the app cannot store an answer to a question
      // it did not put on the screen.
      teamNightSize: isTeamNight ? teamNightSize : null,
      // THE SAME GUARD, FOR THE SAME REASON. `isGameDay` is the flag that decided
      // whether the question was ASKED, so it is the flag that decides whether the
      // answer is SENT — the app cannot store a body-feel rating for a session it
      // never asked about.
      gameFeel: isGameDay ? gameFeel : null,
      expectation,
      // A REASON WITHOUT ITS EXPECTATION IS AN ANSWER TO NO QUESTION. The draft
      // gate refuses the half-answered pair; this stops a stale reason riding
      // along after the athlete taps back to "as expected".
      expectationReason: expectationAsksWhy(expectation) ? expectationReason : null,
      feeling,
      soreness,
      partialReason,
      skipReason,
      notes,
      difficulty: conditioningRpeValue,
      conditioning,
      strength,
    });
    if (!feedback) {
      // NOT a bare return. The draft passed its own gate and still produced no
      // payload, which is a defect in this panel, not an athlete mistake — but
      // the athlete is the one holding the phone, so they get told.
      setSaveRefusal("Something went wrong saving that. Nothing was recorded — please try again.");
      return;
    }
    const result = await commitSessionOutcomeTransaction(
      createRecordSessionOutcomeIntentFromFeedback({
        date,
        feedback,
        workout,
        source: {
          entryPoint: 'tap',
          surface: 'session_feedback_panel',
        },
      }),
    );
    if (!result.ok) {
      // THE REFUSAL IS THE DOOR'S TO WORD. Every code it can answer reaches the
      // athlete now; the future-session one is gated out above, and the rest —
      // which no gate can predict — say what happened instead of nothing.
      // `in` rather than the discriminant: this scope's narrowing does not
      // survive the compile scope's settings, and a cast would hide a real
      // shape change in the door's result.
      const reason = 'reason' in result ? result.reason : null;
      setSaveRefusal(reason
        || "Something went wrong saving that. Nothing was recorded — please try again.");
      return;
    }
    const traceId = result.receipt.source.traceId;
    if (traceId) {
      registerAthleteActionUIOutcome({
        traceId,
        observationId: `session-feedback-render:${traceId}`,
        domainReturn: {
          transactionId: result.receipt.transactionId,
          sessionIdentity: result.receipt.sessionIdentity,
          componentIds: result.receipt.componentIds,
        },
        controlId: explorerTestId.feedbackReceipt(result.receipt.transactionId),
      });
    }
    onSave?.(result.receipt);
    } catch (error) {
      // AN UNGUARDED `await` IN AN onPress IS A DEAD BUTTON. A throw anywhere in
      // the chain above used to become an unhandled rejection and the tap simply
      // did nothing — the same silence that hid the armour wrappers' crash
      // (2026-08-03). It is an answer now.
      logger.error('[SessionFeedbackPanel] the save threw', { date, error });
      setSaveRefusal("Something went wrong saving that. Nothing was recorded — please try again.");
    }
  }, [
    canSave,
    activeCompletion,
    componentCompletions,
    componentReasons,
    sessionComponents,
    feeling,
    soreness,
    strengthComponentCompletion,
    partialReason,
    skipReason,
    buildConditioningLog,
    workout,
    weightOverrides,
    notes,
    date,
    onSave,
  ]);

  const renderComponentReasonGroup = useCallback((component: SessionComponent) => {
    const componentCompletion = componentCompletions[component.id];
    const reason = componentReasons[component.id];

    if (componentCompletion === 'partial') {
      return (
        <View>
          <SectionLabel style={styles.componentReasonSection}>
            {componentPartialReasonLabel(component)}
          </SectionLabel>
          <View style={styles.row}>
            {PARTIAL_REASON_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-${stableTestIdToken(component.id)}-partial-reason-${opt.key}`}
                label={opt.label}
                selected={reason?.partialReason === opt.key}
                selectedColor={colors.accent.lime}
                onPress={() => handleComponentPartialReasonChange(component.id, opt.key)}
              />
            ))}
          </View>
        </View>
      );
    }

    if (componentCompletion === 'skipped') {
      return (
        <View>
          <SectionLabel style={styles.componentReasonSection}>
            {componentSkipReasonLabel(component)}
          </SectionLabel>
          <View style={styles.row}>
            {SKIP_REASON_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-${stableTestIdToken(component.id)}-skip-reason-${opt.key}`}
                label={opt.label}
                selected={reason?.skipReason === opt.key}
                selectedColor={colors.accent.lime}
                onPress={() => handleComponentSkipReasonChange(component.id, opt.key)}
              />
            ))}
          </View>
        </View>
      );
    }

    return null;
  }, [
    componentCompletions,
    componentReasons,
    handleComponentPartialReasonChange,
    handleComponentSkipReasonChange,
  ]);

  return (
    <Card
      tone="raised"
      padding="lg"
      radius="xl"
      style={styles.panel}
      testID="session-feedback-panel"
    >
      <Text style={styles.eyebrow}>SESSION COMPLETE</Text>
      <Text style={styles.heading}>Session feedback</Text>
      <Text style={styles.subheading}>
        A quick check-in - this tunes your next session.
      </Text>

      {/*
       * Completion row uses the same <FeedbackChip /> primitive as the
       * follow-up rows so unselected chrome stays byte-identical across
       * groups. The only difference is the selected accent: rating chips
       * carry semantic colour (green=easy, red=very_hard) so colour
       * encodes meaning; completion is a peer-options group with no
       * semantic colour ladder, so it uses the standard lime accent.
       */}
      {hasComponentFlow ? (
        sessionComponents.map((component) => (
          <View key={component.id}>
            <SectionLabel style={styles.section}>
              {componentQuestionLabel(component, sessionComponents.length)}
            </SectionLabel>
            <View style={styles.row}>
              {COMPLETION_OPTIONS.map((opt) => (
                <FeedbackChip
                  key={opt.key}
                  testID={`feedback-${stableTestIdToken(component.id)}-completion-${opt.key}`}
                  label={opt.label}
                  selected={componentCompletions[component.id] === opt.key}
                  selectedColor={colors.accent.lime}
                  onPress={() => handleComponentCompletionChange(component.id, opt.key)}
                />
              ))}
            </View>
            {renderComponentReasonGroup(component)}
          </View>
        ))
      ) : (
        <>
          <SectionLabel style={styles.section}>
            {FEEDBACK_FORM_SECTION_LABELS.completion}
          </SectionLabel>
          <View style={styles.row}>
            {COMPLETION_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-completion-${opt.key}`}
                label={opt.label}
                selected={completion === opt.key}
                selectedColor={colors.accent.lime}
                onPress={() => handleCompletionChange(opt.key)}
              />
            ))}
          </View>
        </>
      )}

      {!hasComponentFlow && hasSection('partialReason') ? (
        <>
          <SectionLabel style={styles.section}>
            {FEEDBACK_FORM_SECTION_LABELS.partialReason}
          </SectionLabel>
          <View style={styles.row}>
            {PARTIAL_REASON_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-partial-reason-${opt.key}`}
                label={opt.label}
                selected={partialReason === opt.key}
                selectedColor={colors.accent.lime}
                onPress={() => setPartialReason(opt.key)}
              />
            ))}
          </View>
        </>
      ) : null}

      {!hasComponentFlow && hasSection('skipReason') ? (
        <>
          <SectionLabel style={styles.section}>
            {FEEDBACK_FORM_SECTION_LABELS.skipReason}
          </SectionLabel>
          <View style={styles.row}>
            {SKIP_REASON_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-skip-reason-${opt.key}`}
                label={opt.label}
                selected={skipReason === opt.key}
                selectedColor={colors.accent.lime}
                onPress={() => setSkipReason(opt.key)}
              />
            ))}
          </View>
        </>
      ) : null}

      {hasSection('teamNightSize') ? (
        <>
          <SectionLabel style={styles.section}>
            {FEEDBACK_FORM_SECTION_LABELS.teamNightSize}
          </SectionLabel>
          <View style={styles.row}>
            {TEAM_NIGHT_SIZE_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-team-night-size-${opt.key}`}
                label={opt.label}
                selected={teamNightSize === opt.key}
                selectedColor={opt.color}
                onPress={() => setTeamNightSize(teamNightSize === opt.key ? null : opt.key)}
              />
            ))}
          </View>
        </>
      ) : null}

      {hasSection('gameFeel') ? (
        <>
          <SectionLabel style={styles.section}>
            {FEEDBACK_FORM_SECTION_LABELS.gameFeel}
          </SectionLabel>
          <View style={styles.row}>
            {GAME_FEEL_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-game-feel-${opt.key}`}
                label={opt.label}
                selectedColor={colors.accent.lime}
                selected={gameFeel === opt.key}
                onPress={() => setGameFeel(gameFeel === opt.key ? null : opt.key)}
              />
            ))}
          </View>
        </>
      ) : null}

      {hasSection('expectation') ? (
        <>
          <SectionLabel style={styles.section}>
            {FEEDBACK_FORM_SECTION_LABELS.expectation}
          </SectionLabel>
          <View style={styles.row}>
            {EXPECTATION_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-expectation-${opt.key}`}
                label={opt.label}
                selectedColor={colors.accent.lime}
                selected={expectation === opt.key}
                onPress={() => {
                  const next = expectation === opt.key ? null : opt.key;
                  setExpectation(next);
                  // TAPPING BACK CLEARS THE WHY. Leaving a stale reason behind
                  // would let "as expected" carry "because of soreness" in the
                  // draft — the payload drops it, but a form that shows one
                  // answer and sends another is the surface half of the same
                  // defect.
                  if (!expectationAsksWhy(next)) setExpectationReason(null);
                }}
              />
            ))}
          </View>
        </>
      ) : null}

      {hasSection('expectationReason') ? (
        <>
          <SectionLabel style={styles.section}>
            {FEEDBACK_FORM_SECTION_LABELS.expectationReason}
          </SectionLabel>
          <View style={styles.row}>
            {EXPECTATION_REASON_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-expectation-reason-${opt.key}`}
                label={opt.label}
                selectedColor={colors.accent.lime}
                selected={expectationReason === opt.key}
                onPress={() => setExpectationReason(
                  expectationReason === opt.key ? null : opt.key,
                )}
              />
            ))}
          </View>
        </>
      ) : null}

      {hasSection('feeling') ? (
        <>
          <SectionLabel style={styles.section}>
            {activeCompletion === 'partial'
              ? FEEDBACK_FORM_SECTION_LABELS.partialFeeling
              : FEEDBACK_FORM_SECTION_LABELS.feeling}
          </SectionLabel>
          <View style={styles.row}>
            {FEELING_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-feeling-${opt.key}`}
                label={opt.label}
                selected={feeling === opt.key}
                selectedColor={opt.color}
                onPress={() => setFeeling(opt.key)}
              />
            ))}
          </View>
        </>
      ) : null}

      {hasSection('soreness') ? (
        <>
          <SectionLabel style={styles.section}>
            {FEEDBACK_FORM_SECTION_LABELS.soreness}
          </SectionLabel>
          <View style={styles.row}>
            {SORENESS_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-soreness-${opt.key}`}
                label={opt.label}
                selected={soreness === opt.key}
                selectedColor={opt.color}
                onPress={() => setSoreness(opt.key)}
              />
            ))}
          </View>
        </>
      ) : null}

      {showConditioningPerformance ? (
        <>
          <SectionLabel style={styles.section}>
            {FEEDBACK_FORM_SECTION_LABELS.conditioning}
          </SectionLabel>
          <View style={styles.row}>
            {MODE_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-conditioning-mode-${opt.key}`}
                label={opt.label}
                selected={conditioningMode === opt.key}
                selectedColor={colors.accent.lime}
                onPress={() => setConditioningMode(opt.key)}
              />
            ))}
          </View>
          <View style={styles.metricGrid}>
            <ConditioningMetricInput
              field="totalTimeMinutes"
              label="Time (min)"
              value={totalTimeMinutes}
              onChangeText={setTotalTimeMinutes}
              fields={conditioningConfig.fields}
            />
            <ConditioningMetricInput
              field="distanceMeters"
              label="Distance (m)"
              value={distanceMeters}
              onChangeText={setDistanceMeters}
              fields={conditioningConfig.fields}
            />
            <ConditioningMetricInput
              field="calories"
              label="Calories"
              value={calories}
              onChangeText={setCalories}
              fields={conditioningConfig.fields}
            />
            <ConditioningMetricInput
              field="roundsCompleted"
              label="Rounds"
              value={roundsCompleted}
              onChangeText={setRoundsCompleted}
              fields={conditioningConfig.fields}
            />
            <ConditioningMetricInput
              field="intervalsCompleted"
              label="Intervals"
              value={intervalsCompleted}
              onChangeText={setIntervalsCompleted}
              fields={conditioningConfig.fields}
            />
            <ConditioningMetricInput
              field="rpe"
              label="RPE"
              value={conditioningRpe}
              onChangeText={setConditioningRpe}
              fields={conditioningConfig.fields}
            />
          </View>
          {conditioningConfig.fields.includes('bestInterval') ? (
            <AppTextInput
              style={styles.singleLineInput}
              placeholder="Best interval (optional)"
              placeholderTextColor={colors.text.tertiary}
              value={bestInterval}
              onChangeText={setBestInterval}
              maxLength={40}
              returnKeyType="done"
            />
          ) : null}
          {conditioningConfig.fields.includes('averagePace') ? (
            <AppTextInput
              style={styles.singleLineInput}
              placeholder="Average pace / split (optional)"
              placeholderTextColor={colors.text.tertiary}
              value={averagePace}
              onChangeText={setAveragePace}
              maxLength={40}
              returnKeyType="done"
            />
          ) : null}
        </>
      ) : null}

      {/* Notes toggle + input */}
      {hasSection('notes') ? (
        !showNotes ? (
          <Pressable
            onPress={() => setShowNotes(true)}
            style={styles.notesToggle}
            accessibilityRole="button"
          >
            <Text style={styles.notesToggleText}>+ Add a note</Text>
          </Pressable>
        ) : (
          <AppTextInput
            style={styles.notesInput}
            placeholder="Anything to note? (optional)"
            placeholderTextColor={colors.text.tertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={200}
            returnKeyType="done"
            blurOnSubmit
          />
        )
      ) : null}

      {/* A refused save says so. Silence here was finding 4. */}
      {saveRefusal && (
        <View style={styles.saveRefusalRow} testID="session-feedback-save-refusal">
          <Text style={styles.saveRefusalText}>{saveRefusal}</Text>
        </View>
      )}

      {/* THE CONTROL IS NOT OFFERED FOR AN ACT THE DOOR WILL REFUSE, and the
          athlete is told why rather than left with a button that does nothing. */}
      {draftIsComplete && recordableRefusal && (
        <View style={styles.saveRefusalRow} testID="session-feedback-not-yet">
          <Text style={styles.saveRefusalText}>{recordableRefusal.message}</Text>
        </View>
      )}

      {/* Save button - only when required fields for this path are selected */}
      {canSave && (
        <View style={styles.saveRow}>
          <Button
            label="Save & Finish"
            testID={explorerTestId.feedbackSave(workout?.id ?? date)}
            onPress={handleSave}
            variant="primary"
            size="lg"
            fullWidth
          />
        </View>
      )}
    </Card>
  );
};

/* ── FeedbackChip ────────────────────────────────────────────────────────
 *
 * Single source of truth for every option chip in this panel. Rating,
 * completion, and reason groups render through this component so
 * the unselected look — translucent fill + thin dark border — is byte
 * identical across rows. Selected state takes a colour from the caller:
 * semantic ladder colour for rating rows, lime for the completion row.
 *
 * Kept local to this file because it's a one-off recipe for this panel;
 * the global selection primitive (<SelectableTile />) renders against the
 * page surface, but here the parent is a raised Card and we need a
 * lighter, translucent chip to read as elevated above it.
 */
interface FeedbackChipProps {
  testID?: string;
  label: string;
  selected: boolean;
  selectedColor: string;
  onPress: () => void;
}

const FeedbackChip: React.FC<FeedbackChipProps> = ({
  testID,
  label,
  selected,
  selectedColor,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    testID={testID}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    accessibilityLabel={label}
    style={[
      styles.chip,
      selected && {
        backgroundColor: selectedColor + '22',
        borderColor: selectedColor,
      },
    ]}
  >
    <Text
      style={[
        styles.chipText,
        selected && { color: selectedColor, fontWeight: '700' },
      ] as unknown as TextStyle}
    >
      {label}
    </Text>
  </Pressable>
);

interface ConditioningMetricInputProps {
  field: ConditioningLogField;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  fields: ConditioningLogField[];
}

function ConditioningMetricInput({
  field,
  label,
  value,
  onChangeText,
  fields,
}: ConditioningMetricInputProps) {
  if (!fields.includes(field)) return null;
  return (
    <View style={styles.metricInputWrap}>
      <Text style={styles.metricLabel}>{label}</Text>
      <AppTextInput
        style={styles.metricInput}
        placeholder="-"
        placeholderTextColor={colors.text.tertiary}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        maxLength={8}
        returnKeyType="done"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginBottom: spacing.md,
  },
  eyebrow: {
    color: colors.accent.lime,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heading: {
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 4,
  },
  subheading: {
    color: colors.text.tertiary,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    lineHeight: 18,
  },
  section: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  componentReasonSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.sm,
  },
  metricInputWrap: {
    flexBasis: '31%',
    minWidth: 88,
    flexGrow: 1,
  },
  metricLabel: {
    color: colors.text.tertiary,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 5,
  },
  metricInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
  },
  singleLineInput: {
    marginTop: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    color: colors.text.primary,
    fontSize: 13,
    padding: spacing.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  chipText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  notesToggle: {
    marginTop: spacing.md,
    paddingVertical: 6,
  },
  notesToggleText: {
    color: colors.accent.lime,
    fontSize: 12,
    fontWeight: '600',
  },
  notesInput: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    color: colors.text.primary,
    fontSize: 13,
    padding: spacing.sm,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  saveRow: {
    marginTop: spacing.lg,
  },
  saveRefusalRow: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,122,133,0.12)',
  },
  saveRefusalText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
  },
});
