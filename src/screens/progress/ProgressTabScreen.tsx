import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProgressStackParamList } from '../../navigation/ProgressNavigator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useProfileStore } from '../../store/profileStore';
import { TRACKED_LIFT_PAIRS, type TrackedLiftSlot } from '../../rules/estimatedOneRepMax';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { Text } from '../../components/common/Text';
import { LfaWordmark } from '../../components/branding/LfaWordmark';
import { useResolvedWeek } from '../../hooks/useSchedule';
import { useActiveModifiers } from '../../hooks/useActiveModifiers';
import { useLiveAthleteSnapshot } from '../coach/useLiveAthleteSnapshot';
import type { CoachSnapshotLoad } from '../../rules/liveAthleteSnapshot';
import type { ProgressMainLiftHistory } from '../../rules/progressMainLiftStrength';
import {
  COACH_DASHBOARD_COPY,
  coachLoadGuidance,
  coachLoadMarkerFraction,
  coachLoadSummary,
} from '../../rules/snapshotDashboardCopy';
import { PROGRESS_TAB_COPY, PROGRESS_LIFT_CALCULATION_COPY, progressLiftLabel } from '../../rules/progressTabCopy';
import type {
  PerformanceTestCategory,
  PerformanceTestId,
  PerformanceTesting,
} from '../../types/domain';
import {
  PERFORMANCE_TEST_CATEGORIES,
  comparePerformanceTestResults,
  formatPerformanceTestResult,
  parsePerformanceTestResult,
  performanceTestDefinition,
  performanceTestsForCategory,
  recordPerformanceTestResult,
  resultsForPerformanceTest,
  selectedPerformanceTest,
  validatePerformanceTestResult,
} from '../../data/performanceTests';
import { commitProfileProgramTransaction } from '../../store/profileProgramTransaction';
import { validateOnboardingMeasurement } from '../../data/onboardingNumericBounds';
import { appDateNow, todayISOLocal, formatLocalISODate } from '../../utils/appDate';
import { AppTextInput } from '../../components/keyboard/AppTextInput';
import { Button, Sheet, SheetHeader } from '../../components/ui';
import { colors } from '../../theme/colors';
import { borderRadius, spacing, spacingValues } from '../../theme/spacing';
import {
  buildProgressChartPoints,
  progressLiftChartModel,
  progressChartDateRangeLabel,
  type ProgressChartDatum,
} from '../../rules/progressChartTimeline';

import {
  PROGRESS_PERIODS, progressDateRange, progressHistoryInRange, filterProgressPeriod, progressAvailableDateRange, progressLoadComparison,
  type ProgressPeriod, type ProgressDateRange, type ProgressLoadComparison,
} from '../../rules/progressPeriod';

const CHART_WIDTH = 300;
const CHART_HEIGHT = 88;
const LOAD_CHART_HEIGHT = 52;
const CHART_PAD = 10;
const LOAD_MARKER_SIZE = 18;

function ProgressHeading({ title, testID, inline = false }: { title: string; testID?: string; inline?: boolean }) {
  return (
    <View style={[styles.heading, inline && styles.headingInline]} testID={testID}>
      <Text variant="labelSmall" style={styles.kicker}>{title}</Text>
    </View>
  );
}

function LoadContinuum({ load, range, comparison, onViewHistory }: { load: CoachSnapshotLoad; range: ProgressDateRange; comparison: ProgressLoadComparison | null; onViewHistory: () => void }) {
  const marker = load.headline && load.sweetSpotBand
    ? coachLoadMarkerFraction(load.headline.ratio, load.sweetSpotBand)
    : null;
  const status = coachLoadSummary(load.headline?.band ?? null, load.isDeloadWeek);
  const guidance = coachLoadGuidance(load.headline?.band ?? null, load.isDeloadWeek);
  const statusColor = load.headline === null
    ? colors.text.primary
    : load.headline.band === 'in'
      ? colors.status.successLight
      : load.headline.band === 'above'
        ? colors.status.errorLight
        : load.isDeloadWeek
          ? colors.status.infoLight
          : colors.status.warningLight;
  const latestLoad = load.weeklyCompletedLoadAU[load.weeklyCompletedLoadAU.length - 1];
  return (
    <View style={styles.heroCard} testID="progress-load-continuum">
      <View style={styles.loadSections}>
      <View style={styles.loadSummary}>
      <Text variant="labelSmall" style={styles.kicker}>{PROGRESS_TAB_COPY.load}</Text>
      <Text variant="h4" style={[styles.heroValue, { color: statusColor }]}>
        {status}
      </Text>
      <Text variant="bodySmall" style={styles.loadGuidance}>{guidance}</Text>
      <View style={styles.loadTrack} testID="progress-load-track">
        {load.sweetSpotBand ? (
          <View
            style={[
              styles.loadSweetSpot,
              {
                left: `${coachLoadMarkerFraction(load.sweetSpotBand.low, load.sweetSpotBand) * 100}%`,
                right: `${(1 - coachLoadMarkerFraction(load.sweetSpotBand.high, load.sweetSpotBand)) * 100}%`,
              },
            ]}
            testID="progress-load-sweet-spot"
          />
        ) : null}
        {marker !== null ? (
          <View
            style={[styles.loadMarker, { left: `${marker * 100}%` }]}
            testID="progress-load-marker"
          />
        ) : null}
      </View>
      <View style={styles.loadScaleLabels}>
        <Text variant="caption" style={styles.label}>Lower load</Text>
        <Text variant="caption" style={styles.label}>Higher load</Text>
      </View>
      </View>
      <View style={styles.loadChart}>
        <View style={styles.loadChartHeader}>
          <Text variant="labelSmall" style={styles.kicker}>Weekly load (AU)</Text>
          <View style={styles.loadMetricGroup}>
          {latestLoad ? (
            <View style={styles.loadMetricRow}>
            <Text variant="h1" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.loadTotal} testID="progress-weekly-load-value">
              {Math.round(latestLoad.value).toLocaleString('en-AU')}
            </Text>
            {comparison ? (
              <Text variant="bodySmallEmphasis" style={[styles.loadPercent, comparison.direction === 'up' && styles.loadPercentUp]}
                accessibilityLabel={`${Math.abs(comparison.percentChange)} percent ${comparison.direction === 'up' ? 'higher' : comparison.direction === 'down' ? 'lower' : 'change'}`}
                testID="progress-load-comparison">
                {comparison.direction === 'up' ? '↑' : comparison.direction === 'down' ? '↓' : '→'} {Math.abs(comparison.percentChange)}%
              </Text>
            ) : null}
            </View>
          ) : null}
          {comparison ? <Text variant="caption" style={styles.loadComparisonLabel}>{comparison.label}</Text>
            : latestLoad ? <Text variant="caption" style={styles.label}>More history needed</Text> : null}
          </View>
        </View>
        <View style={styles.loadGraph}>
          <LoadHistoryChart points={load.weeklyCompletedLoadAU} range={range} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="View load history"
          onPress={onViewHistory} style={styles.loadHistoryButton} testID="progress-view-load-history">
          <Text variant="caption" style={styles.loadHistoryLink}>View load history ›</Text>
        </Pressable>
      </View>
      </View>
    </View>
  );
}

function LoadHistoryChart({ points, range }: {
  range: ProgressDateRange;
  points: readonly { readonly weekStart: string; readonly value: number }[];
}) {
  if (points.length < 2) {
    return (
      <View style={styles.loadChartBuilding} testID="progress-load-chart-building">
        <Text variant="caption" style={styles.emptyText}>
          {COACH_DASHBOARD_COPY.loadHistoryBuilding}
        </Text>
      </View>
    );
  }
  return <LineChart points={points.map((point) => ({ dateISO: point.weekStart, value: point.value }))} range={range} height={LOAD_CHART_HEIGHT} compact showDates={false} />;
}

function LineChart({ points: recordedPoints, higherIsBetter = true, range, height = CHART_HEIGHT, compact = false, showDates = true }: {
  height?: number;
  compact?: boolean;
  showDates?: boolean;
  range: ProgressDateRange;
  points: readonly ProgressChartDatum[];
  higherIsBetter?: boolean;
}) {
  const [measuredWidth, setMeasuredWidth] = React.useState(140);
  const chartWidth = compact ? measuredWidth : CHART_WIDTH;
  const points = buildProgressChartPoints(recordedPoints, {
    width: chartWidth,
    height,
    padding: CHART_PAD,
  }, higherIsBetter, range);
  if (points.length === 0) {
    return (
      <View style={[styles.emptyChart, { height }]} testID="progress-chart-empty">
        <Text variant="caption" style={styles.emptyText}>{PROGRESS_TAB_COPY.noHistoryInPeriod}</Text>
      </View>
    );
  }
  const rangeLabel = progressChartDateRangeLabel(points);
  return (
    <>
      <View onLayout={compact ? event => setMeasuredWidth(Math.max(40, event.nativeEvent.layout.width)) : undefined}>
      <Svg width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`}>
        <Line
          x1={CHART_PAD}
          y1={height - CHART_PAD}
          x2={chartWidth - CHART_PAD}
          y2={height - CHART_PAD}
          stroke={colors.surface.tertiary}
          strokeWidth={1}
        />
        {points.length > 1 ? (
          <Polyline
            points={points.map(({ x, y }) => `${x},${y}`).join(' ')}
            fill="none"
            stroke={colors.accent.lime}
            strokeWidth={compact ? 2 : 3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {points.map(({ x, y, dateISO }) => (
          <Circle
            key={dateISO}
            cx={x}
            cy={y}
            r={compact ? 3 : 4}
            fill={colors.accent.lime}
            stroke={colors.surface.secondary}
            strokeWidth={2}
          />
        ))}
      </Svg>
      </View>
      {showDates ? <Text variant="caption" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.chartRange}>{rangeLabel ?? ' '}</Text> : null}
    </>
  );
}

function StrengthChart({ history, onChangeRequested, range }: {
  range: ProgressDateRange;
  history: ProgressMainLiftHistory;
  onChangeRequested: () => void;
}) {
  return (
    <View style={[styles.chartCard, styles.liftCard]} testID={`progress-lift-${history.id}`}>
      <Pressable
          accessibilityLabel={`Change tracked lift from ${progressLiftLabel(history.id)}`}
          accessibilityRole="button"
          onPress={onChangeRequested}
          hitSlop={{ top: 8, bottom: 8 }}
          style={({ pressed }) => [styles.liftNameButton, pressed && styles.rowPressed]}
          testID={`progress-change-lift-${history.id}`}
        >
          <Text variant="bodySmallEmphasis" style={styles.chartTitle} numberOfLines={3}>
            {progressLiftLabel(history.id)}
          </Text>
          <Text variant="bodySmallEmphasis" style={styles.liftChevron}>›</Text>
      </Pressable>
      {history.series.length === 0 ? (
        <View style={styles.liftEmpty} testID={`progress-lift-empty-${history.id}`}>
          <Svg width={66} height={46} viewBox="0 0 66 46" accessibilityElementsHidden>
            <Line x1={8} y1={23} x2={58} y2={23} stroke={colors.text.tertiary} strokeWidth={5} />
            {[10, 18, 44, 52].map((x, index) => <Rect key={x} x={x} y={index === 1 || index === 2 ? 7 : 12}
              width={5} height={index === 1 || index === 2 ? 32 : 22} rx={2} fill={colors.text.tertiary} />)}
          </Svg>
          <Text variant="bodySmall" style={styles.liftEmptyText}>Log {progressLiftLabel(history.id)} to track your progress.</Text>
        </View>
      ) : history.series.map((series) => (
        <LiftSeriesChart key={series.key} series={series} history={history} range={range} />
      ))}
    </View>
  );
}

function LiftSeriesChart({ series, history, range }: {
  series: ProgressMainLiftHistory['series'][number]; history: ProgressMainLiftHistory; range: ProgressDateRange;
}) {
  const [width, setWidth] = React.useState(150);
  const chartWidth = Math.max(40, width - 27);
  const model = progressLiftChartModel(series.points.map(point => ({ dateISO: point.weekStart, value: point.predictedOneRepMaxKg })),
    { width: chartWidth, height: 78, padding: 6 }, range);
  if (!model) return null;
  const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', ...(model.dates[0].slice(0, 4) !== model.dates[1].slice(0, 4) ? { year: '2-digit' as const } : {}), timeZone: 'UTC',
  });
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <Text variant="h1" style={styles.chartValue} numberOfLines={1} adjustsFontSizeToFit
      accessibilityLabel={`${series.label}, ${model.latest} kilograms`} testID={`progress-lift-value-${history.id}`}>
      {`${history.valuePrefix}${model.latest} kg`}
    </Text>
    <View style={styles.liftChangeRow}>
      {model.change !== null ? <>
        <Text variant="bodySmallEmphasis" style={model.change > 0 ? styles.liftChangeUp : styles.label}
          testID={`progress-lift-change-${history.id}`}>
          {`${model.change > 0 ? '↑' : model.change < 0 ? '↓' : '→'} ${Math.abs(model.change)} kg`}
        </Text>
        <Text variant="caption" style={styles.label}>(this period)</Text>
      </> : <Text variant="caption" style={styles.label}>First recorded estimate</Text>}
    </View>
    <Svg width="100%" height={78} viewBox={`0 0 ${width} 78`} accessibilityLabel="Estimated strength history">
      {model.ticks.map(tick => <React.Fragment key={tick.value}>
        <Line x1={6} x2={chartWidth - 6} y1={tick.y} y2={tick.y} stroke={colors.neutral.gray700} strokeWidth={0.5} />
        <SvgText x={width - 1} y={tick.y + 3} textAnchor="end" fill={colors.text.secondary} fontSize={10}>{Number(tick.value.toFixed(1))}</SvgText>
      </React.Fragment>)}
      {model.points.length > 1 && <Polyline points={model.points.map(point => `${point.x},${point.y}`).join(' ')}
        fill="none" stroke={colors.accent.lime} strokeWidth={1.5} />}
      {model.points.map(point => <Circle key={point.dateISO} cx={point.x} cy={point.y} r={3} fill={colors.accent.lime} stroke={colors.surface.secondary} strokeWidth={1} />)}
    </Svg>
    <View style={styles.liftDates}>
      <Text variant="caption" style={styles.liftDate}>{dateLabel(model.dates[0])}</Text>
      {model.dates[0] !== model.dates[1] && <Text variant="caption" style={styles.liftDate}>{dateLabel(model.dates[1])}</Text>}
    </View>
  </View>;
}

function categoryLabel(category: PerformanceTestCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function performanceTestDisplayLabel(testId: PerformanceTestId): string {
  return performanceTestDefinition(testId).label.replace(' (electronically timed)', '\n(electronically timed)');
}

function PerformanceTestRow({ category, testing, onPress }: {
  category: PerformanceTestCategory;
  testing: PerformanceTesting | undefined;
  onPress: () => void;
}) {
  const testId = selectedPerformanceTest(testing, category);
  const definition = performanceTestDefinition(testId);
  const results = resultsForPerformanceTest(testing, testId);
  const latest = results[results.length - 1];
  const previous = results[results.length - 2];
  const comparison = latest
    ? comparePerformanceTestResults(testId, previous?.value, latest.value)
    : null;
  const trendColor = comparison?.status === 'improved' ? colors.status.success : colors.status.error;
  const resultText = latest
    ? formatPerformanceTestResult(testId, latest.value)
    : PROGRESS_TAB_COPY.noResultInPeriod;
  const trendText = comparison
    ? `${comparison.percent.toFixed(1)}% ${comparison.status === 'improved'
      ? PROGRESS_TAB_COPY.better : PROGRESS_TAB_COPY.worse}`
    : latest
      ? (results.length === 1 ? PROGRESS_TAB_COPY.onlyResultInPeriod : PROGRESS_TAB_COPY.noChange)
      : '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${categoryLabel(category)} test, ${definition.label}, ${resultText}${trendText ? `, ${trendText}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.testRow, pressed && styles.rowPressed]}
      testID={`progress-test-${category}`}
    >
      <View style={styles.testIdentity}>
        <Text variant="labelSmall" style={styles.testCategory}>{categoryLabel(category)}</Text>
        <Text variant="bodySmallEmphasis" style={styles.testName}>{performanceTestDisplayLabel(testId)}</Text>
      </View>
      <View style={styles.testResult}>
        <Text variant="bodySmallEmphasis" style={styles.resultValue}>
          {resultText}
        </Text>
        {latest ? (
          comparison ? (
            <View style={styles.trendRow}>
              <Text variant="caption" style={{ color: trendColor }}>
                {comparison.percent.toFixed(1)}% {comparison.status === 'improved'
                  ? PROGRESS_TAB_COPY.better : PROGRESS_TAB_COPY.worse}
              </Text>
            </View>
          ) : (
            <Text variant="caption" style={styles.baselineText}>
              {results.length === 1 ? PROGRESS_TAB_COPY.onlyResultInPeriod : PROGRESS_TAB_COPY.noChange}
            </Text>
          )
        ) : null}
      </View>
      <Text variant="bodySmallEmphasis" style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function ProgressTabScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ProgressStackParamList>>();
  const setTrackedLiftChoice = useProfileStore((state) => state.setTrackedLiftChoice);
  const onboardingData = useProfileStore((state) => state.onboardingData);
  const performanceTesting = onboardingData?.performanceTesting;
  const { weekDays, visibleWeek } = useResolvedWeek();
  const { modifiers } = useActiveModifiers({ visibleWeekDays: weekDays });
  const snapshot = useLiveAthleteSnapshot({
    weekDays,
    visibleWeek,
    activeModifiers: modifiers,
  });
  const [period, setPeriod] = React.useState<ProgressPeriod>('4w');
  const range = React.useMemo(() => progressDateRange(period, snapshot.asOfDateISO), [period, snapshot.asOfDateISO]);
  const periodHistory = React.useMemo(
    () => progressHistoryInRange(snapshot.load, snapshot.mainLiftEstimates, range),
    [snapshot.load, snapshot.mainLiftEstimates, range],
  );
  const loadComparison = progressLoadComparison(snapshot.load.weeklyCompletedLoadAU,
    periodHistory.load.weeklyCompletedLoadAU.at(-1), period);
  const periodTesting = React.useMemo(() => performanceTesting ? {
    ...performanceTesting,
    results: filterProgressPeriod(performanceTesting.results, range,
      (result) => formatLocalISODate(new Date(result.recordedAt))),
  } : undefined, [performanceTesting, range]);
  const availableRange = progressAvailableDateRange(range, [
    ...periodHistory.load.weeklyCompletedLoadAU.map(point => point.weekStart),
    ...periodHistory.mainLiftEstimates.flatMap(history => history.points.map(point => point.weekStart)),
    ...(periodTesting?.results.map(result => formatLocalISODate(new Date(result.recordedAt))) ?? []),
  ]);
  const rangeLabel = availableRange ? progressChartDateRangeLabel([
    { dateISO: availableRange.startDateISO }, { dateISO: availableRange.endDateISO },
  ]) ?? new Date(`${availableRange.startDateISO}T12:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : PROGRESS_TAB_COPY.noLiftHistory;
  // Cross-year spans use short numeric dates so the date stays readable on one line.
  const displayRangeLabel = availableRange && availableRange.startDateISO.slice(0, 4) !== availableRange.endDateISO.slice(0, 4)
    ? [availableRange.startDateISO, availableRange.endDateISO].map(iso => {
      const [year, month, day] = iso.split('-');
      return `${Number(day)}/${Number(month)}/${year.slice(2)}`;
    }).join('–')
    : rangeLabel;
  const [activeCategory, setActiveCategory] = React.useState<PerformanceTestCategory | null>(null);
  const [chosenTest, setChosenTest] = React.useState<PerformanceTestId>('two_km_tt');
  const [resultInput, setResultInput] = React.useState('');
  const [resultError, setResultError] = React.useState<string | null>(null);
  const [savingResult, setSavingResult] = React.useState(false);
  const [heightInput, setHeightInput] = React.useState(onboardingData?.heightCm?.toString() ?? '');
  const [weightInput, setWeightInput] = React.useState(onboardingData?.weightKg?.toString() ?? '');
  const [measurementError, setMeasurementError] = React.useState<string | null>(null);
  const [measurementSaved, setMeasurementSaved] = React.useState(false);
  const [savingMeasurements, setSavingMeasurements] = React.useState(false);
  const [liftCalculationVisible, setLiftCalculationVisible] = React.useState(false);
  const [activeLiftSlot, setActiveLiftSlot] = React.useState<TrackedLiftSlot | null>(null);

  React.useEffect(() => {
    setHeightInput(onboardingData?.heightCm?.toString() ?? '');
    setWeightInput(onboardingData?.weightKg?.toString() ?? '');
  }, [onboardingData?.heightCm, onboardingData?.weightKg]);

  const openTest = (category: PerformanceTestCategory) => {
    setActiveCategory(category);
    setChosenTest(selectedPerformanceTest(performanceTesting, category));
    setResultInput('');
    setResultError(null);
  };

  const savePerformanceResult = async () => {
    const value = parsePerformanceTestResult(chosenTest, resultInput);
    if (value === null) {
      setResultError(`Enter a valid ${performanceTestDefinition(chosenTest).inputHint.toLowerCase()}.`);
      return;
    }
    const validationError = validatePerformanceTestResult(chosenTest, value);
    if (validationError) {
      setResultError(validationError);
      return;
    }
    setSavingResult(true);
    setResultError(null);
    try {
      const nextTesting = recordPerformanceTestResult(performanceTesting, {
        testId: chosenTest,
        value,
        recordedAt: appDateNow().toISOString(),
      });
      const result = await commitProfileProgramTransaction({
        change: { kind: 'profile_setup', patch: { performanceTesting: nextTesting } },
        todayISO: todayISOLocal(),
        sourceSurface: 'progress_performance_test',
      });
      if (!result.ok) {
        setResultError('That result could not be saved. Try again.');
        return;
      }
      setActiveCategory(null);
      setResultInput('');
    } catch {
      setResultError('That result could not be saved. Try again.');
    } finally {
      setSavingResult(false);
    }
  };

  const saveMeasurements = async () => {
    const heightCm = Number(heightInput);
    const weightKg = Number(weightInput);
    const heightValidation = validateOnboardingMeasurement('heightCm', heightCm);
    const weightValidation = validateOnboardingMeasurement('weightKg', weightKg);
    if (!heightValidation.ok || !weightValidation.ok) {
      setMeasurementSaved(false);
      setMeasurementError(heightValidation.ok ? weightValidation.message! : heightValidation.message!);
      return;
    }
    setSavingMeasurements(true);
    setMeasurementError(null);
    setMeasurementSaved(false);
    try {
      const result = await commitProfileProgramTransaction({
        change: { kind: 'profile_setup', patch: { heightCm, weightKg } },
        todayISO: todayISOLocal(),
        sourceSurface: 'progress_measurements',
      });
      if (!result.ok) {
        setMeasurementError('Your measurements could not be saved. Try again.');
        return;
      }
      setMeasurementSaved(true);
    } catch {
      setMeasurementError('Your measurements could not be saved. Try again.');
    } finally {
      setSavingMeasurements(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        testID="progress-tab-scroll"
      >
        <View style={styles.brandHeader}>
          <LfaWordmark />
        </View>
        <View style={styles.pageHeading} testID="progress-tab-title">
          <Text variant="h1" style={styles.pageTitle}>{PROGRESS_TAB_COPY.title}</Text>
          <Text variant="body" style={styles.pageSubtitle}>{PROGRESS_TAB_COPY.subtitle}</Text>
        </View>
        <View style={styles.periodRow}>
          <View style={styles.periodToggle} accessibilityRole="tablist">
            {PROGRESS_PERIODS.map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="tab"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: period === option.id }}
                onPress={() => setPeriod(option.id)}
                style={[styles.periodOption, period === option.id && styles.periodSelected]}
                testID={`progress-period-${option.id}`}
              >
                <Text variant="bodySmallEmphasis" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.periodOptionText, period === option.id && styles.periodActiveText]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text variant="caption" accessibilityLabel={rangeLabel ?? undefined} numberOfLines={1} style={styles.periodDates} testID="progress-period-dates">{displayRangeLabel}</Text>
        </View>
        <LoadContinuum load={periodHistory.load} range={range} comparison={loadComparison}
          onViewHistory={() => navigation.navigate('LoadHistory', { period })} />

        <View style={styles.mainLiftHeadingRow}>
          <View style={styles.mainLiftHeadingTitle}>
            <ProgressHeading title={PROGRESS_TAB_COPY.mainLifts} testID="progress-main-lifts" inline />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={PROGRESS_LIFT_CALCULATION_COPY.title}
            onPress={() => setLiftCalculationVisible(true)}
            style={({ pressed }) => [styles.calculationInfoButton, pressed && styles.rowPressed]}
            testID="progress-lift-calculation-info"
          >
            <Text variant="caption" style={styles.calculationInfoLabel}>{PROGRESS_LIFT_CALCULATION_COPY.title}</Text>
            <View style={styles.calculationInfoIcon} accessible={false}>
              <Text variant="captionEmphasis" style={styles.calculationInfoLabel}>i</Text>
            </View>
          </Pressable>
        </View>
        <View style={styles.liftGrid}>
          {periodHistory.mainLiftEstimates.map((history, index) => (
            <StrengthChart key={history.id} history={history} range={range}
              onChangeRequested={() => setActiveLiftSlot(
                (Object.keys(TRACKED_LIFT_PAIRS) as TrackedLiftSlot[])[index],
              )} />
          ))}
        </View>

        <ProgressHeading title={PROGRESS_TAB_COPY.performanceTests} testID="progress-performance-tests" />
        <View style={styles.compactCard}>
          {PERFORMANCE_TEST_CATEGORIES.map((category) => (
            <PerformanceTestRow key={category} category={category} testing={periodTesting}
              onPress={() => openTest(category)} />
          ))}
        </View>

        <ProgressHeading title={PROGRESS_TAB_COPY.measurements} testID="progress-measurements" />
        <View style={styles.measurementCard}>
          <View style={styles.measurementFields}>
            <View style={styles.measurementField}>
              <Text variant="caption" style={styles.inputLabel}>Height</Text>
              <View style={styles.inputShell}>
                <AppTextInput
                  accessibilityLabel={`Height in centimetres, ${heightInput || 'not entered'}`}
                  keyboardType="decimal-pad"
                  onChangeText={(value) => { setHeightInput(value); setMeasurementSaved(false); }}
                  placeholder="180"
                  placeholderTextColor={colors.input.placeholder}
                  style={styles.measurementInput}
                  testID="progress-height-input"
                  value={heightInput}
                />
                <Text variant="bodySmallEmphasis" style={styles.inputUnit}>cm</Text>
              </View>
            </View>
            <View style={styles.measurementField}>
              <Text variant="caption" style={styles.inputLabel}>Weight</Text>
              <View style={styles.inputShell}>
                <AppTextInput
                  accessibilityLabel={`Weight in kilograms, ${weightInput || 'not entered'}`}
                  keyboardType="decimal-pad"
                  onChangeText={(value) => { setWeightInput(value); setMeasurementSaved(false); }}
                  placeholder="80"
                  placeholderTextColor={colors.input.placeholder}
                  style={styles.measurementInput}
                  testID="progress-weight-input"
                  value={weightInput}
                />
                <Text variant="bodySmallEmphasis" style={styles.inputUnit}>kg</Text>
              </View>
            </View>
          </View>
          {measurementError ? <Text variant="caption" style={styles.errorText}>{measurementError}</Text> : null}
          {measurementSaved ? <Text variant="caption" style={styles.savedText}>Measurements saved</Text> : null}
          <Button
            label={PROGRESS_TAB_COPY.saveMeasurements}
            onPress={() => void saveMeasurements()}
            loading={savingMeasurements}
            size="md"
            glow={false}
            testID="progress-save-measurements"
          />
        </View>

      </ScrollView>
      <Sheet
        visible={liftCalculationVisible}
        onClose={() => setLiftCalculationVisible(false)}
        testID="progress-lift-calculation-sheet"
      >
        <SheetHeader title="Main lifts" subtitle={PROGRESS_LIFT_CALCULATION_COPY.title} />
        <ScrollView style={styles.calculationScroll} contentContainerStyle={styles.calculationBody}>
          <Text variant="bodyEmphasis" style={styles.calculationText}>{PROGRESS_LIFT_CALCULATION_COPY.introduction}</Text>
          <Text variant="body" style={styles.calculationText}>{PROGRESS_LIFT_CALCULATION_COPY.inputs}</Text>
          <View style={styles.calculationExample}>
            <Text variant="body" style={styles.calculationText}>{PROGRESS_LIFT_CALCULATION_COPY.example}</Text>
          </View>
          <Text variant="body" style={styles.calculationText}>{PROGRESS_LIFT_CALCULATION_COPY.weekly}</Text>
          {snapshot.mainLiftEstimates.some(history => history.id === 'pull_up') ? (
            <Text variant="body" style={styles.calculationText}>{PROGRESS_LIFT_CALCULATION_COPY.pullUp}</Text>
          ) : null}
          {snapshot.mainLiftEstimates.some(history => history.id === 'bulgarian_split_squat') ? (
            <Text variant="body" style={styles.calculationText}>{PROGRESS_LIFT_CALCULATION_COPY.splitSquat}</Text>
          ) : null}
          {periodHistory.mainLiftEstimates.some(history => history.series.some(series => series.method === 'legacy_brzycki')) ? (
            <Text variant="body" style={styles.calculationText}>{PROGRESS_LIFT_CALCULATION_COPY.legacy}</Text>
          ) : null}
          <Text variant="body" style={styles.calculationGuide}>{PROGRESS_LIFT_CALCULATION_COPY.guide}</Text>
        </ScrollView>
        <Button label="Got it" onPress={() => setLiftCalculationVisible(false)} glow={false} testID="progress-close-lift-calculation" />
      </Sheet>
      <Sheet
        visible={activeLiftSlot !== null}
        onClose={() => setActiveLiftSlot(null)}
        testID="progress-lift-choice-sheet"
      >
        {activeLiftSlot ? (
          <View style={styles.sheetBody}>
            <SheetHeader title="Main lift" subtitle="Choose which lift to track" />
            <View style={styles.testChoices}>
              {TRACKED_LIFT_PAIRS[activeLiftSlot].map((lift) => {
                const selected = snapshot.mainLiftEstimates.some((history) => history.id === lift);
                return (
                  <Pressable
                    key={lift}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setTrackedLiftChoice(activeLiftSlot, lift);
                      setActiveLiftSlot(null);
                    }}
                    style={[styles.testChoice, selected && styles.testChoiceSelected]}
                    testID={`progress-select-lift-${lift}`}
                  >
                    <Text variant="bodySmallEmphasis" style={selected ? styles.testChoiceTextSelected : styles.testChoiceText}>
                      {progressLiftLabel(lift)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </Sheet>
      <Sheet
        visible={activeCategory !== null}
        onClose={() => setActiveCategory(null)}
        dismissable={!savingResult}
        testID="progress-performance-test-sheet"
      >
        {activeCategory ? (
          <View style={styles.sheetBody}>
            <SheetHeader title={categoryLabel(activeCategory)} subtitle="Choose a test and record your result" />
            <View style={styles.testChoices}>
              {performanceTestsForCategory(activeCategory).map((test) => {
                const selected = chosenTest === test.id;
                return (
                  <Pressable
                    key={test.id}
                    accessibilityRole="button"
                    accessibilityLabel={test.label}
                    accessibilityState={{ selected }}
                    onPress={() => { setChosenTest(test.id); setResultInput(''); setResultError(null); }}
                    style={[styles.testChoice, selected && styles.testChoiceSelected]}
                    testID={`progress-select-${test.id}`}
                  >
                    <Text variant="bodySmallEmphasis" style={selected ? styles.testChoiceTextSelected : styles.testChoiceText}>
                      {performanceTestDisplayLabel(test.id)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text variant="caption" style={styles.inputLabel}>{performanceTestDefinition(chosenTest).inputHint}</Text>
            <AppTextInput
              accessibilityLabel={performanceTestDefinition(chosenTest).inputHint}
              autoFocus
              keyboardType={performanceTestDefinition(chosenTest).valueKind === 'seconds'
                && (performanceTestDefinition(chosenTest).distanceMetres ?? 0) > 100
                ? 'numbers-and-punctuation' : 'decimal-pad'}
              onChangeText={setResultInput}
              placeholder={performanceTestDefinition(chosenTest).inputPlaceholder}
              placeholderTextColor={colors.input.placeholder}
              style={styles.resultInput}
              testID="progress-test-result-input"
              value={resultInput}
            />
            {resultError ? <Text variant="caption" style={styles.errorText}>{resultError}</Text> : null}
            <Button
              label={PROGRESS_TAB_COPY.saveResult}
              onPress={() => void savePerformanceResult()}
              loading={savingResult}
              glow={false}
              testID="progress-save-test-result"
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel result entry" disabled={savingResult}
              onPress={() => setActiveCategory(null)} style={styles.resultCancel} testID="progress-cancel-test-result">
              <Text variant="bodyEmphasis" style={styles.label}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}
      </Sheet>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.primary },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacingValues.xxxl,
    gap: spacing.sm,
  },
  brandHeader: {
    minHeight: 32,
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  pageHeading: { gap: spacing.xs, marginBottom: spacing.sm },
  pageTitle: { fontSize: 28, lineHeight: 34 },
  pageSubtitle: { color: colors.text.secondary, fontSize: 13, lineHeight: 18 },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.xs },
  periodToggle: { flex: 1, minWidth: 0, flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: borderRadius.full, padding: 4, gap: 4 },
  periodOption: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs, borderRadius: borderRadius.full },
  periodSelected: { backgroundColor: 'rgba(216,216,0,0.14)' },
  periodOptionText: { color: '#8A8F98', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  periodActiveText: { color: colors.accent.lime },
  periodDates: { width: 112, fontSize: 13, lineHeight: 18, color: colors.text.secondary, textAlign: 'right' },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: spacing.lg,
    marginTop: spacing.sm,
  },
  headingInline: { marginTop: 0 },
  mainLiftHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  mainLiftHeadingTitle: { flex: 1, minWidth: 0 },
  calculationInfoButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs, minHeight: 44 },
  calculationInfoLabel: { color: colors.text.secondary },
  calculationInfoIcon: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.text.secondary, alignItems: 'center', justifyContent: 'center' },
  calculationScroll: { maxHeight: 390 },
  calculationBody: { gap: spacing.md, paddingBottom: spacing.md },
  calculationText: { fontSize: 13, lineHeight: 19 },
  calculationExample: { padding: spacing.md, borderRadius: borderRadius.lg, backgroundColor: colors.surface.tertiary },
  calculationGuide: { fontSize: 13, lineHeight: 19, color: colors.text.secondary },
  kicker: { color: colors.text.secondary, textTransform: 'uppercase' },
  heroCard: {
    backgroundColor: colors.surface.secondary,
    borderColor: colors.neutral.gray700,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
  },
  label: { color: colors.text.tertiary },
  loadSections: { flexDirection: 'column', alignItems: 'stretch', gap: spacing.md },
  loadSummary: { width: '100%' },
  heroValue: { color: colors.text.primary, fontSize: 17, lineHeight: 21, marginTop: spacing.sm },
  detail: { color: colors.text.secondary, marginTop: spacing.sm },
  loadGuidance: { color: colors.text.secondary, marginTop: spacing.xs },
  loadScaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  loadTrack: {
    backgroundColor: colors.surface.tertiary,
    borderRadius: borderRadius.full,
    height: 12,
    marginTop: spacing.md,
  },
  loadSweetSpot: {
    backgroundColor: colors.accent.limeDark,
    borderRadius: borderRadius.full,
    bottom: 0,
    opacity: 0.45,
    position: 'absolute',
    top: 0,
  },
  loadMarker: {
    backgroundColor: colors.text.accent,
    borderColor: colors.surface.secondary,
    borderRadius: borderRadius.full,
    borderWidth: 3,
    height: LOAD_MARKER_SIZE,
    marginLeft: -LOAD_MARKER_SIZE / 2,
    position: 'absolute',
    top: -3,
    width: LOAD_MARKER_SIZE,
  },
  loadChart: {
    width: '100%',
    borderTopColor: colors.surface.tertiary,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  loadChartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.xs },
  loadMetricGroup: { alignItems: 'flex-end' },
  loadMetricRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  loadTotal: { flexShrink: 1, minWidth: 0, fontSize: 28, lineHeight: 34 },
  loadPercent: { flexShrink: 0, fontSize: 12, lineHeight: 18, color: colors.text.secondary },
  loadPercentUp: { color: colors.status.successLight },
  loadComparisonLabel: { color: colors.text.secondary },
  loadGraph: { transform: [{ translateY: 12 }] },
  loadHistoryButton: { minHeight: 44, justifyContent: 'flex-end' },
  loadHistoryLink: { color: colors.text.secondary, textAlign: 'right' },
  loadChartBuilding: {
    alignItems: 'center',
    height: LOAD_CHART_HEIGHT,
    justifyContent: 'center',
  },
  chartCard: {
    backgroundColor: colors.surface.secondary,
    borderColor: colors.neutral.gray700,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
  },
  liftNameButton: {
    alignItems: 'flex-start',
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacingValues.xxs,
    justifyContent: 'flex-start',
    minHeight: 28,
    minWidth: 0,
    paddingVertical: spacing.xs,
  },
  liftChevron: { color: colors.text.secondary, fontSize: 20, lineHeight: 20 },
  liftGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  liftCard: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 0,
    padding: spacingValues.smmd,
  },
  chartTitle: { color: colors.text.primary, flex: 1, fontSize: 14, lineHeight: 18 },
  chartValue: { color: colors.text.primary, fontSize: 30, lineHeight: 38 },
  liftChangeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 5, minHeight: 36, paddingBottom: spacing.sm },
  liftChangeUp: { color: colors.status.successLight },
  liftDates: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm, paddingRight: 27 },
  liftDate: { color: colors.text.secondary, fontSize: 10 },
  liftEmpty: { flex: 1, minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  liftEmptyText: { color: colors.text.secondary, textAlign: 'center' },
  chartRange: { color: colors.text.tertiary, textAlign: 'center', minHeight: 18 },
  resultCancel: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  compactCard: {
    backgroundColor: colors.surface.secondary,
    borderColor: colors.neutral.gray700,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  testRow: {
    alignItems: 'center',
    borderBottomColor: colors.surface.tertiary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 76,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowPressed: { backgroundColor: colors.surface.tertiary },
  testIdentity: { flex: 1, minWidth: 0 },
  testCategory: { color: colors.text.tertiary, textTransform: 'uppercase' },
  testName: { color: colors.text.primary, marginTop: spacingValues.xxs },
  testResult: { alignItems: 'flex-end', flexShrink: 0 },
  resultValue: { color: colors.text.primary },
  trendRow: { alignItems: 'center', flexDirection: 'row', gap: spacingValues.xxs, marginTop: spacingValues.xxs },
  baselineText: { color: colors.text.secondary, marginTop: spacingValues.xxs },
  chevron: { color: colors.text.secondary, fontSize: 24 },
  measurementCard: {
    backgroundColor: colors.surface.secondary,
    borderColor: colors.neutral.gray700,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  measurementFields: { flexDirection: 'row', gap: spacing.sm },
  measurementField: { flex: 1, minWidth: 0 },
  inputLabel: { color: colors.text.secondary, marginBottom: spacing.xs },
  inputShell: {
    alignItems: 'center',
    backgroundColor: colors.input.background,
    borderColor: colors.input.border,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  measurementInput: { color: colors.input.text, flex: 1, fontSize: 16, paddingVertical: spacing.sm },
  inputUnit: { color: colors.text.secondary },
  errorText: { color: colors.status.errorLight },
  savedText: { color: colors.status.successLight },
  sheetBody: { gap: spacing.md, paddingTop: spacing.sm },
  testChoices: { flexDirection: 'row', gap: spacing.sm },
  testChoice: {
    alignItems: 'center',
    borderColor: colors.neutral.gray700,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.sm,
  },
  testChoiceSelected: { backgroundColor: colors.accent.lime, borderColor: colors.accent.lime },
  testChoiceText: { color: colors.text.primary, textAlign: 'center' },
  testChoiceTextSelected: { color: colors.text.inverse, textAlign: 'center' },
  resultInput: {
    backgroundColor: colors.input.background,
    borderColor: colors.input.border,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    color: colors.input.text,
    fontSize: 18,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  emptyChart: {
    alignItems: 'center',
    height: CHART_HEIGHT,
    justifyContent: 'center',
  },
  emptyText: { color: colors.text.secondary },
});
