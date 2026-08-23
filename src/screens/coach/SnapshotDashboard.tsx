import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card } from '../../components/common/Card';
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
import { spacing } from '../../theme/spacing';

export function CoachDashboard({ snapshot }: { snapshot: CoachSnapshot }) {
  const leadProgress = snapshot.progress[0] ?? null;
  const leadRestriction = snapshot.restrictions[0] ?? null;
  const loadEvidence = coachLoadEvidence(snapshot.load.coverage);

  return (
    <Card style={styles.dashboard} testID="coach-dashboard">
      <Text variant="labelSmall" style={styles.kicker}>
        {COACH_DASHBOARD_COPY.title}
      </Text>
      <SnapshotCell
        wide
        testID="coach-dashboard-week"
        label={COACH_DASHBOARD_COPY.thisWeek}
        value={coachWeekSummary(snapshot.thisWeek.work)}
      />
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
    </Card>
  );
}

function SnapshotCell({
  label,
  value,
  detail,
  testID,
  wide = false,
}: {
  label: string;
  value: string;
  detail?: string | null;
  testID: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.cell, wide ? styles.cellWide : null]} testID={testID}>
      <Text variant="caption" style={styles.label}>{label}</Text>
      <Text variant="bodySmallEmphasis" style={styles.value}>{value}</Text>
      {detail ? <Text variant="caption" style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: {
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  kicker: {
    color: colors.text.accent,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
    minHeight: 66,
    paddingTop: spacing.xs,
  },
  cellWide: {
    minHeight: 48,
  },
  label: {
    color: colors.text.tertiary,
  },
  value: {
    color: colors.text.primary,
    marginTop: 2,
  },
  detail: {
    color: colors.text.secondary,
    marginTop: 2,
  },
});
