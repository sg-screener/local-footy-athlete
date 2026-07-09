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
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../../components/common/Text';
import { SessionTierBadge } from '../../components/common/SessionTierBadge';
import { SelectableTile } from '../../components/common';
import { StaleOverrideBanner } from '../../components/StaleOverrideBanner';
import { Button, Card, Sheet, Badge, IconButton } from '../../components/ui';
import type { SeasonPhase, DayOfWeek } from '../../types/domain';
import { splitSessionName } from '../../utils/sessionNaming';
import { weeklyPlanTitle } from '../../utils/weeklyPlanDisplay';
import { isTeamTrainingOnlyWorkout } from '../../utils/teamTraining';
import { spacing, borderRadius } from '../../theme/spacing';
import { useHomeScreen, type WeekReadinessAction } from './useHomeScreen';
import type {
  ActiveCoachNote,
  ActiveCoachNoteAction,
} from '../../utils/activeCoachNotes';
import type { ProgramControlStatusUpdate } from '../../utils/programControlActions';
import { guidedInjuryResultFromConstraint } from '../../utils/guidedInjuryControl';
import type { ActiveInjuryConstraint } from '../../store/coachUpdatesStore';
import { shortDayMonthLabel, todayISOLocal } from '../../utils/appDate';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import {
  loadReductionModifierIdForDate,
  recoveryModeModifierIdForDate,
} from '../../utils/tapProgramModifiers';
import type { MissedSession, MissedSessionResponse } from '../../utils/missedSessions';
import {
  WEEK_DAYS,
  DAY_SHORT,
  NEXT_PHASE,
  getConditioningContextLabel,
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
    weekLabel,
    weekOffset,
    isThisWeek,
    handlePrev,
    handleNext,
    handleThisWeek,
    selectedIdx,
    mode,
    handleDayTap,
    handleSelectDayOnly,
    handleClearSelection,
    handleCancelMove,
    handleAddGameMode,
    handleViewWorkout,
    handleFinishTeamSession,
    handleMessageCoach,
    handleApplyGuidedInjury,
    handleApplyBusyWeekReduce,
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
    handleClearCoachNote,
    handleUpdateCoachNoteStatus,
    gameModalVisible,
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
    rebuildMsgIdx,
    rebuildMsgOpacity,
    handleOpenRebuild,
    handleCancelRebuild,
    handleConfirmRebuild,
    phaseShiftModalVisible,
    phaseShiftStep,
    pendingPreferredDays,
    pendingTeamDays,
    pendingGameDay,
    targetPhase,
    handleOpenPhaseShift,
    handleCancelPhaseShift,
    handlePhaseShiftBack,
    togglePendingPreferredDay,
    togglePendingTeamDay,
    setPendingGameDay,
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

  // ── Tap-first plan-change sheet (ATHLETE_CHANGE_VOCABULARY.md group 1) ──
  const [changeSheetDate, setChangeSheetDate] = useState<string | null>(null);
  const [coachNoteSheet, setCoachNoteSheet] = useState<{
    mode: 'clear' | 'update';
    note: ActiveCoachNote;
  } | null>(null);
  const [injuryFlowNote, setInjuryFlowNote] = useState<ActiveCoachNote | null>(null);
  const [busyAwayVisible, setBusyAwayVisible] = useState(false);

  // ── Weekly readiness ("I'm not 100%") — week-level card ──
  // Active state is derived from the EXISTING tap modifiers for the
  // currently selected week (ids are week-keyed by Monday).
  const [readinessVisible, setReadinessVisible] = useState(false);
  const [readinessInjuryVisible, setReadinessInjuryVisible] = useState(false);
  const weekAnchorISO = weekDays[0]?.date ?? todayISOLocal();
  const readinessActiveConstraints = useCoachUpdatesStore((s: any) => s.activeConstraints) ?? [];
  const weekReadiness = useMemo(() => {
    const todayISO = todayISOLocal();
    const ids = [
      recoveryModeModifierIdForDate(weekAnchorISO),
      loadReductionModifierIdForDate(weekAnchorISO),
    ];
    const match = readinessActiveConstraints.find((c: any) => {
      if (!ids.includes(c.id)) return false;
      const end = typeof c.expiresAt === 'string' ? c.expiresAt : undefined;
      return !(end && end < todayISO);
    });
    if (match) {
      return {
        id: match.id as string,
        isRecovery: match.id === ids[0],
        title: String(match.modifierTitle ?? match.reasonLabel ?? 'Readiness adjusted'),
        scope: 'week' as const,
      };
    }
    if (!isThisWeek || !todayReadinessModifier) return null;
    return {
      id: todayReadinessModifier.id,
      isRecovery: false,
      title: todayReadinessModifier.title,
      scope: 'today' as const,
    };
  }, [isThisWeek, readinessActiveConstraints, todayReadinessModifier, weekAnchorISO]);

  const handleCoachNoteAction = (
    note: ActiveCoachNote,
    action: ActiveCoachNoteAction,
  ) => {
    if (action.kind === 'update_injury') {
      setInjuryFlowNote(note);
      return;
    }
    setCoachNoteSheet({
      mode: action.kind.startsWith('clear') ? 'clear' : 'update',
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

  // Smoke harness no longer renders any controls in HomeScreen. The
  // coach-bike-flow regression now opens Wednesday's DayWorkout directly
  // from CoachScreen (see CoachScreen.handleSmokeOpenWednesdayWorkout),
  // so HomeScreen owns no smoke testIDs and produces no smoke logs.
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
          onPress={handleClearSelection}
          accessible={false}
        >
        {/* ── Week nav bar ── */}
        <View style={styles.topBar}>
          <View style={styles.topBarRow}>
            <IconButton
              onPress={handlePrev}
              accessibilityLabel="Previous week"
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
                icon={
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M9 18l6-6-6-6" />
                  </Svg>
                }
              />
              <IconButton
                onPress={handleOpenRebuild}
                accessibilityLabel="Rebuild this week"
                tone="accent"
                icon={
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M23 4v6h-6" />
                    <Path d="M1 20v-6h6" />
                    <Path d="M3.51 9a9 9 0 0114.85-3.36L23 10" />
                    <Path d="M20.49 15A9 9 0 015.64 18.36L1 14" />
                  </Svg>
                }
              />
            </View>
          </View>

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

        {/* ── Week list — all seven days, selected day carries the emphasis ── */}
        <View style={styles.dayList}>
          {weekDays.map((day, idx) => {
            const isSelected = idx === selectedIdx;
            const hasWorkout = !!day.workout;
            const isGame = day.workout?.workoutType === 'Game';
            const isMoveSource = mode.type === 'moveGame' && day.date === mode.fromDate;
            const isPickerMode = mode.type === 'moveGame' || mode.type === 'addGame';
            const isMoveTarget = isPickerMode && !isMoveSource;

            return (
              <DayRow
                key={day.date}
                day={day}
                isSelected={isSelected}
                isMoveSource={isMoveSource}
                isMoveTarget={isMoveTarget}
                pickerMode={mode.type}
                hasWorkout={hasWorkout}
                isGame={!!isGame}
                onPress={() =>
                  isGame && isNormal ? handleSelectDayOnly(idx) : handleDayTap(idx)}
                onViewWorkout={() => handleViewWorkout(day)}
                onFinishTeam={() => handleFinishTeamSession(day)}
                onLogGame={() => handleLogGame(day.date)}
                onGameDayActions={() => handleOpenGameDayActions(day.date)}
                onMakeChange={() => setChangeSheetDate(day.date)}
                staleWarning={staleByDate[day.date]}
                onReviewStale={handleMessageCoach}
                normal={isNormal}
              />
            );
          })}
        </View>

        <CoachNotesSection
          notes={coachNotes}
          onAction={handleCoachNoteAction}
        />

        {/* ── No game CTA ── */}
        {isNormal && currentPhase === 'In-season' && !weekHasGame && showAddGameCTA && (
          <Pressable onPress={handleAddGameMode} style={({ pressed }) => [pressed && { opacity: 0.75 }]}>
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

        {/* ── Busy / away this week ── */}
        {isNormal && (
          <Pressable
            onPress={() => setBusyAwayVisible(true)}
            style={({ pressed }) => [pressed && { opacity: 0.75 }]}
            testID="home-busy-away-entry"
          >
            <Card tone="default" padding="md" radius="lg" style={styles.busyAwayEntry}>
              <View style={styles.busyAwayRow}>
                <View style={styles.busyAwayIcon}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#1EA7FF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M12 2a10 10 0 100 20 10 10 0 000-20z" /><Path d="M12 6v6l4 2" />
                  </Svg>
                </View>
                <Text style={styles.busyAwayText}>Busy or away this week?</Text>
              </View>
            </Card>
          </Pressable>
        )}

        {/* ── Weekly readiness ("I'm not 100%") — all phases, week-level ── */}
        {isNormal && (
          <Pressable
            onPress={() => setReadinessVisible(true)}
            style={({ pressed }) => [pressed && { opacity: 0.75 }]}
            testID="home-week-readiness-entry"
          >
            <Card tone="default" padding="md" radius="lg" style={styles.busyAwayEntry}>
              <View style={styles.busyAwayRow}>
                <View style={[styles.busyAwayIcon, styles.readinessIconTint]}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#FF7A85" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M22 12h-4l-3 8-6-16-3 8H2" />
                  </Svg>
                </View>
                <Text style={styles.busyAwayText}>
                  {weekReadiness
                    ? (weekReadiness.scope === 'today'
                        ? 'Not 100% today'
                        : weekReadiness.isRecovery
                          ? 'Recovery mode this week'
                          : 'Not 100% this week')
                    : "I'm not 100%"}
                </Text>
              </View>
            </Card>
          </Pressable>
        )}

        {isNormal && showPracticeMatchCTA && (
          <Pressable
            onPress={handlePracticeMatchPress}
            style={({ pressed }) => [pressed && { opacity: 0.75 }]}
            testID="preseason-practice-match-entry"
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
        onAskCoach={handleMessageCoach}
      />

      <GameDaySheet
        visible={gameModalVisible}
        onClose={closeGameModal}
        label={gameModalLabel}
        onMove={handleMoveGameDay}
        onRemove={handleRemoveGameDay}
      />

      <WeekReadinessSheet
        visible={readinessVisible}
        active={weekReadiness}
        onClose={() => setReadinessVisible(false)}
        onApply={async (kind) => {
          await handleApplyWeekReadiness(kind, weekAnchorISO);
          setReadinessVisible(false);
        }}
        onClear={async (modifierId) => {
          await handleClearWeekReadiness(modifierId);
          setReadinessVisible(false);
        }}
        onInjury={() => {
          setReadinessVisible(false);
          setReadinessInjuryVisible(true);
        }}
        onShortTime={() => {
          setReadinessVisible(false);
          setBusyAwayVisible(true);
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

      <BusyAwaySheet
        visible={busyAwayVisible}
        weekDays={weekDays}
        onClose={() => setBusyAwayVisible(false)}
        onBusyReduce={async () => {
          await handleApplyBusyWeekReduce();
          setBusyAwayVisible(false);
        }}
        onAwayDays={async (dates) => {
          await handleApplyAwayDays(dates);
          setBusyAwayVisible(false);
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
        onClose={() => setCoachNoteSheet(null)}
        onConfirmClear={handleConfirmCoachNoteClear}
        onUpdateStatus={handleCoachNoteStatusUpdate}
      />

      <GuidedInjuryFlowSheet
        visible={injuryFlowNote !== null}
        onClose={() => setInjuryFlowNote(null)}
        initial={injuryFlowInitial}
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
        onClose={handleCancelPhaseShift}
        onBack={handlePhaseShiftBack}
        onTogglePendingPreferredDay={togglePendingPreferredDay}
        onTogglePendingTeamDay={togglePendingTeamDay}
        onSetPendingGameDay={setPendingGameDay}
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
  onReviewStale: (prefill: string) => void;
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

function conditioningIconKind(label: string | null | undefined): RowIconKind | null {
  switch (displayLabelKey(label)) {
    case 'aerobic base':
      return 'pulse';
    case 'flush out':
      return 'refresh';
    case 'sprint work':
      return 'bolt';
    case 'hard conditioning':
      return 'flame';
    default:
      return null;
  }
}

function displayLabelIconKind(label: string | null | undefined): RowIconKind | null {
  const key = displayLabelKey(label);
  const conditioningKind = conditioningIconKind(key);
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
 * Day row — one of seven identical rows in the week list.
 *
 * The SELECTED row (default: today, via useHomeScreen) is the screen's
 * emphasis carrier: slightly bigger weekday + title type, roomier
 * padding, accent surface, and the expanded CTA block (Start Session /
 * change door). Tapping another day moves the emphasis there —
 * selection IS the hierarchy, so no separate hero card exists.
 */
function DayRow({
  day, isSelected, isMoveSource, isMoveTarget, pickerMode,
  hasWorkout, isGame, normal, onPress, onViewWorkout, onFinishTeam,
  onLogGame, onGameDayActions, onMakeChange, staleWarning, onReviewStale,
}: DayRowProps) {
  const emphasized = isSelected && normal;
  const showRowBadges = emphasized;
  const rowTone = emphasized ? 'accent' : 'default';
  // Weekly plan speaks in categories: strength splits pass through
  // canonically, standalone conditioning reads as its category (Aerobic
  // Base / Flush Out / Sprint Work / Hard Conditioning), recovery days
  // read "Recovery". The real session name lives inside the day.
  const parsed = hasWorkout ? splitSessionName(day.workout.name) : null;
  const title = hasWorkout ? weeklyPlanTitle(day.workout) : null;
  const accentColor = getDayRowAccentColor({
    hasWorkout,
    isGame,
    sessionTier: day.workout?.sessionTier,
    title,
  });
  const ctx = suppressDuplicateWorkoutContext(title, parsed?.context);
  const conditioningContext = suppressDuplicateWorkoutContext(
    title,
    hasWorkout ? getConditioningContextLabel(day.workout) : null,
  );
  const contextLabel = ctx ?? (conditioningContext ? `+ ${conditioningContext}` : null);
  const isAttachedContextLine = contextLabel?.startsWith('+ ') ?? false;
  const titleIcon = titleIconKind({ hasWorkout, isGame, title, workout: day.workout });
  const contextIcon = contextIconKind(contextLabel);
  const isTeamOnly = hasWorkout && isTeamTrainingOnlyWorkout(day.workout);
  const isRecoverySession = hasWorkout && (
    day.workout.workoutType === 'Recovery' ||
    day.workout.sessionTier === 'recovery'
  );
  const rowBadges = (
    <>
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
  const selectedTitle = hasWorkout ? title : 'Rest';

  return (
    <Card
      tone={rowTone}
      selected={isSelected && normal}
      padding="none"
      radius="lg"
      onPress={onPress}
      testID={`day-row-${(day.short || '').toString().toLowerCase()}`}
      accessibilityLabel={`Day ${day.short ?? ''}${hasWorkout ? ` ${day.workout.name}` : ''}`}
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
                Rest
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
              onReview={(prefill) => onReviewStale(prefill)}
            />
          )}
          {isTeamOnly ? (
            <Button label="Log Session" size="lg" glow={false} onPress={onFinishTeam} />
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
        <StaleOverrideBanner warning={staleWarning} compact onReview={(p) => onReviewStale(p)} />
      )}

      {isSelected && isGame && normal && (
        <View style={styles.expanded}>
          <Text style={styles.expandedMeta}>Good luck!</Text>
          <Button
            label="Log Game"
            size="lg"
            glow={false}
            onPress={onLogGame}
            testID="log-game-button"
          />
          <Pressable
            onPress={onGameDayActions}
            style={({ pressed }) => [styles.makeChangeLink, pressed && { opacity: 0.7 }]}
            testID="move-remove-game-link"
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

interface CoachNotesSectionProps {
  notes: ActiveCoachNote[];
  onAction: (note: ActiveCoachNote, action: ActiveCoachNoteAction) => void;
}

function CoachNotesSection({ notes, onAction }: CoachNotesSectionProps) {
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
            testID={`program-active-coach-note-${note.constraintId}`}
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
                  return (
                    <Pressable
                      key={action.kind}
                      onPress={() => onAction(note, action)}
                      style={({ pressed }) => [
                        styles.coachNoteAction,
                        primary && styles.coachNotePrimaryAction,
                        pressed && { opacity: 0.72 },
                      ]}
                      testID={`program-active-coach-note-action-${note.constraintId}-${action.kind}`}
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
    body: "We'll remove this active adjustment from future program decisions.",
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
  onClose: () => void;
  onConfirmClear: () => void;
  onUpdateStatus: (status: ProgramControlStatusUpdate) => void;
}

function CoachNoteSheet({
  state,
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

  return (
    <Sheet visible={Boolean(state)} onClose={onClose}>
      <Text style={styles.sheetTitle}>{copy.title}</Text>
      <Text style={styles.sheetBody}>{copy.body}</Text>
      {state.mode === 'clear' ? (
        <>
          <Button
            label="Clear and update program"
            size="lg"
            onPress={onConfirmClear}
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
          />
          <Button
            label="Still not right"
            variant="secondary"
            size="md"
            onPress={() => onUpdateStatus('still_not_right')}
            style={{ marginTop: spacing.sm }}
          />
          <Button
            label="Still sick"
            variant="secondary"
            size="md"
            onPress={() => onUpdateStatus('still_sick')}
            style={{ marginTop: spacing.sm }}
          />
          <Button
            label="Still cooked"
            variant="secondary"
            size="md"
            onPress={() => onUpdateStatus('still_cooked')}
            style={{ marginTop: spacing.sm }}
          />
          <Button
            label="Worse"
            variant="secondary"
            size="md"
            onPress={() => onUpdateStatus('worse')}
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
  onMove: () => void;
  onRemove: () => void;
}
function GameDaySheet({ visible, onClose, label, onMove, onRemove }: GameDaySheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={styles.sheetTitle}>{label}</Text>
      <View style={styles.sheetCurrentBadge}>
        <View style={styles.sheetCurrentDot} />
        <Text style={styles.sheetCurrentText}>Game day</Text>
      </View>

      <SheetOption
        label="Move Game Day This Week"
        accent
        icon={<Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M5 12h14"/><Path d="M12 5l7 7-7 7"/></Svg>}
        onPress={onMove}
      />
      <SheetOption
        label="Remove Game Day"
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
  accent?: boolean;
  danger?: boolean;
  onPress: () => void;
}
function SheetOption({ label, icon, accent, danger, onPress }: SheetOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.sheetOption, pressed && { opacity: 0.7 }]}
    >
      <View style={[
        styles.sheetOptionIcon,
        accent && { backgroundColor: 'rgba(200, 255, 0, 0.12)' },
        danger && { backgroundColor: 'rgba(244, 67, 54, 0.12)' },
      ]}>
        {icon}
      </View>
      <Text style={[styles.sheetOptionText, danger && { color: '#F44336' }]}>{label}</Text>
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

// ── Weekly "I'm not 100%" sheet ──
interface WeekReadinessSheetProps {
  visible: boolean;
  active: { id: string; isRecovery: boolean; title: string; scope: 'today' | 'week' } | null;
  onClose: () => void;
  onApply: (kind: WeekReadinessAction) => void | Promise<void>;
  onClear: (modifierId: string) => void | Promise<void>;
  onInjury: () => void;
  onShortTime: () => void;
}

/**
 * Weekly readiness sheet — simple tap options, no chat. Reuses today's
 * readiness signal and the existing viewed-week fatigue modifiers.
 */
function WeekReadinessSheet({
  visible,
  active,
  onClose,
  onApply,
  onClear,
  onInjury,
  onShortTime,
}: WeekReadinessSheetProps) {
  const [updating, setUpdating] = useState(false);

  React.useEffect(() => {
    if (visible) setUpdating(false);
  }, [visible]);

  const showOptions = !active || updating;

  const pulseIcon = (color: string) => (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 12h-4l-3 8-6-16-3 8H2" />
    </Svg>
  );

  return (
    <Sheet visible={visible} onClose={onClose} testID="home-week-readiness-sheet">
      {!showOptions && active && (
        <View>
          <Text style={styles.sheetTitle}>{active.title}</Text>
          <Text style={styles.busyAwayEmpty}>
            {active.scope === 'today' ? 'Today is' : 'This week is'} adjusted around how you said you're feeling. Clear
            the adjustment when you're good again.
          </Text>
          <SheetOption
            label="Update — how I'm feeling changed"
            icon={pulseIcon('#FF7A85')}
            onPress={() => setUpdating(true)}
          />
          <SheetOption
            label="Clear adjustment — I'm good now"
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

      {showOptions && (
        <View>
          <Text style={styles.sheetTitle}>Not 100%? What's going on?</Text>
          <SheetOption
            label="Just a bit tired today"
            icon={pulseIcon('#FFC247')}
            onPress={() => onApply('tired_today')}
          />
          <SheetOption
            label="Cooked / need an easier week"
            accent
            icon={pulseIcon('#C8FF00')}
            onPress={() => onApply('cooked_week')}
          />
          <SheetOption
            label="Sore or tight"
            icon={pulseIcon('#FF7A85')}
            onPress={() => onApply('sore_today')}
          />
          <SheetOption
            label="Sick / run down"
            icon={pulseIcon('#1EA7FF')}
            onPress={() => onApply('sick_week')}
          />
          <SheetOption
            label="Niggle or injury"
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FF7A85" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 9v4" /><Path d="M12 17h.01" /><Path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
              </Svg>
            }
            onPress={onInjury}
          />
          <SheetOption
            label="Short on time"
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#1EA7FF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 6v6l4 2" /><Path d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
              </Svg>
            }
            onPress={onShortTime}
          />
          <Button label="Cancel" variant="secondary" size="md" onPress={onClose} style={{ marginTop: spacing.md }} />
        </View>
      )}
    </Sheet>
  );
}

interface BusyAwaySheetProps {
  visible: boolean;
  weekDays: any[];
  onClose: () => void;
  onBusyReduce: () => void | Promise<void>;
  onAwayDays: (dates: string[]) => void | Promise<void>;
}
function BusyAwaySheet({ visible, weekDays, onClose, onBusyReduce, onAwayDays }: BusyAwaySheetProps) {
  const [step, setStep] = useState<'menu' | 'away'>('menu');
  const [selected, setSelected] = useState<string[]>([]);

  React.useEffect(() => {
    if (visible) {
      setStep('menu');
      setSelected([]);
    }
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
    <Sheet visible={visible} onClose={onClose} testID="home-busy-away-sheet">
      {step === 'menu' && (
        <View>
          <Text style={styles.sheetTitle}>Busy or away this week?</Text>
          <SheetOption
            label="Busy week — keep me training, go lighter"
            accent
            icon={<Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 6v6l4 2"/><Path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/></Svg>}
            onPress={onBusyReduce}
          />
          <SheetOption
            label="Away some days — clear them"
            icon={<Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#1EA7FF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 12h18"/><Path d="M12 3a15 15 0 010 18"/><Path d="M12 3a15 15 0 000 18"/></Svg>}
            onPress={() => setStep('away')}
          />
          <Button label="Cancel" variant="secondary" size="md" onPress={onClose} style={{ marginTop: spacing.md }} />
        </View>
      )}

      {step === 'away' && (
        <View>
          <Text style={styles.sheetTitle}>Which days are you away?</Text>
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
                    {day.workout?.name ? ` · ${day.workout.name}` : ''}
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
          <Button label="Back" variant="secondary" size="md" onPress={() => setStep('menu')} style={{ marginTop: spacing.sm }} />
        </View>
      )}
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
  onClose: () => void;
  onBack: () => void;
  onTogglePendingPreferredDay: (d: DayOfWeek) => void;
  onTogglePendingTeamDay: (d: DayOfWeek) => void;
  onSetPendingGameDay: (d: DayOfWeek) => void;
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
  pendingPreferredDays, pendingTeamDays, pendingGameDay,
  onClose, onBack,
  onTogglePendingPreferredDay, onTogglePendingTeamDay, onSetPendingGameDay, onAdvance,
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
          {error && <Text style={styles.sheetError}>{error}</Text>}
          {(!error || canRetry) && (
            <Button
              label={error ? 'Try again' : `Shift to ${targetPhase}`}
              size="lg"
              disabled={!pendingGameDay}
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
  dayChipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  dayChipTextSelected: { color: '#C8FF00', fontWeight: '700' },
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
