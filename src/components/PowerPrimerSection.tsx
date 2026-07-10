import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './common/Text';
import { Card, SectionLabel } from './ui';
import type { PowerBlock, PowerBlockOption } from '../types/domain';
import { colors } from '../theme/colors';
import { borderRadius, spacing } from '../theme/spacing';

interface PowerPrimerSectionProps {
  block?: PowerBlock | null;
}

function optionPrescription(option: PowerBlockOption): string {
  const reps = option.repsMin === option.repsMax
    ? String(option.repsMin)
    : `${option.repsMin}-${option.repsMax}`;
  return `${option.sets} × ${reps}`;
}

/**
 * Athlete-visible power work. This stays separate from exercise rows so the
 * existing counting fence remains honest: it is an early primer component,
 * never conditioning, a finisher, or recovery work.
 */
export function PowerPrimerSection({ block }: PowerPrimerSectionProps) {
  if (!block) return null;
  const placementLabel = block.kind === 'contrast'
    ? 'Pair with main lift'
    : 'Before strength';

  return (
    <View
      style={styles.section}
      testID="power-primer-section"
      accessibilityLabel={`${block.title}. ${block.prescription}`}
    >
      <SectionLabel style={styles.sectionLabel}>POWER / EXPLOSIVE PRIMER</SectionLabel>
      <Card tone="accent" radius="lg" padding="md" style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title} testID="power-primer-title">{block.title}</Text>
          <Text style={styles.placement}>{placementLabel}</Text>
        </View>

        <Text style={styles.prescription} testID="power-primer-prescription">
          {block.prescription}
        </Text>

        {block.options.length > 1 ? (
          <Text style={styles.chooseOne}>Choose one:</Text>
        ) : null}

        <View style={styles.options}>
          {block.options.map((option, index) => {
            const equipment = option.equipmentRequired ?? [];
            return (
              <View
                key={`${block.id}-${option.name}-${index}`}
                style={styles.option}
                testID={`power-primer-option-${index}`}
              >
                <View style={styles.optionRow}>
                  <Text style={styles.optionName}>{option.name}</Text>
                  <Text style={styles.optionDose}>{optionPrescription(option)}</Text>
                </View>
                {equipment.length > 0 ? (
                  <Text style={styles.equipment}>Equipment: {equipment.join(', ')}</Text>
                ) : null}
              </View>
            );
          })}
        </View>

        {block.notes.length > 0 ? (
          <View style={styles.notes}>
            {block.notes.map((note, index) => (
              <Text key={`${block.id}-note-${index}`} style={styles.note}>
                • {note}
              </Text>
            ))}
          </View>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
  },
  card: {
    borderColor: 'rgba(200, 255, 0, 0.28)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 17,
    fontWeight: '700',
  },
  placement: {
    color: colors.accent.lime,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  prescription: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  chooseOne: {
    color: colors.text.tertiary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  options: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  option: {
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  optionName: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  optionDose: {
    color: colors.accent.lime,
    fontSize: 14,
    fontWeight: '700',
  },
  equipment: {
    color: colors.text.tertiary,
    fontSize: 12,
    marginTop: 3,
  },
  notes: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.tertiary,
    gap: 4,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  note: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
