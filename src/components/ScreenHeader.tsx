import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { fonts, fontSize, fontWeight, radius, spacing, ThemeColors, useThemedStyles } from '../theme';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
};

export function ScreenHeader({ title, subtitle, onBack, right }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
      ) : null}
      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { color: colors.text, fontSize: 28, lineHeight: 30, marginTop: -4 },
  titleWrap: { flex: 1 },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.heavy, fontFamily: fonts.display },
  subtitle: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2, fontFamily: fonts.medium },
});
