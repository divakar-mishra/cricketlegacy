/**
 * Central design system for the game.
 * Cricket-inspired palette: deep pitch greens, charcoal night, gold trophy accents.
 *
 * Classic and Warm share identical keys. Components read the active
 * one reactively via `useTheme()` and build styles with `makeStyles(colors)`.
 * `colors`/`gradients` remain exported as the dark defaults for back-compat.
 */
import { useMemo } from 'react';
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
  bg: '#121110',
  bgElevated: '#1C1A17',
  surface: '#24211D',
  surfaceAlt: '#2D2923',
  surfaceMuted: '#181613',

  // Muted sage/grass accents; avoid luminous emerald on the night surfaces.
  primary: '#78A58B',
  primaryDark: '#416D56',
  primaryLight: '#A2C3AE',

  // Accent (gold / trophy)
  accent: '#C4AA78',
  accentDark: '#8C744C',
  accentLight: '#DDC9A2',

  // Text
  text: '#F1EBDF',
  textMuted: '#B7AD9D',
  textFaint: '#958B7E',

  // Status
  danger: '#E5484D',
  dangerDark: '#B93A3E',
  warning: '#F5A524',
  success: '#86B596',
  info: '#4C9AFF',

  // Lines & overlays — subtle on black
  border: '#39342C',
  borderStrong: '#574C3D',
  overlay: 'rgba(0,0,0,0.70)',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

/** Light palette — same keys, tuned for legibility on light surfaces. */
export const lightColors: ThemeColors = {
  bg: '#F4EFE5',
  bgElevated: '#FFFBF3',
  surface: '#FFFBF3',
  surfaceAlt: '#EAE2D5',
  surfaceMuted: '#F0E9DD',

  primary: '#416D56',
  primaryDark: '#305640',
  primaryLight: '#527C63',

  accent: '#B67B0B',
  accentDark: '#8A5D08',
  accentLight: '#D69A28',

  text: '#28231C',
  textMuted: '#62594D',
  textFaint: '#706556',

  danger: '#C4362B',
  dangerDark: '#9E2A22',
  warning: '#B26A00',
  success: '#416D56',
  info: '#2A6FD6',

  border: '#DFD5C5',
  borderStrong: '#C4B69F',
  overlay: 'rgba(0,0,0,0.35)',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

/** Dark default export kept for any non-themed reference. */

export const classicColors: ThemeColors = {
  ...darkColors,
  bg: '#07080C', bgElevated: '#0C0E15', surface: '#10131E', surfaceAlt: '#171C2A', surfaceMuted: '#090B12',
  primary: '#00C97A', primaryDark: '#00A364', primaryLight: '#33D993',
  accent: '#E8B332', accentDark: '#C4902A', accentLight: '#F5CF65',
  text: '#ECEFF4', textMuted: '#9AA6B5', textFaint: '#7A8899', success: '#30D070',
  border: '#1A2035', borderStrong: '#242E45',
};
export const colors = classicColors;

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
  night: ['#1C1A17', '#121110'],
  pitch: ['#24211D', '#181613'],
  brand: ['#756044', '#645138'],
  gold: ['#DDC9A2', '#C4AA78'],
  danger: ['#E5484D', '#B93A3E'],
  surface: ['#2D2923', '#24211D'],
};

export const gradientsLight: ThemeGradients = {
  night: ['#FFFBF3', '#F4EFE5'],
  pitch: ['#EAE2D5', '#F4EFE5'],
  brand: ['#756044', '#645138'],
  gold: ['#D69A28', '#B67B0B'],
  danger: ['#B92C3A', '#952434'],
  surface: ['#FFFBF3', '#F0E9DD'],
};

export const classicGradients: ThemeGradients = {
  ...gradientsDark,
  night: ['#0B0E1C', '#060710'], pitch: ['#0E1220', '#07080C'],
  brand: ['#416D56', '#345A46'], gold: ['#F5CF65', '#C4902A'],
  surface: ['#171C2A', '#10131E'],
};
export const gradients = classicGradients;

export interface Theme {
  colors: ThemeColors;
  gradients: ThemeGradients;
  isDark: boolean;
}

/** Both appearances are dark; system/light mode is no longer selectable. */
export function useTheme(): Theme {
  const appearance = useSettings((s) => s.appearance);
  return {
    colors: appearance === 'warm' ? darkColors : classicColors,
    gradients: appearance === 'warm' ? gradientsDark : classicGradients,
    isDark: true,
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
