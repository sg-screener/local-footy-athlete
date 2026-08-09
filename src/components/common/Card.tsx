import React from 'react';
import {
  View,
  StyleProp,
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
  /** React Native accepts style arrays and falsy entries; the prop type must too. */
  style?: StyleProp<ViewStyle>;
  variant?: CardVariant;
  onPress?: (event: GestureResponderEvent) => void;
  /**
   * ANCHORS THE CARD FOR A GATE OR AN ON-DEVICE EXPLORER.
   *
   * Added by the Journal UI slice, where whole cards appear and vanish by the
   * exception rule and "did this card render" is the thing worth asserting. A
   * shared card with no testID forces every caller to wrap it in a bare `View`
   * just to be findable — which adds a layout node to make a card observable,
   * and this repo has already paid for invisible nodes participating in layout.
   */
  testID?: string;
}

export const Card = ({
  children,
  style,
  variant = 'default',
  onPress,
  testID,
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
    <View style={[styles.container, containerStyle, style]} testID={testID}>
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
