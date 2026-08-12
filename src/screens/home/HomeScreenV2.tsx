import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { PlanChangeSheet } from './PlanChangeSheet';
import { GuidedInjuryFlowSheet } from './GuidedInjuryFlowSheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { Circle, Path } from 'react-native-svg';
import { Text } from '../../components/common/Text';
import { SessionTierBadge } from '../../components/common/SessionTierBadge';
import { SelectableTile } from '../../components/common';
import { StaleOverrideBanner } from '../../components/StaleOverrideBanner';
import { ModifiersStrip } from '../../components/ModifiersStrip';
import { ModifiersSheet } from '../../components/ModifiersSheet';
import { Button, Card, Sheet, Badge } from '../../components/ui';
import { LfaIcon } from '../../components/icons/LfaIcon';
import type { SeasonPhase, DayOfWeek } from '../../types/domain';
import { weeklyConditioningIconKind } from '../../utils/weeklyPlanDisplay';
import { isTeamTrainingOnlyWorkout } from '../../utils/teamTraining';
import type { VisibleDay, VisibleWeek, VisiblePartKind } from '../../rules/visibleProjection';
import { visibleDayLeadBucket, visibleDayLeadHeadline } from '../../rules/visibleDayDetail';
import { dayTimeline, type DayTimelineEntry } from '../../rules/dayTimeline';
import { signedCopy } from '../../rules/signedCopy';
import {
  mobilityFlowMovementDose,
  selectMobilityPrehabFlow,
  type MobilityPrehabFlow,
} from '../../utils/mobilityPrehabFlow';
import { useAthleteContext } from '../../hooks/useSchedule';
import { spacing, borderRadius } from '../../theme/spacing';
import { useHomeScreen, type WeekReadinessAction } from './useHomeScreen';
import {
  MONTH_NAMES,
  dayOfMonthLabel,
  dayOfWeekForISODate,
  shortDayMonthLabel,
  todayISOLocal,
} from '../../utils/appDate';
import { addDaysISO } from '../../utils/programBlockState';
import { EquipmentLimitationSheet } from './EquipmentLimitationSheet';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import { resolveVisibleReadinessState } from '../../utils/visibleReadinessState';
import { buildReadinessAcknowledgment, buildScheduleAcknowledgment, type ReadinessAcknowledgment } from '../../utils/readinessAcknowledgment';
import { recordScheduleAckPresented } from '../../utils/athleteActionDiagnostics';
import { applyLighterDayForToday } from '../../utils/lighterDayTransaction';
import type { MissedSession, MissedSessionResponse } from '../../utils/missedSessions';
import { dayOfWeekTestIdToken, explorerTestId } from '../../utils/stableTestId';
import { ExplorerRenderWitness } from '../../components/ExplorerRenderWitness';
import { UndoToast } from '../../components/UndoToast';
import { BuildingState, RebuildSheet } from '../../components/RebuildSheet';
import { deriveFutureProgressionRenderTarget } from '../../utils/sessionFeedbackRenderWitness';
import {
  WEEK_DAYS,
  DAY_SHORT,
  REBUILD_MESSAGES,
  PHASE_SHIFT_MESSAGES,
  type PhaseShiftStep,
} from './homeScreenConstants';

/**
 * HomeScreenV2 — one visible week, two deliberate screen shapes.
 *
 * ## Hierarchy
 * Today renders as the one actionable day card. Week renders seven instances
 * of one dated card head; today is that same card highlighted, and selection
 * reveals component details without changing the head or importing the day
 * screen's Start/change controls. Both shapes read the same VisibleDay.
 *
 * ## Logic parity
 * All state and handler orchestration lives in `useHomeScreen`, which
 * HomeScreenClassic consumes identically. This file is presentation-only.
 * Swapping variants via the Profile toggle produces identical data
 * outcomes — only the rendering differs.
 *
 * ## Visual language
 * Premium, focused, high-end. The week reads as seven instances of the same
 * card, with today highlighted inside that system rather than promoted into a
 * different hero. The day screen keeps the larger actionable treatment.
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
    isThisWeek,
    canGoPrev,
    canGoNext,
    handlePrev,
    handleNext,
    handleThisWeek,
    selectedIdx,
    todayIdx,
    mode,
    handleDayTap,
    handleSelectDayOnly,
    handleClearSelection,
    handleCancelMove,
    handleAddGameMode,
    handleViewWorkout,
    handleFinishTeamSession,
    handleApplyGuidedInjury,
    handleApplyAwayEquipment,
    handleApplyWeekReadiness,
    handleClearWeekReadiness,
    missedSessionPrompt,
    handleLogMissedSession,
    handleSkipMissedSession,
    staleByDate,
    showAddFixtureCTA,
    currentPhase,
    coachNotes,
    programModifiers,
    modifierCount,
    handleOpenMyStatus,
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
  } = useHomeScreen();

  const isNormal = mode.type === 'normal';
  /* ── ITEM 19: THE ADD-FIXTURE CONTROL NAMES THE PHASE AND NOTHING ELSE ──
     Sam, 2026-08-12: *"a user should be able to have as many games as needed in
     their week"*.

     WHAT THIS REPLACED, AND WHY IT WAS THE WHOLE DEFECT. `practiceMatchDay` was
     `weekDays.find(...)` — the FIRST fixture — and the label and the handler
     both branched on it. So the moment a week had one game, the control stopped
     offering to add and became a label pointing at that game. The in-season
     card next door was gated `!weekHasGame` and simply disappeared for the same
     reason. **Two cards, two spellings of "you may have one game".**

     A `find` for the first of a set is the tell. The week may hold several
     fixtures and the engine already carries every one of them; only these two
     surfaces still believed in a single game.

     EXISTING FIXTURES ARE REACHED BY TAPPING THEIR OWN DAY, which is a door
     that already works and is per-fixture rather than first-fixture. This
     control's job is adding, so it only ever adds. */
  const addFixtureLabel = currentPhase === 'Pre-season'
    ? 'Add a pre-season practice match'
    : 'Add a game';

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
  // The view choice is independent of week position. Day keeps the same weekday
  // as the athlete browses a different allowed week; Week remains Week. This is
  // one persistent presentation preference, not a rule that another week may
  // silently reinterpret.
  const [preferredDayIdx, setPreferredDayIdx] = useState(todayIdx >= 0 ? todayIdx : 0);
  const dayFirst = preferredProgramView === 'today' && isNormal;
  const dayFirstIdx = Math.min(Math.max(preferredDayIdx, 0), Math.max(weekDays.length - 1, 0));
  const dayFirstDay = dayFirstIdx >= 0 ? weekDays[dayFirstIdx] : null;
  const reviewAthlete = useAthleteContext();
  const mobilityFlowByDate = useMemo(() => {
    const isGameWeek = weekDays.some((day) => day.indicator === 'game');
    return new Map(weekDays.map((day) => [
      day.date,
      selectMobilityPrehabFlow({
        workout: day.workout,
        seasonPhase: currentPhase,
        isGameWeek,
        athlete: reviewAthlete,
        date: day.date,
      }),
    ]));
  }, [currentPhase, reviewAthlete, weekDays]);
  /* ── SAM'S SHEET, RULED 2026-08-13: *"add the popup"* ──
     The day/week notice used to navigate straight to My Status. It now opens
     this sheet first, which lists WHICH modifiers are acting and offers "Go to
     my status" or "Not now" — his prototype's two-step.

     LOCAL STATE, NOT A NAVIGATION PARAM, and the difference is deliberate. My
     Status is opened by `navigation.setParams({ status: 'open' })` because TWO
     tabs must be able to open it and one of them is not its owner. This sheet
     has exactly one owner and one opener: the notice on this screen. A
     navigation param would make a private presentation detail addressable from
     anywhere, which is the disconnected-handoff shape cell [9] of
     `test:coach-tab-slice3` exists to prevent, pointed the other way. */
  const [modifiersSheetOpen, setModifiersSheetOpen] = useState(false);
  const [expandedWeekIdx, setExpandedWeekIdx] = useState(-1);
  const handleClearWeekPresentation = () => {
    setExpandedWeekIdx(-1);
    handleClearSelection();
  };
  const handleCompactPrev = () => {
    setExpandedWeekIdx(-1);
    handlePrev();
  };
  const handleCompactNext = () => {
    setExpandedWeekIdx(-1);
    handleNext();
  };
  const handleCompactThisWeek = () => {
    setExpandedWeekIdx(-1);
    handleThisWeek();
  };

  // ── Tap-first plan-change sheet (ATHLETE_CHANGE_VOCABULARY.md group 1) ──
  const [changeSheetEntry, setChangeSheetEntry] = useState<{
    date: string;
    initialAction: 'actions' | 'move';
  } | null>(null);
  // ── ITEM 28: THE AWAY FLOW'S THREE ANSWERS ──
  // The sheet owns the two dates; this screen owns only what survives it — the
  // SPAN, which is the input the equipment question needs. `null` span means
  // the equipment sheet is closed; a span means the athlete said they will not
  // have their normal kit and is now marking which parts.
  const [awayVisible, setAwayVisible] = useState(false);
  const [awayEquipmentSpan, setAwayEquipmentSpan] =
    useState<{ from: string; until: string } | null>(null);
  // ONE ACK STATE FOR BOTH SCHEDULE DOORS. They are two buttons writing one fact
  // kind through one executor; two acknowledgment states would be two places to
  // forget to set. Rendered under the rows for the sheet-less door and inside
  // the sheet for the other, so the answer appears where the tap happened.
  const [scheduleAck, setScheduleAck] = useState<ReadinessAcknowledgment | null>(null);

  // One typed entry owns both visibility and the first readiness question.
  // Tired and Sick share the same saved modifier pathway without forcing the
  // athlete through a chooser that simply repeats the chip they just tapped.
  // Active state is derived from the EXISTING tap modifiers for the
  // currently selected week (ids are week-keyed by Monday).
  const [readinessEntry, setReadinessEntry] = useState<'flat' | 'sick' | null>(null);
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

  /* THE COACH-NOTE MACHINERY IS GONE FROM THE DAY SCREEN — item 8 (c),
   * 2026-08-12, and it goes AFTER (a)+(b) by ruling.
   *
   * `handleCoachNoteAction` routed a modifier action to a sheet; nothing had
   * called it since the UI merge stopped this screen rendering the modifier
   * list. It went with `coachNoteSheet`, `injuryFlowNote`, their two confirm
   * handlers and the injury prefill they fed.
   *
   * ALL OF IT STILL EXISTS — on the screen that owns the modifiers.
   * `useCoachNoteActions` holds the routing and the sheet state for both
   * mounts, and `coachNoteActionRoute` is the same three branches this router
   * had. Deleting it before My Status was live would have left seven controls
   * pointing at a screen with nothing on it. */

  /**
   * ONE DAY OWNER, WHICHEVER SHAPE THE SCREEN IS IN.
   *
   * The week view calls this seven times, the day-first view once. Everything a
   * row is — its visible-day read, receipts and testIDs — is decided here and
   * only here. The presentation boundary is explicit: day owns actions; week
   * owns the uniform dated head and opens details only.
   *
   * The one difference is the tap, and it is the honest one: in the week view
   * tapping the open row COLLAPSES it (selection is expansion, and the list is
   * still whole without it); in the day-first view the row is what the screen is
   * about, so tapping it re-selects rather than emptying the screen. Game days
   * keep their action sheet in both.
   */
  const renderDayRow = (day: typeof weekDays[0], idx: number) => {
    const isSelected = dayFirst ? true : isNormal
      ? idx === expandedWeekIdx
      : idx === selectedIdx;
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
          if (dayFirst && !isGame) return;
          if (!dayFirst && isNormal && !isGame) {
            setExpandedWeekIdx((current) => (current === idx ? -1 : idx));
            return;
          }
          return isGame && isNormal ? handleSelectDayOnly(idx) : handleDayTap(idx);
        }}
        onViewWorkout={() => handleViewWorkout(day)}
        onFinishTeam={() => handleFinishTeamSession(day)}
        onLogGame={() => handleLogGame(day.date)}
        onGameDayActions={() => handleOpenGameDayActions(day.date)}
        onMakeChange={() => setChangeSheetEntry({ date: day.date, initialAction: 'actions' })}
        staleWarning={staleByDate[day.date]}
        normal={isNormal}
        feedbackReceipts={receiptIdsForDate(day.date)}
        progressionReceipts={progressionReceiptsForDate(day.date)}
        /* THE COMPONENT TIMELINE — day-first only, and it is a READ.
           `dayTimeline` folds the athlete's SAVED outcome onto the projection's
           parts; nothing here writes. A tap opens the same day-detail door the
           row's own CTA opens (Sam's fork A: completion shown, not written). */
        dayShape={dayFirst}
        /* ── RULING 7: THE WEEK'S ROWS OPEN IN PLACE TOO ──
           `dayFirst &&` is GONE from this line, and that is the whole of the
           week view's structural change. Sam's question — "does tapping Thursday
           open in place or take me to a day screen?" — was answered by reading
           her signed prototype: **it expands IN PLACE**, and the app already did
           that; what the week rows lacked was anything worth opening.

           SO THE SESSION IS NOT REBUILT FOR THE WEEK. It is the same
           `DayTimeline` and the same `dayTimeline()` read, with one presentation
           input: Today keeps the interactive component rows; Week shows every
           section and exercise immediately, as the signed prototype does. One
           component and one list of entries means the two shapes cannot disagree
           about what is on a day while still being allowed to read differently.

           REST AND GAME DAYS STILL DO NOT EXPAND, and nothing here had to say
           so: `DayTimeline` returns null on zero entries, and the expanded block
           below is already branched so a fixture shows its own actions. Her
           prototype's `noExpand` is a property this app gets by construction. */
        timeline={visibleDay ? (
          <DayTimeline
            entries={dayTimeline(visibleDay, sessionFeedback[day.date])}
            mobilityFlow={mobilityFlowByDate.get(day.date) ?? null}
            onOpen={() => handleViewWorkout(day)}
            presentation={dayFirst ? 'interactive' : 'flat'}
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
         * Button and chips) claim the touch responder before
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
          onPress={dayFirst ? undefined : handleClearWeekPresentation}
          accessible={false}
        >
        {/* ── Program shape controls ── */}
        <View style={styles.topBar}>
          {/* ── Day / Week ──
              The zoom control Sam's direction asks for. It remains mounted on
              every week the saved program permits, so changing the week cannot
              change the athlete's chosen screen shape. A game picker still
              forces the week because the athlete is choosing among seven days.

              Sam replaced "Today" with "Day" on 2026-08-11 so this control
              names the two screen shapes at the same level: Day and Week. */}
          {isNormal ? (
            <View style={styles.viewToggle} testID="program-view-toggle">
              {(['today', 'week'] as const).map((option) => {
                const isActive = preferredProgramView === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      if (option === 'today' && expandedWeekIdx >= 0) {
                        setPreferredDayIdx(expandedWeekIdx);
                      }
                      setPreferredProgramView(option);
                      // Both shape transitions close transient week detail. The
                      // shared selection is also cleared so a picker/classic
                      // coordinate cannot leak back into this presentation.
                      handleClearWeekPresentation();
                    }}
                    testID={`program-view-${option}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={option === 'today' ? 'Day' : 'Week'}
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
                      {option === 'today' ? 'Day' : 'Week'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* WEEK NAVIGATION BELONGS TO THE WEEK SHAPE. The day screen is about
              today and offers the Week toggle as its one route out; previous /
              next week controls there compete with that promise and do not
              exist in Renee's accepted day template. Once zoomed out, the same
              three established doors sit directly below the toggle as a quiet
              date row. Their handlers and stable ids are unchanged.

              There is deliberately no relative-week badge. The range is the
              subject, tapping an adjacent range still returns to this week, and
              the large circular IconButtons have been replaced by plain glyphs
              with expanded hitSlop so simpler does not mean harder to tap. */}
          {!dayFirst ? (
            <View style={styles.compactWeekNav} testID="program-week-navigation">
              <Pressable
                onPress={canGoPrev ? handleCompactPrev : undefined}
                disabled={!canGoPrev}
                accessibilityRole="button"
                accessibilityLabel="Previous week"
                accessibilityState={{ disabled: !canGoPrev }}
                testID="program-week-previous"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.compactWeekNavButton,
                  !canGoPrev && styles.compactWeekNavButtonDisabled,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#B5B5B5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M15 18l-6-6 6-6" />
                </Svg>
              </Pressable>
              <Pressable
                style={styles.compactWeekNavCurrent}
                onPress={isThisWeek ? undefined : handleCompactThisWeek}
                accessibilityRole="button"
                accessibilityLabel={isThisWeek ? 'This week' : 'Return to this week'}
                testID="program-week-current"
              >
                <Text style={styles.compactWeekNavLabel} numberOfLines={1}>
                  {weekLabel}
                </Text>
              </Pressable>
              <Pressable
                onPress={canGoNext ? handleCompactNext : undefined}
                disabled={!canGoNext}
                accessibilityRole="button"
                accessibilityLabel="Next week"
                accessibilityState={{ disabled: !canGoNext }}
                testID="program-week-next"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.compactWeekNavButton,
                  !canGoNext && styles.compactWeekNavButtonDisabled,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#B5B5B5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M9 18l6-6-6-6" />
                </Svg>
              </Pressable>
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

        {/* ONLY WEEK'S COMPACT DATE NAV SITS BETWEEN THE TOGGLE AND THE WEEK.
            Today still puts its card directly under the control. On Week, Sam's
            2026-08-11 eye pass explicitly placed the simplified date row here.
            Everything else that used to queue up in this gap
            — the missed-session prompt, the season-phase skew disclosure and
            the Coach Notes section — now renders BELOW the day's card, in the
            order he named. The picker banners above are the one exception and
            they are not one: a picker forces the week shape, and "tap the day
            to move the game to" has to sit above the days it is talking about.

            THIS SUPERSEDES A4 RIDER (a) ("above the week it explains"), which
            is written down in `weeklyReadinessCardTests`. That cell is inverted
            in this same commit rather than deleted — the ruling moved, so the
            pin moves with it. */}

        {/* ── The week ──
            ONE ROW CALL SITE FOR BOTH SHAPES. `renderDayRow` below is the only
            place a day is drawn at full size; the day-first view calls it once
            and the week view calls it seven times. Two JSX copies of a sixteen-
            prop row is two places to forget a prop, and the one that got
            forgotten would be the one nobody looked at. */}
        {dayFirst ? (
          <View style={styles.dayFirst}>
            {/* ── RULING 3: NO DAY STRIP AT THE TOP ──
                Sam, 2026-08-10, after tapping through both prototypes: *"No days
                at the top of the page - people only care about the day they are
                on and if they need to view the other days they go to weekly
                view."*

                THE BEHAVIOUR IS NOT DELETED, IT IS RE-HOMED, and this comment is
                the ledger row that says where: **weekly view**, one tap away on
                the Day/Week toggle directly above. The strip's old door chose
                another subject for the day screen. The Week shape's seven rows
                replace that route by opening their details in place.

                THE DAY SCREEN OWNS ONE WEEKDAY. It starts on today's weekday
                and keeps that weekday when the athlete changes between saved
                program weeks. Week expansion has its own local coordinate; it
                only becomes the Day choice when the athlete explicitly taps
                Day. A tap in one shape cannot otherwise reinterpret the other.

                `WeekStrip` STAYS IN THIS FILE, unreferenced by this shape.
                Deleting the component in the same commit that removes its call
                site would make one change into two, and Sam's binding line is
                that nothing working is destroyed to match a picture. If it is
                still unused when the merge lands, it retires on its own. */}
            {/* ── ITEM 16 (b): THE DAY'S SMALL CARD, ABOVE THE DAY CARD ──
                Sam, 2026-08-12: *"yes — one line on week, small card on day,
                read-only both"*. Ruling 4's placement, and the same component
                the Coach header mounts — not a second one, because three copies
                of a count row is three places for the count to disagree.

                READ-ONLY. It carries no controls; tapping opens My Status,
                which owns every control that changes a modifier. Cell [5] of
                `test:program-tab-read-only-modifiers` is what stops
                `ActiveModifiersSection` coming back to Program behind it.

                NOTHING AT ZERO. `ModifiersStrip` returns null at `count <= 0`
                for non-coach surfaces, so a quiet week pays nothing for this. */}
            <ModifiersStrip
              surface="day"
              count={modifierCount}
              onPress={() => setModifiersSheetOpen(true)}
            />
            {dayFirstDay ? renderDayRow(dayFirstDay, dayFirstIdx) : null}
            {/* THE SIX DAYS THE STRIP STANDS IN FOR STILL REPORT THEMSELVES.
                Every day mounts its canonical state leaves in BOTH shapes — a
                fixture's state node, a session card, a saved-feedback receipt.
                Without this, changing the shape of the screen would silently
                narrow what the explorer can observe, and a day-first view would
                start reporting that six of the athlete's days do not exist.

                THEY LIVE IN ONE LAYOUT-INERT WRAPPER, AND THAT IS A FIX, NOT
                TIDYING (Sam's screenshot, 2026-08-08 11:04 — a dead zone under
                the day card).

                `DayStateLeaves` returns a FRAGMENT, so its witnesses used to
                flatten into direct children of this container — and this
                container has `gap: spacing.sm`. Six days x two-to-four
                witnesses each is a dozen-plus invisible children, and the gap
                is inserted between EVERY one of them. **Invisible nodes were
                participating in layout**, and the dead zone GREW as an athlete
                accrued feedback receipts, which is why it looked like a spacing
                bug that spacing changes could not fix.

                `position: 'absolute'` is the load-bearing property, not the
                zero size: an absolutely-positioned child is out of the flex
                flow entirely, so `gap` never applies to it. A merely 0x0 static
                wrapper still occupies a flex slot and still earns one gap —
                better than a dozen, but not zero, and Sam's report is that the
                gap should not be there at all. This is inert at ANY witness
                count, which is the half a margin tweak could never buy.

                NOTHING ABOUT THE WITNESSES THEMSELVES CHANGED — same
                components, same testIDs, same count, same order. Only where
                the layout engine is allowed to see them. */}
            <View
              pointerEvents="none"
              style={styles.stateLeafWell}
            >
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
          </View>
        ) : (
          <View style={styles.dayList}>
            {/* ── ITEM 16 (a): THE WEEK'S ONE LINE, ABOVE THE SEVEN ROWS ──
                Same component, asking for the WEEK surface, which is the branch
                that draws a single quiet line instead of the day's card. The
                surface name is deliberately not repeated as a literal in this
                prose: a comment carrying the exact string a gate greps for can
                answer for the code instead of the code doing it (`a comment is
                not a shipped string`), and this comment had already swallowed a
                mutation that was aimed at the mount below it. It sits above
                `day-row-mon` because it is about the week those rows are, and
                the athlete should not have to scroll to learn the week is being
                changed. Read-only here too — the line opens My Status. */}
            <ModifiersStrip
              surface="week"
              count={modifierCount}
              onPress={() => setModifiersSheetOpen(true)}
            />
            {weekDays.map((day, idx) => renderDayRow(day, idx))}
          </View>
        )}

        {/* ── THE LIFE-FACT CHIP ROW (Sam's ruling 2026-08-08, his own 2026-08-01
            design, option a) ──
            The five stacked bars that used to run down the bottom of this
            screen are ONE horizontal row of round icon chips with a tiny label
            under each, always visible, sitting just under the day's card.

            PRESENTATION ONLY. Every chip keeps the door it already had: the same
            onPress, the same testID, the same accessibility label — including the
            two whose testID changes when a fact is already active. Nothing about
            what a tap does moved; only where the tap lives and what it looks
            like. The sentence each bar used to show is now the chip's spoken
            hint, so the words are not deleted, they are demoted to where a four-
            across row can still carry them.

            The one-word labels are signed. Tired supersedes the old Time label
            and changes its door; Away, Sick and Injured keep theirs. Equipment
            now belongs inside the opened session, where its actual requirements
            are known. Title Case, one word each — a four-across row has room for
            a word, not a sentence. */}
        {/* ── RULING 7: THE BUTTONS DO NOT APPEAR UNDER WEEKLY VIEW ──
            `&& dayFirst` is the whole change. Sam's reasoning IS the spec and it
            is a general principle, not a layout note: *"someone will make a
            change for that day if they need it and if it's chronic they're not
            going to have to go to each day to make the change - also, people
            don't plan on being sick or injured in the future so those buttons
            don't need to be on weekly view"*.

            Every remaining status chip keeps its
            door, its testID and its place on the day screen — the day a change
            is made on. The week shape simply stops offering a per-day control at
            a week-level altitude. */}
        {/* ── RULING 1: THE STATUS CIRCLES GET A CARD AND WORDS ABOVE THEM ──
            Sam's FIRST bullet on his eye pass: *"there's no text above the little
            buttons like rens said"*. His screen had the circles floating with
            no panel and nothing telling the athlete what they are for.

            **HER STRUCTURE, HIS DOORS.** The panel, the heading and the sub-line
            are hers; every chip inside keeps the `onPress`, the `testID` and the
            accessibility label it already had — hers reach nothing, his reach real
            doors. Nothing about what a tap does moved.

            The card heading and sub-line remain owned by signedCopy; this row
            changes only the direct status controls beneath them. */}
        {isNormal && dayFirst && (
          <Card tone="default" padding="lg" radius="lg" style={styles.changeCard} testID="home-change-card">
            <Text style={styles.changeCardHeading}>
              {signedCopy('day.change_card.heading')}
            </Text>
            <Text style={styles.changeCardSubline}>
              {signedCopy('day.change_card.subline')}
            </Text>
          <View style={styles.lifeFactChips} testID="home-life-fact-chips">
            <LifeFactChip
              onPress={() => { setReadinessAck(null); setReadinessEntry('flat'); }}
              testID="home-tired-entry"
              accessibilityLabel="Tired"
              label="Tired"
              tint={styles.tiredIconTint}
              icon={
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#67D7FF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M3 8h15v8H3z" />
                  <Path d="M21 11v2" />
                  <Path d="M6 11v2" />
                </Svg>
              }
            />
            {/* ── ITEM 28: THE AWAY CHIP LEFT THIS ROW FOR THE WEEK SCREEN ──
                Sam, 2026-08-13: *"I think the away button should live on the
                weekly screen, it should say 'when do you leave?' then 'when do
                you return'"*. The same reasoning that moved add-a-game (item
                19): "when do you leave" is a question about a SPAN, and this
                row sits on the screen about ONE day. Its door, its icon and
                its purple tint all moved together — see the away entry under
                `!dayFirst` above. */}
            <LifeFactChip
              onPress={() => { setReadinessAck(null); setReadinessEntry('sick'); }}
              testID={weekReadiness
                ? explorerTestId.readinessUpdate(weekReadiness.id)
                : explorerTestId.readinessSetAction(`readiness-${weekAnchorISO}`)}
              accessibilityLabel={weekReadiness
                ? explorerTestId.readinessUpdate(weekReadiness.id)
                : explorerTestId.readinessSetAction(`readiness-${weekAnchorISO}`)}
              /* A4 SURVIVES THE SHRINK: the label is still the owner's, not the
                 card's. A chip cannot show a sentence, so the owner's title is
                 what this chip SAYS (accessibility) while the row shows one
                 word — and the athlete still reads that title in full, because
                 an active readiness fact is a Coach Note and Coach Notes now sit
                 directly below this row. The word "I'm sick/flat today" (signed,
                 ruling 4) is still this file's, which is what its two pins
                 assert. */
              accessibilityHint={weekReadiness ? weekReadiness.title : "I'm sick/flat today"}
              label="Sick"
              tint={styles.readinessIconTint}
              icon={
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFCA68" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M10 5a2 2 0 0 1 4 0v8.2a4 4 0 1 1-4 0Z" />
                  <Path d="M12 10v6" />
                </Svg>
              }
            />
            <LifeFactChip
              /* ONE OWNER, TWO DOORS. This opens the SAME `GuidedInjuryFlowSheet`
                 the readiness sheet's "Something hurts" row opens, and both
                 complete through `handleApplyGuidedInjury`. */
              onPress={() => setReadinessInjuryVisible(true)}
              testID="home-injured-entry"
              accessibilityLabel="I'm injured"
              label="Injured"
              tint={styles.injuredIconTint}
              icon={
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FF7F7F" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z" />
                </Svg>
              }
            />
          </View>
          </Card>
        )}

        {/* The answer to a chip tap, in the athlete's own words, directly under
            the chip that was tapped. Tapping it dismisses it — an acknowledgment
            the athlete cannot clear is a banner. */}
        {isNormal && scheduleAck && !awayVisible && (
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

        {/* ── Missed-session follow-up ── */}
        {isNormal && missedSessionPrompt && (
          <MissedSessionPrompt
            missed={missedSessionPrompt}
            onRespond={(response) => {
              switch (response) {
                case 'did_it':
                  handleLogMissedSession(missedSessionPrompt);
                  break;
                case 'skipped_it':
                  void handleSkipMissedSession(missedSessionPrompt);
                  break;
                case 'move_forward':
                  setChangeSheetEntry({
                    date: missedSessionPrompt.date,
                    initialAction: 'move',
                  });
                  break;
              }
            }}
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

        {/* ── ITEM 19: ONE ADD-FIXTURE CONTROL, BOTH PHASES, NO CAP ──
            THE TWO CARDS THAT STOOD HERE ARE THIS ONE. An in-season "No game
            this week - add one" card gated on the week having no game, and a
            pre-season practice-match card that became a label once a fixture
            existed. They were one control with two spellings and two ways of
            saying "one game per week is all you get".

            THE PLUS ICON AND ITS COPY WENT WITH THEM, and that is Sam's order
            rather than a preference: the label follows the PHASE now ("Add a
            game" / "Add a pre-season practice match"), so "No game this week"
            could not survive — it is a sentence that is false on exactly the
            weeks this control now has to appear on.

            NO CAP, BY EXPLICIT RULING. No two-game limit, no warning at three,
            no confirm. If a week gets ugly the contract discloses it; a button
            that refuses is a button deciding the athlete's season for them.

            WEEK SHAPE ONLY — SAM, 2026-08-13, ON SEEING IT ON THE DAY SCREEN:
            *"add a game button should only be on week screen - not day screen
            and then you select what day you need to add it too"*.

            AND THE RULING MATCHES WHAT THE CONTROL ALREADY DOES. Tapping it
            enters the add-game picker, and a picker FORCES the week shape
            because the athlete is choosing among seven days. So on the day
            screen this button's only possible next act was to leave the day
            screen — it asked a question the shape it sat in could not answer.
            The day screen is about ONE day; "which day?" is a week question. */}
        {isNormal && !dayFirst && showAddFixtureCTA && (
          <Pressable
            onPress={handleAddGameMode}
            testID={explorerTestId.fixtureIngress('add', weekAnchorISO)}
            accessibilityRole="button"
            accessibilityLabel={addFixtureLabel}
            style={({ pressed }) => [pressed && { opacity: 0.75 }]}
          >
            {/* Same treatment as the busy/away card — only the icon, tint and
                label differ. Reuses the busyAway* styles so the cards cannot
                drift apart. */}
            <Card tone="default" padding="md" radius="lg" style={styles.busyAwayEntry}>
              <View style={styles.busyAwayRow}>
                <View style={[styles.busyAwayIcon, styles.practiceMatchIconTint]}>
                  <RowIcon kind="game" size={14} color={DAY_ROW_ACCENT.game} />
                </View>
                <Text style={styles.busyAwayText}>{addFixtureLabel}</Text>
              </View>
            </Card>
          </Pressable>
        )}

        {/* ── ITEM 28: AWAY IS A WEEK-SHAPE CONTROL ──
            Sam, 2026-08-13: *"I think the away button should live on the weekly
            screen, it should say 'when do you leave?' then 'when do you return'
            thhe leave button should be limited to that week in dates, but the
            return date can be any date in the future / then you are asked about
            the equipment stuff"*.

            IT IS THE SAME MOVE AS ADD-A-GAME, FOR THE SAME REASON. A trip is a
            SPAN — it starts on one day and ends on another, and the ten-day
            version of it does not fit inside the week the athlete is looking
            at. The day screen could not ask that question; it was only ever
            able to tick training days inside the visible week, which is why
            "away for ten days" was unsayable in this app until now. */}
        {isNormal && !dayFirst && (
          <Pressable
            onPress={() => { setScheduleAck(null); setAwayVisible(true); }}
            testID="home-away-entry"
            accessibilityRole="button"
            accessibilityLabel="Away"
            style={({ pressed }) => [pressed && { opacity: 0.75 }]}
          >
            <Card tone="default" padding="md" radius="lg" style={styles.busyAwayEntry}>
              <View style={styles.busyAwayRow}>
                <View style={[styles.busyAwayIcon, styles.awayIconTint]}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#B9A7FF" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" />
                    <Circle cx={12} cy={10} r={2} />
                  </Svg>
                </View>
                <Text style={styles.busyAwayText}>Away</Text>
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

        {/* THE LIFE-FACT BARS THAT STOOD HERE ARE THE CHIP ROW ABOVE.
            They ran down the bottom of the screen as full-width cards —
            "Short on time today", "Away this week?", the weekly readiness door,
            and "I'm injured" — each with a 28pt icon and a
            sentence. Sam's 2026-08-08 ruling makes them one row of round chips
            under the day's card. Every door, testID and accessibility label went
            with them unchanged; nothing about this row is new behaviour, and the
            schedule acknowledgment moved up with them so an answer still appears
            beside the thing that was tapped. */}

        {/* THE PRE-SEASON PRACTICE-MATCH CARD STOOD HERE. It is the control
            above now — one card, phase-labelled, always adding. Moving it up
            beside the card it merged with is the point: two add-a-fixture cards
            at opposite ends of one screen is how they drifted apart. */}

        </Pressable>
      </ScrollView>

      {/* ── Sheets ── */}
      {/* SAM'S TWO-STEP (2026-08-13). The notice opens this; this opens My
          Status. "Not now" closes it and leaves the athlete on their session,
          which is the half of his design that makes a sheet on the day screen
          acceptable rather than an obstacle.

          `coachNotes` IS the list the notice counted — the same
          `useActiveModifiers` derivation, not a second read — so the sheet can
          never list a different number of things than the row that opened it. */}
      <ModifiersSheet
        visible={modifiersSheetOpen}
        modifiers={programModifiers}
        onClose={() => setModifiersSheetOpen(false)}
        onGoToStatus={() => {
          // CLOSED BEFORE NAVIGATING, and it matters on a real device: a modal
          // left mounted across a tab change is the "hidden surface leaves
          // state outside the app" shape — the athlete comes back to Program
          // and finds a sheet they already finished with.
          setModifiersSheetOpen(false);
          handleOpenMyStatus();
        }}
      />
      <PlanChangeSheet
        visible={changeSheetEntry !== null}
        date={changeSheetEntry?.date ?? null}
        weekDays={weekDays}
        initialAction={changeSheetEntry?.initialAction}
        onClose={() => setChangeSheetEntry(null)}
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
        visible={readinessEntry !== null}
        initialBucket={readinessEntry ?? 'flat'}
        active={weekReadiness}
        acknowledgment={readinessAck}
        lighterDayOffer={lighterDayOffer}
        lighterDayBusy={lighterDayBusy}
        onClose={() => { setReadinessEntry(null); setReadinessAck(null); setLighterDayOffer(null); }}
        onApply={async (kind) => {
          // Acknowledge unconditionally — never close in silence. On success the
          // sheet transitions to the adjusted/acknowledged state (active is now
          // set); on failure the error acknowledgment is shown in place.
          const result = await handleApplyWeekReadiness(kind, weekAnchorISO);
          setReadinessAck(buildReadinessAcknowledgment(result));
          // Opt-in lighter-day / "soften today" offer after a today-scoped report.
          const todayScoped = kind === 'tired_today' || kind === 'flat_today' || kind === 'poor_sleep_today' ||
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
          setReadinessEntry(null);
        }}
      />

      {/* Fresh guided injury flow launched from the dedicated Injured chip. */}
      <GuidedInjuryFlowSheet
        visible={readinessInjuryVisible}
        onClose={() => setReadinessInjuryVisible(false)}
        titlePrefix="Injury"
        onComplete={async (result) => {
          await handleApplyGuidedInjury(result);
          setReadinessInjuryVisible(false);
        }}
      />

      <AwaySheet
        visible={awayVisible}
        weekDays={weekDays}
        onClose={() => setAwayVisible(false)}
        onDone={({ leaveISO, returnISO, hasNormalEquipment }) => {
          setAwayVisible(false);
          if (hasNormalEquipment) {
            // SAM'S OWN ANSWER TO THE YES BRANCH: *"if yes, follow same
            // program"*. Nothing is stored, because nothing changes — a fact
            // written here would be a modifier that modifies nothing, which is
            // the shape the north star calls presumed-wrong.
            setScheduleAck({
              tone: 'success',
              message: `You're away ${shortDayMonthLabel(leaveISO)} to ${shortDayMonthLabel(returnISO)} with your normal gear, so your program stays as it is.`,
            });
            return;
          }
          // `until` IS THE LAST DAY AWAY, not the return date: the athlete is
          // home on the day they return, and the program is normal again that
          // morning without them clearing anything.
          setAwayEquipmentSpan({ from: leaveISO, until: addDaysISO(returnISO, -1) });
        }}
      />

      {/* ── ITEM 28 STEP 4: THE EQUIPMENT QUESTION IS THE DOOR THAT ALREADY
          EXISTS ── Sam: *"the athlete just removes the equipment they don't
          have while on the trip and it's kept that way until they turn the
          modifier off and say 'i'm back now'"*. No second equipment menu was
          built; this is the same sheet, handed the span. */}
      <EquipmentLimitationSheet
        visible={awayEquipmentSpan !== null}
        span={awayEquipmentSpan}
        onClose={() => setAwayEquipmentSpan(null)}
        onApply={async (decision) => {
          // CLOSING IS THE CONFIRMATION, so it may only happen on success — the
          // athlete must never watch a sheet dismiss over a refused commit.
          const result = await handleApplyAwayEquipment(decision);
          const ack = buildScheduleAcknowledgment(result, 'away_equipment');
          setScheduleAck(ack);
          recordScheduleAckPresented({
            traceId: result?.traceId, surface: 'away_this_week', tone: ack.tone,
          });
          if (result?.ok) setAwayEquipmentSpan(null);
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

      {/* THE SECOND `GuidedInjuryFlowSheet` MOUNT IS GONE (item 8 (c)).
          It was opened only by `handleCoachNoteAction`'s `update_injury` arm,
          which nothing called. The mount above — the Injured chip's, driven by
          `readinessInjuryVisible` — is a LIVE athlete door and stays; My Status
          opens its own through `useCoachNoteActions`. */}

      {/*
        UNDO'S ONLY SCREEN-LEVEL AFFORDANCE (ruled 2026-08-09).
        Mounted ONCE, at the screen root, and wired to nothing: it reads the
        decision ledger, so every door that lands a change raises it without
        knowing this component exists. That is why there is one mount here and
        no toast call at any of the ten program-control call sites.
      */}
      <UndoToast />
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
  /**
   * TRUE when this row is the day-first shape's single card.
   *
   * The row is one component drawn by two shapes, and rulings 2 and 5 are about
   * the DAY SCREEN only — her week list keeps its own today marker and its own
   * card treatment. Without this the eyebrow would appear on whichever row the
   * athlete had selected in the week view, on a day that may not be today.
   */
  dayShape?: boolean;
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

  if (kind === 'mobility') {
    return <LfaIcon name="mobility" color={iconColor} size={size} />;
  }

  if (kind === 'prehab') {
    return <LfaIcon name="medical-shield" color={iconColor} size={size} />;
  }

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
 * The day's LEADING bucket — what the glyph and the accent colour key on.
 *
 * Same `undefined`-tolerant wrapper shape as `cardLeadHeadline`, over the rule
 * stated once in `rules/visibleDayDetail.ts`. It exists because an icon table of
 * label EQUALITIES cannot match a compound name, and a row silently demoted to
 * the generic activity glyph tells the athlete less than it did before.
 */
function cardLeadIconKey(day: VisibleDay | undefined): string | null {
  if (!day) return null;
  return visibleDayLeadBucket(day);
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

interface WeekDayCardHeaderProps {
  day: any;
  title: string | null;
  titleIcon: RowIconKind;
  accentColor: string;
  hasWorkout: boolean;
  isGame: boolean;
  isCompleted: boolean;
  isMoveSource: boolean;
  isMoveTarget: boolean;
  pickerMode: 'normal' | 'moveGame' | 'addGame';
  rowCount: number;
  canExpand: boolean;
  isExpanded: boolean;
  compactStatus: boolean;
  dayToken: string;
}

/**
 * HER WEEK CARD, HIS LIVE DAY.
 *
 * Sam chose the prototype's card structure for ALL SEVEN days on 2026-08-11:
 * the date column, program-category chip, session title, exercise total and
 * open chevron. Today is this same component with its marker inside the date
 * column; opening a card changes only the details below it, never its head.
 *
 * This component deliberately owns HEAD STRUCTURE only. `DayRow` still owns the
 * card, state leaves and the one shared `DayTimeline`, so this layout cannot
 * grow a second account of what the day contains.
 */
function WeekDayCardHeader({
  day,
  title,
  titleIcon,
  accentColor,
  hasWorkout,
  isGame,
  isCompleted,
  isMoveSource,
  isMoveTarget,
  pickerMode,
  rowCount,
  canExpand,
  isExpanded,
  compactStatus,
  dayToken,
}: WeekDayCardHeaderProps) {
  // Rest and fixtures are status rows, not empty training rows. Only reserve
  // the category tier when the row can actually render one; otherwise that
  // invisible line makes these two cards look needlessly tall.
  const showsCategory = isMoveSource
    || (!isGame && hasWorkout && Boolean(day.workout?.sessionTier))
    || isCompleted;

  return (
    <View
      style={[styles.weekCardHeader, compactStatus && styles.weekCardHeaderCompact]}
      testID={`day-row-${dayToken}-card-header`}
    >
      <View style={[
        styles.weekCardDateColumn,
        compactStatus && styles.weekCardDateColumnCompact,
      ]}>
        <Text style={[styles.dayLabel, styles.weekCardWeekday,
          day.isToday && styles.weekStripDayToday]}>
          {day.short}
        </Text>
        <Text style={[styles.workoutTitleSelected, styles.weekCardDateNumeral]}>
          {dayOfMonthLabel(day.date)}
        </Text>
        {day.isToday ? (
          <Badge label="Today" tone="accent" size="xxs" testID="day-week-today-pill" />
        ) : null}
      </View>

      <View style={styles.weekCardDivider} />

      <View style={[styles.weekCardMain, compactStatus && styles.weekCardMainCompact]}>
        {showsCategory ? (
          <View style={styles.weekCardCategoryRow}>
            {isMoveSource ? (
              <Badge label="Moving" tone="outline" size="xxs" />
            ) : isGame ? (
              null
            ) : hasWorkout && day.workout.sessionTier ? (
              <SessionTierBadge compact tier={day.workout.sessionTier} />
            ) : null}
            {isCompleted ? <Badge label="Done" tone="success" size="xxs" /> : null}
          </View>
        ) : null}

        <View style={styles.weekCardTitleLine}>
          <RowIcon kind={titleIcon} size={15} color={accentColor} />
          <Text
            style={[styles.weekCardTitle,
              !hasWorkout && styles.weekCardRestTitle,
              isMoveSource && { opacity: 0.4 }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
        </View>

        {isMoveTarget ? (
          <Text style={[styles.moveTargetLabel, styles.weekCardPickerLabel]}>
            {pickerMode === 'addGame' ? 'Tap to set game' : 'Tap to move here'}
          </Text>
        ) : rowCount > 0 ? (
          <Text style={styles.weekCardMeta} testID={`day-row-${dayToken}-count`}>
            {signedCopy(
              rowCount === 1 ? 'day.part.exercise_count_one' : 'day.part.exercise_count',
              { count: rowCount },
            )}
          </Text>
        ) : null}
      </View>

      {canExpand ? (
        <Svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8A8A8A"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={[styles.weekCardChevron, isExpanded && styles.weekCardChevronOpen]}
        >
          <Path d="M7 10l5 5 5-5" />
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * One day, rendered through the day card or the week card boundary.
 *
 * The week head is invariant under selection: tapping changes only whether the
 * shared details render below it. Today is highlighted by date identity, not by
 * being swapped into the day screen's hero/action layout.
 */
function DayRow({
  day, visibleDay, isSelected, isMoveSource, isMoveTarget, pickerMode,
  hasWorkout, isGame, normal, onPress, onViewWorkout, onFinishTeam,
  onLogGame, onGameDayActions, onMakeChange, staleWarning,
  feedbackReceipts, progressionReceipts, timeline, dayShape = false,
}: DayRowProps) {
  const emphasized = isSelected && normal;
  const showRowBadges = emphasized;
  // THE CARD'S ONE SOURCE OF WORDS — the projection, not the workout, and now
  // exactly ONE word. `cardLeadHeadline` gives the day's BUCKET (Strength,
  // Conditioning, Mobility, Gunshow, Accessories, Speed) for a training day,
  // `day.headline` for rest and — deliberately, not merely "zero parts" — for
  // every fixture. It is `SignedCopy`, so this can only ever render an
  // authored string, and it is the only string this row shows about the work.
  const title: string | null = cardLeadHeadline(visibleDay);
  // THE GLYPH AND THE COLOUR KEY ON THE LEADING BUCKET, NOT ON THE TITLE, and
  // that is not a preference — it is what stops this ruling breaking them.
  // Both resolve by matching the day's name against a table of label
  // EQUALITIES ("strength", "upper push", "gunshow"), so a joined name like
  // "Strength + Team Training" matches nothing and the row falls through to the
  // grey generic. `cardLeadIconKey` is the day's FIRST bucket — byte-for-byte
  // what `cardLeadHeadline` returned before the compound ruling — so no glyph
  // and no colour moves on any day. See `visibleDayLeadBucket`.
  const iconKey: string | null = cardLeadIconKey(visibleDay);
  const accentColor = getDayRowAccentColor({
    hasWorkout,
    isGame,
    sessionTier: day.workout?.sessionTier,
    title: iconKey,
  });
  // THE SECONDARY "+ X" LINE IS GONE, BOTH SHAPES (Sam, 2026-08-08). It read
  // "+ Conditioning" under a title of "Upper Push", and then the timeline inside
  // the same card listed "Upper Push" and "Conditioning" again. THE TIMELINE IS
  // THE ENUMERATION: the card names the day's BUCKET once, and the parts are
  // listed once, below it. His ruling for the zoomed-out shape is the same
  // sentence — "bucket words only on the week view rows" — so the line is
  // deleted rather than kept for the shape that has no timeline.
  //
  // DELETED, NOT DISABLED. Nothing in this file joins part names with "+" any
  // more; that composition was the last place a surface here made a name out of
  // other names, which is what "no surface composes its own words" forbids.
  const titleIcon = titleIconKind({ hasWorkout, isGame, title: iconKey, workout: day.workout });
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
  // and saved feedback — the day is complete. Drives the read-only completed
  // CTA (WORKOUT_2026-07-21 row 2.1 / GROUPB finding 1: the
  // saved outcome was persisted but never surfaced back to the card).
  const isCompleted = hasWorkout && feedbackReceipts.length > 0;
  // ── RULING 5: THE "TODAY" BADGE GOES FROM THE DAY SCREEN ──
  //
  // Sam, 2026-08-10, on his own screen next to hers: *"the today badge is still
  // there but the 'todays session' part has not been changed yet"*. Hers has no
  // badge because the eyebrow already says it, and two things saying "today" is
  // what the ruling removed.
  //
  // **IT IS RE-HOMED, NOT DELETED, AND THE LEDGER ROW IS THE EYEBROW BELOW.**
  // The same fact moves from a badge to words — "TODAY'S SESSION - MON 10/8" —
  // in this same commit, which is Sam's binding line that a removal ships the
  // same day its replacement does.
  //
  // **IT SURVIVES IN THE WEEK LIST, AND THAT IS NOT AN OVERSIGHT.** Her week
  // view marks today's card too; the badge his ruling removed was the DAY
  // screen's. `showTodayEyebrow` is the exact condition under which the eyebrow
  // replaces it, so the badge is gone precisely where the words arrive and
  // nowhere else — the surface never loses the fact.
  const showTodayEyebrow = dayShape && emphasized && day.isToday;
  const rowBadges = (
    <>
      {showRowBadges && day.isToday && !showTodayEyebrow
        && <Badge label="Today" tone="accent" testID="day-today-badge" />}
      {isMoveSource
        ? <Badge label="Moving" tone="outline" />
        : showRowBadges && hasWorkout && isGame
          ? <GameBadge />
          : showRowBadges && hasWorkout && day.workout.sessionTier
            ? <SessionTierBadge compact={dayShape} tier={day.workout.sessionTier} />
            : null}
    </>
  );
  // Always `title` now — no `hasWorkout` branch, no hardcoded "Rest"
  // literal. A rest day's `title` is already "Rest Day" (via `day.headline`,
  // the zero-parts fallback above); a training day's is its first part.
  const selectedTitle = title;
  // THE DAY'S EXERCISE TOTAL, DERIVED FROM THE SAME PROJECTION THE ROW OPENS
  // ONTO. Not a stored number and not a second read: `visibleDay.parts` is what
  // `dayTimeline` enumerates, so the head's count and the opened list are one
  // fact. `0` for a rest day, a fixture, or a team-only night — all of which
  // have nothing to open, which is why the count and the chevron agree.
  const rowCount = (visibleDay?.parts ?? []).reduce(
    (total, part) => total + part.rows.length, 0);
  const dayToken = dayOfWeekTestIdToken(day.dayOfWeek);
  const stateToken = dayStateToken({ day, isSelected, isMoveSource, isMoveTarget });
  const canExpand = normal && hasWorkout && !isGame && rowCount > 0;
  const compactWeekStatus = !dayShape && normal && (isGame || !hasWorkout) && !isMoveTarget;
  const exposesNestedControls = isSelected && normal && (dayShape || canExpand);
  const cardCanPress = dayShape || pickerMode !== 'normal' || canExpand;

  const dayCardHeader = (
    <View style={styles.selectedHeader}>
      <View style={styles.selectedMetaRow}>
        {showTodayEyebrow ? (
          /* THE EYEBROW — ruling 5's replacement for the badge. */
          <Text style={styles.dayEyebrow} testID="day-card-eyebrow">
            {signedCopy('day.card.eyebrow.today')}
            {signedCopy('day.card.eyebrow.date_separator')}
            {day.short} {shortDayMonthLabel(day.date)}
          </Text>
        ) : (
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
        )}
        <View style={styles.selectedBadgeCluster}>{rowBadges}</View>
      </View>

      <View style={styles.selectedTitleBlock}>
        <View style={styles.selectedTitleLine}>
          <Text
            style={[
              hasWorkout ? styles.workoutTitle : styles.restLabel,
              hasWorkout ? styles.workoutTitleSelected : styles.restLabelSelected,
              styles.selectedWorkoutTitle,
              isMoveSource && { opacity: 0.4 },
            ]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {selectedTitle}
          </Text>
        </View>
      </View>
    </View>
  );

  const weekCardHeader = (
    <WeekDayCardHeader
      day={day}
      title={title}
      titleIcon={titleIcon}
      accentColor={accentColor}
      hasWorkout={hasWorkout}
      isGame={isGame}
      isCompleted={isCompleted}
      isMoveSource={isMoveSource}
      isMoveTarget={isMoveTarget}
      pickerMode={pickerMode}
      rowCount={rowCount}
      canExpand={canExpand}
      isExpanded={isSelected && normal}
      compactStatus={compactWeekStatus}
      dayToken={dayToken}
    />
  );

  return (
    <Card
      tone="default"
      selected={normal && (dayShape ? isSelected : day.isToday)}
      padding="none"
      radius="lg"
      onPress={cardCanPress ? onPress : undefined}
      testID={isMoveTarget
        ? explorerTestId.fixtureTarget(day.date)
        : `day-row-${dayToken}`}
      accessibilityLabel={`Day ${day.short ?? ''}${title ? ` ${title}` : ''}`}
      accessible={!exposesNestedControls}
      style={[
        styles.dayRow,
        !dayShape && styles.weekDayCard,
        !dayShape && compactWeekStatus && styles.weekDayCardCompact,
        isMoveSource && styles.dayRowMoveSource,
        isMoveTarget && styles.dayRowMoveTarget,
        dayShape && emphasized && styles.dayRowCalm,
      ]}
    >
      <DayStateLeaves
        day={day}
        feedbackReceipts={feedbackReceipts}
        progressionReceipts={progressionReceipts}
        stateToken={stateToken}
      />
      <View style={[
        styles.dayRowInner,
        dayShape && emphasized && styles.dayRowInnerSelected,
        !dayShape && styles.weekDayCardInner,
        !dayShape && compactWeekStatus && styles.weekDayCardInnerCompact,
      ]}>
        {dayShape ? dayCardHeader : weekCardHeader}

        {/* The WEEK card opens details only. Its head does not change shape and
            its session/change controls stay on the day screen, exactly as Sam
            chose from the signed prototype on 2026-08-11. */}
        {!dayShape && isSelected && hasWorkout && !isGame && normal && (
          <View style={styles.weekExpanded}>
            {staleWarning ? <StaleOverrideBanner warning={staleWarning} /> : null}
            {timeline}
          </View>
        )}

        {/* The DAY card keeps every live action the week cards deliberately do
            not carry. Same doors, same handlers, new structural boundary. */}
        {dayShape && isSelected && hasWorkout && !isGame && normal && (
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
                  <MaterialCommunityIcons
                    name="check"
                    size={15}
                    color="#5BD98A"
                    style={styles.rowIcon}
                  />
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
                <Button label="Start Session" size="md" glow={false} onPress={onViewWorkout} testID="view-workout-button" />
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

      {dayShape && isSelected && isGame && normal && (
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
      {dayShape && isSelected && !hasWorkout && normal && (
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

interface LifeFactChipProps {
  readonly icon: React.ReactNode;
  /** One of the existing `*IconTint` styles. Omitted = the blue the busy row used. */
  readonly tint?: StyleProp<ViewStyle>;
  /** PROPOSED, unsigned, one Title Case word. See the row's call site. */
  readonly label: string;
  readonly onPress: () => void;
  readonly testID: string;
  readonly accessibilityLabel: string;
  /** The sentence the bar used to show, for anyone the one word is not enough for. */
  readonly accessibilityHint?: string;
}

/**
 * A LIFE-FACT CHIP — Sam's 2026-08-01 design, ruled 2026-08-08.
 *
 * ONE CHIP SHAPE, FIVE CALL SITES. Five copies of a round icon over a tiny
 * label is five places for a padding to drift and one place to forget an
 * accessibility label; the same argument that gave the day-first view one
 * `renderDayRow`. What differs between chips — the door, the glyph, the tint,
 * the word — is exactly what arrives as props, and nothing else can.
 *
 * IT OWNS NO DOOR OF ITS OWN. `onPress`, `testID` and `accessibilityLabel` come
 * from the call site unchanged from the bar this chip replaces, so the walker,
 * the explorer and the dev-e2e finder reach the same coordinates they always
 * did. A chip that minted its own testID from its label would have quietly
 * renamed five doors.
 */
function LifeFactChip({
  icon, tint, label, onPress, testID, accessibilityLabel, accessibilityHint,
}: LifeFactChipProps) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.lifeFactChip, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.lifeFactChipIcon, tint]}>{icon}</View>
      <Text style={styles.lifeFactChipLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
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
 * The component's one icon carries the saved outcome colour. `null` keeps its
 * ordinary kind colour: "not answered yet" and "skipped" are different facts
 * and the athlete said one of them. There is no second completion dot beside
 * the icon — Sam removed that duplicate marker on 2026-08-11.
 */
const TIMELINE_COMPLETION_COLOR: Readonly<Record<string, string>> = {
  full: '#5BD98A',
  partial: '#FFC247',
  skipped: '#5E6268',
};

interface DayTimelineProps {
  entries: readonly DayTimelineEntry[];
  /** Optional, non-load-bearing flow from the same owner the session screen uses. */
  mobilityFlow: MobilityPrehabFlow | null;
  onOpen: () => void;
  /** Today is interactive; Week reveals the complete session in one simple drop. */
  presentation: 'interactive' | 'flat';
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
function DayTimeline({ entries, mobilityFlow, onOpen, presentation }: DayTimelineProps) {
  // WHICH PARTS ARE OPEN — SCREEN STATE, AND IT IS NEVER PERSISTED.
  //
  // The north star's rule is "store only decisions, derive everything else", and
  // a drop-down being open is not a decision the athlete made about their
  // training — it is where their thumb is. Writing it would be new stored state
  // that is not an input, which the north star presumes wrong. It resets when
  // the screen does, and that is correct rather than a limitation.
  //
  // A SET, NOT A SINGLE `openPartId`: her prototype's rows are independent
  // checkboxes, and a day carrying strength AND conditioning is exactly the day
  // an athlete wants both open on. Keyed on `partId` for the same reason
  // `dayTimeline` is — `COMPONENT_TO_PART` is many-to-one, so two parts of one
  // kind must be able to open separately.
  const [openParts, setOpenParts] = useState<ReadonlySet<string>>(() => new Set<string>());
  if (entries.length === 0 && !mobilityFlow) return null;
  const toggle = (partId: string) => {
    setOpenParts((current) => {
      const next = new Set(current);
      if (next.has(partId)) next.delete(partId); else next.add(partId);
      return next;
    });
  };
  return (
    <View style={styles.timeline} testID="day-timeline">
      {mobilityFlow ? (
        presentation === 'flat' ? (
          <View
            style={styles.weekSessionSection}
            testID="day-timeline-rows-mobility-warmup"
          >
            <Text style={styles.weekSessionSectionTitle}>
              {signedCopy('day.part.mobility_warmup')}
            </Text>
            <View style={styles.weekSessionRows}>
              {mobilityFlow.movements.map(({ exercise }, rowIndex) => (
                <View key={exercise.id} style={styles.weekSessionExerciseRow}>
                  <Text style={styles.weekSessionExerciseNumber}>{rowIndex + 1}</Text>
                  <Text
                    style={styles.weekSessionExerciseName}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {exercise.name}
                  </Text>
                  <Text style={styles.weekSessionExercisePrescription}>
                    {mobilityFlowMovementDose(exercise)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View>
            <Pressable
              onPress={() => toggle('mobility-warmup')}
              testID="day-timeline-part-mobility-warmup"
              accessibilityRole="button"
              accessibilityState={{ expanded: openParts.has('mobility-warmup') }}
              accessibilityLabel={`${signedCopy('day.part.mobility_warmup')}, ${mobilityFlow.movementCount} movements`}
              style={({ pressed }) => [styles.timelineRow, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.timelineIconMarker}>
                <RowIcon kind="mobility" size={13} color={rowIconColor('mobility')} />
              </View>
              <View style={styles.timelinePartText}>
                <Text style={styles.timelineHeadline} numberOfLines={1}>
                  {signedCopy('day.part.mobility_warmup')}
                </Text>
                <Text style={styles.timelinePartMeta}>
                  {signedCopy(
                    mobilityFlow.movementCount === 1
                      ? 'day.part.exercise_count_one'
                      : 'day.part.exercise_count',
                    { count: mobilityFlow.movementCount },
                  )}
                </Text>
              </View>
              <TimelineChevron open={openParts.has('mobility-warmup')} />
            </Pressable>
            {openParts.has('mobility-warmup') ? (
              <View style={styles.timelineRows} testID="day-timeline-rows-mobility-warmup">
                {mobilityFlow.movements.map(({ exercise }) => (
                  <View key={exercise.id} style={styles.timelineExerciseRow}>
                    <Text
                      style={styles.timelineExerciseName}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {exercise.name}
                    </Text>
                    <Text style={styles.timelineExercisePrescription}>
                      {mobilityFlowMovementDose(exercise)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )
      ) : null}
      {entries.map((entry) => {
        const iconKind = PART_ICON_KIND[entry.kind];
        const completionColor = entry.completion
          ? TIMELINE_COMPLETION_COLOR[entry.completion]
          : null;
        const isOpen = openParts.has(entry.partId);
        // A PART WITH NO ROWS HAS NOTHING TO OPEN, and it does not pretend to.
        // Her own week view carries the same rule — rest and game days render as
        // a single line with no chevron — and it is worth taking as a rule
        // rather than as styling: an affordance that opens onto nothing teaches
        // the athlete the affordance is a lie. Team-training and game parts are
        // the real cases here; they carry no exercise rows by construction.
        const canOpen = entry.rows.length > 0;
        // `derived_number`: the template is the sheet's, the count is the part's
        // own row count. Never composed here — see `day.part.exercise_count`.
        const meta = canOpen
          ? signedCopy(
            entry.rows.length === 1 ? 'day.part.exercise_count_one' : 'day.part.exercise_count',
            { count: entry.rows.length },
          )
          : null;
        if (presentation === 'flat') {
          if (!canOpen) return null;
          return (
            <View
              key={entry.partId}
              style={styles.weekSessionSection}
              testID={`day-timeline-rows-${entry.componentId}`}
            >
              <Text style={styles.weekSessionSectionTitle}>{entry.headline}</Text>
              <View style={styles.weekSessionRows}>
                {entry.rows.map((row, rowIndex) => (
                  <View key={row.id} style={styles.weekSessionExerciseRow}>
                    <Text style={styles.weekSessionExerciseNumber}>{rowIndex + 1}</Text>
                    <Text
                      style={styles.weekSessionExerciseName}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {row.name}
                    </Text>
                    <Text style={styles.weekSessionExercisePrescription}>
                      {row.prescription}
                    </Text>
                  </View>
                ))}
              </View>
              {entry.completion ? (
                <ExplorerRenderWitness
                  testID={`day-timeline-complete-${entry.componentId}-${entry.completion}`}
                />
              ) : null}
            </View>
          );
        }
        return (
          <View key={entry.partId}>
            <Pressable
              onPress={() => (canOpen ? toggle(entry.partId) : onOpen())}
              testID={`day-timeline-part-${entry.componentId}`}
              accessibilityRole="button"
              accessibilityState={canOpen ? { expanded: isOpen } : undefined}
              accessibilityLabel={`${entry.headline}${
                entry.completion ? ` — ${entry.completion}` : ''}`}
              style={({ pressed }) => [styles.timelineRow, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.timelineIconMarker}>
                <RowIcon
                  kind={iconKind}
                  size={13}
                  color={completionColor ?? rowIconColor(iconKind)}
                />
              </View>
              <View style={styles.timelinePartText}>
                {/* THE CAPS ARE A STYLE, NOT THE STRING. `entry.headline` is
                    `SignedCopy` and the sheet keeps its own casing ("Upper
                    Push"); `textTransform` is presentation, which is where her
                    structure is allowed to reach. The eyebrow above is the
                    opposite case and deliberately so — Sam signed THAT one in
                    caps, so there the caps ARE the string. */}
                <Text
                  style={styles.timelineHeadline}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {entry.headline}
                </Text>
                {meta ? <Text style={styles.timelinePartMeta}>{meta}</Text> : null}
              </View>
              {canOpen ? <TimelineChevron open={isOpen} /> : null}
              {entry.completion ? (
                <ExplorerRenderWitness
                  testID={`day-timeline-complete-${entry.componentId}-${entry.completion}`}
                />
              ) : null}
            </Pressable>
            {canOpen && isOpen ? (
              <View
                style={styles.timelineRows}
                testID={`day-timeline-rows-${entry.componentId}`}
              >
                {entry.rows.map((row) => (
                  <View key={row.id} style={styles.timelineExerciseRow}>
                    <Text
                      style={styles.timelineExerciseName}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {row.name}
                    </Text>
                    <Text style={styles.timelineExercisePrescription}>
                      {row.prescription}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** The drop-down's affordance. Rotates rather than swapping glyph, so open and
 *  closed are visibly the same control in two states. */
function TimelineChevron({ open }: { open: boolean }) {
  return (
    <View style={open ? styles.timelineChevronOpen : undefined} pointerEvents="none">
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
        stroke="#8A8A8A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M6 9l6 6 6-6" />
      </Svg>
    </View>
  );
}

/* THE MODIFIER CONFIRMATION SHEET MOVED OUT 2026-08-12 (SEAT_INBOX item 8).
 * It lives in `components/CoachNoteSheet` because My Status now opens it for
 * five of its eight controls, and a second copy on the coach side would be a
 * second door for a decision that already has one. This screen still MOUNTS it
 * until step (c) removes the Program-side coach-note leftovers. */


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
        <MissedChip testID="missed-session-did-it" label="Did it" primary onPress={() => onRespond('did_it')} />
        <MissedChip testID="missed-session-skipped-it" label="Skipped it" onPress={() => onRespond('skipped_it')} />
        <MissedChip testID="missed-session-move-forward" label="Move it forward" onPress={() => onRespond('move_forward')} />
      </View>
    </Card>
  );
}

function MissedChip({ testID, label, primary, onPress }: {
  testID: string;
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={label}
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
  initialBucket: 'flat' | 'sick';
  active: { id: string; isRecovery: boolean; title: string; scope: 'today' | 'week' } | null;
  acknowledgment: ReadinessAcknowledgment | null;
  lighterDayOffer: { date: string; factId?: string } | null;
  lighterDayBusy: boolean;
  onClose: () => void;
  onApply: (kind: WeekReadinessAction) => void | Promise<void>;
  onAcceptLighterDay: (date: string) => void | Promise<void>;
  onDeclineLighterDay: () => void;
  onClear: (modifierId: string) => void | Promise<void>;
}

/**
 * Weekly readiness sheet — simple tap options, no chat. Reuses today's
 * readiness signal and the existing viewed-week fatigue modifiers.
 */
function WeekReadinessSheet({
  visible,
  initialBucket,
  active,
  acknowledgment,
  lighterDayOffer,
  lighterDayBusy,
  onClose,
  onApply: onApplyProp,
  onAcceptLighterDay,
  onDeclineLighterDay,
  onClear,
}: WeekReadinessSheetProps) {
  const [updating, setUpdating] = useState(false);
  // A2: whether the athlete JUST reported something in this visit, as opposed to
  // arriving with something already active. Without it, `active` carried both
  // meanings and the manage view ("Update" / "Clear adjustment") was the
  // fallthrough for any non-null `active` — so confirming "Properly sick"
  // immediately offered to clear it. Sam's ruling: right after confirming, show
  // the disclosure and a way out, nothing else.
  const [confirmed, setConfirmed] = useState(false);
  // The chip owns the first decision. The sheet owns only the selected group's
  // direct severity leaves.
  const [bucket, setBucket] = useState<'flat' | 'sick'>(initialBucket);

  React.useEffect(() => {
    if (visible) { setUpdating(false); setConfirmed(false); setBucket(initialBucket); }
  }, [initialBucket, visible]);
  React.useEffect(() => {
    if (updating) setBucket(initialBucket);
  }, [initialBucket, updating]);

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
  const sickIcon = (color: string) => <LfaIcon name="sick" color={color} />;
  const moonIcon = (color: string) => svg(color, <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />);
  const dropletIcon = (color: string) => <LfaIcon name="mild-illness" color={color} />;
  // The middle severity is an honest moderate fatigue fact (`not_right`), not
  // a sleep or soreness fact borrowed to create a visual step in the ladder.
  // Its half battery is deliberately distinct from the cooked state below.
  const flatTodayIcon = (color: string) => <LfaIcon name="half-energy" color={color} />;
  const cookedIcon = (color: string) => <LfaIcon name="totally-cooked" color={color} />;
  // Illness severity uses faces rather than the misleading hydration droplet /
  // generic bed pair.
  const bedIcon = (color: string) => <LfaIcon name="severe-illness" color={color} />;
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

      {showOptions && bucket === 'flat' && (
        <View>
          <Text style={styles.sheetTitle}>Feeling flat — what's closest?</Text>
          <SheetOption
            label="Bit tired today"
            testID={explorerTestId.readinessOption('tired_today')}
            icon={moonIcon('#67D7FF')}
            onPress={() => onApply('tired_today')}
          />
          <SheetOption
            label="Pretty flat"
            testID={explorerTestId.readinessOption('flat_today')}
            icon={flatTodayIcon('#FFC247')}
            onPress={() => onApply('flat_today')}
          />
          <SheetOption
            label="Totally cooked"
            testID={explorerTestId.readinessOption('cooked_week')}
            accent
            icon={cookedIcon('#FF7F7F')}
            onPress={() => onApply('cooked_week')}
          />
          <Button label="Cancel" variant="secondary" size="md" onPress={onClose} style={{ marginTop: spacing.md }} />
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
          <Button label="Cancel" variant="secondary" size="md" onPress={onClose} style={{ marginTop: spacing.md }} />
        </View>
      )}
    </Sheet>
  );
}

/**
 * THE AWAY FLOW — SEAT_INBOX ITEM 28, RULED BY SAM ON 2026-08-13.
 *
 * **His words are the spec:** *"I think the away button should live on the
 * weekly screen, it should say 'when do you leave?' then 'when do you return'
 * thhe leave button should be limited to that week in dates, but the return
 * date can be any date in the future / then you are asked about the equipment
 * stuff"*.
 *
 * THREE QUESTIONS, ONE AT A TIME, AND THE THIRD IS NOT ASKED HERE. Leave and
 * return are dates; "do you have your normal equipment?" is a yes/no whose NO
 * hands the span to `EquipmentLimitationSheet` — the door Sam named, already
 * built, already asking exactly the right question (*"the athlete just removes
 * the equipment they don't have while on the trip"*). This sheet does not own a
 * second equipment menu and must never grow one.
 *
 * WHAT IT REPLACES, AND WHY THAT IS THE BIGGER FIX. The sheet that stood here
 * asked "Which days are you away?" and toggled individual TRAINING days inside
 * the visible week. A trip that crossed a Sunday could not be expressed at all
 * — "away for ten days" was unsayable. The return date is unbounded precisely
 * so that it can be.
 *
 * THE TWO BOUNDS ARE HIS, NOT A DESIGN CHOICE: leave is limited to the week on
 * screen (the athlete is looking at that week; a trip starting three months out
 * is not a thing this control is for), and return is any future date.
 */
type AwayAnswer = {
  leaveISO: string;
  returnISO: string;
  hasNormalEquipment: boolean;
};
interface AwaySheetProps {
  visible: boolean;
  weekDays: any[];
  onClose: () => void;
  onDone: (answer: AwayAnswer) => void;
}
function AwaySheet({ visible, weekDays, onClose, onDone }: AwaySheetProps) {
  const [leaveISO, setLeaveISO] = useState<string | null>(null);
  const [returnISO, setReturnISO] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible) { setLeaveISO(null); setReturnISO(null); }
  }, [visible]);

  const todayISO = todayISOLocal();
  // LEAVING IS BOUNDED BY THE WEEK ON SCREEN — Sam: *"limited to that week in
  // dates"*. Every day of it, not only training days: a trip starts when it
  // starts, and the old sheet's training-days-only list is exactly why a
  // Saturday departure could not be said.
  const leaveCandidates = weekDays
    .map((day) => day.date as string)
    .filter((date) => date >= todayISO);

  const step: 'leave' | 'return' | 'equipment' =
    leaveISO === null ? 'leave' : returnISO === null ? 'return' : 'equipment';

  return (
    <Sheet visible={visible} onClose={onClose} testID="home-away-sheet">
      <View>
        {step === 'leave' && (
          <>
            <Text style={styles.sheetTitle}>When do you leave?</Text>
            {leaveCandidates.length === 0 ? (
              <Text style={styles.busyAwayEmpty} testID="home-away-leave-empty">
                This week is already behind you. Move to next week to set a trip.
              </Text>
            ) : leaveCandidates.map((date) => (
              <Pressable
                key={date}
                onPress={() => setLeaveISO(date)}
                testID={`home-away-leave-${dayOfWeekTestIdToken(dayOfWeekForISODate(date))}`}
                accessibilityRole="button"
                accessibilityLabel={shortDayMonthLabel(date)}
                style={({ pressed }) => [styles.awayDayRow, pressed && { opacity: 0.75 }]}
              >
                <Text style={styles.awayDayText}>{shortDayMonthLabel(date)}</Text>
              </Pressable>
            ))}
          </>
        )}

        {step === 'return' && leaveISO !== null && (
          <>
            <Text style={styles.sheetTitle}>When do you return?</Text>
            <Text style={styles.busyAwayEmpty}>
              Leaving {shortDayMonthLabel(leaveISO)}. Pick any day — it can be
              weeks away.
            </Text>
            <AwayReturnCalendar
              minISO={addDaysISO(leaveISO, 1)}
              onPick={setReturnISO}
            />
            <Button
              label="Back"
              variant="secondary"
              size="md"
              onPress={() => setLeaveISO(null)}
              style={{ marginTop: spacing.sm }}
            />
          </>
        )}

        {step === 'equipment' && leaveISO !== null && returnISO !== null && (
          <>
            <Text style={styles.sheetTitle}>Do you have your normal equipment?</Text>
            <Text style={styles.busyAwayEmpty}>
              Away {shortDayMonthLabel(leaveISO)} to {shortDayMonthLabel(returnISO)}.
            </Text>
            {/* YES IS A REAL ANSWER AND IT STORES NOTHING. Sam: *"if yes, follow
                same program"*. */}
            <Button
              label="Yes, same as usual"
              size="lg"
              glow={false}
              testID="home-away-equipment-yes"
              onPress={() => onDone({ leaveISO, returnISO, hasNormalEquipment: true })}
              style={{ marginTop: spacing.md }}
            />
            <Button
              label="No, I'll be without some gear"
              variant="secondary"
              size="lg"
              testID="home-away-equipment-no"
              onPress={() => onDone({ leaveISO, returnISO, hasNormalEquipment: false })}
              style={{ marginTop: spacing.sm }}
            />
            <Button
              label="Back"
              variant="secondary"
              size="md"
              onPress={() => setReturnISO(null)}
              style={{ marginTop: spacing.sm }}
            />
          </>
        )}

        <Button label="Cancel" variant="secondary" size="md" onPress={onClose} style={{ marginTop: spacing.sm }} />
      </View>
    </Sheet>
  );
}

/**
 * THE RETURN DATE HAS NO CEILING, SO IT CANNOT BE A LIST OF CHIPS.
 *
 * Sam: *"the return date can be any date in the future"*. A month grid with no
 * forward stop is the only shape that answers that honestly; a "next 14 days"
 * row would quietly reintroduce the bound this whole item exists to remove.
 * There is no date-picker dependency in this app, and this is the one screen
 * that needs one, so it is built from the same primitives as everything else.
 */
function AwayReturnCalendar({
  minISO,
  onPick,
}: {
  minISO: string;
  onPick: (dateISO: string) => void;
}) {
  const [monthAnchorISO, setMonthAnchorISO] = useState(minISO);
  const anchor = monthAnchorISO.slice(0, 10);
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7));
  const firstOfMonth = `${anchor.slice(0, 7)}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // Monday-first, matching every other week shape in this app.
  const leadingBlanks = (dayOfWeekForISODate(firstOfMonth) + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_unused, index) =>
      `${anchor.slice(0, 7)}-${String(index + 1).padStart(2, '0')}`),
  ];

  return (
    <View testID="home-away-return-calendar">
      <View style={styles.awayCalendarHead}>
        <Pressable
          onPress={() => setMonthAnchorISO(addDaysISO(firstOfMonth, -1))}
          testID="home-away-return-prev-month"
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          style={({ pressed }) => [styles.awayCalendarNav, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.awayCalendarNavLabel}>‹</Text>
        </Pressable>
        <Text style={styles.awayCalendarMonth}>
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        <Pressable
          onPress={() => setMonthAnchorISO(addDaysISO(`${anchor.slice(0, 7)}-${String(daysInMonth).padStart(2, '0')}`, 1))}
          testID="home-away-return-next-month"
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={({ pressed }) => [styles.awayCalendarNav, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.awayCalendarNavLabel}>›</Text>
        </Pressable>
      </View>
      <View style={styles.awayCalendarGrid}>
        {WEEK_DAYS.map((day) => (
          <View key={`head-${day}`} style={styles.awayCalendarCell}>
            <Text style={styles.awayCalendarWeekday}>{DAY_SHORT[day]}</Text>
          </View>
        ))}
        {cells.map((dateISO, index) => {
          if (dateISO === null) {
            return <View key={`blank-${index}`} style={styles.awayCalendarCell} />;
          }
          const selectable = dateISO >= minISO;
          return (
            <Pressable
              key={dateISO}
              disabled={!selectable}
              onPress={() => onPick(dateISO)}
              testID={`home-away-return-${dateISO}`}
              accessibilityRole="button"
              accessibilityLabel={shortDayMonthLabel(dateISO)}
              style={({ pressed }) => [
                styles.awayCalendarCell,
                pressed && selectable && { opacity: 0.6 },
              ]}
            >
              <Text style={[
                styles.awayCalendarDay,
                !selectable && styles.awayCalendarDayDisabled,
              ]}>
                {Number(dateISO.slice(8, 10))}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* THE REBUILD SHEET MOVED OUT 2026-08-12 (SEAT_INBOX item 8) to
 * `components/RebuildSheet`. Coach / My Status can now cause a rebuild — four
 * modifier families ask for one when cleared — and an athlete watching nothing
 * happen for the seconds a regeneration takes is a control that works and says
 * so to nobody. One progress surface, both screens. */

/* THE SEASON-PHASE SHIFT SHEET MOVED OUT 2026-08-12 (SEAT_INBOX item 15).
 * Its surface has been on the Coach tab since the merge; the implementation
 * finally followed it to `components/SeasonPhaseShiftSheet`, and the six-line
 * re-export bridge that stood in for the move is gone. */


// ───────── Styles ─────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0C0C0C' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },

  // Program shape controls. Day pays only for the toggle. Week adds this
  // compact navigation row underneath it, matching the accepted hierarchy
  // without shrinking the actual tap targets below a comfortable size.
  topBar: { marginBottom: spacing.md, gap: spacing.md },
  compactWeekNav: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  compactWeekNavButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactWeekNavButtonDisabled: {
    opacity: 0.25,
  },
  compactWeekNavCurrent: {
    minWidth: 112,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactWeekNavLabel: {
    color: '#D2D2D2',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },

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

  // THE FOUR `addGame*` RULES THAT STOOD HERE WENT WITH THEIR CARD
  // (SEAT_INBOX item 19, 2026-08-13). The in-season add-game card merged into
  // the one phase-labelled control, which reuses the `busyAway*` treatment, so
  // `addGame`, `addGameRow`, `addGameIcon` and `addGameText` lost their only
  // call site. DELETED IN THE SAME COMMIT AS THAT CALL SITE, and item 15 is why
  // it is spelled out: the style gate greps USAGE, so a definition nothing uses
  // passes it silently and sits there for a month. `mode.type === 'addGame'`
  // is a different thing entirely — that is the picker mode, and it stays.

  // ── The life-fact chip row ──
  // Five chips across, equal width, one gap. `justifyContent: space-between`
  // with flex:1 chips keeps them even on every phone width without a hard-coded
  // chip size — a fixed width would clip "Equipment" on a small screen and
  // strand the row short of the margins on a large one.
  lifeFactChips: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  lifeFactChip: { flex: 1, alignItems: 'center', gap: 6 },
  lifeFactChipIcon: {
    width: 48, height: 48, borderRadius: 24,
    // The blue the "Short on time today" bar carried; the other four chips
    // pass their own tint, so the controls keep the colours Sam already picked.
    backgroundColor: 'rgba(30, 167, 255, 0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  lifeFactChipLabel: {
    color: '#8A8F98', fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.2,
  },

  // Busy / away entry + missed-session prompt.
  // TIGHTENED md -> sm (Sam, 2026-08-08: "too many UI gaps"). Five of these
  // cards became the chip row above; the two or three that remain are answers
  // and refusals, and they read as a group rather than as separate screens.
  busyAwayEntry: { marginTop: spacing.sm },
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
  readinessIconTint: { backgroundColor: 'rgba(255, 202, 104, 0.12)' },
  tiredIconTint: { backgroundColor: 'rgba(103, 215, 255, 0.12)' },
  awayIconTint: { backgroundColor: 'rgba(185, 167, 255, 0.12)' },
  injuredIconTint: { backgroundColor: 'rgba(255, 127, 127, 0.12)' },
  scheduleAckError: { color: '#FF7A85' },
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
  awayDayText: { color: '#FFFFFF', fontSize: 15, fontWeight: '500', flex: 1 },

  // ── ITEM 28: THE RETURN-DATE CALENDAR ──
  // Seven columns, Monday first, same as every other week shape in the app.
  awayCalendarHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.sm, marginBottom: spacing.xs,
  },
  awayCalendarNav: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  awayCalendarNavLabel: { color: '#FFFFFF', fontSize: 22, lineHeight: 24 },
  awayCalendarMonth: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  awayCalendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  awayCalendarCell: {
    width: `${100 / 7}%`, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  awayCalendarWeekday: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600' },
  awayCalendarDay: { color: '#FFFFFF', fontSize: 15 },
  awayCalendarDayDisabled: { color: 'rgba(255,255,255,0.22)' },

  missedCard: { marginTop: spacing.sm },
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
    // TIGHTENED lg -> md (Sam, 2026-08-08). The section now follows the chip
    // row rather than opening the screen, so it needs separation, not a break.
    paddingTop: spacing.md,
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
  // Seven instances of one card structure. Selection opens details inside the
  // card; it does not replace the head or import the day screen's actions.
  dayList: { gap: spacing.sm, marginTop: spacing.sm },

  // THE WEEK'S ONE CARD SHAPE (Sam, 2026-08-11). Every day uses these layout
  // pieces; today differs only through Card's existing selected treatment and
  // the existing Today badge. No colour, typeface or icon system is introduced.
  weekDayCard: { minHeight: 86 },
  weekDayCardCompact: { minHeight: 58 },
  weekDayCardInner: { paddingHorizontal: 12, paddingVertical: 10 },
  weekDayCardInnerCompact: { paddingVertical: 5 },
  weekCardHeader: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  weekCardHeaderCompact: { minHeight: 46 },
  weekCardDateColumn: {
    width: 48,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  weekCardDateColumnCompact: { minHeight: 44 },
  weekCardWeekday: { minWidth: 0, textAlign: 'center', fontSize: 9, letterSpacing: 0.7 },
  weekCardDateNumeral: { textAlign: 'center', fontSize: 27, fontWeight: '700', lineHeight: 29 },
  weekCardDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  weekCardMain: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 4 },
  weekCardMainCompact: { alignSelf: 'stretch', justifyContent: 'center', gap: 0 },
  weekCardTitle: {
    color: '#F2F2F2', fontSize: 15, fontWeight: '700', lineHeight: 18,
    textAlign: 'left', flexShrink: 1,
  },
  weekCardRestTitle: { color: '#777B77', fontSize: 13, fontWeight: '600' },
  weekCardMeta: { color: '#8A8A8A', fontSize: 10, lineHeight: 13 },
  weekCardCategoryRow: {
    minHeight: 17,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  weekCardTitleLine: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weekCardPickerLabel: { textAlign: 'left' },
  weekCardChevron: { flexShrink: 0 },
  weekCardChevronOpen: { transform: [{ rotate: '180deg' }] },
  weekExpanded: {
    marginTop: 10,
    paddingTop: 10,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2F2F2F',
  },

  // ── Day-first view ──
  dayFirst: { gap: spacing.sm, marginTop: spacing.sm },
  // THE STATE-LEAF WELL — where the explorer's witnesses live so that LAYOUT
  // CANNOT SEE THEM. `position: 'absolute'` is the property doing the work: an
  // absolutely-positioned child is out of the flex flow, so `dayFirst`'s `gap`
  // is never inserted around it, at any witness count. The zero size and the
  // clip are belt-and-braces for the children themselves.
  //
  // ANY container that mounts `DayStateLeaves` and has a `gap` needs this. The
  // component returns a FRAGMENT, so without a wrapper its witnesses become
  // direct children of whatever mounts it, and a gapped parent then spaces the
  // invisible ones exactly as generously as the visible ones.
  stateLeafWell: { position: 'absolute', width: 0, height: 0, overflow: 'hidden' },
  viewToggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    width: 280,
    marginTop: spacing.sm,
    padding: 4,
    gap: 4,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  viewToggleOption: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: borderRadius.full,
  },
  viewToggleOptionActive: { backgroundColor: 'rgba(200,255,0,0.14)' },
  viewToggleLabel: { color: '#8A8F98', fontSize: 15, fontWeight: '700', letterSpacing: 0.4 },
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
  timelineRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  timelineIconMarker: { width: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  timelineHeadline: {
    color: '#E8EAED',
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '800',
    // CAPS ARE A STYLE HERE, NOT THE STRING — see the render site. The sheet
    // keeps "Lower Body Strength"; her drop-down rows read them upper.
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  // ── THE DROP-DOWNS (UI merge slice 2, Sam's eye pass 2026-08-10) ──
  // No new colour token, no new font size that is not already on this screen:
  // the part name keeps `timelineHeadline`'s size and colour, the meta line
  // reuses the muted grey and 12pt the day date already uses, and the
  // prescription reuses the accent-free `#A7A7A7` the coach-note body uses.
  timelinePartText: { flex: 1, gap: 1 },
  timelinePartMeta: { color: '#929692', fontSize: 10.5, lineHeight: 14, fontWeight: '500' },
  timelineChevronOpen: { transform: [{ rotate: '180deg' }] },
  // Indented to the part's own text column, so an exercise reads as belonging
  // to the row above it rather than as another part.
  timelineRows: { paddingLeft: 18 + spacing.sm, paddingBottom: 6, gap: 4 },
  timelineExerciseRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  timelineExerciseName: { flex: 1, color: '#C9CDD2', fontSize: 13, fontWeight: '500' },
  timelineExercisePrescription: { color: '#8A8A8A', fontSize: 13, fontVariant: ['tabular-nums'] },
  // THE WEEK'S ONE SIMPLE DROP (Sam, 2026-08-11). No inner toggles, rails or
  // icons: section heading, then every numbered exercise and its prescription.
  // `weekExpanded` already owns the top divider. This container deliberately
  // adds none, or the first section starts behind two horizontal rules.
  weekSessionSection: { minWidth: 0 },
  weekSessionSectionTitle: {
    color: '#9A9E9A', fontSize: 9, lineHeight: 12, fontWeight: '800',
    letterSpacing: 0.7, textTransform: 'uppercase', paddingVertical: 8,
  },
  weekSessionRows: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2F2F2F' },
  weekSessionExerciseRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2F2F2F',
  },
  weekSessionExerciseNumber: {
    width: 16, color: '#A7AAA7', fontSize: 11, lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
  weekSessionExerciseName: {
    flex: 1, color: '#E1E3E1', fontSize: 12, lineHeight: 15, fontWeight: '500',
  },
  weekSessionExercisePrescription: {
    color: '#E1E3E1', fontSize: 11, lineHeight: 14, fontVariant: ['tabular-nums'],
  },
  // ── THE DAY CARD'S EYEBROW (ruling 5) ──
  // Small, muted, letter-spaced — the same treatment `coachNotesTitle` gives an
  // eyebrow already, minus the lime, because ruling 2 spends the accent once.
  dayEyebrow: {
    color: '#989C98', fontSize: 10, lineHeight: 13, fontWeight: '700', letterSpacing: 0.75,
  },
  // ── THE CALM DAY CARD (ruling 2) ──
  // What it does NOT set is the point: no `borderColor`, no `shadow*`, no
  // `elevation`. A dark card on black, exactly as hers is.
  dayRowCalm: { backgroundColor: '#101010', borderColor: '#1F1F1F' },
  // ── THE CHANGE CARD (ruling 1) ──
  changeCard: { marginTop: spacing.md },
  changeCardHeading: { color: '#F5F5F5', fontSize: 15, fontWeight: '700' },
  changeCardSubline: { color: '#8A8A8A', fontSize: 13, lineHeight: 18, marginTop: 2 },

  dayRow: { position: 'relative' },
  // Tighter vertical rhythm — pulls the list into a scannable weekly
  // timeline instead of a column of spaced buttons.
  dayRowInner: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  // Selected row breathes: extra vertical padding lets the bigger type
  // and the expanded CTA block sit comfortably.
  dayRowInnerSelected: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  dayRowMoveSource: { opacity: 0.5, borderColor: 'rgba(200, 255, 0, 0.30)' },
  dayRowMoveTarget: {
    borderColor: 'rgba(200, 255, 0, 0.40)', backgroundColor: '#141814',
  },

  selectedHeader: {
    gap: 14,
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
  selectedWorkoutTitle: {
    textAlign: 'left',
    flexShrink: 1,
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
    color: '#FFFFFF', fontSize: 19, lineHeight: 23, fontWeight: '700', letterSpacing: -0.2,
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

  expanded: { marginTop: 20, gap: 12 },
  expandedMeta: { color: '#888888', fontSize: 13 },
  sessionCompleteLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sessionCompleteText: { color: '#5BD98A', fontSize: 13, fontWeight: '600' },

  // Tap-first change door (PlanChangeSheet trigger)
  makeChangeLink: { paddingVertical: 6, alignSelf: 'flex-start' },
  makeChangeText: { color: '#AEB0AE', fontSize: 12, lineHeight: 16, fontWeight: '500' },

  // Sections — larger rhythm between top-level blocks.
  // TIGHTENED xxl -> lg (Sam, 2026-08-08). 48pt above the phase card left a
  // band of empty screen between it and whatever ended above it.
  section: { paddingTop: spacing.lg, gap: spacing.md },

  /* THE PHASE-CARD STYLES ARE GONE — item 15 named `phaseCard`; there were
   * FOUR. `phaseCard`, `phaseBadge`, `phaseBody` and `phaseBodyAccent` all
   * measured ZERO uses repo-wide: the phase card left Program at the UI merge
   * and its styling stayed behind. The existing style gate greps USAGE, so a
   * definition nothing uses passes it — which is why these outlived the card by
   * a month and why the item had to name one by hand. */

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

  phaseOptions: { gap: 8, marginBottom: spacing.md },
  phaseOption: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#343834',
    backgroundColor: '#171A17',
  },
  phaseOptionSelected: {
    borderColor: '#7FA300',
    backgroundColor: '#1C2515',
  },
  phaseOptionLabel: { color: '#F0F0F0', fontSize: 15, fontWeight: '700' },
  phaseRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#646A64',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseRadioSelected: { borderColor: '#C8FF00', borderWidth: 3 },
  phaseRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#C8FF00',
  },

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
  // base / selected / pressed looks. Four 22% columns force a balanced 4 + 3
  // wrap on every seven-day phase question; the centred grid owns row balance.
  dayChip: {
    width: '22%', minWidth: 58, alignItems: 'center',
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
