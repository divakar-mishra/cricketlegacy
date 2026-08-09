/**
 * Central design system for the game.
 * Cricket-inspired palette: deep pitch greens, charcoal night, gold trophy accents.
 *
 * Two palettes (dark + light) share identical keys. Components read the active
 * one reactively via `useTheme()` and build styles with `makeStyles(colors)`.
 * `colors`/`gradients` remain exported as the dark defaults for back-compat.
 */
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from '../state/settingsStore';

export interface ThemeColors {
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceAlt: string;
  surfaceMuted: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  accentDark: string;
  accentLight: string;
  text: string;
  textMuted: string;
  textFaint: string;
  danger: string;
  dangerDark: string;
  warning: string;
  success: string;
  info: string;
  border: string;
  borderStrong: string;
  overlay: string;
  white: string;
  black: string;
  transparent: string;
}

export const darkColors: ThemeColors = {
  // Backgrounds — near-black, premium feel
  bg: '#07080C',
  bgElevated: '#0C0E15',
  surface: '#10131E',
  surfaceAlt: '#171C2A',
  surfaceMuted: '#090B12',

  // Brand — crisp emerald green, sharper than the old WhatsApp-green on AMOLED
  primary: '#00C97A',
  primaryDark: '#00A364',
  primaryLight: '#33D993',

  // Accent (gold / trophy)
  accent: '#E8B332',
  accentDark: '#C4902A',
  accentLight: '#F5CF65',

  // Text
  text: '#ECEFF4',
  textMuted: '#7A8899',
  textFaint: '#40505E',

  // Status
  danger: '#E5484D',
  dangerDark: '#B93A3E',
  warning: '#F5A524',
  success: '#30D070',
  info: '#4C9AFF',

  // Lines & overlays — subtle on black
  border: '#1A2035',
  borderStrong: '#242E45',
  overlay: 'rgba(0,0,0,0.70)',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

/** Light palette — same keys, tuned for legibility on light surfaces. */
export const lightColors: ThemeColors = {
  bg: '#F3F7F4',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#E7F0EA',
  surfaceMuted: '#EDF3EF',

  primary: '#009B5E',
  primaryDark: '#007547',
  primaryLight: '#00B86E',

  accent: '#B67B0B',
  accentDark: '#8A5D08',
  accentLight: '#D69A28',

  text: '#0E1B13',
  textMuted: '#4C5F54',
  textFaint: '#7C8B82',

  danger: '#C4362B',
  dangerDark: '#9E2A22',
  warning: '#B26A00',
  success: '#1F8A4C',
  info: '#2A6FD6',

  border: '#D3DFD8',
  borderStrong: '#B4C7BB',
  overlay: 'rgba(0,0,0,0.35)',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

/** Dark default export kept for any non-themed reference. */
export const colors = darkColors;

type Grad = readonly [string, string, ...string[]];
export interface ThemeGradients {
  night: Grad;
  pitch: Grad;
  brand: Grad;
  gold: Grad;
  danger: Grad;
  surface: Grad;
}

export const gradientsDark: ThemeGradients = {
  night: ['rgba(11,14,28,0.96)', 'rgba(6,7,16,0.84)'],
  pitch: ['rgba(14,18,32,0.96)', 'rgba(7,8,12,0.84)'],
  brand: ['rgba(30,144,72,0.98)', 'rgba(44,201,106,0.86)'],
  gold: ['rgba(245,207,101,0.98)', 'rgba(196,144,42,0.88)'],
  danger: ['#E5484D', '#B93A3E'],
  surface: ['rgba(23,28,42,0.75)', 'rgba(16,19,30,0.94)'],
};

export const gradientsLight: ThemeGradients = {
  night: ['#EEF4F0', '#F3F7F4'],
  pitch: ['#E7F1EA', '#F3F7F4'],
  brand: ['#2FA55B', '#1F8A46'],
  gold: ['#D69A28', '#B67B0B'],
  danger: ['#E5646A', '#C4362B'],
  surface: ['#FFFFFF', '#EDF3EF'],
};

export const gradients = gradientsDark;

export interface Theme {
  colors: ThemeColors;
  gradients: ThemeGradients;
  isDark: boolean;
}

/** Reactive theme: reflects the themeMode setting (and OS scheme when 'system'). */
export function useTheme(): Theme {
  const mode = useSettings((s) => s.themeMode);
  const scheme = useColorScheme();
  const isDark = mode === 'system' ? scheme !== 'light' : mode === 'dark';
  return {
    colors: isDark ? darkColors : lightColors,
    gradients: isDark ? gradientsDark : gradientsLight,
    isDark,
  };
}

/** Convenience: just the active palette. */
export function useColors(): ThemeColors {
  return useTheme().colors;
}

/**
 * Build themed styles from a stable factory. Usage:
 *   const styles = useThemedStyles(makeStyles);
 *   const makeStyles = (colors: ThemeColors) => StyleSheet.create({ ... });
 * Recomputes only when the palette changes (i.e. on a theme switch).
 */
export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
  display: 46,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
  black: '900',
} as const;

export { fonts, useAppFonts } from './fonts';

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  soft: {
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
} as const;
