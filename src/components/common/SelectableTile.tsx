import React from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
  PressableProps,
} from 'react-native';
import { Text } from './Text';
import { colors } from '../../theme/colors';

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  SelectableTile — THE global selection primitive for the whole app
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Every selectable card / chip / tile in the product should either:
 *   (a) render <SelectableTile> directly, or
 *   (b) reuse the shared `tileStyles` + <TileCheckmark /> so the visual
 *       vocabulary is identical even when the container needs bespoke
 *       flex/grid geometry.
 *
 * This replaces the ~10 ad-hoc `cardSelected` / `dayCardSelected` /
 * `chipSelected` / `optionSelected` StyleSheets that had drifted across
 * onboarding and settings. Those screens should import from here, not
 * re-derive the look.
 *
 * The look — established across the onboarding pass — is deliberately
 * multi-signal so the active state reads instantly regardless of lighting
 * or contrast sensitivity:
 *
 *   • lime border (1.5px, colors.accent.lime)
 *   • lime-tinted fill (rgba(200, 255, 0, 0.12) — ~12% opacity)
 *   • gentle upward scale (1.02) — feels like the tile lifts towards you
 *   • corner checkmark badge (18×18, top:6 right:6, lime fill / dark tick)
 *
 * IMPORTANT: no glow/accent shadow here. Glow is reserved for
 * completion / success states (per the "Glow reserved for completion"
 * design rule). Selection is high-visibility without it.
 *
 * ── Shape variants (layout / geometry axis) ────────────────────────────
 * `shape="card"` (default) — rounded rectangle, large padding; for goal
 *   cards, team training cards, equipment cards, big option cards.
 * `shape="chip"` — tighter padding and smaller radius; for day chips,
 *   filter pills, phase-shift day picker.
 *
 * ── Selected-look variants (density axis) ──────────────────────────────
 * `variant="card"` (default) — full 12% lime-tinted fill + 1.02 scale +
 *   standard 18×18 corner checkmark. Best for text cards where the card
 *   itself (label + subtitle) is the content surface, and a strong fill
 *   helps the block read as a selected block.
 * `variant="grid"` — much lighter 4% fill + NO scale transform + smaller
 *   14×14 corner checkmark. For number grids and compact single-label
 *   tiles where the content (a "6" or "90 min") should dominate the
 *   visual. The consumer is expected to colour the label with
 *   `colors.accent.lime` when selected — the lighter chrome yields to
 *   the text signal. Use together with `shape="card"` for most grids.
 *
 * The two axes are orthogonal: `shape` controls padding/radius, `variant`
 * controls selected-state intensity. Either can be swapped without
 * touching the other.
 *
 * ── Author's note ──────────────────────────────────────────────────────
 * The `style` prop is always appended LAST in the inner Pressable's style
 * array, so screens can override widths / flex / height without having to
 * know the internals. But please: don't override border or background
 * when the tile is "selected" — that's what this primitive exists to
 * prevent. If you need a different SELECTED look, it should land here as
 * a new `variant`, not as a per-screen override.
 */

/* ── Base style tokens ─────────────────────────────────────────────── */

export const TILE_RADIUS_CARD = 14;
export const TILE_RADIUS_CHIP = 12;
export const TILE_BORDER_WIDTH = 1.5;

/**
 * Exported style dictionary so screens that need bespoke container
 * geometry (e.g. `flex: 1`, `flexBasis: '31%'`) can still reach in for
 * the exact selected / pressed / dimmed looks.
 */
export const tileStyles = StyleSheet.create({
  /** Card shape — generous padding. Use for most option / goal cards. */
  baseCard: {
    backgroundColor: colors.surface.secondary,
    borderRadius: TILE_RADIUS_CARD,
    borderWidth: TILE_BORDER_WIDTH,
    borderColor: colors.surface.tertiary,
    paddingVertical: 16,
    paddingHorizontal: 16,
    position: 'relative',
  },
  /** Chip shape — tighter for dense rows (day pickers, filter chips). */
  baseChip: {
    backgroundColor: colors.surface.secondary,
    borderRadius: TILE_RADIUS_CHIP,
    borderWidth: TILE_BORDER_WIDTH,
    borderColor: colors.surface.tertiary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    position: 'relative',
  },

  /**
   * `variant="card"` selected visual — used everywhere a text card
   * surface needs a clearly-filled selected block. Paired with the
   * standard 18×18 checkmark and a subtle upward scale so the tile reads
   * as "lifted toward you".
   */
  selected: {
    borderColor: colors.accent.lime,
    backgroundColor: 'rgba(200, 255, 0, 0.12)',
    transform: [{ scale: 1.02 }],
  },

  /**
   * `variant="grid"` selected visual — deliberately quieter chrome so a
   * large number or short label can carry the signal instead. Much
   * lower-opacity fill, no scale transform. Paired with the smaller
   * 14×14 checkmark (see TileCheckmark / checkStyles.badgeGrid).
   *
   * Consumers are expected to colour the inner Text with
   * `colors.accent.lime` when selected so the content is the primary
   * cue — border + tint are only supporting signals.
   */
  selectedGrid: {
    borderColor: colors.accent.lime,
    backgroundColor: 'rgba(200, 255, 0, 0.04)',
  },

  /** Pressed (only applied when NOT selected — keeps selection stable). */
  pressed: {
    backgroundColor: colors.surface.tertiary,
  },

  /** Dimmed — e.g. when at a selection cap and the tile isn't selected. */
  dimmed: {
    opacity: 0.35,
  },
});

/* ── Corner checkmark badge ────────────────────────────────────────── */

const checkStyles = StyleSheet.create({
  /** Standard checkmark — paired with `variant="card"`. */
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    color: colors.text.inverse,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 12,
  },
  /**
   * Smaller, slightly-subdued checkmark — paired with `variant="grid"`.
   * Grid tiles lean on text colour as the primary signal, so the badge
   * is deliberately quieter: tighter badge, thinner tick, pulled a hair
   * further into the corner.
   */
  badgeGrid: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent.lime,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  markGrid: {
    color: colors.text.inverse,
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 10,
  },
});

/**
 * Tiny lime-filled check shown in the top-right of every selected tile.
 * Exported independently so screens using `tileStyles` directly (rather
 * than <SelectableTile />) can still render the identical indicator.
 *
 * `variant` mirrors the SelectableTile variant axis so the badge matches
 * the tile density it's placed on.
 */
export const TileCheckmark: React.FC<{ variant?: SelectableTileVariant }> = ({
  variant = 'card',
}) => (
  <View
    style={variant === 'grid' ? checkStyles.badgeGrid : checkStyles.badge}
    pointerEvents="none"
  >
    <Text style={variant === 'grid' ? checkStyles.markGrid : checkStyles.mark}>
      ✓
    </Text>
  </View>
);

/* ── The component ─────────────────────────────────────────────────── */

export type SelectableTileShape = 'card' | 'chip';
/**
 * `card` — full tint + scale, standard checkmark (default, text cards).
 * `grid` — low-opacity tint, no scale, smaller checkmark (number grids
 *   / compact tiles where the content itself should dominate).
 */
export type SelectableTileVariant = 'card' | 'grid';

export interface SelectableTileProps {
  isSelected: boolean;
  onPress: () => void;
  /** When true, tile is visibly dimmed (e.g. cap reached) and not pressable. */
  dimmed?: boolean;
  /** Disables presses without dimming (rare — usually pair with `dimmed`). */
  disabled?: boolean;
  /** `card` (default) = generous padding, `chip` = tight row-friendly. */
  shape?: SelectableTileShape;
  /**
   * Selected-state intensity. `card` (default) is the standard lit-up
   * look for text surfaces; `grid` is the quieter look for number grids
   * and compact tiles where the content should be the primary signal.
   */
  variant?: SelectableTileVariant;
  /** Suppress the corner checkmark (e.g. if the row is too tight for it). */
  hideCheckmark?: boolean;
  /** Optional override — applied AFTER all base + state styles. */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  /** Pass-throughs for tests / a11y. */
  testID?: PressableProps['testID'];
  accessibilityLabel?: PressableProps['accessibilityLabel'];
}

export const SelectableTile: React.FC<SelectableTileProps> = ({
  isSelected,
  onPress,
  dimmed = false,
  disabled = false,
  shape = 'card',
  variant = 'card',
  hideCheckmark = false,
  style,
  children,
  testID,
  accessibilityLabel,
}) => {
  const base = shape === 'chip' ? tileStyles.baseChip : tileStyles.baseCard;
  // Variant gates the SELECTED visual only — idle look is identical so
  // switching variants doesn't restyle the default state.
  const selectedStyle =
    variant === 'grid' ? tileStyles.selectedGrid : tileStyles.selected;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || dimmed}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected, disabled: disabled || dimmed }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        base,
        isSelected && selectedStyle,
        dimmed && tileStyles.dimmed,
        pressed && !isSelected && !dimmed && tileStyles.pressed,
        style,
      ]}
    >
      {children}
      {isSelected && !hideCheckmark ? <TileCheckmark variant={variant} /> : null}
    </Pressable>
  );
};
