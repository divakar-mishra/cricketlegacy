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
