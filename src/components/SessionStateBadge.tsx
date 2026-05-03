/**
 * SessionStateBadge — Small inline state tag for session cards.
 *
 * Shows athlete-friendly progression labels.
 * Color-coded by state type. Compact pill style.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './common/Text';
import type { SessionStateLabel } from '../utils/sessionExplanation';

interface Props {
  state: SessionStateLabel;
}

const STATE_CONFIG: Record<string, { color: string; bg: string }> = {
  'Building':     { color: '#C8FF00', bg: 'rgba(200, 255, 0, 0.12)' },
  'Steady':       { color: '#B0B0B0', bg: 'rgba(176, 176, 176, 0.10)' },
  'Holding':      { color: '#FFB74D', bg: 'rgba(255, 183, 77, 0.12)' },
  'Backing off':  { color: '#64B5F6', bg: 'rgba(100, 181, 246, 0.12)' },
  'Easing in':    { color: '#81C784', bg: 'rgba(129, 199, 132, 0.12)' },
  'Pushing hard': { color: '#EF5350', bg: 'rgba(239, 83, 80, 0.12)' },
};

export const SessionStateBadge: React.FC<Props> = ({ state }) => {
  if (!state) return null;
  const config = STATE_CONFIG[state];
  if (!config) return null;

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.color }]}>
        {state}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
