import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { PlanChangeSheet } from './PlanChangeSheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../../components/common/Text';
import { SessionTierBadge } from '../../components/common/SessionTierBadge';
import { SelectableTile } from '../../components/common';
import { StaleOverrideBanner } from '../../components/StaleOverrideBanner';
import { Button, Card, Sheet, Badge, IconButton, SectionLabel } from '../../components/ui';
import type { SeasonPhase, DayOfWeek } from '../../types/domain';
import { splitSessionName } from '../../utils/sessionNaming';
import { visibleWorkoutItemCountLabel } from '../../utils/visibleProgramReadModel';
import { spacing, borderRadius } from '../../theme/spacing';
import { useHomeScreen } from './useHomeScreen';
import { getCoachNoteDisplay } from '../../utils/coachNoteSummary';
import { shortDayMonthLabel } from '../../utils/appDate';
import {
  WEEK_DAYS,
  DAY_SHORT,
  NEXT_PHASE,
  getConditioningContextLabel,
  suppressDuplicateWorkoutContext,
  REBUILD_MESSAGES,
  PHASE_SHIFT_MESSAGES,
  QUICK_ACTIONS,
  type PhaseShiftStep,
} from './homeScreenConstants';

/**
 * HomeScreenV2 — "Today-first" redesign.
 *
 * ## Hierarchy
 * Today is the hero: a large elevated card at the top of the scroll with
 * the primary CTA. The remaining days appear below as a condensed,
 * scannable week list. The eye lands on "what do I do right now" first,
 * then context-switches to "how does the rest of the week look".
 *
 * When the athlete browses a different week (past/future), or is in a
 * picker mode (move-game / add-game), the hero collapses and we fall back
 * to a uniform list — picker interactions need visual parity across days.
 *
 * ## Logic parity
 * All state and handler orchestration lives in `useHomeScreen`, which
 * HomeScreenClassic consumes identically. This file is presentation-only.
 * Swapping variants via the Profile toggle produces identical data
 * outcomes — only the rendering differs.
 *
 * ## Visual language
 * Premium, focused, high-end. The hero earns its dominance through scale
 * and whitespace — not borders or glow. The week list below recedes into
 * a structured timeline, not a grid of outlined buttons. Glow is reserved
 * for completion / success moments elsewhere in the app; the home screen
 * is a "ready to start" posture, not a "you just finished" posture.
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
    isThisWeek,
    handlePrev,
    handleNext,
    handleThisWeek,
    selectedIdx,
    mode,
    handleDayTap,
    handleClearSelection,
    handleCancelMove,
    handleAddGameMode,
    handleViewWorkout,
    handleFinishTeamSession,
    handleQuickAction,
    staleByDate,
    weekHasGame,
    showAddGameCTA,
    currentPhase,
    gameModalVisible,
    gameModalLabel,
    closeGameModal,
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
  const todayIdx = weekDays.findIndex((d) => d.isToday);
  const todayDay = todayIdx >= 0 ? weekDays[todayIdx] : null;
  const showHero = isNormal && isThisWeek && !!todayDay;

  // ── Tap-first plan-change sheet (ATHLETE_CHANGE_VOCABULARY.md group 1) ──
  const [changeSheetDate, setChangeSheetDate] = useState<string | null>(null);

  // Days to render in the list: skip today when the hero is showing,
  // otherwise render the full week.
  const listDays = showHero
    ? weekDays.filter((_, idx) => idx !== todayIdx)
    : weekDays;

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
              {isThisWeek && <Badge label="This week" tone="outline" style={styles.topBarBadge} />}
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
          <MoveBanner text="Tap the day to set as game day" onCancel={handleCancelMove} />
        )}

        {/* ── Today hero ── */}
        {showHero && todayDay && (
          <TodayHero
            day={todayDay}
            staleWarning={staleByDate[todayDay.date]}
            onOpenSheet={() => handleDayTap(todayIdx)}
            onMakeChange={() => todayDay && setChangeSheetDate(todayDay.date)}
            onViewWorkout={() => handleViewWorkout(todayDay)}
            onFinishTeam={() => handleFinishTeamSession(todayDay)}
            onReviewStale={handleQuickAction}
          />
        )}

        {/* ── Week list ── */}
        {showHero && listDays.length > 0 && (
          <View style={styles.listHeader}>
            <SectionLabel>Rest of your week</SectionLabel>
          </View>
        )}
        <View style={styles.dayList}>
          {listDays.map((day) => {
            const idx = weekDays.indexOf(day);
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
                onPress={() => handleDayTap(idx)}
                onViewWorkout={() => handleViewWorkout(day)}
                onFinishTeam={() => handleFinishTeamSession(day)}
                onMakeChange={() => setChangeSheetDate(day.date)}
                staleWarning={staleByDate[day.date]}
                onReviewStale={handleQuickAction}
                normal={isNormal}
              />
            );
          })}
        </View>

        {/* ── No game CTA ── */}
        {isNormal && !weekHasGame && showAddGameCTA && (
          <Pressable onPress={handleAddGameMode} style={({ pressed }) => [pressed && { opacity: 0.75 }]}>
            <Card tone="default" padding="md" radius="lg" style={styles.addGame}>
              <View style={styles.addGameRow}>
                <View style={styles.addGameIcon}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M12 5v14" /><Path d="M5 12h14" />
                  </Svg>
                </View>
                <Text style={styles.addGameText}>No game this week — add one</Text>
              </View>
            </Card>
          </Pressable>
        )}

        {/* ── Quick actions ── */}
        {isNormal && (
          <View style={styles.section}>
            <SectionLabel>Need to adjust your weekly plan?</SectionLabel>
            <View style={styles.chipsWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
              >
                {QUICK_ACTIONS.map((action) => (
                  <Pressable
                    key={action.label}
                    onPress={() => handleQuickAction(action.prefill)}
                    style={({ pressed }) => [
                      styles.chip,
                      action.prefill === '' && styles.chipHighlight,
                      pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        action.prefill === '' && styles.chipTextHighlight,
                      ]}
                      numberOfLines={1}
                    >
                      {action.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <LinearGradient
                colors={['rgba(12,12,12,0)', 'rgba(12,12,12,0.9)', '#0C0C0C']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.chipsFade}
                pointerEvents="none"
              />
            </View>
          </View>
        )}

        {/* ── Phase shift card ── */}
        {isNormal && (
          <View style={styles.section}>
            <SectionLabel>Changing season phase?</SectionLabel>
            <Card tone="outline" padding="lg" radius="xl" style={styles.phaseCard}>
              <Text style={styles.phaseBadge}>{currentPhase.toUpperCase()} MODE</Text>
              <Text style={styles.phaseBody}>
                Ready for the next block? Shift your whole program to{' '}
                <Text style={styles.phaseBodyAccent}>{NEXT_PHASE[currentPhase]}</Text> priorities.
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
        onAskCoach={handleQuickAction}
      />

      <GameDaySheet
        visible={gameModalVisible}
        onClose={closeGameModal}
        label={gameModalLabel}
        onView={handleLogGame}
        onMove={handleMoveGameDay}
        onRemove={handleRemoveGameDay}
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

interface TodayHeroProps {
  day: any;
  staleWarning: any;
  onOpenSheet: () => void;
  onViewWorkout: () => void;
  onFinishTeam: () => void;
  onMakeChange: () => void;
  onReviewStale: (prefill: string) => void;
}
/**
 * The hero card — a "this is what you do right now" statement at the top
 * of the scroll. Three behavioural branches:
 *
 *  - Regular workout     → big title + context + primary "View Workout" CTA.
 *  - Team-training only  → title "Team Training" + "Log Session" CTA.
 *                          Team sessions are completed externally with the
 *                          club — the in-app action is logging the session
 *                          afterwards, not finishing a tracked workout.
 *  - Game day            → card itself is pressable → opens GameDaySheet;
 *                          no inline CTA (sheet handles the 3 options).
 *  - Rest day            → muted title + "Recover & recharge", no CTA.
 */
function TodayHero({
  day, staleWarning, onOpenSheet, onViewWorkout, onFinishTeam, onMakeChange, onReviewStale,
}: TodayHeroProps) {
  const hasWorkout = !!day.workout;
  const isGame = day.workout?.workoutType === 'Game';
  const isTeamOnly = hasWorkout && day.workout.name === 'Team Training';
  const parsed = hasWorkout ? splitSessionName(day.workout.name) : null;
  const title = parsed?.title ?? null;
  const context = suppressDuplicateWorkoutContext(title, parsed?.context);
  const conditioningContext = suppressDuplicateWorkoutContext(
    title,
    hasWorkout ? getConditioningContextLabel(day.workout) : null,
  );
  const visibleCountLabel = hasWorkout ? visibleWorkoutItemCountLabel(day.workout) : null;

  // Game days delegate tap to the sheet; everything else uses the CTA buttons,
  // so the card wrapper is non-interactive to avoid double-press confusion.
  const cardOnPress = isGame ? onOpenSheet : undefined;

  return (
    <View style={styles.heroWrap}>
      <Card
        tone="default"
        radius="xl"
        padding="none"
        onPress={cardOnPress}
        style={styles.heroCard}
      >
        <View style={styles.heroInner}>
          {staleWarning && (
            <View style={styles.heroStale}>
              <StaleOverrideBanner
                warning={staleWarning}
                onReview={(prefill) => onReviewStale(prefill)}
              />
            </View>
          )}

          {/*
           * Small, muted eyebrow — "TODAY" is a quiet label, not a signal.
           * The title below is the signal.
           *
           * The RECOVERY tier chip is intentionally suppressed in the hero:
           * the session title ("Recovery Session") already carries that
           * meaning, and the chip only adds visual noise. CORE / OPTIONAL
           * tiers still show because their titles don't encode the tier.
           */}
          <View style={styles.heroEyebrowRow}>
            <Text style={styles.heroEyebrow}>
              {eyebrowFor(hasWorkout, isGame, isTeamOnly, day.date)}
            </Text>
            {hasWorkout && !isGame && day.workout.sessionTier && day.workout.sessionTier !== 'recovery' ? (
              <SessionTierBadge tier={day.workout.sessionTier} />
            ) : isGame ? (
              <Badge label="Game" tone="outline" />
            ) : null}
          </View>

          {/* Session title is the focal point of the whole screen. */}
          <Text style={styles.heroTitle} numberOfLines={2}>
            {hasWorkout ? title : 'Rest Day'}
          </Text>

          {hasWorkout && context ? (
            <Text style={styles.heroContext}>{context}</Text>
          ) : conditioningContext ? (
            <Text style={styles.heroContextAccent}>+ {conditioningContext}</Text>
          ) : null}

          {/* Coach-attribution chip — ONE concise line summarising any
              engine adjustments on today's session. The full per-exercise
              detail lives on the workout detail screen, not here.
              App-store-friendly: no audit log on the hero. */}
          {hasWorkout && (() => {
            const summary = getCoachNoteDisplay(day.workout.coachNotes, {
              workoutName: day.workout.name,
              workoutType: day.workout.workoutType,
            });
            if (!summary.summaryLine) return null;
            return (
              <Text
                style={styles.heroCoachNoteText}
                numberOfLines={1}
                ellipsizeMode="tail"
                testID="hero-coach-summary"
              >
                {summary.summaryLine}
              </Text>
            );
          })()}

          {/*
           * Recovery session subtext — one quiet line that explains the
           * intent of the day. The title ("Recovery Session") is deliberate
           * about the category; this line tells the athlete what it feels
           * like to do it. No chip, no accent — just context.
           */}
          {hasWorkout && !isGame && day.workout.sessionTier === 'recovery' && (
            <Text style={styles.heroRecoveryBody}>Low intensity · restore & reset</Text>
          )}

          {/* Exercise count — readable metadata now, not buried. Still
              a whisper compared to the title, but legible at a glance. */}
          {hasWorkout && !isGame && !isTeamOnly && visibleCountLabel && (
            <Text style={styles.heroMeta}>{visibleCountLabel}</Text>
          )}

          {isTeamOnly && !isGame && (
            <Text style={styles.heroBodyMuted}>All together tonight.</Text>
          )}
          {/*
           * Rest-day body — reframed from "Recover & recharge." (neutral
           * filler) to a line that respects the athlete's investment: recovery
           * is when adaptation actually happens.
           */}
          {!hasWorkout && (
            <Text style={styles.heroBodyMuted}>Recovery is where adaptation happens.</Text>
          )}
          {isGame && (
            <Text style={styles.heroBodyMuted}>Tap for game-day options.</Text>
          )}

          {/* Primary CTA — workout days only. `glow={false}` keeps the
              button's presence confident without the flashy lime halo; the
              screen earns its hierarchy through scale and space, not light. */}
          {hasWorkout && !isGame && (
            <View style={styles.heroCtaRow}>
              {isTeamOnly ? (
                <Button label="Log Session" size="lg" glow={false} onPress={onFinishTeam} />
              ) : (
                <Button label="Start Session" size="lg" glow={false} onPress={onViewWorkout} />
              )}
              <Text style={styles.heroCtaHint}>Ready when you are</Text>
            </View>
          )}

          {/* Tap-first change door — every non-game day, including rest. */}
          {!isGame && (
            <Pressable
              onPress={onMakeChange}
              style={({ pressed }) => [styles.makeChangeLink, pressed && { opacity: 0.7 }]}
              testID="hero-make-change-link"
            >
              <Text style={styles.makeChangeText}>
                {hasWorkout ? 'Want to change something?' : 'Add a session?'}
              </Text>
            </Pressable>
          )}
        </View>
      </Card>
    </View>
  );
}

function eyebrowFor(
  hasWorkout: boolean,
  isGame: boolean,
  isTeamOnly: boolean,
  dateISO?: string,
): string {
  // Actual calendar date rides along in the eyebrow ("TODAY · 3/7") so the
  // hero matches the dated day rows below it.
  const dateBit = dateISO ? ` · ${shortDayMonthLabel(dateISO)}` : '';
  if (isGame) return `TODAY${dateBit} · GAME`;
  if (!hasWorkout) return `TODAY${dateBit} · REST`;
  if (isTeamOnly) return `TODAY${dateBit} · TEAM`;
  return `TODAY${dateBit}`;
}

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
  onMakeChange: () => void;
  staleWarning: any;
  onReviewStale: (prefill: string) => void;
}
/**
 * Condensed day row — used for every day *other than today* when the
 * hero is active, and for all 7 days when browsing another week or in
 * picker mode.
 *
 * Selection → expands with the same CTA/stale/meta surface as Classic,
 * preserving the tap-to-select contract.
 */
function DayRow({
  day, isSelected, isMoveSource, isMoveTarget, pickerMode,
  hasWorkout, isGame, normal, onPress, onViewWorkout, onFinishTeam,
  onMakeChange, staleWarning, onReviewStale,
}: DayRowProps) {
  const rowTone = isSelected && normal ? 'accent' : 'default';
  const parsed = hasWorkout ? splitSessionName(day.workout.name) : null;
  const title = parsed?.title ?? null;
  const ctx = suppressDuplicateWorkoutContext(title, parsed?.context);
  const conditioningContext = suppressDuplicateWorkoutContext(
    title,
    hasWorkout ? getConditioningContextLabel(day.workout) : null,
  );
  const isTeamOnly = hasWorkout && day.workout.name === 'Team Training';

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
      ]}
    >
      <View style={styles.dayRowInner}>
      <View style={styles.dayHeader}>
        <View style={styles.leftCluster}>
          <Text
            style={[
              styles.dayLabel,
              (isSelected && normal) || day.isToday || isMoveTarget ? { color: '#C8FF00' } : null,
            ]}
          >
            {day.short}
          </Text>
          {/* Actual calendar date — quiet, one step dimmer than the
              weekday so "MON" stays the anchor and "3/7" is the detail. */}
          <Text style={styles.dayDate}>{shortDayMonthLabel(day.date)}</Text>
          {day.isToday && <Badge label="Today" tone="accent" />}
          {isMoveSource
            ? <Badge label="Moving" tone="outline" />
            : hasWorkout && isGame
              ? <Badge label="Game" tone="outline" />
              : hasWorkout && day.workout.sessionTier
                ? <SessionTierBadge tier={day.workout.sessionTier} />
                : null}
        </View>

        {isMoveTarget ? (
          <Text style={styles.moveTargetLabel}>
            {pickerMode === 'addGame' ? 'Tap to set game' : 'Tap to move here'}
          </Text>
        ) : hasWorkout ? (
          <View style={styles.titleBlock}>
            <Text
              style={[styles.workoutTitle, isMoveSource && { opacity: 0.4 }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
            {ctx ? (
              <Text style={styles.workoutContext} numberOfLines={1}>{ctx}</Text>
            ) : conditioningContext ? (
              <Text style={styles.workoutContextAccent} numberOfLines={1}>
                + {conditioningContext}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.restLabel}>Rest</Text>
        )}
      </View>

      {/* Coach attribution — ONE short line, no bullets. The audit log
          (per-exercise removals + focus targets) lives on the workout
          detail screen, not on every Program-tab row. */}
      {hasWorkout && (() => {
        const summary = getCoachNoteDisplay(day.workout.coachNotes, {
          workoutName: day.workout.name,
          workoutType: day.workout.workoutType,
        });
        if (!summary.summaryLine) return null;
        return (
          <Text
            testID="day-row-coach-summary"
            style={styles.rowCoachNoteText}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {summary.summaryLine}
          </Text>
        );
      })()}

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
              <Text style={styles.expandedMeta}>
                {visibleWorkoutItemCountLabel(day.workout) ?? '0 items'}
              </Text>
              <Button label="View Workout" size="lg" glow={false} onPress={onViewWorkout} testID="view-workout-button" />
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
          <Text style={styles.expandedMeta}>Game Day</Text>
        </View>
      )}
      {isSelected && !hasWorkout && normal && (
        <View style={styles.expanded}>
          <Text style={styles.expandedMeta}>Recover & recharge</Text>
          <Pressable
            onPress={onMakeChange}
            style={({ pressed }) => [styles.makeChangeLink, pressed && { opacity: 0.7 }]}
            testID="add-session-link"
          >
            <Text style={styles.makeChangeText}>Add a session?</Text>
          </Pressable>
        </View>
      )}
      </View>
    </Card>
  );
}

interface GameDaySheetProps {
  visible: boolean;
  onClose: () => void;
  label: string;
  onView: () => void;
  onMove: () => void;
  onRemove: () => void;
}
function GameDaySheet({ visible, onClose, label, onView, onMove, onRemove }: GameDaySheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={styles.sheetTitle}>{label}</Text>
      <View style={styles.sheetCurrentBadge}>
        <View style={styles.sheetCurrentDot} />
        <Text style={styles.sheetCurrentText}>Game day</Text>
      </View>

      <SheetOption
        label="Log Game"
        accent
        icon={<Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><Path d="M12 9a3 3 0 100 6 3 3 0 000-6z"/></Svg>}
        onPress={onView}
      />
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

  // Top bar (week nav) — generous bottom space so the hero below breathes.
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

  // ─── Today hero ───
  //
  // The hero is the main event. Its dominance is earned through scale,
  // space, and typography — not through a card backdrop. The container is
  // transparent and borderless so the title reads as content on the
  // screen, not content in a box. Extra margin above and below lifts it
  // from the surrounding rhythm.
  heroWrap: {
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
  },
  heroCard: {
    // No backdrop: the hero is integrated into the screen. Matching the
    // screen background removes the "boxed" feeling while keeping all the
    // Card primitive's press/animation behaviour for game-day taps.
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
  },
  // Horizontal padding matches the day-row inner padding so hero content
  // lines up vertically with list content. Vertical padding is content
  // breathing room — not a card's internal inset.
  heroInner: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  heroStale: { marginBottom: spacing.md },
  heroEyebrowRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing.md,
  },
  // "TODAY" — small, muted, tracked. A quiet label, not a signal.
  heroEyebrow: {
    color: '#6A6A6A', fontSize: 11, fontWeight: '700',
    letterSpacing: 2.0,
  },
  // Title — the focal point of the whole screen. Dominant scale, tight
  // leading, heavy weight. Sized down a couple of steps from its first
  // pass so two-line titles ("Recovery Session") read as one compact
  // block instead of slightly oversized; the leading drops with it.
  heroTitle: {
    color: '#FFFFFF', fontSize: 38, fontWeight: '800',
    letterSpacing: -0.6, lineHeight: 41,
  },
  heroContext: {
    color: '#8E8E8E', fontSize: 14, fontWeight: '500',
    marginTop: spacing.sm,
  },
  // Conditioning flavour line — quieter accent so the title still wins.
  heroContextAccent: {
    color: '#C8FF00', fontSize: 14, fontWeight: '600',
    marginTop: spacing.sm, opacity: 0.55,
  },
  // Exercise count — readable metadata. Pulled tighter to the subtext
  // above so title → subtext → count read as one typeset block rather
  // than three separate lines stacked with loose air between them.
  heroMeta: {
    color: '#8A8A8A', fontSize: 12, fontWeight: '500',
    marginTop: 2, letterSpacing: 0.3,
  },
  // Recovery session subtext — muted neutral with a small opacity dial so
  // it reads as supportive context, never competing with the title above.
  heroRecoveryBody: {
    color: '#8A8A8A', fontSize: 14, fontWeight: '500',
    marginTop: spacing.sm, opacity: 0.85,
  },
  heroBodyMuted: {
    color: '#8A8A8A', fontSize: 14, fontWeight: '500',
    marginTop: spacing.sm,
  },
  // CTA gets a confident amount of top space — gives the button presence
  // without needing light/shadow to claim it. A shade more than spacing.xl
  // lets the button breathe away from the metadata block above.
  heroCtaRow: {
    marginTop: 40,
  },
  // Readiness hint below the CTA — tightened against the button so the
  // two read as one unit. Slightly brighter than a muted grey gives the
  // line clarity without competing with the CTA label.
  heroCtaHint: {
    color: '#8A8A8A', fontSize: 12, fontWeight: '500',
    textAlign: 'center', marginTop: 4, letterSpacing: 0.3,
  },

  // ─── Coach-authored note lists ───
  // Lime accent matches the screen's existing accent vocabulary (the
  // `+ Conditioning` hint, the lime CTA hint). Slightly muted opacity
  // keeps the note from competing with the session title above it,
  // while still flagging "this changed for a reason" at a glance.
  // Single-line attribution chip on the Today hero. No bullet, no list —
  // just the most useful restriction note when one exists.
  heroCoachNoteText: {
    color: '#C8FF00',
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.85,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  // Row attribution sits under the right-aligned workout title — one
  // line, capped, no bullets. The audit log (removed/replaced/focus)
  // is reserved for the workout detail screen.
  rowCoachNoteText: {
    color: '#C8FF00',
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.8,
    textAlign: 'right',
    marginTop: 6,
  },

  // ─── Week list ───
  //
  // A structured weekly timeline, not a grid of outlined buttons. Rows
  // are flat, borderless, tighter vertically. Non-selected rows recede
  // into a deeper grey; selection and move states pop because they carry
  // the only accents in the sequence.
  // Section label above the list — dimmed one step so it guides the eye
  // without competing with the row content it's introducing.
  listHeader: {
    marginBottom: spacing.md,
    opacity: 0.7,
  },
  dayList: { gap: 6 },
  dayRow: {},
  // Tighter vertical rhythm — pulls the list into a scannable weekly
  // timeline instead of a column of spaced buttons.
  dayRowInner: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  // Resting state — darker, borderless, quietly set back from the hero.
  dayRowResting: { backgroundColor: '#0F0F0F', borderColor: 'transparent' },
  // Today row (only visible when the hero is collapsed — other weeks,
  // picker modes). A half-step brighter than resting with a faint edge
  // so "now" reads as structurally different without introducing colour.
  dayRowToday: { backgroundColor: '#141414', borderColor: '#1F1F1F' },
  dayRowMoveSource: { opacity: 0.5, borderColor: 'rgba(200, 255, 0, 0.30)' },
  dayRowMoveTarget: {
    borderColor: 'rgba(200, 255, 0, 0.40)', backgroundColor: '#141814',
  },

  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  leftCluster: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayLabel: {
    color: '#5A5A5A', fontSize: 11, fontWeight: '800',
    letterSpacing: 1.6, minWidth: 32,
  },
  // Calendar date beside the weekday — one step dimmer, lighter weight,
  // no tracking. "MON" is the anchor, "3/7" is the detail.
  dayDate: {
    color: '#4A4A4A', fontSize: 11, fontWeight: '600',
  },
  titleBlock: { flex: 1, alignItems: 'flex-end', minWidth: 0 },
  // Primary row text — nudged brighter so the session name is the clear
  // anchor of each row against the darker resting surface beneath it.
  workoutTitle: {
    color: '#F2F2F2', fontSize: 14, fontWeight: '600', textAlign: 'right',
  },
  workoutContext: {
    color: '#7A7A7A', fontSize: 12, fontWeight: '500',
    textAlign: 'right', marginTop: 2,
  },
  workoutContextAccent: {
    color: '#C8FF00', fontSize: 12, fontWeight: '600',
    textAlign: 'right', marginTop: 2, opacity: 0.75,
  },
  restLabel: {
    flex: 1, color: '#3E3E3E', fontSize: 13, fontWeight: '600', textAlign: 'right',
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
  chipsWrap: { position: 'relative' },
  chipsScroll: { gap: spacing.sm, paddingRight: 50 },
  chip: {
    backgroundColor: '#151515', paddingHorizontal: 16, paddingVertical: 11,
    borderRadius: borderRadius.full,
  },
  chipHighlight: {
    backgroundColor: 'rgba(200, 255, 0, 0.10)',
  },
  chipText: { color: '#BFBFBF', fontSize: 13, fontWeight: '500' },
  chipTextHighlight: { color: '#C8FF00', fontWeight: '600' },
  chipsFade: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: 60,
  },

  // Phase card — borderless default surface; the outline Button below it
  // carries the accent weight.
  phaseCard: {
    gap: spacing.sm, alignItems: 'flex-start',
    backgroundColor: '#141414',
    borderColor: 'transparent',
  },
  phaseBadge: {
    color: '#C8FF00', fontSize: 11, fontWeight: '800', letterSpacing: 1.5,
  },
  phaseBody: { color: '#D0D0D0', fontSize: 14, lineHeight: 20 },
  phaseBodyAccent: { color: '#C8FF00', fontWeight: '700' },

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
