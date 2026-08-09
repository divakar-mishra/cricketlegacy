/**
 * BoardMeetingScreen — cinematic full-screen event for board decisions.
 * Replaces the plain Alert for sacking/praise/warning/contract extension.
 * Creates an emotional high-stakes moment that makes manager mode feel real.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Rect } from 'react-native-svg';
import { playHaptic } from '../audio';
import { Button, Screen } from '../components';
import { AppText as Text } from '../components/AppText';
import { MODAL_PRIORITY, useModalQueue } from '../context/ModalQueueContext';
import { ScreenProps } from '../navigation';
import {
  fonts,
  fontSize,
  fontWeight,
  radius,
  shadow,
  spacing,
  ThemeColors,
  useTheme,
  useThemedStyles,
} from '../theme';

// ─── Board kind config ────────────────────────────────────────────────────────

type BoardKind = 'SACKED' | 'PRAISED' | 'WARNING' | 'EXTENDED';

interface KindConfig {
  emoji: string;
  headline: string;
  subheadline: string;
  gradColors: readonly [string, string, ...string[]];
  accentColor: string;
  haptic: () => void;
  ctaLabel: string;
  ctaVariant: 'primary' | 'danger' | 'gold' | 'secondary';
}

function getKindConfig(kind: BoardKind): KindConfig {
  switch (kind) {
    case 'SACKED':
      return {
        emoji: '🚪',
        headline: "You've been sacked.",
        subheadline: 'The board has lost confidence. Time to find a new challenge.',
        gradColors: ['#2A0A0A', '#3D1515', '#1A0505'],
        accentColor: '#E5484D',
        haptic: () => playHaptic('notify-error'),
        ctaLabel: 'Find a new club',
        ctaVariant: 'danger',
      };
    case 'PRAISED':
      return {
        emoji: '🏆',
        headline: 'The board are delighted.',
        subheadline: 'Exceptional results. Your position is stronger than ever.',
        gradColors: ['#1A2A0A', '#2A4010', '#0A1912'],
        accentColor: '#31A85A',
        haptic: () => playHaptic('notify-success'),
        ctaLabel: 'Keep it up',
        ctaVariant: 'primary',
      };
    case 'WARNING':
      return {
        emoji: '⚠️',
        headline: 'Final warning from the board.',
        subheadline: 'Results must improve immediately. Your job is on the line.',
        gradColors: ['#2A1A0A', '#3D2A10', '#1A1005'],
        accentColor: '#F5A524',
        haptic: () => playHaptic('notify-warning'),
        ctaLabel: 'Accept the challenge',
        ctaVariant: 'secondary',
      };
    case 'EXTENDED':
      return {
        emoji: '✍️',
        headline: 'Contract extended!',
        subheadline: 'The board back you fully. Your future at the club is secure.',
        gradColors: ['#0A1A2A', '#10253D', '#061015'],
        accentColor: '#4C9AFF',
        haptic: () => playHaptic('notify-success'),
        ctaLabel: 'Continue',
        ctaVariant: 'primary',
      };
  }
}

// ─── Animated boardroom table SVG ─────────────────────────────────────────────

function BoardroomSvg({ accentColor }: { accentColor: string }) {
  return (
    <Svg width={280} height={120} viewBox="0 0 280 120">
      {/* Table */}
      <Rect x="20" y="60" width="240" height="40" rx="20" fill="rgba(255,255,255,0.06)" />
      <Rect x="20" y="60" width="240" height="4" rx="2" fill={accentColor} opacity={0.3} />

      {/* Board members (silhouettes) */}
      {[50, 90, 140, 190, 230].map((x, i) => (
        <G key={i}>
          <Circle cx={x} cy={52} r={10} fill="rgba(255,255,255,0.12)" />
          <Rect x={x - 8} y={62} width={16} height={24} rx={4} fill="rgba(255,255,255,0.08)" />
        </G>
      ))}

      {/* Documents on table */}
      <Rect x="110" y="70" width="60" height="40" rx="4" fill="rgba(255,255,255,0.08)" />
      <Line x1="118" y1="82" x2="162" y2="82" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      <Line x1="118" y1="88" x2="152" y2="88" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <Line x1="118" y1="93" x2="145" y2="93" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

      {/* Accent glow under table */}
      <Rect x="80" y="98" width="120" height="4" rx="2" fill={accentColor} opacity={0.2} />
    </Svg>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function BoardMeetingScreen({ navigation, route }: ScreenProps<'BoardMeeting'>) {
  const { kind, message, clubName, season } = route.params;
  const cfg = getKindConfig(kind);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const queueVisible = useModalQueue(true, MODAL_PRIORITY.critical, 'board-meeting');

  const emojiScale = useSharedValue(0);
  const cardY = useSharedValue(40);
  const cardOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (!queueVisible) return;
    getKindConfig(kind).haptic();
    emojiScale.value = withTiming(1, { duration: 200 });
    cardY.value = withDelay(120, withTiming(0, { duration: 220 }));
    cardOpacity.value = withDelay(120, withTiming(1, { duration: 220 }));
    pulseScale.value = withDelay(
      600,
      withRepeat(
        withSequence(withTiming(1.05, { duration: 800 }), withTiming(1, { duration: 800 })),
        -1,
        true,
      ),
    );
  }, [cardOpacity, cardY, emojiScale, kind, pulseScale, queueVisible]);

  const emojiStyle = useAnimatedStyle(() => ({ transform: [{ scale: emojiScale.value }] }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardY.value }],
    opacity: cardOpacity.value,
  }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }));

  const onContinue = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('ManagerHub');
  };

  if (!queueVisible) return null;

  return (
    <Screen>
      <LinearGradient colors={cfg.gradColors} style={StyleSheet.absoluteFill} />

      <View style={styles.container}>
        {/* Club name & season badge */}
        {clubName ? (
          <Animated.View entering={FadeIn.duration(500)}>
            <View style={[styles.clubBadge, { borderColor: cfg.accentColor + '40' }]}>
              <Text style={[styles.clubBadgeText, { color: cfg.accentColor }]}>
                {clubName}
                {season ? ` · Season ${season}` : ''}
              </Text>
            </View>
          </Animated.View>
        ) : null}

        {/* Boardroom graphic */}
        <Animated.View entering={FadeIn.duration(600).delay(100)} style={styles.boardroomWrap}>
          <BoardroomSvg accentColor={cfg.accentColor} />
        </Animated.View>

        {/* Big emoji */}
        <Animated.View style={[styles.emojiWrap, emojiStyle]}>
          <Animated.View
            style={[styles.emojiGlow, { backgroundColor: cfg.accentColor }, pulseStyle]}
          />
          <Text style={styles.emoji}>{cfg.emoji}</Text>
        </Animated.View>

        {/* Content card */}
        <Animated.View style={[styles.card, cardStyle]}>
          <LinearGradient
            colors={[colors.surface + 'EE', colors.bgElevated + 'EE']}
            style={styles.cardInner}
          >
            <View
              style={[
                styles.kindChip,
                { backgroundColor: cfg.accentColor + '22', borderColor: cfg.accentColor + '50' },
              ]}
            >
              <Text style={[styles.kindChipText, { color: cfg.accentColor }]}>
                {kind === 'SACKED'
                  ? 'TERMINATION'
                  : kind === 'PRAISED'
                    ? 'BOARD VOTE OF CONFIDENCE'
                    : kind === 'WARNING'
                      ? 'FORMAL WARNING'
                      : 'CONTRACT RENEWAL'}
              </Text>
            </View>

            <Text style={styles.headline}>{cfg.headline}</Text>
            <Text style={styles.subheadline}>{cfg.subheadline}</Text>

            {/* Actual message from the board */}
            <View style={[styles.messageCard, { borderColor: cfg.accentColor + '30' }]}>
              <Text style={styles.messageLabel}>Board Statement</Text>
              <Text style={styles.messageText}>"{message}"</Text>
            </View>

            <Button
              label={cfg.ctaLabel}
              variant={cfg.ctaVariant}
              style={styles.cta}
              onPress={onContinue}
            />
          </LinearGradient>
        </Animated.View>
      </View>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
    },
    clubBadge: {
      borderWidth: 1,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      marginBottom: spacing.md,
    },
    clubBadgeText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    boardroomWrap: {
      marginBottom: spacing.sm,
      opacity: 0.7,
    },
    emojiWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
      position: 'relative',
    },
    emojiGlow: {
      position: 'absolute',
      width: 100,
      height: 100,
      borderRadius: 50,
      opacity: 0.2,
    },
    emoji: {
      fontSize: 64,
    },
    card: {
      width: '100%',
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.card,
    },
    cardInner: {
      padding: spacing.xl,
      alignItems: 'center',
    },
    kindChip: {
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      marginBottom: spacing.md,
    },
    kindChipText: {
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 1.5,
    },
    headline: {
      color: colors.text,
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    subheadline: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      marginBottom: spacing.lg,
      lineHeight: 20,
    },
    messageCard: {
      width: '100%',
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: 'rgba(255,255,255,0.04)',
      marginBottom: spacing.lg,
    },
    messageLabel: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: fontWeight.black,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: spacing.xs,
    },
    messageText: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontStyle: 'italic',
      lineHeight: 20,
    },
    cta: { width: '100%' },
  });
