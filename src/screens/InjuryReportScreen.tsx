/**
 * InjuryReportScreen — cinematic injury announcement screen.
 * Replaces silent injury application with a proper "news bulletin" moment
 * that also drives gem-spend for fast-track recovery.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { playHaptic } from '../audio';
import { Button, Card, Screen, ScreenHeader } from '../components';
import { AppText as Text } from '../components/AppText';
import { MODAL_PRIORITY, useModalQueue } from '../context/ModalQueueContext';
import { ScreenProps } from '../navigation';
import { useCareer } from '../state/careerStore';
import {
  fonts,
  fontSize,
  fontWeight,
  radius,
  spacing,
  ThemeColors,
  useTheme,
  useThemedStyles,
} from '../theme';

// ─── Injury severity derived from weeks ──────────────────────────────────────

function getSeverity(weeks: number): { label: string; color: string; icon: string } {
  if (weeks <= 1) return { label: 'Minor knock', color: '#F5A524', icon: '🩹' };
  if (weeks <= 3) return { label: 'Moderate injury', color: '#E8852A', icon: '🤕' };
  if (weeks <= 6) return { label: 'Serious injury', color: '#E5484D', icon: '🏥' };
  return { label: 'Severe — long-term absence', color: '#C4362B', icon: '🚨' };
}

// ─── Medical cross SVG ────────────────────────────────────────────────────────

function MedicalIcon({ color }: { color: string }) {
  return (
    <Svg width={80} height={80} viewBox="0 0 80 80">
      {/* Outer shield */}
      <Path
        d="M40 6L14 16V38C14 56 40 74 40 74C40 74 66 56 66 38V16Z"
        fill={color}
        opacity={0.15}
      />
      <Path
        d="M40 12L18 21V38C18 53 40 69 40 69C40 69 62 53 62 38V21Z"
        fill={color}
        opacity={0.2}
      />
      {/* Cross */}
      <Rect x="33" y="24" width="14" height="32" rx="4" fill={color} opacity={0.9} />
      <Rect x="24" y="33" width="32" height="14" rx="4" fill={color} opacity={0.9} />
    </Svg>
  );
}

// ─── Timeline dot ─────────────────────────────────────────────────────────────

function TimelineItem({ week, label, done }: { week: number; label: string; done?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: done ? colors.success + '30' : colors.surfaceAlt,
          borderWidth: 1.5,
          borderColor: done ? colors.success : colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: done ? colors.success : colors.textFaint,
            fontSize: 10,
            fontWeight: '700',
          }}
        >
          {done ? '✓' : `W${week}`}
        </Text>
      </View>
      <Text style={{ color: done ? colors.success : colors.textMuted, fontSize: 13, flex: 1 }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function InjuryReportScreen({ navigation, route }: ScreenProps<'InjuryReport'>) {
  const { playerName, weeksOut, matchesMissed, nextMatchLabel, playerId } = route.params;
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const severity = getSeverity(weeksOut);
  const gems = useCareer((s) => s.save?.wallet.gems ?? 0);
  const recoverInjuryNow = useCareer((s) => s.recoverInjuryNow);
  const queueVisible = useModalQueue(true, MODAL_PRIORITY.critical, 'injury-report');

  const iconScale = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!queueVisible) return;
    playHaptic('notify-warning');
    iconScale.value = withDelay(80, withTiming(1, { duration: 200 }));
    pulse.value = withDelay(
      600,
      withRepeat(
        withSequence(withTiming(1.08, { duration: 700 }), withTiming(1, { duration: 700 })),
        -1,
        true,
      ),
    );
  }, [iconScale, pulse, queueVisible]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  // Recovery milestones
  const milestones: { week: number; label: string }[] = [];
  if (weeksOut >= 1) milestones.push({ week: 1, label: 'Initial treatment & scan results' });
  if (weeksOut >= 2)
    milestones.push({ week: Math.ceil(weeksOut * 0.4), label: 'Physio rehabilitation begins' });
  if (weeksOut >= 3)
    milestones.push({ week: Math.ceil(weeksOut * 0.7), label: 'Light training resumes' });
  milestones.push({ week: weeksOut, label: 'Cleared to play — return to squad' });

  const gemCost = Math.max(10, Math.min(50, weeksOut * 8));

  if (!queueVisible) return null;

  return (
    <Screen scroll gradient={['#1A0808', '#0F1912'] as any}>
      <ScreenHeader
        title="Injury Report"
        onBack={() => {
          if (navigation.canGoBack()) navigation.goBack();
        }}
      />

      <View style={styles.container}>
        {/* Medical icon */}
        <Animated.View style={[styles.iconWrap, iconStyle]}>
          <Animated.View
            style={[styles.iconGlow, { backgroundColor: severity.color }, pulseStyle]}
          />
          <MedicalIcon color={severity.color} />
        </Animated.View>

        {/* Breaking news style headline */}
        <Animated.View
          entering={FadeIn.duration(400).delay(300)}
          style={[
            styles.breakingBadge,
            { borderColor: severity.color + '60', backgroundColor: severity.color + '15' },
          ]}
        >
          <Text style={[styles.breakingText, { color: severity.color }]}>
            {severity.icon} {severity.label.toUpperCase()}
          </Text>
        </Animated.View>

        {/* Player name */}
        <Animated.View entering={FadeInDown.duration(350).delay(400)}>
          <Text style={styles.playerName}>{playerName}</Text>
          <Text style={styles.playerSub}>has picked up an injury</Text>
        </Animated.View>

        {/* Key stats */}
        <Animated.View entering={FadeInDown.duration(350).delay(500)} style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: severity.color }]}>{weeksOut}</Text>
            <Text style={styles.statLabel}>{weeksOut === 1 ? 'Week' : 'Weeks'} out</Text>
          </View>
          <View style={[styles.statDivider]} />
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: colors.warning }]}>{matchesMissed}</Text>
            <Text style={styles.statLabel}>{matchesMissed === 1 ? 'Match' : 'Matches'} missed</Text>
          </View>
          {nextMatchLabel ? (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text
                  style={[styles.statNum, { color: colors.textMuted, fontSize: fontSize.xs }]}
                  numberOfLines={2}
                >
                  {nextMatchLabel}
                </Text>
                <Text style={styles.statLabel}>Next match</Text>
              </View>
            </>
          ) : null}
        </Animated.View>

        {/* Recovery timeline */}
        <Animated.View entering={FadeInDown.duration(350).delay(600)}>
          <Card style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>Recovery timeline</Text>
            {milestones.map((m, i) => (
              <TimelineItem key={i} week={m.week} label={m.label} done={false} />
            ))}
          </Card>
        </Animated.View>

        {/* Fast-track recovery offer */}
        <Animated.View entering={FadeInDown.duration(350).delay(750)}>
          <LinearGradient colors={['#1A1A3D', '#0F0F28']} style={styles.fastTrackCard}>
            <View style={styles.fastTrackHeader}>
              <Text style={styles.fastTrackTitle}>⚡ Fast-track recovery</Text>
              <View style={styles.gemBadge}>
                <Text style={styles.gemBadgeText}>{gemCost}💎</Text>
              </View>
            </View>
            <Text style={styles.fastTrackDesc}>Full fitness today.</Text>
            <Button
              label={`Recover now — ${gemCost} gems`}
              variant="secondary"
              style={{ marginTop: spacing.md }}
              onPress={() => {
                // Not enough gems on hand → send them to the store to top up.
                if (gems < gemCost) {
                  navigation.navigate('Purchase');
                  return;
                }
                const res = recoverInjuryNow(playerId, gemCost);
                if (res.ok) {
                  playHaptic('notify-success');
                  if (navigation.canGoBack()) navigation.goBack();
                } else {
                  // Fall back to the store (e.g. gems changed since render).
                  navigation.navigate('Purchase');
                }
              }}
            />
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(300).delay(900)}>
          <Button
            label={`Accept — serve ${weeksOut} week${weeksOut > 1 ? 's' : ''} on sidelines`}
            variant="ghost"
            style={{ marginTop: spacing.sm }}
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
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
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    iconWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: spacing.xl,
      position: 'relative',
    },
    iconGlow: {
      position: 'absolute',
      width: 120,
      height: 120,
      borderRadius: 60,
      opacity: 0.15,
    },
    breakingBadge: {
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs,
      marginBottom: spacing.md,
    },
    breakingText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      letterSpacing: 1.5,
    },
    playerName: {
      color: colors.text,
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      textAlign: 'center',
    },
    playerSub: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      marginTop: spacing.xs,
      marginBottom: spacing.lg,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      width: '100%',
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statBox: {
      flex: 1,
      alignItems: 'center',
    },
    statNum: {
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
    },
    statDivider: {
      width: 1,
      height: 40,
      backgroundColor: colors.border,
    },
    timelineCard: {
      width: '100%',
      marginBottom: spacing.lg,
    },
    timelineTitle: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: spacing.md,
    },
    fastTrackCard: {
      width: '100%',
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1.5,
      borderColor: '#4C9AFF33',
      marginBottom: spacing.sm,
    },
    fastTrackHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    fastTrackTitle: {
      color: '#82BFFF',
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
    },
    gemBadge: {
      backgroundColor: '#4C9AFF22',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderWidth: 1,
      borderColor: '#4C9AFF50',
    },
    gemBadgeText: {
      color: '#4C9AFF',
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
    },
    fastTrackDesc: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 18,
      marginBottom: spacing.sm,
    },
    fastTrackBullets: {
      gap: 4,
    },
    fastTrackBullet: {
      color: colors.text,
      fontSize: fontSize.sm,
    },
  });
