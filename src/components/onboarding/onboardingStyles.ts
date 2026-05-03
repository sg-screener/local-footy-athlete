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
 * Day-grid layout lives in `<DayGrid>` (../onboarding/DayGrid.tsx) — that
 * component is the single source of truth for the Mon–Sat 3-up grid +
 * centered-Sunday last row used by PreferredTrainingDays and
 * TeamTrainingDays.
 */

export const headingXL: TextStyle = {
  fontWeight: '700',
};
