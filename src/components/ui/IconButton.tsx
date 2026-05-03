import React from 'react';
import { Pressable, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { press } from '../../theme/motion';

/**
 * V2 IconButton — a circular tappable surface for a single icon.
 *
 * Surface tones:
 *   - default : #1A1A1A round button on a dark page
 *   - accent  : lime tint, for "action" icons (e.g. "+")
 *   - ghost   : transparent surface, for in-card icons (e.g. close "✕")
 *
 * Sizes: sm (32) | md (40) | lg (48).
 *
 * Always supply `accessibilityLabel`.
 */

export type V2IconButtonTone = 'default' | 'accent' | 'ghost';
export type V2IconButtonSize = 'sm' | 'md' | 'lg';

export interface V2IconButtonProps {
  onPress: () => void;
  icon: React.ReactNode;
  accessibilityLabel: string;
  tone?: V2IconButtonTone;
  size?: V2IconButtonSize;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<V2IconButtonSize, number> = { sm: 32, md: 40, lg: 48 };

export function IconButton({
  onPress,
  icon,
  accessibilityLabel,
  tone = 'default',
  size = 'md',
  disabled = false,
  style,
}: V2IconButtonProps) {
  const dim = SIZES[size];
  const bg = toneBg(tone, disabled);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: bg,
          opacity: pressed ? press.opacity : disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
}

function toneBg(tone: V2IconButtonTone, disabled: boolean): string {
  if (disabled) return '#1E1E1E';
  switch (tone) {
    case 'accent':
      return 'rgba(200, 255, 0, 0.14)';
    case 'ghost':
      return 'transparent';
    case 'default':
    default:
      return '#1A1A1A';
  }
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
