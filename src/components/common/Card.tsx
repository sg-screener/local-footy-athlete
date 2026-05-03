import React from 'react';
import {
  View,
  ViewStyle,
  StyleSheet,
  Pressable,
  GestureResponderEvent,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, shadows, dimensions } from '../../theme/spacing';

export type CardVariant = 'default' | 'elevated' | 'outlined';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: CardVariant;
  onPress?: (event: GestureResponderEvent) => void;
}

export const Card = ({
  children,
  style,
  variant = 'default',
  onPress,
}: CardProps) => {
  const isInteractive = !!onPress;

  const getCardStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      backgroundColor: colors.card.background,
      borderRadius: dimensions.cardRadius,
      padding: spacing.md,
      borderColor: colors.card.border,
      borderWidth: variant === 'outlined' ? 1 : 0,
    };

    if (variant === 'elevated') {
      return {
        ...baseStyle,
        ...shadows.md,
      };
    }

    return baseStyle;
  };

  const containerStyle: ViewStyle = {
    ...getCardStyle(),
  };

  const content = (
    <View style={[styles.container, containerStyle, style]}>
      {children}
    </View>
  );

  if (isInteractive) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          {
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
