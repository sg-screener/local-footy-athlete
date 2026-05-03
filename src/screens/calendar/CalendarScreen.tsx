import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { useCalendarStore } from '../../store/calendarStore';
import { useProgramStore } from '../../store/programStore';
import { useMonthIndicators, useBlockBounds } from '../../hooks/useSchedule';
import Svg, { Path } from 'react-native-svg';

// ─── Constants ───

const DAYS_OF_WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const CALENDAR_PADDING = 16;
const CELL_GAP = 6;
const CELL_WIDTH = (SCREEN_WIDTH - CALENDAR_PADDING * 2 - CELL_GAP * 6) / 7;
const CELL_HEIGHT = CELL_WIDTH + 8; // Taller than wide to fit indicator

// ─── Indicator colors — single source of truth ───
const INDICATOR = {
  core: colors.accent.lime,           // #C8FF00
  optional: '#6B6B6B',                // Medium grey — visible but secondary
  recovery: '#5B9BD5',                // Soft blue
  conditioning: '#FF8C42',            // Warm orange — distinct from core/recovery
  game: colors.accent.lime,           // Lime ring + badge
} as const;

// ─── Helpers ───

function getMonthData(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Monday = 0, Sunday = 6 (ISO week)
  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek < 0) startDayOfWeek = 6;

  return { daysInMonth, startDayOfWeek };
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getTodayString(): string {
  const now = new Date();
  return toDateString(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatBlockDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function getDayOfWeekName(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

// ─── Session Type from Program Data ───
// Projects the weekly workout pattern ONLY within the current mini-cycle's dates.
// Does NOT generate or project beyond the program end date.

type DaySessionType = 'core' | 'optional' | 'recovery' | 'conditioning' | 'game' | 'rest' | null;

// ─── DayCell Component ───

interface DayCellProps {
  day: number | null;
  dateStr: string | null;
  isToday: boolean;
  isOverflow: boolean; // Day belongs to previous/next month
  sessionType: DaySessionType;
  isNextBlockStart: boolean;
  isOutsideBlock: boolean; // Date is beyond the current program block
  onPress: (dateStr: string) => void;
}

const DayCell = React.memo(({ day, dateStr, isToday, isOverflow, sessionType, isNextBlockStart, isOutsideBlock, onPress }: DayCellProps) => {
  if (day === null) {
    return <View style={styles.cellEmpty} />;
  }

  const handlePress = () => {
    if (dateStr) onPress(dateStr);
  };

  const isGame = sessionType === 'game';
  const hasSession = sessionType && sessionType !== 'rest';

  return (
    <TouchableOpacity
      style={[
        styles.cell,
        // Overflow days (prev/next month) are dimmed
        isOverflow && styles.cellOverflow,
        // Session days get a surface
        hasSession && !isGame && !isOverflow && styles.cellHasSession,
        // Game day: strongest visual — lime ring + tinted fill
        isGame && !isOverflow && styles.cellGame,
        // Today: solid accent ring (different from game ring)
        isToday && !isGame && styles.cellToday,
        // Both today AND game: combined styling
        isToday && isGame && styles.cellTodayGame,
        // Next block start: dashed-style outline indicator
        isNextBlockStart && !isOverflow && styles.cellNextBlock,
      ]}
      onPress={handlePress}
      activeOpacity={0.6}
    >
      {/* "New block" tag — shown on the day after current block ends */}
      {isNextBlockStart && !isOverflow && (
        <View style={styles.nextBlockTag}>
          <Text style={styles.nextBlockTagText}>NEW</Text>
        </View>
      )}

      {/* Date number */}
      <Text style={[
        styles.cellText,
        isOverflow && styles.cellTextOverflow,
        !isOverflow && !hasSession && !isToday && styles.cellTextEmpty,
        !isOverflow && hasSession && !isGame && styles.cellTextSession,
        isToday && !isGame && styles.cellTextToday,
        !isOverflow && isGame && styles.cellTextGame,
        !isOverflow && isNextBlockStart && styles.cellTextNextBlock,
      ]}>
        {day}
      </Text>

      {/* Session indicator — coloured dot below number (not on overflow) */}
      {hasSession && !isGame && !isOverflow && (
        <View style={[
          styles.indicator,
          sessionType === 'core' && styles.indicatorCore,
          sessionType === 'optional' && styles.indicatorOptional,
          sessionType === 'recovery' && styles.indicatorRecovery,
          sessionType === 'conditioning' && styles.indicatorConditioning,
        ]} />
      )}

      {/* Game day: "G" badge — visually distinct from dots */}
      {isGame && !isOverflow && (
        <View style={styles.gameBadge}>
          <Text style={styles.gameBadgeText}>G</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// ─── Day Action Modal ───

interface DayModalProps {
  visible: boolean;
  dateStr: string | null;
  currentType: DaySessionType;
  onClose: () => void;
  onSetGameDay: () => void;
  onRemoveGameDay: () => void;
  onSetRestDay: () => void;
  onViewDay: () => void;
  onViewWeek: () => void;
}

function DayActionModal({
  visible,
  dateStr,
  currentType,
  onClose,
  onSetGameDay,
  onRemoveGameDay,
  onSetRestDay,
  onViewDay,
  onViewWeek,
}: DayModalProps) {
  if (!dateStr) return null;

  const date = new Date(dateStr + 'T12:00:00');
  const dayName = date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
  const isGame = currentType === 'game';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContent}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{dayName}</Text>

          {currentType && currentType !== 'rest' && (
            <View style={styles.modalCurrentBadge}>
              <View style={[
                styles.modalCurrentDot,
                currentType === 'core' && { backgroundColor: INDICATOR.core },
                currentType === 'optional' && { backgroundColor: INDICATOR.optional },
                currentType === 'recovery' && { backgroundColor: INDICATOR.recovery },
                currentType === 'conditioning' && { backgroundColor: INDICATOR.conditioning },
                currentType === 'game' && { backgroundColor: INDICATOR.game },
              ]} />
              <Text style={styles.modalCurrentText}>
                {currentType === 'core' ? 'Core session' :
                 currentType === 'optional' ? 'Optional session' :
                 currentType === 'recovery' ? 'Recovery' :
                 currentType === 'game' ? 'Game day' : ''}
              </Text>
            </View>
          )}

          {/* View day — navigate to DayWorkoutScreen */}
          <TouchableOpacity style={styles.modalOption} onPress={onViewDay} activeOpacity={0.7}>
            <View style={[styles.modalOptionIcon, { backgroundColor: 'rgba(200, 255, 0, 0.12)' }]}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.accent.lime} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <Path d="M12 9a3 3 0 100 6 3 3 0 000-6z" />
              </Svg>
            </View>
            <Text style={styles.modalOptionText}>View day</Text>
          </TouchableOpacity>

          {/* View week — navigate to Program tab focused on this week */}
          <TouchableOpacity style={styles.modalOption} onPress={onViewWeek} activeOpacity={0.7}>
            <View style={[styles.modalOptionIcon, { backgroundColor: 'rgba(200, 255, 0, 0.12)' }]}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.accent.lime} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2z" />
                <Path d="M16 2v4" />
                <Path d="M8 2v4" />
                <Path d="M3 10h18" />
              </Svg>
            </View>
            <Text style={styles.modalOptionText}>View week</Text>
          </TouchableOpacity>

          {!isGame && (
            <TouchableOpacity style={styles.modalOption} onPress={onSetGameDay} activeOpacity={0.7}>
              <View style={[styles.modalOptionIcon, { backgroundColor: 'rgba(200, 255, 0, 0.12)' }]}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.accent.lime} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                  <Path d="M12 6v6l4 2" />
                </Svg>
              </View>
              <Text style={styles.modalOptionText}>Set as Game Day</Text>
            </TouchableOpacity>
          )}

          {isGame && (
            <TouchableOpacity style={styles.modalOption} onPress={onRemoveGameDay} activeOpacity={0.7}>
              <View style={[styles.modalOptionIcon, { backgroundColor: 'rgba(244, 67, 54, 0.1)' }]}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.status.error} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M18 6L6 18" />
                  <Path d="M6 6l12 12" />
                </Svg>
              </View>
              <Text style={[styles.modalOptionText, { color: colors.status.error }]}>Remove Game Day</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.modalOption} onPress={onSetRestDay} activeOpacity={0.7}>
            <View style={styles.modalOptionIcon}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.text.secondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M17 18a5 5 0 00-10 0" />
                <Path d="M12 2v4" />
                <Path d="M4.93 10.93l2.83 2.83" />
                <Path d="M2 18h2" />
                <Path d="M20 18h2" />
                <Path d="M19.07 10.93l-2.83 2.83" />
              </Svg>
            </View>
            <Text style={styles.modalOptionText}>Mark as Rest</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.modalCancel} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main Calendar Screen ───

export default function CalendarScreen() {
  const navigation = useNavigation<any>();
  const today = getTodayString();
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [modalVisible, setModalVisible] = useState(false);

  const {
    selectedDate,
    setSelectedDate,
    setGameDay,
    removeGameDay,
    setRestDay,
  } = useCalendarStore();
  // Read explicit calendar marks separately so the display filter below can
  // distinguish "user explicitly marked this as a game" from "resolver
  // projected a virtual game on usualGameDay".
  const markedDays = useCalendarStore((s) => s.markedDays);

  // New hooks: resolver-based, derive-on-read
  const sessionMap = useMonthIndicators(currentYear, currentMonth);
  const programBounds = useBlockBounds();

  /*
   * Display-layer game-day filter.
   *
   * The resolver legitimately knows the athlete's usual game day is
   * Saturday (profile.usualGameDay) and projects virtual games every
   * week so the planner can balance load around them. That assumption
   * MUST stay intact — coach + planner depend on it.
   *
   * But the calendar UI shouldn't display those projections forever.
   * If the user is on April and the current training block runs
   * 20 Apr – 17 May, a Saturday in June isn't a "scheduled game" — it's
   * an inferred recurrence the planner will only confirm when the next
   * block generates. Showing it as a game marker reads like the app has
   * already locked in months of fixtures.
   *
   * Rule, per spec:
   *   - Inside [startDate, endDate]: show every game marker (virtual or
   *     explicit) exactly as the resolver returned it.
   *   - Outside the block: only show 'game' if it's an EXPLICIT mark in
   *     calendarStore.markedDays (the user pinned it). Virtual game
   *     projections drop out and the cell renders as a normal day.
   *
   * Only `'game'` is filtered — core/optional/recovery/conditioning/rest
   * are passed through untouched. This is a pure rendering filter; the
   * stored profile, the resolver, and `sessionMap` itself are unchanged.
   */
  const displaySessionMap = useMemo(() => {
    const { startDate, endDate } = programBounds;
    // No block bounds yet (e.g. no program loaded) → don't filter.
    if (!startDate || !endDate) return sessionMap;

    const filtered: typeof sessionMap = {};
    for (const [date, indicator] of Object.entries(sessionMap)) {
      if (indicator === 'game') {
        const insideBlock = date >= startDate && date <= endDate;
        const explicitGame = markedDays[date] === 'game';
        if (!insideBlock && !explicitGame) {
          // Drop the virtual game; let the cell render as a normal day.
          continue;
        }
      }
      filtered[date] = indicator;
    }
    return filtered;
  }, [sessionMap, markedDays, programBounds.startDate, programBounds.endDate]);
  const { daysInMonth, startDayOfWeek } = useMemo(
    () => getMonthData(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  // Navigation
  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Day tap → open modal
  const handleDayPress = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
    setModalVisible(true);
  }, [setSelectedDate]);

  const closeModal = () => {
    setModalVisible(false);
    setSelectedDate(null);
  };

  // ─── Game Day Change Handlers ───
  // Derive-on-read architecture: just update calendarStore, done.
  // The resolver computes game proximity (G+1 recovery, G-1 reduction, etc.)
  // at render time from the raw calendar marks. No write-time recomputation needed.

  const handleSetGameDay = () => {
    if (!selectedDate) return;
    setGameDay(selectedDate);
    closeModal();
  };

  const handleRemoveGameDay = () => {
    if (!selectedDate) return;
    removeGameDay(selectedDate);

    // Clean up manual overrides that were created because of this game.
    // Overrides with intent 'gameProximity' and relatedGameDate matching
    // the removed game are now stale — the game they depended on is gone,
    // so the template derivation should take over again.
    const { overrideContexts, removeManualOverride } = useProgramStore.getState();
    for (const [date, ctx] of Object.entries(overrideContexts)) {
      if (ctx.intent === 'gameProximity' && ctx.relatedGameDate === selectedDate) {
        removeManualOverride(date);
      }
    }

    closeModal();
  };

  const handleSetRestDay = () => {
    if (!selectedDate) return;
    setRestDay(selectedDate);
    closeModal();
  };

  const handleViewDay = () => {
    if (!selectedDate) return;
    closeModal();
    navigation.navigate('ProgramTab', {
      screen: 'DayWorkout',
      params: { date: selectedDate },
    });
  };

  const handleViewWeek = () => {
    if (!selectedDate) return;
    closeModal();
    navigation.navigate('ProgramTab', {
      screen: 'Home',
      params: { initialDate: selectedDate },
    });
  };

  // Build calendar grid — fills leading/trailing cells with adjacent month dates
  const calendarRows = useMemo(() => {
    type CalendarCell = { day: number; dateStr: string; isOverflow: boolean };
    const rows: CalendarCell[][] = [];
    let currentRow: CalendarCell[] = [];

    // Leading overflow: last days of previous month
    if (startDayOfWeek > 0) {
      const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const day = prevMonthLastDay - i;
        currentRow.push({ day, dateStr: toDateString(prevYear, prevMonth, day), isOverflow: true });
      }
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      currentRow.push({ day, dateStr: toDateString(currentYear, currentMonth, day), isOverflow: false });
      if (currentRow.length === 7) {
        rows.push(currentRow);
        currentRow = [];
      }
    }

    // Trailing overflow: first days of next month
    if (currentRow.length > 0) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      let nextDay = 1;
      while (currentRow.length < 7) {
        currentRow.push({ day: nextDay, dateStr: toDateString(nextYear, nextMonth, nextDay), isOverflow: true });
        nextDay++;
      }
      rows.push(currentRow);
    }

    return rows;
  }, [currentYear, currentMonth, daysInMonth, startDayOfWeek]);

  // Modal reads the same filtered map so its "Game day" badge stays in
  // sync with the cell — tapping a Saturday outside the block won't open
  // a "Game day" modal for a projection that the calendar doesn't show.
  const selectedSessionType = selectedDate ? (displaySessionMap[selectedDate] || null) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Calendar</Text>
          {/* Badge slot reserved for future status indicators */}
        </View>

        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton} activeOpacity={0.6}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 18l-6-6 6-6" />
            </Svg>
          </TouchableOpacity>

          <Text style={styles.monthTitle}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </Text>

          <TouchableOpacity onPress={goToNextMonth} style={styles.navButton} activeOpacity={0.6}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M9 18l6-6-6-6" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Day of week headers */}
        <View style={styles.weekHeader}>
          {DAYS_OF_WEEK.map((day, i) => (
            <View key={i} style={styles.weekHeaderCell}>
              <Text style={styles.weekHeaderText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.grid}>
          {calendarRows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.gridRow}>
              {row.map((cell, cellIndex) => (
                <DayCell
                  key={cellIndex}
                  day={cell.day}
                  dateStr={cell.dateStr}
                  isToday={cell.dateStr === today}
                  isOverflow={cell.isOverflow}
                  sessionType={cell.dateStr ? (displaySessionMap[cell.dateStr] || null) : null}
                  isNextBlockStart={cell.dateStr === programBounds.nextBlockDate}
                  isOutsideBlock={
                    !!cell.dateStr &&
                    !!programBounds.endDate &&
                    cell.dateStr > programBounds.endDate &&
                    cell.dateStr !== programBounds.nextBlockDate
                  }
                  onPress={handleDayPress}
                />
              ))}
            </View>
          ))}
        </View>

        {/*
         * Legend — limited to Core / Optional / Recovery / Game.
         *
         * Conditioning dots still appear on calendar cells (see INDICATOR.
         * conditioning at the top of this file + the cell-render path),
         * but we deliberately don't surface that state in the legend here
         * — it's a detail most athletes read as "work" and doesn't need
         * its own key. Styling is tuned to read as secondary info: small
         * text, generous horizontal spacing, and a gentle opacity knock
         * so it recedes below the calendar itself.
         */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: INDICATOR.core }]} />
            <Text style={styles.legendText}>Core</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: INDICATOR.optional }]} />
            <Text style={styles.legendText}>Optional</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: INDICATOR.recovery }]} />
            <Text style={styles.legendText}>Recovery</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendGameBadge}>
              <Text style={styles.legendGameBadgeText}>G</Text>
            </View>
            <Text style={styles.legendText}>Game</Text>
          </View>
        </View>

        {/* Block info card — shows current mini-cycle dates */}
        {programBounds.startDate && programBounds.endDate && (
          <View style={styles.blockInfoCard}>
            <View style={styles.blockInfoRow}>
              <Text style={styles.blockInfoLabel}>Current training block</Text>
              <Text style={styles.blockInfoDates}>
                {formatBlockDate(programBounds.startDate)} – {formatBlockDate(programBounds.endDate)}
              </Text>
            </View>
            {programBounds.nextBlockDate && (
              <Text style={styles.blockInfoNote}>
                Next block will generate when this one ends or your schedule changes.
              </Text>
            )}
          </View>
        )}

        {/* Tip */}
        <View style={styles.tipContainer}>
          <Text style={styles.tipText}>
            Tap any day to set or change game days. Your weekly program will adjust automatically.
          </Text>
        </View>
      </ScrollView>

      {/* Day Action Modal */}
      <DayActionModal
        visible={modalVisible}
        dateStr={selectedDate}
        currentType={selectedSessionType}
        onClose={closeModal}
        onSetGameDay={handleSetGameDay}
        onRemoveGameDay={handleRemoveGameDay}
        onSetRestDay={handleSetRestDay}
        onViewDay={handleViewDay}
        onViewWeek={handleViewWeek}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary.dark,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CALENDAR_PADDING,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  // Month navigation
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CALENDAR_PADDING,
    paddingVertical: spacing.sm,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: 0.3,
  },

  // Week header
  weekHeader: {
    flexDirection: 'row',
    paddingHorizontal: CALENDAR_PADDING,
    marginBottom: 6,
  },
  weekHeaderCell: {
    width: CELL_WIDTH,
    marginHorizontal: CELL_GAP / 2,
    alignItems: 'center',
  },
  weekHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.tertiary,
    letterSpacing: 0.8,
  },

  // Calendar grid
  grid: {
    paddingHorizontal: CALENDAR_PADDING,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: CELL_GAP,
  },

  // ─── Day cells ───
  // Visual hierarchy: Game > Today > Core > Optional > Recovery > Empty
  cell: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    marginHorizontal: CELL_GAP / 2,
    backgroundColor: 'transparent',
  },
  cellEmpty: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    marginHorizontal: CELL_GAP / 2,
  },

  // Overflow day (previous/next month): very dimmed
  cellOverflow: {
    opacity: 0.3,
  },

  // Session day: subtle dark surface to separate from empty
  cellHasSession: {
    backgroundColor: '#1A1A1A',
  },

  // Today (non-game): white/grey ring
  cellToday: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1.5,
    borderColor: colors.neutral.gray300,
  },

  // Game day: lime ring + lime-tinted fill
  cellGame: {
    backgroundColor: 'rgba(200, 255, 0, 0.08)',
    borderWidth: 2,
    borderColor: colors.accent.lime,
  },

  // Today + Game combined
  cellTodayGame: {
    backgroundColor: 'rgba(200, 255, 0, 0.14)',
    borderWidth: 2.5,
    borderColor: colors.accent.lime,
  },

  // ─── Text states ───
  cellText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  cellTextEmpty: {
    color: colors.neutral.gray600,   // Very muted — empty days recede
  },
  cellTextSession: {
    color: colors.text.primary,       // Normal white for session days
    fontWeight: '500',
  },
  cellTextToday: {
    fontWeight: '800',
    color: colors.neutral.white,
  },
  cellTextGame: {
    fontWeight: '800',
    color: colors.accent.lime,
  },
  cellTextOverflow: {
    color: colors.neutral.gray600,
    fontWeight: '400',
  },

  // ─── Session indicators — dots below the date number ───
  indicator: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginTop: 4,
  },
  indicatorCore: {
    backgroundColor: INDICATOR.core,
  },
  indicatorOptional: {
    backgroundColor: INDICATOR.optional,
  },
  indicatorRecovery: {
    backgroundColor: INDICATOR.recovery,
  },
  indicatorConditioning: {
    backgroundColor: INDICATOR.conditioning,
  },

  // ─── Next block start marker ───
  cellNextBlock: {
    borderWidth: 1.5,
    borderColor: colors.neutral.gray500,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  nextBlockTag: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.neutral.gray600,
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 0.5,
  },
  nextBlockTagText: {
    fontSize: 6,
    fontWeight: '800',
    color: colors.neutral.gray200,
    letterSpacing: 0.5,
  },
  cellTextNextBlock: {
    color: colors.neutral.gray300,
  },

  // ─── Game badge — small "G" pill, more distinct than a dot ───
  gameBadge: {
    marginTop: 3,
    backgroundColor: colors.accent.lime,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  gameBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: colors.primary.dark,
    letterSpacing: 0.3,
  },

  // ─── Legend ───
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: CALENDAR_PADDING,
    paddingTop: spacing.lg,
    // Wider horizontal rhythm so each key breathes — the legend is reference
    // material, not a row of tappables, so generous spacing reads better
    // than tight grouping.
    gap: 24,
    // Sits visually below the calendar itself. Applied to the legend
    // container so the dots, game badge, and labels all recede together
    // as a single block of secondary info.
    opacity: 0.72,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendGameBadge: {
    backgroundColor: colors.accent.lime,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  legendGameBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: colors.primary.dark,
    letterSpacing: 0.3,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.secondary,
    letterSpacing: 0.2,
  },

  // ─── Block info card ───
  blockInfoCard: {
    marginHorizontal: CALENDAR_PADDING,
    marginTop: spacing.lg,
    backgroundColor: colors.surface.secondary,
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.gray700,
  },
  blockInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  blockInfoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  blockInfoDates: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.primary,
  },
  blockInfoNote: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 8,
    lineHeight: 16,
  },

  // ─── Tip ───
  tipContainer: {
    paddingHorizontal: CALENDAR_PADDING + 12,
    paddingTop: spacing.lg,
    alignItems: 'center',
  },
  tipText: {
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 18,
  },

  // ─── Modal ───
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
    backgroundColor: colors.neutral.gray600,
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
    borderBottomColor: colors.neutral.gray700,
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
});
