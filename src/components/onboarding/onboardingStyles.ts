import { TextStyle } from 'react-native';

/**
 * Shared onboarding style primitives.
 *
 * `headingXL` is the canonical look for every onboarding screen's main
 * title (h1). It overlays the h1 typography with the same heavier weight
 * the early "thick" screens (GameDay, Position, Name, Motivation,
 * BodyMeasurements) were already using — so the rest of the flow now
 * matches them instead of falling back to the lighter h1 default.
 *
 * Spread it into a screen's local title style to keep per-screen
 * spacing (marginBottom, etc.) intact:
 *
 *   title: {
 *     ...headingXL,
 *     marginBottom: spacing.sm,
 *   },
 *
 * Day-picker layout lives in `<DayGrid>` (../onboarding/DayGrid.tsx). That
 * component owns both the default Mon–Sat 3-up grid + centered Sunday and the
 * explicit seven-across rounded-square row used by Game Day and usual gym days.
 */

export const headingXL: TextStyle = {
  fontWeight: '700',
};

/**
 * Canonical typography for a choice card with a heading and supporting line.
 *
 * Keep answer text on the system face and never force its casing. The authored
 * copy decides whether a label is sentence case or intentionally all-caps;
 * heading variants are reserved for screen headings.
 */
export const answerCardTitle: TextStyle = {
  fontSize: 16,
  fontWeight: '700',
  lineHeight: 24,
  letterSpacing: 0.5,
  textTransform: 'none',
};

export const answerCardSubtitle: TextStyle = {
  fontSize: 13,
  fontWeight: '400',
  lineHeight: 20,
  textTransform: 'none',
};
