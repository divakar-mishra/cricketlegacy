import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { moment } from '../audio';
import { fonts, fontSize, fontWeight, radius, shadow, spacing, useTheme } from '../theme';
import { buttonForeground } from './buttonPalette';

export type ButtonVariant = 'primary' | 'gold' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  subtitle?: string;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

const HEIGHTS: Record<ButtonSize, number> = { sm: 40, md: 52, lg: 60 };
export const Button = React.memo(function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  subtitle,
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
}: Props) {
  const { colors, gradients, isDark } = useTheme();
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = useCallback(() => {
    if (reducedMotion) {
      scale.value = 1;
      opacity.value = 0.88;
      return;
    }
    scale.value = withTiming(0.96, { duration: 80 });
    opacity.value = withTiming(0.88, { duration: 80 });
  }, [scale, opacity, reducedMotion]);

  const handlePressOut = useCallback(() => {
    if (reducedMotion) {
      scale.value = 1;
      opacity.value = 1;
      return;
    }
    scale.value = withTiming(1, { duration: 120 });
    opacity.value = withTiming(1, { duration: 120 });
  }, [scale, opacity, reducedMotion]);

  const handlePress = useCallback(() => {
    if (!onPress) return;
    moment('tap');
    onPress();
  }, [onPress]);

  const gradientVariants: Record<string, readonly [string, string, ...string[]]> = {
    primary: gradients.brand,
    gold: gradients.gold,
    danger: gradients.danger,
  };
  const gradient = gradientVariants[variant];
  const isSolid = variant === 'secondary';
  const isGhost = variant === 'ghost';
  const textColor = buttonForeground(variant, colors, isDark);

  const inner = (
    <>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.labelWrap}>
          <Text
            style={[
              styles.label,
              { color: textColor },
              size === 'sm' && { fontSize: fontSize.sm },
              size === 'lg' && { fontSize: fontSize.lg },
            ]}
          >
            {label}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.subtitle, { color: isGhost || isSolid ? colors.textMuted : textColor }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      )}
    </>
  );

  return (
    <Animated.View
      style={[
        {
          width: fullWidth ? '100%' : undefined,
          maxWidth: '100%',
          minWidth: 0,
          flexShrink: fullWidth ? 0 : 1,
          borderRadius: radius.md,
          overflow: 'hidden',
        },
        disabled ? styles.disabled : null,
        animStyle,
        style,
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={styles.pressable}
        // Android ripple is bounded to the button shape
        android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: false }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || loading }}
      >
        {gradient ? (
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.base, { minHeight: HEIGHTS[size] }, shadow.soft]}
          >
            {inner}
          </LinearGradient>
        ) : (
          <View
            style={[
              styles.base,
              { minHeight: HEIGHTS[size] },
              isSolid && {
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1,
                borderColor: colors.borderStrong,
              },
              isGhost && {
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                borderColor: colors.border,
              },
            ]}
          >
            {inner}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    // overflow hidden is critical on Android: without it the button background
    // renders outside the borderRadius, creating the "misaligned background" bug.
    overflow: 'hidden',
  },
  // Nested percentage widths make an intrinsic button claim its parent's
  // width in Yoga, squeezing adjacent card copy on every screen using it.
  pressable: { alignSelf: 'stretch' },
  labelWrap: { alignItems: 'center', minWidth: 0, flexShrink: 1 },
  label: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    opacity: 0.85,
    marginTop: 1,
    textAlign: 'center',
  },
  disabled: { opacity: 0.45 },
});
