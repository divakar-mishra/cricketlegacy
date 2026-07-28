/**
 * Small responsive helpers for card density on varying phone widths.
 *
 * The app targets a wide range of Android devices plus modern iPhones. Below
 * ~380dp (compact phones) dense multi-column grids cramp and clip text, so
 * these hooks let screens drop to fewer columns / compact layouts.
 */
import { useWindowDimensions } from 'react-native';

export const COMPACT_BREAKPOINT = 380;

/** True on compact-width devices (below the breakpoint). */
export function useIsCompact(breakpoint: number = COMPACT_BREAKPOINT): boolean {
  const { width } = useWindowDimensions();
  return width < breakpoint;
}

/** Number of columns for a responsive card grid: 2 on normal phones, 1 on compact. */
export function useResponsiveColumns(breakpoint: number = COMPACT_BREAKPOINT): 1 | 2 {
  return useIsCompact(breakpoint) ? 1 : 2;
}
