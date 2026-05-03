import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
  Animated,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { press } from '../../theme/motion';
import { Text } from '../common/Text';

/**
 * V2 Button primitive.
 *
 * Variants:
 *   - primary   : Lime fill on dark — main CTA. Has a soft accent glow.
 *   - secondary : Surface-toned fill — supportive action.
 *   - outline   : Transparent + lime border — alternate to primary.
 *   - ghost     : No background, lime text — low-emphasis action.
 *   - danger    : Red fill — destructive actions only.
 *
 * Sizes:
 *   - sm : 36h, compact chip-like CTA
 *   - md : 48h, default (workout cards, form buttons)
 *   - lg : 56h, hero CTA (e.g. "View Workout")
 *
 * Press interaction blends a scale-down (0.98) + opacity (0.75) micro-tilt
 * so taps feel responsive without being distracting.
 */

export type V2ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type V2ButtonSize = 'sm' | 'md' | 'lg';

export interface V2ButtonProps {
  label: string;
  onPress: () => void;
  variant?: V2ButtonVariant;
  size?: V2ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  /**
   * Whether primary buttons carry their accent lime glow. Defaults to true
   * to preserve existing look across screens. Set `false` on screens where
   * glow should be reserved for completion / success moments.
   */
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const HEIGHTS: Record<V2ButtonSize, number> = { sm: 36, md: 48, lg: 56 };
const FONT_SIZES: Record<V2ButtonSize, number> = { sm: 13, md: 15, lg: 16 };
const PADDINGS: Record<V2ButtonSize, number> = { sm: spacing.md, md: spacing.lg, lg: spacing.lg };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = true,
  glow = true,
  style,
  accessibilityLabel,
}: V2ButtonProps) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: press.scale,
      duration: 80,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start();
  };

  const bg = getBg(variant, disabled);
  const fg = getFg(variant, disabled);
  const border = getBorder(variant, disabled);

  const content = (
    <View style={styles.row}>
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          <Text
            style={[
              styles.label,
              { color: fg, fontSize: FONT_SIZES[size] },
            ] as TextStyle[]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </>
      )}
    </View>
  );

  return (
    <Animated.View
      style={[
        { transform: [{ scale }] },
        fullWidth && styles.fullWidth,
        variant === 'primary' && !disabled && glow && styles.primaryGlow,
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: disabled || loading }}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.base,
          {
            backgroundColor: bg,
            borderColor: border,
            borderWidth: variant === 'outline' ? 1.5 : 0,
            height: HEIGHTS[size],
            paddingHorizontal: PADDINGS[size],
            opacity: pressed && !disabled && !loading ? press.opacity : 1,
          },
        ]}
      >
        {content}
      </Pressable>
    </Animated.View>
  );
}

function getBg(variant: V2ButtonVariant, disabled: boolean): string {
  if (disabled) return '#2A2A2A';
  switch (variant) {
    case 'primary':
      return colors.accent.lime;
    case 'secondary':
      return '#1E1E1E';
    case 'outline':
    case 'ghost':
      return 'transparent';
    case 'danger':
      return colors.status.error;
  }
}

function getFg(variant: V2ButtonVariant, disabled: boolean): string {
  if (disabled) return '#666666';
  switch (variant) {
    case 'primary':
      return '#0C0C0C';
    case 'secondary':
      return '#FFFFFF';
    case 'outline':
    case 'ghost':
      return colors.accent.lime;
    case 'danger':
      return '#FFFFFF';
  }
}

function getBorder(variant: V2ButtonVariant, disabled: boolean): string {
  if (variant !== 'outline') return 'transparent';
  return disabled ? '#3A3A3A' : colors.accent.lime;
}

const styles = StyleSheet.create({
  fullWidth: { alignSelf: 'stretch' },
  base: {
    borderRadius: borderRadius.lg, // 12 — softer than default 8, not rounded pill
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  iconLeft: { marginRight: spacing.sm },
  iconRight: { marginLeft: spacing.sm },
  primaryGlow: {
    ...shadows.accentShadow,
  },
});
