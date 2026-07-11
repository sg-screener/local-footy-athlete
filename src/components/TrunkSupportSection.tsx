import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './common/Text';
import { Card, SectionLabel } from './ui';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface TrunkSupportSectionProps {
  rows?: any[] | null;
}

function prescription(row: any): string {
  const sets = Math.max(1, Number(row?.prescribedSets ?? 1));
  const min = Number(row?.prescribedRepsMin ?? 0);
  const max = Number(row?.prescribedRepsMax ?? min);
  const dose = min === max ? `${min}` : `${min}-${max}`;
  const unit = row?.prescriptionType === 'duration' ? 's' : '';
  return `${sets} × ${dose}${unit}${row?.perSide ? ' / side' : ''}`;
}

/** Visible low-fatigue trunk/support rows, separate from conditioning credit. */
export function TrunkSupportSection({ rows }: TrunkSupportSectionProps) {
  if (!rows?.length) return null;
  return (
    <View style={styles.section} testID="trunk-support-section">
      <SectionLabel style={styles.label}>Trunk / Support</SectionLabel>
      <View style={styles.list}>
        {rows.map((row, index) => (
          <Card key={row?.id ?? `support-${index}`} radius="lg" padding="md">
            <View style={styles.row}>
              <Text style={styles.name}>{row?.exercise?.name ?? 'Support work'}</Text>
              <Text style={styles.dose}>{prescription(row)}</Text>
            </View>
            {row?.notes ? <Text style={styles.notes}>{row.notes}</Text> : null}
          </Card>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  label: { marginBottom: spacing.sm },
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  name: { flex: 1, color: colors.text.primary, fontSize: 15, fontWeight: '600' },
  dose: { color: colors.text.secondary, fontSize: 13, fontWeight: '600' },
  notes: { color: colors.text.tertiary, fontSize: 12, marginTop: spacing.xs },
});
