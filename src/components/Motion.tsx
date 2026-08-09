import { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { radius as radii, useTheme } from '../theme';

export const SMOOTH_MODAL_ENTER = FadeIn.duration(180).easing(Easing.out(Easing.quad));
export const SMOOTH_MODAL_EXIT = FadeOut.duration(140).easing(Easing.in(Easing.quad));
export const SMOOTH_CARD_ZOOM = ZoomIn.duration(200).easing(Easing.out(Easing.cubic));

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
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.surfaceAlt },
        anim,
        style,
      ]}
    />
  );
}
