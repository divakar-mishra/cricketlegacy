import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { fonts, fontSize, fontWeight, spacing, ThemeColors, useThemedStyles } from '../theme';
import { AppText as Text } from './AppText';
import { Icon } from './Icon';

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
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <Icon name="chevron-back" size={24} />
        </Pressable>
      ) : null}
      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
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
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    backPressed: { opacity: 0.65 },
    titleWrap: { flex: 1, minWidth: 0 },
    title: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.heavy,
      fontFamily: fonts.display,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: 2,
      fontFamily: fonts.medium,
    },
  });
