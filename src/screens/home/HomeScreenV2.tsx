import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { PlanChangeSheet } from './PlanChangeSheet';
import { GuidedInjuryFlowSheet } from './GuidedInjuryFlowSheet';
import { EquipmentLimitationSheet } from './EquipmentLimitationSheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { Circle, Path } from 'react-native-svg';
import { Text } from '../../components/common/Text';
import { SessionTierBadge } from '../../components/common/SessionTierBadge';
import { SelectableTile } from '../../components/common';
import { StaleOverrideBanner } from '../../components/StaleOverrideBanner';
import { Button, Card, Sheet, Badge, IconButton } from '../../components/ui';
import type { SeasonPhase, DayOfWeek } from '../../types/domain';
import { weeklyConditioningIconKind } from '../../utils/weeklyPlanDisplay';
import { isTeamTrainingOnlyWorkout } from '../../utils/teamTraining';
import type { VisibleDay, VisibleWeek, VisiblePartKind } from '../../rules/visibleProjection';
import { visibleDayLeadHeadline } from '../../rules/visibleDayDetail';
import { dayTimeline, type DayTimelineEntry } from '../../rules/dayTimeline';
import { spacing, borderRadius } from '../../theme/spacing';
import { useHomeScreen, type WeekReadinessAction } from './useHomeScreen';
import type {
  ActiveCoachNote,
  ActiveCoachNoteAction,
} from '../../utils/activeCoachNotes';
import type { ProgramControlStatusUpdate } from '../../utils/programControlActions';
import { guidedInjuryResultFromConstraint } from '../../utils/guidedInjuryControl';
import type { ActiveInjuryConstraint } from '../../store/coachUpdatesStore';
import { dayOfMonthLabel, shortDayMonthLabel, todayISOLocal } from '../../utils/appDate';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import { resolveVisibleReadinessState } from '../../utils/visibleReadinessState';
import { buildReadinessAcknowledgment, buildScheduleAcknowledgment, type ReadinessAcknowledgment } from '../../utils/readinessAcknowledgment';
import { recordScheduleAckPresented } from '../../utils/athleteActionDiagnostics';
import { applyLighterDayForToday } from '../../utils/lighterDayTransaction';
import type { MissedSession, MissedSessionResponse } from '../../utils/missedSessions';
import { dayOfWeekTestIdToken, explorerTestId } from '../../utils/stableTestId';
import { ExplorerRenderWitness } from '../../components/ExplorerRenderWitness';
import { deriveFutureProgressionRenderTarget } from '../../utils/sessionFeedbackRenderWitness';
import {
  WEEK_DAYS,
  DAY_SHORT,
  NEXT_PHASE,
  suppressDuplicateWorkoutContext,
  REBUILD_MESSAGES,
  PHASE_SHIFT_MESSAGES,
  type PhaseShiftStep,
} from './homeScreenConstants';

/**
 * HomeScreenV2 — one week, one list.
 *
 * ## Hierarchy
 * All seven days render as a single scannable list. The SELECTED day is
 * the emphasis carrier: slightly bigger type, roomier padding, accent
 * surface, and the expanded CTA block (Start Session / change door).
 * Selection defaults to today (useHomeScreen), so on open the athlete
 * sees today gently lifted out of the week; tapping any other day moves
 * the emphasis there. No hero card — "what do I do now" and "how does my
 * week look" are the same view.
 *
 * ## Logic parity
 * All state and handler orchestration lives in `useHomeScreen`, which
 * HomeScreenClassic consumes identically. This file is presentation-only.
 * Swapping variants via the Profile toggle produces identical data
 * outcomes — only the rendering differs.
 *
 * ## Visual language
 * Premium, focused, high-end. The selected row earns its dominance
 * through scale and surface — not borders or glow. Non-selected rows
 * recede into a structured timeline, not a grid of outlined buttons.
 * Glow is reserved for completion / success moments elsewhere in the
 * app; the home screen is a "ready to start" posture.
 *
 * ## Micro-interactions
 * Card/Button primitives handle press-scale (0.98) + opacity (0.75) via
 * the shared motion tokens. Primary CTA opts out of the default accent
 * glow via `glow={false}` — confident presence, no flashy effects.
 */
export default function HomeScreenV2() {
  const {
    weekDays,
    visibleWeek,
    weekLabel,
    weekOffset,
    isThisWeek,
    handlePrev,
    handleNext,
    handleThisWeek,
    selectedIdx,
    todayIdx,
    mode,
    handleDayTap,
    handleSelectDayOnly,
    handleSelectDay,
    handleClearSelection,
    handleCancelMove,
    handleAddGameMode,
    handleViewWorkout,
    handleFinishTeamSession,
    handleApplyGuidedInjury,
    handleApplyEquipmentDecision,
    handleApplyShortOnTimeToday,
    handleApplyAwayDays,
    handleApplyWeekReadiness,
    handleClearWeekReadiness,
    missedSessionPrompt,
    handleMissedSessionResponse,
    staleByDate,
    weekHasGame,
    showAddGameCTA,
    showPracticeMatchCTA,
    currentPhase,
    coachNotes,
    activeConstraints,
    todayReadinessModifier,
    injuryEpisodes,
    readinessFacts,
    equipmentFacts,
    visibleReversibleAdjustments,
    currentProgram,
    sessionFeedback,
    seasonPhaseSkew,
    seasonPhaseRepairBusy,
    seasonPhaseRepairError,
    handleRepairSeasonPhaseSkew,
    handleClearCoachNote,
    handleDismissCoachNote,
    handleUpdateCoachNoteStatus,
    gameModalVisible,
    gameModalDate,
    gameModalLabel,
    closeGameModal,
    handleOpenGameDayActions,
    handleLogGame,
    handleMoveGameDay,
    handleRemoveGameDay,
    rebuildModalVisible,
    isRebuilding,
    rebuildError,
    rebuildErrorCanRetry,
    rolloverRefusal,
    handleRetryRollover,
    rebuildMsgIdx,
    rebuildMsgOpacity,
    handleCancelRebuild,
    handleConfirmRebuild,
    phaseShiftModalVisible,
    phaseShiftStep,
    pendingPreferredDays,
    pendingTeamDays,
    pendingGameDay,
    pendingGameAnchorAnswered,
    targetPhase,
    handleOpenPhaseShift,
    handleCancelPhaseShift,
    handlePhaseShiftBack,
    togglePendingPreferredDay,
    togglePendingTeamDay,
    setPendingGameDay,
    answerNoUsualGameDay,
    handleAdvancePhaseShift,
  } = useHomeScreen();

  const isNormal = mode.type === 'normal';
  const practiceMatchDay = weekDays.find((day) => day.workout?.workoutType === 'Game') ?? null;
  const practiceMatchLabel = practiceMatchDay
    ? `Practice match: ${new Date(practiceMatchDay.date + 'T12:00:00').toLocaleDateString('en-AU', {
        weekday: 'long',
      })}`
    : 'Add a pre-season practice match';
  const handlePracticeMatchPress = () => {
    if (practiceMatchDay) {
      handleOpenGameDayActions(practiceMatchDay.date);
      return;
    }
    handleAddGameMode();
  };

  // ── Day-first vs week (Sam's day-first direction, 2026-08-01) ──
  //
  // TODAY LEADS, AND THE WEEK IS THE ZOOM-OUT — the direction's own words: "the
  // regular Program view leads with TODAY — days and dates of the week as a
  // strip at the top; the selected day shows what's scheduled. A tab/top control
  // zooms out to weekly or monthly view."
  //
  // TWO SHAPES OF ONE SCREEN, NOT TWO SCREENS. Both render the same
  // `visibleWeek`, the same `DayRow` and the same doors; what differs is how
  // many days are drawn at full size. A rival day-first screen would be two live
  // truths about one week — the shape every law in this repo exists to kill.
  //
  // THE WEEK VIEW IS NOT OPTIONAL CHROME, IT IS THE FORCED SHAPE FOR TWO CASES,
  // and both are about a day-first view having no day to be about:
  //   - ANOTHER WEEK has no today, and `useHomeScreen` deliberately selects
  //     nothing when the athlete browses off this week (selection is emphasis;
  //     browsing should not pre-emphasise an arbitrary Monday). A day-first view
  //     there would either show nothing or need a second selection rule.
  //   - A PICKER (move game / add game) asks the athlete to choose among all
  //     seven days. That is a week-level act, and the picker's target rows and
  //     their testIDs stay exactly as they were.
  const [preferredProgramView, setPreferredProgramView] =
    useState<'today' | 'week'>('today');
  const dayFirst = preferredProgramView === 'today' && isThisWeek && isNormal;
  // Selection is owned by `useHomeScreen`; this only says which day the
  // day-first view is ABOUT when that owner is holding the sentinel.
  const dayFirstIdx = selectedIdx >= 0 ? selectedIdx : todayIdx;
  const dayFirstDay = dayFirstIdx >= 0 ? weekDays[dayFirstIdx] : null;

  // ── Tap-first plan-change sheet (ATHLETE_CHANGE_VOCABULARY.md group 1) ──
  const [changeSheetDate, setChangeSheetDate] = useState<string | null>(null);
  const [coachNoteSheet, setCoachNoteSheet] = useState<{
    mode: 'clear' | 'update';
    note: ActiveCoachNote;
  } | null>(null);
  const [injuryFlowNote, setInjuryFlowNote] = useState<ActiveCoachNote | null>(null);
  const [awayDaysVisible, setAwayDaysVisible] = useState(false);
  // ONE ACK STATE FOR BOTH SCHEDULE DOORS. They are two buttons writing one fact
  // kind through one executor; two acknowledgment states would be two places to
  // forget to set. Rendered under the rows for the sheet-less door and inside
  // the sheet for the other, so the answer appears where the tap happened.
  const [scheduleAck, setScheduleAck] = useState<ReadinessAcknowledgment | null>(null);
  const [equipmentVisible, setEquipmentVisible] = useState(false);

  // ── Weekly readiness ("I'm sick/flat today") — week-level card ──
  // Active state is derived from the EXISTING tap modifiers for the
  // currently selected week (ids are week-keyed by Monday).
  const [readinessVisible, setReadinessVisible] = useState(false);
  const [readinessAck, setReadinessAck] = useState<ReadinessAcknowledgment | null>(null);
  // Opt-in "make today lighter" offer, shown after a today-scoped readiness report.
  // The offer CARRIES the fact the athlete just authored (Sam's D-3 ruling,
  // 2026-08-05). The door returns that id; dropping it here is what forced the
  // transaction to re-guess which fact today's trim belonged to.
  const [lighterDayOffer, setLighterDayOffer] =
    useState<{ date: string; factId?: string } | null>(null);
  const [lighterDayBusy, setLighterDayBusy] = useState(false);
  const [readinessInjuryVisible, setReadinessInjuryVisible] = useState(false);
  const weekAnchorISO = weekDays[0]?.date ?? todayISOLocal();
  const readinessActiveConstraints = useCoachUpdatesStore((s: any) => s.activeConstraints) ?? [];
  // Pure projection of the canonical readiness source facts (+ preserved legacy
  // recovery-mode path). See docs/READINESS_SOURCE_FACT_REASSESSMENT_2026-07-22.md
  // — a fatigue "tired today" fact now flips this card because the label reads the
  // fact the write produces, not the legacy tap-* constraint-id scheme.
  const weekReadiness = useMemo(() => resolveVisibleReadinessState({
    readinessFacts,
    activeConstraints: readinessActiveConstraints,
    weekAnchorISO,
    todayISO: todayISOLocal(),
    isThisWeek,
    todayReadinessModifier,
  }), [isThisWeek, readinessActiveConstraints, readinessFacts, todayReadinessModifier, weekAnchorISO]);
  const activeEquipmentFact = equipmentFacts.find((fact) => fact.status === 'active') ?? null;
  const readinessProgrammingEffectFactIds = useMemo(() => new Set(
    activeConstraints.flatMap((constraint) => constraint.temporarySourceFactIds ?? []),
  ), [activeConstraints]);
  const activeFixtureId = gameModalDate
    ? weekDays.find((day) => day.date === gameModalDate)?.workout?.id ?? `calendar-game-${gameModalDate}`
    : 'calendar-game-unknown';
  const feedbackRenderWitnesses = useMemo(() => Object.values(sessionFeedback)
    .flatMap((feedback) => {
      const receipt = feedback?.outcomeReceipt;
      if (!receipt) return [];
      return [{
        receipt,
        progressionTarget: deriveFutureProgressionRenderTarget({
          program: currentProgram,
          receipt,
        }),
      }];
    }), [currentProgram, sessionFeedback]);
  const receiptIdsForDate = (date: string): string[] => feedbackRenderWitnesses
    .filter((witness) => witness.receipt.date === date)
    .map((witness) => witness.receipt.transactionId);
  const progressionReceiptsForDate = (date: string) => feedbackRenderWitnesses
    .filter((witness) => witness.progressionTarget?.targetDate === date)
    .map((witness) => ({
      transactionId: witness.receipt.transactionId,
      targetSessionId: witness.progressionTarget!.targetSessionId,
    }));
  const adjustmentResultWitnesses = useMemo(() => {
    const testIDs: string[] = [];
    for (const adjustment of visibleReversibleAdjustments) {
      const constraint = adjustment.displacedOriginalState.userRemovalConstraint;
      if (!constraint) continue;
      const sessionId = constraint.targetWorkoutId;
      if (adjustment.kind === 'session_move' && constraint.moveTargetDate) {
        testIDs.push(explorerTestId.sessionMutationResult(
          'move',
          `${sessionId}:${constraint.moveTargetDate}`,
        ));
      }
      if (adjustment.kind === 'session_delete' || adjustment.kind === 'session_component_delete') {
        const resultScope = constraint.scope === 'whole_session'
          ? 'whole_day'
          : constraint.scope === 'strength_component'
            ? 'strength'
            : constraint.scope === 'conditioning_component'
              ? 'conditioning'
              : constraint.scope === 'recovery_component'
                ? 'recovery'
                : 'team';
        testIDs.push(explorerTestId.sessionMutationResult(
          'delete',
          `${sessionId}:${resultScope}`,
        ));
      }
      if (adjustment.kind === 'session_component_delete') {
        const remainingIdentities = new Set((constraint.remainingWorkout?.exercises ?? []).map(
          (exercise) => String(exercise.id || exercise.exerciseId || exercise.exercise?.id || ''),
        ));
        for (const exercise of constraint.originalWorkout.exercises) {
          const componentId = String(
            exercise.id || exercise.exerciseId || exercise.exercise?.id || '',
          );
          if (componentId && !remainingIdentities.has(componentId)) {
            testIDs.push(explorerTestId.componentDeleteResult(sessionId, componentId));
          }
        }
      }
    }
    return Array.from(new Set(testIDs));
  }, [visibleReversibleAdjustments]);

  const handleCoachNoteAction = (
    note: ActiveCoachNote,
    action: ActiveCoachNoteAction,
  ) => {
    if (action.kind === 'update_injury') {
      setInjuryFlowNote(note);
      return;
    }
    if (action.kind === 'dismiss_note') {
      handleDismissCoachNote(note.id);
      return;
    }
    setCoachNoteSheet({
      mode: action.kind.startsWith('clear') || action.kind === 'restore_adjustment'
        ? 'clear'
        : 'update',
      note,
    });
  };

  const handleConfirmCoachNoteClear = () => {
    if (!coachNoteSheet) return;
    void handleClearCoachNote(coachNoteSheet.note.id);
    setCoachNoteSheet(null);
  };

  const handleCoachNoteStatusUpdate = (status: ProgramControlStatusUpdate) => {
    if (!coachNoteSheet) return;
    void handleUpdateCoachNoteStatus(coachNoteSheet.note.id, status);
    setCoachNoteSheet(null);
  };
  const injuryFlowConstraint = injuryFlowNote
    ? activeConstraints.find((constraint): constraint is ActiveInjuryConstraint =>
        constraint.type === 'injury' && constraint.id === injuryFlowNote.constraintId)
    : null;
  const injuryFlowInitial = useMemo(
    () => guidedInjuryResultFromConstraint(injuryFlowConstraint),
    [injuryFlowConstraint],
  );

  /**
   * ONE FULL-SIZE DAY ROW, WHICHEVER SHAPE THE SCREEN IS IN.
   *
   * The week view calls this seven times, the day-first view once. Everything a
   * row is — its doors, its badges, its receipts, its testIDs — is decided here
   * and only here, so the two shapes cannot drift into offering different things
   * on the same day.
   *
   * The one difference is the tap, and it is the honest one: in the week view
   * tapping the open row COLLAPSES it (selection is expansion, and the list is
   * still whole without it); in the day-first view the row is what the screen is
   * about, so tapping it re-selects rather than emptying the screen. Game days
   * keep their action sheet in both.
   */
  const renderDayRow = (day: typeof weekDays[0], idx: number) => {
    const isSelected = dayFirst ? true : idx === selectedIdx;
    const hasWorkout = !!day.workout;
    const isGame = day.workout?.workoutType === 'Game';
    const isMoveSource = mode.type === 'moveGame' && day.date === mode.fromDate;
    const isPickerMode = mode.type === 'moveGame' || mode.type === 'addGame';
    const isMoveTarget = isPickerMode && !isMoveSource;
    // The projection's answer for this date — the card's ONE source for
    // its title/context words. `visibleWeek` and `weekDays` are the same
    // derivation (`project()` wraps `buildProgramTabProjectedWeek`), so
    // this find is always a hit; `undefined` only guards a render before
    // the two have settled together.
    const visibleDay = visibleWeek.days.find((candidate) => candidate.date === day.date);

    return (
      <DayRow
        key={day.date}
        day={day}
        visibleDay={visibleDay}
        isSelected={isSelected}
        isMoveSource={isMoveSource}
        isMoveTarget={isMoveTarget}
        pickerMode={mode.type}
        hasWorkout={hasWorkout}
        isGame={!!isGame}
        onPress={() => {
          if (dayFirst && !isGame) return handleSelectDay(idx);
          return isGame && isNormal ? handleSelectDayOnly(idx) : handleDayTap(idx);
        }}
        onViewWorkout={() => handleViewWorkout(day)}
        onFinishTeam={() => handleFinishTeamSession(day)}
        onLogGame={() => handleLogGame(day.date)}
        onGameDayActions={() => handleOpenGameDayActions(day.date)}
        onMakeChange={() => setChangeSheetDate(day.date)}
        staleWarning={staleByDate[day.date]}
        normal={isNormal}
        feedbackReceipts={receiptIdsForDate(day.date)}
        progressionReceipts={progressionReceiptsForDate(day.date)}
        /* THE COMPONENT TIMELINE — day-first only, and it is a READ.
           `dayTimeline` folds the athlete's SAVED outcome onto the projection's
           parts; nothing here writes. A tap opens the same day-detail door the
           row's own CTA opens (Sam's fork A: completion shown, not written). */
        timeline={dayFirst && visibleDay ? (
          <DayTimeline
            entries={dayTimeline(visibleDay, sessionFeedback[day.date])}
            onOpen={() => handleViewWorkout(day)}
          />
        ) : null}
      />
    );
  };

  // Smoke harness no longer renders any controls in HomeScreen. The
  // coach-bike-flow regression now opens Wednesday's DayWorkout directly
  // from CoachScreen (see CoachScreen.handleSmokeOpenWednesdayWorkout),
  // so HomeScreen owns no smoke testIDs and produces no smoke logs.
  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="program-screen">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/*
         * Tap-outside dismiss layer.
         *
         * Wraps the full scroll body in a transparent Pressable whose
         * onPress clears the row selection. Nested Pressables (Card,
         * Button, IconButton, chips) claim the touch responder before
         * this outer layer ever fires, so taps *inside* a day card or any
         * interactive control behave exactly as before — only taps on
         * padding / whitespace between controls reach here.
         *
         * Scroll gestures are untouched: Pressable cancels press when
         * the touch moves beyond the press threshold, which is exactly
         * how ScrollView begins a scroll. No `onStartShouldSetResponder`
         * shenanigans required.
         *
         * `accessible={false}` hides this from screen readers so it isn't
         * announced as an extra "button" wrapping the whole view.
         */}
        <Pressable
          /* NOT IN THE DAY-FIRST SHAPE. Clearing the selection means "collapse
             the expanded row", which is a week-list act: the list is still whole
             with nothing expanded. In the day-first shape the selection is WHICH
             DAY the screen is about, so a tap on whitespace would silently snap
             the athlete off the Thursday they picked and back to today. */
          onPress={dayFirst ? undefined : handleClearSelection}
          accessible={false}
        >
        {/* ── Week nav bar ── */}
        <View style={styles.topBar}>
          <View style={styles.topBarRow}>
            <IconButton
              onPress={handlePrev}
              accessibilityLabel="Previous week"
              testID="program-week-previous"
              icon={
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M15 18l-6-6 6-6" />
                </Svg>
              }
            />
            <Pressable
              style={styles.topBarCenter}
              onPress={isThisWeek ? undefined : handleThisWeek}
              accessibilityLabel={isThisWeek ? 'This week' : 'Return to this week'}
              testID="program-week-current"
            >
              <Text style={styles.topBarLabel} numberOfLines={1}>{weekLabel}</Text>
              {(() => {
                // Relative week badge beside the date range — "This week"
                // keeps its existing treatment; the adjacent weeks get the
                // same quiet outline so the athlete always knows where
                // they are relative to now.
                const badgeLabel = isThisWeek
                  ? 'This week'
                  : weekOffset === 1
                  ? 'Next week'
                  : weekOffset === -1
                  ? 'Last week'
                  : null;
                return badgeLabel
                  ? <Badge label={badgeLabel} tone="outline" style={styles.topBarBadge} />
                  : null;
              })()}
            </Pressable>
            <View style={styles.topBarRight}>
              <IconButton
                onPress={handleNext}
                accessibilityLabel="Next week"
                testID="program-week-next"
                icon={
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M9 18l6-6-6-6" />
                  </Svg>
                }
              />
              {/* The week-rebuild button lived here and is GONE (Sam, device
                  pass 2026-07-29). It was dev tooling from early testing that
                  regenerated the whole week's content and discarded every custom
                  swap, sitting one tap from the next-week chevron. Athletes must
                  never have it. The rebuild machinery stays — clearing a coach
                  note, a phase shift and a fixture change all still rebuild —
                  but the athlete cannot ask for a rebuild as such. */}
            </View>
          </View>

          {/* ── Today / Week ──
              The zoom control Sam's direction asks for. Offered only where
              there is a choice to make: on another week there is no today, and
              during a game picker the athlete is choosing among all seven days.
              Both cases render the week and hide this rather than showing a
              control that would do nothing.

              COPY: "Today" and "Week" are PROPOSED, UNSIGNED — the day-first
              slice's only new chrome words, and they join Sam's next signing
              batch. Both are already this screen's vocabulary ("Today" is the
              day badge; "This week" / "Next week" / "Last week" are the nav
              badges), which is why they were chosen over inventing a pair. The
              extraction gate does not count them — it only sees prose — so this
              comment is the record that they are new, not the gate. */}
          {isThisWeek && isNormal ? (
            <View style={styles.viewToggle} testID="program-view-toggle">
              {(['today', 'week'] as const).map((option) => {
                const isActive = preferredProgramView === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setPreferredProgramView(option)}
                    testID={`program-view-${option}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={option === 'today' ? 'Today' : 'Week'}
                    style={({ pressed }) => [
                      styles.viewToggleOption,
                      isActive && styles.viewToggleOptionActive,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.viewToggleLabel,
                        isActive && styles.viewToggleLabelActive,
                      ]}
                    >
                      {option === 'today' ? 'Today' : 'Week'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

        </View>

        {/* ── Picker banners ── */}
        {mode.type === 'moveGame' && (
          <MoveBanner text="Tap the day to move the game to" onCancel={handleCancelMove} />
        )}
        {mode.type === 'addGame' && (
          <MoveBanner
            text={currentPhase === 'Pre-season' ? 'Tap the day to set the practice match' : 'Tap the day to set as game day'}
            onCancel={handleCancelMove}
          />
        )}

        {/* ── Missed-session follow-up ── */}
        {isNormal && missedSessionPrompt && (
          <MissedSessionPrompt
            missed={missedSessionPrompt}
            onRespond={(response) =>
              void handleMissedSessionResponse(missedSessionPrompt, response)}
          />
        )}

        {/* ── Season-phase skew disclosure ──
            Stored state that is already wrong. The profile and the program
            clock disagree, from a phase shift whose profile write landed
            before its rebuild failed. Neither value is quietly overwritten to
            match the other — the athlete is told what their week is actually
            built as, what they told us they are, and offered one press that
            reconciles it through the same atomic transaction a deliberate
            phase shift uses. */}
        {seasonPhaseSkew && (
          <View style={styles.phaseSkewCard} testID="home-season-phase-skew">
            <Text style={styles.phaseSkewTitle}>Your program is out of step</Text>
            <Text style={styles.phaseSkewBody}>
              This week is still built as {seasonPhaseSkew.ownedPhase}, but you told
              us you're {seasonPhaseSkew.profileSelection}. Nothing has been changed
              either way — rebuild when you're ready.
            </Text>
            {seasonPhaseRepairError ? (
              <Text style={styles.phaseSkewError} testID="home-season-phase-skew-error">
                {seasonPhaseRepairError}
              </Text>
            ) : null}
            <Button
              label={seasonPhaseRepairBusy
                ? 'Rebuilding…'
                : `Rebuild as ${seasonPhaseSkew.profileSelection}`}
              size="md"
              disabled={seasonPhaseRepairBusy}
              onPress={() => void handleRepairSeasonPhaseSkew()}
              testID="home-season-phase-skew-repair"
            />
          </View>
        )}

        {/* ── What's shaping this week ──
            A4 rider (a): above the week it explains, and only while something
            is actually active — CoachNotesSection renders nothing when the list
            is empty, so a normal week loses no screen space. Rider (c): one
            line and one clear per active fact, never collapsed. Rider (d): the
            clears route through handleCoachNoteAction, the same cascade doors
            used everywhere else. */}
        <CoachNotesSection
          notes={coachNotes}
          equipmentFactIds={new Set(equipmentFacts.map((fact) => fact.factId))}
          onAction={handleCoachNoteAction}
        />

        {/* ── The week ──
            ONE ROW CALL SITE FOR BOTH SHAPES. `renderDayRow` below is the only
            place a day is drawn at full size; the day-first view calls it once
            and the week view calls it seven times. Two JSX copies of a sixteen-
            prop row is two places to forget a prop, and the one that got
            forgotten would be the one nobody looked at. */}
        {dayFirst ? (
          <View style={styles.dayFirst}>
            <WeekStrip
              weekDays={weekDays}
              visibleWeek={visibleWeek}
              activeDate={dayFirstDay?.date ?? null}
              onSelect={handleSelectDay}
            />
            {dayFirstDay ? renderDayRow(dayFirstDay, dayFirstIdx) : null}
            {/* THE SIX DAYS THE STRIP STANDS IN FOR STILL REPORT THEMSELVES.
                Every day mounts its canonical state leaves in BOTH shapes — a
                fixture's state node, a session card, a saved-feedback receipt.
                Without this, changing the shape of the screen would silently
                narrow what the explorer can observe, and a day-first view would
                start reporting that six of the athlete's days do not exist. */}
            {weekDays.map((day, idx) => (idx === dayFirstIdx ? null : (
              <DayStateLeaves
                key={day.date}
                day={day}
                feedbackReceipts={receiptIdsForDate(day.date)}
                progressionReceipts={progressionReceiptsForDate(day.date)}
                stateToken={dayStateToken({
                  day,
                  isSelected: false,
                  isMoveSource: false,
                  isMoveTarget: false,
                })}
              />
            )))}
          </View>
        ) : (
          <View style={styles.dayList}>
            {weekDays.map((day, idx) => renderDayRow(day, idx))}
          </View>
        )}

        {/* Canonical state leaves survive wording changes and cold reloads. */}
        {injuryEpisodes.map((episode) => (
          <ExplorerRenderWitness
            key={`injury-${episode.episodeId}-${episode.status}`}
            testID={episode.status === 'active' || episode.status === 'improving'
              ? explorerTestId.injuryActive(episode.episodeId)
              : explorerTestId.injuryResolved(episode.episodeId)}
          />
        ))}
        {readinessFacts.map((fact) => (
          <React.Fragment key={`readiness-${fact.factId}-${fact.status}`}>
            <ExplorerRenderWitness
              testID={fact.status === 'active'
                ? explorerTestId.readinessActive(fact.factId)
                : explorerTestId.readinessClear(fact.factId)}
            />
            {fact.status === 'active' && readinessProgrammingEffectFactIds.has(fact.factId) ? (
              <ExplorerRenderWitness
                testID={explorerTestId.readinessProgrammingEffect(fact.factId)}
              />
            ) : null}
          </React.Fragment>
        ))}
        {weekReadiness && readinessFacts.every((fact) => fact.status !== 'active') ? (
          <>
            <ExplorerRenderWitness testID={explorerTestId.readinessActive(weekReadiness.id)} />
            <ExplorerRenderWitness
              testID={explorerTestId.readinessProgrammingEffect(weekReadiness.id)}
            />
          </>
        ) : null}
        {!weekReadiness && readinessFacts.every((fact) => fact.status !== 'active') ? (
          <ExplorerRenderWitness testID={explorerTestId.readinessClearState(weekAnchorISO)} />
        ) : null}
        {equipmentFacts.map((fact) => (
          <ExplorerRenderWitness
            key={`equipment-${fact.factId}-${fact.status}`}
            testID={fact.status === 'active'
              ? explorerTestId.equipmentActive(fact.factId)
              : explorerTestId.equipmentCleared(fact.factId)}
          />
        ))}
        {visibleReversibleAdjustments.map((adjustment) => (
          <React.Fragment key={`adjustment-${adjustment.id}-${adjustment.status}`}>
            <ExplorerRenderWitness
              testID={adjustment.status === 'active'
                ? explorerTestId.adjustmentActive(adjustment.id)
                : adjustment.status === 'cleared'
                  ? explorerTestId.adjustmentRestored(adjustment.id)
                  : explorerTestId.adjustmentState(adjustment.id, adjustment.status)}
            />
          </React.Fragment>
        ))}
        {adjustmentResultWitnesses.map((testID) => (
          <ExplorerRenderWitness key={testID} testID={testID} />
        ))}

        {/* ── No game CTA ── */}
        {isNormal && currentPhase === 'In-season' && !weekHasGame && showAddGameCTA && (
          <Pressable
            onPress={handleAddGameMode}
            testID={explorerTestId.fixtureIngress('add', weekAnchorISO)}
            accessibilityRole="button"
            accessibilityLabel={explorerTestId.fixtureIngress('add', weekAnchorISO)}
            style={({ pressed }) => [pressed && { opacity: 0.75 }]}
          >
            <Card tone="default" padding="md" radius="lg" style={styles.addGame}>
              <View style={styles.addGameRow}>
                <View style={styles.addGameIcon}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M12 5v14" /><Path d="M5 12h14" />
                  </Svg>
                </View>
                <Text style={styles.addGameText}>No game this week - add one</Text>
              </View>
            </Card>
          </Pressable>
        )}

        {/* ── Block-rollover honest refusal (Sam's interim ruling, 2026-07-31) ──
            NOT gated on isNormal: a program that stopped must say so whatever
            mode the screen is in. The sentence is the ack owner's
            (`buildRolloverAcknowledgment`); tapping retries the same boundary. */}
        {rolloverRefusal && (
          <Pressable
            onPress={handleRetryRollover}
            testID="home-rollover-refusal"
            accessibilityRole="button"
            accessibilityLabel={rolloverRefusal.message}
            style={({ pressed }) => [pressed && { opacity: 0.75 }]}
          >
            <Card tone="default" padding="md" radius="lg" style={styles.busyAwayEntry}>
              <Text style={[styles.busyAwayText, styles.scheduleAckError]}>
                {rolloverRefusal.message}
              </Text>
              <Text style={styles.busyAwayText}>Try again</Text>
            </Card>
          </Pressable>
        )}

        {/* ── Short on time today (ruling 2) ──
            TWO BUTTONS, TWO FACTS, NO MENU BETWEEN THEM. This half commits on
            the tap — as the busy row inside the old sheet already did — and the
            fact it writes is TODAY-scoped because the words say today. */}
        {isNormal && (
          <Pressable
            onPress={async () => {
              // NEVER IN SILENCE. The tap used to discard its result, and the
              // result is `ok: false` on every device with a real accepted base
              // (declared red 1) — so this button reported nothing at all while
              // doing nothing at all.
              setScheduleAck(null);
              const result = await handleApplyShortOnTimeToday();
              const ack = buildScheduleAcknowledgment(result, 'short_on_time');
              setScheduleAck(ack);
              // The tape's witness that the ack layer RAN — Sam's 2026-08-01
              // silence could not be reproduced below this line, so this line
              // reports itself. See recordScheduleAckPresented.
              recordScheduleAckPresented({
                traceId: result?.traceId, surface: 'short_on_time_today', tone: ack.tone,
              });
            }}
            style={({ pressed }) => [pressed && { opacity: 0.75 }]}
            testID="home-short-on-time-entry"
            accessibilityRole="button"
            accessibilityLabel="Short on time today"
          >
            <Card tone="default" padding="md" radius="lg" style={styles.busyAwayEntry}>
              <View style={styles.busyAwayRow}>
                <View style={styles.busyAwayIcon}>
                  {/* Stopwatch — Sam's pick, 2026-08-03 icon ruling row 1
                      (replacing the hourglass): time being COUNTED on one day.
                      The hourglass it replaces is now nobody's, so no two rows
                      share a glyph. */}
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#1EA7FF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M10 2h4" />
                    <Circle cx="12" cy="14" r="8" />
                    <Path d="M12 14l3-3" />
                  </Svg>
                </View>
                <Text style={styles.busyAwayText}>Short on time today</Text>
              </View>
            </Card>
          </Pressable>
        )}

        {/* ── Away this week? (ruling 2) — the one question with an answer ── */}
        {isNormal && (
          <Pressable
            onPress={() => { setScheduleAck(null); setAwayDaysVisible(true); }}
            style={({ pressed }) => [pressed && { opacity: 0.75 }]}
            testID="home-away-this-week-entry"
            accessibilityRole="button"
            accessibilityLabel="Away this week?"
          >
            <Card tone="default" padding="md" radius="lg" style={styles.busyAwayEntry}>
              <View style={styles.busyAwayRow}>
                <View style={[styles.busyAwayIcon, styles.awayIconTint]}>
                  {/* Globe — the same glyph the away row carried inside the old
                      sheet, promoted with it. */}
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#7CC4FF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M12 2a10 10 0 100 20 10 10 0 000-20z" /><Path d="M3 12h18" />
                    <Path d="M12 2a15 15 0 010 20" /><Path d="M12 2a15 15 0 000 20" />
                  </Svg>
                </View>
                <Text style={styles.busyAwayText}>Away this week?</Text>
              </View>
            </Card>
          </Pressable>
        )}

        {/* The answer to a schedule tap, in the athlete's own words. Tapping it
            dismisses it — an acknowledgment the athlete cannot clear is a banner. */}
        {isNormal && scheduleAck && !awayDaysVisible && (
          <Pressable
            onPress={() => setScheduleAck(null)}
            style={({ pressed }) => [pressed && { opacity: 0.75 }]}
            testID="home-schedule-ack"
            accessibilityRole="button"
            accessibilityLabel={scheduleAck.message}
          >
            <Card tone="default" padding="md" radius="lg" style={styles.busyAwayEntry}>
              <Text style={[
                styles.busyAwayText,
                scheduleAck.tone === 'error' && styles.scheduleAckError,
              ]}>
                {scheduleAck.message}
              </Text>
            </Card>
          </Pressable>
        )}

        {/* ── Weekly readiness ("I'm sick/flat today") — all phases, week-level ── */}
        {isNormal && (
          <Pressable
            onPress={() => { setReadinessAck(null); setReadinessVisible(true); }}
            style={({ pressed }) => [pressed && { opacity: 0.75 }]}
            testID={weekReadiness
              ? explorerTestId.readinessUpdate(weekReadiness.id)
              : explorerTestId.readinessSetAction(`readiness-${weekAnchorISO}`)}
            accessibilityRole="button"
            accessibilityLabel={weekReadiness
              ? explorerTestId.readinessUpdate(weekReadiness.id)
              : explorerTestId.readinessSetAction(`readiness-${weekAnchorISO}`)}
          >
            <Card tone="default" padding="md" radius="lg" style={styles.busyAwayEntry}>
              <View style={styles.busyAwayRow}>
                <View style={[styles.busyAwayIcon, styles.readinessIconTint]}>
                  {/* Thermometer — Sam's pick, 2026-08-03 icon ruling row 2
                      (replacing the pulse line): being sick, not a heartbeat.
                      Same shape the readiness sheet's "Sick" bucket draws —
                      one meaning, one mark. The sheet's own "Update" row keeps
                      the pulse, which is now this surface's nobody-else's. */}
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#FF7A85" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0z" />
                  </Svg>
                </View>
                <Text style={styles.busyAwayText}>
                  {/* A4: the label is the owner's, not the card's.
                      `resolveVisibleReadinessState` already attributes it to the
                      fact kind; re-deriving it here from scope/isRecovery threw
                      that away and printed the same generic line for every
                      fact, which is what Sam saw on the phone. */}
                  {weekReadiness ? weekReadiness.title : "I'm sick/flat today"}
                </Text>
              </View>
            </Card>
          </Pressable>
        )}

        {/* ── I'm injured (ruling 3) ──
            ONE OWNER, TWO DOORS. This opens the SAME `GuidedInjuryFlowSheet`
            the readiness sheet's "Something hurts" row opens, and both complete
            through `handleApplyGuidedInjury`. The row inside the sheet stays:
            an athlete who starts at "I'm sick/flat" and discovers it is a niggle
            must not have to back out to a different button. */}
        {isNormal && (
          <Pressable
            onPress={() => setReadinessInjuryVisible(true)}
            style={({ pressed }) => [pressed && { opacity: 0.75 }]}
            testID="home-injured-entry"
            accessibilityRole="button"
            accessibilityLabel="I'm injured"
          >
            <Card tone="default" padding="md" radius="lg" style={styles.busyAwayEntry}>
              <View style={styles.busyAwayRow}>
                <View style={[styles.busyAwayIcon, styles.injuredIconTint]}>
                  {/* Plaster / bandage — an injury, not an alert triangle (that
                      one belongs to the readiness sheet's own "Something hurts"
                      row) and not the pulse above it. */}
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#FF8A4C" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M4.5 12.5 12.5 4.5a4 4 0 1 1 5.7 5.7l-8 8a4 4 0 1 1-5.7-5.7z" />
                    <Path d="M8.5 8.5 15.5 15.5" />
                  </Svg>
                </View>
                <Text style={styles.busyAwayText}>I'm injured</Text>
              </View>
            </Card>
          </Pressable>
        )}

        {isNormal && (
          <Pressable
            onPress={() => setEquipmentVisible(true)}
            style={({ pressed }) => [pressed && { opacity: 0.75 }]}
            testID={activeEquipmentFact
              ? explorerTestId.equipmentUpdate(activeEquipmentFact.factId)
              : explorerTestId.equipmentOption('open')}
            accessibilityRole="button"
            accessibilityLabel={activeEquipmentFact
              ? explorerTestId.equipmentUpdate(activeEquipmentFact.factId)
              : explorerTestId.equipmentOption('open')}
          >
            <Card tone="default" padding="md" radius="lg" style={styles.busyAwayEntry}>
              <View style={styles.busyAwayRow}>
                <View style={[styles.busyAwayIcon, styles.equipmentIconTint]}>
                  {/* Dumbbell struck through — Sam's pick, 2026-08-03 icon
                      ruling row 4 (replacing the plain dumbbell): equipment
                      MISSING, not equipment. Same visual family as the day
                      screen's "No equipment" swap reason, redrawn in this
                      surface's inline-SVG idiom. */}
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#C6FF6B" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <Circle cx="5.5" cy="12" r="2.3" />
                    <Circle cx="18.5" cy="12" r="2.3" />
                    <Path d="M8 12h8" />
                    <Path d="M3 3l18 18" />
                  </Svg>
                </View>
                <Text style={styles.busyAwayText}>Missing equipment?</Text>
              </View>
            </Card>
          </Pressable>
        )}

        {isNormal && showPracticeMatchCTA && (
          <Pressable
            onPress={handlePracticeMatchPress}
            style={({ pressed }) => [pressed && { opacity: 0.75 }]}
            testID={practiceMatchDay?.workout
              ? explorerTestId.fixtureActions(practiceMatchDay.workout.id)
              : explorerTestId.fixtureIngress('add', weekAnchorISO)}
            accessibilityRole="button"
            accessibilityLabel={practiceMatchDay?.workout
              ? explorerTestId.fixtureActions(practiceMatchDay.workout.id)
              : explorerTestId.fixtureIngress('add', weekAnchorISO)}
          >
            {/* Same component treatment as the busy/away card above — only
                the icon, tint and label differ. Reuses the busyAway* styles
                so the two cards can never drift apart. */}
            <Card tone="default" padding="md" radius="lg" style={styles.busyAwayEntry}>
              <View style={styles.busyAwayRow}>
                <View style={[styles.busyAwayIcon, styles.practiceMatchIconTint]}>
                  <RowIcon kind="game" size={14} color={DAY_ROW_ACCENT.game} />
                </View>
                <Text style={styles.busyAwayText}>{practiceMatchLabel}</Text>
              </View>
            </Card>
          </Pressable>
        )}

        {/* ── Phase shift card ── */}
        {isNormal && (
          <View style={styles.section}>
            <Card tone="outline" padding="lg" radius="xl" style={styles.phaseCard}>
              <Text style={styles.phaseBadge}>You’re in {currentPhase} mode</Text>
              <Text style={styles.phaseBody}>
                Hit the button below when you’re ready to move to the next phase.
              </Text>
              <Button
                label={`Shift to ${NEXT_PHASE[currentPhase]} mode`}
                onPress={() => handleOpenPhaseShift(NEXT_PHASE[currentPhase])}
                variant="outline"
                size="md"
              />
            </Card>
          </View>
        )}
        </Pressable>
      </ScrollView>

      {/* ── Sheets ── */}
      <PlanChangeSheet
        visible={changeSheetDate !== null}
        date={changeSheetDate}
        weekDays={weekDays}
        onClose={() => setChangeSheetDate(null)}
      />

      <GameDaySheet
        visible={gameModalVisible}
        onClose={closeGameModal}
        label={gameModalLabel}
        fixtureId={activeFixtureId}
        onMove={handleMoveGameDay}
        onRemove={handleRemoveGameDay}
      />

      <WeekReadinessSheet
        visible={readinessVisible}
        active={weekReadiness}
        acknowledgment={readinessAck}
        lighterDayOffer={lighterDayOffer}
        lighterDayBusy={lighterDayBusy}
        onClose={() => { setReadinessVisible(false); setReadinessAck(null); setLighterDayOffer(null); }}
        onApply={async (kind) => {
          // Acknowledge unconditionally — never close in silence. On success the
          // sheet transitions to the adjusted/acknowledged state (active is now
          // set); on failure the error acknowledgment is shown in place.
          const result = await handleApplyWeekReadiness(kind, weekAnchorISO);
          setReadinessAck(buildReadinessAcknowledgment(result));
          // Opt-in lighter-day / "soften today" offer after a today-scoped report.
          const todayScoped = kind === 'tired_today' || kind === 'poor_sleep_today' ||
            kind === 'sore_today' || kind === 'illness_mild';
          setLighterDayOffer(result?.ok && todayScoped
            ? { date: todayISOLocal(), factId: result.createdModifierIds?.[0] }
            : null);
        }}
        onAcceptLighterDay={async (date) => {
          setLighterDayBusy(true);
          try {
            const outcome = await applyLighterDayForToday({
              date, todayISO: date, sourceFactId: lighterDayOffer?.factId,
            });
            setLighterDayOffer(null);
            setReadinessAck(outcome.ok
              ? { tone: 'success', message: outcome.message }
              : { tone: 'error', message: outcome.message });
          } finally {
            setLighterDayBusy(false);
          }
        }}
        onDeclineLighterDay={() => setLighterDayOffer(null)}
        onClear={async (modifierId) => {
          await handleClearWeekReadiness(modifierId);
          setReadinessAck(null);
          setLighterDayOffer(null);
          setReadinessVisible(false);
        }}
        onInjury={() => {
          setReadinessVisible(false);
          setReadinessInjuryVisible(true);
        }}
      />

      {/* Fresh guided injury flow launched from the weekly readiness sheet.
          Same flow + same set_injury_modifier action as the day sheet. */}
      <GuidedInjuryFlowSheet
        visible={readinessInjuryVisible}
        onClose={() => setReadinessInjuryVisible(false)}
        titlePrefix="Injury"
        onComplete={async (result) => {
          await handleApplyGuidedInjury(result);
          setReadinessInjuryVisible(false);
        }}
      />

      <AwayDaysSheet
        visible={awayDaysVisible}
        weekDays={weekDays}
        visibleWeek={visibleWeek}
        acknowledgment={scheduleAck}
        onClose={() => { setAwayDaysVisible(false); setScheduleAck(null); }}
        onAwayDays={async (dates) => {
          // CLOSING IS THE CONFIRMATION, so it may only happen on success. The
          // sheet used to close unconditionally after the await, which is how a
          // refused commit read as "done" — the athlete watched the sheet
          // dismiss and believed their days were cleared.
          const result = await handleApplyAwayDays(dates);
          const ack = buildScheduleAcknowledgment(result, 'away');
          setScheduleAck(ack);
          recordScheduleAckPresented({
            traceId: result?.traceId, surface: 'away_this_week', tone: ack.tone,
          });
          if (result?.ok) setAwayDaysVisible(false);
        }}
      />

      <EquipmentLimitationSheet
        visible={equipmentVisible}
        activeFactId={activeEquipmentFact?.factId}
        targetFactId={equipmentFacts.find((fact) => fact.status !== 'active')?.factId}
        onClose={() => setEquipmentVisible(false)}
        onApply={async (decision) => {
          await handleApplyEquipmentDecision(decision, weekAnchorISO);
          setEquipmentVisible(false);
        }}
      />

      <RebuildSheet
        visible={rebuildModalVisible}
        onClose={handleCancelRebuild}
        isRebuilding={isRebuilding}
        error={rebuildError}
        canRetry={rebuildErrorCanRetry}
        msgIdx={rebuildMsgIdx}
        msgOpacity={rebuildMsgOpacity}
        onConfirm={handleConfirmRebuild}
      />

      <CoachNoteSheet
        state={coachNoteSheet}
        equipmentFactIds={new Set(equipmentFacts.map((fact) => fact.factId))}
        onClose={() => setCoachNoteSheet(null)}
        onConfirmClear={handleConfirmCoachNoteClear}
        onUpdateStatus={handleCoachNoteStatusUpdate}
      />

      <GuidedInjuryFlowSheet
        visible={injuryFlowNote !== null}
        onClose={() => setInjuryFlowNote(null)}
        initial={injuryFlowInitial}
        episodeId={injuryFlowNote?.injuryEpisodeId}
        titlePrefix="Update injury"
        onComplete={async (result) => {
          await handleApplyGuidedInjury(
            result,
            injuryFlowConstraint?.id ?? injuryFlowNote?.constraintId,
          );
          setInjuryFlowNote(null);
        }}
      />

      <PhaseShiftSheet
        visible={phaseShiftModalVisible}
        step={phaseShiftStep}
        targetPhase={targetPhase}
        isRebuilding={isRebuilding}
        error={rebuildError}
        canRetry={rebuildErrorCanRetry}
        msgIdx={rebuildMsgIdx}
        msgOpacity={rebuildMsgOpacity}
        pendingPreferredDays={pendingPreferredDays}
        pendingTeamDays={pendingTeamDays}
        pendingGameDay={pendingGameDay}
        gameAnchorAnswered={pendingGameAnchorAnswered}
        onClose={handleCancelPhaseShift}
        onBack={handlePhaseShiftBack}
        onTogglePendingPreferredDay={togglePendingPreferredDay}
        onTogglePendingTeamDay={togglePendingTeamDay}
        onSetPendingGameDay={setPendingGameDay}
        onAnswerNoUsualGameDay={answerNoUsualGameDay}
        onAdvance={handleAdvancePhaseShift}
      />
    </SafeAreaView>
  );
}

// ───────── Sub-components ─────────

interface MoveBannerProps { text: string; onCancel: () => void; }
function MoveBanner({ text, onCancel }: MoveBannerProps) {
  return (
    <View style={styles.moveBanner}>
      <Text style={styles.moveText}>{text}</Text>
      <Pressable onPress={onCancel} hitSlop={8}>
        <Text style={styles.moveCancel}>Cancel</Text>
      </Pressable>
    </View>
  );
}

interface DayRowProps {
  day: any;
  /** The projection's answer for this date. Card words come from here — see `title`/`contextLabel` below. */
  visibleDay: VisibleDay | undefined;
  isSelected: boolean;
  isMoveSource: boolean;
  isMoveTarget: boolean;
  pickerMode: 'normal' | 'moveGame' | 'addGame';
  hasWorkout: boolean;
  isGame: boolean;
  normal: boolean;
  onPress: () => void;
  onViewWorkout: () => void;
  onFinishTeam: () => void;
  onLogGame: () => void;
  onGameDayActions: () => void;
  onMakeChange: () => void;
  staleWarning: any;
  feedbackReceipts: string[];
  progressionReceipts: Array<{ transactionId: string; targetSessionId: string }>;
  /**
   * The day's component timeline, rendered inside the expanded block above the
   * session CTA. Passed in rather than built here: the row is presentation, and
   * WHICH shape of the screen shows a timeline is the screen's decision.
   */
  timeline?: React.ReactNode;
}

const DAY_ROW_ACCENT = {
  core: '#C6FF00',
  optional: '#5E6268',
  recovery: '#1EA7FF',
  game: '#FFC247',
} as const;

function getDayRowAccentColor({
  hasWorkout,
  isGame,
  sessionTier,
  title,
}: {
  hasWorkout: boolean;
  isGame: boolean;
  sessionTier?: string | null;
  title?: string | null;
}) {
  if (isGame) return DAY_ROW_ACCENT.game;
  const titleKey = displayLabelKey(title);
  if (titleKey === 'recovery' || titleKey === 'rest' || titleKey === 'rest day') {
    return DAY_ROW_ACCENT.recovery;
  }
  if (titleKey === 'hard conditioning') return '#D9874E';
  if (titleKey === 'sprint work') return DAY_ROW_ACCENT.core;
  if (!hasWorkout) return DAY_ROW_ACCENT.recovery;
  if (sessionTier === 'optional') return DAY_ROW_ACCENT.optional;
  if (sessionTier === 'recovery') return DAY_ROW_ACCENT.recovery;
  return DAY_ROW_ACCENT.core;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(200, 255, 0, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function selectedDayRowStyle(accentColor: string) {
  return {
    backgroundColor: hexToRgba(accentColor, 0.08),
    borderColor: accentColor,
    shadowColor: accentColor,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  };
}

function GameBadge() {
  return (
    <View style={styles.gameBadge}>
      <Text style={styles.gameBadgeText}>GAME</Text>
    </View>
  );
}

type RowIconKind =
  | 'strength'
  | 'team'
  | 'game'
  | 'recovery'
  | 'pulse'
  | 'refresh'
  | 'bolt'
  | 'flame'
  | 'mobility'
  | 'prehab'
  | 'core'
  | 'activity';

function displayLabelKey(label: string | null | undefined): string {
  return String(label ?? '')
    .replace(/^\+\s*/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function displayLabelIconKind(label: string | null | undefined): RowIconKind | null {
  const key = displayLabelKey(label);
  const conditioningKind = weeklyConditioningIconKind(key);
  if (conditioningKind) return conditioningKind;

  if (key === 'game' || key === 'game day') return 'game';
  if (key === 'team training') return 'team';

  if (
    key === 'recovery' ||
    key === 'recovery session' ||
    key === 'rest' ||
    key === 'rest day' ||
    key === 'passive recovery' ||
    key === 'extended recovery'
  ) {
    return 'recovery';
  }

  if (
    key === 'mobility' ||
    key === 'mobility flow' ||
    key.includes('mobility') ||
    key.includes('stretch') ||
    key.includes('pilates') ||
    key.includes('yoga')
  ) {
    return 'mobility';
  }

  if (
    key === 'accessories' ||
    key === 'prehab' ||
    key === 'rehab' ||
    key === 'prehab & accessories' ||
    key.includes('prehab') ||
    key.includes('rehab')
  ) {
    return 'prehab';
  }

  if (key === 'core' || key.includes('core')) return 'core';

  if (
    key === 'strength' ||
    key === 'strength session' ||
    key === 'lower squat' ||
    key === 'lower hinge' ||
    key === 'lower body strength' ||
    key === 'upper push' ||
    key === 'upper pull' ||
    key === 'upper body strength' ||
    key === 'full body strength' ||
    key === 'upper arms pump' ||
    key === 'gunshow'
  ) {
    return 'strength';
  }

  return null;
}

function titleIconKind({
  hasWorkout,
  isGame,
  title,
  workout,
}: {
  hasWorkout: boolean;
  isGame: boolean;
  title: string | null;
  workout?: any;
}): RowIconKind {
  if (isGame) return 'game';
  const labelKind = displayLabelIconKind(title);
  if (labelKind) return labelKind;
  if (!hasWorkout) return 'recovery';
  if (workout?.workoutType === 'Recovery' || workout?.sessionTier === 'recovery') {
    return 'recovery';
  }

  const workoutTypeKind = displayLabelIconKind(workout?.workoutType);
  if (workoutTypeKind) return workoutTypeKind;

  return 'activity';
}

function contextIconKind(label: string | null | undefined): RowIconKind | null {
  return displayLabelIconKind(label);
}

function rowIconColor(kind: RowIconKind): string {
  switch (kind) {
    case 'game':
      return '#FFC247';
    case 'recovery':
      return '#3AA7D8';
    case 'bolt':
      return '#B6D85A';
    case 'flame':
      return '#D9874E';
    case 'strength':
    case 'team':
    case 'pulse':
    case 'refresh':
    case 'mobility':
    case 'prehab':
    case 'core':
    case 'activity':
    default:
      return '#969696';
  }
}

function RowIcon({ kind, size = 15, color }: { kind: RowIconKind; size?: number; color?: string }) {
  const iconColor = color ?? rowIconColor(kind);

  if (kind === 'team') {
    return (
      <MaterialCommunityIcons
        name="account-multiple-outline"
        size={16}
        color={iconColor}
        style={[styles.rowIcon, styles.teamTrainingIcon]}
      />
    );
  }

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={iconColor}
      strokeWidth={2.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={styles.rowIcon}
    >
      {rowIconPaths(kind)}
    </Svg>
  );
}

function rowIconPaths(kind: RowIconKind) {
  switch (kind) {
    case 'game':
      return (
        <>
          <Path d="M8 4h8v4a4 4 0 01-8 0V4z" />
          <Path d="M8 6H5a3 3 0 003 3" />
          <Path d="M16 6h3a3 3 0 01-3 3" />
          <Path d="M12 12v4" />
          <Path d="M9 20h6" />
          <Path d="M10 16h4" />
        </>
      );
    case 'recovery':
      return (
        <>
          <Path d="M4 7h13a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z" />
          <Path d="M20 10v4" />
          <Path d="M11 9l-3 4h3l-1 3 4-5h-3l1-2z" />
        </>
      );
    case 'pulse':
      return <Path d="M3 12h4l2-5 4 10 2-5h6" />;
    case 'refresh':
      return (
        <>
          <Path d="M20 11a8 8 0 00-14.3-4.9L4 8" />
          <Path d="M4 4v4h4" />
          <Path d="M4 13a8 8 0 0014.3 4.9L20 16" />
          <Path d="M20 20v-4h-4" />
        </>
      );
    case 'bolt':
      return <Path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />;
    case 'flame':
      return (
        <>
          <Path d="M12 22c4 0 7-3 7-7 0-3-2-5-4-7 .2 3-1 4-2 5 0-4-2-6-4-8 .5 4-4 6-4 10 0 4 3 7 7 7z" />
          <Path d="M12 18c1.5 0 2.5-1.1 2.5-2.5 0-1-.5-1.8-1.5-2.8-.2 1.1-.8 1.8-1.7 2.5-.8.6-1.3 1.2-1.3 2.1 0 1.5 1 2.7 2 2.7z" />
        </>
      );
    case 'mobility':
      return (
        <>
          <Path d="M12 5v8" />
          <Path d="M8 9l4 4 4-4" />
          <Path d="M12 13l-5 7" />
          <Path d="M12 13l5 7" />
        </>
      );
    case 'prehab':
      return (
        <>
          <Path d="M12 3l7 3v5c0 4.5-3 7.8-7 10-4-2.2-7-5.5-7-10V6l7-3z" />
          <Path d="M12 8v6" />
          <Path d="M9 11h6" />
        </>
      );
    case 'core':
      return (
        <>
          <Path d="M12 4a8 8 0 100 16 8 8 0 000-16z" />
          <Path d="M12 9a3 3 0 100 6 3 3 0 000-6z" />
        </>
      );
    case 'activity':
      return (
        <>
          <Path d="M8 5h11" />
          <Path d="M8 12h11" />
          <Path d="M8 19h11" />
          <Path d="M4 5h.01" />
          <Path d="M4 12h.01" />
          <Path d="M4 19h.01" />
        </>
      );
    case 'strength':
    default:
      return (
        <>
          <Path d="M6.5 6.5l11 11" />
          <Path d="M3.5 8.5l5-5" />
          <Path d="M5.5 10.5l5-5" />
          <Path d="M13.5 18.5l5-5" />
          <Path d="M15.5 20.5l5-5" />
        </>
      );
  }
}

/**
 * A day's ONE leading identity, for any card-ish surface (the week row, the
 * away-days picker).
 *
 * THE RULE MOVED, THE BEHAVIOUR DID NOT (Task 6). It now lives in
 * `rules/visibleDayDetail.ts` beside the day-detail surface that reads it too:
 * a card title and a detail title that disagree about which name leads is one
 * defect at two sizes, and the only structural way two surfaces cannot disagree
 * is for both to call one function. This wrapper keeps the card's
 * `undefined`-tolerant shape (the week list can hold a date the projection has
 * no day for); the rule itself is stated once, over there.
 *
 * THE GAME GATE IS STILL LOAD-BEARING, and Task 6 checked rather than assumed.
 * Task 6 fixed the projection so a fixture's last-resort `session` placeholder
 * projects as a `game` part instead of a `strength` one, which removes the
 * ORIGINAL reason for the gate (a game card reading "Strength"). It does not
 * make the gate redundant, and that was TRACED rather than assumed: only the
 * PLACEHOLDER converts, so a fixture day whose workout carries real content
 * still leads with `parts[0]`. A `Practice Match` day (in
 * `FIXTURE_WORKOUT_TYPES`, and not one of the two hardcoded stubs) with a squat
 * on it projects `kind: 'game'` and `parts[0].kind: 'strength'` — its card would
 * read "Strength" without this line. A fixture's title is its fixture whatever
 * its workout resolved (reassessment §4, Task 5's ruling), so deleting the gate
 * would trade one traced regression for another.
 */
function cardLeadHeadline(day: VisibleDay | undefined): string | null {
  if (!day) return null;
  return visibleDayLeadHeadline(day);
}

/**
 * WHAT THIS DAY IS, AS THE EXPLORER READS IT — one owner for both shapes.
 *
 * The token is a canonical state leaf: the dev-e2e explorer resolves an athlete
 * action by finding `day-row-<day>-state-<token>` in the tree. It was computed
 * inline in `DayRow`, which was fine while a row was the only thing that could
 * report a day. The day-first view draws six of its days as strip chips and one
 * as a row, and both have to answer this question the same way — so the question
 * has a function, and there is exactly one place to get the answer wrong.
 */
function dayStateToken({
  day, isSelected, isMoveSource, isMoveTarget,
}: {
  day: any;
  isSelected: boolean;
  isMoveSource: boolean;
  isMoveTarget: boolean;
}): string {
  if (isMoveSource) return 'move-source';
  if (isMoveTarget) return 'move-target';
  if (day.workout?.workoutType === 'Game') return 'fixture';
  if (!day.workout) return 'rest';
  return isSelected ? 'selected' : 'scheduled';
}

interface DayStateLeavesProps {
  day: any;
  feedbackReceipts: string[];
  progressionReceipts: Array<{ transactionId: string; targetSessionId: string }>;
  stateToken: string;
}

/**
 * A DAY'S CANONICAL STATE LEAVES — zero-size witness nodes, no words, no doors.
 *
 * Every day the athlete has reports these whether or not the screen happens to
 * be drawing it at full size. They are what the dev-e2e explorer resolves
 * mutations against (`docs/` trace-v2 references), and they must survive a
 * change to the SHAPE of the screen — a view that drew fewer of them would make
 * the app look, to the explorer, as though days had stopped existing.
 */
function DayStateLeaves({
  day, feedbackReceipts, progressionReceipts, stateToken,
}: DayStateLeavesProps) {
  const dayToken = dayOfWeekTestIdToken(day.dayOfWeek);
  return (
    <>
      {day.workout ? (
        <ExplorerRenderWitness testID={explorerTestId.sessionCard(day.workout.id)} />
      ) : null}
      {day.workout?.workoutType === 'Game' ? (
        <>
          <ExplorerRenderWitness testID={explorerTestId.fixtureCard(day.workout.id)} />
          <ExplorerRenderWitness testID={explorerTestId.fixtureState(day.workout.id, 'active')} />
        </>
      ) : (
        <ExplorerRenderWitness
          testID={explorerTestId.fixtureState(`calendar-game-${day.date}`, 'absent')}
        />
      )}
      {feedbackReceipts.map((transactionId) => (
        <ExplorerRenderWitness
          key={transactionId}
          testID={explorerTestId.feedbackReceipt(transactionId)}
        />
      ))}
      {progressionReceipts.map(({ transactionId, targetSessionId }) => (
        <ExplorerRenderWitness
          key={`${transactionId}:${targetSessionId}`}
          testID={explorerTestId.feedbackProgressionTarget(transactionId, targetSessionId)}
        />
      ))}
      <View
        pointerEvents="none"
        style={{ width: 1, height: 1 }}
        testID={`day-row-${dayToken}-state-${stateToken}`}
      />
    </>
  );
}

/**
 * Day row — one of seven identical rows in the week list.
 *
 * The SELECTED row (default: today, via useHomeScreen) is the screen's
 * emphasis carrier: slightly bigger weekday + title type, roomier
 * padding, accent surface, and the expanded CTA block (Start Session /
 * change door). Tapping another day moves the emphasis there —
 * selection IS the hierarchy, so no separate hero card exists.
 */
function DayRow({
  day, visibleDay, isSelected, isMoveSource, isMoveTarget, pickerMode,
  hasWorkout, isGame, normal, onPress, onViewWorkout, onFinishTeam,
  onLogGame, onGameDayActions, onMakeChange, staleWarning,
  feedbackReceipts, progressionReceipts, timeline,
}: DayRowProps) {
  const emphasized = isSelected && normal;
  const showRowBadges = emphasized;
  const rowTone = emphasized ? 'accent' : 'default';
  // THE CARD'S ONE SOURCE OF WORDS — the projection, not the workout. See
  // `cardLeadHeadline` above for the title rule (parts[0] leads; day.headline
  // for rest and — deliberately, not merely "zero parts" — for every
  // fixture). `contextLabel` is whatever rides beside the leading identity:
  // for a fixture, nothing (a fixture's own part(s) are already spoken for by
  // `title`, and a game day has never shown a secondary line — matches
  // today's behaviour, where `splitSessionName("Game Day").context` is
  // already `null`); for a training day, parts beyond the first, the same
  // "+ " convention the old `splitSessionName` context carried. Every value
  // here is `SignedCopy`, so this can only ever render an authored string.
  const visibleParts = visibleDay?.parts ?? [];
  const isFixtureDay = visibleDay?.kind === 'game';
  const title: string | null = cardLeadHeadline(visibleDay);
  const accentColor = getDayRowAccentColor({
    hasWorkout,
    isGame,
    sessionTier: day.workout?.sessionTier,
    title,
  });
  const attachedParts = isFixtureDay ? [] : visibleParts.slice(1);
  const rawContext = attachedParts.length > 0
    ? `+ ${attachedParts.map((part) => part.headline).join(' + ')}`
    : null;
  const contextLabel = suppressDuplicateWorkoutContext(title, rawContext);
  const isAttachedContextLine = contextLabel?.startsWith('+ ') ?? false;
  const titleIcon = titleIconKind({ hasWorkout, isGame, title, workout: day.workout });
  const contextIcon = contextIconKind(contextLabel);
  const isTeamOnly = hasWorkout && isTeamTrainingOnlyWorkout(day.workout);
  const isRecoverySession = hasWorkout && (
    day.workout.workoutType === 'Recovery' ||
    day.workout.sessionTier === 'recovery'
  );
  // An illness_recovery week keeps its (reduced) sessions rather than clearing to
  // Rest, marking them sessionTier 'optional'. Such a session must read as OPTIONAL
  // — nothing required — not the prominent CORE "Start Session" treatment.
  const isOptionalSession = hasWorkout && day.workout.sessionTier === 'optional';
  // A persisted session-outcome receipt for this day means the athlete finished
  // and saved feedback — the day is complete. Drives the "Done" marker and the
  // read-only completed CTA (WORKOUT_2026-07-21 row 2.1 / GROUPB finding 1: the
  // saved outcome was persisted but never surfaced back to the card).
  const isCompleted = hasWorkout && feedbackReceipts.length > 0;
  const rowBadges = (
    <>
      {isCompleted && <Badge label="Done" tone="success" />}
      {showRowBadges && day.isToday && <Badge label="Today" tone="accent" />}
      {isMoveSource
        ? <Badge label="Moving" tone="outline" />
        : showRowBadges && hasWorkout && isGame
          ? <GameBadge />
          : showRowBadges && hasWorkout && day.workout.sessionTier
            ? <SessionTierBadge tier={day.workout.sessionTier} />
            : null}
    </>
  );
  // Always `title` now — no `hasWorkout` branch, no hardcoded "Rest"
  // literal. A rest day's `title` is already "Rest Day" (via `day.headline`,
  // the zero-parts fallback above); a training day's is its first part.
  const selectedTitle = title;
  const dayToken = dayOfWeekTestIdToken(day.dayOfWeek);
  const stateToken = dayStateToken({ day, isSelected, isMoveSource, isMoveTarget });
  const exposesExpandedActions = isSelected && normal;

  return (
    <Card
      tone={rowTone}
      selected={isSelected && normal}
      padding="none"
      radius="lg"
      onPress={onPress}
      testID={isMoveTarget
        ? explorerTestId.fixtureTarget(day.date)
        : `day-row-${dayToken}`}
      accessibilityLabel={`Day ${day.short ?? ''}${title ? ` ${title}` : ''}`}
      accessible={!exposesExpandedActions}
      style={[
        styles.dayRow,
        // Rest-of-week rows sit on a darker, borderless surface — a
        // structured timeline, not a grid of outlined buttons. The selected
        // and move tones retain their full card treatment for clarity.
        !isSelected && !isMoveSource && !isMoveTarget && styles.dayRowResting,
        isMoveSource && styles.dayRowMoveSource,
        isMoveTarget && styles.dayRowMoveTarget,
        day.isToday && !isSelected && normal && styles.dayRowToday,
        emphasized && selectedDayRowStyle(accentColor),
      ]}
    >
      <DayStateLeaves
        day={day}
        feedbackReceipts={feedbackReceipts}
        progressionReceipts={progressionReceipts}
        stateToken={stateToken}
      />
      <View
        pointerEvents="none"
        style={[
          styles.dayAccentStrip,
          emphasized && styles.dayAccentStripSelected,
          { backgroundColor: accentColor },
        ]}
      />
      <View style={[styles.dayRowInner, emphasized && styles.dayRowInnerSelected]}>
        {emphasized ? (
          <View style={styles.selectedHeader}>
            <View style={styles.selectedMetaRow}>
              <View style={styles.selectedDateCluster}>
                <Text
                  style={[
                    styles.dayLabel,
                    styles.dayLabelSelected,
                    { color: '#C8FF00' },
                  ]}
                >
                  {day.short}
                </Text>
                <Text style={[styles.dayDate, styles.dayDateSelected]}>
                  {shortDayMonthLabel(day.date)}
                </Text>
              </View>
              <View style={styles.selectedBadgeCluster}>{rowBadges}</View>
            </View>

            <View style={styles.selectedTitleBlock}>
              <View style={styles.selectedTitleLine}>
                <RowIcon kind={titleIcon} size={16} color={accentColor} />
                <Text
                  style={[
                    hasWorkout ? styles.workoutTitle : styles.restLabel,
                    hasWorkout ? styles.workoutTitleSelected : styles.restLabelSelected,
                    styles.selectedWorkoutTitle,
                    isMoveSource && { opacity: 0.4 },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {selectedTitle}
                </Text>
              </View>
              {hasWorkout && contextLabel ? (
                <View style={styles.selectedContextLine}>
                  {contextIcon && <RowIcon kind={contextIcon} size={16} color={accentColor} />}
                  <Text
                    style={[
                      styles.workoutContext,
                      isAttachedContextLine && styles.attachedWorkoutContext,
                      isAttachedContextLine && emphasized && styles.attachedWorkoutContextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {contextLabel}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.dayHeader}>
            <View style={styles.leftCluster}>
              <Text
                style={[
                  styles.dayLabel,
                  day.isToday || isMoveTarget ? { color: '#C8FF00' } : null,
                ]}
              >
                {day.short}
              </Text>
              {/* Actual calendar date — quiet, one step dimmer than the
                  weekday so "MON" stays the anchor and "3/7" is the detail. */}
              <Text style={styles.dayDate}>
                {shortDayMonthLabel(day.date)}
              </Text>
              {rowBadges}
            </View>

          {isMoveTarget ? (
            <Text style={styles.moveTargetLabel}>
              {pickerMode === 'addGame' ? 'Tap to set game' : 'Tap to move here'}
            </Text>
          ) : hasWorkout ? (
            <View style={styles.titleBlock}>
              <View style={styles.rowTitleLine}>
                <RowIcon kind={titleIcon} size={15} color={accentColor} />
                <Text
                  style={[
                    styles.workoutTitle,
                    isMoveSource && { opacity: 0.4 },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {title}
                </Text>
              </View>
              {contextLabel ? (
                <View style={styles.rowContextLine}>
                  {contextIcon && (
                    <RowIcon
                      kind={contextIcon}
                      size={isAttachedContextLine ? 15 : 14}
                      color={accentColor}
                    />
                  )}
                  <Text
                    style={[
                      styles.workoutContext,
                      isAttachedContextLine && styles.attachedWorkoutContext,
                    ]}
                    numberOfLines={1}
                  >
                    {contextLabel}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.restLine}>
              <RowIcon kind="recovery" size={15} color={accentColor} />
              <Text style={styles.restLabel}>
                {title}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Expanded selected content */}
      {isSelected && hasWorkout && !isGame && normal && (
        <View style={styles.expanded}>
          {staleWarning && (
            <StaleOverrideBanner
              warning={staleWarning}
            />
          )}
          {timeline}
          {isCompleted ? (
            <>
              <View style={styles.sessionCompleteLine} testID={`day-complete-${dayToken}`}>
                <RowIcon kind="pulse" size={15} color="#5BD98A" />
                <Text style={styles.sessionCompleteText}>Session complete</Text>
              </View>
              <Button label="View summary" size="lg" glow={false} onPress={onViewWorkout} testID="view-completed-session-button" />
            </>
          ) : isTeamOnly ? (
            <Button label="Log Session" size="lg" glow={false} onPress={onFinishTeam} />
          ) : isOptionalSession ? (
            <>
              <Text style={styles.expandedMeta}>Optional this week — only if you're up to it. Nothing's required.</Text>
              <Button label="Start optional session" variant="secondary" size="lg" glow={false} onPress={onViewWorkout} testID="view-workout-button" />
            </>
          ) : (
            <>
              {isRecoverySession ? (
                <Text style={styles.expandedMeta}>Move easy. Feel better.</Text>
              ) : null}
              <Button label="Start Session" size="lg" glow={false} onPress={onViewWorkout} testID="view-workout-button" />
            </>
          )}
          <Pressable
            onPress={onMakeChange}
            style={({ pressed }) => [styles.makeChangeLink, pressed && { opacity: 0.7 }]}
            testID="make-change-link"
          >
            <Text style={styles.makeChangeText}>Want to change something?</Text>
          </Pressable>
        </View>
      )}

      {!isSelected && staleWarning && normal && (
        <StaleOverrideBanner warning={staleWarning} compact />
      )}

      {isSelected && isGame && normal && (
        <View style={styles.expanded}>
          <Text style={styles.expandedMeta}>Good luck!</Text>
          <Button
            label="Log Game"
            size="lg"
            glow={false}
            onPress={onLogGame}
            testID={explorerTestId.fixtureLog(day.workout.id)}
          />
          <Pressable
            onPress={onGameDayActions}
            style={({ pressed }) => [styles.makeChangeLink, pressed && { opacity: 0.7 }]}
            testID={explorerTestId.fixtureIngress('move', day.workout.id)}
            accessibilityRole="button"
            accessibilityLabel={explorerTestId.fixtureIngress('move', day.workout.id)}
          >
            <Text style={styles.makeChangeText}>Move or remove game day</Text>
          </Pressable>
        </View>
      )}
      {isSelected && !hasWorkout && normal && (
        <View style={styles.expanded}>
          <Text style={styles.expandedMeta}>Freshen up. Adapt. Go again.</Text>
          <Pressable
            onPress={onMakeChange}
            style={({ pressed }) => [styles.makeChangeLink, pressed && { opacity: 0.7 }]}
            testID="add-session-link"
          >
            <Text style={styles.makeChangeText}>Add optional session?</Text>
          </Pressable>
        </View>
      )}
      </View>
    </Card>
  );
}

interface WeekStripProps {
  weekDays: any[];
  visibleWeek: VisibleWeek;
  activeDate: string | null;
  onSelect: (idx: number) => void;
}

/**
 * THE WEEK STRIP — seven days across the top, the game anchoring them.
 *
 * Sam's direction, 2026-08-01: "days and dates of the week as a strip at the
 * top ... the week strip stays visible in the today view — the game-day anchor
 * is how a footballer orients their week."
 *
 * WHAT KIND OF DAY EACH ONE IS COMES FROM THE PROJECTION AND NOWHERE ELSE.
 * `VisibleDay.kind` is already derived from the typed `FIXTURE_WORKOUT_TYPES`
 * set, so the anchor needs no derivation of its own and cannot disagree with the
 * row below it about which day is the game. A strip that sniffed a title for the
 * word "Game" would be a second answer to a question the projection settled.
 *
 * NO WORDS BUT THE CALENDAR'S. The chips carry a weekday token, a date number
 * and a coloured mark — no session names, no prose, nothing that could be
 * unsigned copy. The day's name is the row's job, and the row says it once.
 */
function WeekStrip({ weekDays, visibleWeek, activeDate, onSelect }: WeekStripProps) {
  return (
    <View style={styles.weekStrip} testID="week-strip">
      {weekDays.map((day, idx) => {
        const visibleDay = visibleWeek.days.find((candidate) => candidate.date === day.date);
        const kind = visibleDay?.kind ?? 'rest';
        const isActive = day.date === activeDate;
        const markColor = kind === 'game'
          ? '#FFC247'
          : kind === 'training'
            ? '#C8FF00'
            : '#5E6268';
        return (
          <Pressable
            key={day.date}
            onPress={() => onSelect(idx)}
            testID={`week-strip-${dayOfWeekTestIdToken(day.dayOfWeek)}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${day.short ?? ''} ${shortDayMonthLabel(day.date)}`}
            style={({ pressed }) => [
              styles.weekStripChip,
              isActive && styles.weekStripChipActive,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text
              style={[
                styles.weekStripDay,
                day.isToday && styles.weekStripDayToday,
                isActive && styles.weekStripDayActive,
              ]}
            >
              {day.short}
            </Text>
            <Text style={[styles.weekStripDate, isActive && styles.weekStripDateActive]}>
              {dayOfMonthLabel(day.date)}
            </Text>
            {kind === 'game' ? (
              <RowIcon kind="game" size={11} color={markColor} />
            ) : (
              <View style={[styles.weekStripMark, { backgroundColor: markColor }]} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The icon for a part, by its TYPED kind.
 *
 * Deliberately not `titleIconKind`, which reads a display LABEL and matches it
 * against a table of names. That table exists because the week card's title is a
 * string by the time it reaches the icon; a timeline row holds the part itself,
 * so it asks the structural question directly and cannot be wrong about a
 * session whose name the table has not heard of. Exhaustive by type: a new
 * `VisiblePartKind` stops this compiling rather than quietly drawing a default.
 *
 * Existing assets only (rulings 6 and 10: every row carries a meaningful icon;
 * icons are imagery, not copy, and need no signing). Flagged for Sam's icon-pick
 * session — nonsense pairings are his call at the device pass.
 */
const PART_ICON_KIND: Readonly<Record<VisiblePartKind, RowIconKind>> = {
  strength: 'strength',
  power: 'bolt',
  speed: 'bolt',
  conditioning: 'flame',
  support: 'core',
  recovery: 'recovery',
  team_training: 'team',
  game: 'game',
};

/**
 * WHAT A SAVED OUTCOME LOOKS LIKE ON A TIMELINE ROW.
 *
 * `null` — nothing saved — draws a hollow ring, not a cross: "not answered yet"
 * and "skipped" are different facts and the athlete said one of them.
 */
const TIMELINE_COMPLETION_COLOR: Readonly<Record<string, string>> = {
  full: '#5BD98A',
  partial: '#FFC247',
  skipped: '#5E6268',
};

interface DayTimelineProps {
  entries: readonly DayTimelineEntry[];
  onOpen: () => void;
}

/**
 * THE DAY'S COMPONENT TIMELINE — the day-first view's centrepiece.
 *
 * Sam's direction: "the day's session as a tappable component timeline —
 * Mobility flow warm-up → tap to open · Strength/Power component → tap to open ·
 * Conditioning or Team Training → tap to open."
 *
 * COMPLETION IS SHOWN, NOT WRITTEN (Sam's fork A ruling, 2026-08-07). Each row
 * reflects what a SAVED session outcome recorded for that component; tapping a
 * row opens the same day-detail door the CTA under it opens, and the existing
 * feedback panel remains the only place a completion is ever authored. There is
 * no per-component write door in this app, and this surface does not invent one.
 *
 * NO CLOCK TIMES — Sam's direction, and satisfied by construction: the
 * projection carries no time of day for this to render even if it wanted to.
 *
 * KEYED ON `partId`, NEVER ON KIND. `COMPONENT_TO_PART` is many-to-one, so a day
 * with a conditioning component AND a finisher yields two entries of kind
 * `conditioning`. A list keyed by kind would silently drop one of them — work
 * the athlete has to do, missing from the only screen that shows it.
 */
function DayTimeline({ entries, onOpen }: DayTimelineProps) {
  if (entries.length === 0) return null;
  return (
    <View style={styles.timeline} testID="day-timeline">
      {entries.map((entry, index) => {
        const iconKind = PART_ICON_KIND[entry.kind];
        const completionColor = entry.completion
          ? TIMELINE_COMPLETION_COLOR[entry.completion]
          : null;
        return (
          <Pressable
            key={entry.partId}
            onPress={onOpen}
            testID={`day-timeline-part-${entry.componentId}`}
            accessibilityRole="button"
            accessibilityLabel={`${entry.headline}${
              entry.completion ? ` — ${entry.completion}` : ''}`}
            style={({ pressed }) => [styles.timelineRow, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.timelineRail}>
              <View
                style={[
                  styles.timelineNode,
                  completionColor
                    ? { backgroundColor: completionColor, borderColor: completionColor }
                    : null,
                ]}
              />
              {index < entries.length - 1 ? <View style={styles.timelineConnector} /> : null}
            </View>
            <RowIcon kind={iconKind} size={15} color={rowIconColor(iconKind)} />
            <Text style={styles.timelineHeadline} numberOfLines={1} ellipsizeMode="tail">
              {entry.headline}
            </Text>
            {entry.completion ? (
              <ExplorerRenderWitness
                testID={`day-timeline-complete-${entry.componentId}-${entry.completion}`}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

interface CoachNotesSectionProps {
  notes: ActiveCoachNote[];
  equipmentFactIds: ReadonlySet<string>;
  onAction: (note: ActiveCoachNote, action: ActiveCoachNoteAction) => void;
}

function CoachNotesSection({ notes, equipmentFactIds, onAction }: CoachNotesSectionProps) {
  if (notes.length === 0) return null;

  return (
    <View style={styles.coachNotesSection} testID="program-active-coach-notes">
      <Text style={styles.coachNotesTitle}>COACH NOTES</Text>
      <View style={styles.coachNotesStack}>
        {notes.map((note) => (
          <Card
            key={note.id}
            tone="outline"
            padding="none"
            radius="lg"
            style={styles.coachNoteCard}
            testID={note.injuryEpisodeId
              ? explorerTestId.injuryActive(note.injuryEpisodeId)
              : note.reversibleAdjustmentId
                ? explorerTestId.adjustmentActive(note.reversibleAdjustmentId)
                : `program-active-coach-note-${note.constraintId}`}
          >
            <View style={styles.coachNoteContent}>
              <View style={styles.coachNoteHeader}>
                <View style={styles.coachNoteDot} />
                <Text style={styles.coachNoteTitle} numberOfLines={2}>
                  {note.title}
                </Text>
              </View>
              <Text style={styles.coachNoteBody}>{note.body}</Text>
              <View style={styles.coachNoteActions}>
                {note.actions.map((action, index) => {
                  const primary = index === 0;
                  const sourceFactId = note.temporarySourceFactIds?.[0];
                  const isEquipmentFact = sourceFactId
                    ? equipmentFactIds.has(sourceFactId)
                    : false;
                  const actionTestID = action.kind === 'update_injury' && note.injuryEpisodeId
                    ? explorerTestId.injuryIngress('update', note.injuryEpisodeId)
                    : action.kind === 'clear_injury' && note.injuryEpisodeId
                      ? explorerTestId.injuryResolveAction(note.injuryEpisodeId)
                      : action.kind === 'restore_adjustment' && note.reversibleAdjustmentId
                        ? explorerTestId.adjustmentRestore(note.reversibleAdjustmentId)
                        : action.kind === 'update_status' && sourceFactId
                          ? explorerTestId.readinessUpdate(sourceFactId)
                          : action.kind === 'clear_adjustment' && sourceFactId && isEquipmentFact
                            ? explorerTestId.equipmentClear(sourceFactId)
                            : action.kind === 'update_adjustment' && sourceFactId && isEquipmentFact
                              ? explorerTestId.equipmentUpdate(sourceFactId)
                          : `program-active-coach-note-action-${note.constraintId}-${action.kind}`;
                  return (
                    <Pressable
                      key={action.kind}
                      onPress={() => onAction(note, action)}
                      style={({ pressed }) => [
                        styles.coachNoteAction,
                        primary && styles.coachNotePrimaryAction,
                        pressed && { opacity: 0.72 },
                      ]}
                      testID={actionTestID}
                      accessibilityRole="button"
                      accessibilityLabel={actionTestID}
                    >
                      <Text
                        style={[
                          styles.coachNoteActionText,
                          primary && styles.coachNotePrimaryActionText,
                        ]}
                        numberOfLines={1}
                      >
                        {action.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

function clearCopyForNote(note: ActiveCoachNote): { title: string; body: string } {
  if (note.reversibleAdjustmentId) {
    return {
      title: 'Restore the previous fixture?',
      body: 'This puts the moved sessions back and sorts the week around your game.',
    };
  }
  if (note.type === 'injury') {
    const clearLabel = note.actions.find((action) => action.kind === 'clear_injury')?.label ?? '';
    if (/cleared/i.test(clearLabel) || /training paused/i.test(note.title)) {
      return {
        title: 'Resume normal training?',
        body: "Only clear this if you've been checked or the issue has settled enough to train normally.",
      };
    }
    return {
      title: 'Clear this injury?',
      body: "We'll stop adjusting your program around this and update your week.",
    };
  }
  if (note.type === 'temporary_status') {
    return {
      title: 'Clear this adjustment?',
      body: "We'll stop adjusting your program around this and update your week.",
    };
  }
  return {
    title: 'Clear this adjustment?',
    body: "We'll stop factoring this in and get your week back to normal.",
  };
}

function updateCopyForNote(note: ActiveCoachNote): { title: string; body: string } {
  if (note.type === 'injury') {
    return {
      title: note.actions.find((a) => a.kind === 'update_injury')?.label ?? 'Update injury',
      body: 'Keep this note active if the issue still affects training. Clear it only when it has settled.',
    };
  }
  if (note.type === 'temporary_status') {
    return {
      title: 'How are you feeling now?',
      body: 'Choose the closest option and your program will update from there.',
    };
  }
  return {
    title: 'Update adjustment',
    body: 'Keep this adjustment active for future sessions, or clear it if it no longer applies.',
  };
}

interface CoachNoteSheetProps {
  state: { mode: 'clear' | 'update'; note: ActiveCoachNote } | null;
  equipmentFactIds: ReadonlySet<string>;
  onClose: () => void;
  onConfirmClear: () => void;
  onUpdateStatus: (status: ProgramControlStatusUpdate) => void;
}

function CoachNoteSheet({
  state,
  equipmentFactIds,
  onClose,
  onConfirmClear,
  onUpdateStatus,
}: CoachNoteSheetProps) {
  if (!state) return null;

  const copy = state.mode === 'clear'
    ? clearCopyForNote(state.note)
    : updateCopyForNote(state.note);
  const clearAction = state.note.actions.find((action) => action.kind.startsWith('clear'));
  const isStatusUpdate = state.mode === 'update' && state.note.type === 'temporary_status';
  const injuryEpisodeId = state.note.injuryEpisodeId;
  const reversibleAdjustmentId = state.note.reversibleAdjustmentId;
  const sourceFactId = state.note.temporarySourceFactIds?.[0] ?? state.note.constraintId;
  const isEquipmentFact = equipmentFactIds.has(sourceFactId);

  return (
    <Sheet
      visible={Boolean(state)}
      onClose={onClose}
      testID={injuryEpisodeId
        ? explorerTestId.injuryDetail(injuryEpisodeId)
        : reversibleAdjustmentId
          ? explorerTestId.adjustmentRestore(reversibleAdjustmentId)
          : `coach-note-detail-${sourceFactId}`}
    >
      <Text style={styles.sheetTitle}>{copy.title}</Text>
      <Text style={styles.sheetBody}>{copy.body}</Text>
      {state.mode === 'clear' ? (
        <>
          <Button
            label={state.note.reversibleAdjustmentId
              ? 'Restore fixture'
              : 'Clear and update program'}
            size="lg"
            onPress={onConfirmClear}
            testID={reversibleAdjustmentId
              ? explorerTestId.adjustmentRestore(reversibleAdjustmentId)
              : injuryEpisodeId
                ? explorerTestId.injuryResolveAction(injuryEpisodeId)
                : isEquipmentFact
                  ? explorerTestId.equipmentClear(sourceFactId)
                  : explorerTestId.readinessClearAction(sourceFactId)}
          />
          <Button
            label="Cancel"
            variant="secondary"
            size="md"
            onPress={onClose}
            style={{ marginTop: spacing.md }}
          />
        </>
      ) : isStatusUpdate ? (
        <>
          <Button
            label="I'm good now"
            size="lg"
            onPress={() => onUpdateStatus('good_now')}
            testID={explorerTestId.readinessClearAction(sourceFactId)}
          />
          <Button
            label="Still not right"
            variant="secondary"
            size="md"
            onPress={() => onUpdateStatus('still_not_right')}
            testID={explorerTestId.readinessOption('still_not_right')}
            style={{ marginTop: spacing.sm }}
          />
          <Button
            label="Still sick"
            variant="secondary"
            size="md"
            onPress={() => onUpdateStatus('still_sick')}
            testID={explorerTestId.readinessOption('still_sick')}
            style={{ marginTop: spacing.sm }}
          />
          <Button
            label="Still cooked"
            variant="secondary"
            size="md"
            onPress={() => onUpdateStatus('still_cooked')}
            testID={explorerTestId.readinessOption('still_cooked')}
            style={{ marginTop: spacing.sm }}
          />
          <Button
            label="Worse"
            variant="secondary"
            size="md"
            onPress={() => onUpdateStatus('worse')}
            testID={explorerTestId.readinessOption('worse')}
            style={{ marginTop: spacing.sm }}
          />
          <Button
            label="Cancel"
            variant="secondary"
            size="md"
            onPress={onClose}
            style={{ marginTop: spacing.md }}
          />
        </>
      ) : (
        <>
          <Button
            label="Keep active"
            size="lg"
            onPress={onClose}
          />
          <Button
            label={clearAction?.label ?? 'Clear adjustment'}
            variant="secondary"
            size="md"
            onPress={onConfirmClear}
            testID={injuryEpisodeId
              ? explorerTestId.injuryResolveAction(injuryEpisodeId)
              : isEquipmentFact
                ? explorerTestId.equipmentClear(sourceFactId)
                : explorerTestId.readinessClearAction(sourceFactId)}
            style={{ marginTop: spacing.md }}
          />
        </>
      )}
    </Sheet>
  );
}

interface GameDaySheetProps {
  visible: boolean;
  onClose: () => void;
  label: string;
  fixtureId: string;
  onMove: () => void;
  onRemove: () => void;
}
function GameDaySheet({
  visible,
  onClose,
  label,
  fixtureId,
  onMove,
  onRemove,
}: GameDaySheetProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      testID={explorerTestId.fixtureActions(fixtureId)}
    >
      <Text style={styles.sheetTitle}>{label}</Text>
      <View style={styles.sheetCurrentBadge}>
        <View style={styles.sheetCurrentDot} />
        <Text style={styles.sheetCurrentText}>Game day</Text>
      </View>

      <SheetOption
        label="Move Game Day This Week"
        testID={explorerTestId.fixtureIngress('move', fixtureId)}
        accent
        icon={<Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M5 12h14"/><Path d="M12 5l7 7-7 7"/></Svg>}
        onPress={onMove}
      />
      <SheetOption
        label="Remove Game Day"
        testID={explorerTestId.fixtureIngress('remove', fixtureId)}
        danger
        icon={<Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M18 6L6 18"/><Path d="M6 6l12 12"/></Svg>}
        onPress={onRemove}
      />

      <Button label="Cancel" variant="secondary" size="md" onPress={onClose} style={{ marginTop: spacing.md }} />
    </Sheet>
  );
}

interface SheetOptionProps {
  label: string;
  icon: React.ReactNode;
  sub?: string;
  accent?: boolean;
  danger?: boolean;
  onPress: () => void;
  testID?: string;
}
function SheetOption({ label, icon, sub, accent, danger, onPress, testID }: SheetOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={testID}
      style={({ pressed }) => [styles.sheetOption, pressed && { opacity: 0.7 }]}
    >
      <View style={[
        styles.sheetOptionIcon,
        accent && { backgroundColor: 'rgba(200, 255, 0, 0.12)' },
        danger && { backgroundColor: 'rgba(244, 67, 54, 0.12)' },
      ]}>
        {icon}
      </View>
      {sub ? (
        <View style={{ flex: 1 }}>
          <Text style={[styles.sheetOptionText, danger && { color: '#F44336' }]}>{label}</Text>
          <Text style={styles.sheetOptionSub}>{sub}</Text>
        </View>
      ) : (
        <Text style={[styles.sheetOptionText, danger && { color: '#F44336' }]}>{label}</Text>
      )}
    </Pressable>
  );
}

// ── Missed-session follow-up card ──
interface MissedSessionPromptProps {
  missed: MissedSession;
  onRespond: (response: MissedSessionResponse) => void;
}
function MissedSessionPrompt({ missed, onRespond }: MissedSessionPromptProps) {
  const sessionLabel = missed.sessionName ? ` (${missed.sessionName})` : '';
  return (
    <Card
      tone="outline"
      padding="md"
      radius="lg"
      style={styles.missedCard}
      testID="home-missed-session-prompt"
    >
      <Text style={styles.missedTitle}>Did you do {missed.weekdayLabel}?</Text>
      <Text style={styles.missedBody}>
        {missed.weekdayLabel}&apos;s session{sessionLabel} wasn&apos;t logged. Let the coach
        know so your plan stays accurate.
      </Text>
      <View style={styles.missedActions}>
        <MissedChip label="Did it" primary onPress={() => onRespond('did_it')} />
        <MissedChip label="Missed it" onPress={() => onRespond('missed_it')} />
        <MissedChip label="Move it forward" onPress={() => onRespond('move_forward')} />
        <MissedChip label="Skip it" onPress={() => onRespond('skip_it')} />
      </View>
    </Card>
  );
}

function MissedChip({ label, primary, onPress }: {
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.missedChip,
        primary && styles.missedChipPrimary,
        pressed && { opacity: 0.72 },
      ]}
    >
      <Text style={[styles.missedChipText, primary && styles.missedChipPrimaryText]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Weekly "I'm sick/flat today" sheet ──
interface WeekReadinessSheetProps {
  visible: boolean;
  active: { id: string; isRecovery: boolean; title: string; scope: 'today' | 'week' } | null;
  acknowledgment: ReadinessAcknowledgment | null;
  lighterDayOffer: { date: string; factId?: string } | null;
  lighterDayBusy: boolean;
  onClose: () => void;
  onApply: (kind: WeekReadinessAction) => void | Promise<void>;
  onAcceptLighterDay: (date: string) => void | Promise<void>;
  onDeclineLighterDay: () => void;
  onClear: (modifierId: string) => void | Promise<void>;
  onInjury: () => void;
}

/**
 * Weekly readiness sheet — simple tap options, no chat. Reuses today's
 * readiness signal and the existing viewed-week fatigue modifiers.
 */
function WeekReadinessSheet({
  visible,
  active,
  acknowledgment,
  lighterDayOffer,
  lighterDayBusy,
  onClose,
  onApply: onApplyProp,
  onAcceptLighterDay,
  onDeclineLighterDay,
  onClear,
  onInjury,
}: WeekReadinessSheetProps) {
  const [updating, setUpdating] = useState(false);
  // A2: whether the athlete JUST reported something in this visit, as opposed to
  // arriving with something already active. Without it, `active` carried both
  // meanings and the manage view ("Update" / "Clear adjustment") was the
  // fallthrough for any non-null `active` — so confirming "Properly sick"
  // immediately offered to clear it. Sam's ruling: right after confirming, show
  // the disclosure and a way out, nothing else.
  const [confirmed, setConfirmed] = useState(false);
  // Russian-doll navigation for the option list: three top-level buckets, each
  // expanding to its leaves. 'sleep' is a leaf of 'flat'. Reset to the top
  // whenever the list re-shows.
  const [bucket, setBucket] = useState<'top' | 'flat' | 'sleep' | 'sick'>('top');

  React.useEffect(() => {
    if (visible) { setUpdating(false); setConfirmed(false); setBucket('top'); }
  }, [visible]);
  React.useEffect(() => {
    if (updating) setBucket('top');
  }, [updating]);

  // A failed report must NOT read as confirmation — the error acknowledgment
  // stays in place over the options so the athlete can try again.
  const justConfirmed = confirmed && acknowledgment?.tone === 'success' && !lighterDayOffer;
  // While the opt-in lighter-day offer or the just-confirmed disclosure is
  // showing, don't re-show the option list.
  const showOptions = (!active || updating) && !lighterDayOffer && !justConfirmed;

  const pulseIcon = (color: string) => (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 12h-4l-3 8-6-16-3 8H2" />
    </Svg>
  );
  // Distinct glyphs per bucket/leaf (X2 icon cleanup — one recognisable shape
  // each, not the old repeated pulse waveform).
  const svg = (color: string, children: React.ReactNode) => (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
  const flatIcon = (color: string) => svg(color, <><Path d="M3 8h13v8H3z" /><Path d="M19 11v2" /><Path d="M6 11v2" /></>);
  const sickIcon = (color: string) => svg(color, <Path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0z" />);
  const hurtIcon = (color: string) => svg(color, <><Path d="M12 9v4" /><Path d="M12 17h.01" /><Path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></>);
  const moonIcon = (color: string) => svg(color, <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />);
  const dropletIcon = (color: string) => svg(color, <Path d="M12 2.69 6.34 8.35a8 8 0 1 0 11.31 0z" />);
  // Ruling 10's named fix: "Rough sleep" used to carry a bare '>' chevron —
  // an icon that means nothing for a sleep row. A moon VARIANT of the tired
  // leaves' plain crescent (moonIcon), with a small cloud over it — restless,
  // overcast sleep — so it reads as sleep-family without duplicating the
  // leaf icons underneath it.
  const moonRestIcon = (color: string) => svg(color, (
    <><Path d="M17 14.5a5.5 5.5 0 1 0-9.9-3.3" />
      <Path d="M4 17.5a3.5 3.5 0 0 1 .5-6.96A5 5 0 0 1 14 12.5" />
      <Path d="M4 17.5h13a3 3 0 0 0 0-6" /></>
  ));
  // Ruling 10's named fix: "Totally cooked" used to carry a zap bolt — zap
  // reads as ENERGY, the opposite of cooked/drained. A snuffed flame reads as
  // "no more fuel", which is what the row means.
  const flameOutIcon = (color: string) => svg(color, (
    <><Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      <Path d="M2 2l20 20" /></>
  ));
  // Sick-severity ladder (audit finding: two rows shared one droplet glyph
  // differing only by colour). droplet (a bit off) / thermometer (properly
  // sick — a fever) / bed (can't get out of bed) — each glyph is the closest
  // literal reading of its own row, ascending in how much it takes you out.
  const bedIcon = (color: string) => svg(color, (
    <><Path d="M2 18v-7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v7" />
      <Path d="M2 18v2" /><Path d="M22 18v2" />
      <Path d="M2 13h20" />
      <Path d="M6 13V9.5a1.5 1.5 0 0 1 1.5-1.5H10a1.5 1.5 0 0 1 1.5 1.5V13" /></>
  ));
  // Lighter-day offer accept/decline — reuses the checkmark/x-cross pair
  // already established for "Clear adjustment" (accept) and the fixture
  // sheet's "Remove" (decline is a no), rather than one waveform icon
  // recoloured twice for opposite answers.
  const checkIcon = (color: string) => svg(color, <Path d="M20 6L9 17l-5-5" />);
  const crossIcon = (color: string) => svg(color, <><Path d="M18 6L6 18" /><Path d="M6 6l12 12" /></>);

  // A2: "the athlete reported something in THIS visit" is a fact the sheet owns,
  // so it is recorded at the one boundary every tier already goes through rather
  // than at eight call sites. Whether the report SUCCEEDED is still the
  // acknowledgment's to say — see `justConfirmed`.
  const onApply = (kind: WeekReadinessAction) => {
    void Promise.resolve(onApplyProp(kind)).then(() => setConfirmed(true));
  };

  return (
    <Sheet visible={visible} onClose={onClose} testID="home-week-readiness-sheet">
      {acknowledgment && !justConfirmed && (
        <View
          testID={acknowledgment.tone === 'success'
            ? 'home-week-readiness-ack-success'
            : 'home-week-readiness-ack-error'}
          style={[styles.readinessAck, acknowledgment.tone === 'error' && styles.readinessAckError]}
        >
          <Text style={styles.readinessAckText}>{acknowledgment.message}</Text>
        </View>
      )}
      {lighterDayOffer && (
        <View testID="home-week-readiness-lighter-offer">
          <Text style={styles.sheetTitle}>Make today lighter?</Text>
          <Text style={styles.busyAwayEmpty}>
            I'll keep your main lift but trim the volume, drop any finisher, and ease hard conditioning.
            Nothing permanent — you can undo it anytime.
          </Text>
          <SheetOption
            label="Yes — make today lighter"
            testID="readiness-lighter-accept"
            accent
            icon={checkIcon('#C8FF00')}
            onPress={() => { if (!lighterDayBusy) onAcceptLighterDay(lighterDayOffer.date); }}
          />
          <SheetOption
            label="No thanks — keep it as planned"
            testID="readiness-lighter-decline"
            icon={crossIcon('#8A94A6')}
            onPress={onDeclineLighterDay}
          />
          <Button label="Done" variant="secondary" size="md" onPress={onClose} style={{ marginTop: spacing.md }} />
        </View>
      )}
      {justConfirmed && acknowledgment && (
        <View testID="home-week-readiness-confirmed">
          <Text style={styles.sheetTitle}>{active?.title ?? "Got it"}</Text>
          {/* The authored disclosure the commit returned — not a second string
              written here. For a severe illness that is "Rest up — nothing's
              required this week…". */}
          <Text style={styles.busyAwayEmpty}>{acknowledgment.message}</Text>
          <Button
            label="Done"
            variant="secondary"
            size="md"
            onPress={onClose}
            testID="home-week-readiness-confirmed-done"
            style={{ marginTop: spacing.md }}
          />
        </View>
      )}

      {!showOptions && !lighterDayOffer && !justConfirmed && active && (
        <View>
          <Text style={styles.sheetTitle}>{active.title}</Text>
          <Text style={styles.busyAwayEmpty}>
            {active.scope === 'today' ? 'Today is' : 'This week is'} adjusted around how you said you're feeling. Clear
            the adjustment when you're good again.
          </Text>
          <SheetOption
            label="Update — how I'm feeling changed"
            testID={explorerTestId.readinessUpdate(active.id)}
            icon={pulseIcon('#FF7A85')}
            onPress={() => { setUpdating(true); setConfirmed(false); }}
          />
          <SheetOption
            label="Clear adjustment — I'm good now"
            testID={explorerTestId.readinessClearAction(active.id)}
            accent
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M20 6L9 17l-5-5" />
              </Svg>
            }
            onPress={() => onClear(active.id)}
          />
          <Button label="Cancel" variant="secondary" size="md" onPress={onClose} style={{ marginTop: spacing.md }} />
        </View>
      )}

      {showOptions && bucket === 'top' && (
        <View>
          <Text style={styles.sheetTitle}>Not 100%? What's going on?</Text>
          <SheetOption
            label="Feeling flat"
            sub="Tired, poor sleep, sore or cooked"
            testID="readiness-bucket-flat"
            icon={flatIcon('#FFC247')}
            onPress={() => setBucket('flat')}
          />
          <SheetOption
            label="Sick"
            sub="A bit off, properly sick, or can't get out of bed"
            testID="readiness-bucket-sick"
            icon={sickIcon('#1EA7FF')}
            onPress={() => setBucket('sick')}
          />
          <SheetOption
            label="Something hurts"
            sub="A niggle or an injury"
            testID={explorerTestId.injuryIngress('set')}
            icon={hurtIcon('#FF7A85')}
            onPress={onInjury}
          />
          <Button label="Cancel" variant="secondary" size="md" onPress={onClose} style={{ marginTop: spacing.md }} />
        </View>
      )}

      {showOptions && bucket === 'flat' && (
        <View>
          <Text style={styles.sheetTitle}>Feeling flat — what's closest?</Text>
          <SheetOption
            label="Bit tired today"
            testID={explorerTestId.readinessOption('tired_today')}
            icon={moonIcon('#FFC247')}
            onPress={() => onApply('tired_today')}
          />
          <SheetOption
            label="Rough sleep"
            sub="One bad night, or a few in a row"
            testID="readiness-leaf-sleep"
            icon={moonRestIcon('#8A94A6')}
            onPress={() => setBucket('sleep')}
          />
          <SheetOption
            label="Sore or tight"
            testID={explorerTestId.readinessOption('sore_today')}
            icon={pulseIcon('#FF7A85')}
            onPress={() => onApply('sore_today')}
          />
          <SheetOption
            label="Totally cooked — easier week"
            testID={explorerTestId.readinessOption('cooked_week')}
            accent
            icon={flameOutIcon('#C8FF00')}
            onPress={() => onApply('cooked_week')}
          />
          <Button label="Back" variant="secondary" size="md" onPress={() => setBucket('top')} style={{ marginTop: spacing.md }} />
        </View>
      )}

      {showOptions && bucket === 'sleep' && (
        <View>
          <Text style={styles.sheetTitle}>Rough sleep — how long?</Text>
          <SheetOption
            label="Just last night"
            testID={explorerTestId.readinessOption('poor_sleep_today')}
            icon={moonIcon('#FFC247')}
            onPress={() => onApply('poor_sleep_today')}
          />
          <SheetOption
            label="A few nights running"
            testID={explorerTestId.readinessOption('poor_sleep_week')}
            icon={moonIcon('#FF7A85')}
            onPress={() => onApply('poor_sleep_week')}
          />
          <Button label="Back" variant="secondary" size="md" onPress={() => setBucket('flat')} style={{ marginTop: spacing.md }} />
        </View>
      )}

      {showOptions && bucket === 'sick' && (
        <View>
          <Text style={styles.sheetTitle}>Sick — how bad?</Text>
          <SheetOption
            label="A bit off"
            sub="Log it — I'll offer to soften today if you want"
            testID={explorerTestId.readinessOption('illness_mild')}
            icon={dropletIcon('#1EA7FF')}
            onPress={() => onApply('illness_mild')}
          />
          <SheetOption
            label="Properly sick"
            sub="I'll lighten the work while you're crook — your sessions stay put"
            testID={explorerTestId.readinessOption('illness_moderate')}
            icon={sickIcon('#FFC247')}
            onPress={() => onApply('illness_moderate')}
          />
          <SheetOption
            label="Can't get out of bed"
            sub="Nothing will be required this week — gentle optional work if you're up to it"
            testID={explorerTestId.readinessOption('illness_severe')}
            icon={bedIcon('#FF7A85')}
            onPress={() => onApply('illness_severe')}
          />
          <Button label="Back" variant="secondary" size="md" onPress={() => setBucket('top')} style={{ marginTop: spacing.md }} />
        </View>
      )}
    </Sheet>
  );
}

/**
 * THE MENU STEP IS GONE, because there is no longer a question to ask.
 *
 * Sam's ruling 2 (2026-07-31) split "Busy or away this week?" into two buttons
 * on the week screen. "Short on time today" commits on the tap — as the busy row
 * inside this sheet already did, one step further in — so the only thing left
 * behind a sheet is the one question that genuinely has an answer: WHICH days.
 * A menu whose every entry is already a button on the screen behind it is a step
 * that exists to be dismissed.
 */
interface AwayDaysSheetProps {
  visible: boolean;
  weekDays: any[];
  visibleWeek: VisibleWeek;
  acknowledgment: ReadinessAcknowledgment | null;
  onClose: () => void;
  onAwayDays: (dates: string[]) => void | Promise<void>;
}
function AwayDaysSheet({
  visible, weekDays, visibleWeek, acknowledgment, onClose, onAwayDays,
}: AwayDaysSheetProps) {
  const [selected, setSelected] = useState<string[]>([]);

  React.useEffect(() => {
    if (visible) setSelected([]);
  }, [visible]);

  const todayISO = todayISOLocal();
  // Days the athlete can be away on: real (non-game) sessions today-or-later
  // in the viewed week. Clearing a rest day is a no-op, so we hide those.
  const awayCandidates = weekDays.filter(
    (day) => day.date >= todayISO && day.workout && day.workout.workoutType !== 'Game',
  );

  const toggle = (date: string) =>
    setSelected((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date],
    );

  return (
    <Sheet visible={visible} onClose={onClose} testID="home-away-days-sheet">
      <View>
          <Text style={styles.sheetTitle}>Which days are you away?</Text>
          {acknowledgment && (
            <Text
              style={[styles.busyAwayEmpty, acknowledgment.tone === 'error' && styles.scheduleAckError]}
              testID="home-away-days-ack"
            >
              {acknowledgment.message}
            </Text>
          )}
          {awayCandidates.length === 0 ? (
            <Text style={styles.busyAwayEmpty}>
              No upcoming sessions to clear this week.
            </Text>
          ) : (
            awayCandidates.map((day) => {
              const isOn = selected.includes(day.date);
              return (
                <Pressable
                  key={day.date}
                  onPress={() => toggle(day.date)}
                  style={({ pressed }) => [
                    styles.awayDayRow,
                    isOn && styles.awayDayRowOn,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <View style={[styles.awayCheck, isOn && styles.awayCheckOn]}>
                    {isOn && (
                      <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#0B0B0B" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><Path d="M20 6L9 17l-5-5"/></Svg>
                    )}
                  </View>
                  <Text style={styles.awayDayText}>
                    {shortDayMonthLabel(day.date)}
                    {(() => {
                      // The projection's own words for this date, not the raw
                      // workout name — the SAME `cardLeadHeadline` rule the
                      // week card uses. This list filters `workoutType !==
                      // 'Game'` only (not the broader fixture set —
                      // `dayIsFixture` also matches `workoutType: 'Practice
                      // Match'`), so a practice-match row can reach here;
                      // `cardLeadHeadline` still answers it correctly via
                      // `kind === 'game'`.
                      const candidate = visibleWeek.days.find(
                        (day2) => day2.date === day.date,
                      );
                      const label = cardLeadHeadline(candidate);
                      return label ? ` · ${label}` : '';
                    })()}
                  </Text>
                </Pressable>
              );
            })
          )}
          <Button
            label={selected.length > 0 ? `Clear ${selected.length} day${selected.length > 1 ? 's' : ''}` : 'Pick days to clear'}
            size="lg"
            glow={false}
            onPress={() => selected.length > 0 && onAwayDays(selected)}
            style={{ marginTop: spacing.md, opacity: selected.length > 0 ? 1 : 0.5 }}
          />
          <Button label="Cancel" variant="secondary" size="md" onPress={onClose} style={{ marginTop: spacing.sm }} />
      </View>
    </Sheet>
  );
}

interface RebuildSheetProps {
  visible: boolean;
  onClose: () => void;
  isRebuilding: boolean;
  error: string | null;
  canRetry: boolean;
  msgIdx: number;
  msgOpacity: Animated.Value;
  onConfirm: () => void;
}
function RebuildSheet({
  visible, onClose, isRebuilding, error, canRetry, msgIdx, msgOpacity, onConfirm,
}: RebuildSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} dismissable={!isRebuilding}>
      {isRebuilding ? (
        <BuildingState
          title="Building your program…"
          msgIdx={msgIdx}
          msgOpacity={msgOpacity}
          messages={REBUILD_MESSAGES}
        />
      ) : (
        <>
          <Text style={styles.sheetTitle}>Rebuild this week?</Text>
          <Text style={styles.sheetBody}>
            Fresh exercise content will be generated from your current profile.
          </Text>
          <View style={styles.noteBlock}>
            <Text style={styles.notePreserved}>✓ Game days and logged workouts are preserved</Text>
            <Text style={styles.noteWiped}>✗ Any custom exercise swaps will be lost</Text>
          </View>
          {error && <Text style={styles.sheetError}>{error}</Text>}
          {(!error || canRetry) && (
            <Button
              label={error ? 'Try again' : 'Rebuild week'}
              size="lg"
              onPress={onConfirm}
            />
          )}
          <Button
            label={error && !canRetry ? 'Close' : 'Cancel'}
            variant="secondary"
            size="md"
            onPress={onClose}
            style={{ marginTop: spacing.md }}
          />
        </>
      )}
    </Sheet>
  );
}

interface PhaseShiftSheetProps {
  visible: boolean;
  step: PhaseShiftStep;
  targetPhase: SeasonPhase;
  isRebuilding: boolean;
  error: string | null;
  canRetry: boolean;
  msgIdx: number;
  msgOpacity: Animated.Value;
  pendingPreferredDays: DayOfWeek[];
  pendingTeamDays: DayOfWeek[];
  pendingGameDay: DayOfWeek | null;
  /** False until the athlete names a day or says they have no usual one. */
  gameAnchorAnswered: boolean;
  onClose: () => void;
  onBack: () => void;
  onTogglePendingPreferredDay: (d: DayOfWeek) => void;
  onTogglePendingTeamDay: (d: DayOfWeek) => void;
  onSetPendingGameDay: (d: DayOfWeek) => void;
  onAnswerNoUsualGameDay: () => void;
  onAdvance: () => void;
}

/**
 * Muted back chevron — top-left of the modal. Only shown on steps where
 * "back" has a meaningful target (i.e. not on `confirm` or `building`).
 * Intentionally small, unstyled, and chromeless to avoid wizard-like heft.
 */
function BackChevron({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={({ pressed }) => [styles.backChevron, pressed && { opacity: 0.6 }]}
    >
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
        stroke="#8A8A8A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M15 18l-6-6 6-6" />
      </Svg>
    </Pressable>
  );
}

function PhaseShiftSheet({
  visible, step, targetPhase, isRebuilding, error, canRetry, msgIdx, msgOpacity,
  pendingPreferredDays, pendingTeamDays, pendingGameDay, gameAnchorAnswered,
  onClose, onBack,
  onTogglePendingPreferredDay, onTogglePendingTeamDay, onSetPendingGameDay,
  onAnswerNoUsualGameDay, onAdvance,
}: PhaseShiftSheetProps) {
  const building = step === 'building' || isRebuilding;
  // Back is meaningful on every interactive step except the first. Hide on
  // `confirm` (no previous step) and `building` (irreversible) to keep the
  // chrome honest — never show a control that would no-op.
  const showBack = !building && step !== 'confirm';
  // Availability minimum: reuse onboarding's "at least 1 day" baseline.
  // Stricter caps (e.g. enforcing `trainingDaysPerWeek`) would punish
  // athletes who legitimately need to drop a day mid-season — the engine
  // copes fine with a reduced set.
  const availabilityValid = pendingPreferredDays.length >= 1;

  return (
    <Sheet visible={visible} onClose={onClose} dismissable={!isRebuilding}>
      {showBack && <BackChevron onPress={onBack} />}
      {building ? (
        <BuildingState
          title={`Shifting to ${targetPhase}…`}
          msgIdx={msgIdx}
          msgOpacity={msgOpacity}
          messages={PHASE_SHIFT_MESSAGES}
        />
      ) : step === 'confirm' ? (
        <>
          <Text style={styles.sheetTitle}>Shift to {targetPhase} mode?</Text>
          <Text style={styles.sheetBody}>
            Your whole program will rebuild around {targetPhase} priorities.
          </Text>
          <View style={styles.noteBlock}>
            <Text style={styles.notePreserved}>✓ Game days are preserved</Text>
            <Text style={styles.noteWiped}>✗ Any custom exercise swaps will be lost</Text>
            <Text style={styles.notePreserved}>✓ Phase updated to {targetPhase}</Text>
          </View>
          {error && <Text style={styles.sheetError}>{error}</Text>}
          {(!error || canRetry) && (
            <Button
              label={error ? 'Try again' : 'Continue'}
              size="lg"
              onPress={onAdvance}
            />
          )}
          <Button
            label={error && !canRetry ? 'Close' : 'Cancel'}
            variant="secondary"
            size="md"
            onPress={onClose}
            style={{ marginTop: spacing.md }}
          />
        </>
      ) : step === 'availability' ? (
        // Availability re-confirmation. See useHomeScreen for why we always
        // re-ask instead of reusing onboarding data.
        <>
          <Text style={styles.sheetTitle}>What days can you train?</Text>
          <Text style={styles.sheetBody}>
            We'll plan your {targetPhase.toLowerCase()} week around these days. Update them if your schedule has changed.
          </Text>
          <View style={styles.chipGrid}>
            {WEEK_DAYS.map((day) => {
              const selected = pendingPreferredDays.includes(day);
              return (
                <SelectableTile
                  key={day}
                  shape="chip"
                  isSelected={selected}
                  hideCheckmark
                  onPress={() => onTogglePendingPreferredDay(day)}
                  style={styles.dayChip}
                >
                  <Text style={[styles.dayChipText, selected && styles.dayChipTextSelected]}>
                    {DAY_SHORT[day]}
                  </Text>
                </SelectableTile>
              );
            })}
          </View>
          {error && <Text style={styles.sheetError}>{error}</Text>}
          {(!error || canRetry) && (
            <Button
              label={
                error
                  ? 'Try again'
                  : targetPhase === 'Off-season'
                  ? `Shift to ${targetPhase}`
                  : 'Continue'
              }
              size="lg"
              disabled={!availabilityValid}
              onPress={onAdvance}
            />
          )}
          <Button
            label={error && !canRetry ? 'Close' : 'Cancel'}
            variant="secondary"
            size="md"
            onPress={onClose}
            style={{ marginTop: spacing.md }}
          />
        </>
      ) : step === 'teamDays' ? (
        <>
          <Text style={styles.sheetTitle}>Team training days</Text>
          <Text style={styles.sheetBody}>
            Which days does your team train? We'll keep heavy lower-body and sprint work off these days.
          </Text>
          <View style={styles.chipGrid}>
            {WEEK_DAYS.map((day) => {
              const selected = pendingTeamDays.includes(day);
              return (
                <SelectableTile
                  key={day}
                  shape="chip"
                  isSelected={selected}
                  hideCheckmark
                  onPress={() => onTogglePendingTeamDay(day)}
                  style={styles.dayChip}
                >
                  <Text style={[styles.dayChipText, selected && styles.dayChipTextSelected]}>
                    {DAY_SHORT[day]}
                  </Text>
                </SelectableTile>
              );
            })}
          </View>
          <Text style={styles.helperText}>Leave blank if you don't have team training this phase.</Text>
          {error && <Text style={styles.sheetError}>{error}</Text>}
          {(!error || canRetry) && (
            <Button
              label={error ? 'Try again' : targetPhase === 'In-season' ? 'Continue' : `Shift to ${targetPhase}`}
              size="lg"
              onPress={onAdvance}
            />
          )}
          <Button
            label={error && !canRetry ? 'Close' : 'Cancel'}
            variant="secondary"
            size="md"
            onPress={onClose}
            style={{ marginTop: spacing.md }}
          />
        </>
      ) : (
        <>
          <Text style={styles.sheetTitle}>Usual game day</Text>
          <Text style={styles.sheetBody}>
            Which day do you usually play? We'll anchor weekly scheduling around it (arms pump the day before, recovery after).
          </Text>
          <View style={styles.chipGrid}>
            {WEEK_DAYS.map((day) => {
              const selected = pendingGameDay === day;
              return (
                <SelectableTile
                  key={day}
                  shape="chip"
                  isSelected={selected}
                  hideCheckmark
                  onPress={() => onSetPendingGameDay(day)}
                  style={styles.dayChip}
                >
                  <Text style={[styles.dayChipText, selected && styles.dayChipTextSelected]}>
                    {DAY_SHORT[day]}
                  </Text>
                </SelectableTile>
              );
            })}
          </View>
          {/* "No usual game day" is an ANSWER, not the absence of one. Without
              it the only way past this step was to name a day, so an athlete
              whose fixtures move week to week was stuck behind a disabled
              button — and every other caller that left the field empty had
              its stored anchor silently wiped instead. */}
          <SelectableTile
            shape="chip"
            isSelected={gameAnchorAnswered && pendingGameDay === null}
            hideCheckmark
            onPress={onAnswerNoUsualGameDay}
            style={styles.noGameDayTile}
          >
            <Text style={[
              styles.dayChipText,
              gameAnchorAnswered && pendingGameDay === null && styles.dayChipTextSelected,
            ]}>
              I don't have a usual game day
            </Text>
          </SelectableTile>
          {error && <Text style={styles.sheetError}>{error}</Text>}
          {(!error || canRetry) && (
            <Button
              label={error ? 'Try again' : `Shift to ${targetPhase}`}
              size="lg"
              disabled={!gameAnchorAnswered}
              onPress={onAdvance}
            />
          )}
          <Button
            label={error && !canRetry ? 'Close' : 'Cancel'}
            variant="secondary"
            size="md"
            onPress={onClose}
            style={{ marginTop: spacing.md }}
          />
        </>
      )}
    </Sheet>
  );
}

interface BuildingStateProps {
  title: string;
  msgIdx: number;
  msgOpacity: Animated.Value;
  messages: string[];
}
function BuildingState({ title, msgIdx, msgOpacity, messages }: BuildingStateProps) {
  return (
    <View style={styles.building}>
      <ActivityIndicator size="large" color="#C8FF00" style={styles.buildingSpinner} />
      <Text style={styles.sheetTitle}>{title}</Text>
      <Text style={styles.sheetSubtext}>This can take up to 1 minute</Text>
      <Animated.View style={{ opacity: msgOpacity }}>
        <Text style={styles.buildingMsg}>{messages[msgIdx]}</Text>
      </Animated.View>
    </View>
  );
}

// ───────── Styles ─────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0C0C0C' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },

  // Top bar (week nav) — generous bottom space so the list below breathes.
  topBar: { marginBottom: spacing.xl },
  topBarRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: spacing.sm,
  },
  topBarCenter: {
    flex: 1, alignItems: 'center', flexDirection: 'row',
    justifyContent: 'center', gap: spacing.sm,
  },
  // Date label recedes one step — the "THIS WEEK" badge to its right is
  // the primary accent of the bar; the date plays a supporting role. The
  // opacity dial takes it another notch down without changing its colour
  // role in the neutral palette.
  topBarLabel: {
    color: '#B5B5B5', fontSize: 17, fontWeight: '600',
    letterSpacing: 0.2, opacity: 0.85,
  },
  topBarBadge: {},
  topBarRight: { flexDirection: 'row', gap: spacing.sm },

  // Move banner
  moveBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(200, 255, 0, 0.08)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    marginBottom: spacing.md,
  },
  moveText: { color: '#C8FF00', fontSize: 14, fontWeight: '600' },
  moveCancel: { color: '#B0B0B0', fontSize: 14, fontWeight: '600' },

  // Add game — no border, lighter surface
  addGame: {
    marginBottom: spacing.md,
    backgroundColor: '#121212',
    borderColor: 'transparent',
  },
  addGameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addGameIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(200, 255, 0, 0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  addGameText: { color: '#B5B5B5', fontSize: 14, fontWeight: '500' },

  // Busy / away entry + missed-session prompt.
  busyAwayEntry: { marginTop: spacing.md },
  busyAwayRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  busyAwayIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(30, 167, 255, 0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  busyAwayText: { color: '#B5B5B5', fontSize: 14, fontWeight: '500' },
  // Practice-match card = busy/away card with the game-day accent.
  // Same 0.12-alpha treatment as the blue busy icon (DAY_ROW_ACCENT.game).
  practiceMatchIconTint: { backgroundColor: 'rgba(255, 194, 71, 0.12)' },
  // Weekly readiness card = same treatment with a wellbeing tint.
  readinessIconTint: { backgroundColor: 'rgba(255, 122, 133, 0.12)' },
  awayIconTint: { backgroundColor: 'rgba(124, 196, 255, 0.12)' },
  injuredIconTint: { backgroundColor: 'rgba(255, 138, 76, 0.12)' },
  scheduleAckError: { color: '#FF7A85' },
  equipmentIconTint: { backgroundColor: 'rgba(198, 255, 107, 0.12)' },
  readinessAck: {
    backgroundColor: 'rgba(198, 255, 0, 0.12)',
    borderRadius: 12, paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  readinessAckError: { backgroundColor: 'rgba(255, 122, 133, 0.14)' },
  readinessAckText: { color: 'rgba(255,255,255,0.92)', fontSize: 14, lineHeight: 20 },
  busyAwayEmpty: {
    color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 20,
    marginVertical: spacing.sm,
  },
  awayDayRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  awayDayRowOn: {},
  awayCheck: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  awayCheckOn: { backgroundColor: '#C8FF00', borderColor: '#C8FF00' },
  awayDayText: { color: '#FFFFFF', fontSize: 15, fontWeight: '500', flex: 1 },

  missedCard: { marginTop: spacing.md },
  missedTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  missedBody: {
    color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 19,
    marginBottom: spacing.sm,
  },
  missedActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  missedChip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  missedChipPrimary: { backgroundColor: '#C8FF00', borderColor: '#C8FF00' },
  missedChipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  missedChipPrimaryText: { color: '#0B0B0B' },

  // Active Coach Notes — compact control-panel cards derived from typed
  // active constraints. Hidden entirely when nothing is shaping the program.
  coachNotesSection: {
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  coachNotesTitle: {
    color: '#C8FF00',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  coachNotesStack: {
    gap: 8,
  },
  coachNoteCard: {
    backgroundColor: '#11140F',
    borderColor: 'rgba(200, 255, 0, 0.20)',
  },
  coachNoteContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: 8,
  },
  coachNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coachNoteDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#C8FF00',
  },
  coachNoteTitle: {
    flex: 1,
    color: '#F5F5F5',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  coachNoteBody: {
    color: '#A7A7A7',
    fontSize: 12,
    lineHeight: 17,
  },
  coachNoteActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 2,
  },
  coachNoteAction: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B1B1B',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2F2F2F',
  },
  coachNotePrimaryAction: {
    backgroundColor: 'rgba(200, 255, 0, 0.13)',
    borderColor: 'rgba(200, 255, 0, 0.36)',
  },
  coachNoteActionText: {
    color: '#CFCFCF',
    fontSize: 12,
    fontWeight: '700',
  },
  coachNotePrimaryActionText: {
    color: '#C8FF00',
  },

  // ─── Week list ───
  //
  // A structured weekly timeline, not a grid of outlined buttons. Rows
  // are flat, borderless, tighter vertically. Non-selected rows recede
  // into a deeper grey; the SELECTED row is the screen's emphasis
  // carrier — slightly bigger type + roomier padding on top of the
  // Card's accent surface. Selection IS the hierarchy (no hero card).
  dayList: { gap: 6, marginTop: spacing.sm },

  // ── Day-first view ──
  dayFirst: { gap: spacing.sm, marginTop: spacing.sm },
  viewToggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: spacing.sm,
    padding: 3,
    gap: 3,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  viewToggleOption: {
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  viewToggleOptionActive: { backgroundColor: 'rgba(200,255,0,0.14)' },
  viewToggleLabel: { color: '#8A8F98', fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  viewToggleLabelActive: { color: '#C8FF00' },

  weekStrip: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  weekStripChip: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  weekStripChipActive: {
    backgroundColor: 'rgba(200,255,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  weekStripDay: { color: '#8A8F98', fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  weekStripDayToday: { color: '#C8FF00' },
  weekStripDayActive: { color: '#C8FF00' },
  weekStripDate: { color: '#E8EAED', fontSize: 15, fontWeight: '600' },
  weekStripDateActive: { color: '#FFFFFF' },
  weekStripMark: { width: 5, height: 5, borderRadius: 3 },

  // The component timeline inside the selected day's expanded block.
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 7 },
  timelineRail: { width: 12, alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center' },
  timelineNode: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#5E6268',
    backgroundColor: 'transparent',
  },
  timelineConnector: {
    position: 'absolute',
    top: '50%',
    bottom: -7,
    width: 1.5,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  timelineHeadline: { flex: 1, color: '#E8EAED', fontSize: 14, fontWeight: '600' },

  dayRow: { position: 'relative' },
  dayAccentStrip: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 4,
    borderRadius: 4,
    opacity: 0.78,
  },
  dayAccentStripSelected: {
    top: 12,
    bottom: 12,
    opacity: 1,
  },
  // Tighter vertical rhythm — pulls the list into a scannable weekly
  // timeline instead of a column of spaced buttons.
  dayRowInner: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  // Selected row breathes: extra vertical padding lets the bigger type
  // and the expanded CTA block sit comfortably.
  dayRowInnerSelected: {
    paddingVertical: spacing.md,
  },
  // Resting state — darker, borderless, quietly set back from the page.
  dayRowResting: { backgroundColor: '#0F0F0F', borderColor: 'transparent' },
  // Today row when NOT selected (the athlete moved the emphasis to
  // another day). A half-step brighter than resting with a faint edge so
  // "now" stays findable without competing with the selected row.
  dayRowToday: { backgroundColor: '#141414', borderColor: '#1F1F1F' },
  dayRowMoveSource: { opacity: 0.5, borderColor: 'rgba(200, 255, 0, 0.30)' },
  dayRowMoveTarget: {
    borderColor: 'rgba(200, 255, 0, 0.40)', backgroundColor: '#141814',
  },

  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  leftCluster: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectedHeader: {
    gap: 10,
  },
  selectedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectedDateCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  selectedBadgeCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  dayLabel: {
    color: '#5A5A5A', fontSize: 11, fontWeight: '800',
    letterSpacing: 1.6, minWidth: 32,
  },
  // Selected weekday steps up a size — the "you are here" marker.
  dayLabelSelected: {
    fontSize: 13,
  },
  // Calendar date beside the weekday — one step dimmer, lighter weight,
  // no tracking. "MON" is the anchor, "3/7" is the detail.
  dayDate: {
    color: '#4A4A4A', fontSize: 11, fontWeight: '600',
  },
  dayDateSelected: {
    fontSize: 13, color: '#6A6A6A',
  },
  gameBadge: {
    backgroundColor: 'rgba(255, 194, 71, 0.15)',
    borderColor: 'rgba(255, 194, 71, 0.45)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  gameBadgeText: {
    color: '#FFC247',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  selectedTitleBlock: {
    alignItems: 'flex-start',
    gap: 4,
    maxWidth: '100%',
  },
  selectedTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  selectedContextLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  selectedWorkoutTitle: {
    textAlign: 'left',
    flexShrink: 1,
  },
  titleBlock: { flex: 1, alignItems: 'flex-end', minWidth: 0 },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    maxWidth: '100%',
  },
  rowContextLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    maxWidth: '100%',
    marginTop: 2,
  },
  rowIcon: {
    opacity: 0.95,
  },
  teamTrainingIcon: {
    opacity: 1,
  },
  // Primary row text — nudged brighter so the session name is the clear
  // anchor of each row against the darker resting surface beneath it.
  workoutTitle: {
    color: '#F2F2F2', fontSize: 14, fontWeight: '600', textAlign: 'right',
    flexShrink: 1,
  },
  // Selected session title — the biggest text in the list, but still a
  // row, not a hero. White + heavier weight carry the emphasis.
  workoutTitleSelected: {
    color: '#FFFFFF', fontSize: 18, fontWeight: '700',
  },
  workoutContext: {
    color: '#7A7A7A', fontSize: 12, fontWeight: '500',
    textAlign: 'right', flexShrink: 1,
  },
  attachedWorkoutContext: {
    color: '#7A7A7A',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  attachedWorkoutContextSelected: {
    color: '#7A7A7A',
    fontSize: 17,
    lineHeight: 21,
  },
  restLine: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  restLabel: {
    color: '#3E3E3E', fontSize: 13, fontWeight: '600', textAlign: 'right',
  },
  restLabelSelected: {
    color: '#F4F4F4', fontSize: 18, fontWeight: '700',
  },
  moveTargetLabel: {
    flex: 1, color: 'rgba(200, 255, 0, 0.55)', fontSize: 14, fontWeight: '500',
    fontStyle: 'italic', textAlign: 'right',
  },

  expanded: { marginTop: spacing.md, gap: spacing.sm },
  expandedMeta: { color: '#888888', fontSize: 13 },
  sessionCompleteLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sessionCompleteText: { color: '#5BD98A', fontSize: 13, fontWeight: '600' },

  // Tap-first change door (PlanChangeSheet trigger)
  makeChangeLink: { paddingVertical: spacing.xs, alignSelf: 'flex-start' },
  makeChangeText: { color: '#C8FF00', fontSize: 13, fontWeight: '600' },

  // Sections — larger rhythm between top-level blocks.
  section: { paddingTop: spacing.xxl, gap: spacing.md },

  // Phase card — borderless default surface; the outline Button below it
  // carries the accent weight.
  phaseCard: {
    gap: spacing.sm, alignItems: 'flex-start',
    backgroundColor: '#141414',
    borderColor: 'transparent',
  },
  phaseBadge: {
    color: '#C8FF00', fontSize: 14, fontWeight: '500', letterSpacing: 0,
  },
  phaseBody: { color: '#D0D0D0', fontSize: 14, lineHeight: 20 },
  phaseBodyAccent: { color: '#C8FF00', fontSize: 14, fontWeight: '400' },

  // Sheet
  // Back chevron — absolute top-left. Deliberately chromeless (no bg, no
  // border, muted grey). Sheet's existing top padding gives us headroom;
  // we overlap it rather than consume layout flow so the title's
  // text-align: center reads off the full sheet width, not "title + back
  // chevron" width.
  backChevron: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    padding: 4,
    zIndex: 2,
  },
  sheetTitle: {
    fontSize: 19, fontWeight: '700', color: '#FFFFFF',
    textAlign: 'center', marginBottom: 6,
  },
  sheetBody: {
    color: '#B0B0B0', fontSize: 14, lineHeight: 20, textAlign: 'center',
    marginBottom: spacing.md, paddingHorizontal: spacing.sm,
  },
  sheetSubtext: { color: '#757575', fontSize: 13, textAlign: 'center', marginBottom: spacing.md },
  sheetError: { color: '#F44336', fontSize: 13, textAlign: 'center', marginBottom: spacing.sm },

  sheetCurrentBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginBottom: spacing.lg,
  },
  sheetCurrentDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#C8FF00',
  },
  sheetCurrentText: { color: '#B0B0B0', fontSize: 13, fontWeight: '500' },

  sheetOption: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2A2A2A',
  },
  sheetOptionIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#222222',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  sheetOptionText: { fontSize: 16, fontWeight: '500', color: '#FFFFFF' },
  sheetOptionSub: { fontSize: 13, color: '#8A94A6', marginTop: 2, lineHeight: 17 },

  noteBlock: {
    gap: 6, backgroundColor: '#1A1A1A', borderRadius: borderRadius.lg,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: spacing.md,
  },
  notePreserved: { color: '#C8FF00', fontSize: 13, fontWeight: '600' },
  noteWiped: { color: '#FF9AA2', fontSize: 13, fontWeight: '500' },

  chipGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 8, marginBottom: spacing.sm,
  },
  // Layout-only overrides now — SelectableTile (shape="chip") owns the
  // base / selected / pressed looks. We just force a minimum width so all
  // seven day chips line up on a single row.
  dayChip: {
    minWidth: 58, alignItems: 'center',
  },
  phaseSkewCard: {
    backgroundColor: '#161616',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#3A3A1A',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  phaseSkewTitle: {
    color: '#C8FF00', fontSize: 14, fontWeight: '700', marginBottom: spacing.xs,
  },
  phaseSkewBody: {
    color: '#BDBDBD', fontSize: 13, lineHeight: 19, marginBottom: spacing.md,
  },
  phaseSkewError: {
    color: '#FF6B6B', fontSize: 12, marginBottom: spacing.sm,
  },
  dayChipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  dayChipTextSelected: { color: '#C8FF00', fontWeight: '700' },
  // Full-width so it reads as a peer of the day row rather than an eighth day.
  noGameDayTile: {
    alignSelf: 'stretch', alignItems: 'center', marginBottom: spacing.md,
  },
  helperText: {
    color: '#757575', fontSize: 12, textAlign: 'center', marginBottom: spacing.md,
  },

  building: {
    alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.md,
  },
  buildingSpinner: { marginBottom: spacing.md },
  buildingMsg: {
    color: '#C8FF00', fontSize: 14, fontWeight: '500',
    textAlign: 'center', minHeight: 20, letterSpacing: 0.2,
  },
});
