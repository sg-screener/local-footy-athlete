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
  TextInput,
  type TextStyle,
} from 'react-native';
import { Text } from './common/Text';
import { Card, Button, SectionLabel } from './ui';
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
  FEEDBACK_FORM_SECTION_LABELS,
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

interface Props {
  /** ISO date string 'YYYY-MM-DD' for the session */
  date: string;
  /** Resolved workout for deciding whether richer conditioning logging is useful. */
  workout?: Workout | null;
  /** Called after feedback is saved. Parent uses this to navigate back. */
  onSave?: () => void;
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
  const setSessionFeedback = useProgramStore((s: any) => s.setSessionFeedback);
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
  const canSave = canSaveFeedbackDraft({ ...feedbackDraft, completion: activeCompletion });
  const hasComponentFlow = sessionComponents.length > 0;
  const conditioningComponentCompletion = componentCompletions.conditioning ?? completion;
  const strengthComponentCompletion = componentCompletions.strength ?? activeCompletion;
  const conditioningWasPerformed =
    conditioningComponentCompletion === 'full' ||
    conditioningComponentCompletion === 'partial';
  const visibleSections = useMemo(
    () => getVisibleFeedbackSections(
      activeCompletion,
      conditioningConfig.level === 'trackable' && conditioningWasPerformed,
    ),
    [activeCompletion, conditioningConfig.level, conditioningWasPerformed],
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

  const handleSave = useCallback(() => {
    if (!canSave || !activeCompletion) return;
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
      feeling,
      soreness,
      partialReason,
      skipReason,
      notes,
      difficulty: conditioningRpeValue,
      conditioning,
      strength,
    });
    if (!feedback) return;
    setSessionFeedback(date, feedback);
    onSave?.();
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
    setSessionFeedback,
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
    <Card tone="raised" padding="lg" radius="xl" style={styles.panel}>
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
                label={opt.label}
                selected={skipReason === opt.key}
                selectedColor={colors.accent.lime}
                onPress={() => setSkipReason(opt.key)}
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
            <TextInput
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
            <TextInput
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
          <TextInput
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

      {/* Save button - only when required fields for this path are selected */}
      {canSave && (
        <View style={styles.saveRow}>
          <Button
            label="Save & Finish"
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
  label: string;
  selected: boolean;
  selectedColor: string;
  onPress: () => void;
}

const FeedbackChip: React.FC<FeedbackChipProps> = ({
  label,
  selected,
  selectedColor,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
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
      <TextInput
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
});
