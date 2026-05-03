/**
 * Spacing system for Local Footy Athlete
 * Consistent spacing scale and shadow values
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Convenient spacing shortcuts
export const spacingValues = {
  0: 0,
  xs: spacing.xs,     // 4
  sm: spacing.sm,     // 8
  md: spacing.md,     // 16
  lg: spacing.lg,     // 24
  xl: spacing.xl,     // 32
  xxl: spacing.xxl,   // 48

  // Additional increments
  'xxxs': 2,
  'xxs': 6,
  'smmd': 12,
  'mdlg': 20,
  'lgxl': 28,
  'xxxl': 40,
  'xxxxl': 56,
  'xxxxxl': 64,
};

export type Spacing = keyof typeof spacingValues;

// Border radius values
export const borderRadius = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
} as const;

export type BorderRadius = keyof typeof borderRadius;

// Shadow styles
export const shadows = {
  // No shadow
  none: {
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
  },

  // Extra small shadow - subtle elevation
  xs: {
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },

  // Small shadow - card-like elevation
  sm: {
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },

  // Medium shadow - standard card shadow
  md: {
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },

  // Large shadow - prominent elevation
  lg: {
    elevation: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },

  // Extra large shadow - modal/overlay shadow
  xl: {
    elevation: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
  },

  // Extra extra large shadow - deep elevation
  xxl: {
    elevation: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
  },

  // Colored shadows for dark theme
  accentShadow: {
    elevation: 8,
    shadowColor: '#C8FF00',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },

  accentShadowLarge: {
    elevation: 16,
    shadowColor: '#C8FF00',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
  },
};

export type Shadow = keyof typeof shadows;

// Elevation scale
export const elevation = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
} as const;

export type Elevation = keyof typeof elevation;

// Common dimension patterns
export const dimensions = {
  // Icon sizes
  icon: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
    xl: 40,
    xxl: 48,
  },

  // Avatar sizes
  avatar: {
    xs: 32,
    sm: 40,
    md: 48,
    lg: 64,
    xl: 80,
  },

  // Button heights
  button: {
    sm: 36,
    md: 44,
    lg: 52,
  },

  // Input heights
  input: {
    sm: 36,
    md: 44,
    lg: 52,
  },

  // Card corner radius
  cardRadius: 12,

  // Border width
  border: {
    thin: 0.5,
    normal: 1,
    medium: 2,
    thick: 3,
  },

  // Content width constraints
  maxContentWidth: 540,
};
