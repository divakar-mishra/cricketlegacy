/**
 * DailyChallengeScreen — a scenario-based daily challenge.
 *
 * A new challenge is seeded from the current date, so every player faces the
 * same scenario. Completing it awards coins and can be "shared" (shows a
 * share card). The challenge uses the existing live match engine; once
 * completed the reward is minted and gated from re-claiming.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Button, Card, Screen, ScreenHeader, WalletBar } from '../components';
import { AppText as Text } from '../components/AppText';
import { DailyChallenge } from '../domain/types';
import { DAILY_CHALLENGE_REWARDS } from '../game/liveops';
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

const PITCH_LABEL: Record<string, string> = {
  GREEN: '🌿 Green',
  DRY: '☀️ Dry',
  DUSTY: '💨 Dusty',
  FLAT: '⚡ Flat Belter',
  CRACKED: '💥 Cracked',
};

const TIER_META = {
  BRONZE: { color: '#CD7F32', bg: '#3D2200', icon: '🥉', label: 'BRONZE' },
  SILVER: { color: '#B8BEC5', bg: '#1A1E22', icon: '🥈', label: 'SILVER' },
  GOLD: { color: '#E9B23B', bg: '#2A1E00', icon: '🥇', label: 'GOLD' },
};

/** Generate today's challenge seeded from YYYYMMDD. */
function generateDailyChallenge(): DailyChallenge {
  const now = new Date();
  const dateKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const seed = parseInt(dateKey, 10);
  const rng = (n: number) => (((seed * 16807 + n * 1103515245) & 0x7fffffff) % 1000) / 1000;

  const formats: DailyChallenge['format'][] = ['T20', 'T10', 'HUNDRED'];
  const pitches: DailyChallenge['pitchCondition'][] = ['GREEN', 'DRY', 'DUSTY', 'FLAT', 'CRACKED'];
  const tiers: DailyChallenge['rewardTier'][] = ['BRONZE', 'SILVER', 'GOLD'];

  const format = formats[Math.floor(rng(1) * formats.length)];
  const pitch = pitches[Math.floor(rng(2) * pitches.length)];
  const balls = format === 'T10' ? 8 : format === 'HUNDRED' ? 10 : 12;
  const base = format === 'T10' ? 16 : format === 'HUNDRED' ? 20 : 22;
  const target = base + Math.floor(rng(3) * 12);
  const tierIdx = Math.floor(rng(4) * tiers.length);
  const tier = tiers[tierIdx];
  const reward = DAILY_CHALLENGE_REWARDS[tier];

  const titles = [
    'Run Chase',
    'Power Surge',
    'Last Stand',
    'Clutch Factor',
    'Pressure Cooker',
    'Lightning Innings',
    'Blade Runner',
  ];
  const title = titles[Math.floor(rng(5) * titles.length)];

  return {
    dateKey,
    title,
    description: `Score ${target}+ runs off ${balls} balls in a ${format} scenario on a ${PITCH_LABEL[pitch]} surface.`,
    format,
    targetRuns: target,
    targetBalls: balls,
    pitchCondition: pitch,
    rewardCoins: reward.coins,
    rewardGems: reward.gems,
    rewardTier: tier,
  };
}

export function DailyChallengeScreen({ navigation }: ScreenProps<'DailyChallenge'>) {
  const save = useCareer((s) => s.save);
  const startDailyChallenge = useCareer((s) => s.startDailyChallenge);
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [challenge] = useState<DailyChallenge>(generateDailyChallenge);

  const alreadyCompleted = save?.dailyChallengeCompleted?.[challenge.dateKey] ?? false;
  const tierMeta = TIER_META[challenge.rewardTier];

  const onShare = useCallback(async () => {
    try {
      await Share.share({
        message: `I just completed today's Cricket Legacy Daily Challenge — "${challenge.title}"! 🏏 Score ${challenge.targetRuns}+ in ${challenge.targetBalls} balls. Can you beat it? #CricketLegacy`,
        title: 'Cricket Legacy Daily Challenge',
      });
    } catch {
      /* optional */
    }
  }, [challenge]);

  const onPlay = useCallback(() => {
    startDailyChallenge(challenge);
    // daily:true → MatchScreen builds a standalone scenario match that actually
    // uses this challenge's format + pitch condition (not the next league fixture).
    navigation.navigate('Match', { daily: true });
  }, [challenge, navigation, startDailyChallenge]);

  return (
    <Screen scroll gradient={gradients.pitch}>
      <ScreenHeader
        title="Daily Challenge"
        subtitle="Same challenge, every player, today"
        onBack={() => navigation.goBack()}
      />
      {save && <WalletBar wallet={save.wallet} />}

      {/* Header Banner */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <LinearGradient colors={[tierMeta.bg, colors.bg]} style={styles.heroBanner}>
          <View style={[styles.tierBadge, { borderColor: tierMeta.color }]}>
            <Text style={styles.tierIcon}>{tierMeta.icon}</Text>
            <Text style={[styles.tierLabel, { color: tierMeta.color }]}>
              {tierMeta.label} CHALLENGE
            </Text>
          </View>
          <Text style={styles.heroTitle}>{challenge.title}</Text>
          <Text style={styles.heroDate}>
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
        </LinearGradient>
      </Animated.View>

      {/* Challenge description */}
      <Animated.View entering={FadeInDown.duration(380).delay(80)}>
        <Card style={[styles.descCard, { borderColor: tierMeta.color + '44' }]}>
          <Text style={styles.descTitle}>Your Mission</Text>
          <Text style={styles.descText}>{challenge.description}</Text>

          <View style={styles.conditionsRow}>
            <View style={styles.condPill}>
              <Text style={styles.condIcon}>🏏</Text>
              <Text style={styles.condText}>{challenge.format}</Text>
            </View>
            <View style={styles.condPill}>
              <Text style={styles.condIcon}>🏟️</Text>
              <Text style={styles.condText}>{PITCH_LABEL[challenge.pitchCondition]}</Text>
            </View>
            <View style={styles.condPill}>
              <Text style={styles.condIcon}>🎯</Text>
              <Text style={styles.condText}>
                {challenge.targetRuns}+ in {challenge.targetBalls}b
              </Text>
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* Reward card */}
      <Animated.View entering={FadeInDown.duration(380).delay(160)}>
        <Card style={styles.rewardCard}>
          <Text style={styles.rewardTitle}>🎁 Reward on Completion</Text>
          <View style={styles.rewardRow}>
            {challenge.rewardCoins > 0 && (
              <View style={styles.rewardItem}>
                <Text style={styles.rewardItemIcon}>🪙</Text>
                <Text style={styles.rewardItemVal}>{challenge.rewardCoins}</Text>
                <Text style={styles.rewardItemLabel}>Coins</Text>
              </View>
            )}
            {challenge.rewardGems > 0 && (
              <View style={styles.rewardItem}>
                <Text style={styles.rewardItemIcon}>💎</Text>
                <Text style={styles.rewardItemVal}>{challenge.rewardGems}</Text>
                <Text style={styles.rewardItemLabel}>Gems</Text>
              </View>
            )}
            <View
              style={[
                styles.rewardTierBadge,
                { backgroundColor: `${tierMeta.color}22`, borderColor: tierMeta.color },
              ]}
            >
              <Text style={[styles.rewardTierText, { color: tierMeta.color }]}>
                {tierMeta.label}
              </Text>
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* Completion / CTA */}
      {alreadyCompleted ? (
        <Animated.View entering={ZoomIn.duration(200)} style={styles.completedCard}>
          <LinearGradient colors={[tierMeta.bg, colors.bg]} style={styles.completedGrad}>
            <Text style={styles.completedIcon}>{tierMeta.icon}</Text>
            <Text style={[styles.completedTitle, { color: tierMeta.color }]}>
              Challenge Complete!
            </Text>
            <Text style={styles.completedText}>
              +{challenge.rewardCoins} coins
              {challenge.rewardGems > 0 ? ` · +${challenge.rewardGems} 💎` : ''} claimed.
            </Text>
            <Button
              label="📤 Share Your Score"
              variant="secondary"
              style={{ marginTop: spacing.lg }}
              onPress={onShare}
            />
          </LinearGradient>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown.duration(380).delay(240)}>
          <Button
            label="▶  Play Challenge"
            variant="gold"
            style={{ marginTop: spacing.md }}
            onPress={onPlay}
          />
          <View style={styles.claimInfo}>
            <Text style={styles.claimInfoTitle}>Reward locked</Text>
            <Text style={styles.claimInfoText}>
              Complete the challenge in a match before a reward can be claimed.
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Community share prompt */}
      <Animated.View entering={FadeInDown.duration(380).delay(320)}>
        <Card style={styles.lbTeaser}>
          <Text style={styles.lbTeaserTitle}>🌍 Put your score out there</Text>
          <Text style={styles.lbTeaserText}>
            Challenge your rivals — share your result with #CricketLegacy and see who can beat it.
          </Text>
        </Card>
      </Animated.View>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    heroBanner: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginTop: spacing.md,
      alignItems: 'center',
    },
    tierBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderWidth: 1.5,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      marginBottom: spacing.md,
    },
    tierIcon: { fontSize: 16 },
    tierLabel: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    heroTitle: {
      color: colors.text,
      fontSize: fontSize.xxl + 4,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      textAlign: 'center',
    },
    heroDate: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
    descCard: { marginTop: spacing.md, borderWidth: 1 },
    descTitle: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      marginBottom: spacing.sm,
    },
    descText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 20,
      marginBottom: spacing.md,
    },
    conditionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    condPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    condIcon: { fontSize: 12 },
    condText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
    rewardCard: { marginTop: spacing.md },
    rewardTitle: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      marginBottom: spacing.md,
    },
    rewardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
    rewardItem: { alignItems: 'center' },
    rewardItemIcon: { fontSize: 28, marginBottom: 2 },
    rewardItemVal: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    rewardItemLabel: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    rewardTierBadge: {
      marginLeft: 'auto' as any,
      borderWidth: 1.5,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rewardTierText: { fontSize: fontSize.sm, fontWeight: fontWeight.black, letterSpacing: 0.5 },
    completedCard: { marginTop: spacing.md, borderRadius: radius.xl, overflow: 'hidden' },
    completedGrad: { padding: spacing.xl, alignItems: 'center' },
    completedIcon: { fontSize: 56, marginBottom: spacing.md },
    completedTitle: {
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    completedText: { color: colors.textMuted, fontSize: fontSize.md, marginTop: spacing.xs },
    claimInfo: {
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceAlt,
      padding: spacing.md,
    },
    claimInfoTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.heavy },
    claimInfoText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 17,
      marginTop: spacing.xs,
    },
    lbTeaser: { marginTop: spacing.md, marginBottom: spacing.xxl },
    lbTeaserTitle: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      marginBottom: spacing.xs,
    },
    lbTeaserText: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 18 },
  });
