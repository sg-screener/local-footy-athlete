import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppTextInput } from '../keyboard/AppTextInput';
import { Text } from '../common/Text';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';

export interface SeasonFinishDateDraft {
  day: string;
  month: string;
  year: string;
}

export const EMPTY_SEASON_FINISH_DATE: SeasonFinishDateDraft = {
  day: '',
  month: '',
  year: '',
};

export function seasonFinishDateDraft(dateISO: string | null | undefined): SeasonFinishDateDraft {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateISO ?? ''));
  return match
    ? { day: String(Number(match[3])), month: String(Number(match[2])), year: match[1] }
    : { ...EMPTY_SEASON_FINISH_DATE };
}

interface Props {
  value: SeasonFinishDateDraft;
  onChange: (value: SeasonFinishDateDraft) => void;
}

/** One visual owner for the same DD / MM / YYYY fact on every entry surface. */
export function SeasonFinishDateFields({ value, onChange }: Props) {
  const fields = [
    { key: 'day' as const, label: 'Day', placeholder: '24', maxLength: 2 },
    { key: 'month' as const, label: 'Month', placeholder: '8', maxLength: 2 },
    { key: 'year' as const, label: 'Year', placeholder: '2026', maxLength: 4 },
  ];

  return (
    <View style={styles.dateRow}>
      {fields.map((field) => (
        <View key={field.key} style={styles.dateField}>
          <Text variant="bodySmall" color={colors.text.secondary} style={styles.dateLabel}>
            {field.label}
          </Text>
          <AppTextInput
            style={styles.dateInput}
            value={value[field.key]}
            onChangeText={(text) => onChange({
              ...value,
              [field.key]: text.replace(/\D/g, ''),
            })}
            placeholder={field.placeholder}
            placeholderTextColor={colors.text.tertiary}
            keyboardType="number-pad"
            maxLength={field.maxLength}
            textAlign="center"
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', gap: 10 },
  dateField: { flex: 1, minWidth: 0 },
  dateLabel: { marginBottom: spacing.sm },
  dateInput: {
    height: 58,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
    backgroundColor: colors.surface.secondary,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 8,
  },
});
