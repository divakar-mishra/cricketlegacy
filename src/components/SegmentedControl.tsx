import { useCallback } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { haptics } from '../audio';
import { fontSize, fontWeight, radius, spacing, ThemeColors, useThemedStyles } from '../theme';
import { AppText as Text } from './AppText';

export type SegmentOption<T extends string> = { value: T; label: string; disabled?: boolean };

type Props<T extends string> = {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  accessibilityLabel: string;
  role?: 'radiogroup' | 'tablist';
  style?: StyleProp<ViewStyle>;
};

/** Shared equal-width choice control for mutually exclusive options. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
  role = 'radiogroup',
  style,
}: Props<T>) {
  const styles = useThemedStyles(makeStyles);
  const select = useCallback(
    (option: SegmentOption<T>) => {
      if (option.disabled || option.value === value) return;
      haptics.selection();
      onChange(option.value);
    },
    [onChange, value],
  );
  return (
    <View accessibilityRole={role} accessibilityLabel={accessibilityLabel} style={[styles.row, style]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole={role === 'tablist' ? 'tab' : 'radio'}
            accessibilityLabel={option.label}
            accessibilityState={{
              ...(role === 'tablist' ? { selected } : { checked: selected }),
              disabled: Boolean(option.disabled),
            }}
            disabled={option.disabled}
            onPress={() => select(option)}
            style={({ pressed }) => [
              styles.segment,
              options.length >= 4 && styles.compactSegment,
              selected && styles.selected,
              option.disabled && styles.disabled,
              pressed && !option.disabled && styles.pressed,
            ]}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={[styles.label, selected && styles.labelSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: spacing.xs, alignSelf: 'stretch' },
    segment: {
      alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border,
      borderRadius: radius.pill, borderWidth: 1.5, flex: 1, flexBasis: 0, minWidth: 0,
      minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.xs,
    },
    selected: { backgroundColor: colors.primaryDark, borderColor: colors.primary },
    pressed: { opacity: 0.86 },
    disabled: { opacity: 0.45 },
    compactSegment: { paddingHorizontal: 0 },
    label: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
    labelSelected: { color: colors.white },
  });
