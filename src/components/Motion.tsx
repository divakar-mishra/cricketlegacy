import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { radius as radii, useTheme } from '../theme';

/**
 * Entrance animation for cards/sections/list items. Runs on the UI thread via
 * Reanimated so the meta-game feels alive (staggered fade + slide-up).
 */
export function FadeInView({
  children,
  delay = 0,
  duration = 320,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(duration).delay(delay)} style={style}>
      {children}
    </Animated.View>
  );
}

/** A shimmering placeholder for async/loading content. */
export function Skeleton({
  width,
  height = 16,
  radius = radii.sm,
  style,
}: {
  width: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const pulse = useSharedValue(0.35);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.85, { duration: 800 }), -1, true);
  }, [pulse]);
  const anim = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.surfaceAlt }, anim, style]}
    />
  );
}
