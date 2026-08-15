/**
 * Fnashha brand colors — extracted from the web app's index.css HSL tokens
 * and converted to hex for React Native.
 *
 * Primary: hsl(43 80% 57%)  → #E9B73A  (golden amber)
 * Background: hsl(210 20% 98%) → #F7F9FB
 */

const colors = {
  light: {
    // Legacy alias
    text: '#1A1A1A',
    tint: '#E9B73A',

    // Core surfaces
    background: '#F7F9FB',
    foreground: '#1A1A1A',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#1A1A1A',
    inputForeground: '#1A1A1A',

    // Primary action — Fnashha golden amber
    primary: '#E9B73A',
    primaryForeground: '#FFFFFF',
    primaryDark: '#C89820',
    primaryLight: '#FDF3D6',

    // Secondary
    secondary: '#FAF3DC',
    secondaryForeground: '#5A4A1A',

    // Muted / subdued
    muted: '#EFF1F5',
    mutedForeground: '#737373',

    // Accent
    accent: '#FFF8E7',
    accentForeground: '#B8860B',

    // States
    destructive: '#DC2626',
    destructiveForeground: '#FFFFFF',
    success: '#16A34A',
    info: '#2563EB',
    warning: '#D97706',
    notificationPurple: '#6956D7',
    notificationBlue: '#3CA7DD',
    notificationGreen: '#22C35D',
    notificationCyan: '#06B6D4',
    notificationGold: '#F5C518',
    notificationRed: '#DC2828',
    notificationAmber: '#F59E0B',

    // Borders
    border: '#E1E5EA',
    input: '#E1E5EA',
  },

  dark: {
    // Legacy alias
    text: '#F1F1F1',
    tint: '#E9B73A',

    // Core surfaces
    background: '#0F1117',
    foreground: '#F1F1F1',

    // Cards / elevated surfaces
    card: '#1A1E27',
    cardForeground: '#F1F1F1',
    // Request-form inputs use the same readable foreground as the rest of
    // the dark palette.
    inputForeground: '#F1F1F1',

    // Primary action — Fnashha golden amber
    primary: '#E9B73A',
    primaryForeground: '#1A1A1A',
    primaryDark: '#C89820',
    primaryLight: '#2E2508',

    // Secondary
    secondary: '#211D0E',
    secondaryForeground: '#E9B73A',

    // Muted / subdued
    muted: '#252B36',
    mutedForeground: '#8B929E',

    // Accent
    accent: '#231D08',
    accentForeground: '#E9B73A',

    // States
    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',
    success: '#22C55E',
    info: '#60A5FA',
    warning: '#FBBF24',
    notificationPurple: '#A899FF',
    notificationBlue: '#3CA7DD',
    notificationGreen: '#22C35D',
    notificationCyan: '#06B6D4',
    notificationGold: '#F5C518',
    notificationRed: '#DC2828',
    notificationAmber: '#F59E0B',

    // Borders
    border: '#2A303D',
    input: '#2A303D',
  },

  // Match web app --radius: 0.5rem → 8px, but we use 12 for mobile friendliness
  radius: 12,
};

export default colors;
