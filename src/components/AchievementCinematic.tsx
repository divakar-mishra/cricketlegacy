/**
 * Full-screen cinematic achievement unlock for Gold and Platinum tiers.
 * Renders over everything with a dramatic reveal:
 *   - Full-screen overlay with particle-burst visual
 *   - Tier-coloured glow ring + icon
 *   - Category-wide celebration text
 *   - Auto-dismisses after 4.5s, tappable to dismiss early
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { haptics } from '../audio';
import { AchievementDef } from '../game/achievements';
import { fonts, fontSize, fontWeight, radius, spacing } from '../theme';
import { AppText as Text } from './AppText';

const TIER_CONFIG = {
  gold: {
    color: '#E9B23B',
    bg: ['#1A1000', '#2A1F00', '#1A1000'] as [string, string, string],
    glow: 'rgba(233,178,59,0.22)',
    label: '🥇 GOLD',
    fanfare: 'Outstanding!',
  },
  platinum: {
    color: '#B4E4FF',
    bg: ['#000D1A', '#001A2E', '#000D1A'] as [string, string, string],
    glow: 'rgba(180,228,255,0.25)',
    label: '💎 PLATINUM',
    fanfare: 'Legendary!',
  },
};

const AUTO_DISMISS_MS = 4500;

interface Props {
  achievement: AchievementDef | null;
  onDismiss: () => void;
}

export function AchievementCinematic({ achievement, onDismiss }: Props) {
  const scale = useSharedValue(0);
  const iconScale = useSharedValue(0);
  const ring1 = useSharedValue(0.8);
  const ring2 = useSharedValue(0.7);

  useEffect(() => {
    if (!achievement) return;
    haptics.impact();
    scale.value = withTiming(1, { duration: 200 });
    iconScale.value = withDelay(100, withTiming(1, { duration: 200 }));
    ring1.value = withDelay(
      300,
      withRepeat(
        withSequence(withTiming(1.2, { duration: 900 }), withTiming(0.8, { duration: 900 })),
        -1,
        true,
      ),
    );
    ring2.value = withDelay(
      500,
      withRepeat(
        withSequence(withTiming(1.3, { duration: 1100 }), withTiming(0.7, { duration: 1100 })),
        -1,
        true,
      ),
    );

    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [achievement]); // eslint-disable-line react-hooks/exhaustive-deps

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));
  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1.value }],
    opacity: 0.18,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2.value }],
    opacity: 0.12,
  }));

  if (!achievement) return null;

  const cfg = TIER_CONFIG[achievement.tier as 'gold' | 'platinum'] ?? TIER_CONFIG.gold;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(300)}
      style={styles.overlay}
      pointerEvents="box-none"
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      <Animated.View style={[styles.card, cardStyle]}>
        <LinearGradient colors={cfg.bg} style={styles.gradient}>
          {/* Pulsing rings behind the icon */}
          <View style={styles.ringContainer}>
            <Animated.View
              style={[
                styles.ring,
                { borderColor: cfg.color, width: 160, height: 160, borderRadius: 80 },
                ring2Style,
              ]}
            />
            <Animated.View
              style={[
                styles.ring,
                { borderColor: cfg.color, width: 120, height: 120, borderRadius: 60 },
                ring1Style,
              ]}
            />
          </View>

          {/* Tier label */}
          <View
            style={[
              styles.tierBadge,
              { borderColor: cfg.color, backgroundColor: `${cfg.color}1A` },
            ]}
          >
            <Text style={[styles.tierLabel, { color: cfg.color }]}>{cfg.label}</Text>
          </View>

          {/* Fanfare */}
          <Text style={[styles.fanfare, { color: cfg.color }]}>{cfg.fanfare}</Text>

          {/* Icon */}
          <Animated.View
            style={[
              styles.iconWrap,
              { borderColor: cfg.color, backgroundColor: `${cfg.color}1A` },
              iconStyle,
            ]}
          >
            <Text style={styles.icon}>{achievement.icon}</Text>
          </Animated.View>

          {/* Title & description */}
          <Text style={styles.unlockLabel}>Achievement Unlocked</Text>
          <Text style={[styles.title, { color: cfg.color }]}>{achievement.title}</Text>
          <Text style={styles.description} numberOfLines={3}>
            {achievement.description}
          </Text>

          {/* Glow bloom */}
          <View style={[styles.glowBloom, { backgroundColor: cfg.color }]} />
        </LinearGradient>

        {/* Dismiss hint */}
        <Pressable onPress={onDismiss} style={styles.dismissHint} hitSlop={12}>
          <Text style={styles.dismissText}>Tap to continue</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.82)',
    zIndex: 99999,
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  gradient: {
    alignItems: 'center',
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  ringContainer: {
    position: 'absolute',
    top: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    width: 160,
    height: 160,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  glowBloom: {
    position: 'absolute',
    top: 60,
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.06,
  },
  tierBadge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  tierLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.black,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  fanfare: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.black,
    fontFamily: fonts.display,
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  icon: { fontSize: 48 },
  unlockLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.black,
    fontFamily: fonts.display,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  dismissHint: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  dismissText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: fontSize.xs,
    letterSpacing: 0.5,
  },
});
