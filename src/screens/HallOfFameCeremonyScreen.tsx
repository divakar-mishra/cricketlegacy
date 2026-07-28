/**
 * HallOfFameCeremonyScreen — cinematic HoF induction moment.
 * Shown when a player or manager earns a place in the all-time Hall of Fame.
 * Stars, confetti, gold seal, legacy quote — makes the achievement feel legendary.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, Polygon, RadialGradient, Stop } from 'react-native-svg';
import { playHaptic } from '../audio';
import { Button, Screen } from '../components';
import { AppText as Text } from '../components/AppText';
import { ScreenProps } from '../navigation';
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

// ─── Animated star particle ───────────────────────────────────────────────────

function StarParticle({
  x,
  y,
  size,
  delay,
}: {
  x: number;
  y: number;
  size: number;
  delay: number;
}) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(1, { duration: 600 }), withTiming(0.2, { duration: 800 })),
        -1,
        true,
      ),
    );
    scale.value = withDelay(delay, withSpring(1, { damping: 8 }));
    rotation.value = withDelay(delay, withRepeat(withTiming(360, { duration: 3000 }), -1, false));
  }, [delay, opacity, rotation, scale]);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x,
    top: y,
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Polygon
          points="12,2 15,9 22,9 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9 9,9"
          fill="#E9B23B"
          opacity={0.9}
        />
      </Svg>
    </Animated.View>
  );
}

// ─── Gold seal / plaque ───────────────────────────────────────────────────────

function GoldSeal() {
  return (
    <Svg width={180} height={180} viewBox="0 0 180 180">
      <Defs>
        <RadialGradient id="sealGrad" cx="50%" cy="35%" r="65%">
          <Stop offset="0%" stopColor="#F7D06E" stopOpacity="1" />
          <Stop offset="60%" stopColor="#E9B23B" stopOpacity="1" />
          <Stop offset="100%" stopColor="#8A5D08" stopOpacity="1" />
        </RadialGradient>
      </Defs>

      {/* Outer ring */}
      <Circle cx="90" cy="90" r="86" fill="url(#sealGrad)" />
      <Circle cx="90" cy="90" r="80" fill="none" stroke="#C6902A" strokeWidth="2" />
      <Circle
        cx="90"
        cy="90"
        r="70"
        fill="none"
        stroke="#C6902A"
        strokeWidth="1"
        strokeDasharray="4,4"
      />

      {/* Inner circle */}
      <Circle cx="90" cy="90" r="62" fill="#1A1005" />
      <Circle cx="90" cy="90" r="58" fill="#231508" />

      {/* Cricket bat + ball */}
      <Path d="M78 50 L102 74 L94 82 L70 58 Z" fill="#E9B23B" opacity={0.9} />
      <Path d="M70 58 L66 78 L80 64 Z" fill="#C6902A" />
      <Circle cx="108" cy="82" r="8" fill="#E5484D" />
      <Path d="M104 82 Q108 78 112 82" fill="none" stroke="white" strokeWidth="1" />
      <Path d="M104 82 Q108 86 112 82" fill="none" stroke="white" strokeWidth="1" />

      {/* HOF text */}
      <Path d="M90 116 L90 130" fill="none" stroke="#E9B23B" strokeWidth="1.5" />

      {/* Stars around the seal */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const sx = 90 + 74 * Math.cos(rad);
        const sy = 90 + 74 * Math.sin(rad);
        return <Circle key={i} cx={sx} cy={sy} r={3} fill="#F7D06E" />;
      })}
    </Svg>
  );
}

// ─── HoF Quotes ──────────────────────────────────────────────────────────────

const PLAYER_QUOTES = [
  'A career that will be spoken of in reverent tones for generations.',
  'Numbers alone cannot capture the magnitude of what was achieved.',
  'The pinnacle of the game, claimed with grace, grit, and genius.',
  'From first cap to final bow — a career that defined an era.',
  'Every record was merely a stepping stone on a path to legend.',
];

const MANAGER_QUOTES = [
  'A tactical visionary who shaped the future of the beautiful game.',
  'Under their guidance, ordinary clubs became extraordinary.',
  'A mastermind on the touchline — their legacy endures in every team they built.',
  'The blueprint for success: their methods are now taught in academies worldwide.',
  'Trophies, players, and an entire generation of fans — their gift to the game.',
];

// ─── Main screen ──────────────────────────────────────────────────────────────

interface HighlightBeat {
  emoji: string;
  headline: string;
  sub: string;
}

export function HallOfFameCeremonyScreen({ navigation, route }: ScreenProps<'HallOfFameCeremony'>) {
  const { playerName, legacyScore, mode, titles = 0, caps = 0 } = route.params;
  const styles = useThemedStyles(makeStyles);
  const [quoteIdx] = useState(Math.floor(legacyScore % 5));

  const quote = mode === 'career' ? PLAYER_QUOTES[quoteIdx] : MANAGER_QUOTES[quoteIdx];

  // Career highlight reel beats, shown before the plaque reveal.
  const highlights = useMemo<HighlightBeat[]>(() => {
    const h: HighlightBeat[] = [];
    if (mode === 'career') {
      if (caps > 0)
        h.push({
          emoji: '🧢',
          headline: String(caps),
          sub: caps === 1 ? 'international cap' : 'international caps',
        });
      if (titles > 0)
        h.push({
          emoji: '🏆',
          headline: String(titles),
          sub: titles === 1 ? 'major title' : 'major titles',
        });
      h.push({ emoji: '⭐', headline: legacyScore.toLocaleString(), sub: 'legacy score' });
      h.push({ emoji: '🎖️', headline: 'Immortalised', sub: 'a career for the ages' });
    } else {
      if (titles > 0)
        h.push({
          emoji: '🏆',
          headline: String(titles),
          sub: titles === 1 ? 'trophy lifted' : 'trophies lifted',
        });
      if (caps > 0)
        h.push({
          emoji: '📋',
          headline: String(caps),
          sub: caps === 1 ? 'season at the helm' : 'seasons at the helm',
        });
      h.push({ emoji: '⭐', headline: legacyScore.toLocaleString(), sub: 'legacy score' });
      h.push({ emoji: '🎖️', headline: 'A Dynasty', sub: 'built to last' });
    }
    return h;
  }, [mode, caps, titles, legacyScore]);

  const [phase, setPhase] = useState<'reel' | 'plaque'>(highlights.length > 0 ? 'reel' : 'plaque');

  const sealScale = useSharedValue(0);
  const sealOpacity = useSharedValue(0);
  const titleY = useSharedValue(30);
  const titleOpacity = useSharedValue(0);
  const cardY = useSharedValue(50);
  const cardOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    // The plaque reveal (and its haptics) only fire once the highlight reel ends.
    if (phase !== 'plaque') return;
    playHaptic('notify-success');
    setTimeout(() => playHaptic('impact-heavy'), 500);
    setTimeout(() => playHaptic('impact-medium'), 1000);

    sealScale.value = withDelay(200, withSpring(1, { damping: 8, stiffness: 120 }));
    sealOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    titleY.value = withDelay(700, withSpring(0, { damping: 14 }));
    titleOpacity.value = withDelay(700, withTiming(1, { duration: 400 }));
    cardY.value = withDelay(1000, withSpring(0, { damping: 14 }));
    cardOpacity.value = withDelay(1000, withTiming(1, { duration: 500 }));
    glowOpacity.value = withDelay(
      300,
      withRepeat(
        withSequence(withTiming(0.6, { duration: 1200 }), withTiming(0.15, { duration: 1200 })),
        -1,
        true,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const sealStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sealScale.value }],
    opacity: sealOpacity.value,
  }));
  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: titleY.value }],
    opacity: titleOpacity.value,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardY.value }],
    opacity: cardOpacity.value,
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  // Star particles scattered around
  const starPositions = [
    { x: 20, y: 60, size: 16, delay: 400 },
    { x: 300, y: 80, size: 12, delay: 600 },
    { x: 50, y: 200, size: 10, delay: 800 },
    { x: 280, y: 220, size: 14, delay: 500 },
    { x: 15, y: 350, size: 8, delay: 1000 },
    { x: 320, y: 340, size: 10, delay: 700 },
    { x: 160, y: 40, size: 12, delay: 300 },
  ];

  return (
    <Screen>
      <LinearGradient colors={['#1A1005', '#2A1C08', '#0F0A03']} style={StyleSheet.absoluteFill} />

      {/* Background star particles */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {starPositions.map((sp, i) => (
          <StarParticle key={i} {...sp} />
        ))}
      </View>

      <View style={styles.container}>
        {/* HOF title */}
        <Animated.View entering={FadeIn.duration(600)} style={styles.hofLabel}>
          <Text style={styles.hofLabelText}>HALL OF FAME</Text>
        </Animated.View>

        {/* Gold seal */}
        <Animated.View style={[styles.sealWrap, sealStyle]}>
          <Animated.View style={[styles.sealGlow, glowStyle]} />
          <GoldSeal />
        </Animated.View>

        {/* Player name */}
        <Animated.View style={[styles.nameWrap, titleStyle]}>
          <Text style={styles.inducteeName}>{playerName}</Text>
          <Text style={styles.inducteeRole}>
            {mode === 'career' ? 'Player' : 'Manager'} · Inducted {new Date().getFullYear()}
          </Text>
        </Animated.View>

        {/* Stats card */}
        <Animated.View style={[styles.statsCard, cardStyle]}>
          <LinearGradient colors={['#2A1C08DD', '#1A1005DD']} style={styles.statsCardInner}>
            {/* Legacy score */}
            <View style={styles.legacyRow}>
              <Text style={styles.legacyLabel}>Legacy Score</Text>
              <Text style={styles.legacyValue}>{legacyScore.toLocaleString()}</Text>
            </View>

            {/* Stats grid */}
            <View style={styles.statsGrid}>
              {titles > 0 && (
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{titles}</Text>
                  <Text style={styles.statLabel}>{mode === 'career' ? 'Titles' : 'Trophies'}</Text>
                </View>
              )}
              {caps > 0 && (
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{caps}</Text>
                  <Text style={styles.statLabel}>{mode === 'career' ? 'Caps' : 'Seasons'}</Text>
                </View>
              )}
              <View style={styles.statItem}>
                <Text style={styles.statValue}>⭐</Text>
                <Text style={styles.statLabel}>Legend</Text>
              </View>
            </View>

            {/* Quote */}
            <View style={styles.quoteBlock}>
              <Text style={styles.quoteMark}>"</Text>
              <Text style={styles.quoteText}>{quote}</Text>
              <Text style={[styles.quoteMark, { alignSelf: 'flex-end' }]}>"</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(400).delay(1400)} style={styles.ctaWrap}>
          <Button
            label="Accept the honour"
            variant="gold"
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('MainMenu');
            }}
          />
        </Animated.View>
      </View>

      {phase === 'reel' ? (
        <HighlightReel highlights={highlights} onDone={() => setPhase('plaque')} />
      ) : null}
    </Screen>
  );
}

/** A short auto-advancing career highlight reel shown before the plaque reveal. */
function HighlightReel({
  highlights,
  onDone,
}: {
  highlights: HighlightBeat[];
  onDone: () => void;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      setI((prev) => {
        if (prev + 1 >= highlights.length) {
          onDone();
          return prev;
        }
        return prev + 1;
      });
    }, 1600);
    return () => clearTimeout(t);
  }, [i, highlights.length, onDone]);

  const beat = highlights[i];
  if (!beat) return null;

  return (
    <View style={reelStyles.overlay}>
      <LinearGradient colors={['#1A1005', '#2A1C08', '#0F0A03']} style={StyleSheet.absoluteFill} />
      <Text style={reelStyles.eyebrow}>CAREER HIGHLIGHTS</Text>
      <Animated.View key={i} entering={ZoomIn.springify().damping(14)} style={reelStyles.beat}>
        <Text style={reelStyles.emoji}>{beat.emoji}</Text>
        <Text style={reelStyles.headline}>{beat.headline}</Text>
        <Text style={reelStyles.sub}>{beat.sub}</Text>
      </Animated.View>
      <View style={reelStyles.dots}>
        {highlights.map((_, idx) => (
          <View key={idx} style={[reelStyles.dot, idx === i && reelStyles.dotActive]} />
        ))}
      </View>
      <Pressable onPress={onDone} hitSlop={12} style={reelStyles.skip} accessibilityRole="button">
        <Text style={reelStyles.skipText}>Skip ›</Text>
      </Pressable>
    </View>
  );
}

const reelStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    zIndex: 50,
  },
  eyebrow: {
    color: '#E9B23B',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.black,
    letterSpacing: 4,
    marginBottom: spacing.xxl,
  },
  beat: { alignItems: 'center' },
  emoji: { fontSize: 64, marginBottom: spacing.md },
  headline: {
    color: '#F7D06E',
    fontSize: fontSize.display,
    fontWeight: fontWeight.black,
    fontFamily: fonts.display,
    textAlign: 'center',
  },
  sub: {
    color: '#C6902A',
    fontSize: fontSize.md,
    letterSpacing: 0.5,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  dots: { flexDirection: 'row', gap: 6, position: 'absolute', bottom: 80 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(233,178,59,0.3)' },
  dotActive: { backgroundColor: '#E9B23B', width: 16 },
  skip: { position: 'absolute', bottom: spacing.xl, right: spacing.xl },
  skipText: { color: '#C6902A', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});

const makeStyles = (_colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xxl,
    },
    hofLabel: {
      marginBottom: spacing.md,
    },
    hofLabelText: {
      color: '#E9B23B',
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      letterSpacing: 6,
      textTransform: 'uppercase',
    },
    sealWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    sealGlow: {
      position: 'absolute',
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: '#E9B23B',
      opacity: 0.15,
    },
    nameWrap: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    inducteeName: {
      color: '#F7D06E',
      fontSize: fontSize.xxxl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      textAlign: 'center',
    },
    inducteeRole: {
      color: '#C6902A',
      fontSize: fontSize.sm,
      marginTop: spacing.xs,
      letterSpacing: 0.5,
    },
    statsCard: {
      width: '100%',
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: '#E9B23B33',
      ...shadow.card,
      marginBottom: spacing.xl,
    },
    statsCardInner: {
      padding: spacing.xl,
    },
    legacyRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#E9B23B33',
    },
    legacyLabel: {
      color: '#C6902A',
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.8,
    },
    legacyValue: {
      color: '#F7D06E',
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    statsGrid: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderRadius: radius.md,
      padding: spacing.sm,
    },
    statValue: {
      color: '#F7D06E',
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    statLabel: {
      color: '#8A5D08',
      fontSize: 10,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: 2,
    },
    quoteBlock: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: '#E9B23B22',
      paddingTop: spacing.md,
    },
    quoteMark: {
      color: '#E9B23B',
      fontSize: 32,
      fontFamily: fonts.display,
      lineHeight: 28,
    },
    quoteText: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: fontSize.sm,
      fontStyle: 'italic',
      lineHeight: 20,
      textAlign: 'center',
      marginHorizontal: spacing.md,
    },
    ctaWrap: {
      width: '100%',
    },
  });
