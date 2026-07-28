/**
 * SeasonPassTeaser — inline banner on hub home tabs showing locked pass rewards
 * to non-pass holders. Creates FOMO and drives conversions.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { fontSize, fontWeight, radius, spacing, ThemeColors, useThemedStyles } from '../theme';
import { AppText as Text } from './AppText';

interface SeasonPassTeaserProps {
  currentTier: number;
  maxTier?: number;
  onPress: () => void;
  isPremium?: boolean;
}

const PREVIEW_REWARDS = [
  { tier: 5, label: '500 Coins', locked: true },
  { tier: 10, label: 'Premium Kit', locked: true },
  { tier: 15, label: '2× XP Boost', locked: true },
  { tier: 20, label: 'Legend Badge', locked: true },
];

function PassIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect x="1" y="7" width="30" height="18" rx="4" fill="#4C9AFF" />
      <Rect x="1" y="7" width="30" height="8" rx="4" fill="#82BFFF" />
      <Path d="M6 18h10v2H6zM6 22h7v1H6z" fill="white" opacity={0.6} />
      <Path d="M24 21l-4-2.5 4-2.5v5z" fill="#F7D06E" />
    </Svg>
  );
}

export function SeasonPassTeaser({
  currentTier,
  maxTier = 20,
  onPress,
  isPremium,
}: SeasonPassTeaserProps) {
  const styles = useThemedStyles(makeStyles);
  const progress = Math.min(currentTier / maxTier, 1);

  if (isPremium) {
    // Compact version for pass holders showing their progress
    return (
      <Animated.View entering={FadeInDown.duration(350)}>
        <Pressable onPress={onPress} style={styles.passCard}>
          <LinearGradient
            colors={['#1A3D5C', '#0F2238']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.passGradient}
          >
            <View style={styles.passHeader}>
              <PassIcon size={24} />
              <Text style={styles.passTitle}>Season Pass</Text>
              <Text style={styles.passLevel}>
                Tier {currentTier}/{maxTier}
              </Text>
            </View>
            <View style={styles.progressBg}>
              <LinearGradient
                colors={['#4C9AFF', '#82BFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${progress * 100}%` as any }]}
              />
            </View>
            <Text style={styles.passNextReward}>
              Next reward at Tier {Math.min(currentTier + 1, maxTier)}:{' '}
              {PREVIEW_REWARDS.find((r) => r.tier > currentTier)?.label ?? 'Max tier reached!'}
            </Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(200)}>
      <Pressable onPress={onPress}>
        <LinearGradient
          colors={['#0F2A3D', '#1A3D5C', '#0F2238']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.teaserCard}
        >
          {/* Header */}
          <View style={styles.teaserHeader}>
            <PassIcon size={32} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={styles.teaserBadge}>PREMIUM PASS</Text>
              <Text style={styles.teaserTitle}>Unlock exclusive rewards every tier</Text>
            </View>
            <View style={styles.pricePill}>
              <Text style={styles.priceText}>₹199</Text>
            </View>
          </View>

          {/* Reward preview row */}
          <View style={styles.rewardRow}>
            {PREVIEW_REWARDS.map((r) => (
              <View key={r.tier} style={styles.rewardItem}>
                <View style={styles.rewardLock}>
                  <Text style={styles.rewardLockIcon}>🔒</Text>
                </View>
                <Text style={styles.rewardLabel} numberOfLines={1}>
                  {r.label}
                </Text>
                <Text style={styles.rewardTier}>T{r.tier}</Text>
              </View>
            ))}
          </View>

          {/* Value prop */}
          <View style={styles.teaserFooter}>
            <Text style={styles.teaserFooterText}>
              ✦ 20 tiers of rewards ✦ Exclusive cosmetics ✦ Bonus coins
            </Text>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // Compact (premium holder) version
    passCard: {
      marginTop: spacing.md,
      borderRadius: radius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#4C9AFF33',
    },
    passGradient: {
      padding: spacing.md,
    },
    passHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    passTitle: {
      flex: 1,
      color: '#82BFFF',
      fontSize: fontSize.sm,
      fontWeight: fontWeight.heavy,
    },
    passLevel: {
      color: '#4C9AFF',
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
    },
    progressBg: {
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.1)',
      overflow: 'hidden',
      marginBottom: spacing.xs,
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
    },
    passNextReward: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: fontSize.xs,
      marginTop: 2,
    },

    // Teaser (non-holder) version
    teaserCard: {
      marginTop: spacing.md,
      borderRadius: radius.lg,
      overflow: 'hidden',
      padding: spacing.md,
      borderWidth: 1,
      borderColor: '#4C9AFF40',
    },
    teaserHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    teaserBadge: {
      color: '#4C9AFF',
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 1.5,
      marginBottom: 2,
    },
    teaserTitle: {
      color: colors.white,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
    },
    pricePill: {
      backgroundColor: '#4C9AFF',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    priceText: {
      color: colors.white,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
    },
    rewardRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    rewardItem: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: radius.sm,
      padding: spacing.sm,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    rewardLock: {
      marginBottom: 4,
    },
    rewardLockIcon: { fontSize: 14 },
    rewardLabel: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: 9,
      textAlign: 'center',
      lineHeight: 12,
    },
    rewardTier: {
      color: '#4C9AFF',
      fontSize: 9,
      fontWeight: fontWeight.bold,
      marginTop: 2,
    },
    teaserFooter: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(255,255,255,0.1)',
      paddingTop: spacing.sm,
    },
    teaserFooterText: {
      color: 'rgba(255,255,255,0.4)',
      fontSize: 10,
      textAlign: 'center',
      letterSpacing: 0.3,
    },
  });
