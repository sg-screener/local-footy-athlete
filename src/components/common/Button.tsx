import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, dimensions } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export const Button = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  style,
}: ButtonProps) => {
  const [pressed, setPressed] = useState(false);

  const getBackgroundColor = () => {
    if (disabled) return colors.button.disabled;

    switch (variant) {
      case 'primary':
        return colors.button.primary;
      case 'secondary':
        return colors.button.secondary;
      case 'danger':
        return colors.status.error;
      case 'outline':
      case 'ghost':
        return 'transparent';
      default:
        return colors.button.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.button.disabledText;

    switch (variant) {
      case 'primary':
        return colors.button.primaryText;
      case 'secondary':
      case 'danger':
        return colors.button.secondaryText;
      case 'outline':
      case 'ghost':
        return colors.text.primary;
      default:
        return colors.button.primaryText;
    }
  };

  const getBorderColor = () => {
    if (variant === 'outline') {
      return disabled ? colors.button.disabled : colors.button.primary;
    }
    return 'transparent';
  };

  const getHeight = () => {
    switch (size) {
      case 'sm':
        return dimensions.button.sm;
      case 'md':
        return dimensions.button.md;
      case 'lg':
        return dimensions.button.lg;
      default:
        return dimensions.button.md;
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'sm':
        return spacing.sm;
      case 'md':
        return spacing.md;
      case 'lg':
        return spacing.lg;
      default:
        return spacing.md;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm':
        return typography.buttonSmall.fontSize;
      case 'md':
        return typography.button.fontSize;
      case 'lg':
        return typography.button.fontSize;
      default:
        return typography.button.fontSize;
    }
  };

  const buttonStyles: ViewStyle = {
    height: getHeight(),
    backgroundColor: getBackgroundColor(),
    borderColor: getBorderColor(),
    borderWidth: variant === 'outline' ? 1.5 : 0,
    borderRadius: borderRadius.lg,
    paddingHorizontal: getPadding(),
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    opacity: pressed && !disabled && !loading ? 0.7 : 1,
    width: fullWidth ? '100%' : 'auto',
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[buttonStyles, style]}
    >
      <View style={styles.contentContainer}>
        {loading ? (
          <ActivityIndicator color={getTextColor()} size="small" />
        ) : (
          <>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <Text
              variant={size === 'sm' ? 'bodySmall' : 'body'}
              color={getTextColor()}
              align="center"
              style={{
                fontSize: getFontSize(),
              }}
            >
              {title}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
});
