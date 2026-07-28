/**
 * Achievement unlock toast — routes Gold/Platinum to the cinematic component
 * and Bronze/Silver to the slide-up toast card.
 */
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideInRight,
  SlideOutDown,
  SlideOutRight,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AchievementDef, getTierPoints } from '../game/achievements';
import { MODAL_PRIORITY, useModalQueue } from '../context/ModalQueueContext';
import { fonts, fontSize, fontWeight, radius, shadow, spacing, useTheme } from '../theme';
import { AchievementCinematic } from './AchievementCinematic';
import { AppText as Text } from './AppText';

const TIER_COLOR: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#B8BEC5',
  gold: '#E9B23B',
  platinum: '#B4E4FF',
};

const TIER_BG: Record<string, string> = {
  bronze: 'rgba(205,127,50,0.12)',
  silver: 'rgba(184,190,197,0.12)',
  gold: 'rgba(233,178,59,0.14)',
  platinum: 'rgba(180,228,255,0.14)',
};

/** Dismiss timeout per tier. Bronze is quicker; silver is standard. */
const TIER_DISMISS_MS: Record<string, number> = {
  bronze: 2000,
  silver: 3500,
};

interface Props {
  achievement: AchievementDef | null;
  onDismiss: () => void;
}

export function AchievementToast({ achievement, onDismiss }: Props) {
  const { colors } = useTheme();
  const queueVisible = useModalQueue(
    Boolean(achievement),
    MODAL_PRIORITY.engagement,
    'achievement',
  );
  const glow = useSharedValue(0.6);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gold/Platinum → full-screen cinematic
  useEffect(() => {
    if (!achievement || !queueVisible) return;
    const dismissMs = TIER_DISMISS_MS[achievement.tier] ?? 3500;
    // Silver gets a pulsing glow; bronze does not.
    if (achievement.tier === 'silver') {
      glow.value = withRepeat(
        withSequence(withTiming(1, { duration: 500 }), withTiming(0.55, { duration: 500 })),
        3,
        false,
      );
    } else {
      glow.value = withTiming(0.4, { duration: 200 });
    }
    timer.current = setTimeout(onDismiss, dismissMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [achievement, queueVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  const glowStyle = useAnimatedStyle(() => ({
    opacity: achievement ? glow.value : 0,
  }));

  if (
    queueVisible &&
    achievement &&
    (achievement.tier === 'gold' || achievement.tier === 'platinum')
  ) {
    return <AchievementCinematic achievement={achievement} onDismiss={onDismiss} />;
  }

  if (!achievement || !queueVisible) return null;

  const isBronze = achievement.tier === 'bronze';
  const tierColor = TIER_COLOR[achievement.tier] ?? TIER_COLOR.gold;
  const tierBg = TIER_BG[achievement.tier] ?? TIER_BG.gold;
  const tierLabel = achievement.tier.charAt(0).toUpperCase() + achievement.tier.slice(1);
  const points = getTierPoints(achievement.tier);
  // Bronze slides in from the right (quicker, less intrusive).
  // Silver slides up from the bottom (standard).
  const enterAnim = isBronze
    ? SlideInRight.springify().damping(20)
    : SlideInDown.springify().damping(15);
  const exitAnim = isBronze ? SlideOutRight.duration(200) : SlideOutDown.duration(250);

  return (
    <Animated.View
      entering={FadeIn.duration(isBronze ? 100 : 200)}
      exiting={FadeOut.duration(300)}
      style={[styles.backdrop, isBronze && styles.backdropBronze]}
      pointerEvents="box-none"
    >
      <Pressable
        style={[styles.hitArea, isBronze && styles.hitAreaBronze]}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss achievement"
      >
        <Animated.View
          entering={enterAnim}
          exiting={exitAnim}
          style={[
            styles.card,
            isBronze && styles.cardBronze,
            { backgroundColor: colors.surface, borderColor: tierColor },
            shadow.card,
          ]}
        >
          {/* Tier glow ring */}
          <Animated.View style={[styles.glow, { backgroundColor: tierColor }, glowStyle]} />

          <View style={[styles.iconBadge, { backgroundColor: tierBg, borderColor: tierColor }]}>
            <Text style={[styles.icon, isBronze && { fontSize: 20 }]}>{achievement.icon}</Text>
          </View>

          <View style={styles.body}>
            <Text style={[styles.header, { color: tierColor }]}>Achievement Unlocked!</Text>
            <Text style={[styles.title, isBronze && { fontSize: fontSize.md }]}>
              {achievement.title}
            </Text>
            {!isBronze && (
              <Text style={styles.description} numberOfLines={2}>
                {achievement.description}
              </Text>
            )}
          </View>

          <View style={{ alignItems: 'center', gap: 4 }}>
            <View style={[styles.tierBadge, { backgroundColor: tierBg, borderColor: tierColor }]}>
              <Text style={[styles.tierText, { color: tierColor }]}>{tierLabel}</Text>
            </View>
            <Text style={[styles.pointsBadge, { color: tierColor }]}>+{points}pts</Text>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    paddingBottom: 100,
    zIndex: 9999,
  },
  hitArea: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    borderRadius: radius.xl,
    borderWidth: 1.5,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -80,
    left: '50%',
    width: 200,
    height: 200,
    borderRadius: 100,
    marginLeft: -100,
    opacity: 0.08,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icon: { fontSize: 28 },
  body: { flex: 1 },
  header: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.black,
    fontFamily: fonts.display,
    color: '#F1F7F3',
    marginBottom: 2,
  },
  description: {
    fontSize: fontSize.xs,
    color: '#9FB8AB',
    lineHeight: 16,
  },
  tierBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexShrink: 0,
  },
  tierText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pointsBadge: {
    fontSize: 10,
    fontWeight: fontWeight.black,
    letterSpacing: 0.5,
  },
  backdropBronze: {
    justifyContent: 'flex-start',
    paddingTop: 60,
    paddingBottom: 0,
    alignItems: 'flex-end',
    paddingRight: spacing.lg,
  },
  hitAreaBronze: { alignItems: 'flex-end' },
  cardBronze: { width: 240 },
});
