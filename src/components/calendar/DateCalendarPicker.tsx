import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../common/Text';
import { spacing } from '../../theme/spacing';
import {
  MONTH_NAMES,
  dayOfWeekForISODate,
  shortDayMonthLabel,
  todayISOLocal,
} from '../../utils/appDate';
import { addDaysISO } from '../../utils/programBlockState';
import { DAY_SHORT, WEEK_DAYS } from '../../screens/home/homeScreenConstants';

export interface DateCalendarPickerProps {
  onPick: (dateISO: string) => void;
  minISO?: string;
  maxISO?: string;
  initialMonthISO?: string;
  selectedISO?: string | null;
  testIDPrefix?: string;
}

/**
 * The app's one month-grid date picker.
 *
 * Away uses an open-ended future calendar. Season finish uses the same grid
 * capped at today, so the athlete never has to type a year or construct an ISO
 * date themselves. Bounds govern selectable days; the calendar remains a
 * month-at-a-time surface in both directions where the caller permits it.
 */
export function DateCalendarPicker({
  onPick,
  minISO,
  maxISO,
  initialMonthISO,
  selectedISO = null,
  testIDPrefix = 'home-away-return',
}: DateCalendarPickerProps) {
  const openingISO = initialMonthISO
    ?? selectedISO
    ?? minISO
    ?? maxISO
    ?? todayISOLocal();
  const [monthAnchorISO, setMonthAnchorISO] = useState(openingISO);

  useEffect(() => {
    setMonthAnchorISO(openingISO);
  }, [openingISO]);

  const anchor = monthAnchorISO.slice(0, 10);
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7));
  const firstOfMonth = `${anchor.slice(0, 7)}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastOfMonth = `${anchor.slice(0, 7)}-${String(daysInMonth).padStart(2, '0')}`;
  // Monday-first, matching every other week shape in the app.
  const leadingBlanks = (dayOfWeekForISODate(firstOfMonth) + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_unused, index) =>
      `${anchor.slice(0, 7)}-${String(index + 1).padStart(2, '0')}`),
  ];
  const previousMonthISO = addDaysISO(firstOfMonth, -1);
  const nextMonthISO = addDaysISO(lastOfMonth, 1);
  const previousDisabled = Boolean(minISO && previousMonthISO.slice(0, 7) < minISO.slice(0, 7));
  const nextDisabled = Boolean(maxISO && nextMonthISO.slice(0, 7) > maxISO.slice(0, 7));

  return (
    <View testID={`${testIDPrefix}-calendar`}>
      <View style={styles.head}>
        <Pressable
          onPress={() => setMonthAnchorISO(previousMonthISO)}
          disabled={previousDisabled}
          testID={`${testIDPrefix}-prev-month`}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          accessibilityState={{ disabled: previousDisabled }}
          style={({ pressed }) => [
            styles.nav,
            previousDisabled && styles.navDisabled,
            pressed && !previousDisabled && styles.pressed,
          ]}
        >
          <Text style={styles.navLabel}>‹</Text>
        </Pressable>
        <Text style={styles.month}>
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        <Pressable
          onPress={() => setMonthAnchorISO(nextMonthISO)}
          disabled={nextDisabled}
          testID={`${testIDPrefix}-next-month`}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: nextDisabled }}
          style={({ pressed }) => [
            styles.nav,
            nextDisabled && styles.navDisabled,
            pressed && !nextDisabled && styles.pressed,
          ]}
        >
          <Text style={styles.navLabel}>›</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {WEEK_DAYS.map((day) => (
          <View key={`head-${day}`} style={styles.cell}>
            <Text style={styles.weekday}>{DAY_SHORT[day]}</Text>
          </View>
        ))}
        {cells.map((dateISO, index) => {
          if (dateISO === null) {
            return <View key={`blank-${index}`} style={styles.cell} />;
          }
          const selectable = (!minISO || dateISO >= minISO) && (!maxISO || dateISO <= maxISO);
          const selected = dateISO === selectedISO;
          return (
            <Pressable
              key={dateISO}
              disabled={!selectable}
              onPress={() => onPick(dateISO)}
              testID={`${testIDPrefix}-${dateISO}`}
              accessibilityRole="button"
              accessibilityLabel={shortDayMonthLabel(dateISO)}
              accessibilityState={{ disabled: !selectable, selected }}
              style={({ pressed }) => [
                styles.cell,
                selected && styles.cellSelected,
                pressed && selectable && styles.pressed,
              ]}
            >
              <Text style={[
                styles.day,
                !selectable && styles.dayDisabled,
                selected && styles.daySelected,
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

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.sm, marginBottom: spacing.xs,
  },
  nav: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  navDisabled: { opacity: 0.3 },
  navLabel: { color: '#FFFFFF', fontSize: 22, lineHeight: 24 },
  month: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  cellSelected: { backgroundColor: '#C8FF00', borderRadius: 20 },
  weekday: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600' },
  day: { color: '#FFFFFF', fontSize: 15 },
  dayDisabled: { color: 'rgba(255,255,255,0.22)' },
  daySelected: { color: '#0C0C0C', fontWeight: '800' },
  pressed: { opacity: 0.6 },
});
