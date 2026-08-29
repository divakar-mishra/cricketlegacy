import { StyleSheet, View, ViewStyle } from 'react-native';
import { fontSize, fontWeight, radius, spacing, ThemeColors, useThemedStyles } from '../theme';
import { AppText as Text } from './AppText';
import { SponsorLogo } from './SponsorBranding';

function initials(value: string): string {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) || 'KP')
    .toUpperCase();
}

/** Dynamic kit mark. It never modifies or regenerates a portrait asset. */
export function SponsorMark({
  name,
  brandId,
  compact = false,
  style,
}: {
  name?: string;
  brandId?: string;
  compact?: boolean;
  style?: ViewStyle;
}) {
  const styles = useThemedStyles(makeStyles);
  const displayName = name?.trim() || 'Kit Partner';
  return (
    <View style={[styles.mark, compact && styles.markCompact, style]}>
      {brandId ? (
        <SponsorLogo
          brand={{ brandId, brandName: displayName }}
          variant="badge"
          size={compact ? 24 : 30}
          label={`${displayName} kit partner logo`}
        />
      ) : (
        <View style={[styles.monogram, compact && styles.monogramCompact]}>
          <Text style={styles.monogramText}>{initials(displayName)}</Text>
        </View>
      )}
      <View style={styles.copy}>
        <Text style={styles.kicker}>KIT PARTNER</Text>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    mark: {
      minWidth: 132,
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.accent + '88',
      backgroundColor: colors.surfaceAlt,
    },
    markCompact: { minWidth: 0, minHeight: 34, paddingVertical: 4 },
    monogram: {
      width: 30,
      height: 30,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    monogramCompact: { width: 24, height: 24 },
    monogramText: { color: colors.black, fontSize: fontSize.xs, fontWeight: fontWeight.black },
    copy: { flex: 1, minWidth: 0 },
    kicker: { color: colors.textFaint, fontSize: 8, fontWeight: fontWeight.black, letterSpacing: 0.8 },
    name: { color: colors.text, fontSize: fontSize.xs, fontWeight: fontWeight.heavy, marginTop: 1 },
  });
