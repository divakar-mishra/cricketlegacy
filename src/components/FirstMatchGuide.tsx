/**
 * FirstMatchGuide — a lightweight coach overlay shown ONLY during a player's
 * very first match (gate on totalMatchesPlayed === 0 at the call site).
 *
 * Three short, timed prompts introduce the essentials without a wall of text:
 *  1) the batting stance control, 2) how to read the required run rate, and
 *  3) where to look after the match. Auto-advances, but the player can tap
 *  Next or Skip at any time.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';
import {
  fontSize,
  fontWeight,
  radius,
  spacing,
  ThemeColors,
  useTheme,
  useThemedStyles,
} from '../theme';
import { AppText as Text } from './AppText';
import { GlassSurface } from './GlassSurface';

interface Prompt {
  emoji: string;
  title: string;
  body: string;
}

const PROMPTS: Prompt[] = [
  {
    emoji: '🏏',
    title: 'Set your stance',
    body: 'Use the stance button to choose Defend, Balanced or Attack. You can switch it any time while you bat — no per-ball taps needed.',
  },
  {
    emoji: '📈',
    title: 'Read the chase',
    body: 'When chasing, keep the Required Run Rate below your Current Run Rate. The pressure bar turns amber then red as it gets harder.',
  },
  {
    emoji: '🏆',
    title: 'After the match',
    body: 'Check your match rating, wagon wheel and Player-of-the-Match on the result screen — that is where your reputation is built.',
  },
];

const PROMPT_MS = 6000;

interface FirstMatchGuideProps {
  active: boolean;
  onDone: () => void;
}

export function FirstMatchGuide({ active, onDone }: FirstMatchGuideProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      setIdx((i) => {
        if (i + 1 >= PROMPTS.length) {
          onDone();
          return i;
        }
        return i + 1;
      });
    }, PROMPT_MS);
    return () => clearTimeout(timer);
  }, [active, idx, onDone]);

  if (!active) return null;
  const prompt = PROMPTS[idx];
  const isLast = idx + 1 >= PROMPTS.length;

  const next = () => {
    if (isLast) onDone();
    else setIdx((i) => i + 1);
  };

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(16)}
      exiting={FadeOut.duration(200)}
      style={styles.wrap}
      pointerEvents="auto"
    >
      <View style={styles.scrim} />
      <GlassSurface intensity={0.95} blur={false} style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.emoji}>{prompt.emoji}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              COACH · {idx + 1}/{PROMPTS.length}
            </Text>
          </View>
          <Pressable
            onPress={onDone}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Skip guide"
          >
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        </View>
        <Animated.View key={idx} entering={FadeIn.duration(220)}>
          <Text style={styles.title}>{prompt.title}</Text>
          <Text style={styles.body}>{prompt.body}</Text>
        </Animated.View>
        <View style={styles.footerRow}>
          <View style={styles.dots}>
            {PROMPTS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === idx && { backgroundColor: colors.primary, width: 16 }]}
              />
            ))}
          </View>
          <Pressable onPress={next} style={styles.nextBtn} accessibilityRole="button">
            <Text style={styles.nextText}>{isLast ? 'Got it!' : 'Next'}</Text>
          </Pressable>
        </View>
      </GlassSurface>
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      zIndex: 250,
    },
    scrim: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0,0,0,0.48)',
    },
    card: {
      borderRadius: radius.lg,
      backgroundColor: colors.bgElevated,
      borderColor: colors.primaryDark,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    emoji: { fontSize: 22 },
    badge: {
      flex: 1,
      alignSelf: 'flex-start',
    },
    badgeText: {
      color: colors.accent,
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 1.2,
    },
    skip: { color: colors.textFaint, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    title: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      marginTop: spacing.sm,
    },
    body: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 19, marginTop: 4 },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.md,
    },
    dots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
    nextBtn: {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    nextText: { color: colors.white, fontSize: fontSize.sm, fontWeight: fontWeight.black },
  });
