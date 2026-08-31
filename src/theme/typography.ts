import type { TextStyle } from 'react-native';

/**
 * Typography system for Local Footy Athlete.
 *
 * Sam, 2026-08-11: Renee's typography everywhere. Her signed prototype uses
 * the platform system face (`-apple-system` first) and this compact hierarchy.
 * On iPhone `System` is SF Pro; Android keeps its native Roboto equivalent.
 * One scale here means Program, Coach, Profile, Journal, onboarding and the
 * session flow cannot each grow their own interpretation of the reference.
 */

export const typography = {
  // Large page / completion title (prototype: 22-23px).
  h1: {
    fontSize: 23,
    fontFamily: 'System',
    fontWeight: '700' as const,
    lineHeight: 28,
    letterSpacing: -0.2,
  },

  // Sheet / section page title (prototype: 21px).
  h2: {
    fontSize: 21,
    fontFamily: 'System',
    fontWeight: '700' as const,
    lineHeight: 25,
    letterSpacing: -0.15,
  },

  // Prominent card title (prototype: 17px).
  h3: {
    fontSize: 17,
    fontFamily: 'System',
    fontWeight: '700' as const,
    lineHeight: 21,
    letterSpacing: 0,
  },

  // Card / question heading (prototype: 14px).
  h4: {
    fontSize: 14,
    fontFamily: 'System',
    fontWeight: '700' as const,
    lineHeight: 18,
    letterSpacing: 0.1,
  },

  // Body — prototype root token 11.5px.
  body: {
    fontSize: 11.5,
    fontFamily: 'System',
    fontWeight: '400' as const,
    lineHeight: 17,
    letterSpacing: 0,
  },

  // Body Emphasis
  bodyEmphasis: {
    fontSize: 11.5,
    fontFamily: 'System',
    fontWeight: '700' as const,
    lineHeight: 17,
    letterSpacing: 0,
  },

  // Body Small — 11pt is the iPhone readability floor.
  bodySmall: {
    fontSize: 11,
    fontFamily: 'System',
    fontWeight: '400' as const,
    lineHeight: 15,
    letterSpacing: 0,
  },

  // Body Small Emphasis
  bodySmallEmphasis: {
    fontSize: 11,
    fontFamily: 'System',
    fontWeight: '700' as const,
    lineHeight: 15,
    letterSpacing: 0,
  },

  // Caption — small labels and metadata, never smaller than readable copy.
  caption: {
    fontSize: 11,
    fontFamily: 'System',
    fontWeight: '400' as const,
    lineHeight: 14,
    letterSpacing: 0,
  },

  // Caption Emphasis
  captionEmphasis: {
    fontSize: 11,
    fontFamily: 'System',
    fontWeight: '700' as const,
    lineHeight: 14,
    letterSpacing: 0.2,
  },

  // Label — form labels and button text
  label: {
    fontSize: 11,
    fontFamily: 'System',
    fontWeight: '700' as const,
    lineHeight: 14,
    letterSpacing: 0.2,
  },

  // Label Small
  labelSmall: {
    fontSize: 11,
    fontFamily: 'System',
    fontWeight: '700' as const,
    lineHeight: 14,
    letterSpacing: 0.35,
  },

  // Overline — prototype section label.
  overline: {
    fontSize: 11,
    fontFamily: 'System',
    fontWeight: '800' as const,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },

  // Button text
  button: {
    fontSize: 12,
    fontFamily: 'System',
    fontWeight: '800' as const,
    lineHeight: 16,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },

  // Button Small
  buttonSmall: {
    fontSize: 11,
    fontFamily: 'System',
    fontWeight: '800' as const,
    lineHeight: 15,
    letterSpacing: 0.35,
    textTransform: 'uppercase' as const,
  },
};

export type TypographyToken = {
  fontSize: number;
  fontFamily?: string;
  fontWeight: TextStyle['fontWeight'];
  lineHeight: number;
  letterSpacing: number;
  textTransform?: TextStyle['textTransform'];
};

export type TypographyScale = Record<keyof typeof typography, TypographyToken>;

// Font families
export const fontFamilies = {
  // Renee's prototype leads with the platform system family everywhere.
  heading: 'System',

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
