/**
 * Season Pass Screen — visual tier ladder with free/premium tracks,
 * countdown timer, and contextual upgrade prompt.
 */
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import {
  Button,
  Card,
  ProgressBar,
  RewardModal,
  RewardModalData,
  Screen,
  ScreenHeader,
} from '../components';
import { AppText as Text } from '../components/AppText';
import { PUBLIC_RESOURCES, SUBSCRIPTION_MANAGEMENT_URLS } from '../config/legal';
import {
  claimablePassRewards,
  PASS_ITEM_LABELS,
  PASS_TIERS,
  passLevel,
  passTiersForMode,
  xpForTier,
} from '../game/liveops';
import { isSeasonPassActive, monthlyBundleForSave, SEASON_PASS_BENEFITS } from '../game/seasonPass';
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

function rewardLabel(r: { coins?: number; item?: string }): string {
  const parts: string[] = [];
  if (r.coins) parts.push(`🪙 ${r.coins} Coins`);
  if (r.item) parts.push(`🎁 1x ${PASS_ITEM_LABELS[r.item] ?? 'Pass item'}`);
  return parts.join(' + ');
}

async function openExternalLink(url: string, label: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(`Cannot open ${label}`, 'Check your connection and try again.');
  }
}

function SubscriptionPolicyLinks() {
  const styles = useThemedStyles(makeStyles);
  const nonReleaseBuild = typeof __DEV__ !== 'undefined' && __DEV__;
  const links = [
    { label: 'Privacy Policy', url: PUBLIC_RESOURCES.privacyPolicy },
    { label: 'Terms & Conditions', url: PUBLIC_RESOURCES.terms },
  ].filter((link) => link.url || nonReleaseBuild);

  if (links.length === 0) return null;
  return (
    <View style={styles.policyLinks}>
      {links.map(({ label, url }) => (
        <Pressable
          key={label}
          accessibilityRole="link"
          accessibilityLabel={label}
          accessibilityState={{ disabled: !url }}
          disabled={!url}
          onPress={() => url && void openExternalLink(url, label)}
          style={({ pressed }) => [
            styles.policyLink,
            !url && styles.policyLinkDisabled,
            pressed && styles.policyLinkPressed,
          ]}
        >
          <Text style={[styles.policyLinkText, !url && styles.policyLinkTextDisabled]}>
            {url ? label : `${label} · not configured`}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function SeasonPassScreen({ navigation }: ScreenProps<'SeasonPass'>) {
  const save = useCareer((s) => s.save);
  const claimPass = useCareer((s) => s.claimPass);
  const purchaseProduct = useCareer((s) => s.purchaseProduct);
  const refreshEnergy = useCareer((s) => s.refreshEnergy);
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [countdown, setCountdown] = useState(0);
  const [localizedPrice, setLocalizedPrice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimFlash, setClaimFlash] = useState<string | null>(null);
  const [rewardModal, setRewardModal] = useState<RewardModalData | null>(null);
  const [showFullTrack, setShowFullTrack] = useState(false);
  const [showPassInfo, setShowPassInfo] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshEnergy();
    }, [refreshEnergy]),
  );

  useEffect(() => {
    const update = () => {
      const remainingMs = (save?.pass?.periodEndsAt ?? Date.now()) - Date.now();
      setCountdown(Math.max(0, Math.floor(remainingMs / 1000)));
    };
    update();
    const id = setInterval(update, 15_000);
    return () => {
      clearInterval(id);
    };
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
  const modeTiers = passTiersForMode(save.mode);
  const monthlyBundle = monthlyBundleForSave(save);
  const level = passLevel(pass.xp);
  const nextTier = modeTiers.find((t) => t.tier === level + 1);
  const xpProgress = nextTier ? pass.xp - xpForTier(level) : 0;
  const xpNeeded = nextTier ? nextTier.xpRequired - xpForTier(level) : 1;
  const claimable = claimablePassRewards(pass);
  const hasClaimable = claimable.length > 0;
  const freeClaimedSet = new Set(pass.claimedFree);
  const premiumClaimedSet = new Set(pass.claimedPremium);
  const modeLabel = save.mode === 'manager' ? 'Manager' : 'Player';
  const compactTrackStart = Math.max(0, Math.min(level - 1, PASS_TIERS.length - 3));
  const visibleTiers = showFullTrack
    ? modeTiers
    : modeTiers.slice(compactTrackStart, compactTrackStart + 3);
  const monthlyRewardLine =
    save.mode === 'manager'
      ? `${monthlyBundle.office.label} · ${monthlyBundle.scenario.title}`
      : `${monthlyBundle.kit.label} · ${monthlyBundle.celebration.label}`;

  const onClaim = () => {
    if (claimBusy) return;
    setClaimBusy(true);
    const r = claimPass();
    if (r.count > 0) {
      setClaimFlash(`${r.count} track reward${r.count === 1 ? '' : 's'} claimed`);
      setRewardModal({
        title: 'Season Pass reward claimed',
        subtitle: `${r.count} track reward${r.count === 1 ? '' : 's'} added`,
        items: r.items,
        balances: [`Coins: ${r.previousCoins.toLocaleString()} -> ${r.newCoins.toLocaleString()}`],
        icon: 'trophy',
      });
      setTimeout(() => setClaimFlash(null), 3000);
    }
    setClaimBusy(false);
  };

  const onUpgrade = async () => {
    if (!localizedPrice) return;
    setBusy(true);
    await purchaseProduct('season_pass');
    setBusy(false);
  };

  const subscriptionManagementUrl =
    Platform.OS === 'ios' ? SUBSCRIPTION_MANAGEMENT_URLS.ios : SUBSCRIPTION_MANAGEMENT_URLS.android;
  const storeName = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

  return (
    <>
      <Screen scroll gradient={gradients.pitch}>
        <ScreenHeader
          title="Season Pass"
          subtitle={`${modeLabel} Career · separate save progress`}
          onBack={() => navigation.goBack()}
        />

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
                {premiumActive ? `Premium ${modeLabel} Pass` : `${modeLabel} Pass`}
              </Text>
              <Text
                style={[
                  styles.heroSub,
                  { color: premiumActive ? 'rgba(0,0,0,0.65)' : colors.textMuted },
                ]}
              >
                Tier {level} of {PASS_TIERS.length} · resets in {fmtCountdown(countdown)}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {premiumActive ? (
          <Button
            label="Manage subscription"
            variant="secondary"
            size="sm"
            style={{ marginTop: spacing.sm }}
            onPress={() =>
              void openExternalLink(subscriptionManagementUrl, `${storeName} subscriptions`)
            }
          />
        ) : null}

        {/* XP Progress */}
        {nextTier && (
          <Animated.View entering={FadeInDown.duration(380).delay(60)} style={styles.xpBox}>
            <View style={styles.xpRow}>
              <Text style={styles.xpLabel}>Next · Tier {level + 1}</Text>
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

        <Animated.View entering={FadeInDown.duration(360).delay(70)}>
          <Card
            style={styles.monthCard}
            onPress={() => navigation.navigate('PremiumClubhouse')}
            accessibilityLabel={`${monthlyBundle.title} monthly Season Pass collection. Open Clubhouse.`}
          >
            <View style={styles.monthCardRow}>
              <View style={styles.monthCardCopy}>
                <Text style={styles.monthEyebrow}>THIS MONTH</Text>
                <Text style={styles.monthTitle}>{monthlyBundle.title}</Text>
                <Text style={styles.monthReward} numberOfLines={1}>
                  {monthlyRewardLine}
                </Text>
              </View>
              <Text style={styles.monthAction}>CLUBHOUSE →</Text>
            </View>
          </Card>
        </Animated.View>

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
        <Text style={styles.section}>Rewards</Text>

        {/* Premium unlock prompt */}
        {!premiumActive && (
          <Animated.View entering={FadeInDown.duration(320).delay(100)}>
            <Card style={styles.upgradeCard}>
              <View style={styles.upgradeTitleRow}>
                <Text style={styles.upgradeTitle}>Premium Track</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassInfo ? 'Hide Season Pass details' : 'Show Season Pass details'
                  }
                  onPress={() => setShowPassInfo((shown) => !shown)}
                  hitSlop={10}
                  style={styles.infoButton}
                >
                  <Text style={styles.infoButtonText}>i</Text>
                </Pressable>
              </View>
              <Text style={styles.subscriptionDisclosure}>
                {localizedPrice ? `${localizedPrice}/month · 30 days` : 'Monthly price unavailable'}
                {' · '}Auto-renews until canceled.
              </Text>
              {showPassInfo ? (
                <View style={styles.passInfoPanel}>
                  <Text style={styles.passInfoLine}>
                    • One subscription unlocks Premium across every save
                  </Text>
                  <Text style={styles.passInfoLine}>
                    • Premium rewards for tiers earned in this save
                  </Text>
                  <Text style={styles.passInfoLine}>• Ads removed while the pass is active</Text>
                  <Text style={styles.passInfoLine}>• League and club naming editor</Text>
                  {save.mode === 'manager' ? (
                    <>
                      <Text style={styles.passInfoLine}>
                        • {Math.round(SEASON_PASS_BENEFITS.staffSigningDiscount * 100)}% staff
                        signing discount
                      </Text>
                      <Text style={styles.passInfoLine}>
                        • +{Math.round(SEASON_PASS_BENEFITS.superstarInterestBonus * 100)}%
                        superstar interest
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.passInfoLine}>
                        • +{Math.round((SEASON_PASS_BENEFITS.trainingGrowthMultiplier - 1) * 100)}%
                        paid training growth
                      </Text>
                      <Text style={styles.passInfoLine}>
                        • +
                        {Math.round(
                          (SEASON_PASS_BENEFITS.positiveSelectionRepMultiplier - 1) * 100,
                        )}
                        % positive selection reputation
                      </Text>
                    </>
                  )}
                  <Text style={styles.passInfoFine}>
                    Does not grant wins, selection or trophies.
                  </Text>
                </View>
              ) : null}
              <Button
                label={busy ? 'Processing…' : `Subscribe · ${localizedPrice ?? 'Unavailable'}`}
                variant="gold"
                loading={busy}
                disabled={!localizedPrice}
                style={{ marginTop: spacing.md }}
                onPress={() => void onUpgrade()}
              />
              <SubscriptionPolicyLinks />
            </Card>
          </Animated.View>
        )}

        <Button
          label={showFullTrack ? 'Show nearby tiers' : 'View all 20 tiers'}
          variant="secondary"
          size="sm"
          style={{ marginTop: spacing.md }}
          onPress={() => setShowFullTrack((shown) => !shown)}
        />

        <View style={styles.ladder}>
          {visibleTiers.map((tier, idx) => {
            const reached = level >= tier.tier;
            const current = level + 1 === tier.tier;
            const freeClaimed = freeClaimedSet.has(tier.tier);
            const premClaimed = premiumClaimedSet.has(tier.tier);
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
                    <Text
                      style={[
                        styles.tierBadgeNum,
                        { color: reached || current ? colors.white : colors.textFaint },
                      ]}
                    >
                      {tier.tier}
                    </Text>
                  </View>

                  <View style={styles.tierContent}>
                    {/* Free track */}
                    <View style={[styles.rewardRow, freeClaimed && styles.rewardClaimed]}>
                      <Text style={styles.rewardTrackLabel}>Free</Text>
                      <Text style={[styles.rewardText, freeClaimed && styles.rewardTextClaimed]}>
                        {rewardLabel(tier.freeReward)}
                      </Text>
                      <Text
                        style={[
                          styles.rewardStatus,
                          freeClaimed
                            ? { color: colors.success }
                            : reached
                              ? { color: colors.accent }
                              : undefined,
                        ]}
                      >
                        {freeClaimed ? '✓' : reached ? 'Claim' : `${tier.xpRequired} XP`}
                      </Text>
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
                      <Text
                        style={[
                          styles.rewardStatus,
                          premiumActive && premClaimed
                            ? { color: colors.success }
                            : premiumActive && reached
                              ? { color: colors.accent }
                              : undefined,
                        ]}
                      >
                        {!premiumActive
                          ? '🔒'
                          : premClaimed
                            ? '✓'
                            : reached
                              ? 'Claim'
                              : `${tier.xpRequired} XP`}
                      </Text>
                    </View>
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </View>
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
    xpBox: {
      marginTop: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    monthCard: { marginTop: spacing.md, borderColor: colors.primary },
    monthCardRow: { flexDirection: 'row', alignItems: 'center', minWidth: 0 },
    monthCardCopy: { flex: 1, minWidth: 0 },
    monthEyebrow: {
      color: colors.primary,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      letterSpacing: 1,
    },
    monthTitle: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      marginTop: 2,
    },
    monthReward: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    monthAction: {
      color: colors.accent,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      marginLeft: spacing.sm,
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
    xpHint: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.xs },
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
    upgradeTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    upgradeTitle: { color: colors.accent, fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    infoButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoButtonText: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    subscriptionDisclosure: {
      color: colors.text,
      fontSize: fontSize.xs,
      lineHeight: 17,
      marginTop: spacing.sm,
    },
    passInfoPanel: {
      marginTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.sm,
      gap: 3,
    },
    passInfoLine: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 17 },
    passInfoFine: { color: colors.textFaint, fontSize: 10, marginTop: 2 },
    policyLinks: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    policyLink: { paddingVertical: spacing.xs },
    policyLinkDisabled: { opacity: 0.55 },
    policyLinkPressed: { opacity: 0.72 },
    policyLinkText: {
      color: colors.info,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      textDecorationLine: 'underline',
    },
    policyLinkTextDisabled: { color: colors.textFaint, textDecorationLine: 'none' },
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
    tierBadgeNum: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    tierContent: { flex: 1, gap: 3 },
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
    rewardStatus: {
      color: colors.textFaint,
      fontSize: 9,
      fontWeight: fontWeight.semibold,
      textAlign: 'right',
    },
  });
