/**
 * Color palette for Local Footy Athlete
 * Dark industrial aesthetic — bold, strong, confident
 * Like a footy club gym, not a yoga studio
 */

export const colors = {
  // Primary colors — dark industrial base
  primary: {
    dark: '#0C0C0C',      // Near-black — primary background
    main: '#161616',      // Slightly lighter — elevated surfaces
    light: '#222222',     // Light variant for hover/pressed states
  },

  // Accent colors — lime green punch
  accent: {
    lime: '#C8FF00',      // Primary accent — CTAs, highlights, energy
    limeDark: '#A3CC00',  // Darker lime for pressed states
    limeLight: '#D9FF4D', // Lighter lime for subtle highlights
  },

  // Secondary colors — kept minimal, the lime does the heavy lifting
  secondary: {
    main: '#FFFFFF',      // White as secondary for contrast
    dark: '#E0E0E0',      // Off-white
    light: '#F5F5F5',     // Near-white
  },

  // Neutral colors
  neutral: {
    white: '#FFFFFF',
    gray100: '#F5F5F5',
    gray200: '#E0E0E0',
    gray300: '#BDBDBD',
    gray400: '#9E9E9E',
    gray500: '#757575',
    gray600: '#4A4A4A',
    gray700: '#333333',
    gray800: '#222222',
    gray900: '#161616',
    black: '#0C0C0C',
  },

  // Surface colors
  surface: {
    primary: '#0C0C0C',     // Main background
    secondary: '#161616',   // Card/elevated background
    tertiary: '#222222',    // Secondary surface / borders
    overlay: 'rgba(0, 0, 0, 0.6)',
    overlayLight: 'rgba(0, 0, 0, 0.3)',
    overlayDark: 'rgba(0, 0, 0, 0.85)',
  },

  // Text colors
  text: {
    primary: '#FFFFFF',
    secondary: '#B0B0B0',
    tertiary: '#757575',
    disabled: '#4A4A4A',
    inverse: '#0C0C0C',
    accent: '#C8FF00',
  },

  // Status colors
  status: {
    success: '#4CAF50',
    successLight: '#81C784',
    successDark: '#388E3C',
    warning: '#FFC107',
    warningLight: '#FFD54F',
    warningDark: '#FFA000',
    error: '#F44336',
    errorLight: '#EF5350',
    errorDark: '#C62828',
    info: '#2196F3',
    infoLight: '#64B5F6',
    infoDark: '#1565C0',
  },

  // Intensity-based colors
  intensity: {
    light: '#81C784',       // Green — low intensity
    moderate: '#FFB74D',    // Orange — moderate intensity
    high: '#EF5350',        // Red — high intensity
    maximal: '#D32F2F',     // Dark red — maximal intensity
  },

  // Session feeling colors (replaces RPE)
  feeling: {
    cooked: '#D32F2F',      // Dark red — absolutely smashed
    strong: '#C8FF00',      // Lime — felt powerful
    good: '#4CAF50',        // Green — solid session
    average: '#FFB74D',     // Orange — nothing special
    sore: '#FF7043',        // Deep orange — body hurting
  },

  // Gradient arrays
  gradients: {
    primary: ['#0C0C0C', '#161616'],
    accent: ['#C8FF00', '#A3CC00'],
    dark: ['#161616', '#0C0C0C'],
    energyHigh: ['#F44336', '#FF6D00'],
    energyMedium: ['#FFB74D', '#FFC107'],
    energyLow: ['#4CAF50', '#81C784'],
    darkOverlay: ['rgba(0, 0, 0, 0.85)', 'rgba(0, 0, 0, 0.4)'],
  },

  // Component-specific colors
  button: {
    primary: '#C8FF00',
    primaryText: '#0C0C0C',
    secondary: '#222222',
    secondaryText: '#FFFFFF',
    tertiary: '#333333',
    tertiaryText: '#FFFFFF',
    disabled: '#333333',
    disabledText: '#757575',
  },

  // Input colors
  input: {
    background: '#161616',
    border: '#333333',
    borderFocused: '#C8FF00',
    text: '#FFFFFF',
    placeholder: '#757575',
  },

  // Card colors
  card: {
    background: '#161616',
    border: '#222222',
    shadow: 'rgba(0, 0, 0, 0.4)',
  },

  // Badge colors
  badge: {
    default: '#333333',
    primary: '#C8FF00',
    secondary: '#222222',
    success: '#4CAF50',
    warning: '#FFC107',
    error: '#F44336',
    info: '#2196F3',
  },
};

export type ColorKey = keyof typeof colors;
export type ColorValue = string | string[];
