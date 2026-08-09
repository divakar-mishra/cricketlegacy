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
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { moment } from '../audio';
import { fonts, fontSize, fontWeight, radius, shadow, spacing, useTheme } from '../theme';

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
  const { colors, gradients } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withTiming(0.96, { duration: 80 });
    opacity.value = withTiming(0.88, { duration: 80 });
  }, [scale, opacity]);

  const handlePressOut = useCallback(() => {
    scale.value = withTiming(1, { duration: 120 });
    opacity.value = withTiming(1, { duration: 120 });
  }, [scale, opacity]);

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
  const textColor = variant === 'gold' ? colors.bg : colors.white;

  const inner = (
    <>
      {loading ? (
        <ActivityIndicator color={isGhost ? colors.primaryLight : textColor} />
      ) : (
        <View style={styles.labelWrap}>
          <Text
            style={[
              styles.label,
              { color: isGhost ? colors.primaryLight : textColor },
              size === 'sm' && { fontSize: fontSize.sm },
              size === 'lg' && { fontSize: fontSize.lg },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {label}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.subtitle, { color: isGhost ? colors.textMuted : textColor }]}
              numberOfLines={1}
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
        { width: fullWidth ? '100%' : undefined, borderRadius: radius.md, overflow: 'hidden' },
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
    width: '100%',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    // overflow hidden is critical on Android: without it the button background
    // renders outside the borderRadius, creating the "misaligned background" bug.
    overflow: 'hidden',
  },
  pressable: { alignSelf: 'stretch', width: '100%' },
  labelWrap: { alignItems: 'center', minWidth: 0 },
  label: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    opacity: 0.85,
    marginTop: 1,
  },
  disabled: { opacity: 0.45 },
});
