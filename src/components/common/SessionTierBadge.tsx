import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors } from '../../theme/colors';
import type { SessionTier } from '../../types/domain';

interface SessionTierBadgeProps {
  tier: SessionTier;
  style?: ViewStyle;
  /** The signed week-card treatment is deliberately smaller than day/card badges. */
  compact?: boolean;
}

const TIER_CONFIG: Record<SessionTier, { label: string; color: string; bg: string }> = {
  core: {
    label: 'CORE',
    color: colors.accent.lime,
    bg: 'rgba(200, 255, 0, 0.12)',
  },
  optional: {
    label: 'OPTIONAL',
    color: colors.text.secondary,
    bg: 'rgba(176, 176, 176, 0.10)',
  },
  recovery: {
    label: 'RECOVERY',
    color: colors.status.info,
    bg: 'rgba(33, 150, 243, 0.10)',
  },
};

export const SessionTierBadge: React.FC<SessionTierBadgeProps> = ({ tier, style, compact = false }) => {
  const config = TIER_CONFIG[tier];
  if (!config) return null;

  return (
    <View style={[styles.badge, compact && styles.compactBadge, { backgroundColor: config.bg }, style]}>
      <Text style={[styles.text, compact && styles.compactText, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  compactBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  text: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  compactText: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
