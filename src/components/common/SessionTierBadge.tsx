import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors } from '../../theme/colors';
import type { SessionTier } from '../../types/domain';

/**
 * ONE BADGE SLOT PER SESSION ROW, AND "DONE" IS ONE OF THE WORDS IN IT.
 *
 * Sam, 2026-08-22: *"Done badge is bigger than the core badge on weekly view —
 * make it the same size — then once it's same size and a session is logged it
 * should replace the badge for that day. i.e. done should replace core or
 * optional and so on"*.
 *
 * ⚠ **THE SIZE DIFFERENCE WAS NOT THE FONT.** Both badges already drew 8pt
 * text on a 10pt line. DONE was the shared `ui/Badge` at `size="xxs"`, which
 * adds a 1px border on its `success` tone — so it stood 16pt tall against this
 * badge's 14, with wider letter-spacing. Two components drawing the same kind
 * of chip is two geometries to keep in step, and they had already drifted.
 * DONE is a word in THIS badge's table now, so it cannot differ again.
 *
 * Its colours are the `success` tone's, carried over unchanged: the chip's
 * SIZE moved, its meaning and its green did not.
 */
export type SessionBadgeKind = SessionTier | 'done';

interface SessionTierBadgeProps {
  /** A session tier, or `done` — the completed row shows that instead. */
  tier: SessionBadgeKind;
  style?: ViewStyle;
  /** The signed week-card treatment is deliberately smaller than day/card badges. */
  compact?: boolean;
}

const TIER_CONFIG: Record<SessionBadgeKind, { label: string; color: string; bg: string }> = {
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
  /* The `success` tone's own text and fill, to the value — see the note above. */
  done: {
    label: 'DONE',
    color: colors.status.successLight,
    bg: 'rgba(76, 175, 80, 0.15)',
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
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  compactText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
