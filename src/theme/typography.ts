/**
 * Typography system for Local Footy Athlete
 * Headings: Bebas Neue — bold, gritty, industrial
 * Body: Clean sans-serif system font
 */

export const typography = {
  // Heading 1 — Bebas Neue
  h1: {
    fontSize: 36,
    fontFamily: 'BebasNeue-Regular',
    fontWeight: '400' as const,
    lineHeight: 42,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },

  // Heading 2 — Bebas Neue
  h2: {
    fontSize: 30,
    fontFamily: 'BebasNeue-Regular',
    fontWeight: '400' as const,
    lineHeight: 36,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },

  // Heading 3 — Bebas Neue
  h3: {
    fontSize: 24,
    fontFamily: 'BebasNeue-Regular',
    fontWeight: '400' as const,
    lineHeight: 30,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },

  // Heading 4 (subheading) — Bebas Neue
  h4: {
    fontSize: 20,
    fontFamily: 'BebasNeue-Regular',
    fontWeight: '400' as const,
    lineHeight: 26,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },

  // Body — clean sans-serif
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
    letterSpacing: 0.3,
  },

  // Body Emphasis
  bodyEmphasis: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 24,
    letterSpacing: 0.3,
  },

  // Body Small
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
    letterSpacing: 0.2,
  },

  // Body Small Emphasis
  bodySmallEmphasis: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
    letterSpacing: 0.2,
  },

  // Caption — small labels and metadata
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
    letterSpacing: 0.4,
  },

  // Caption Emphasis
  captionEmphasis: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 0.4,
  },

  // Label — form labels and button text
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
    letterSpacing: 0.25,
  },

  // Label Small
  labelSmall: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 0.5,
  },

  // Overline — all caps labels (uses Bebas Neue)
  overline: {
    fontSize: 13,
    fontFamily: 'BebasNeue-Regular',
    fontWeight: '400' as const,
    lineHeight: 18,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },

  // Button text
  button: {
    fontSize: 16,
    fontWeight: '700' as const,
    lineHeight: 24,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },

  // Button Small
  buttonSmall: {
    fontSize: 14,
    fontWeight: '700' as const,
    lineHeight: 20,
    letterSpacing: 0.25,
    textTransform: 'uppercase' as const,
  },
};

// Font families
export const fontFamilies = {
  // Heading font — bold, industrial
  heading: 'BebasNeue-Regular',

  // Body font — clean system sans-serif
  default: 'System',

  // Platform-specific body fonts
  ios: {
    regular: 'System',
    bold: 'System',
    semibold: 'System',
  },

  android: {
    regular: 'Roboto',
    bold: 'Roboto',
    semibold: 'Roboto',
  },
};

export const fontWeights = {
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

export type FontWeight = keyof typeof fontWeights;
export type Typography = keyof typeof typography;
