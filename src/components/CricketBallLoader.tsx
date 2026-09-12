import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { useColors } from '../theme';

/** Visual feedback only: its animation never controls the save's completion. */
export function CricketBallLoader() {
  const colors = useColors();
  const rotation = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const spin = Animated.loop(Animated.timing(rotation, {
      toValue: 1,
      duration: 900,
      easing: Easing.linear,
      useNativeDriver: true,
      isInteraction: false,
    }));
    spin.start();
    return () => {
      spin.stop();
      rotation.setValue(0);
    };
  }, [reducedMotion, rotation]);

  return (
    <View style={styles.container} accessible accessibilityRole="progressbar"
      accessibilityLabel="Saving match result" accessibilityState={{ busy: true }}>
      <Animated.View accessible={false} style={{ transform: [{ rotate: rotation.interpolate({
        inputRange: [0, 1], outputRange: ['0deg', '360deg'],
      }) }] }}>
        <Svg width={64} height={64} viewBox="0 0 64 64" accessible={false}>
          <Defs>
            <RadialGradient id="loading-ball" cx="30%" cy="25%" r="80%">
              <Stop offset="0" stopColor={colors.danger} />
              <Stop offset="1" stopColor={colors.dangerDark} />
            </RadialGradient>
          </Defs>
          <Circle cx="32" cy="32" r="29" fill="url(#loading-ball)" />
          <Path d="M 17 7 C 39 20 25 44 47 57" fill="none" stroke={colors.white}
            strokeWidth={1.6} strokeOpacity={0.9} />
          <Path d="M 13 10 C 35 23 21 47 43 59 M 21 5 C 43 18 29 42 51 54"
            fill="none" stroke={colors.white} strokeWidth={1.4} strokeDasharray="2 3"
            strokeOpacity={0.8} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
