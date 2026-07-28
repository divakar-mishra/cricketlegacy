import { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { radius, useTheme } from '../theme';

type Props = {
  /** 0..1 */
  value: number;
  color?: string;
  track?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  /** Set false to render statically (no fill animation). */
  animated?: boolean;
};

export function ProgressBar({ value, color, track, height = 8, style, animated = true }: Props) {
  const { colors } = useTheme();
  const fill = color ?? colors.primary;
  const trackColor = track ?? colors.surfaceMuted;
  const pct = Math.max(0, Math.min(1, value)) * 100;

  const w = useSharedValue(pct);
  useEffect(() => {
    w.value = animated ? withTiming(pct, { duration: 480 }) : pct;
  }, [pct, animated, w]);
  const animStyle = useAnimatedStyle(() => ({ width: `${w.value}%` }));

  return (
    <View
      style={[
        styles.track,
        { height, backgroundColor: trackColor, borderRadius: height / 2 },
        style,
      ]}
    >
      <Animated.View
        style={[{ height: '100%', backgroundColor: fill, borderRadius: height / 2 }, animStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden', borderRadius: radius.pill },
});
