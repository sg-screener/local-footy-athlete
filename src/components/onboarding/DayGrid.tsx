import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SelectableTile } from '../common/SelectableTile';
import { Text } from '../common/Text';
import { colors } from '../../theme/colors';
import { DayOfWeek } from '../../types/domain';
import { DAYS_OF_WEEK } from '../../rules/gameAnchor';

/**
 * Canonical day-of-week picker used across onboarding and anywhere else the
 * athlete picks days of the week.
 *
 * Layout matches the in-app season-shift picker: four compact chips on the
 * first row and three centred underneath, all using three-letter labels.
 *
 *   Mon  Tue  Wed  Thu
 *      Fri  Sat  Sun
 */

const DAYS: { id: DayOfWeek; label: string }[] = DAYS_OF_WEEK.map((day) => ({
  id: day,
  label: day.slice(0, 3),
}));

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
        shape="chip"
        isSelected={isSelected}
        dimmed={dimmed}
        onPress={() => onToggleDay(day.id)}
        accessibilityLabel={day.id}
        hideCheckmark
        style={styles.dayTile}
      >
        <Text
          variant="bodyEmphasis"
          color={isSelected ? colors.accent.lime : colors.text.primary}
          style={styles.dayLabel}
        >
          {day.label}
        </Text>
      </SelectableTile>
    );
  };

  return <View style={styles.dayGrid}>{DAYS.map(renderDay)}</View>;
};

const styles = StyleSheet.create({
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  dayTile: {
    width: '22%',
    minWidth: 58,
    alignItems: 'center',
  },
  dayLabel: {
    fontWeight: '600',
  },
});
