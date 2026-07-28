import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

export type IconName = keyof typeof Ionicons.glyphMap;

/** Themed vector icon (Ionicons) — the app's real icon set, replacing emoji. */
export function Icon({
  name,
  size = 18,
  color,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? colors.text} />;
}
