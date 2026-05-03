import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Text } from '../common/Text';

/**
 * V2 Badge — pill-style label.
 *
 * Tone presets:
 *   - accent  : lime background, dark text — "TODAY"
 *   - outline : lime border, lime text — "GAME", "MOVING"
 *   - muted   : grey surface, grey text — category tags
 *   - success / warning / danger : coloured tints for status callouts
 *
 * Keep badge text SHORT (≤ 8 chars) and uppercase.
 */

export type V2BadgeTone = 'accent' | 'outline' | 'muted' | 'success' | 'warning' | 'danger';
export type V2BadgeSize = 'xs' | 'sm';

export interface V2BadgeProps {
  label: string;
  tone?: V2BadgeTone;
  size?: V2BadgeSize;
  style?: StyleProp<ViewStyle>;
}

export function Badge({
  label,
  tone = 'muted',
  size = 'xs',
  style,
}: V2BadgeProps) {
  const t = toneStyles(tone);
  const s = sizeStyles(size);

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: t.bg, borderColor: t.border, borderWidth: t.border === 'transparent' ? 0 : 1 },
        s.box,
        style,
      ]}
    >
      <Text style={[styles.text, { color: t.text, fontSize: s.font }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

function toneStyles(tone: V2BadgeTone) {
  switch (tone) {
    case 'accent':
      return { bg: '#C8FF00', text: '#0C0C0C', border: 'transparent' };
    case 'outline':
      return { bg: 'rgba(200, 255, 0, 0.15)', text: '#C8FF00', border: 'rgba(200, 255, 0, 0.40)' };
    case 'success':
      return { bg: 'rgba(76, 175, 80, 0.15)', text: '#81C784', border: 'rgba(76, 175, 80, 0.35)' };
    case 'warning':
      return { bg: 'rgba(255, 193, 7, 0.15)', text: '#FFC107', border: 'rgba(255, 193, 7, 0.35)' };
    case 'danger':
      return { bg: 'rgba(244, 67, 54, 0.15)', text: '#EF5350', border: 'rgba(244, 67, 54, 0.35)' };
    case 'muted':
    default:
      return { bg: '#242424', text: '#AAAAAA', border: 'transparent' };
  }
}

function sizeStyles(size: V2BadgeSize) {
  switch (size) {
    case 'sm':
      return { box: { paddingHorizontal: 10, paddingVertical: 4 } as ViewStyle, font: 11 };
    case 'xs':
    default:
      return { box: { paddingHorizontal: 7, paddingVertical: 3 } as ViewStyle, font: 10 };
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '800',
    letterSpacing: 0.9,
  },
});
