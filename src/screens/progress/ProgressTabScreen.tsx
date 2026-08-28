import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useProfileStore } from '../../store/profileStore';
import { TRACKED_LIFT_PAIRS, TRACKED_LIFTS, type TrackedLiftSlot, type TrackedLiftId } from '../../rules/estimatedOneRepMax';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { Text } from '../../components/common/Text';
import { LfaWordmark } from '../../components/branding/LfaWordmark';
import { useResolvedWeek } from '../../hooks/useSchedule';
import { useActiveModifiers } from '../../hooks/useActiveModifiers';
import { useLiveAthleteSnapshot } from '../coach/useLiveAthleteSnapshot';
import type { CoachSnapshotLoad } from '../../rules/liveAthleteSnapshot';
import type { ProgressMainLiftHistory } from '../../rules/progressMainLiftStrength';
import {
  coachLoadEvidence,
  coachLoadMarkerFraction,
  coachLoadSummary,
} from '../../rules/snapshotDashboardCopy';
import { PROGRESS_TAB_COPY } from '../../rules/progressTabCopy';
import { formatTwoKmTime } from '../../data/twoKmTimeTrial';
import type { TwoKmTimeTrialAnswer } from '../../types/domain';
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
  return (
    <View style={styles.heroCard} testID="progress-load-continuum">
      <Text variant="caption" style={styles.label}>{PROGRESS_TAB_COPY.load}</Text>
      <Text variant="h4" style={styles.heroValue}>
        {coachLoadSummary(load.headline?.band ?? null)}
      </Text>
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
      {evidence ? <Text variant="caption" style={styles.detail}>{evidence}</Text> : null}
    </View>
  );
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

function StrengthChart({ history, slot, onChoose }: {
  history: ProgressMainLiftHistory; slot: TrackedLiftSlot; onChoose: (lift: TrackedLiftId) => void;
}) {
  const latest = history.points[history.points.length - 1];
  const estimate = latest?.predictedOneRepMaxKg;
  const formatted = estimate === undefined
    ? '—'
    : `${history.valuePrefix}${Number.isInteger(estimate) ? String(estimate) : estimate.toFixed(1)} kg`;
  return (
    <View style={[styles.chartCard, styles.liftCard]} testID={`progress-lift-${history.id}`}>
      <View style={styles.liftChartHeader}>
        <View style={styles.liftTitleBlock}>
          <Text variant="bodySmallEmphasis" style={styles.chartTitle} numberOfLines={2}>
            {history.exerciseName}
          </Text>
          <Text variant="caption" style={styles.estimateLabel}>
            {PROGRESS_TAB_COPY.predictedOneRepMax}
          </Text>
        </View>
        {history.series.length <= 1 ? <Text variant="bodySmallEmphasis" style={styles.chartValue}>{formatted}</Text> : null}
      </View>
      <View style={styles.liftChoices}>
        {TRACKED_LIFT_PAIRS[slot].map((lift) => <Pressable key={lift}
          testID={`progress-choose-${lift}`} accessibilityRole="button"
          accessibilityState={{ selected: history.id === lift }}
          style={styles.liftChoice} onPress={() => onChoose(lift)}>
          <Text variant="caption" style={{ color: history.id === lift ? colors.accent.lime : colors.text.secondary }}>
            {TRACKED_LIFTS[lift].label}
          </Text>
        </Pressable>)}
      </View>
      {history.id === 'pull_up' ? <Text variant="caption">Estimated added weight · session bodyweight used</Text> : null}
      {history.series.length === 0 ? <LineChart points={[]} /> : history.series.map((series) => <View key={series.key}>
        <Text variant="caption">{series.label}{history.series.length > 1
          ? ` · ${history.valuePrefix}${series.points[series.points.length - 1].predictedOneRepMaxKg} kg` : ''}</Text>
        <LineChart points={series.points.map((point) => ({ dateISO: point.weekStart, value: point.predictedOneRepMaxKg }))} />
      </View>)}
    </View>
  );
}

function TwoKmChart({ answer }: { answer: TwoKmTimeTrialAnswer | null }) {
  const recorded = answer?.seconds !== null && answer?.seconds !== undefined;
  return (
    <View style={styles.chartCard} testID="progress-two-km">
      <View style={styles.chartHeader}>
        <Text variant="bodySmallEmphasis" style={styles.chartTitle}>
          {PROGRESS_TAB_COPY.twoKmTimeTrial}
        </Text>
        <Text variant="bodySmallEmphasis" style={styles.chartValue}>
          {recorded ? formatTwoKmTime(answer!.seconds!) : PROGRESS_TAB_COPY.notTested}
        </Text>
      </View>
      {recorded ? <LineChart points={[{
        dateISO: answer!.recordedOn,
        value: answer!.seconds!,
      }]} higherIsBetter={false} /> : null}
    </View>
  );
}

export default function ProgressTabScreen() {
  const setTrackedLiftChoice = useProfileStore((state) => state.setTrackedLiftChoice);
  const { weekDays, visibleWeek } = useResolvedWeek();
  const { modifiers } = useActiveModifiers({ visibleWeekDays: weekDays });
  const snapshot = useLiveAthleteSnapshot({
    weekDays,
    visibleWeek,
    activeModifiers: modifiers,
  });

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

        <ProgressHeading title={PROGRESS_TAB_COPY.twoKmTimeTrial} />
        <TwoKmChart answer={snapshot.twoKmTimeTrial} />

        <ProgressHeading title={PROGRESS_TAB_COPY.mainLifts} testID="progress-main-lifts" />
        <View style={styles.liftGrid}>
          {snapshot.mainLiftEstimates.map((history, index) => (
            <StrengthChart key={history.id} history={history}
              slot={(Object.keys(TRACKED_LIFT_PAIRS) as TrackedLiftSlot[])[index]}
              onChoose={(lift) => setTrackedLiftChoice((Object.keys(TRACKED_LIFT_PAIRS) as TrackedLiftSlot[])[index], lift)} />
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  liftChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  liftChoice: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
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
  chartCard: {
    backgroundColor: colors.surface.secondary,
    borderColor: colors.neutral.gray700,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
  },
  chartHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  liftChartHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
    minHeight: 54,
  },
  liftTitleBlock: { flex: 1, minWidth: 0 },
  estimateLabel: { color: colors.text.tertiary, marginTop: spacingValues.xxs },
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
  emptyChart: {
    alignItems: 'center',
    height: CHART_HEIGHT,
    justifyContent: 'center',
  },
  emptyText: { color: colors.text.secondary },
});
