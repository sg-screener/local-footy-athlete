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
    bg: 'rgba(216, 216, 0, 0.12)',
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

/**
 * ⚠ **ONE NUMBER, NOT EIGHT REPAINTED COLOURS** (Sam, 2026-09-04: *"these
 * badges i.e. core, recovery, etc - they're taking up too much attention - drop
 * their opacity down to 50%"*; then Sam, 2026-09-10, looking at the CORE chip
 * on his phone: *"the badges need to have opacity boosted 25% or so"* — so
 * 50% became 75%. Read as an absolute step, not a ratio; if it is still too
 * faint or too loud the one number below moves again).
 *
 * The chip competes because it is a saturated fill AND a bright bold word in the
 * same 14pt slot. Fading the whole `View` halves both at once and keeps the four
 * tones in the same relation to each other; hand-dimming the eight values in
 * `TIER_CONFIG` would be four pairs of numbers to keep in step, which is how the
 * DONE badge drifted out of this component's geometry in the first place (see
 * the header). It also stays correct if a fifth tier is ever added.
 *
 * Applied to the badge, never to the row: the session NAME beside it keeps its
 * full contrast, which is the point — the badge recedes so the name reads first.
 */
const BADGE_DE_EMPHASIS = 0.75;

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    opacity: BADGE_DE_EMPHASIS,
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
