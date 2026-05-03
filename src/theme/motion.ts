/**
 * Motion tokens for Local Footy Athlete
 *
 * Keep the vocabulary small — one motion curve family, four durations.
 * Consumers should reach for these tokens instead of hard-coding numbers
 * so the app feels coherent as we layer in animated primitives.
 *
 * Used primarily by the V2 UI primitives (Button, Card, Sheet, Badge).
 */

// Durations (milliseconds)
export const duration = {
  // Press/release feedback — the finger is still on the screen
  instant: 80,
  // Small UI transitions (badges, chips, micro-hover)
  fast: 160,
  // Modal + sheet presentation, list item reveal
  base: 240,
  // Page/section transitions, celebratory emphasis
  slow: 360,
} as const;

// Easing curves (cubic-bezier control points, compatible with Animated.timing)
//
// Standard:   natural acceleration + deceleration — default for most things.
// Emphasized: stronger deceleration — use for incoming surfaces (sheets, modals).
// Exit:       stronger acceleration — use for dismissing surfaces.
// Spring:     playful overshoot — use sparingly for celebratory/"achievement"
//             feedback (completed workout, streak increment).
export const easing = {
  standard: [0.2, 0, 0, 1] as const,
  emphasized: [0.05, 0.7, 0.1, 1] as const,
  exit: [0.3, 0, 1, 1] as const,
  spring: [0.34, 1.56, 0.64, 1] as const,
} as const;

// Pressed-state opacity — used consistently across all interactive surfaces
// so taps feel the same everywhere.
export const press = {
  opacity: 0.75,
  scale: 0.98,
} as const;

export type DurationKey = keyof typeof duration;
export type EasingKey = keyof typeof easing;
