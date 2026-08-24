import type { TypographyScale } from './typography';

/**
 * Onboarding keeps its larger scale, but uses the same system face and natural
 * casing as the rest of the app. Bebas Neue has no meaningful lowercase and
 * therefore made `textTransform: none` on individual screens ineffective.
 */
export const onboardingTypography = {
  h1: {
    fontSize: 36,
    fontFamily: 'System',
    fontWeight: '700' as const,
    lineHeight: 42,
    letterSpacing: -0.2,
  },
  h2: {
    fontSize: 30,
    fontFamily: 'System',
    fontWeight: '700' as const,
    lineHeight: 36,
    letterSpacing: -0.15,
  },
  h3: {
    fontSize: 24,
    fontFamily: 'System',
    fontWeight: '700' as const,
    lineHeight: 30,
    letterSpacing: 0,
  },
  h4: {
    fontSize: 20,
    fontFamily: 'System',
    fontWeight: '700' as const,
    lineHeight: 26,
    letterSpacing: 0.1,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
    letterSpacing: 0.3,
  },
  bodyEmphasis: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 24,
    letterSpacing: 0.3,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  bodySmallEmphasis: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  captionEmphasis: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
    letterSpacing: 0.25,
  },
  labelSmall: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  overline: {
    fontSize: 13,
    fontFamily: 'BebasNeue-Regular',
    fontWeight: '400' as const,
    lineHeight: 18,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
  button: {
    fontSize: 16,
    fontWeight: '700' as const,
    lineHeight: 24,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  buttonSmall: {
    fontSize: 14,
    fontWeight: '700' as const,
    lineHeight: 20,
    letterSpacing: 0.25,
    textTransform: 'uppercase' as const,
  },
} satisfies TypographyScale;
