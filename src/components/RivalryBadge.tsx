/**
 * RivalryBadge — a persistent head-to-head badge for Player Career.
 *
 * Shows your season-long rival, the live head-to-head on the metric that
 * matters for your role (runs or wickets), and who is currently ahead. Keeps
 * the rivalry emotionally present on the hub instead of buried in a sub-screen.
 */
import { StyleSheet, View } from 'react-native';
import type { RivalComparison } from '../game/rivalry';
import {
  fontSize,
  fontWeight,
  radius,
  spacing,
  ThemeColors,
  useTheme,
  useThemedStyles,
} from '../theme';
import { AppText as Text } from './AppText';

interface RivalryBadgeProps {
  comparison: RivalComparison;
  userName: string;
}

export function RivalryBadge({ comparison, userName }: RivalryBadgeProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { rival, metric, userValue, rivalValue, leading } = comparison;

  const total = userValue + rivalValue;
  const userShare = total > 0 ? userValue / total : 0.5;
  const accent = leading ? colors.success : colors.danger;
  const statusText = leading ? 'You lead' : userValue === rivalValue ? 'Level' : 'Behind';

  return (
    <View style={[styles.card, { borderColor: accent + '66' }]}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>SEASON RIVAL</Text>
        <Text style={[styles.status, { color: accent }]}>{statusText}</Text>
      </View>

      <View style={styles.namesRow}>
        <Text style={styles.userName} numberOfLines={1}>
          {userName}
        </Text>
        <Text style={styles.vs}>vs</Text>
        <Text style={styles.rivalName} numberOfLines={1}>
          {rival.name}
        </Text>
      </View>

      {/* Head-to-head bar */}
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${userShare * 100}%`, backgroundColor: accent }]} />
      </View>

      <View style={styles.valuesRow}>
        <Text style={[styles.value, { color: accent }]}>{userValue}</Text>
        <Text style={styles.metricLabel}>
          {metric === 'runs' ? 'RUNS THIS SEASON' : 'WICKETS THIS SEASON'}
        </Text>
        <Text style={styles.value}>{rivalValue}</Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      marginTop: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
      backgroundColor: colors.surfaceAlt,
      padding: spacing.md,
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    eyebrow: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: fontWeight.black,
      letterSpacing: 1.2,
    },
    status: { fontSize: fontSize.xs, fontWeight: fontWeight.black },
    namesRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
    userName: { flex: 1, color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.heavy },
    vs: { color: colors.textFaint, fontSize: fontSize.xs },
    rivalName: {
      flex: 1,
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      textAlign: 'right',
    },
    barTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
      marginTop: spacing.sm,
      flexDirection: 'row',
    },
    barFill: { height: 8 },
    valuesRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 6,
    },
    value: { fontSize: fontSize.md, fontWeight: fontWeight.black, color: colors.textMuted },
    metricLabel: {
      color: colors.textFaint,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.8,
    },
  });
