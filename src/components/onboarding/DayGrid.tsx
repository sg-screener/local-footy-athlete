import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SelectableTile } from '../common/SelectableTile';
import { Text } from '../common/Text';
import { colors } from '../../theme/colors';
import { DayOfWeek } from '../../types/domain';

/**
 * Canonical day-of-week grid used across onboarding (PreferredTrainingDays,
 * TeamTrainingDays) and anywhere else the athlete picks days of the week.
 *
 * Layout is Mon–Sat in a 3-up grid (12px gap, 31% tile width), then Sunday
 * sits centered on its own row underneath so the final row feels
 * deliberate rather than orphaned on the left.
 *
 *   Mon  Tue  Wed
 *   Thu  Fri  Sat
 *        Sun
 *
 * This is deliberately a component (not just a style export) so the
 * Sunday-row split, dim/select rules, and tile contents stay in lockstep
 * across every consumer — no per-screen special casing.
 */

const DAYS: { id: DayOfWeek; label: string }[] = [
  { id: 'Monday', label: 'Mon' },
  { id: 'Tuesday', label: 'Tue' },
  { id: 'Wednesday', label: 'Wed' },
  { id: 'Thursday', label: 'Thu' },
  { id: 'Friday', label: 'Fri' },
  { id: 'Saturday', label: 'Sat' },
  { id: 'Sunday', label: 'Sun' },
];

export interface DayGridProps {
  /** Currently selected days. */
  selectedDays: DayOfWeek[];
  /** Toggle handler for a single day. */
  onToggleDay: (day: DayOfWeek) => void;
  /**
   * Optional: dim unselected tiles (e.g. when a hard cap is hit on
   * PreferredTrainingDays). Only consulted for tiles that aren't already
   * selected.
   */
  isDimmed?: (day: DayOfWeek) => boolean;
}

export const DayGrid: React.FC<DayGridProps> = ({
  selectedDays,
  onToggleDay,
  isDimmed,
}) => {
  const renderDay = (day: { id: DayOfWeek; label: string }) => {
    const isSelected = selectedDays.includes(day.id);
    const dimmed = !isSelected && (isDimmed?.(day.id) ?? false);
    return (
      <SelectableTile
        key={day.id}
        isSelected={isSelected}
        dimmed={dimmed}
        onPress={() => onToggleDay(day.id)}
        hideCheckmark
        style={styles.dayTile}
      >
        <Text
          variant="bodyEmphasis"
          color={colors.text.primary}
          style={styles.dayLabel}
        >
          {day.label}
        </Text>
      </SelectableTile>
    );
  };

  // 7 days don't divide evenly into a 3-column grid. Splitting the render
  // (Mon–Sat in the wrap container, Sunday centered alone) keeps the lone
  // tile from looking like an accidental orphan on the left edge — and
  // critically, every tile keeps its identical 31% width.
  return (
    <>
      <View style={styles.daysContainer}>{DAYS.slice(0, 6).map(renderDay)}</View>
      <View style={styles.lastRow}>{renderDay(DAYS[6])}</View>
    </>
  );
};

const styles = StyleSheet.create({
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  // Sunday's standalone row — sits the same 12px below the Mon–Sat grid
  // (mirrors `daysContainer.gap`) and centers the lone tile horizontally.
  // Sunday keeps the same width:'31%' as every other tile; we only
  // centre-align it inside a full-width wrapper.
  lastRow: {
    marginTop: 12,
    alignItems: 'center',
  },
  dayTile: {
    width: '31%',
    paddingHorizontal: 20,
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayLabel: {
    fontWeight: '600',
  },
});
