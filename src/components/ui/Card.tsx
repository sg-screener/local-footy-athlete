import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
  Animated,
} from 'react-native';
import { borderRadius, shadows, spacing } from '../../theme/spacing';
import { press } from '../../theme/motion';

/**
 * V2 Card primitive.
 *
 * Tone:
 *   - default  : elevated dark surface (#161616)
 *   - raised   : one notch lighter (#1E1E1E) — use when stacking cards
 *                inside another card / selected state
 *   - accent   : lime-tinted surface for highlighted/selected rows
 *   - outline  : transparent + lime border — picker chips
 *
 * Pass `onPress` to make it tappable (springs + opacity on press).
 *
 * Pass `selected` to draw a lime border + subtle tint; this is how the
 * weekly day-row communicates focus in V2.
 */

export type V2CardTone = 'default' | 'raised' | 'accent' | 'outline';

export interface V2CardProps {
  children: React.ReactNode;
  tone?: V2CardTone;
  selected?: boolean;
  onPress?: () => void;
  padding?: keyof typeof spacing | 'none';
  radius?: 'md' | 'lg' | 'xl';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

const PADDING_MAP: Record<string, number> = {
  none: 0,
  xs: spacing.xs,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
  xl: spacing.xl,
  xxl: spacing.xxl,
};

const RADIUS_MAP = {
  md: borderRadius.md,    // 8
  lg: borderRadius.lg,    // 12
  xl: borderRadius.xl,    // 16 — V2 default; gives the "soft/playful" feel
};

export function Card({
  children,
  tone = 'default',
  selected = false,
  onPress,
  padding = 'lg',
  radius = 'xl',
  style,
  accessibilityLabel,
  testID,
}: V2CardProps) {
  const { bg, border } = toneColors(tone, selected);
  const pad = PADDING_MAP[padding] ?? spacing.lg;
  const borderWidth = selected || tone === 'outline' ? 1.5 : 1;

  const containerStyle: ViewStyle = {
    backgroundColor: bg,
    borderRadius: RADIUS_MAP[radius],
    padding: pad,
    borderWidth,
    borderColor: border,
    ...shadows.xs,
  };

  const scale = React.useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    if (!onPress) return;
    Animated.timing(scale, {
      toValue: press.scale,
      duration: 80,
      useNativeDriver: true,
    }).start();
  };
  const onPressOut = () => {
    if (!onPress) return;
    Animated.timing(scale, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start();
  };

  if (!onPress) {
    return <View style={[containerStyle, style]} testID={testID}>{children}</View>;
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        testID={testID}
        style={({ pressed }) => [
          containerStyle,
          pressed && styles.pressed,
          style,
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function toneColors(tone: V2CardTone, selected: boolean) {
  if (selected) {
    return {
      bg: '#1A1D12',           // lime-tinted dark
      border: '#C8FF00',       // full-strength lime border
    };
  }
  switch (tone) {
    case 'raised':
      return { bg: '#1E1E1E', border: '#2A2A2A' };
    case 'accent':
      return { bg: '#1A1D12', border: 'rgba(200, 255, 0, 0.35)' };
    case 'outline':
      return { bg: 'transparent', border: '#2A2A2A' };
    case 'default':
    default:
      return { bg: '#161616', border: '#222222' };
  }
}

const styles = StyleSheet.create({
  pressed: {
    opacity: press.opacity,
  },
});
