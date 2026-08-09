import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Emblem, Screen, AppText as Text } from '../components';
import { APP_NAME, APP_TAGLINE } from '../config/app';
import { ScreenProps } from '../navigation';
import { sessionGate } from '../services';
import {
  fonts,
  fontSize,
  fontWeight,
  spacing,
  ThemeColors,
  useTheme,
  useThemedStyles,
} from '../theme';

export function SplashScreen({ navigation }: ScreenProps<'Splash'>) {
  const { gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [opacity] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(0.85));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    let alive = true;
    void (async () => {
      const status = await sessionGate.dailySessionStatus();
      if (!alive) return;
      if (status.allowed) {
        navigation.replace('MainMenu');
      } else {
        navigation.replace('Login', { gate: 'daily' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [navigation, opacity, scale]);

  return (
    <Screen gradient={gradients.pitch} padded={false}>
      <View style={styles.center}>
        <Animated.View style={{ opacity, transform: [{ scale }], alignItems: 'center' }}>
          <Emblem size={148} />
          <Text style={styles.title}>{APP_NAME}</Text>
          <Text style={styles.tagline}>{APP_TAGLINE}</Text>
        </Animated.View>
      </View>
      <Text style={styles.footer}>Loading…</Text>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    title: {
      color: colors.accent,
      fontSize: fontSize.xxxl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      letterSpacing: 3,
      marginTop: spacing.xl,
    },
    tagline: {
      color: colors.textMuted,
      fontSize: fontSize.md,
      marginTop: spacing.sm,
      letterSpacing: 1,
    },
    footer: {
      position: 'absolute',
      bottom: 56,
      left: 0,
      right: 0,
      textAlign: 'center',
      color: colors.textFaint,
      fontSize: fontSize.sm,
    },
  });
