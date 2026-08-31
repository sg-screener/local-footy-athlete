import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useProfileStore } from '../../store/profileStore';
import { TRACKED_LIFT_PAIRS, type TrackedLiftSlot } from '../../rules/estimatedOneRepMax';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { Text } from '../../components/common/Text';
import { LfaWordmark } from '../../components/branding/LfaWordmark';
import { useResolvedWeek } from '../../hooks/useSchedule';
import { useActiveModifiers } from '../../hooks/useActiveModifiers';
import { useLiveAthleteSnapshot } from '../coach/useLiveAthleteSnapshot';
import type { CoachSnapshotLoad } from '../../rules/liveAthleteSnapshot';
import type { ProgressMainLiftHistory } from '../../rules/progressMainLiftStrength';
import {
  COACH_DASHBOARD_COPY,
  coachLoadEvidence,
  coachLoadGuidance,
  coachLoadMarkerFraction,
  coachLoadSummary,
} from '../../rules/snapshotDashboardCopy';
import { PROGRESS_TAB_COPY, progressLiftLabel } from '../../rules/progressTabCopy';
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
import { appDateNow, todayISOLocal } from '../../utils/appDate';
import { AppTextInput } from '../../components/keyboard/AppTextInput';
import { Button, Sheet, SheetHeader } from '../../components/ui';
import { colors } from '../../theme/colors';
import { borderRadius, spacing, spacingValues } from '../../theme/spacing';
import {
  buildProgressChartPoints,
  progressChartDateRangeLabel,
  type ProgressChartDatum,
} from '../../rules/progressChartTimeline';

const CHART_WIDTH = 300;
const CHART_HEIGHT = 88;
const CHART_PAD = 10;
const LOAD_MARKER_SIZE = 18;

function ProgressHeading({ title, testID }: { title: string; testID?: string }) {
  return (
    <View style={styles.heading} testID={testID}>
      <Text variant="labelSmall" style={styles.kicker}>{title}</Text>
    </View>
  );
}

function LoadContinuum({ load }: { load: CoachSnapshotLoad }) {
  const marker = load.headline && load.sweetSpotBand
    ? coachLoadMarkerFraction(load.headline.ratio, load.sweetSpotBand)
    : null;
  const evidence = coachLoadEvidence(load.coverage);
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
      <Text variant="caption" style={styles.label}>{PROGRESS_TAB_COPY.load}</Text>
      <Text variant="h4" style={[styles.heroValue, { color: statusColor }]}>
        {status}
      </Text>
      <Text variant="bodySmall" style={styles.loadGuidance}>{guidance}</Text>
      <View style={styles.loadTrackHeader}>
        <Text variant="caption" style={styles.label}>Load vs your 4-week normal</Text>
      </View>
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
      <View style={styles.loadChart}>
        <View style={styles.loadChartHeader}>
          <Text variant="bodySmallEmphasis" style={styles.chartTitle}>Weekly load (AU)</Text>
          {latestLoad ? (
            <Text variant="caption" style={styles.chartValue}>
              Latest {Math.round(latestLoad.value)} AU
            </Text>
          ) : null}
        </View>
        <LoadHistoryChart points={load.weeklyCompletedLoadAU} />
      </View>
      {evidence ? <Text variant="caption" style={styles.detail}>{evidence}</Text> : null}
    </View>
  );
}

function LoadHistoryChart({ points }: {
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
  return <LineChart points={points.map((point) => ({ dateISO: point.weekStart, value: point.value }))} />;
}

function LineChart({ points: recordedPoints, higherIsBetter = true }: {
  points: readonly ProgressChartDatum[];
  higherIsBetter?: boolean;
}) {
  const points = buildProgressChartPoints(recordedPoints, {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    padding: CHART_PAD,
  }, higherIsBetter);
  if (points.length === 0) {
    return (
      <View style={styles.emptyChart} testID="progress-chart-empty">
        <Text variant="caption" style={styles.emptyText}>{PROGRESS_TAB_COPY.noLiftHistory}</Text>
      </View>
    );
  }
  const rangeLabel = progressChartDateRangeLabel(recordedPoints);
  return (
    <>
      <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
        <Line
          x1={CHART_PAD}
          y1={CHART_HEIGHT - CHART_PAD}
          x2={CHART_WIDTH - CHART_PAD}
          y2={CHART_HEIGHT - CHART_PAD}
          stroke={colors.surface.tertiary}
          strokeWidth={1}
        />
        {points.length > 1 ? (
          <Polyline
            points={points.map(({ x, y }) => `${x},${y}`).join(' ')}
            fill="none"
            stroke={colors.accent.lime}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {points.map(({ x, y, dateISO }) => (
          <Circle
            key={dateISO}
            cx={x}
            cy={y}
            r={4}
            fill={colors.accent.lime}
            stroke={colors.surface.secondary}
            strokeWidth={2}
          />
        ))}
      </Svg>
      {rangeLabel ? <Text variant="caption" style={styles.chartRange}>{rangeLabel}</Text> : null}
    </>
  );
}

function StrengthChart({ history, onChangeRequested }: {
  history: ProgressMainLiftHistory;
  onChangeRequested: () => void;
}) {
  const latest = history.points[history.points.length - 1];
  const estimate = latest?.predictedOneRepMaxKg;
  const formatted = estimate === undefined
    ? null
    : `${history.valuePrefix}${Number.isInteger(estimate) ? String(estimate) : estimate.toFixed(1)} kg`;
  return (
    <View style={[styles.chartCard, styles.liftCard]} testID={`progress-lift-${history.id}`}>
      <View style={styles.liftChartHeader}>
        <Pressable
          accessibilityLabel={`Change tracked lift from ${progressLiftLabel(history.id)}`}
          accessibilityRole="button"
          onPress={onChangeRequested}
          style={({ pressed }) => [styles.liftNameButton, pressed && styles.rowPressed]}
          testID={`progress-change-lift-${history.id}`}
        >
          <Text variant="bodySmallEmphasis" style={styles.chartTitle} numberOfLines={3}>
            {progressLiftLabel(history.id)}
          </Text>
          <Text variant="bodySmallEmphasis" style={styles.liftChevron}>›</Text>
        </Pressable>
        {estimate !== undefined && history.series.length <= 1
          ? <Text variant="bodySmallEmphasis" style={styles.chartValue}>{formatted}</Text>
          : null}
      </View>
      {history.series.length === 0 ? <LineChart points={[]} /> : history.series.map((series) => <View key={series.key}>
        <Text variant="caption">{series.label}{history.series.length > 1
          ? ` · ${history.valuePrefix}${series.points[series.points.length - 1].predictedOneRepMaxKg} kg` : ''}</Text>
        <LineChart points={series.points.map((point) => ({ dateISO: point.weekStart, value: point.predictedOneRepMaxKg }))} />
      </View>)}
    </View>
  );
}

function categoryLabel(category: PerformanceTestCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
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
    : PROGRESS_TAB_COPY.noPerformanceResult;
  const trendText = comparison
    ? `${comparison.percent.toFixed(1)}% ${comparison.status === 'improved'
      ? PROGRESS_TAB_COPY.better : PROGRESS_TAB_COPY.worse}`
    : latest
      ? (results.length === 1 ? PROGRESS_TAB_COPY.baseline : PROGRESS_TAB_COPY.noChange)
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
        <Text variant="bodySmallEmphasis" style={styles.testName}>{definition.label}</Text>
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
              {results.length === 1 ? PROGRESS_TAB_COPY.baseline : PROGRESS_TAB_COPY.noChange}
            </Text>
          )
        ) : null}
      </View>
      <Text variant="bodySmallEmphasis" style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function ProgressTabScreen() {
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
        <ProgressHeading title={PROGRESS_TAB_COPY.title} testID="progress-tab-title" />
        <LoadContinuum load={snapshot.load} />

        <ProgressHeading title={PROGRESS_TAB_COPY.mainLifts} testID="progress-main-lifts" />
        <View style={styles.liftGrid}>
          {snapshot.mainLiftEstimates.map((history, index) => (
            <StrengthChart key={history.id} history={history}
              onChangeRequested={() => setActiveLiftSlot(
                (Object.keys(TRACKED_LIFT_PAIRS) as TrackedLiftSlot[])[index],
              )} />
          ))}
        </View>

        <ProgressHeading title={PROGRESS_TAB_COPY.performanceTests} testID="progress-performance-tests" />
        <View style={styles.compactCard}>
          {PERFORMANCE_TEST_CATEGORIES.map((category) => (
            <PerformanceTestRow
              key={category}
              category={category}
              testing={performanceTesting}
              onPress={() => openTest(category)}
            />
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
                    accessibilityState={{ selected }}
                    onPress={() => { setChosenTest(test.id); setResultInput(''); setResultError(null); }}
                    style={[styles.testChoice, selected && styles.testChoiceSelected]}
                    testID={`progress-select-${test.id}`}
                  >
                    <Text variant="bodySmallEmphasis" style={selected ? styles.testChoiceTextSelected : styles.testChoiceText}>
                      {test.label}
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
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: spacing.lg,
    marginTop: spacing.sm,
  },
  kicker: { color: colors.text.secondary, textTransform: 'uppercase' },
  heroCard: {
    backgroundColor: colors.surface.secondary,
    borderColor: colors.neutral.gray700,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
  },
  label: { color: colors.text.tertiary },
  heroValue: { color: colors.text.primary, marginTop: spacing.xs },
  detail: { color: colors.text.secondary, marginTop: spacing.sm },
  loadGuidance: { color: colors.text.secondary, marginTop: spacing.xs },
  loadTrackHeader: { marginTop: spacing.md },
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
    borderTopColor: colors.surface.tertiary,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  loadChartHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  loadChartBuilding: {
    alignItems: 'center',
    height: CHART_HEIGHT,
    justifyContent: 'center',
  },
  chartCard: {
    backgroundColor: colors.surface.secondary,
    borderColor: colors.neutral.gray700,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
  },
  liftChartHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
    minHeight: 44,
  },
  liftNameButton: {
    alignItems: 'flex-start',
    borderRadius: borderRadius.md,
    flex: 1,
    flexDirection: 'row',
    gap: spacingValues.xxs,
    justifyContent: 'flex-start',
    minHeight: 44,
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
  chartTitle: { color: colors.text.primary, flex: 1 },
  chartValue: { color: colors.text.accent },
  chartRange: { color: colors.text.tertiary, textAlign: 'center' },
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
