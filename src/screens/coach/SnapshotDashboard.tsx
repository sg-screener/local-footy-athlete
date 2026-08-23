import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/common/Text';
import type { CoachSnapshot } from '../../rules/liveAthleteSnapshot';
import {
  COACH_DASHBOARD_COPY,
  coachLoadEvidence,
  coachLoadSummary,
  coachProgressDirection,
  coachProgressValue,
  coachReadinessSummary,
  coachRestrictionCount,
  coachWeekSummary,
} from '../../rules/snapshotDashboardCopy';
import { colors } from '../../theme/colors';
import { borderRadius, spacing, spacingValues } from '../../theme/spacing';

export function CoachDashboard({ snapshot }: { snapshot: CoachSnapshot }) {
  const leadProgress = snapshot.progress[0] ?? null;
  const leadRestriction = snapshot.restrictions[0] ?? null;
  const loadEvidence = coachLoadEvidence(snapshot.load.coverage);
  const completedSessions = snapshot.thisWeek.work.completedFull
    + snapshot.thisWeek.work.completedPartial;
  const plannedSessions = snapshot.thisWeek.work.sessionsPlanned;
  const completionPercent = plannedSessions > 0
    ? Math.min(100, Math.round((completedSessions / plannedSessions) * 100))
    : 0;

  return (
    <View style={styles.dashboard} testID="coach-dashboard">
      <View style={styles.heading}>
        <View style={styles.headingMark} />
        <Text variant="labelSmall" style={styles.kicker}>
          {COACH_DASHBOARD_COPY.title}
        </Text>
      </View>

      <View style={styles.weekCard} testID="coach-dashboard-week">
        <Text variant="caption" style={styles.label}>
          {COACH_DASHBOARD_COPY.thisWeek}
        </Text>
        <Text variant="h4" style={styles.weekValue}>
          {coachWeekSummary(snapshot.thisWeek.work)}
        </Text>
        <View style={styles.progressTrack} testID="coach-dashboard-week-progress">
          <View style={[styles.progressFill, { width: `${completionPercent}%` }]} />
        </View>
      </View>

      <View style={styles.row}>
        <SnapshotCell
          testID="coach-dashboard-readiness"
          label={COACH_DASHBOARD_COPY.readiness}
          value={coachReadinessSummary(snapshot.readiness.state)}
        />
        <SnapshotCell
          testID="coach-dashboard-load"
          label={COACH_DASHBOARD_COPY.load}
          value={coachLoadSummary(snapshot.load.headline?.band ?? null)}
          detail={loadEvidence}
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
  weekCard: {
    backgroundColor: colors.surface.secondary,
    borderColor: colors.neutral.gray700,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
  },
  weekValue: {
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  progressTrack: {
    backgroundColor: colors.neutral.gray700,
    borderRadius: borderRadius.full,
    height: spacingValues.xxs,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.accent.lime,
    borderRadius: borderRadius.full,
    height: '100%',
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
