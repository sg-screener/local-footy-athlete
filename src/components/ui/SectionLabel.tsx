import React from 'react';
import { StyleSheet, TextStyle, StyleProp } from 'react-native';
import { Text } from '../common/Text';

/**
 * V2 SectionLabel — tiny uppercase header that introduces a group.
 *
 * "NEED TO ADJUST YOUR WEEKLY PLAN?", "CHANGING SEASON PHASE?" etc.
 * Kept small and muted so the content underneath carries the emphasis.
 */

export interface V2SectionLabelProps {
  children: string;
  style?: StyleProp<TextStyle>;
}

export function SectionLabel({ children, style }: V2SectionLabelProps) {
  return <Text style={[styles.label, style]}>{children.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  label: {
    color: '#5A5A5A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
});
