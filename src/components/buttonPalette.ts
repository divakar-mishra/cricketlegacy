import type { ThemeColors } from '../theme';

export type ButtonTone = 'primary' | 'gold' | 'secondary' | 'ghost' | 'danger';

/** Foreground colours must follow the surface, not the current app mode alone. */
export function buttonForeground(
  variant: ButtonTone,
  colors: ThemeColors,
  isDark: boolean,
): string {
  if (variant === 'gold') return colors.black;
  if (variant === 'secondary') return colors.text;
  if (variant === 'ghost') return isDark ? colors.primaryLight : colors.primaryDark;
  return colors.white;
}
