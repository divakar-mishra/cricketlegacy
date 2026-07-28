/**
 * YouthGraduateCeremonyScreen — the moment a academy player earns their
 * senior debut. An emotional, cinematic screen that makes manager mode feel
 * personal. Every youth graduate you've developed should feel like *your* player.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import Svg, { Path, Polygon, Text as SvgText } from 'react-native-svg';
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
  useTheme,
  useThemedStyles,
} from '../theme';

// ─── Jersey number SVG ────────────────────────────────────────────────────────

function JerseyIcon({
  number,
  primaryColor,
  secondaryColor,
}: {
  number: number;
  primaryColor?: string;
  secondaryColor?: string;
}) {
  const bg = primaryColor ?? '#31A85A';
  const fg = secondaryColor ?? '#E9B23B';
  return (
    <Svg width={100} height={110} viewBox="0 0 100 110">
      {/* Jersey body */}
      <Path
        d="M20 20 L10 45 L25 50 L25 95 L75 95 L75 50 L90 45 L80 20 L65 25 C65 35 35 35 35 25 Z"
        fill={bg}
      />
      {/* Collar */}
      <Path d="M35 25 C35 35 65 35 65 25 L60 20 C60 28 40 28 40 20 Z" fill={fg} opacity={0.7} />
      {/* Shoulder stripes */}
      <Path d="M10 45 L20 20 L30 22" fill="none" stroke={fg} strokeWidth="3" opacity={0.5} />
      <Path d="M90 45 L80 20 L70 22" fill="none" stroke={fg} strokeWidth="3" opacity={0.5} />
      {/* Number */}
      <SvgText x="50" y="88" textAnchor="middle" fontSize="28" fontWeight="900" fill={fg}>
        {String(number)}
      </SvgText>
    </Svg>
  );
}

// ─── Confetti-style star burst ────────────────────────────────────────────────

function StarBurst({ color, x, y, delay }: { color: string; x: number; y: number; delay: number }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withSequence(withTiming(1, { duration: 300 }), withTiming(0, { duration: 600 })),
    );
    scale.value = withDelay(delay, withSpring(1.2, { damping: 6 }));
  }, [delay, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x,
    top: y,
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={style}>
      <Svg width={12} height={12} viewBox="0 0 12 12">
        <Polygon
          points="6,1 7.5,4.5 11,5 8.5,7.5 9,11 6,9.5 3,11 3.5,7.5 1,5 4.5,4.5"
          fill={color}
        />
      </Svg>
    </Animated.View>
  );
}

// ─── Debut quotes ─────────────────────────────────────────────────────────────

const DEBUT_MESSAGES = [
  'You spotted the talent. You nurtured it. Now watch it shine.',
  'From the academy to the first team — this is what you built.',
  'Three years of work. Now comes the reward.',
  'You saw something in them when nobody else did.',
  'The pitch is theirs now. This is your legacy.',
  'Every coach dreams of this moment. It belongs to you.',
];

// ─── Main screen ──────────────────────────────────────────────────────────────

export function YouthGraduateCeremonyScreen({
  navigation,
  route,
}: ScreenProps<'YouthGraduateCeremony'>) {
  const {
    playerName,
    role,
    overall,
    yearsInAcademy,
    jerseyNumber,
    teamName,
    primaryColor,
    secondaryColor,
  } = route.params;
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [messageIdx] = useState(Math.floor(Math.random() * DEBUT_MESSAGES.length));
  const jerseyScale = useSharedValue(0);
  const nameY = useSharedValue(30);
  const nameOpacity = useSharedValue(0);
  const pulse = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  const starPositions = [
    { x: 30, y: 80, color: colors.accent, delay: 500 },
    { x: 280, y: 100, color: colors.primary, delay: 700 },
    { x: 50, y: 250, color: colors.accent, delay: 900 },
    { x: 300, y: 240, color: '#4C9AFF', delay: 600 },
    { x: 160, y: 60, color: colors.accent, delay: 400 },
    { x: 80, y: 400, color: colors.primary, delay: 800 },
    { x: 260, y: 380, color: colors.accent, delay: 1000 },
    { x: 150, y: 440, color: '#4C9AFF', delay: 1100 },
  ];

  useEffect(() => {
    playHaptic('notify-success');
    setTimeout(() => playHaptic('impact-heavy'), 400);

    jerseyScale.value = withDelay(200, withSpring(1, { damping: 8, stiffness: 120 }));
    nameY.value = withDelay(600, withSpring(0, { damping: 14 }));
    nameOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
    pulse.value = withDelay(
      800,
      withRepeat(
        withSequence(withTiming(1.06, { duration: 900 }), withTiming(1, { duration: 900 })),
        -1,
        true,
      ),
    );
    glowOpacity.value = withDelay(
      300,
      withRepeat(
        withSequence(withTiming(0.5, { duration: 1000 }), withTiming(0.1, { duration: 1000 })),
        -1,
        true,
      ),
    );
  }, [glowOpacity, jerseyScale, nameOpacity, nameY, pulse]);

  const jerseyStyle = useAnimatedStyle(() => ({ transform: [{ scale: jerseyScale.value }] }));
  const nameStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: nameY.value }],
    opacity: nameOpacity.value,
  }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  const ROLE_LABEL: Record<string, string> = {
    BATTER: 'Batter',
    BOWLER: 'Bowler',
    ALLROUNDER: 'All-Rounder',
    WK_BATTER: 'Wicket-Keeper',
  };

  return (
    <Screen>
      <LinearGradient colors={['#050C08', '#0A1912', '#050C08']} style={StyleSheet.absoluteFill} />

      {/* Star burst particles */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {starPositions.map((sp, i) => (
          <StarBurst key={i} {...sp} />
        ))}
      </View>

      <View style={styles.container}>
        {/* Top label */}
        <Animated.View entering={FadeIn.duration(500)} style={styles.topLabel}>
          <Text style={styles.teamLabel}>{teamName}</Text>
          <Text style={styles.ceremonyLabel}>FIRST TEAM DEBUT</Text>
        </Animated.View>

        {/* Jersey with glow */}
        <Animated.View style={[styles.jerseyWrap, jerseyStyle]}>
          <Animated.View
            style={[
              styles.jerseyGlow,
              { backgroundColor: primaryColor ?? colors.primary },
              glowStyle,
            ]}
          />
          <Animated.View style={pulseStyle}>
            <JerseyIcon
              number={jerseyNumber ?? 99}
              primaryColor={primaryColor}
              secondaryColor={secondaryColor}
            />
          </Animated.View>
        </Animated.View>

        {/* Player name */}
        <Animated.View style={[styles.nameWrap, nameStyle]}>
          <Text style={styles.playerName}>{playerName}</Text>
          <Text style={styles.playerRole}>
            {ROLE_LABEL[role] ?? role} · Overall {overall}
          </Text>
        </Animated.View>

        {/* Academy stats card */}
        <Animated.View entering={ZoomIn.duration(400).delay(800)} style={styles.statsCard}>
          <LinearGradient
            colors={[colors.surface + 'EE', colors.bgElevated + 'EE']}
            style={styles.statsCardInner}
          >
            {/* Academy badge */}
            <View style={[styles.academyBadge, { borderColor: colors.primary + '50' }]}>
              <Text style={[styles.academyBadgeText, { color: colors.primary }]}>
                🎓 ACADEMY GRADUATE
              </Text>
            </View>

            <Text style={styles.statsTitle}>Academy Record</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.accent }]}>{yearsInAcademy}</Text>
                <Text style={styles.statLabel}>
                  {yearsInAcademy === 1 ? 'Year' : 'Years'} developed
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{overall}</Text>
                <Text style={styles.statLabel}>Overall rating</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.info }]}>
                  #{jerseyNumber ?? 99}
                </Text>
                <Text style={styles.statLabel}>Squad number</Text>
              </View>
            </View>

            {/* Coach message */}
            <View style={styles.quoteBlock}>
              <Text style={styles.quoteText}>{DEBUT_MESSAGES[messageIdx]}</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(400).delay(1200)} style={styles.cta}>
          <Button
            label="Send them out there"
            variant="primary"
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('ManagerHub');
            }}
          />
        </Animated.View>
      </View>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xxl,
    },
    topLabel: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    teamLabel: {
      color: colors.primary,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.heavy,
      letterSpacing: 0.5,
    },
    ceremonyLabel: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      letterSpacing: 4,
      marginTop: 2,
    },
    jerseyWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
      position: 'relative',
    },
    jerseyGlow: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      opacity: 0.15,
    },
    nameWrap: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    playerName: {
      color: colors.text,
      fontSize: fontSize.xxxl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      textAlign: 'center',
    },
    playerRole: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: spacing.xs,
    },
    statsCard: {
      width: '100%',
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.card,
      marginBottom: spacing.xl,
    },
    statsCardInner: {
      padding: spacing.xl,
      alignItems: 'center',
    },
    academyBadge: {
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      marginBottom: spacing.md,
    },
    academyBadgeText: {
      fontSize: 10,
      fontWeight: fontWeight.black,
      letterSpacing: 1.5,
    },
    statsTitle: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: spacing.md,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      marginBottom: spacing.lg,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    statLabel: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: 2,
      textAlign: 'center',
    },
    statDivider: {
      width: 1,
      height: 36,
      backgroundColor: colors.border,
    },
    quoteBlock: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
      width: '100%',
    },
    quoteText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontStyle: 'italic',
      textAlign: 'center',
      lineHeight: 20,
    },
    cta: { width: '100%' },
  });
