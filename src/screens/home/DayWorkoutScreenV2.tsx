import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  SafeAreaView,
} from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import { Text } from '../../components/common/Text';
import { Card, Button, IconButton, SectionLabel } from '../../components/ui';
import ExerciseVideoModal from '../../components/ExerciseVideoModal';
import { StaleOverrideBanner } from '../../components/StaleOverrideBanner';
import { SessionExplanationBanner } from '../../components/SessionExplanationBanner';
import { getCoachNoteDisplay } from '../../utils/coachNoteSummary';
import { SessionFeedbackPanel } from '../../components/SessionFeedbackPanel';
import { SessionCompleteMoment } from '../../components/SessionCompleteMoment';
import { getSmokeRuntimeSignal } from '../../utils/smokeBootstrap';
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

/**
 * DayWorkoutScreenV2 — redesigned session screen matching HomeScreenV2.
 *
 * ## Design direction
 * - Bolder header: muted eyebrow ("MONDAY"), big title, session-type subtitle,
 *   "Why this session" as a lime accent link.
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
    explanation,
    selectedExercise,
    setSelectedExercise,
    expandedCues,
    toggleCue,
    showExplanation,
    setShowExplanation,
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
    dayName,
    isTeamOnly,
    isRecovery,
    isConditioning,
    isCombinedDay,
    strengthExercises,
    conditioningOptions,
    conditioningRowCount,
  } = useDayWorkout();

  const smokeCoachBikeFlow =
    __DEV__ && getSmokeRuntimeSignal().flow === 'coach-bike-flow';
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

  // Combined "6 exercises · Strength" subtitle. Both fragments are merged
  // into a single line of plain body text — no stacked labels, no uppercase
  // chips. Count comes first so the athlete's eye lands on volume.
  const countFragment =
    metaCount > 0 ? `${metaCount} exercise${metaCount !== 1 ? 's' : ''}` : '';
  const combinedSubtitle = [countFragment, subtitleText]
    .filter(Boolean)
    .join(' · ');

  return (
    <SafeAreaView style={styles.container}>
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
          {/*
           * Pro mode header: title → single metadata sentence.
           *
           * Metadata and the "Why" link are rendered as ONE <Text> so
           * they flow inline as a single sentence:
           *     6 exercises · Strength · Why this session →
           * The Why span is an inner <Text onPress> — tappable but
           * entirely unstyled as a UI chrome (no background, no border,
           * no padding). Visually it reads as a link embedded in the
           * metadata sentence, not a separate CTA.
           *
           * Allowing natural wrap (no numberOfLines) lets small screens
           * break the line if absolutely necessary; on any modern iPhone
           * the full sentence fits one line.
           */}
          <Text
            style={styles.headerTitle}
            numberOfLines={2}
            testID="day-workout-title"
            accessibilityLabel={`Workout: ${workout.name}`}
          >
            {workout.name}
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
          {(combinedSubtitle || explanation) ? (
            <Text style={styles.headerSubtitle}>
              {combinedSubtitle}
              {combinedSubtitle && explanation ? ' · ' : null}
              {explanation ? (
                <Text
                  style={styles.whyLink}
                  onPress={() => setShowExplanation(!showExplanation)}
                  suppressHighlighting
                >
                  Why this session →
                </Text>
              ) : null}
            </Text>
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
        {/* Explanation banner */}
        {showExplanation && explanation ? (
          <View style={styles.banner}>
            <SessionExplanationBanner
              headline={explanation.headline}
              body={explanation.body}
              visible={true}
              onToggle={() => setShowExplanation(false)}
            />
          </View>
        ) : null}

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
          workoutName={workout.name}
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

        {/* ── Main body: three render branches ── */}
        {isConditioning ? (
          <ConditioningPhases exercises={workout.exercises ?? []} />
        ) : isRecovery ? (
          <RecoveryBlock
            exercises={workout.exercises ?? []}
            expandedCues={expandedCues}
            toggleCue={toggleCue}
            onSelectExercise={setSelectedExercise}
          />
        ) : (
          <StrengthBlock
            strengthExercises={strengthExercises}
            conditioningOptions={conditioningOptions}
            conditioningRowCount={conditioningRowCount}
            isCombinedDay={isCombinedDay}
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
          />
        )}

        {/* ── Post-finish: feedback → success moment → auto-dismiss ── */}
        {isFinished && date ? (
          <View style={styles.feedbackSection}>
            {justSaved ? (
              <SessionCompleteMoment date={date} />
            ) : (
              <SessionFeedbackPanel date={date} onSave={handleFeedbackSaved} />
            )}
          </View>
        ) : null}

        {/* ── Finish moment ── */}
        {!isFinished ? <FinishMoment onPress={handleFinishWorkout} /> : null}
      </ScrollView>

      <ExerciseVideoModal
        visible={!!selectedExercise}
        exerciseName={selectedExercise || ''}
        onClose={() => setSelectedExercise(null)}
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
}
function StrengthBlock({
  strengthExercises,
  conditioningOptions,
  conditioningRowCount,
  isCombinedDay,
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
}: StrengthBlockProps) {
  const labels = buildStrengthLabels(strengthExercises);
  const groups = groupStrengthExercises(strengthExercises);

  return (
    <View>
      {isCombinedDay && <SectionLabel style={styles.sectionLabel}>Strength</SectionLabel>}

      <View style={styles.exerciseList}>
        {groups.map((group) => {
          // Standalone exercise — no group wrapper needed.
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
                />
              ))}
            </View>
          );
        })}
      </View>

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
              <Text style={styles.conditioningOptionDescription}>{opt.description}</Text>
              {opt.rows.map((exercise: any, idx: number) => (
                <ConditioningRow
                  key={exercise.id}
                  exercise={exercise}
                  idx={idx}
                />
              ))}
            </Card>
          ))}
        </View>
      ) : null}
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
}: StrengthExerciseCardProps) {
  const exerciseName = exercise.exercise?.name || `Exercise`;
  const displayNotes = cleanNotes(exercise.notes);
  const setsReps = formatStrengthSetsReps(exercise);
  const restLabel = exercise.restSeconds >= 90 ? formatRest(exercise.restSeconds) : null;
  const cueText = buildCueText(exerciseName);
  const isEditing = editingWeightId === exercise.exerciseId;

  return (
    <Card
      tone={isGrouped ? 'raised' : 'default'}
      radius="xl"
      padding="xs"
      style={[
        styles.exerciseCard,
        isGrouped && styles.exerciseCardGrouped,
        isGrouped && isLastInGroup && styles.exerciseCardGroupedLast,
      ]}
    >
      <ExerciseHeaderRow
        label={label}
        name={exerciseName}
        onPlay={() => onSelectExercise(exerciseName)}
      />

      {/*
       * Pro mode stats — single horizontal line. Sets × Reps on the left
       * as plain body text (no "SETS × REPS" label), weight control on
       * the right. Reads left-to-right: "what am I doing, what load?".
       */}
      <View style={styles.statsRow}>
        <Text style={styles.statsPrimary}>{setsReps}</Text>
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
}
function RecoveryBlock({
  exercises,
  expandedCues,
  toggleCue,
  onSelectExercise,
}: RecoveryBlockProps) {
  return (
    <View style={styles.exerciseList}>
      {exercises.map((exercise, index) => {
        const exerciseName = exercise.exercise?.name || `Exercise ${index + 1}`;
        const pType = inferRecoveryPrescriptionType(exercise, exerciseName);
        const prescriptionLabel = formatRecoveryPrescription(exercise, pType);
        const setsPrefix =
          exercise.prescribedSets > 1 ? `${exercise.prescribedSets} × ` : '';
        const restLabel = formatRest(exercise.restSeconds);
        const displayNotes = cleanNotes(exercise.notes);
        const cueText = buildCueText(exerciseName);

        return (
          <Card
            key={exercise.id}
            tone="default"
            radius="xl"
            padding="md"
            style={styles.exerciseCard}
          >
            <ExerciseHeaderRow
              label={`${index + 1}`}
              name={exerciseName}
              onPlay={() => onSelectExercise(exerciseName)}
            />

            <View style={styles.recoveryPrescriptionRow}>
              <Text style={styles.recoveryPrescription}>
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

/**
 * Conditioning session — descriptive phase cards.
 */
interface ConditioningPhasesProps {
  exercises: any[];
}
function ConditioningPhases({ exercises }: ConditioningPhasesProps) {
  return (
    <View style={styles.exerciseList}>
      {exercises.map((exercise, index) => {
        const phaseName = exercise.exercise?.name || `Phase ${index + 1}`;
        const description = exercise.notes || exercise.exercise?.description || '';
        const restLabel = formatRest(exercise.restSeconds, 'recovery');

        return (
          <Card
            key={exercise.id}
            tone="accent"
            radius="xl"
            padding="md"
            style={styles.conditioningPhaseCard}
          >
            <Text style={styles.conditioningPhaseName}>{phaseName}</Text>
            {description ? (
              <Text style={styles.conditioningPhaseBody}>{description}</Text>
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
}
function ConditioningRow({ exercise, idx }: ConditioningRowProps) {
  const name = exercise.exercise?.name || `Phase ${idx + 1}`;
  const notes = exercise.notes || '';
  const prescription = formatConditioningRowPrescription(exercise);

  return (
    <View style={styles.conditioningRow}>
      <View style={styles.conditioningBullet} />
      <View style={{ flex: 1 }}>
        <Text style={styles.conditioningRowName}>{name}</Text>
        {prescription ? (
          <Text style={styles.conditioningRowPrescription}>{prescription}</Text>
        ) : null}
        {notes ? (
          <Text style={styles.conditioningRowNotes}>{cleanNotes(notes)}</Text>
        ) : null}
      </View>
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
}
function ExerciseHeaderRow({ label, name, onPlay }: ExerciseHeaderRowProps) {
  return (
    <Pressable style={styles.exerciseHeaderRow} onPress={onPlay}>
      <View style={styles.exerciseLabelBadge}>
        <Text style={styles.exerciseLabelText}>{label}</Text>
      </View>
      <Text style={styles.exerciseName} numberOfLines={2}>
        {name}
      </Text>
      <PlayButton onPress={onPlay} accessibilityLabel={`Play ${name} demo`} />
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
      <Button label="Finish Session" size="lg" onPress={onPress} />
    </View>
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
  // Why link — inline span inside the metadata Text. Same fontSize and
  // weight as the metadata so it flows as part of the sentence. Only
  // the colour distinguishes it: lime at ~0.85 alpha (baked into the
  // rgba so it works reliably on nested inline Text, where the opacity
  // prop can be unpredictable). No background, no border, no padding —
  // this is a link inside text, not a CTA.
  whyLink: {
    color: 'rgba(200, 255, 0, 0.85)',
    fontSize: 13,
    fontWeight: '500',
  },

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
  exerciseName: {
    flex: 1,
    color: '#F2F2F2',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
    lineHeight: 20,
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

  // ── Conditioning (pure) ──
  conditioningPhaseCard: {},
  conditioningPhaseName: {
    color: colors.accent.lime,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 4,
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
  conditioningRowName: {
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
});
