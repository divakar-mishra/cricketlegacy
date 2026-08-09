import { Pressable, StyleSheet, View } from 'react-native';
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
import { ProgressBar } from './ProgressBar';

type Props = {
  label: string;
  description?: string;
  value: number;
  displayValue?: number | string;
  progressValue?: number;
  max: number;
  onDec: () => void;
  onInc: () => void;
  canDec: boolean;
  canInc: boolean;
  barColor?: string;
};

export function Stepper({
  label,
  description,
  value,
  displayValue,
  progressValue,
  max,
  onDec,
  onInc,
  canDec,
  canInc,
  barColor,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.label}>{label}</Text>
        {description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
        <ProgressBar
          value={(progressValue ?? value) / max}
          color={barColor ?? colors.primary}
          style={{ marginTop: spacing.sm }}
        />
      </View>
      <View style={styles.controls}>
        <StepButton symbol="-" label={`Decrease ${label}`} onPress={onDec} enabled={canDec} />
        <Text style={styles.value}>{displayValue ?? value}</Text>
        <StepButton
          symbol="+"
          label={`Increase ${label}`}
          onPress={onInc}
          enabled={canInc}
          highlight
        />
      </View>
    </View>
  );
}

function StepButton({
  symbol,
  label,
  onPress,
  enabled,
  highlight,
}: {
  symbol: string;
  label: string;
  onPress: () => void;
  enabled: boolean;
  highlight?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => [
        styles.btn,
        highlight &&
          enabled && { backgroundColor: colors.primaryDark, borderColor: colors.primary },
        !enabled && { opacity: 0.3 },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={styles.btnText}>{symbol}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    info: { flex: 1 },
    label: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
    desc: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 1, lineHeight: 15 },
    controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    btn: {
      width: 34,
      height: 34,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: {
      color: colors.white,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      lineHeight: 22,
    },
    value: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
      width: 34,
      textAlign: 'center',
    },
  });
