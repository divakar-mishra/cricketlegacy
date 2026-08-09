/**
 * Season Pass Screen — visual tier ladder with free/premium tracks,
 * countdown timer, and contextual upgrade prompt.
 */
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import {
  Button,
  Card,
  ProgressBar,
  RewardModal,
  RewardModalData,
  Screen,
  ScreenHeader,
  WalletBar,
} from '../components';
import { AppText as Text } from '../components/AppText';
import {
  claimablePassRewards,
  PASS_ITEM_LABELS,
  PASS_TIERS,
  passLevel,
  xpForTier,
} from '../game/liveops';
import { daysRemaining, isSeasonPassActive, SEASON_PASS_DAYS } from '../game/seasonPass';
import { ScreenProps } from '../navigation';
import { purchases } from '../services';
import { useCareer } from '../state/careerStore';
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

function fmtCountdown(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function rewardLabel(r: { coins?: number; gems?: number; item?: string }): string {
  const parts: string[] = [];
  if (r.coins) parts.push(`🪙 ${r.coins} Coins`);
  if (r.gems) parts.push(`💎 ${r.gems} Gems`);
  if (r.item) parts.push(`🎁 1x ${PASS_ITEM_LABELS[r.item] ?? 'Pass item'}`);
  return parts.join(' + ');
}

export function SeasonPassScreen({ navigation }: ScreenProps<'SeasonPass'>) {
  const save = useCareer((s) => s.save);
  const claimPass = useCareer((s) => s.claimPass);
  const purchaseProduct = useCareer((s) => s.purchaseProduct);
  const refreshEnergy = useCareer((s) => s.refreshEnergy);
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [countdown, setCountdown] = useState(0);
  const [localizedPrice, setLocalizedPrice] = useState('Google Play price');
  const [busy, setBusy] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimFlash, setClaimFlash] = useState<string | null>(null);
  const [rewardModal, setRewardModal] = useState<RewardModalData | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshEnergy();
    }, [refreshEnergy]),
  );

  useEffect(() => {
    const update = () =>
      setCountdown(
        Math.max(0, Math.floor(((save?.pass?.periodEndsAt ?? Date.now()) - Date.now()) / 1000)),
      );
    update();
    const id = setInterval(update, 15_000);
    return () => clearInterval(id);
  }, [save?.pass?.periodEndsAt]);

  useEffect(() => {
    let alive = true;
    purchases.getProducts().then((products) => {
      const passProduct = products.find((product) => product.id === 'season_pass');
      if (alive && passProduct && purchases.isProductAvailable(passProduct)) {
        setLocalizedPrice(passProduct.priceString);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!save || !save.pass) {
    return (
      <Screen>
        <ScreenHeader title="Season Pass" onBack={() => navigation.goBack()} />
        <Text style={styles.empty}>No active season. Start a career or manager game first.</Text>
      </Screen>
    );
  }

  const pass = save.pass;
  const premiumActive = isSeasonPassActive(save);
  const level = passLevel(pass.xp);
  const nextTier = PASS_TIERS.find((t) => t.tier === level + 1);
  const xpProgress = nextTier ? pass.xp - xpForTier(level) : 0;
  const xpNeeded = nextTier ? nextTier.xpRequired - xpForTier(level) : 1;
  const claimable = claimablePassRewards(pass);
  const hasClaimable = claimable.length > 0;

  const onClaim = () => {
    if (claimBusy) return;
    setClaimBusy(true);
    const r = claimPass();
    if (r.count > 0) {
      setClaimFlash(`+${r.coins} coins${r.gems ? ` +${r.gems} gems` : ''} claimed!`);
      setRewardModal({
        title: 'Season Pass reward claimed',
        subtitle: `${r.count} reward${r.count === 1 ? '' : 's'} added`,
        items: r.items,
        balances: [
          `Coins: ${r.previousCoins.toLocaleString()} -> ${r.newCoins.toLocaleString()}`,
          `Gems: ${r.previousGems.toLocaleString()} -> ${r.newGems.toLocaleString()}`,
        ],
        icon: 'trophy',
      });
      setTimeout(() => setClaimFlash(null), 3000);
    }
    setClaimBusy(false);
  };

  const onUpgrade = async () => {
    setBusy(true);
    await purchaseProduct('season_pass');
    setBusy(false);
  };

  return (
    <>
      <Screen scroll gradient={gradients.pitch}>
        <ScreenHeader
          title="Season Pass"
          subtitle="Earn rewards every match"
          onBack={() => navigation.goBack()}
        />

        <WalletBar wallet={save.wallet} />

        <View style={styles.editorBand}>
          <View style={styles.editorCopy}>
            <Text style={styles.editorTitle}>Your domestic cricket world</Text>
            <Text style={styles.editorText}>
              Rename leagues and clubs across this save while Premium Pass is active.
              {save.mode === 'manager'
                ? ' Manager matches and transfer quests also earn pass XP.'
                : ' Match, training and story progress all feed the same reward track.'}
            </Text>
          </View>
          <Button
            label="Open Editor"
            variant={premiumActive ? 'secondary' : 'ghost'}
            size="sm"
            fullWidth={false}
            onPress={() => navigation.navigate('LeagueEditor')}
          />
        </View>

        <View style={styles.editorBand}>
          <View style={styles.editorCopy}>
            <Text style={styles.editorTitle}>Premium Clubhouse</Text>
            <Text style={styles.editorText}>
              Three new monthly cosmetics, a unique collectible, rotating scenarios, two-part Player
              and Manager stories, presentation themes and analytics.
            </Text>
          </View>
          <Button
            label="Open"
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={() => navigation.navigate('PremiumClubhouse')}
          />
        </View>

        {/* Header card */}
        <Animated.View entering={FadeInDown.duration(350)}>
          <LinearGradient
            colors={
              premiumActive
                ? [colors.accent, colors.accentDark]
                : [colors.surface, colors.surfaceAlt]
            }
            style={[styles.heroCard, shadow.card]}
          >
            <View style={styles.heroLeft}>
              <Text
                style={[styles.heroTitle, { color: premiumActive ? colors.black : colors.text }]}
              >
                {premiumActive ? 'Premium Pass' : 'Free Pass'}
              </Text>
              <Text
                style={[
                  styles.heroSub,
                  { color: premiumActive ? 'rgba(0,0,0,0.65)' : colors.textMuted },
                ]}
              >
                Season resets in {fmtCountdown(countdown)} · 30-day reward cycle
              </Text>
              <Text
                style={[styles.heroLevel, { color: premiumActive ? colors.black : colors.accent }]}
              >
                Tier {level} / {PASS_TIERS.length}
              </Text>
              {premiumActive && (
                <Text style={[styles.heroSub, { color: 'rgba(0,0,0,0.65)' }]}>
                  Subscription access: {daysRemaining(save)} day(s) remaining
                </Text>
              )}
            </View>
            {!premiumActive && (
              <Button
                label={busy ? 'Upgrading…' : `${localizedPrice} / month`}
                variant="gold"
                size="sm"
                fullWidth={false}
                loading={busy}
                onPress={() => void onUpgrade()}
              />
            )}
          </LinearGradient>
        </Animated.View>

        {/* XP Progress */}
        {nextTier && (
          <Animated.View entering={FadeInDown.duration(380).delay(60)} style={styles.xpBox}>
            <View style={styles.xpRow}>
              <Text style={styles.xpLabel}>Progress to Tier {level + 1}</Text>
              <Text style={styles.xpValue}>
                {pass.xp} / {nextTier.xpRequired} XP
              </Text>
            </View>
            <ProgressBar
              value={xpProgress / xpNeeded}
              color={colors.accent}
              style={{ marginTop: spacing.xs }}
            />
          </Animated.View>
        )}

        {/* Claim button */}
        {hasClaimable && (
          <Animated.View entering={FadeInDown.duration(340).delay(80)}>
            <Button
              label={`🎁 Claim ${claimable.length} reward${claimable.length > 1 ? 's' : ''}`}
              variant="gold"
              style={{ marginTop: spacing.md }}
              loading={claimBusy}
              disabled={claimBusy}
              onPress={onClaim}
            />
          </Animated.View>
        )}
        {claimFlash && (
          <Animated.View entering={FadeInDown.duration(250)} style={styles.flashRow}>
            <Text style={styles.flashText}>{claimFlash}</Text>
          </Animated.View>
        )}

        {/* Tier ladder */}
        <Text style={styles.section}>Reward Track</Text>
        <Text style={styles.trackHint}>
          Play matches, complete quests and win titles to earn XP.
        </Text>

        {/* Premium unlock prompt */}
        {!premiumActive && (
          <Animated.View entering={FadeInDown.duration(320).delay(100)}>
            <Card style={styles.upgradeCard}>
              <Text style={styles.upgradeTitle}>Unlock Premium</Text>
              <Text style={styles.upgradeSub}>
                {SEASON_PASS_DAYS} days of premium tier rewards, permanent earned cosmetics, a
                monthly collectible, rotating scenarios, fresh story chains, Manager services,
                naming tools and ad-free play. Existing tier progress unlocks immediately.
              </Text>
              <Button
                label={busy ? 'Processing…' : `Subscribe · ${localizedPrice}`}
                variant="gold"
                loading={busy}
                style={{ marginTop: spacing.md }}
                onPress={() => void onUpgrade()}
              />
            </Card>
          </Animated.View>
        )}

        <View style={styles.ladder}>
          {PASS_TIERS.map((tier, idx) => {
            const reached = level >= tier.tier;
            const current = level + 1 === tier.tier;
            const freeClaimedSet = new Set(pass.claimedFree);
            const premClaimedSet = new Set(pass.claimedPremium);
            const freeClaimed = freeClaimedSet.has(tier.tier);
            const premClaimed = premClaimedSet.has(tier.tier);
            const isMilestone = Boolean(tier.premiumReward.item);

            return (
              <Animated.View key={tier.tier} entering={FadeInRight.duration(280).delay(idx * 25)}>
                <View
                  style={[
                    styles.tierRow,
                    current && styles.tierRowCurrent,
                    isMilestone && styles.tierRowMilestone,
                  ]}
                >
                  {/* Tier badge */}
                  <View
                    style={[
                      styles.tierBadge,
                      reached ? styles.tierBadgeReached : styles.tierBadgeLocked,
                      current && styles.tierBadgeCurrent,
                    ]}
                  >
                    {reached ? (
                      <Text style={styles.tierBadgeCheck}>✓</Text>
                    ) : (
                      <Text
                        style={[
                          styles.tierBadgeNum,
                          { color: current ? colors.accent : colors.textFaint },
                        ]}
                      >
                        {tier.tier}
                      </Text>
                    )}
                  </View>

                  <View style={styles.tierContent}>
                    {isMilestone && <Text style={styles.milestoneLabel}>Milestone</Text>}

                    {/* Free track */}
                    <View style={[styles.rewardRow, freeClaimed && styles.rewardClaimed]}>
                      <Text style={styles.rewardTrackLabel}>Free</Text>
                      <Text style={[styles.rewardText, freeClaimed && styles.rewardTextClaimed]}>
                        {rewardLabel(tier.freeReward)}
                      </Text>
                      {freeClaimed && <Text style={styles.rewardDone}>✓</Text>}
                    </View>

                    {/* Premium track */}
                    <View
                      style={[
                        styles.rewardRow,
                        styles.rewardRowPrem,
                        premClaimed && styles.rewardClaimed,
                        !premiumActive && styles.rewardLocked,
                      ]}
                    >
                      <Text
                        style={[
                          styles.rewardTrackLabel,
                          { color: premiumActive ? colors.accent : colors.textFaint },
                        ]}
                      >
                        Prem
                      </Text>
                      <Text
                        style={[
                          styles.rewardText,
                          !premiumActive && { color: colors.textFaint },
                          premClaimed && styles.rewardTextClaimed,
                        ]}
                      >
                        {rewardLabel(tier.premiumReward)}
                      </Text>
                      {premiumActive && premClaimed && <Text style={styles.rewardDone}>✓</Text>}
                      {!premiumActive && <Text style={styles.lockIcon}>Locked</Text>}
                    </View>
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </View>

        <Text style={styles.footNote}>
          XP sources: +50 per match · +40 per win · +100 per daily quest · +300 per weekly quest
        </Text>
      </Screen>
      <RewardModal data={rewardModal} onClose={() => setRewardModal(null)} />
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    empty: {
      color: colors.textMuted,
      fontSize: fontSize.md,
      margin: spacing.xl,
      textAlign: 'center',
    },
    heroCard: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.md,
    },
    heroLeft: { flex: 1 },
    heroTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black, fontFamily: fonts.display },
    heroSub: { fontSize: fontSize.xs, marginTop: 2 },
    heroLevel: { fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: spacing.sm },
    xpBox: {
      marginTop: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    editorBand: {
      marginTop: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    editorCopy: { flex: 1 },
    editorTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    editorText: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 17, marginTop: 3 },
    xpRow: { flexDirection: 'row', justifyContent: 'space-between' },
    xpLabel: { color: colors.textMuted, fontSize: fontSize.sm },
    xpValue: { color: colors.accent, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    section: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.xl,
      marginBottom: spacing.xs,
    },
    trackHint: { color: colors.textFaint, fontSize: fontSize.xs, marginBottom: spacing.md },
    upgradeCard: { borderColor: colors.accent, borderWidth: 1.5 },
    upgradeTitle: { color: colors.accent, fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    upgradeSub: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: spacing.xs,
      lineHeight: 18,
    },
    flashRow: { marginTop: spacing.sm, alignItems: 'center' },
    flashText: { color: colors.success, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    ladder: { gap: 2 },
    tierRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    tierRowCurrent: { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
    tierRowMilestone: { borderColor: colors.primary },
    tierBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    tierBadgeReached: { backgroundColor: colors.primaryDark, borderColor: colors.primary },
    tierBadgeLocked: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
    tierBadgeCurrent: { borderColor: colors.accent },
    tierBadgeCheck: { color: colors.white, fontSize: fontSize.sm, fontWeight: fontWeight.black },
    tierBadgeNum: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    tierContent: { flex: 1, gap: 3 },
    milestoneLabel: {
      color: colors.primary,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    rewardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    rewardRowPrem: { marginTop: 1 },
    rewardClaimed: { opacity: 0.5 },
    rewardLocked: { opacity: 0.6 },
    rewardTrackLabel: {
      color: colors.textFaint,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      width: 36,
    },
    rewardText: { color: colors.text, fontSize: fontSize.xs, flex: 1 },
    rewardTextClaimed: { textDecorationLine: 'line-through', color: colors.textFaint },
    rewardDone: { color: colors.success, fontSize: fontSize.xs },
    lockIcon: { fontSize: 10 },
    footNote: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      textAlign: 'center',
      marginTop: spacing.xl,
      lineHeight: 16,
      paddingHorizontal: spacing.md,
    },
  });
