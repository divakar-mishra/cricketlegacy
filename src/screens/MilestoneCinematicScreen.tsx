/**
 * Milestone Cinematic — a 3-4 second full-screen "moment" screen for:
 * - First century
 * - First 5-wicket haul
 * - National team call-up
 * - Title win
 *
 * Auto-dismisses after 4 seconds or on tap.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { playHaptic } from '../audio';
import { AppText as Text } from '../components/AppText';
import { ScreenProps } from '../navigation';
import { fonts, fontSize, fontWeight, spacing, ThemeColors, useThemedStyles } from '../theme';

interface Config {
  emoji: string;
  headline: string;
  subtitle: string;
  gradientColors: [string, string];
  particleColor: string;
}

function getConfig(kind: string, playerName: string, detail?: string): Config {
  switch (kind) {
    case 'CENTURY':
      return {
        emoji: '💯',
        headline: 'CENTURY!',
        subtitle: `${playerName} · ${detail ?? '100 runs'}`,
        gradientColors: ['#E9B23B', '#7A4A08'],
        particleColor: '#F7D06E',
      };
    case 'FIVE_WICKETS':
      return {
        emoji: '🎯',
        headline: 'FIVE-FOR!',
        subtitle: `${playerName} · ${detail ?? '5 wickets'}`,
        gradientColors: ['#E5484D', '#7A1216'],
        particleColor: '#FF9090',
      };
    case 'NATIONAL_CAP':
      return {
        emoji: '🧢',
        headline: 'NATIONAL DEBUT!',
        subtitle: `${playerName} · ${detail ?? 'First international cap'}`,
        gradientColors: ['#1F8A46', '#0A1912'],
        particleColor: '#5BD183',
      };
    case 'TITLE':
      return {
        emoji: '🏆',
        headline: 'CHAMPIONS!',
        subtitle: `${playerName} · ${detail ?? 'Title won'}`,
        gradientColors: ['#C6902A', '#4A2800'],
        particleColor: '#F7D06E',
      };
    default:
      return {
        emoji: '⭐',
        headline: 'MILESTONE!',
        subtitle: playerName,
        gradientColors: ['#1F8A46', '#0A1912'],
        particleColor: '#5BD183',
      };
  }
}

// Simple floating particle
function Particle({ delay, color }: { delay: number; color: string }) {
  const x = useSharedValue((Math.random() - 0.5) * 200);
  const y = useSharedValue(0);
  const opacity = useSharedValue(0);
  const size = 6 + Math.random() * 8;

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: delay }),
        withTiming(1, { duration: 300 }),
        withTiming(0, { duration: 1200 }),
      ),
      -1,
      false,
    );
    y.value = withRepeat(
      withSequence(
        withTiming(0, { duration: delay }),
        withTiming(-180 - Math.random() * 100, { duration: 1500 }),
      ),
      -1,
      false,
    );
  }, [delay, opacity, y]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          bottom: 80,
          alignSelf: 'center',
        },
      ]}
    />
  );
}

export function MilestoneCinematicScreen({ navigation, route }: ScreenProps<'MilestoneCinematic'>) {
  const { kind, playerName, detail } = route.params;
  const styles = useThemedStyles(makeStyles);
  const config = getConfig(kind, playerName, detail);

  // Scale in the big emoji
  const heroScale = useSharedValue(0.1);
  const glow = useSharedValue(0.3);

  useEffect(() => {
    playHaptic('notify-success');
    setTimeout(() => playHaptic('impact-heavy'), 300);

    heroScale.value = withSpring(1.0, { damping: 10, stiffness: 180 });
    glow.value = withRepeat(
      withSequence(withTiming(1, { duration: 600 }), withTiming(0.3, { duration: 600 })),
      -1,
      true,
    );

    // Auto-dismiss after 4 seconds
    const timer = setTimeout(() => navigation.goBack(), 4000);
    return () => clearTimeout(timer);
  }, [navigation, heroScale, glow]);

  const heroStyle = useAnimatedStyle(() => ({ transform: [{ scale: heroScale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <Pressable style={{ flex: 1 }} onPress={() => navigation.goBack()}>
      <LinearGradient
        colors={config.gradientColors}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.container}
      >
        {/* Particles */}
        {Array.from({ length: 12 }, (_, i) => (
          <Particle key={i} delay={i * 120} color={config.particleColor} />
        ))}

        {/* Glow behind hero */}
        <Animated.View
          style={[styles.heroGlow, glowStyle, { backgroundColor: config.particleColor }]}
        />

        {/* Hero emoji */}
        <Animated.View style={[styles.heroWrap, heroStyle]}>
          <Text style={styles.heroEmoji}>{config.emoji}</Text>
        </Animated.View>

        {/* Text */}
        <Animated.View entering={FadeInDown.duration(500).delay(400)} style={styles.textBlock}>
          <Text style={styles.headline}>{config.headline}</Text>
          <Text style={styles.subtitle}>{config.subtitle}</Text>
        </Animated.View>

        {/* Tap hint */}
        <Animated.View entering={FadeIn.duration(400).delay(1500)} style={styles.tapHint}>
          <Text style={styles.tapText}>Tap to continue</Text>
        </Animated.View>
      </LinearGradient>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xxl,
    },
    heroGlow: {
      position: 'absolute',
      width: 200,
      height: 200,
      borderRadius: 100,
      opacity: 0.25,
    },
    heroWrap: {
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: 'rgba(255,255,255,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xxl,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    heroEmoji: { fontSize: 72 },
    textBlock: { alignItems: 'center' },
    headline: {
      color: colors.white,
      fontSize: 42,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      letterSpacing: 3,
      textAlign: 'center',
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 8,
    },
    subtitle: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      textAlign: 'center',
      marginTop: spacing.md,
      lineHeight: 24,
    },
    tapHint: {
      position: 'absolute',
      bottom: spacing.xxl,
    },
    tapText: {
      color: 'rgba(255,255,255,0.4)',
      fontSize: fontSize.xs,
      letterSpacing: 1,
    },
  });
