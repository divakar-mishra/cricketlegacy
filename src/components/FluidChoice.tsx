/**
 * FluidChoice — a glass dialogue-choice button with spring physics.
 *
 * On press-in the button scales down with a spring; on release it springs back
 * and a brief "commit" morph (scale dip + accent glow) plays before the parent
 * advances to the next state. All motion uses Reanimated shared values on the
 * UI thread (withSpring / withTiming), so it stays fluid at 60/120 FPS.
 */
import { useCallback } from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { haptics } from '../audio';
import { fontSize, fontWeight, radius, spacing, ThemeColors, useThemedStyles } from '../theme';
import { AppText } from './AppText';
import { GlassSurface } from './GlassSurface';

interface FluidChoiceProps {
  label: string;
  desc?: string;
  onPress: () => void;
  index?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SPRING = { damping: 15, stiffness: 220, mass: 0.6 };

export function FluidChoice({
  label,
  desc,
  onPress,
  index = 0,
  disabled,
  style,
}: FluidChoiceProps) {
  const styles = useThemedStyles(makeStyles);
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 1 - glow.value * 0.08,
  }));

  const onPressIn = useCallback(() => {
    scale.value = withSpring(0.96, SPRING);
    glow.value = withTiming(1, { duration: 120 });
  }, [scale, glow]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING);
    glow.value = withTiming(0, { duration: 220 });
  }, [scale, glow]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    haptics.selection();
    // Commit morph: a quick dip then settle, so the tap feels physical before
    // the parent swaps in the next dialogue state.
    scale.value = withSequence(withTiming(0.9, { duration: 90 }), withSpring(1, SPRING));
    onPress();
  }, [disabled, onPress, scale]);

  return (
    <Animated.View entering={FadeInDown.duration(420).delay(index * 70)} style={[animStyle, style]}>
      <Pressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <GlassSurface intensity={0.5} rounded={radius.md} highlighted padded={false}>
          <Animated.View style={styles.inner}>
            <AppText style={styles.label}>{label}</AppText>
            {desc ? <AppText style={styles.desc}>{desc}</AppText> : null}
          </Animated.View>
        </GlassSurface>
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    inner: { paddingVertical: spacing.md, paddingHorizontal: spacing.md },
    label: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    desc: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
  });
