/**
 * Awards Night — cinematic end-of-season ceremony.
 * Awards are revealed one at a time with dramatic animations,
 * making season completion a genuine "moment" rather than a data screen.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  ZoomIn,
} from 'react-native-reanimated';
import { playHaptic } from '../audio';
import { Button, Screen, ScreenHeader } from '../components';
import { AppText as Text } from '../components/AppText';
import { AwardArtwork } from '../components/AwardArtwork';
import { buildAwardList, type Award } from '../components/awardPresentation';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { SaveGame } from '../domain/types';
import { standings } from '../game/season';
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

// ─── Award card data ──────────────────────────────────────────────────────────

// Award identities and statistics are resolved from canonical season state.

// ─── Individual award reveal component ───────────────────────────────────────

function AwardReveal({ award, index, save }: { award: Award; index: number; save: SaveGame }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const player = award.playerId ? save.players[award.playerId] : undefined;
  const ownPlayer = save.mode === 'career' && award.playerId === save.userPlayerId;

  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);
  const glow = useSharedValue(0.2);

  useEffect(() => {
    const delay = index * 200;
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    scale.value = withDelay(delay, withTiming(1, { duration: 200 }));
    glow.value = withDelay(
      delay + 400,
      withRepeat(
        withSequence(withTiming(0.8, { duration: 700 }), withTiming(0.2, { duration: 700 })),
        -1,
        true,
      ),
    );

    // Fire haptic on reveal
    if (delay === 0) {
      setTimeout(() => {
        playHaptic('impact-medium');
      }, 100);
    } else {
      setTimeout(() => {
        playHaptic('impact-light');
      }, delay + 100);
    }
  }, [glow, index, opacity, scale]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  return (
    <Animated.View style={[cardStyle, styles.awardCard]}>
      {/* Glow halo */}
      <Animated.View style={[styles.awardGlow, { backgroundColor: award.color }, glowStyle]} />

      <LinearGradient
        colors={[award.color + '22', colors.surface]}
        style={[styles.awardGradient, { borderColor: award.color }]}
      >
        {/* Illustrated award and the actual individual winner. Team awards stay team-owned. */}
        <Animated.View
          entering={ZoomIn.duration(400).delay(index * 200 + 250)}
          style={styles.awardArtworkRow}
        >
          <AwardArtwork kind={award.artwork} />
          {player ? <PlayerAvatar name={player.name} role={player.role} size="md"
            config={ownPlayer ? save.cosmetics?.avatarConfig : undefined}
            kitId={ownPlayer ? save.cosmetics?.kit : undefined}
            profileFrame={ownPlayer ? save.cosmetics?.profileFrame : undefined}
            testID={`award-winner-${award.playerId}`} /> : null}
        </Animated.View>

        {/* Award info */}
        <Animated.View entering={FadeInDown.duration(350).delay(index * 200 + 350)}>
          <Text style={[styles.awardTitle, { color: award.color }]}>{award.title}</Text>
          <Text style={styles.awardWinner}>{award.winner}</Text>
          <Text style={styles.awardStat}>{award.stat}</Text>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function AwardsNightScreen({ navigation }: ScreenProps<'AwardsNight'>) {
  const save = useCareer((s) => s.save);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [revealed, setRevealed] = useState(0);
  const [showContinue, setShowContinue] = useState(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const computedAwardList = useMemo(
    () => (save ? buildAwardList(save, colors) : []),
    [save, colors],
  );

  useEffect(() => {
    if (!save || computedAwardList.length === 0) return;
    playHaptic('notify-success');

    const revealNext = (idx: number) => {
      if (idx >= computedAwardList.length) {
        setTimeout(() => setShowContinue(true), 1200);
        return;
      }
      setRevealed(idx + 1);
      const isChampion = idx === 0;
      if (isChampion) {
        setTimeout(() => {
          playHaptic('impact-heavy');
          setTimeout(() => playHaptic('impact-medium'), 180);
          setTimeout(() => playHaptic('impact-light'), 350);
        }, 300);
      } else {
        setTimeout(() => playHaptic('impact-medium'), 250);
      }
      revealTimer.current = setTimeout(() => revealNext(idx + 1), 1100);
    };

    revealTimer.current = setTimeout(() => revealNext(0), 800);
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, [computedAwardList.length, save]);

  if (!save) {
    return (
      <Screen>
        <ScreenHeader title="Awards Night" onBack={() => navigation.goBack()} />
        <Text style={styles.msg}>No active season.</Text>
        <Button label="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const table = standings(save);
  const resultTeamId = save.mode === 'career' ? (save.franchiseTeamId ?? save.userTeamId) : save.userTeamId;
  const userTeam = resultTeamId ? save.teams[resultTeamId] : null;
  const userPos = table.findIndex(r => r.teamId === resultTeamId) + 1;
  const awardList = computedAwardList;

  return (
    <Screen scroll gradient={['#0D0A04', '#1A1305', '#0D0A04'] as any}>
      {/* Cinematic header */}
      <Animated.View entering={FadeIn.duration(800)} style={styles.header}>
        <LinearGradient
          colors={[colors.accent + '55', colors.accent + '22', 'transparent']}
          style={styles.headerGlow}
        />
        <Animated.View entering={FadeIn.duration(600).delay(200)}>
          <Text style={styles.headerSuper}>CRICKET LEGACY · END OF SEASON</Text>
        </Animated.View>
        <Animated.View entering={ZoomIn.duration(500).delay(400)}>
          <Text style={styles.headerTitle}>Awards Night</Text>
        </Animated.View>
        <Animated.View entering={FadeIn.duration(400).delay(800)}>
          <Text style={styles.headerStar}>✦ ✦ ✦</Text>
        </Animated.View>
      </Animated.View>

      {/* League position strip */}
      <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.positionStrip}>
        <Text style={styles.positionLabel}>YOUR FINISH</Text>
        <Text
          style={[
            styles.positionValue,
            {
              color:
                userPos === 1 ? colors.accent : userPos <= 4 ? colors.primary : colors.textMuted,
            },
          ]}
        >
          #{userPos} — {userTeam?.name ?? '—'}
        </Text>
      </Animated.View>

      {/* Awards, revealed one at a time */}
      <View style={styles.awardsGrid}>
        {awardList.slice(0, revealed).map((award, idx) => (
          <AwardReveal key={award.id} award={award} index={idx} save={save} />
        ))}
      </View>

      {/* Continue button */}
      {showContinue && (
        <Animated.View entering={FadeInDown.duration(400)} style={styles.continueWrap}>
          <Button
            label="Continue to New Season"
            variant="gold"
            onPress={() => navigation.goBack()}
          />
        </Animated.View>
      )}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    msg: { color: colors.textMuted, fontSize: fontSize.md, margin: spacing.xl },

    // Header
    header: {
      alignItems: 'center',
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
      position: 'relative',
      overflow: 'hidden',
    },
    headerGlow: {
      position: 'absolute',
      top: 0,
      left: -40,
      right: -40,
      bottom: 0,
      borderRadius: radius.xl,
    },
    headerSuper: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      letterSpacing: 3,
      textTransform: 'uppercase',
    },
    headerTitle: {
      color: colors.white,
      fontSize: 38,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      marginTop: 6,
      letterSpacing: 1,
    },
    headerStar: {
      color: colors.accent,
      fontSize: fontSize.lg,
      marginTop: spacing.sm,
      letterSpacing: 8,
    },

    // Position strip
    positionStrip: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    positionLabel: {
      color: colors.textFaint,
      fontSize: 10,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      fontWeight: fontWeight.bold,
    },
    positionValue: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      marginTop: 4,
    },

    // Awards grid
    awardsGrid: { gap: spacing.md },

    awardCard: {
      position: 'relative',
    },
    awardGlow: {
      position: 'absolute',
      top: 8,
      left: 8,
      right: 8,
      bottom: 8,
      borderRadius: radius.xl,
      zIndex: -1,
    },
    awardGradient: {
      borderRadius: radius.xl,
      borderWidth: 1.5,
      padding: spacing.lg,
      alignItems: 'center',
      gap: spacing.sm,
    },
    awardArtworkRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    awardTitle: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      letterSpacing: 2,
      textTransform: 'uppercase',
      textAlign: 'center',
    },
    awardWinner: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      textAlign: 'center',
      marginTop: 4,
    },
    awardStat: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      marginTop: 2,
    },

    // Continue
    continueWrap: { marginTop: spacing.xl, marginBottom: spacing.xxl },
  });
