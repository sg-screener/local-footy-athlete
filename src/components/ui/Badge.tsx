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
export type V2BadgeSize = 'xxs' | 'xs' | 'sm';

export interface V2BadgeProps {
  label: string;
  tone?: V2BadgeTone;
  size?: V2BadgeSize;
  style?: StyleProp<ViewStyle>;
  /**
   * A COORDINATE FOR A FLOW, ADDED 2026-08-10 BY UI MERGE SLICE 2.
   *
   * Ruling 5 removes the "Today" badge from the day screen and keeps it in the
   * week list, and the only device-level way to state that is an id — asserting
   * on the TEXT "Today" hits the Today/Week toggle, which is a different control
   * that also says the word. That false positive was written and caught on this
   * flow's first run; the id is the fix, not a looser assertion.
   */
  testID?: string;
}

export function Badge({
  label,
  tone = 'muted',
  size = 'xs',
  style,
  testID,
}: V2BadgeProps) {
  const t = toneStyles(tone);
  const s = sizeStyles(size);

  return (
    <View
      testID={testID}
      style={[
        styles.base,
        { backgroundColor: t.bg, borderColor: t.border, borderWidth: t.border === 'transparent' ? 0 : 1 },
        s.box,
        style,
      ]}
    >
      <Text style={[styles.text, { color: t.text, fontSize: s.font, lineHeight: s.line }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

function toneStyles(tone: V2BadgeTone) {
  switch (tone) {
    case 'accent':
      return { bg: '#D8D800', text: '#0C0C0C', border: 'transparent' };
    case 'outline':
      return { bg: 'rgba(216, 216, 0, 0.15)', text: '#D8D800', border: 'rgba(216, 216, 0, 0.40)' };
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
    case 'xxs':
      return { box: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3 } as ViewStyle, font: 8, line: 10 };
    case 'sm':
      return { box: { paddingHorizontal: 10, paddingVertical: 4 } as ViewStyle, font: 11, line: 14 };
    case 'xs':
    default:
      return { box: { paddingHorizontal: 7, paddingVertical: 3 } as ViewStyle, font: 10, line: 12 };
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
