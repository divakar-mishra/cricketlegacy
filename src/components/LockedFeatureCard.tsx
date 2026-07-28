/**
 * LockedFeatureCard — a standardized locked-state surface.
 *
 * Every gated feature (National Cup, franchise auctions, manager multi-format,
 * etc.) should explain WHY it is locked and, where possible, show progress
 * toward unlocking. This gives a consistent padlock + reason + progress bar
 * instead of ad-hoc disabled buttons.
 */
import { StyleSheet, View } from 'react-native';
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
import { Icon, IconName } from './Icon';
import { ProgressBar } from './ProgressBar';

interface LockedFeatureCardProps {
  title: string;
  reason: string;
  /** Optional 0..1 progress toward unlocking (hidden when undefined). */
  progress?: number;
  /** Optional progress caption, e.g. "7 / 10 matches". */
  progressLabel?: string;
  icon?: IconName;
}

export function LockedFeatureCard({
  title,
  reason,
  progress,
  progressLabel,
  icon = 'lock-closed',
}: LockedFeatureCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const pct = progress != null ? Math.max(0, Math.min(1, progress)) : undefined;

  return (
    <View style={styles.card} accessibilityLabel={`${title} locked: ${reason}`}>
      <View style={styles.iconWrap}>
        <Icon name={icon} size={18} color={colors.textFaint} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.reason} numberOfLines={2}>
          {reason}
        </Text>
        {pct != null ? (
          <View style={styles.progressWrap}>
            <ProgressBar value={pct} color={colors.accent} />
            {progressLabel ? (
              <Text style={styles.progressLabel} numberOfLines={1}>
                {progressLabel}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'flex-start',
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      opacity: 0.92,
    },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    body: { flex: 1 },
    title: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.heavy,
    },
    reason: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 2, lineHeight: 16 },
    progressWrap: { marginTop: spacing.sm, gap: 4 },
    progressLabel: { color: colors.textFaint, fontSize: 10, fontWeight: fontWeight.semibold },
  });
