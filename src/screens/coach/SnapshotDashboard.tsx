import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/common/Text';
import type { CoachSnapshot } from '../../rules/liveAthleteSnapshot';
import {
  COACH_DASHBOARD_COPY,
  coachLoadEvidence,
  coachLoadMarkerFraction,
  coachLoadSummary,
  coachProgressDirection,
  coachProgressValue,
  coachReadinessSummary,
  coachRestrictionCount,
  coachWeekSummary,
} from '../../rules/snapshotDashboardCopy';
import { colors } from '../../theme/colors';
import { borderRadius, spacing, spacingValues } from '../../theme/spacing';

const LOAD_MARKER_SIZE = 18;

export function CoachDashboard({ snapshot }: { snapshot: CoachSnapshot }) {
  const leadProgress = snapshot.progress[0] ?? null;
  const leadRestriction = snapshot.restrictions[0] ?? null;
  const loadEvidence = coachLoadEvidence(snapshot.load.coverage);
  const loadHeadline = snapshot.load.headline;
  const sweetSpotBand = snapshot.load.sweetSpotBand;
  const loadMarker = loadHeadline && sweetSpotBand
    ? coachLoadMarkerFraction(loadHeadline.ratio, sweetSpotBand)
    : null;

  return (
    <View style={styles.dashboard} testID="coach-dashboard">
      <View style={styles.heading}>
        <View style={styles.headingMark} />
        <Text variant="labelSmall" style={styles.kicker}>
          {COACH_DASHBOARD_COPY.title}
        </Text>
      </View>

      <View style={styles.heroCard} testID="coach-dashboard-load">
        <Text variant="caption" style={styles.label}>
          {COACH_DASHBOARD_COPY.load}
        </Text>
        <Text variant="h4" style={styles.heroValue}>
          {coachLoadSummary(loadHeadline?.band ?? null)}
        </Text>
        <View style={styles.loadTrack} testID="coach-dashboard-load-track">
          {sweetSpotBand ? (
            <View
              style={[
                styles.loadSweetSpot,
                {
                  left: `${coachLoadMarkerFraction(sweetSpotBand.low, sweetSpotBand) * 100}%`,
                  right: `${(1 - coachLoadMarkerFraction(sweetSpotBand.high, sweetSpotBand)) * 100}%`,
                },
              ]}
              testID="coach-dashboard-load-sweet-spot"
            />
          ) : null}
          {loadMarker !== null ? (
            <View
              style={[styles.loadMarker, { left: `${loadMarker * 100}%` }]}
              testID="coach-dashboard-load-marker"
            />
          ) : null}
        </View>
        {loadEvidence ? (
          <Text variant="caption" style={styles.heroDetail}>
            {loadEvidence}
          </Text>
        ) : null}
      </View>

      <View style={styles.row}>
        <SnapshotCell
          testID="coach-dashboard-week"
          label={COACH_DASHBOARD_COPY.consistency}
          value={coachWeekSummary(snapshot.thisWeek.work)}
        />
        <SnapshotCell
          testID="coach-dashboard-readiness"
          label={COACH_DASHBOARD_COPY.readiness}
          value={coachReadinessSummary(snapshot.readiness.state)}
        />
      </View>
      <View style={styles.row}>
        <SnapshotCell
          testID="coach-dashboard-progress"
          label={COACH_DASHBOARD_COPY.progress}
          value={coachProgressValue(leadProgress)}
          detail={coachProgressDirection(leadProgress?.direction ?? null)}
        />
        <SnapshotCell
          testID="coach-dashboard-restrictions"
          label={COACH_DASHBOARD_COPY.restrictions}
          value={coachRestrictionCount(snapshot.restrictions.length)}
          detail={leadRestriction?.title ?? null}
        />
      </View>
    </View>
  );
}

function SnapshotCell({
  label,
  value,
  detail,
  testID,
}: {
  label: string;
  value: string;
  detail?: string | null;
  testID: string;
}) {
  return (
    <View style={styles.cell} testID={testID}>
      <Text variant="caption" style={styles.label}>
        {label}
      </Text>
      <Text variant="bodySmallEmphasis" style={styles.value}>
        {value}
      </Text>
      {detail ? (
        <Text variant="caption" style={styles.detail} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: spacing.lg,
  },
  headingMark: {
    backgroundColor: colors.accent.lime,
    borderRadius: borderRadius.full,
    height: spacingValues.xxs,
    width: spacingValues.xxl,
  },
  kicker: {
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  heroCard: {
    backgroundColor: colors.surface.secondary,
    borderColor: colors.neutral.gray700,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
  },
  heroValue: {
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  heroDetail: {
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
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
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cell: {
    backgroundColor: colors.surface.secondary,
    borderColor: colors.neutral.gray700,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flex: 1,
    minHeight: 96,
    padding: spacingValues.smmd,
  },
  label: {
    color: colors.text.tertiary,
  },
  value: {
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  detail: {
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
});
