/**
 * Premium Store Screen — designed to feel like a first-class game store.
 * Custom SVG-style icons, countdown scarcity timer on starter pack,
 * social proof, gem sinks list, and full product hierarchy.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Svg, Circle, Path, Rect } from 'react-native-svg';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { AppText as Text } from '../components/AppText';
import {
  Button,
  Card,
  GlassSurface,
  Screen,
  ScreenHeader,
  Skeleton,
  WalletBar,
} from '../components';
import { ScreenProps } from '../navigation';
import { accountPurchases, ads, purchases } from '../services';
import { ECONOMY } from '../data/gameConfig';
import { areAdsRemoved } from '../game/economy';
import { contractOffer, weeklyWage } from '../game/career';
import { formatClubCurrency } from '../game/finance';
import { facilityUpgradeCost } from '../game/manager';
import { isSeasonPassActive } from '../game/seasonPass';
import { useIsCompact } from '../hooks/useResponsive';
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

// ─── SVG Icon components (replaces emoji) ────────────────────────────────────

function CoinIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Circle cx="16" cy="16" r="14" fill="#E9B23B" />
      <Circle cx="16" cy="16" r="11" fill="#C6902A" />
      <Circle cx="16" cy="16" r="9" fill="#F7D06E" />
      <Path d="M14 11h4v2h-1v6h1v2h-4v-2h1v-6h-1z" fill="#8A5D08" />
    </Svg>
  );
}

function GemIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path d="M6 13L16 4L26 13L16 28Z" fill="#4C9AFF" />
      <Path d="M6 13L16 4L26 13" fill="#82BFFF" />
      <Path d="M11 13L16 4L21 13" fill="#B4D9FF" />
      <Path d="M6 13H26L16 28Z" fill="#2A5FD6" />
    </Svg>
  );
}

function StarIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path
        d="M16 3L19.5 12H29L21.5 17.5L24.5 27L16 21.5L7.5 27L10.5 17.5L3 12H12.5Z"
        fill="#E9B23B"
      />
      <Path
        d="M16 6L18.8 13.5H27L20.6 18L23 25.5L16 21L9 25.5L11.4 18L5 13.5H13.2Z"
        fill="#F7D06E"
      />
    </Svg>
  );
}

function EnergyIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect x="4" y="4" width="24" height="24" rx="6" fill="#31A85A" />
      <Path d="M18 6L10 18H16L14 26L22 14H16Z" fill="#F7D06E" />
    </Svg>
  );
}

function NoAdsIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Circle cx="16" cy="16" r="14" fill="#E5484D" />
      <Rect
        x="8"
        y="14.5"
        width="16"
        height="3"
        rx="1.5"
        fill="white"
        transform="rotate(45 16 16)"
      />
      <Rect
        x="8"
        y="14.5"
        width="16"
        height="3"
        rx="1.5"
        fill="white"
        transform="rotate(-45 16 16)"
      />
    </Svg>
  );
}

function PassIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect x="2" y="8" width="28" height="16" rx="4" fill="#4C9AFF" />
      <Rect x="2" y="8" width="28" height="7" rx="4" fill="#82BFFF" />
      <Path d="M8 17h8v2H8zM8 21h6v1H8z" fill="white" opacity="0.6" />
      <Path d="M22 19l-3-2 3-2v4z" fill="#F7D06E" />
    </Svg>
  );
}

const PRODUCT_ICON_NAME: Partial<Record<string, React.ComponentProps<typeof Ionicons>['name']>> = {
  training_accelerator: 'flash',
  contract_boost: 'document-text',
  form_recovery: 'pulse',
  scout_full_reveal: 'search',
  facility_upgrade_token: 'business',
  recovery_pack: 'fitness',
  transfer_budget_sm: 'cash',
  remove_ads: 'shield-checkmark',
};

const PRODUCT_ACCENT: Record<string, string> = {
  training_accelerator: '#F5A524',
  contract_boost: '#4C9AFF',
  form_recovery: '#30D070',
  scout_full_reveal: '#4C9AFF',
  facility_upgrade_token: '#E8B332',
  recovery_pack: '#30D070',
  transfer_budget_sm: '#E8B332',
  remove_ads: '#E5484D',
};

function ProductIcon({ product }: { product: purchases.Product }) {
  if (product.kind === 'coins') return <CoinIcon />;
  if (product.kind === 'gems') return <GemIcon />;
  const iconName = PRODUCT_ICON_NAME[product.id];
  if (!iconName) {
    return product.kind === 'entitlement' ? <StarIcon /> : <EnergyIcon />;
  }
  return <Ionicons name={iconName} size={25} color={PRODUCT_ACCENT[product.id] ?? '#E8B332'} />;
}

// ─── Trust bar ────────────────────────────────────────────────────────────────

function TrustBar() {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.proofBar}>
      <Text style={styles.proofText}>
        Purchases secured by Google Play · All prices include taxes
      </Text>
    </View>
  );
}

// ─── Product row ──────────────────────────────────────────────────────────────

const BADGES: Record<string, { label: string; color: string }> = {
  coins_large: { label: 'Best Value', color: '#31A85A' },
  gems_large: { label: 'Best Value', color: '#31A85A' },
  season_pass: { label: 'Most Popular', color: '#4C9AFF' },
  remove_ads: { label: 'Premium', color: '#E9B23B' },
  starter_pack: { label: '🔥 Limited', color: '#E5484D' },
};

const SAVINGS: Record<string, string> = {
  coins_large: 'Save 25%',
  gems_large: 'Save 15%',
};

const PURCHASE_ERROR_MESSAGE: Record<string, string> = {
  already_active: 'This pass is already active.',
  already_owned: 'This item is already owned.',
  contract_boost_already_stored: 'Use your stored contract boost before buying another.',
  no_recovery_needed: 'Form and confidence are already above this session target.',
  facilities_maxed: 'Every club facility is already fully upgraded.',
  season_limit_reached: 'This season’s transfer-budget boost is already used.',
  manager_save_required: 'This item requires an active Manager Career save.',
  player_career_required: 'This item requires an active Player Career save.',
  purchase_in_progress: 'Another purchase is already being processed.',
};

function ProductRow({
  p,
  busy,
  onBuy,
  badge,
  saving,
  valueNote,
  owned,
  unavailableReason,
  delay = 0,
}: {
  p: purchases.Product;
  busy: string | null;
  onBuy: () => void;
  badge?: { label: string; color: string };
  saving?: string;
  valueNote?: string;
  owned?: boolean;
  unavailableReason?: string;
  delay?: number;
}) {
  const styles = useThemedStyles(makeStyles);
  const compact = useIsCompact();
  const available = purchases.isProductAvailable(p) && !unavailableReason;
  const action = (
    <Button
      label={owned ? 'Owned ✓' : available ? p.priceString : 'Unavailable'}
      size="sm"
      variant={owned ? 'secondary' : 'gold'}
      fullWidth={false}
      loading={busy === p.id}
      disabled={!available || owned || (busy != null && busy !== p.id)}
      onPress={onBuy}
      style={compact ? styles.itemButtonCompact : styles.itemButton}
    />
  );

  return (
    <Animated.View entering={FadeInDown.duration(260).delay(delay)}>
      <GlassSurface intensity={0.5} padded={false} style={styles.itemGlass}>
        <View style={styles.itemInner}>
          <View
            style={[styles.itemIcon, { backgroundColor: `${PRODUCT_ACCENT[p.id] ?? '#E8B332'}14` }]}
          >
            <ProductIcon product={p} />
          </View>
          <View style={styles.itemCopy}>
            <View style={styles.titleRow}>
              <Text style={styles.itemTitle} numberOfLines={2}>
                {p.title}
              </Text>
              {badge && (
                <View
                  style={[
                    styles.badgePill,
                    { backgroundColor: `${badge.color}22`, borderColor: badge.color },
                  ]}
                >
                  <Text style={[styles.badgePillText, { color: badge.color }]}>{badge.label}</Text>
                </View>
              )}
            </View>
            <Text style={styles.itemDesc} numberOfLines={compact ? 3 : 2}>
              {p.description}
            </Text>
            {valueNote ? <Text style={styles.itemValue}>{valueNote}</Text> : null}
            {saving && <Text style={styles.itemSaving}>{saving}</Text>}
            {!available && (
              <Text style={styles.unavailableText}>
                {unavailableReason ??
                  'Google Play pricing is unavailable. Try again when connected.'}
              </Text>
            )}
            {compact ? action : null}
          </View>
          {!compact ? action : null}
        </View>
      </GlassSurface>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function PurchaseScreen({ navigation }: ScreenProps<'Purchase'>) {
  const save = useCareer((s) => s.save);
  const purchaseProduct = useCareer((s) => s.purchaseProduct);
  const grantAdEnergy = useCareer((s) => s.grantAdEnergy);
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [products, setProducts] = useState<purchases.Product[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starterPackOwned, setStarterPackOwned] = useState(true);
  const rewardedEnergyPendingRef = useRef(false);
  const rewardedEnergyAttemptRef = useRef(0);

  // Subtle pulse animation for the starter offer badge
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.04, { duration: 600 }), withTiming(1, { duration: 600 })),
      -1,
      true,
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  // The one-time Starter Pack starts only after the first completed match.
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const starterUnlockedAt = save?.experience?.starterPackUnlockedAt;
  const starterOfferMsLeft = starterUnlockedAt
    ? Math.max(0, starterUnlockedAt + purchases.STARTER_PACK_OFFER_HOURS * 60 * 60 * 1000 - nowTs)
    : 0;
  const countdown = (() => {
    const total = Math.floor(starterOfferMsLeft / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  })();

  useEffect(() => {
    let alive = true;
    void Promise.all([purchases.getProducts(), accountPurchases.hasStarterPackPurchase()]).then(
      ([p, starterOwned]) => {
        if (alive) {
          setProducts(p);
          setStarterPackOwned(starterOwned);
          setLoading(false);
        }
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const removeAds = areAdsRemoved(save?.entitlements);

  const onBuy = async (p: purchases.Product) => {
    if (p.id === 'remove_ads' && removeAds) return;
    setBusy(p.id);
    const res = await purchaseProduct(p.id);
    if (res.ok && p.id === 'starter_pack') setStarterPackOwned(true);
    setBusy(null);
    Alert.alert(
      res.ok ? 'Purchase complete ✓' : 'Purchase failed',
      res.ok
        ? `${p.title} applied to your account.`
        : (PURCHASE_ERROR_MESSAGE[res.error ?? ''] ?? res.error ?? 'Please try again.'),
    );
  };

  // Starter Pack is a genuine, one-time offer: shown until the player's first
  // purchase is done or the configured window lapses.
  const starterPack =
    starterPackOwned || !starterUnlockedAt || save?.firstPurchaseDone || starterOfferMsLeft <= 0
      ? undefined
      : products.find((p) => p.id === 'starter_pack');
  const passProduct = products.find((p) => p.id === 'season_pass');
  const legendProductId =
    save?.mode === 'manager'
      ? 'manager_legend_pack'
      : save?.mode === 'career'
        ? 'bundle_legend'
        : undefined;
  const legendProduct = legendProductId
    ? products.find((p) => p.id === legendProductId)
    : undefined;
  const energyProduct = products.find((p) => p.id === 'energy_refill');
  const coinProducts = products.filter((p) => p.id === 'coins_medium' || p.id === 'coins_large');
  const gemProducts = products.filter((p) => p.id === 'gems_medium' || p.id === 'gems_large');
  const energyLow = (save?.wallet.energy ?? 30) <= 8;
  const userPlayer = save?.userPlayerId ? save.players[save.userPlayerId] : undefined;
  const needsFormRecovery = Boolean(
    userPlayer && (userPlayer.meta.form < 70 || userPlayer.meta.confidence < 65),
  );
  const modeProductIds = save ? purchases.MODE_STORE_PRODUCT_IDS[save.mode] : [];
  const modeProducts = products.filter(
    (product) =>
      (modeProductIds as readonly string[]).includes(product.id) &&
      (product.id !== 'form_recovery' || needsFormRecovery),
  );
  const sharedProducts = products.filter((product) =>
    (purchases.SHARED_STORE_PRODUCT_IDS as readonly string[]).includes(product.id),
  );
  const acceleratorCharges = save?.inventory?.training_accelerator ?? 0;
  const contractBoostStored = (save?.inventory?.contract_boost_token ?? 0) > 0;
  const facilityUpgradeTokens = save?.inventory?.facility_upgrade_token ?? 0;
  const remainingFacilityUpgrades = save?.facilities
    ? Object.values(save.facilities).reduce((sum, level) => sum + Math.max(0, 5 - level), 0)
    : 12;
  const facilitiesMaxed = Boolean(save?.facilities && remainingFacilityUpgrades === 0);
  const nextFacilityCosts = save?.facilities
    ? Object.values(save.facilities)
        .filter((level) => level < 5)
        .map((level) => facilityUpgradeCost(level + 1))
    : [];
  const nextFacilitySaving = nextFacilityCosts.length ? Math.min(...nextFacilityCosts) : 150_000;
  const nextContractOffer = save?.mode === 'career' ? contractOffer(save) : undefined;
  const lowConditionPlayers =
    save?.mode === 'manager' && save.userTeamId
      ? (save.teams[save.userTeamId]?.playerIds ?? []).filter((playerId) => {
          const player = save.players[playerId];
          return player && !player.injury && (player.condition ?? player.meta.fitness) < 80;
        }).length
      : 0;

  const valueNoteFor = (product: purchases.Product): string | undefined => {
    switch (product.id) {
      case 'training_accelerator':
        return `Immediate value: 3 sessions at 3x gains · ${acceleratorCharges}/6 charges stored`;
      case 'contract_boost': {
        if (!nextContractOffer) return 'Applies automatically to the next Player Career renewal.';
        const boostedWeekly = weeklyWage(Math.round(nextContractOffer.wage * 1.25));
        const baseWeekly = weeklyWage(nextContractOffer.wage);
        const bonusGain = Math.round(nextContractOffer.signingBonus * 0.25);
        return `Projected next deal: +₹${Math.max(0, boostedWeekly - baseWeekly).toLocaleString()}/week · +${bonusGain.toLocaleString()} coins`;
      }
      case 'form_recovery':
        return userPlayer
          ? `Immediate: form ${Math.round(userPlayer.meta.form)}→${Math.max(70, Math.round(userPlayer.meta.form))} · confidence ${Math.round(userPlayer.meta.confidence)}→${Math.max(65, Math.round(userPlayer.meta.confidence))}`
          : undefined;
      case 'scout_full_reveal':
        return 'One selected player · exact OVR, condition and valuation';
      case 'facility_upgrade_token':
        return facilitiesMaxed
          ? undefined
          : `One level instantly · saves at least ${formatClubCurrency(nextFacilitySaving)} club budget`;
      case 'recovery_pack':
        return lowConditionPlayers > 0
          ? `${lowConditionPlayers} tired player${lowConditionPlayers === 1 ? '' : 's'} can receive +20 condition, +20 fitness and +15 morale`
          : 'Every eligible squad player can receive +20 condition, +20 fitness and +15 morale';
      case 'transfer_budget_sm':
        return `Immediate: +${formatClubCurrency(500_000)} transfer budget · once per season · FFP wage ceiling unchanged`;
      case 'remove_ads':
        return 'Permanent · 60-energy cap · +20% match coins in Player and Manager careers';
      default:
        return undefined;
    }
  };
  const unavailableReason = (product: purchases.Product): string | undefined => {
    if (!purchases.isProductAvailable(product)) {
      return 'Google Play pricing is unavailable. Try again when connected.';
    }
    if (
      product.id === 'training_accelerator' &&
      acceleratorCharges + 3 > purchases.MAX_TRAINING_ACCELERATOR_CHARGES
    ) {
      return `Use an accelerator first. Maximum stored charges: ${purchases.MAX_TRAINING_ACCELERATOR_CHARGES}.`;
    }
    if (product.id === 'contract_boost' && contractBoostStored) {
      return 'Your next-contract boost is already stored.';
    }
    if (product.id === 'form_recovery' && !needsFormRecovery) {
      return 'Form and confidence are already above this session target.';
    }
    if (product.id === 'facility_upgrade_token' && facilitiesMaxed) {
      return 'Every club facility is already fully upgraded.';
    }
    if (
      product.id === 'facility_upgrade_token' &&
      facilityUpgradeTokens >= remainingFacilityUpgrades
    ) {
      return 'Every remaining facility upgrade already has a stored token.';
    }
    if (
      product.id === 'transfer_budget_sm' &&
      save?.flags?.[`budgetBoost:transfer_budget_sm:${save.currentSeasonId ?? 'season'}`]
    ) {
      return 'This season’s transfer-budget boost is already used.';
    }
    return undefined;
  };
  const isFirstPurchase = false;
  const isVIP = removeAds;
  const hasManagerLegendBacking = Boolean(save?.inventory?.manager_legend_backing);
  const hasPlayerLegendBundle = Boolean(
    save?.inventory?.player_legend_bundle_owned ||
    (save?.inventory?.avatar_legend_frame &&
      save?.inventory?.kit_all_colors &&
      save.entitlements.removeAds),
  );
  const legendOwned = save?.mode === 'manager' ? hasManagerLegendBacking : hasPlayerLegendBundle;
  const legendBundleLabel =
    save?.mode === 'manager' ? 'MANAGER LEGACY EDITION' : 'PLAYER LEGEND EDITION';
  const legendBundleTitle =
    save?.mode === 'manager' ? 'Build a Dynasty' : 'The Ultimate Player Edition';
  const legendPerks =
    save?.mode === 'manager'
      ? [
          '👑 Permanent Manager-only Legend backing',
          '🏛 Exclusive Legend Boardroom presentation',
          '📋 Board confidence lifted to at least 82',
          '🔍 2 Full Scout Intelligence tokens',
          '🏗 1 free Facility Upgrade token',
          '💪 1 Squad Conditioning token',
          '🧾 Recorded as premium manager assistance',
          '🚫 No purchased results, trophies or Hall of Fame entry',
        ]
      : [
          '👑 Exclusive Legend Avatar Frame',
          '🎽 Premium Kit - all team colours unlocked',
          '💎 600 Gems + 20,000 Coins instantly',
          '🚫 Remove Ads - forever',
          '⚡ Double Energy Cap (60) - always',
          '🎨 Permanent Player Career cosmetics',
          '🚫 No purchased stats, selection, trophies or Hall of Fame entry',
        ];
  const rewardedEnergyAvailable = ads.isAdsReady() || ads.isReady('rewarded');

  const onWatchEnergyAd = async () => {
    if (rewardedEnergyPendingRef.current) return;
    if (!rewardedEnergyAvailable) {
      Alert.alert('Ad unavailable', 'Rewarded ads are not available right now.');
      return;
    }
    rewardedEnergyPendingRef.current = true;
    const transactionId = `store-energy:${save?.id ?? 'unknown'}:${Date.now()}:${++rewardedEnergyAttemptRef.current}`;
    setBusy('rewarded_energy');
    try {
      const res = await ads.showRewarded(!removeAds);
      if (!res.completed) {
        Alert.alert('Ad unavailable', 'Please try again in a moment.');
        return;
      }
      const granted = grantAdEnergy(ECONOMY.energyPerMatch, transactionId);
      if (!granted.ok) {
        Alert.alert(
          'Reward already applied',
          granted.reason ?? 'This ad reward was already applied.',
        );
        return;
      }
      Alert.alert('Energy added', `+${ECONOMY.energyPerMatch} energy added to your wallet.`);
    } finally {
      rewardedEnergyPendingRef.current = false;
      setBusy(null);
    }
  };

  return (
    <Screen scroll gradient={gradients.pitch}>
      <ScreenHeader
        title="Store"
        subtitle="Power up your career"
        onBack={() => navigation.goBack()}
      />

      {save ? <WalletBar wallet={save.wallet} /> : null}
      <TrustBar />

      {loading ? (
        [0, 1, 2, 3].map((i) => (
          <Card key={i} style={[styles.item, { marginBottom: spacing.sm }]}>
            <Skeleton width={40} height={40} radius={8} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="85%" height={11} />
            </View>
            <Skeleton width={70} height={36} radius={18} />
          </Card>
        ))
      ) : (
        <>
          {/* ── Starter Pack — highest prominence ── */}
          {starterPack && (
            <Animated.View entering={FadeInDown.duration(350)} style={{ marginTop: spacing.md }}>
              <LinearGradient
                colors={['#1A0F0A', '#0D0A05']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.starterCard, shadow.card]}
              >
                <View style={styles.starterContent}>
                  <Animated.View style={pulseStyle}>
                    <Text style={styles.starterBadge}>NEW PLAYER OFFER — ONE PER ACCOUNT</Text>
                  </Animated.View>
                  <Text style={styles.starterTitle}>{starterPack.title}</Text>
                  <Text style={styles.starterDesc}>{starterPack.description}</Text>

                  <View style={styles.starterSavingsRow}>
                    <View style={styles.starterSavingBadge}>
                      <Text style={styles.starterSavingText}>Best starter value</Text>
                    </View>
                    <Text style={styles.starterRRP}>coins + gems + 7 days ad-free</Text>
                  </View>
                  {/* Genuine, persisted window (from career start) — real
                      urgency, not a resetting fake timer. */}
                  <Text style={styles.starterRRP}>Offer ends in {countdown}</Text>

                  <Button
                    label={
                      purchases.isProductAvailable(starterPack)
                        ? `Buy Now · ${starterPack.priceString}`
                        : 'Google Play unavailable'
                    }
                    variant="gold"
                    loading={busy === starterPack.id}
                    disabled={!purchases.isProductAvailable(starterPack)}
                    onPress={() => void onBuy(starterPack)}
                    style={{ marginTop: spacing.md }}
                  />
                </View>
              </LinearGradient>
            </Animated.View>
          )}

          {/* ── First Purchase Bonus Banner ── */}
          {isFirstPurchase && (
            <Animated.View
              entering={ZoomIn.duration(400).delay(100)}
              style={styles.firstPurchaseBanner}
            >
              <Text style={styles.firstPurchaseIcon}>🎁</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.firstPurchaseTitle}>First Purchase Bonus!</Text>
                <Text style={styles.firstPurchaseText}>
                  Your very first purchase gives you 2× the gems — one time only!
                </Text>
              </View>
            </Animated.View>
          )}

          {/* ── Loss Aversion: Low Energy Alert ── */}
          {energyLow && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.energyAlertCard}>
              <Text style={styles.energyAlertIcon}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.energyAlertTitle}>
                  Energy Running Low ({save?.wallet.energy ?? 0}/{ECONOMY.energyMax})
                </Text>
                <Text style={styles.energyAlertText}>
                  Refill now or watch an ad for free energy to jump straight into your next match.
                </Text>
              </View>
              <Button
                label={rewardedEnergyAvailable ? 'Watch ad' : 'Rewarded ads unavailable'}
                variant="secondary"
                size="sm"
                fullWidth={false}
                loading={busy === 'rewarded_energy'}
                disabled={!rewardedEnergyAvailable || (busy != null && busy !== 'rewarded_energy')}
                onPress={() => void onWatchEnergyAd()}
              />
              <Button
                label={
                  energyProduct && purchases.isProductAvailable(energyProduct)
                    ? `Refill ${energyProduct.priceString}`
                    : 'Refill unavailable'
                }
                variant="gold"
                size="sm"
                fullWidth={false}
                loading={busy === 'energy_refill'}
                disabled={
                  !energyProduct ||
                  !purchases.isProductAvailable(energyProduct) ||
                  (busy != null && busy !== 'energy_refill')
                }
                onPress={() => energyProduct && void onBuy(energyProduct)}
              />
            </Animated.View>
          )}

          {/* ── Mode-specific Legend pack ── */}
          {legendProduct && !legendOwned && (
            <Animated.View entering={FadeInDown.duration(380).delay(40)}>
              <LinearGradient
                colors={['#12121A', '#0D0D15', '#12121A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.legendBundle, shadow.card]}
              >
                <LinearGradient
                  colors={['#E9B23B', '#C6902A', '#E9B23B']}
                  style={styles.legendBundleBorderTop}
                />
                <View style={styles.legendBundleContent}>
                  <View style={styles.legendBundleHeader}>
                    <Text style={styles.legendBundleCrown}>👑</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.legendBundleLabel}>{legendBundleLabel}</Text>
                      <Text style={styles.legendBundleTitle}>{legendBundleTitle}</Text>
                    </View>
                    <View style={styles.legendBundleBestVal}>
                      <Text style={styles.legendBundleBestValText}>
                        {save?.mode === 'manager' ? 'MANAGER ONLY' : 'BEST VALUE'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.legendBundlePerks}>
                    {legendPerks.map((perk) => (
                      <View key={perk} style={styles.legendBundlePerkRow}>
                        <Text style={styles.legendBundlePerkText}>{perk}</Text>
                      </View>
                    ))}
                  </View>
                  <Button
                    label={
                      purchases.isProductAvailable(legendProduct)
                        ? `Buy ${legendProduct.title} · ${legendProduct.priceString}`
                        : 'Google Play unavailable'
                    }
                    variant="gold"
                    loading={busy === legendProduct.id}
                    disabled={!purchases.isProductAvailable(legendProduct)}
                    onPress={() => void onBuy(legendProduct)}
                    style={{ marginTop: spacing.md }}
                  />
                  <Text style={styles.legendBundleSaving}>
                    Applies only to this {save?.mode === 'manager' ? 'manager' : 'player'} mode
                  </Text>
                </View>
              </LinearGradient>
            </Animated.View>
          )}

          {/* ── VIP Streak Info (if VIP is active) ── */}
          {isVIP && (
            <Animated.View entering={FadeInDown.duration(300).delay(50)}>
              <Card style={styles.vipStreakCard}>
                <Text style={styles.vipStreakTitle}>🔥 VIP Streak Active</Text>
                <Text style={styles.vipStreakText}>
                  Log in daily as a VIP — 7 days = bonus gems, 30 days = exclusive avatar frame.
                  Current streak: {save?.vipStreakDays ?? 0} day
                  {(save?.vipStreakDays ?? 0) !== 1 ? 's' : ''}
                </Text>
              </Card>
            </Animated.View>
          )}

          {/* ── Gem sinks showcase (what gems unlock) ── */}
          <Animated.View entering={FadeInDown.duration(300).delay(60)} style={styles.gemSinksCard}>
            <Text style={styles.gemSinksTitle}>💎 What Gems Unlock</Text>
            <View style={styles.gemSinksList}>
              {[
                ...(save?.mode === 'manager'
                  ? [
                      '🔍 Full scouting intelligence',
                      '🧑‍💼 Elite staff shortlist search',
                      '💪 Squad conditioning and recovery',
                    ]
                  : [
                      '⚡ Training and energy support',
                      '🎨 Premium kits and player avatars',
                      '🎲 Story choice re-rolls',
                    ]),
              ].map((item) => (
                <View key={item} style={styles.gemSinkItem}>
                  <Text style={styles.gemSinkText}>{item}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* ── Season Pass ── */}
          {passProduct && (
            <Animated.View entering={FadeInDown.duration(320).delay(80)}>
              <LinearGradient
                colors={[colors.info + '22', colors.surface]}
                style={[styles.passCard, { borderColor: colors.info }]}
              >
                <View style={styles.passLeft}>
                  <View style={styles.passHeader}>
                    <PassIcon size={28} />
                    <View
                      style={[
                        styles.badgePill,
                        {
                          backgroundColor: colors.info + '22',
                          borderColor: colors.info,
                          marginLeft: spacing.sm,
                        },
                      ]}
                    >
                      <Text style={[styles.badgePillText, { color: colors.info }]}>
                        Most Popular
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.passTitle}>{passProduct.title}</Text>
                  <Text style={styles.passDesc}>{passProduct.description}</Text>
                  <Text style={styles.passPerks}>
                    Dual Mode Value · 20 reward tiers · Player and Manager cosmetics + stories
                  </Text>
                </View>
                <Button
                  label={
                    save && isSeasonPassActive(save)
                      ? '✓ Active'
                      : purchases.isProductAvailable(passProduct)
                        ? passProduct.priceString
                        : 'Unavailable'
                  }
                  variant={save && isSeasonPassActive(save) ? 'secondary' : 'primary'}
                  size="sm"
                  fullWidth={false}
                  disabled={
                    Boolean(save && isSeasonPassActive(save)) ||
                    !purchases.isProductAvailable(passProduct)
                  }
                  onPress={() => navigation.navigate('SeasonPass')}
                  style={{ flexShrink: 0 }}
                />
              </LinearGradient>
            </Animated.View>
          )}

          {modeProducts.length > 0 && (
            <Animated.View entering={FadeInDown.duration(300).delay(100)}>
              <View style={styles.sectionHeader}>
                <StarIcon size={20} />
                <Text style={styles.section}>
                  {save?.mode === 'manager' ? 'Manager Career Tools' : 'Player Career Tools'}
                </Text>
              </View>
              {modeProducts.map((product, index) => (
                <ProductRow
                  key={product.id}
                  p={product}
                  busy={busy}
                  onBuy={() => void onBuy(product)}
                  badge={BADGES[product.id]}
                  owned={product.id === 'contract_boost' && contractBoostStored}
                  unavailableReason={unavailableReason(product)}
                  valueNote={valueNoteFor(product)}
                  delay={index * 40}
                />
              ))}
            </Animated.View>
          )}

          {sharedProducts.length > 0 && (
            <Animated.View entering={FadeInDown.duration(300).delay(110)}>
              <View style={styles.sectionHeader}>
                <NoAdsIcon size={20} />
                <Text style={styles.section}>Account Upgrade</Text>
              </View>
              {sharedProducts.map((product, index) => (
                <ProductRow
                  key={product.id}
                  p={product}
                  busy={busy}
                  onBuy={() => void onBuy(product)}
                  badge={BADGES[product.id]}
                  owned={product.id === 'remove_ads' && removeAds}
                  unavailableReason={unavailableReason(product)}
                  valueNote={valueNoteFor(product)}
                  delay={index * 40}
                />
              ))}
            </Animated.View>
          )}

          {/* ── Coins ── */}
          {coinProducts.length > 0 && (
            <Animated.View entering={FadeInDown.duration(300).delay(120)}>
              <View style={styles.sectionHeader}>
                <CoinIcon size={20} />
                <Text style={styles.section}>Coins</Text>
              </View>
              {coinProducts.map((p, idx) => (
                <ProductRow
                  key={p.id}
                  p={p}
                  busy={busy}
                  onBuy={() => void onBuy(p)}
                  badge={BADGES[p.id]}
                  saving={SAVINGS[p.id]}
                  delay={idx * 40}
                />
              ))}
            </Animated.View>
          )}

          {/* ── Gems ── */}
          {gemProducts.length > 0 && (
            <Animated.View entering={FadeInDown.duration(300).delay(160)}>
              <View style={styles.sectionHeader}>
                <GemIcon size={20} />
                <Text style={styles.section}>Gems</Text>
              </View>
              {gemProducts.map((p, idx) => (
                <ProductRow
                  key={p.id}
                  p={p}
                  busy={busy}
                  onBuy={() => void onBuy(p)}
                  badge={BADGES[p.id]}
                  saving={SAVINGS[p.id]}
                  delay={idx * 40}
                />
              ))}
            </Animated.View>
          )}

          <Text style={styles.disclaimer}>
            {purchases.MOCK_MODE
              ? '⚠️ Dev mode: purchases apply instantly. Wire RevenueCat + EAS Dev Build to go live.'
              : ''}
          </Text>
        </>
      )}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // Trust bar
    proofBar: {
      borderRadius: radius.md,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      marginTop: spacing.sm,
      alignItems: 'center',
    },
    proofText: { color: colors.textFaint, fontSize: fontSize.xs },

    // Starter pack — refined dark premium card
    starterCard: {
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.accent + '50',
    },
    starterTimer: {
      backgroundColor: 'rgba(255,255,255,0.04)',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.accent + '30',
    },
    starterTimerLabel: {
      color: colors.accent,
      fontSize: 10,
      letterSpacing: 1.5,
      fontWeight: fontWeight.bold,
    },
    starterTimerValue: {
      color: colors.white,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      marginTop: 2,
    },
    starterContent: { padding: spacing.lg },
    starterBadge: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      letterSpacing: 1,
      marginBottom: 4,
    },
    starterTitle: {
      color: colors.white,
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    starterDesc: {
      color: 'rgba(255,255,255,0.65)',
      fontSize: fontSize.sm,
      marginTop: 6,
      lineHeight: 20,
    },
    starterSavingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    starterSavingBadge: {
      backgroundColor: colors.accent + '25',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: colors.accent + '60',
    },
    starterSavingText: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
    },
    starterRRP: { color: 'rgba(255,255,255,0.35)', fontSize: fontSize.xs },

    // First purchase bonus banner
    firstPurchaseBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.success + '18',
      borderWidth: 1.5,
      borderColor: colors.success,
      borderRadius: radius.xl,
      padding: spacing.md,
      marginTop: spacing.md,
    },
    firstPurchaseIcon: { fontSize: 28 },
    firstPurchaseTitle: {
      color: colors.success,
      fontSize: fontSize.md,
      fontWeight: fontWeight.black,
    },
    firstPurchaseText: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    // Low energy alert
    energyAlertCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.danger + '18',
      borderWidth: 1.5,
      borderColor: colors.danger,
      borderRadius: radius.xl,
      padding: spacing.md,
      marginTop: spacing.md,
    },
    energyAlertIcon: { fontSize: 24 },
    energyAlertTitle: { color: colors.danger, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    energyAlertText: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    // Legend bundle — dark charcoal, gold hairline border
    legendBundle: {
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.accent + '55',
      marginTop: spacing.md,
    },
    legendBundleBorderTop: { height: 2 },
    legendBundleContent: { padding: spacing.lg },
    legendBundleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    legendBundleCrown: { fontSize: 28 },
    legendBundleLabel: {
      color: colors.accentLight,
      fontSize: 10,
      fontWeight: fontWeight.black,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    legendBundleTitle: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      marginTop: 2,
    },
    legendBundleBestVal: {
      backgroundColor: colors.accent + '25',
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: colors.accent + '55',
    },
    legendBundleBestValText: {
      color: colors.accentLight,
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 0.5,
    },
    legendBundlePerks: { gap: 8, marginBottom: spacing.sm },
    legendBundlePerkRow: { flexDirection: 'row', alignItems: 'center' },
    legendBundlePerkText: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
    legendBundleSaving: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    // VIP streak
    vipStreakCard: { marginTop: spacing.md, borderWidth: 1, borderColor: colors.accent + '55' },
    vipStreakTitle: {
      color: colors.accent,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      marginBottom: spacing.xs,
    },
    vipStreakText: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 18 },

    // Gem sinks
    gemSinksCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1.5,
      borderColor: colors.info + '55',
      padding: spacing.lg,
      marginTop: spacing.md,
    },
    gemSinksTitle: {
      color: colors.info,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      marginBottom: spacing.sm,
      fontFamily: fonts.display,
    },
    gemSinksList: { gap: 6 },
    gemSinkItem: { flexDirection: 'row', alignItems: 'center' },
    gemSinkText: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },

    // Season pass
    passCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderWidth: 1.5,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginTop: spacing.md,
    },
    passLeft: { flex: 1 },
    passHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    passTitle: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
      fontFamily: fonts.display,
    },
    passDesc: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 3, lineHeight: 18 },
    passPerks: {
      color: colors.info,
      fontSize: fontSize.xs,
      marginTop: 4,
      fontWeight: fontWeight.semibold,
    },

    // Section headers
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    section: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
    },

    // Product rows
    item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
    itemGlass: { marginBottom: spacing.sm },
    itemInner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    itemIcon: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    itemCopy: { flex: 1, minWidth: 0 },
    itemButton: { flexShrink: 0, minWidth: 72, alignSelf: 'center' },
    itemButtonCompact: {
      alignSelf: 'stretch',
      marginTop: spacing.sm,
      minWidth: 0,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
    itemTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold, flex: 1 },
    itemDesc: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2, lineHeight: 18 },
    itemValue: {
      color: colors.accentLight,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      lineHeight: 17,
      marginTop: 5,
    },
    itemSaving: {
      color: colors.success,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      marginTop: 3,
    },
    unavailableText: {
      color: colors.warning,
      fontSize: fontSize.xs,
      lineHeight: 16,
      marginTop: 3,
    },
    badgePill: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    badgePillText: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    disclaimer: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      marginTop: spacing.xl,
      marginBottom: spacing.xxl,
      lineHeight: 18,
      textAlign: 'center',
    },
  });
