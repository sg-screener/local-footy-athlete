import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { SessionTierBadge } from '../../components/common/SessionTierBadge';
import { StaleOverrideBanner } from '../../components/StaleOverrideBanner';
import { splitSessionName } from '../../utils/sessionNaming';
import type { DesignVersion } from '../../store/uiStore';
import HomeScreenV2 from './HomeScreenV2';
import { useHomeScreen } from './useHomeScreen';
import {
  WEEK_DAYS,
  DAY_SHORT,
  NEXT_PHASE,
  getConditioningContextLabel,
  suppressDuplicateWorkoutContext,
  REBUILD_MESSAGES,
  PHASE_SHIFT_MESSAGES,
  QUICK_ACTIONS,
} from './homeScreenConstants';

// Dev-only debug overlay — tree-shaken in production builds
const ScheduleDebugPanel = __DEV__
  ? require('../../components/dev/ScheduleDebugPanel').ScheduleDebugPanel
  : null;

// Local alias: the canonical splitter lives in utils/sessionNaming.
// Session names reaching the UI are already canonical (e.g.
// "Upper Push", "Team Training + Upper Pull") so we only need to split on
// the single authoritative " + " separator.
const splitWorkoutName = splitSessionName;

// ── Design-version flag ──
// Hardcoded to 'v2' so the app opens directly into the redesigned Home
// during the V2 rollout. Flip to 'classic' to swap back.
//
// When we're ready to let users toggle at runtime again, restore:
//   const designVersion = useUIStore((s) => s.designVersion);
// The store + Profile → Preferences → Experimental toggle are still wired;
// the hardcoded constant below just shadows them for now.
const DESIGN_VERSION: DesignVersion = 'v2';

export default function HomeScreen() {
  if (DESIGN_VERSION === 'v2') {
    return <HomeScreenV2 />;
  }

  return <HomeScreenClassic />;
}

/**
 * Classic Home render — the original UI, unchanged in look/feel.
 *
 * All state, effects, and handler orchestration are consumed from the
 * shared `useHomeScreen()` hook. This component is presentation only:
 * destructure what the JSX needs, render it, no logic lives here.
 */
function HomeScreenClassic() {
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* ─── Week Navigation ─── */}
        <View style={styles.weekNav}>
          <TouchableOpacity onPress={handlePrev} style={styles.navArrow} activeOpacity={0.6}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.text.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 18l-6-6 6-6" />
            </Svg>
          </TouchableOpacity>

          <TouchableOpacity onPress={isThisWeek ? undefined : handleThisWeek} activeOpacity={isThisWeek ? 1 : 0.6}>
            <View style={styles.weekLabelRow}>
              <Text style={styles.weekLabelText}>{weekLabel}</Text>
              {isThisWeek && (
                <View style={styles.thisWeekBadge}>
                  <Text style={styles.thisWeekBadgeText}>THIS WEEK</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.weekNavRight}>
            <TouchableOpacity onPress={handleNext} style={styles.navArrow} activeOpacity={0.6}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.text.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M9 18l6-6-6-6" />
              </Svg>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleOpenRebuild}
              style={styles.navArrow}
              activeOpacity={0.6}
              accessibilityLabel="Rebuild this week"
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.text.primary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M23 4v6h-6" />
                <Path d="M1 20v-6h6" />
                <Path d="M3.51 9a9 9 0 0114.85-3.36L23 10" />
                <Path d="M20.49 15A9 9 0 015.64 18.36L1 14" />
              </Svg>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Picker Banner (move / add game) ─── */}
        {mode.type === 'moveGame' && (
          <View style={styles.moveBanner}>
            <Text style={styles.moveBannerText}>
              Tap the day to move the game to
            </Text>
            <TouchableOpacity onPress={handleCancelMove} activeOpacity={0.7}>
              <Text style={styles.moveBannerCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
        {mode.type === 'addGame' && (
          <View style={styles.moveBanner}>
            <Text style={styles.moveBannerText}>
              Tap the day to set as game day
            </Text>
            <TouchableOpacity onPress={handleCancelMove} activeOpacity={0.7}>
              <Text style={styles.moveBannerCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Day Rows ─── */}
        <View style={styles.dayList}>
          {weekDays.map((day, idx) => {
            const isSelected = idx === selectedIdx;
            const hasWorkout = !!day.workout;
            const isGame = day.workout?.workoutType === 'Game';
            const isMoveSource = mode.type === 'moveGame' && day.date === mode.fromDate;
            const isPickerMode = mode.type === 'moveGame' || mode.type === 'addGame';
            const isMoveTarget = isPickerMode && !isMoveSource;

            return (
              <Pressable
                key={day.date}
                style={[
                  styles.dayRow,
                  isSelected && mode.type === 'normal' && styles.dayRowSelected,
                  day.isToday && !isSelected && mode.type === 'normal' && styles.dayRowToday,
                  isMoveSource && styles.dayRowMoveSource,
                  isMoveTarget && styles.dayRowMoveTarget,
                ]}
                onPress={() => handleDayTap(idx)}
              >
                <View style={styles.dayHeader}>
                  {/* Left cluster: DAY + TODAY? + BADGE — always vertically centered */}
                  <View style={styles.leftCluster}>
                    <Text
                      style={[
                        styles.dayLabel,
                        isSelected && mode.type === 'normal' && styles.dayLabelSelected,
                        day.isToday && styles.dayLabelToday,
                        isMoveTarget && styles.dayLabelMoveTarget,
                      ]}
                    >
                      {day.short}
                    </Text>
                    {day.isToday && (
                      <View style={styles.todayBadge}>
                        <Text style={styles.todayBadgeText}>TODAY</Text>
                      </View>
                    )}
                    {isMoveSource ? (
                      <View style={styles.movingBadge}>
                        <Text style={styles.movingBadgeText}>MOVING</Text>
                      </View>
                    ) : hasWorkout && isGame ? (
                      <View style={styles.gameBadge}>
                        <Text style={styles.gameBadgeText}>GAME</Text>
                      </View>
                    ) : hasWorkout && day.workout!.sessionTier ? (
                      <SessionTierBadge tier={day.workout!.sessionTier} />
                    ) : null}
                  </View>

                  {/* Right side: Title + subtext — flex:1, vertically centered as a block */}
                  {isMoveTarget ? (
                    <Text style={styles.moveTargetLabel}>
                      {mode.type === 'addGame' ? 'Tap to set game' : 'Tap to move here'}
                    </Text>
                  ) : hasWorkout ? (
                    <View style={styles.workoutTitleBlock}>
                      <Text
                        style={[
                          styles.workoutName,
                          isMoveSource && { opacity: 0.4 },
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {splitWorkoutName(day.workout!.name).title}
                      </Text>
                      {/* Paired line: ALWAYS prefer the context suffix from the
                          resolved workout.name (e.g. "+ Team Training", "+ Conditioning")
                          so the weekly card matches the day-detail page. Only fall back
                          to the engine-plan conditioningFlavour flag when the name has
                          no suffix — otherwise stale flags like "high-intensity" can
                          override a post-resolver change to "+ Team Training". */}
                      {(() => {
                        const parsedName = splitWorkoutName(day.workout!.name);
                        const nameContext = suppressDuplicateWorkoutContext(
                          parsedName.title,
                          parsedName.context,
                        );
                        if (nameContext) {
                          return (
                            <Text
                              style={styles.workoutContext}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {nameContext}
                            </Text>
                          );
                        }
                        const conditioningContext = suppressDuplicateWorkoutContext(
                          parsedName.title,
                          getConditioningContextLabel(day.workout),
                        );
                        if (conditioningContext) {
                          return (
                            <Text
                              style={styles.combinedCondLabel}
                              numberOfLines={1}
                            >
                              + {conditioningContext}
                            </Text>
                          );
                        }
                        return null;
                      })()}
                    </View>
                  ) : (
                    <Text style={styles.restLabel}>
                      Rest
                    </Text>
                  )}
                </View>

                {/* Coach-authored notes — visible on EVERY day row (collapsed
                    or expanded) so injury-driven changes are obvious without
                    drilling in. Renders one line per note, prefixed with a
                    coach-tag dot. */}
                {hasWorkout && day.workout!.coachNotes && day.workout!.coachNotes.length > 0 && (
                  <View style={styles.coachNoteList}>
                    {day.workout!.coachNotes.map((note, i) => (
                      <Text key={i} style={styles.coachNoteText} numberOfLines={2}>
                        • {note}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Expanded content for selected day */}
                {isSelected && hasWorkout && !isGame && mode.type === 'normal' && (() => {
                  // Team-training-only days have no programmed exercises —
                  // it's an external session the athlete completes at the
                  // club. Replace the misleading "0 exercises + View Workout"
                  // block with a single "Log Session" button that jumps
                  // straight into the post-session feedback flow. The label
                  // reflects the actual user behaviour — there's nothing to
                  // "finish" in the app, only a session to log after the fact.
                  const isTeamOnly = day.workout!.name === 'Team Training';
                  return (
                    <View style={styles.expandedContent}>
                      {/* Stale override warning (full banner in expanded view) */}
                      {staleByDate[day.date] && (
                        <StaleOverrideBanner
                          warning={staleByDate[day.date]}
                          onReview={(prefill) => handleQuickAction(prefill)}
                        />
                      )}
                      {isTeamOnly ? (
                        <Pressable
                          style={({ pressed }) => [
                            styles.viewWorkoutButton,
                            pressed && { opacity: 0.8 },
                          ]}
                          onPress={() => handleFinishTeamSession(day)}
                        >
                          <Text style={styles.viewWorkoutText}>Log Session</Text>
                        </Pressable>
                      ) : (
                        <>
                          <Text style={styles.exerciseCount}>
                            {day.workout!.exercises?.length || 0} exercises
                          </Text>
                          <Pressable
                            style={({ pressed }) => [
                              styles.viewWorkoutButton,
                              pressed && { opacity: 0.8 },
                            ]}
                            onPress={() => handleViewWorkout(day)}
                          >
                            <Text style={styles.viewWorkoutText}>View Workout</Text>
                          </Pressable>
                        </>
                      )}
                    </View>
                  );
                })()}

                {/* Compact stale warning for non-selected day rows */}
                {!isSelected && staleByDate[day.date] && mode.type === 'normal' && (
                  <StaleOverrideBanner
                    warning={staleByDate[day.date]}
                    compact
                    onReview={(prefill) => handleQuickAction(prefill)}
                  />
                )}

                {isSelected && isGame && mode.type === 'normal' && (
                  <View style={styles.expandedContent}>
                    <Text style={styles.exerciseCount}>Game Day</Text>
                  </View>
                )}

                {isSelected && !hasWorkout && mode.type === 'normal' && (
                  <View style={styles.expandedContent}>
                    <Text style={styles.exerciseCount}>Recover & Recharge</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* ─── No Game This Week — Add One ─── */}
        {mode.type === 'normal' && !weekHasGame && showAddGameCTA && (
          <TouchableOpacity style={styles.addGameBanner} onPress={handleAddGameMode} activeOpacity={0.7}>
            <View style={styles.addGameIconWrap}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 5v14" />
                <Path d="M5 12h14" />
              </Svg>
            </View>
            <Text style={styles.addGameBannerText}>No game this week — add one</Text>
          </TouchableOpacity>
        )}

        {/* ─── Quick Actions ─── */}
        {mode.type === 'normal' && (
          <View style={styles.quickActionsSection}>
            <Text style={styles.quickActionsLabel}>NEED TO ADJUST YOUR WEEKLY PLAN?</Text>
            <View style={styles.scrollWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickActionsScroll}
              >
                {QUICK_ACTIONS.map((action) => (
                  <Pressable
                    key={action.label}
                    style={({ pressed }) => [
                      styles.quickActionChip,
                      action.prefill === '' && styles.quickActionChipHighlight,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => handleQuickAction(action.prefill)}
                  >
                    <Text
                      style={[
                        styles.quickActionText,
                        action.prefill === '' && styles.quickActionTextHighlight,
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
                style={styles.scrollFade}
                pointerEvents="none"
              />
            </View>
          </View>
        )}

        {/* ─── Season Phase Shift ─── */}
        {mode.type === 'normal' && (
          <View style={styles.phaseShiftSection}>
            <Text style={styles.phaseShiftLabel}>CHANGING SEASON PHASE?</Text>
            <Pressable
              style={({ pressed }) => [
                styles.phaseShiftButton,
                pressed && { opacity: 0.75 },
              ]}
              onPress={() => handleOpenPhaseShift(NEXT_PHASE[currentPhase])}
            >
              <Text style={styles.phaseShiftButtonText}>
                Shift to {NEXT_PHASE[currentPhase]} mode
              </Text>
            </Pressable>
            <Text style={styles.phaseShiftHint}>
              Currently in {currentPhase} mode
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ─── Game Day Action Modal ─── */}
      <Modal
        visible={gameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeGameModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeGameModal}>
          <Pressable style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{gameModalLabel}</Text>

            <View style={styles.modalCurrentBadge}>
              <View style={[styles.modalCurrentDot, { backgroundColor: '#C8FF00' }]} />
              <Text style={styles.modalCurrentText}>Game day</Text>
            </View>

            {/* Log Game — routes to SessionFeedbackPanel via startFinished */}
            <TouchableOpacity style={styles.modalOption} onPress={handleLogGame} activeOpacity={0.7}>
              <View style={[styles.modalOptionIcon, { backgroundColor: 'rgba(200, 255, 0, 0.12)' }]}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.accent.lime} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <Path d="M12 9a3 3 0 100 6 3 3 0 000-6z" />
                </Svg>
              </View>
              <Text style={styles.modalOptionText}>Log Game</Text>
            </TouchableOpacity>

            {/* Move Game Day */}
            <TouchableOpacity style={styles.modalOption} onPress={handleMoveGameDay} activeOpacity={0.7}>
              <View style={[styles.modalOptionIcon, { backgroundColor: 'rgba(200, 255, 0, 0.12)' }]}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.accent.lime} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M5 12h14" />
                  <Path d="M12 5l7 7-7 7" />
                </Svg>
              </View>
              <Text style={styles.modalOptionText}>Move Game Day This Week</Text>
            </TouchableOpacity>

            {/* Remove Game Day */}
            <TouchableOpacity style={styles.modalOption} onPress={handleRemoveGameDay} activeOpacity={0.7}>
              <View style={[styles.modalOptionIcon, { backgroundColor: 'rgba(244, 67, 54, 0.1)' }]}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.status.error} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M18 6L6 18" />
                  <Path d="M6 6l12 12" />
                </Svg>
              </View>
              <Text style={[styles.modalOptionText, { color: colors.status.error }]}>Remove Game Day</Text>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity style={styles.modalCancel} onPress={closeGameModal} activeOpacity={0.7}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Rebuild Week Confirm Modal ─── */}
      <Modal
        visible={rebuildModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelRebuild}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={isRebuilding ? undefined : handleCancelRebuild}
        >
          <Pressable style={styles.modalContent}>
            <View style={styles.modalHandle} />

            {isRebuilding ? (
              /* ── Building view ── */
              <View style={styles.rebuildBuildingView}>
                <ActivityIndicator
                  size="large"
                  color={colors.accent.lime}
                  style={styles.rebuildSpinner}
                />
                <Text style={styles.rebuildBuildingTitle}>
                  Building your program…
                </Text>
                <Text style={styles.rebuildBuildingSubtext}>
                  This can take up to 1 minute
                </Text>
                <Animated.View style={{ opacity: rebuildMsgOpacity }}>
                  <Text style={styles.rebuildRotatingMsg}>
                    {REBUILD_MESSAGES[rebuildMsgIdx]}
                  </Text>
                </Animated.View>
              </View>
            ) : (
              /* ── Confirm view ── */
              <>
                <Text style={styles.modalTitle}>Rebuild this week?</Text>
                <Text style={styles.rebuildBody}>
                  Fresh exercise content will be generated from your current profile.
                </Text>

                <View style={styles.rebuildNoteBlock}>
                  <Text style={styles.rebuildNotePreserved}>
                    ✓ Game days and logged workouts are preserved
                  </Text>
                  <Text style={styles.rebuildNoteWiped}>
                    ✗ Any custom exercise swaps will be lost
                  </Text>
                </View>

                {rebuildError && (
                  <Text style={styles.rebuildError}>{rebuildError}</Text>
                )}

                {/* Only show the primary button when the error is retryable
                    (or there is no error). For non-retryable failures the
                    user can only dismiss — we don't want to bait another
                    identical request. */}
                {(!rebuildError || rebuildErrorCanRetry) && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.rebuildConfirmButton,
                      pressed && { opacity: 0.75 },
                    ]}
                    onPress={handleConfirmRebuild}
                  >
                    <Text style={styles.rebuildConfirmText}>
                      {rebuildError ? 'Try again' : 'Rebuild week'}
                    </Text>
                  </Pressable>
                )}

                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={handleCancelRebuild}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelText}>
                    {rebuildError && !rebuildErrorCanRetry ? 'Close' : 'Cancel'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Phase Shift Confirm Modal ─── */}
      <Modal
        visible={phaseShiftModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelPhaseShift}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={isRebuilding ? undefined : handleCancelPhaseShift}
        >
          <Pressable style={styles.modalContent}>
            <View style={styles.modalHandle} />

            {/*
             * Back chevron — only visible once the athlete is past `confirm`
             * and the flow isn't rebuilding. Chromeless muted control; lives
             * above layout flow so it doesn't offset the centred title.
             */}
            {!(phaseShiftStep === 'building' || isRebuilding) &&
              phaseShiftStep !== 'confirm' && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  onPress={handlePhaseShiftBack}
                  style={styles.phaseShiftBackChevron}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.6}
                >
                  <Svg
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#8A8A8A"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Path d="M15 18l-6-6 6-6" />
                  </Svg>
                </TouchableOpacity>
              )}

            {phaseShiftStep === 'building' || isRebuilding ? (
              /* ── Building view (reuses rebuild spinner pattern) ── */
              <View style={styles.rebuildBuildingView}>
                <ActivityIndicator
                  size="large"
                  color={colors.accent.lime}
                  style={styles.rebuildSpinner}
                />
                <Text style={styles.rebuildBuildingTitle}>
                  Shifting to {targetPhase}…
                </Text>
                <Text style={styles.rebuildBuildingSubtext}>
                  This can take up to 1 minute
                </Text>
                <Animated.View style={{ opacity: rebuildMsgOpacity }}>
                  <Text style={styles.rebuildRotatingMsg}>
                    {PHASE_SHIFT_MESSAGES[rebuildMsgIdx]}
                  </Text>
                </Animated.View>
              </View>
            ) : phaseShiftStep === 'confirm' ? (
              /* ── Step 1 · Confirm view ── */
              <>
                <Text style={styles.modalTitle}>Shift to {targetPhase} mode?</Text>
                <Text style={styles.rebuildBody}>
                  Your whole program will rebuild around {targetPhase} priorities.
                </Text>

                <View style={styles.rebuildNoteBlock}>
                  <Text style={styles.rebuildNotePreserved}>
                    ✓ Game days are preserved
                  </Text>
                  <Text style={styles.rebuildNoteWiped}>
                    ✗ Any custom exercise swaps will be lost
                  </Text>
                  <Text style={styles.rebuildNotePreserved}>
                    ✓ Phase updated to {targetPhase}
                  </Text>
                </View>

                {rebuildError && (
                  <Text style={styles.rebuildError}>{rebuildError}</Text>
                )}

                {(!rebuildError || rebuildErrorCanRetry) && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.rebuildConfirmButton,
                      pressed && { opacity: 0.75 },
                    ]}
                    onPress={handleAdvancePhaseShift}
                  >
                    <Text style={styles.rebuildConfirmText}>
                      {rebuildError ? 'Try again' : 'Continue'}
                    </Text>
                  </Pressable>
                )}

                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={handleCancelPhaseShift}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelText}>
                    {rebuildError && !rebuildErrorCanRetry ? 'Close' : 'Cancel'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : phaseShiftStep === 'availability' ? (
              /* ── Step 2 · Availability re-confirmation ── */
              <>
                <Text style={styles.modalTitle}>What days can you train?</Text>
                <Text style={styles.rebuildBody}>
                  We'll plan your {targetPhase.toLowerCase()} week around these
                  days. Update them if your schedule has changed.
                </Text>

                <View style={styles.phaseShiftDayGrid}>
                  {WEEK_DAYS.map((day) => {
                    const selected = pendingPreferredDays.includes(day);
                    return (
                      <Pressable
                        key={day}
                        onPress={() => togglePendingPreferredDay(day)}
                        style={({ pressed }) => [
                          styles.phaseShiftDayChip,
                          selected && styles.phaseShiftDayChipSelected,
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.phaseShiftDayChipText,
                            selected && styles.phaseShiftDayChipTextSelected,
                          ]}
                        >
                          {DAY_SHORT[day]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {rebuildError && (
                  <Text style={styles.rebuildError}>{rebuildError}</Text>
                )}

                {(!rebuildError || rebuildErrorCanRetry) && (
                  <Pressable
                    disabled={pendingPreferredDays.length < 1}
                    style={({ pressed }) => [
                      styles.rebuildConfirmButton,
                      pendingPreferredDays.length < 1 &&
                        styles.rebuildConfirmButtonDisabled,
                      pressed &&
                        pendingPreferredDays.length >= 1 && { opacity: 0.75 },
                    ]}
                    onPress={handleAdvancePhaseShift}
                  >
                    <Text style={styles.rebuildConfirmText}>
                      {rebuildError
                        ? 'Try again'
                        : targetPhase === 'Off-season'
                        ? `Shift to ${targetPhase}`
                        : 'Continue'}
                    </Text>
                  </Pressable>
                )}

                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={handleCancelPhaseShift}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelText}>
                    {rebuildError && !rebuildErrorCanRetry ? 'Close' : 'Cancel'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : phaseShiftStep === 'teamDays' ? (
              /* ── Step 2 · Team training days ── */
              <>
                <Text style={styles.modalTitle}>Team training days</Text>
                <Text style={styles.rebuildBody}>
                  Which days does your team train? We'll keep heavy lower-body
                  and sprint work off these days.
                </Text>

                <View style={styles.phaseShiftDayGrid}>
                  {WEEK_DAYS.map((day) => {
                    const selected = pendingTeamDays.includes(day);
                    return (
                      <Pressable
                        key={day}
                        onPress={() => togglePendingTeamDay(day)}
                        style={({ pressed }) => [
                          styles.phaseShiftDayChip,
                          selected && styles.phaseShiftDayChipSelected,
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.phaseShiftDayChipText,
                            selected && styles.phaseShiftDayChipTextSelected,
                          ]}
                        >
                          {DAY_SHORT[day]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.phaseShiftHelper}>
                  Leave blank if you don't have team training this phase.
                </Text>

                {rebuildError && (
                  <Text style={styles.rebuildError}>{rebuildError}</Text>
                )}

                {(!rebuildError || rebuildErrorCanRetry) && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.rebuildConfirmButton,
                      pressed && { opacity: 0.75 },
                    ]}
                    onPress={handleAdvancePhaseShift}
                  >
                    <Text style={styles.rebuildConfirmText}>
                      {rebuildError
                        ? 'Try again'
                        : targetPhase === 'In-season'
                        ? 'Continue'
                        : `Shift to ${targetPhase}`}
                    </Text>
                  </Pressable>
                )}

                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={handleCancelPhaseShift}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelText}>
                    {rebuildError && !rebuildErrorCanRetry ? 'Close' : 'Cancel'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              /* ── Step 3 · Usual game day (in-season only) ── */
              <>
                <Text style={styles.modalTitle}>Usual game day</Text>
                <Text style={styles.rebuildBody}>
                  Which day do you usually play? We'll anchor weekly scheduling
                  around it (arms pump the day before, recovery after).
                </Text>

                <View style={styles.phaseShiftDayGrid}>
                  {WEEK_DAYS.map((day) => {
                    const selected = pendingGameDay === day;
                    return (
                      <Pressable
                        key={day}
                        onPress={() => setPendingGameDay(day)}
                        style={({ pressed }) => [
                          styles.phaseShiftDayChip,
                          selected && styles.phaseShiftDayChipSelected,
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.phaseShiftDayChipText,
                            selected && styles.phaseShiftDayChipTextSelected,
                          ]}
                        >
                          {DAY_SHORT[day]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {rebuildError && (
                  <Text style={styles.rebuildError}>{rebuildError}</Text>
                )}

                {(!rebuildError || rebuildErrorCanRetry) && (
                  <Pressable
                    disabled={!pendingGameDay}
                    style={({ pressed }) => [
                      styles.rebuildConfirmButton,
                      !pendingGameDay && styles.rebuildConfirmButtonDisabled,
                      pressed && pendingGameDay && { opacity: 0.75 },
                    ]}
                    onPress={handleAdvancePhaseShift}
                  >
                    <Text style={styles.rebuildConfirmText}>
                      {rebuildError ? 'Try again' : `Shift to ${targetPhase}`}
                    </Text>
                  </Pressable>
                )}

                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={handleCancelPhaseShift}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelText}>
                    {rebuildError && !rebuildErrorCanRetry ? 'Close' : 'Cancel'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Dev-only debug overlay */}
      {__DEV__ && ScheduleDebugPanel && <ScheduleDebugPanel weekDays={weekDays} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C0C',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },

  // ─── Week Navigation ───
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingHorizontal: 4,
  },
  navArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekLabelText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  thisWeekBadge: {
    backgroundColor: 'rgba(200, 255, 0, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  thisWeekBadgeText: {
    color: '#C8FF00',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // ─── Move Banner ───
  moveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(200, 255, 0, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 0, 0.25)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.md,
  },
  moveBannerText: {
    color: '#C8FF00',
    fontSize: 14,
    fontWeight: '600',
  },
  moveBannerCancel: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '600',
  },

  // ─── Add Game Banner ───
  addGameBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.md,
    gap: 10,
  },
  addGameIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(200, 255, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGameBannerText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
  },

  // ─── Day list ───
  dayList: {
    gap: spacing.sm,
  },

  // ─── Day rows ───
  dayRow: {
    backgroundColor: '#161616',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayRowSelected: {
    borderColor: '#C8FF00',
    backgroundColor: '#1A1D12',
  },
  dayRowToday: {
    borderColor: '#444444',
    backgroundColor: '#141814',
  },
  dayRowMoveSource: {
    borderColor: 'rgba(200, 255, 0, 0.3)',
    backgroundColor: '#161616',
    opacity: 0.5,
  },
  dayRowMoveTarget: {
    borderColor: 'rgba(200, 255, 0, 0.35)',
    backgroundColor: '#141814',
  },

  // ─── Day header ───
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  leftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayLabel: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    minWidth: 32,
  },
  dayLabelSelected: {
    color: '#C8FF00',
  },
  dayLabelToday: {
    color: '#C8FF00',
  },
  dayLabelMoveTarget: {
    color: '#C8FF00',
  },
  todayBadge: {
    backgroundColor: '#C8FF00',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  todayBadgeText: {
    color: '#0C0C0C',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  gameBadge: {
    backgroundColor: 'rgba(200, 255, 0, 0.20)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 0, 0.35)',
  },
  gameBadgeText: {
    color: '#C8FF00',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  movingBadge: {
    backgroundColor: 'rgba(200, 255, 0, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 0, 0.3)',
  },
  movingBadgeText: {
    color: '#C8FF00',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  workoutTitleBlock: {
    flex: 1,
    alignItems: 'flex-end',
    minWidth: 0,
  },
  workoutName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
  },
  workoutContext: {
    color: '#999999',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
    marginTop: 2,
  },
  combinedCondLabel: {
    color: '#C8FF00',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 2,
    opacity: 0.7,
  },
  restLabel: {
    flex: 1,
    color: '#444444',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
  },
  moveTargetLabel: {
    flex: 1,
    color: 'rgba(200, 255, 0, 0.5)',
    fontSize: 14,
    fontWeight: '500',
    fontStyle: 'italic',
    textAlign: 'right',
  },

  // Coach-authored note list — visible on every workout day where injury
  // adjustments have been applied. Lime accent matches the existing
  // "+ Conditioning" hint style (combinedCondLabel) so the eye picks
  // them up without competing with the workout name.
  coachNoteList: {
    marginTop: 8,
    gap: 2,
  },
  coachNoteText: {
    color: '#C8FF00',
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.85,
  },

  // ─── Expanded content ───
  expandedContent: {
    marginTop: 12,
    gap: 10,
  },
  exerciseCount: {
    color: '#888888',
    fontSize: 13,
  },
  viewWorkoutButton: {
    backgroundColor: '#C8FF00',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  viewWorkoutText: {
    color: '#0C0C0C',
    fontSize: 15,
    fontWeight: '700',
  },

  // ─── Quick Actions ───
  quickActionsSection: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  quickActionsLabel: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  scrollWrapper: {
    position: 'relative',
  },
  scrollFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 60,
  },
  quickActionsScroll: {
    gap: spacing.sm,
    paddingRight: 50,
  },
  quickActionChip: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  quickActionChipHighlight: {
    borderColor: '#C8FF00',
    backgroundColor: '#1A1E10',
  },
  quickActionText: {
    color: '#AAAAAA',
    fontSize: 13,
    fontWeight: '500',
  },
  quickActionTextHighlight: {
    color: '#C8FF00',
  },

  // ─── Season Phase Shift ───
  phaseShiftSection: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  phaseShiftLabel: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  phaseShiftButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#C8FF00',
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  phaseShiftButtonText: {
    color: '#C8FF00',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  phaseShiftHint: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // ─── Game Day Action Modal ───
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.primary.main,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.sm,
    paddingBottom: 40,
    paddingHorizontal: spacing.lg,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#444',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 6,
    textAlign: 'center',
  },
  modalCurrentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: spacing.lg,
  },
  modalCurrentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalCurrentText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2A2A',
  },
  modalOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text.primary,
  },
  modalCancel: {
    marginTop: spacing.md,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.primary.light,
    borderRadius: 12,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },

  // ─── Rebuild Week Modal ───
  rebuildBuildingView: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rebuildSpinner: {
    marginBottom: spacing.md,
  },
  rebuildBuildingTitle: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  rebuildBuildingSubtext: {
    color: colors.text.tertiary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  rebuildRotatingMsg: {
    color: colors.accent.lime,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    minHeight: 20,
    letterSpacing: 0.2,
  },
  rebuildBody: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  rebuildNoteBlock: {
    gap: 6,
    backgroundColor: colors.primary.light,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: spacing.md,
  },
  rebuildNotePreserved: {
    color: '#C8FF00',
    fontSize: 13,
    fontWeight: '600',
  },
  rebuildNoteWiped: {
    color: '#FF9AA2',
    fontSize: 13,
    fontWeight: '500',
  },
  rebuildError: {
    color: colors.status.error,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  rebuildConfirmButton: {
    backgroundColor: '#C8FF00',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  rebuildConfirmText: {
    color: '#0C0C0C',
    fontSize: 16,
    fontWeight: '700',
  },
  rebuildConfirmButtonDisabled: {
    backgroundColor: '#3A3A3A',
  },

  // ─── Phase shift day selector ───
  phaseShiftDayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  // Back chevron for the phase-shift modal — sits absolutely in the
  // top-left so it doesn't offset the centred title. Chromeless: no bg,
  // no border, muted grey (the actual stroke colour is set on the SVG).
  phaseShiftBackChevron: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    padding: 4,
    zIndex: 2,
  },
  phaseShiftDayChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    backgroundColor: colors.primary.light,
    minWidth: 56,
    alignItems: 'center',
  },
  phaseShiftDayChipSelected: {
    backgroundColor: '#C8FF00',
    borderColor: '#C8FF00',
  },
  phaseShiftDayChipText: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  phaseShiftDayChipTextSelected: {
    color: '#0C0C0C',
  },
  phaseShiftHelper: {
    color: colors.text.tertiary,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
