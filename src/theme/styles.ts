/**
 * Centralized styles and theme exports
 * Re-exports all theme values and common style patterns
 */

import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { typography } from './typography';
import { spacing, borderRadius, shadows, dimensions } from './spacing';

// Re-export all theme modules
export { colors } from './colors';
export { typography, fontFamilies, fontWeights } from './typography';
export {
  spacing,
  spacingValues,
  borderRadius,
  shadows,
  elevation,
  dimensions,
} from './spacing';

// Common style patterns
export const commonStyles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },

  containerWithPadding: {
    flex: 1,
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },

  containerWithLargePadding: {
    flex: 1,
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },

  // Layout patterns
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  rowCenter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  centerFlex: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Content spacing
  contentSpacing: {
    marginBottom: spacing.md,
  },

  sectionSpacing: {
    marginBottom: spacing.lg,
  },

  // Card styles
  card: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.md,
  },

  cardCompact: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    ...shadows.sm,
  },

  cardPadded: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.md,
  },

  cardWithBorder: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.input.border,
    ...shadows.sm,
  },

  // Button styles
  button: {
    height: dimensions.button.md,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },

  buttonSmall: {
    height: dimensions.button.sm,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },

  buttonLarge: {
    height: dimensions.button.lg,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },

  buttonPrimary: {
    backgroundColor: colors.button.primary,
  },

  buttonSecondary: {
    backgroundColor: colors.button.secondary,
  },

  buttonTertiary: {
    backgroundColor: colors.button.tertiary,
  },

  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.button.primary,
  },

  buttonDisabled: {
    backgroundColor: colors.button.disabled,
    opacity: 0.5,
  },

  // Input styles
  input: {
    height: dimensions.input.md,
    backgroundColor: colors.input.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.input.border,
    paddingHorizontal: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.input.text,
  },

  inputFocused: {
    borderColor: colors.input.borderFocused,
  },

  inputError: {
    borderColor: colors.status.error,
  },

  // Text styles
  textPrimary: {
    color: colors.text.primary,
  },

  textSecondary: {
    color: colors.text.secondary,
  },

  textTertiary: {
    color: colors.text.tertiary,
  },

  textError: {
    color: colors.status.error,
  },

  textSuccess: {
    color: colors.status.success,
  },

  textWarning: {
    color: colors.status.warning,
  },

  textInfo: {
    color: colors.status.info,
  },

  textAccent: {
    color: colors.accent.lime,
  },

  textSecondaryAccent: {
    color: colors.secondary.main,
  },

  // Divider styles
  divider: {
    height: 1,
    backgroundColor: colors.input.border,
    marginVertical: spacing.md,
  },

  dividerThin: {
    height: 0.5,
    backgroundColor: colors.input.border,
  },

  // Badge styles
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },

  badgeLarge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },

  // Spacing utilities
  marginTop: {
    marginTop: spacing.md,
  },

  marginBottom: {
    marginBottom: spacing.md,
  },

  marginVertical: {
    marginVertical: spacing.md,
  },

  marginHorizontal: {
    marginHorizontal: spacing.md,
  },

  margin: {
    margin: spacing.md,
  },

  paddingTop: {
    paddingTop: spacing.md,
  },

  paddingBottom: {
    paddingBottom: spacing.md,
  },

  paddingVertical: {
    paddingVertical: spacing.md,
  },

  paddingHorizontal: {
    paddingHorizontal: spacing.md,
  },

  padding: {
    padding: spacing.md,
  },

  // Overlay styles
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface.overlay,
  },

  overlayLight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface.overlayLight,
  },

  // Shadow utilities
  shadowSmall: shadows.sm,
  shadowMedium: shadows.md,
  shadowLarge: shadows.lg,
  shadowXL: shadows.xl,

  // Flex utilities
  flex1: {
    flex: 1,
  },

  flex2: {
    flex: 2,
  },

  flex3: {
    flex: 3,
  },

  // Border radius utilities
  roundedSmall: {
    borderRadius: borderRadius.sm,
  },

  roundedMedium: {
    borderRadius: borderRadius.md,
  },

  roundedLarge: {
    borderRadius: borderRadius.lg,
  },

  roundedFull: {
    borderRadius: borderRadius.full,
  },

  // Absolute positioning
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },

  absoluteCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// Theme object for easy access
export const theme = {
  colors,
  typography,
  spacing,
  spacingValues: spacing,
  borderRadius,
  shadows,
  dimensions,
  commonStyles,
};

export default theme;
