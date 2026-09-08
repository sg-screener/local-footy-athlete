import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Text } from '../../components/common/Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { ProgressStackParamList } from '../../navigation/ProgressNavigator';
import { PROGRESS_PERIODS, filterProgressPeriod, progressAvailableDateRange, progressDateRange, type ProgressPeriod } from '../../rules/progressPeriod';
import { progressChartDateRangeLabel } from '../../rules/progressChartTimeline';
import { progressLoadWeekBaseline, type ProgressLoadWeek } from '../../rules/progressLoadHistory';
import { useProgressLoadHistory } from './useProgressLoadHistory';

const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-AU', { weekday: 'long', timeZone: 'UTC' });
const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const au = (value: number) => Math.round(value).toLocaleString('en-AU');

function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={12}
      style={({ pressed }) => [styles.back, pressed && styles.pressed]} testID="progress-load-history-back">
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#B5B5B5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M15 18l-6-6 6-6" />
      </Svg>
    </Pressable>
    <Text variant="h1" style={styles.title}>{title}</Text>
  </View>;
}

function WeeklyBars({ weeks, selected, baseline, onSelect }: {
  weeks: readonly ProgressLoadWeek[]; selected: string | undefined; baseline: number | undefined; onSelect: (date: string) => void;
}) {
  const [width, setWidth] = React.useState(320);
  const height = 160, left = 38, right = 8, top = 12, bottom = 132;
  const maximum = Math.max(...weeks.map(week => week.value), baseline ?? 0, 1);
  const magnitude = 10 ** Math.floor(Math.log10(maximum));
  const cap = Math.ceil(maximum / magnitude) * magnitude;
  const y = (value: number) => bottom - value / cap * (bottom - top);
  const first = weeks[0]?.weekStart, last = weeks.at(-1)?.weekStart;
  const span = first && last ? (Date.parse(last) - Date.parse(first)) / (7 * 86400000) : 0;
  const slot = (width - left - right) / (span + 1);
  const x = (date: string) => left + ((Date.parse(date) - Date.parse(first!)) / (7 * 86400000) + 0.5) * slot;
  const barWidth = Math.max(2, Math.min(32, slot * 0.7));
  const labelStep = Math.max(1, Math.ceil(weeks.length / 4));
  return <View onLayout={event => setWidth(Math.max(160, event.nativeEvent.layout.width))}>
    {!weeks.length ? <Text variant="bodySmall" style={styles.empty}>Your load history builds as you complete and rate sessions.</Text> : <>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[cap, cap / 2, 0].map(value => <React.Fragment key={value}>
          <Line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke={colors.neutral.gray700} strokeWidth={0.5} />
          <SvgText x={left - 6} y={y(value) + 3} textAnchor="end" fontSize={10} fill={colors.text.secondary}>{au(value)}</SvgText>
        </React.Fragment>)}
        {weeks.map((week, index) => <React.Fragment key={week.weekStart}>
          <Rect x={x(week.weekStart) - barWidth / 2} y={y(week.value)} width={barWidth} height={Math.max(2, bottom - y(week.value))}
            rx={2} fill={week.weekStart === selected ? colors.accent.lime : '#4A4C4A'} />
          {(index % labelStep === 0 || index === weeks.length - 1) && <SvgText x={x(week.weekStart)} y={151}
            textAnchor="middle" fontSize={9} fill={colors.text.secondary}>{shortDate(week.weekStart)}</SvgText>}
        </React.Fragment>)}
        {baseline !== undefined && <Line x1={left} x2={width - right} y1={y(baseline)} y2={y(baseline)}
          stroke={colors.accent.lime} strokeDasharray="5 4" strokeWidth={1} pointerEvents="none" />}
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {weeks.map(week => <Pressable key={week.weekStart} accessibilityRole="button"
          accessibilityLabel={`Week of ${shortDate(week.weekStart)}, ${au(week.value)} AU`}
          accessibilityState={{ selected: week.weekStart === selected }} onPress={() => onSelect(week.weekStart)}
          style={{ position: 'absolute', left: x(week.weekStart) - slot / 2, top, width: slot, height: bottom - top + 4 }}
          testID={`load-history-week-${week.weekStart}`} />)}
      </View>
      {baseline !== undefined && <Text variant="caption" style={styles.baseline}>- - Previous 4-week average: {au(baseline)} AU</Text>}
      <Text variant="caption" style={styles.chartHint}>Tap a week to view its details.</Text>
    </>}
  </View>;
}

export default function LoadHistoryScreen({ navigation, route }: NativeStackScreenProps<ProgressStackParamList, 'LoadHistory'>) {
  const { weeks, asOfDateISO } = useProgressLoadHistory();
  const [period, setPeriod] = React.useState<ProgressPeriod>(route.params.period);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const range = progressDateRange(period, asOfDateISO);
  const visibleWeeks = filterProgressPeriod(weeks, range, week => week.weekStart);
  const selected = visibleWeeks.find(week => week.weekStart === selectedDate) ?? visibleWeeks.at(-1);
  const selectedIndex = selected ? visibleWeeks.indexOf(selected) : -1;
  const baseline = progressLoadWeekBaseline(weeks, selected);
  const dates = progressAvailableDateRange(range, visibleWeeks.map(week => week.weekStart));
  const rangeLabel = dates ? (dates.startDateISO.slice(0, 4) === dates.endDateISO.slice(0, 4)
    ? `${shortDate(dates.startDateISO)} – ${shortDate(dates.endDateISO)}`
    : [dates.startDateISO, dates.endDateISO].map(iso => { const [year, month, day] = iso.split('-'); return `${+day}/${+month}/${year.slice(2)}`; }).join('–')) : 'No data yet';
  const selectPeriod = (next: ProgressPeriod) => { setPeriod(next); setSelectedDate(null); };
  return <SafeAreaView style={styles.root} edges={['top', 'left', 'right']} testID="progress-load-history-page">
    <PageHeader title="Load history" onBack={() => navigation.goBack()} />
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="bodySmall" style={styles.subtitle}>See how your weekly training load changes over time.</Text>
      <View style={styles.periodRow}>
        <View style={styles.toggle} accessibilityRole="tablist">
          {PROGRESS_PERIODS.map(option => <Pressable key={option.id} accessibilityRole="tab" accessibilityLabel={option.label}
            accessibilityState={{ selected: period === option.id }} onPress={() => selectPeriod(option.id)}
            style={[styles.option, period === option.id && styles.optionSelected]} testID={`load-history-period-${option.id}`}>
            <Text variant="bodySmallEmphasis" numberOfLines={1} style={[styles.optionText, period === option.id && styles.optionActive]}>{option.label}</Text>
          </Pressable>)}
        </View>
        <Text variant="caption" style={styles.dates} numberOfLines={1}>{rangeLabel}</Text>
      </View>
      <View style={styles.card}>
        <Text variant="labelSmall" style={styles.kicker}>Weekly load (AU)</Text>
        <WeeklyBars weeks={visibleWeeks.filter(week => week.sessions.some(session => session.measured))} selected={selected?.weekStart} baseline={baseline?.average} onSelect={setSelectedDate} />
      </View>
      {selected && <>
        <View style={styles.card} testID="load-history-selected-week">
          <View style={styles.weekNavigation}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous recorded week" disabled={selectedIndex <= 0}
              onPress={() => setSelectedDate(visibleWeeks[selectedIndex - 1].weekStart)} style={[styles.weekArrow, selectedIndex <= 0 && styles.disabled]} testID="load-history-previous-week">
              <Text variant="h3" style={styles.muted}>‹</Text>
            </Pressable>
            <Text variant="labelSmall" style={styles.kicker}>Week of {progressChartDateRangeLabel([{ dateISO: selected.weekStart }, { dateISO: addDays(selected.weekStart, 6) }])}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Next recorded week" disabled={selectedIndex >= visibleWeeks.length - 1}
              onPress={() => setSelectedDate(visibleWeeks[selectedIndex + 1].weekStart)} style={[styles.weekArrow, selectedIndex >= visibleWeeks.length - 1 && styles.disabled]} testID="load-history-next-week">
              <Text variant="h3" style={styles.muted}>›</Text>
            </Pressable>
          </View>
          <Text variant="h1" style={styles.total} testID="load-history-week-total">{selected.sessions.some(session => session.measured) ? `${au(selected.value)} AU` : 'Not measured'}</Text>
          {baseline ? <Text variant="bodySmall" style={styles.muted}>
            <Text variant="bodyEmphasis" style={baseline.direction === 'up' ? styles.green : styles.muted}>
              {baseline.direction === 'up' ? '↑' : baseline.direction === 'down' ? '↓' : '→'} {Math.abs(baseline.percentChange)}% </Text>
            {baseline.direction === 'up' ? 'above' : baseline.direction === 'down' ? 'below' : 'change from'} your previous 4-week average
          </Text> : <Text variant="bodySmall" style={styles.muted}>More history needed for a 4-week comparison.</Text>}
          <Text variant="caption" style={styles.explanation}>AU = session length × effort.</Text>
        </View>
        <Text variant="labelSmall" style={styles.kicker}>Sessions this week</Text>
        <View style={styles.sessionCard}>
          {selected.sessions.map(session => <Pressable key={session.date} accessibilityRole="button"
            accessibilityLabel={`${weekday(session.date)}, ${session.title}, ${session.measured ? `${au(session.value)} AU` : 'Not measured'}`}
            onPress={() => navigation.navigate('RecordedLoadSession', { date: session.date })}
            style={({ pressed }) => [styles.sessionRow, pressed && styles.pressed]} testID={`load-history-session-${session.date}`}>
            <View style={styles.sessionIdentity}>
              <Text variant="bodySmallEmphasis">{weekday(session.date)} · {session.title}</Text>
              <Text variant="caption" style={styles.muted}>{session.parts.length === 1
                ? `${session.parts[0].minutes ?? '—'} min · ${session.parts[0].effort ?? '—'}/10`
                : session.parts.length ? `${session.parts.length} recorded parts · tap for breakdown` : 'No duration and effort recorded'}</Text>
            </View>
            <Text variant="bodySmallEmphasis">{session.measured ? `${au(session.value)} AU` : 'Not measured'}</Text>
            <Text variant="h3" style={styles.muted}>›</Text>
          </Pressable>)}
        </View>
        <Text variant="caption" style={styles.chartHint}>Tap a session to view its recorded summary.</Text>
      </>}
    </ScrollView>
  </SafeAreaView>;
}

export function RecordedLoadSessionScreen({ navigation, route }: NativeStackScreenProps<ProgressStackParamList, 'RecordedLoadSession'>) {
  const { weeks } = useProgressLoadHistory();
  const session = weeks.flatMap(week => week.sessions).find(value => value.date === route.params.date);
  return <SafeAreaView style={styles.root} edges={['top', 'left', 'right']} testID="load-history-session-page">
    <PageHeader title="Session summary" onBack={() => navigation.goBack()} />
    <ScrollView contentContainerStyle={styles.content}>
      {session ? <>
        <Text variant="labelSmall" style={styles.kicker}>{weekday(session.date)} · {shortDate(session.date)}</Text>
        <Text variant="h3">{session.title}</Text>
        <View style={styles.card}>
          <Text variant="labelSmall" style={styles.kicker}>Recorded load</Text>
          <Text variant="h1" style={styles.total}>{session.measured ? `${au(session.value)} AU` : 'Not measured'}</Text>
          <Text variant="bodySmall" style={styles.muted}>{session.record.completion === 'full' ? 'Completed' : session.record.completion === 'partial' ? 'Partly completed' : session.record.completion === 'skipped' ? 'Skipped' : 'Recorded session'}</Text>
          {session.parts.map((part, index) => <View key={index} style={styles.part}>
            <Text variant="bodySmallEmphasis">{part.label}</Text>
            <Text variant="bodySmall" style={styles.muted}>{part.minutes ?? '—'} min · effort {part.effort ?? '—'}/10</Text>
            <Text variant="bodySmallEmphasis">{part.value === null ? 'Not measured' : `${au(part.value)} AU`}</Text>
          </View>)}
          <Text variant="caption" style={styles.explanation}>AU = session length × effort. Missing ratings are not estimated.</Text>
        </View>
        {session.record.strength.length > 0 && <View style={styles.card}>
          <Text variant="labelSmall" style={styles.kicker}>Recorded lifts</Text>
          {session.record.strength.map((lift, index) => <View key={index} style={styles.part}>
            <Text variant="bodySmallEmphasis">{lift.exerciseName}</Text>
            <Text variant="caption" style={styles.muted}>{lift.completion === 'skipped' ? 'Skipped' : `${lift.completedSets != null ? `${lift.completedSets} sets` : 'Sets not recorded'} · ${lift.actualReps != null ? `${lift.actualReps} reps` : 'Reps not recorded'}${lift.weightKg != null ? ` · ${lift.weightKg} kg` : ''}`}</Text>
          </View>)}
        </View>}
        {session.record.notes ? <View style={styles.card}><Text variant="labelSmall" style={styles.kicker}>Your notes</Text><Text variant="bodySmall">{session.record.notes}</Text></View> : null}
      </> : <Text variant="bodySmall" style={styles.empty}>This recorded session is no longer available.</Text>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.primary },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingHorizontal: 12 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, lineHeight: 34, flex: 1 },
  content: { padding: spacing.md, paddingTop: 0, paddingBottom: 32, gap: 16 },
  subtitle: { color: colors.text.secondary, marginLeft: 40, marginBottom: 4 },
  muted: { color: colors.text.secondary },
  green: { color: colors.status.successLight },
  kicker: { color: colors.text.secondary, textTransform: 'uppercase', flexShrink: 1 },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggle: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 30, padding: 4 },
  option: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 30 },
  optionSelected: { backgroundColor: 'rgba(216,216,0,0.14)' },
  optionText: { fontSize: 12, color: colors.text.secondary },
  optionActive: { color: colors.text.accent },
  dates: { width: 112, fontSize: 12, textAlign: 'right', color: colors.text.secondary },
  card: { padding: spacing.md, borderWidth: 1, borderColor: colors.neutral.gray700, borderRadius: 18, backgroundColor: colors.surface.secondary, gap: 10 },
  baseline: { color: colors.text.secondary, fontSize: 10, marginTop: 4 },
  chartHint: { color: colors.text.secondary, textAlign: 'center', marginTop: 8 },
  total: { fontSize: 34, lineHeight: 42 },
  explanation: { color: colors.text.secondary, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.neutral.gray700, paddingTop: 12, marginTop: 4 },
  // Keep the 44-point arrow targets without letting them add padding around the label.
  weekNavigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginVertical: -(44 - typography.labelSmall.lineHeight) / 2 },
  weekArrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.25 },
  sessionCard: { borderWidth: 1, borderColor: colors.neutral.gray700, borderRadius: 18, backgroundColor: colors.surface.secondary, overflow: 'hidden' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: 8, minHeight: 76, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.neutral.gray700 },
  sessionIdentity: { flex: 1, gap: 4 },
  part: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.neutral.gray700, paddingTop: 12, gap: 4 },
  pressed: { opacity: 0.6 },
  empty: { color: colors.text.secondary, textAlign: 'center', paddingVertical: 32 },
});
