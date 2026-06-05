import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './common/Text';
import {
  getReadinessQuickOption,
  type ReadinessQuickOption,
  type ReadinessSignal,
} from '../utils/readiness';
import { spacing, borderRadius } from '../theme/spacing';

interface ReadinessQuickCheckProps {
  signal?: ReadinessSignal | null;
  onSelect: (option: ReadinessQuickOption) => void;
  onClear: () => void;
}

const OPTIONS: Array<{ value: ReadinessQuickOption; label: string }> = [
  { value: 'good', label: 'Good' },
  { value: 'flat', label: 'Flat' },
  { value: 'sore', label: 'Sore' },
  { value: 'short_time', label: 'Short time' },
];

export function ReadinessQuickCheck({
  signal,
  onSelect,
  onClear,
}: ReadinessQuickCheckProps) {
  const selected = getReadinessQuickOption(signal);
  return (
    <View style={styles.wrap} testID="readiness-quick-check">
      <View style={styles.headerRow}>
        <Text style={styles.label}>Today feel</Text>
        {selected ? (
          <Pressable onPress={onClear} hitSlop={8}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.options}>
        {OPTIONS.map((option) => {
          const isSelected = selected === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => [
                styles.chip,
                isSelected && styles.chipSelected,
                pressed && { opacity: 0.72, transform: [{ scale: 0.98 }] },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: -spacing.lg,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: '#6A6A6A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  clear: {
    color: '#8A8A8A',
    fontSize: 12,
    fontWeight: '600',
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 34,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: borderRadius.full,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#202020',
  },
  chipSelected: {
    backgroundColor: 'rgba(200, 255, 0, 0.11)',
    borderColor: 'rgba(200, 255, 0, 0.32)',
  },
  chipText: {
    color: '#BFBFBF',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#C8FF00',
  },
});
