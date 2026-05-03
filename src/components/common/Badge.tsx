import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, dimensions } from '../../theme/spacing';
import { Text } from './Text';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'accent';
export type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
}

export const Badge = ({
  text,
  variant = 'accent',
  size = 'md',
  style,
}: BadgeProps) => {
  const getBackgroundColor = () => {
    switch (variant) {
      case 'success':
        return colors.status.success;
      case 'warning':
        return colors.status.warning;
      case 'error':
        return colors.status.error;
      case 'info':
        return colors.status.info;
      case 'accent':
        return colors.accent.lime;
      default:
        return colors.accent.lime;
    }
  };

  const getTextColor = () => {
    const bgColor = getBackgroundColor();
    // Light text for bright backgrounds (accent, warning)
    if (bgColor === colors.accent.lime || bgColor === colors.status.warning) {
      return colors.button.primaryText;
    }
    // White text for dark/saturated backgrounds
    return colors.text.primary;
  };

  const getPadding = () => {
    switch (size) {
      case 'sm':
        return { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs };
      case 'md':
        return { paddingHorizontal: spacing.md, paddingVertical: spacing.sm };
      default:
        return { paddingHorizontal: spacing.md, paddingVertical: spacing.sm };
    }
  };

  const badgeStyle: ViewStyle = {
    backgroundColor: getBackgroundColor(),
    borderRadius: borderRadius.full,
    ...getPadding(),
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <View style={[styles.badge, badgeStyle, style]}>
      <Text
        variant={size === 'sm' ? 'caption' : 'bodySmall'}
        color={getTextColor()}
        align="center"
      >
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
  },
});
