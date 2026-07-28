import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { AppText as Text } from './AppText';
import { haptics } from '../audio';
import { fontSize, fontWeight, radius, spacing, ThemeColors, useTheme, useThemedStyles } from '../theme';

type Props = {
  title: string;
  subtitle?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function SelectableCard({ title, subtitle, selected, disabled, onPress, right, style }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              haptics.selection();
              onPress();
            }
          : undefined
      }
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected), disabled: Boolean(disabled) }}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={({ pressed }) => [
        styles.card,
        selected && styles.selected,
        disabled && { opacity: 0.4 },
        pressed && !disabled && { opacity: 0.9 },
        style,
      ]}
    >
      <View style={styles.textWrap}>
        <Text style={[styles.title, selected && { color: colors.white }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (selected ? <View style={styles.dot} /> : <View style={styles.dotEmpty} />)}
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  textWrap: { flex: 1 },
  title: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  subtitle: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2, lineHeight: 18 },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: colors.primaryLight,
  },
  dotEmpty: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
  },
});
