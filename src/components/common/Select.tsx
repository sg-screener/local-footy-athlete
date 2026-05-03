import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ViewStyle,
  Pressable,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, dimensions } from '../../theme/spacing';
import { Text } from './Text';

export interface SelectOption {
  label: string;
  value: string | number;
}

interface SelectProps {
  label?: string;
  value: string | number | (string | number)[];
  options: SelectOption[];
  onSelect: (value: string | number | (string | number)[]) => void;
  error?: string;
  multiSelect?: boolean;
  style?: ViewStyle;
  disabled?: boolean;
}

export const Select = ({
  label,
  value,
  options,
  onSelect,
  error,
  multiSelect = false,
  style,
  disabled = false,
}: SelectProps) => {
  const [expanded, setExpanded] = useState(false);

  const selectedValues = Array.isArray(value) ? value : [value];

  const handleSelect = (optionValue: string | number) => {
    if (multiSelect) {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue];
      onSelect(newValues);
    } else {
      onSelect(optionValue);
      setExpanded(false);
    }
  };

  const getDisplayLabel = () => {
    if (multiSelect) {
      if (selectedValues.length === 0) return 'Select options...';
      if (selectedValues.length === 1) {
        return options.find((o) => o.value === selectedValues[0])?.label || '';
      }
      return `${selectedValues.length} selected`;
    } else {
      return options.find((o) => o.value === value)?.label || 'Select...';
    }
  };

  const containerStyle: ViewStyle = {
    marginBottom: error ? spacing.md : spacing.sm,
  };

  const triggerStyle: ViewStyle = {
    backgroundColor: colors.input.background,
    borderColor: error ? colors.status.error : colors.input.border,
    borderWidth: dimensions.border.normal,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: dimensions.input.md,
    justifyContent: 'center',
  };

  return (
    <View style={[containerStyle, style]}>
      {label && (
        <Text
          variant="label"
          color={colors.text.primary}
          style={styles.label}
        >
          {label}
        </Text>
      )}

      <Pressable
        onPress={() => !disabled && setExpanded(!expanded)}
        style={[triggerStyle, { opacity: disabled ? 0.5 : 1 }]}
      >
        <Text
          variant="body"
          color={
            selectedValues.length > 0
              ? colors.text.primary
              : colors.input.placeholder
          }
        >
          {getDisplayLabel()}
        </Text>
      </Pressable>

      {error && (
        <Text
          variant="caption"
          color={colors.status.error}
          style={styles.errorText}
        >
          {error}
        </Text>
      )}

      {expanded && (
        <ScrollView
          style={[
            styles.dropdown,
            {
              borderColor: colors.input.borderFocused,
              backgroundColor: colors.surface.secondary,
            },
          ]}
          scrollEnabled={options.length > 6}
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={true}
        >
          {options.map((option) => {
            const isSelected = selectedValues.includes(option.value);

            return (
              <Pressable
                key={option.value}
                onPress={() => handleSelect(option.value)}
                style={[
                  styles.option,
                  {
                    backgroundColor: isSelected
                      ? colors.accent.lime
                      : colors.surface.secondary,
                  },
                ]}
              >
                <Text
                  variant="body"
                  color={
                    isSelected
                      ? colors.button.primaryText
                      : colors.text.primary
                  }
                >
                  {option.label}
                </Text>
                {isSelected && multiSelect && (
                  <Text
                    variant="body"
                    color={colors.button.primaryText}
                    style={styles.checkmark}
                  >
                    ✓
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    marginBottom: spacing.sm,
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
    maxHeight: 240,
  },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: dimensions.border.thin,
    borderBottomColor: colors.surface.tertiary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkmark: {
    marginLeft: spacing.md,
    fontWeight: 'bold',
  },
  errorText: {
    marginTop: spacing.xs,
  },
});
