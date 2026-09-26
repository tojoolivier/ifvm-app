/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#171d19',
    background: '#f5efe3',
    backgroundElement: '#f9f4ec',
    backgroundSelected: '#e9dfc4',
    textSecondary: '#2f4339',
    screen: '#F0F2F5',
    card: '#FFFFFF',
    border: '#F0F0F0',
    inputBg: '#F5F5F5',
    inputBorder: '#E0E0E0',
    chipBg: '#F0F2F5',
    title: '#1A237E',
    muted: '#757575',
    faint: '#9E9E9E',
    greenSoft: '#E8F5E9',
    dangerBorder: '#FCE4EC',
    switchTrackOff: '#D1D5DB',
    danger: '#DC2626',
    dangerBg: '#FEF2F2',
    success: '#15803D',
    successBg: '#DCFCE7',
    successBorder: '#86EFAC',
    warn: '#8A6D2F',
    warnBg: '#FDF6E7',
    warnBorder: '#F0E2BF',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    screen: '#0B0C0E',
    card: '#1A1C1F',
    border: '#2E3135',
    inputBg: '#25272B',
    inputBorder: '#3A3E44',
    chipBg: '#2E3135',
    title: '#C5CAE9',
    muted: '#B0B4BA',
    faint: '#8A8F96',
    greenSoft: '#1E3A22',
    dangerBorder: '#5A2A33',
    switchTrackOff: '#4B5058',
    danger: '#F87171',
    dangerBg: '#3A1D22',
    success: '#4ADE80',
    successBg: '#1E3A22',
    successBorder: '#2F6B3F',
    warn: '#FBBF24',
    warnBg: '#3A3020',
    warnBorder: '#5A4A2A',
  },
} as const;

/** Palette du thème courant (clair ou sombre) — passée aux fabriques `createStyles`. */
export type ThemePalette = (typeof Colors)[keyof typeof Colors];

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
