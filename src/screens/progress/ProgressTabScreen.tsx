import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { Text } from '../../components/common/Text';
import { useResolvedWeek } from '../../hooks/useSchedule';
import { useActiveModifiers } from '../../hooks/useActiveModifiers';
import { useLiveAthleteSnapshot } from '../coach/useLiveAthleteSnapshot';
import type {
  CoachSnapshotLoad,
  StrengthProgressHistory,
} from '../../rules/liveAthleteSnapshot';
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

const CHART_WIDTH = 300;
const CHART_HEIGHT = 88;
const CHART_PAD = 10;
const LOAD_MARKER_SIZE = 18;

function ProgressHeading({ title, testID }: { title: string; testID?: string }) {
  return (
    <View style={styles.heading} testID={testID}>
      <View style={styles.headingMark} />
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

function LineChart({ values, higherIsBetter = true }: {
  values: readonly number[];
  higherIsBetter?: boolean;
}) {
  if (values.length === 0) return null;
  const performance = values.map((value) => higherIsBetter ? value : -value);
  const min = Math.min(...performance);
  const max = Math.max(...performance);
  const span = max - min;
  const usableWidth = CHART_WIDTH - CHART_PAD * 2;
  const usableHeight = CHART_HEIGHT - CHART_PAD * 2;
  const points = performance.map((value, index) => {
    const x = values.length === 1
      ? CHART_WIDTH / 2
      : CHART_PAD + (index / (values.length - 1)) * usableWidth;
    const y = span === 0
      ? CHART_HEIGHT / 2
      : CHART_PAD + ((max - value) / span) * usableHeight;
    return { x, y };
  });
  return (
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
      {points.map(({ x, y }, index) => (
        <Circle
          key={`${x}-${index}`}
          cx={x}
          cy={y}
          r={4}
          fill={colors.accent.lime}
          stroke={colors.surface.secondary}
          strokeWidth={2}
        />
      ))}
    </Svg>
  );
}

function StrengthChart({ history }: { history: StrengthProgressHistory }) {
  const latest = history.points[history.points.length - 1];
  const weight = latest?.topSet.weightKg ?? 0;
  const formatted = Number.isInteger(weight) ? String(weight) : weight.toFixed(1);
  return (
    <View style={[styles.chartCard, styles.liftCard]} testID={`progress-lift-${history.exerciseName}`}>
      <View style={styles.liftChartHeader}>
        <Text variant="bodySmallEmphasis" style={styles.chartTitle} numberOfLines={2}>
          {history.exerciseName}
        </Text>
        <Text variant="bodySmallEmphasis" style={styles.chartValue}>{formatted} kg</Text>
      </View>
      <LineChart values={history.points.map((point) => point.topSet.weightKg)} />
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
      {recorded ? <LineChart values={[answer!.seconds!]} higherIsBetter={false} /> : null}
    </View>
  );
}

export default function ProgressTabScreen() {
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
        <Text style={styles.brand}>LFA</Text>
        <ProgressHeading title={PROGRESS_TAB_COPY.title} testID="progress-tab-title" />
        <LoadContinuum load={snapshot.load} />

        <ProgressHeading title={PROGRESS_TAB_COPY.twoKmTimeTrial} />
        <TwoKmChart answer={snapshot.twoKmTimeTrial} />

        <ProgressHeading title={PROGRESS_TAB_COPY.mainLifts} testID="progress-main-lifts" />
        {snapshot.strengthHistory.length > 0 ? (
          <View style={styles.liftGrid}>
            {snapshot.strengthHistory.map((history) => (
              <StrengthChart key={history.exerciseName} history={history} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text variant="bodySmallEmphasis" style={styles.emptyText}>
              {PROGRESS_TAB_COPY.noLiftHistory}
            </Text>
          </View>
        )}

      </ScrollView>
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
  brand: {
    color: colors.text.primary,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -1.2,
    marginBottom: spacing.sm,
  },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: spacing.lg,
    marginTop: spacing.sm,
  },
  headingMark: {
    backgroundColor: colors.accent.lime,
    borderRadius: borderRadius.full,
    height: spacingValues.xxs,
    width: spacingValues.xxl,
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
  emptyCard: {
    backgroundColor: colors.surface.secondary,
    borderColor: colors.neutral.gray700,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    minHeight: 88,
    justifyContent: 'center',
    padding: spacing.md,
  },
  emptyText: { color: colors.text.secondary },
});
