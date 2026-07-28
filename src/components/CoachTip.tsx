/**
 * CoachTip — an in-game coach tip overlay shown during the first career match.
 *
 * A speech-bubble style card with the "coach" emoji that appears at specific
 * match moments (toss, first shot, first boundary, first wicket) and disappears
 * when the player taps "Got it". Each tip is tracked in settingsStore so it
 * only ever shows once.
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  fonts,
  fontSize,
  fontWeight,
  radius,
  shadow,
  spacing,
  ThemeColors,
  useThemedStyles,
} from '../theme';
import { AppText as Text } from './AppText';

export type CoachTipId =
  | 'match_intro'
  | 'shot_selection'
  | 'scoring'
  | 'bowling_plan'
  | 'first_four'
  | 'first_wicket'
  | 'drs'
  | 'tactics';

const TIP_CONTENT: Record<CoachTipId, { title: string; body: string; emoji: string }> = {
  match_intro: {
    emoji: '🧑‍🏫',
    title: 'Welcome to the crease!',
    body: "Watch the scoreboard update ball-by-ball. When YOUR player is batting, you'll be asked to choose a shot. Tap the button that matches your plan!",
  },
  shot_selection: {
    emoji: '🏏',
    title: 'Choose your shot wisely',
    body: 'Defend keeps you in but scores slowly. Rotate gets singles. Attack risks your wicket for big runs. Go for LOFT only when the field is up!',
  },
  scoring: {
    emoji: '📊',
    title: 'Reading the scoreboard',
    body: "The big number is runs / wickets. CRR = current run rate. In a chase, RRR is the rate you need to win. Keep RRR below CRR and you're winning!",
  },
  bowling_plan: {
    emoji: '🎯',
    title: 'Setting your bowling plan',
    body: "Each over you'll pick a bowling strategy. CONTAIN restricts runs, ATTACK goes for wickets. Match up to the batter — pace attack on nervous openers!",
  },
  first_four: {
    emoji: '🚀',
    title: 'FOUR! Well played!',
    body: "Boundaries are your best friend. Watch the wagon wheel after the match to see where you're scoring — then target those gaps!",
  },
  first_wicket: {
    emoji: '🎯',
    title: 'WICKET! Big moment!',
    body: 'Wickets swing momentum. After a wicket, the new batter is vulnerable — bowl to their weakness and go for another quick dismissal!',
  },
  drs: {
    emoji: '📹',
    title: 'DRS Review Available',
    body: "The DRS button lets you challenge an umpire's decision. You have 2 reviews per innings. 40% chance of success — save them for close LBW calls!",
  },
  tactics: {
    emoji: '⚙️',
    title: 'Tactics panel',
    body: 'Tap TACTICS to adjust your batting aggression or set a field. Defensive field restricts scoring; attacking field risks giving runs but creates chances!',
  },
};

interface CoachTipProps {
  tipId: CoachTipId | null;
  onDismiss: (tipId: CoachTipId) => void;
}

export function CoachTip({ tipId, onDismiss }: CoachTipProps) {
  const styles = useThemedStyles(makeStyles);

  // Bounce animation for the coach emoji
  const bounce = useSharedValue(0);
  useEffect(() => {
    if (!tipId) return;
    bounce.value = withRepeat(
      withSequence(withTiming(-6, { duration: 400 }), withTiming(0, { duration: 400 })),
      3,
      true,
    );
  }, [tipId, bounce]);
  const bounceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bounce.value }] }));

  if (!tipId) return null;
  const content = TIP_CONTENT[tipId];

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(16)}
      exiting={FadeOut.duration(200)}
      style={styles.container}
    >
      {/* Bubble tail */}
      <View style={styles.tail} />

      <View style={[styles.card, shadow.card]}>
        {/* Coach emoji */}
        <Animated.View style={[styles.coachEmoji, bounceStyle]}>
          <Text style={styles.coachEmojiText}>{content.emoji}</Text>
        </Animated.View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.coachBadge}>
              <Text style={styles.coachBadgeText}>COACH TIP</Text>
            </View>
          </View>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.body}>{content.body}</Text>
        </View>

        {/* Dismiss */}
        <Pressable
          onPress={() => onDismiss(tipId)}
          style={styles.dismissBtn}
          accessibilityRole="button"
          accessibilityLabel="Got it, dismiss tip"
        >
          <Text style={styles.dismissText}>Got it! ✓</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 100,
      left: spacing.md,
      right: spacing.md,
      zIndex: 200,
    },
    tail: {
      position: 'absolute',
      bottom: -8,
      left: 24,
      width: 0,
      height: 0,
      borderLeftWidth: 8,
      borderRightWidth: 8,
      borderTopWidth: 10,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: colors.primary,
      zIndex: 201,
    },
    card: {
      backgroundColor: colors.bgElevated,
      borderRadius: radius.xl,
      borderWidth: 2,
      borderColor: colors.primary,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    coachEmoji: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      borderWidth: 1.5,
      borderColor: colors.primaryLight,
    },
    coachEmojiText: { fontSize: 22 },
    content: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    coachBadge: {
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    coachBadgeText: {
      color: colors.white,
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 1,
    },
    title: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      fontFamily: fonts.display,
      marginBottom: 4,
    },
    body: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 18 },
    dismissBtn: {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      alignSelf: 'flex-end',
      marginTop: spacing.sm,
    },
    dismissText: { color: colors.white, fontSize: fontSize.sm, fontWeight: fontWeight.black },
  });
