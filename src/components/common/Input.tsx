import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, dimensions } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Text } from './Text';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
}

export const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  multiline = false,
  icon,
  disabled = false,
  style,
  ...props
}: InputProps) => {
  const [focused, setFocused] = useState(false);

  const inputHeight = multiline ? dimensions.input.lg * 2 : dimensions.input.md;

  const containerStyle: ViewStyle = {
    marginBottom: error ? spacing.md : spacing.sm,
  };

  const inputBorderColor = focused
    ? colors.input.borderFocused
    : error
      ? colors.status.error
      : colors.input.border;

  const inputContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: multiline ? 'flex-start' : 'center',
    backgroundColor: colors.input.background,
    borderColor: inputBorderColor,
    borderWidth: dimensions.border.normal,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: multiline ? spacing.sm : 0,
    minHeight: inputHeight,
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

      <View style={inputContainerStyle}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}

        <TextInput
          {...props}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.input.placeholder}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          editable={!disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            {
              color: colors.input.text,
              opacity: disabled ? 0.5 : 1,
            },
            typography.body,
          ]}
        />
      </View>

      {error && (
        <Text
          variant="caption"
          color={colors.status.error}
          style={styles.errorText}
        >
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    marginBottom: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  errorText: {
    marginTop: spacing.xs,
  },
});
