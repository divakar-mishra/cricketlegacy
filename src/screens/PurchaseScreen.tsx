/**
 * Premium Store Screen — designed to feel like a first-class game store.
 * Custom SVG-style icons, countdown scarcity timer on starter pack,
 * social proof, gem sinks list, and full product hierarchy.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
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
  SponsorLogo,
  WalletBar,
} from '../components';
import { ScreenProps } from '../navigation';
import { accountPurchases, ads, purchases } from '../services';
import { authorizeReviewerAccess } from '../services/reviewerAccess';
import { ECONOMY } from '../data/gameConfig';
import {
  areAdsRemoved,
  ENERGY_REFILL_GEMS,
  PLAYER_GEM_CONVERSION_PRESETS,
  PLAYER_GEM_TO_COIN_RATE,
  playerGemConversionCoins,
} from '../game/economy';
import { contractOffer } from '../game/career';
import { formatClubCurrency } from '../game/finance';
import { facilityUpgradeCost } from '../game/manager';
import { hasModeVip, vipProductId } from '../game/vip';
import { premiumSponsorStoreUnlocked, premiumSponsorWeeklyRate } from '../game/sponsorship';
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
  player_save_sponsor: 'shirt',
  manager_save_sponsor: 'shirt',
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
  player_save_sponsor: '#E8B332',
  manager_save_sponsor: '#E8B332',
  remove_ads: '#E5484D',
};

function ProductIcon({ product }: { product: purchases.Product }) {
  if (purchases.isSaveSponsorProduct(product.id)) {
    return (
      <SponsorLogo
        brand={{ brandId: 'legacy_crown', brandName: 'Legacy Crown' }}
        variant="badge"
        size={32}
        label="Legacy Crown permanent sponsor"
      />
    );
  }
  if (product.kind === 'coins') return <CoinIcon />;
  if (product.kind === 'gems') return <GemIcon />;
  const iconName = PRODUCT_ICON_NAME[product.id];
  if (!iconName) {
    return product.kind === 'entitlement' ? <StarIcon /> : <EnergyIcon />;
  }
  return <Ionicons name={iconName} size={25} color={PRODUCT_ACCENT[product.id] ?? '#E8B332'} />;
}

// ─── Trust bar ────────────────────────────────────────────────────────────────

function TrustBar({ storeName }: { storeName: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.proofBar}>
      <Text style={styles.proofText}>Purchases handled by {storeName}</Text>
    </View>
  );
}

// ─── Product row ──────────────────────────────────────────────────────────────

const PURCHASE_ERROR_MESSAGE: Record<string, string> = {
  no_save: 'Open a career before making a purchase.',
  already_active: 'This pass is already active.',
  already_owned: 'This item is already owned.',
  contract_boost_already_stored: 'Use your stored contract boost before buying another.',
  no_recovery_needed: 'Form and confidence are already at least 99, and Focus is full.',
  facilities_maxed: 'Every club facility is already fully upgraded.',
  season_limit_reached: 'This season’s transfer-budget boost is already used.',
  manager_save_required: 'This item requires an active Manager Career save.',
  club_operations_paused: 'Club operations are paused during national duty.',
  player_career_required: 'This item requires an active Player Career save.',
  purchase_in_progress: 'Another purchase is already being processed.',
  already_owned_for_save: 'This save already owns its permanent sponsor.',
  sponsorship_not_unlocked: 'Sponsorship has not unlocked in this career yet.',
  save_sponsor_checkout_not_ready: 'Secure per-save checkout is not available yet.',
  active_save_changed: 'The active save changed, so nothing was applied.',
  persistence_failed: 'The device did not confirm the purchase save. Please try again.',
};

function ProductRow({
  p,
  busy,
  onBuy,
  valueNote,
  owned,
  unavailableReason,
  hideUnavailableReason = false,
  unavailableLabel,
  benefits,
  delay = 0,
}: {
  p: purchases.Product;
  busy: string | null;
  onBuy: () => void;
  valueNote?: string;
  owned?: boolean;
  unavailableReason?: string;
  hideUnavailableReason?: boolean;
  unavailableLabel: string;
  benefits: readonly string[];
  delay?: number;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const compact = useIsCompact(560);
  const [showDetails, setShowDetails] = useState(false);
  const hasSave = useCareer((s) => Boolean(s.save));
  const available = hasSave && purchases.isProductAvailable(p) && !unavailableReason;
  const action = (
    <Button
      label={owned ? 'Owned ✓' : !hasSave ? 'Open a career' : available ? p.priceString : unavailableLabel}
      size="sm"
      variant={owned ? 'secondary' : 'gold'}
      fullWidth={compact}
      loading={busy === p.id}
      disabled={!available || owned || (busy != null && busy !== p.id)}
      onPress={onBuy}
      style={compact ? styles.itemButtonCompact : styles.itemButton}
    />
  );

  return (
    <Animated.View entering={FadeInDown.duration(260).delay(delay)}>
      <GlassSurface intensity={0.5} padded={false} style={styles.itemGlass}>
        <Animated.View key={showDetails ? 'details' : 'front'} entering={ZoomIn.duration(160)}>
          {showDetails ? (
            <View style={styles.itemDetails}>
              <View style={styles.detailsHeader}>
                <Text style={styles.itemTitle}>{p.title}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${p.title} front`}
                  hitSlop={10}
                  onPress={() => setShowDetails(false)}
                  style={styles.infoButton}
                >
                  <Ionicons name="arrow-back" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
              <View style={styles.benefitList}>
                {benefits.map((benefit) => (
                  <View key={benefit} style={styles.benefitRow}>
                    <Ionicons name="checkmark-circle" size={17} color={colors.success} />
                    <Text style={styles.benefitText}>{benefit}</Text>
                  </View>
                ))}
              </View>
              {action}
            </View>
          ) : (
            <View style={styles.itemInner}>
              <View
                style={[
                  styles.itemIcon,
                  { backgroundColor: `${PRODUCT_ACCENT[p.id] ?? '#E8B332'}14` },
                ]}
              >
                <ProductIcon product={p} />
              </View>
              <View style={styles.itemCopy}>
                <View style={styles.titleRow}>
                  <Text style={styles.itemTitle} numberOfLines={2}>
                    {p.title}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`What is included in ${p.title}`}
                    hitSlop={10}
                    onPress={() => setShowDetails(true)}
                    style={styles.infoButton}
                  >
                    <Ionicons name="information" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
                <Text style={styles.itemDesc} numberOfLines={1}>
                  {p.description}
                </Text>
                {valueNote ? (
                  <Text style={styles.itemValue} numberOfLines={1}>
                    {valueNote}
                  </Text>
                ) : null}
                {!available && !owned && !hideUnavailableReason && (
                  <Text style={styles.unavailableText}>
                    {unavailableReason ?? 'Price unavailable. Try again later.'}
                  </Text>
                )}
                {compact ? action : null}
              </View>
              {!compact ? action : null}
            </View>
          )}
        </Animated.View>
      </GlassSurface>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function PurchaseScreen({ navigation, route }: ScreenProps<'Purchase'>) {
  const save = useCareer((s) => s.save);
  const purchaseProduct = useCareer((s) => s.purchaseProduct);
  const restorePurchases = useCareer((s) => s.restorePurchases);
  const claimReviewerAccess = useCareer((s) => s.claimReviewerAccess);
  const [reviewerAccess, setReviewerAccess] = useState(false);
  const grantAdEnergy = useCareer((s) => s.grantAdEnergy);
  const refillEnergy = useCareer((s) => s.refillEnergy);
  const convertPlayerGems = useCareer((s) => s.convertPlayerGems);
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [products, setProducts] = useState<purchases.Product[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [starterPackOwned, setStarterPackOwned] = useState(true);
  const [expandedFeatureCard, setExpandedFeatureCard] = useState<string | null>(null);
  const rewardedEnergyPendingRef = useRef(false);
  const rewardedEnergyAttemptRef = useRef(0);
  const storeSetupPending = !purchases.MOCK_MODE && !purchases.isStoreReady();
  const unavailableLabel = storeSetupPending ? 'Coming soon' : 'Unavailable';
  const storeName = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

  // The one-time Starter Pack starts only after the first completed match.
  const [nowTs, setNowTs] = useState(Date.now());
  const isFocused = useIsFocused();
  useEffect(() => {
    let cancelled = false;
    setReviewerAccess(false);
    if (isFocused) void authorizeReviewerAccess().then((allowed) => {
      if (!cancelled) setReviewerAccess(allowed);
    });
    return () => { cancelled = true; };
  }, [isFocused]);
  const starterUnlockedAt = save?.experience?.starterPackUnlockedAt;
  const starterOfferActive = !starterPackOwned && Boolean(starterUnlockedAt) &&
    nowTs < starterUnlockedAt! + purchases.STARTER_PACK_OFFER_HOURS * 60 * 60 * 1000;
  useEffect(() => {
    if (!isFocused || !starterOfferActive) return;
    setNowTs(Date.now());
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isFocused, starterOfferActive]);
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
    setLoading(true);
    setCatalogFailed(false);
    void Promise.all([purchases.getProducts(), accountPurchases.hasStarterPackPurchase()]).then(
      ([p, starterOwned]) => {
        if (alive) {
          setProducts(p);
          setStarterPackOwned(starterOwned);
          setLoading(false);
        }
      },
    ).catch(() => {
      if (alive) {
        setCatalogFailed(true);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [catalogAttempt]);

  const removeAds = areAdsRemoved(save?.entitlements);

  const completePurchase = async (p: purchases.Product) => {
    if (busy != null) return;
    if (!useCareer.getState().save) {
      Alert.alert('Open a career', PURCHASE_ERROR_MESSAGE.no_save);
      return;
    }
    if (p.id === 'remove_ads' && removeAds) return;
    setBusy(p.id);
    try {
      const res = await purchaseProduct(p.id);
      if (res.ok && p.id === 'starter_pack') setStarterPackOwned(true);
      Alert.alert(
        res.ok ? 'Purchase complete ✓' : 'Purchase failed',
        res.ok
          ? purchases.isSaveSponsorProduct(p.id)
            ? `${p.title} is now bound to this save.`
            : `${p.title} applied to your account.`
          : (PURCHASE_ERROR_MESSAGE[res.error ?? ''] ?? res.error ?? 'Please try again.'),
      );
    } catch {
      Alert.alert('Purchase unavailable', 'Could not complete the request. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  };

  const onRestorePurchases = async () => {
    if (busy != null) return;
    setBusy('restore_purchases');
    try {
      const result = await restorePurchases();
      switch (result.status) {
        case 'RESTORED':
          Alert.alert(
            'Purchases restored',
            `${result.count} purchase${result.count === 1 ? '' : 's'} restored to this save.`,
          );
          break;
        case 'NOTHING_TO_RESTORE':
          Alert.alert(
            'Nothing to restore',
            `No active permanent upgrade or Season Pass was found for this ${storeName} account.`,
          );
          break;
        case 'NOTHING_APPLICABLE':
          Alert.alert(
            'Nothing applied',
            'Your restorable purchases do not apply to this career mode right now.',
          );
          break;
        case 'NOT_CONFIGURED':
          Alert.alert(
            'Store unavailable',
            `${storeName} purchases are not connected in this build.`,
          );
          break;
        case 'ACTIVE_SAVE_CHANGED':
          Alert.alert('Restore stopped', 'The active save changed. Open the Store and try again.');
          break;
        case 'PERSISTENCE_FAILED':
          Alert.alert(
            'Restore not saved',
            'The device could not save the restored access. Try again.',
          );
          break;
        case 'NO_SAVE':
          Alert.alert('No active career', 'Open a career before restoring purchases.');
          break;
        default:
          Alert.alert(
            'Restore failed',
            `Could not reach ${storeName}. Check your connection and try again.`,
          );
      }
    } catch {
      Alert.alert('Restore failed', 'Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  };

  const onBuy = (p: purchases.Product) => {
    if (!purchases.isSaveSponsorProduct(p.id)) {
      void completePurchase(p);
      return;
    }
    const careerName =
      save?.mode === 'career' && save.userPlayerId
        ? save.players[save.userPlayerId]?.name
        : save?.userTeamId
          ? save.teams[save.userTeamId]?.name
          : undefined;
    const targetSave = careerName ? `${careerName}’s save` : 'this save';
    Alert.alert(
      'Bind sponsor to this save?',
      `${p.priceString} permanently adds the extra sponsor slot to ${targetSave}. It cannot move to another save or mode. Signed-in recovery can restore this exact save after reinstall or device loss. Choosing Delete Save permanently destroys its server backup and sponsor binding.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Buy ${p.priceString}`, onPress: () => void completePurchase(p) },
      ],
      { cancelable: true },
    );
  };

  // Starter Pack is a genuine, one-time offer: shown until the player's first
  // purchase is done or the configured window lapses.
  const starterPack =
    starterPackOwned || !starterUnlockedAt || save?.firstPurchaseDone || starterOfferMsLeft <= 0
      ? undefined
      : products.find((p) => p.id === 'starter_pack');
  const passProduct = products.find((p) => p.id === vipProductId(save?.mode ?? 'career'));
  const legendProductId =
    save?.mode === 'manager'
      ? 'manager_legend_pack'
      : save?.mode === 'career'
        ? 'bundle_legend'
        : undefined;
  const legendProduct = legendProductId
    ? products.find((p) => p.id === legendProductId)
    : undefined;
  const coinProducts = products.filter((p) => p.id === 'coins_medium' || p.id === 'coins_large');
  const gemProducts = products.filter((p) => p.id === 'gems_medium' || p.id === 'gems_large');
  const energyLow = (save?.wallet.energy ?? 30) <= 8;
  const suggestedProduct = products.find((product) => product.id === route.params?.productId &&
    (save?.mode === 'career'
      ? ['form_recovery', 'coins_medium', 'coins_large'].includes(product.id)
      : ['transfer_budget_sm', 'facility_upgrade_token', 'recovery_pack'].includes(product.id)));
  const userPlayer = save?.userPlayerId ? save.players[save.userPlayerId] : undefined;
  const needsFormRecovery = Boolean(
    userPlayer && (userPlayer.meta.form < 99 || userPlayer.meta.confidence < 99 ||
      (save?.wallet.energy ?? 0) < (save?.entitlements.removeAds ? ECONOMY.vipEnergyMax : ECONOMY.energyMax)),
  );
  const modeProductIds = save ? purchases.MODE_STORE_PRODUCT_IDS[save.mode] : [];
  const saveSponsorUnlocked = save ? premiumSponsorStoreUnlocked(save) : false;
  const ownedSaveSponsorProductId = save?.sponsorship?.premium?.productId;
  const modeProducts = products.filter(
    (product) =>
      (modeProductIds as readonly string[]).includes(product.id) &&
      (!purchases.isSaveSponsorProduct(product.id) ||
        saveSponsorUnlocked ||
        ownedSaveSponsorProductId === product.id) &&
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
        return `${acceleratorCharges}/6 charges stored`;
      case 'contract_boost': {
        if (!nextContractOffer) return 'Applies automatically to the next Player Career renewal.';
        const boostedSeason = Math.round(nextContractOffer.wage * 1.25);
        const bonusGain = Math.round(nextContractOffer.signingBonus * 0.25);
        return `Next deal: +${Math.max(0, boostedSeason - nextContractOffer.wage).toLocaleString()} salary coins · +${bonusGain.toLocaleString()} bonus coins`;
      }
      case 'form_recovery':
        return userPlayer
          ? `Form ${Math.round(userPlayer.meta.form)}→${Math.max(99, Math.round(userPlayer.meta.form))} · confidence ${Math.round(userPlayer.meta.confidence)}→${Math.max(99, Math.round(userPlayer.meta.confidence))} · Focus refill to ${save?.entitlements.removeAds ? ECONOMY.vipEnergyMax : ECONOMY.energyMax}`
          : undefined;
      case 'scout_full_reveal':
        return undefined;
      case 'facility_upgrade_token':
        return facilitiesMaxed
          ? undefined
          : `1 level · saves at least ${formatClubCurrency(nextFacilitySaving)}`;
      case 'recovery_pack':
        return lowConditionPlayers > 0
          ? `${lowConditionPlayers} tired player${lowConditionPlayers === 1 ? '' : 's'} eligible`
          : 'All eligible squad players covered';
      case 'transfer_budget_sm':
        return undefined;
      case 'player_save_sponsor':
        return save
          ? `Current rate: ${premiumSponsorWeeklyRate(save).toLocaleString()} coins per qualifying week`
          : undefined;
      case 'manager_save_sponsor':
        if (save?.managerCareerLevel === 'NATIONAL' && ownedSaveSponsorProductId === product.id) {
          return 'Owned · payments paused during national duty · resumes with next domestic club';
        }
        return save
          ? `Current rate: ${formatClubCurrency(premiumSponsorWeeklyRate(save))} per qualifying week`
          : undefined;
      case 'remove_ads':
        return undefined;
      default:
        return undefined;
    }
  };
  const benefitsFor = (product: purchases.Product): readonly string[] => {
    switch (product.id) {
      case 'starter_pack':
        return ['3,000 Wallet Coins', '50 Gems', 'Seven ad-free days'];
      case 'coins_medium':
        return ['10,000 Wallet Coins in the active save'];
      case 'coins_large':
        return ['20,000 Wallet Coins in the active save'];
      case 'gems_medium':
        return ['300 Gems in the active save'];
      case 'gems_large':
        return ['1,200 Gems in the active save'];
      case 'bundle_legend':
        return [
          'One-time bundle purchase · No subscription',
          '40,000 Wallet Coins and 1,200 Gems delivered once to the active Player save',
          'Permanent ad removal and 60 Training Focus capacity',
          'Includes Player VIP and its 12 earnable collections',
          'All standard kit designs and the Legend Gold frame',
        ];
      case 'manager_legend_pack':
        return [
          'One-time bundle purchase · No subscription',
          'Includes permanent Manager VIP and its 12 earnable office collections',
          '$1,000,000 fictional Club Balance delivered once to the purchased Manager save; not regranted on restore',
          'Board confidence raised to at least 82 and club reputation +3',
          'Two full-scout tokens, one facility token and one squad-conditioning token',
          'Legend boardroom presentation',
        ];
      case 'season_pass':
        return [
          'Thirty days of Premium access across every save',
          'Premium rewards across all 20 tiers',
          'Every Player and Manager save keeps separate XP and reward claims',
          'League and club naming editor while Premium is active',
          'Active access removes ads for the pass period',
        ];
      case 'player_vip':
      case 'manager_vip':
        return [
          `Permanent access across your ${product.id === 'player_vip' ? 'Player' : 'Manager'} saves only`,
          product.id === 'player_vip' ? 'No ads · 60 Focus capacity · +20% match coins · Extra save slot' : 'No ads · +20% match coins · Extra save slot',
          '12 collections · Choose one per completed in-game season',
          'Retirement unlocks remaining collection cosmetics only — no Coins, Gems or cash rewards',
          'Earned cosmetics stay available in future careers in the same mode',
        ];
      case 'remove_ads':
        return [
          'Permanent ad removal',
          'Training Focus capacity increased to 60',
          '20% more Wallet Coins from match rewards',
        ];
      case 'training_accelerator':
        return [
          '1.5× attribute gains on the next three paid training sessions',
          'Up to six charges can be stored',
        ];
      case 'contract_boost':
        return [
          '25% higher wage and signing bonus on the next Player Career renewal',
          'Consumed only when that contract is signed',
        ];
      case 'form_recovery':
        return [
          'Immediately raises form and confidence to at least 99',
          'Refills Focus to 36, or 60 with VIP, in this Player save',
        ];
      case 'scout_full_reveal':
        return [
          'One full-scout token',
          'Reveals overall, form, fitness, injury status and value for one transfer target',
        ];
      case 'facility_upgrade_token':
        return [
          'One level for Training Ground, Medical Centre or Academy',
          'Club Balance upgrades remain available',
          'Normal facility upkeep still applies',
        ];
      case 'recovery_pack':
        return [
          'One squad-conditioning token',
          '+20 condition, +20 fitness and +15 morale for eligible non-injured players',
        ];
      case 'transfer_budget_sm':
        return [
          '$1,000,000 fictional Club Balance added to the current club budget',
          'Limited to once per in-game season',
          'Unavailable during national-team duty',
        ];
      case 'player_save_sponsor':
        return [
          'A permanent extra kit-sponsor slot for this Player save',
          `${save ? premiumSponsorWeeklyRate(save).toLocaleString() : 'Stature-scaled'} Wallet Coins per qualifying week`,
          'Rate scales with career stature; one official match qualifies the week',
          'Sponsor branding appears dynamically on supported kit surfaces',
        ];
      case 'manager_save_sponsor':
        return [
          'A permanent extra kit-sponsor slot for this Manager save',
          `${save ? formatClubCurrency(premiumSponsorWeeklyRate(save)) : 'Stature-scaled income'} added to Club Balance per qualifying week`,
          'Rate scales with manager stature; one official match qualifies the week',
          'Payments pause during national duty and resume at the next domestic club',
        ];
      default:
        return product.description.split(' · ').filter(Boolean);
    }
  };
  const unavailableReason = (product: purchases.Product): string | undefined => {
    if (
      (product.id === 'transfer_budget_sm' || product.id === 'manager_legend_pack') &&
      save?.mode === 'manager' &&
      save.managerCareerLevel === 'NATIONAL'
    ) {
      return 'Unavailable during national duty.';
    }
    if (!purchases.isProductAvailable(product)) {
      return storeSetupPending
        ? `${storeName} checkout will activate after product setup is finished.`
        : 'Price unavailable. Try again later.';
    }
    if (purchases.isSaveSponsorProduct(product.id) && !purchases.isSaveSponsorCheckoutReady()) {
      return 'Secure save binding is not ready. Checkout remains disabled.';
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
      return 'Form and confidence are already at least 99, and Focus is full.';
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

  const onRefillEnergy = () => {
    const result = refillEnergy();
    Alert.alert(
      result.ok ? 'Energy refilled' : 'Cannot refill',
      result.ok
        ? `Energy restored to ${ECONOMY.energyMax}.`
        : `You need ${ENERGY_REFILL_GEMS} gems and less than full energy.`,
    );
  };

  const confirmGemConversion = (gems: number) => {
    const coins = playerGemConversionCoins(gems);
    Alert.alert(
      'Convert gems?',
      `${gems} gems will become ${coins.toLocaleString()} Wallet Coins. This cannot be reversed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Convert',
          onPress: () => {
            void (async () => {
              setBusy(`gem_conversion_${gems}`);
              const result = await convertPlayerGems(gems);
              setBusy(null);
              Alert.alert(
                result.ok ? 'Exchange complete' : 'Exchange unavailable',
                result.ok
                  ? `+${(result.coins ?? 0).toLocaleString()} Wallet Coins`
                  : (result.reason ?? 'Try again.'),
              );
            })();
          },
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <Screen scroll gradient={gradients.pitch}>
      <ScreenHeader
        title="Store"
        subtitle={save?.mode === 'manager' ? 'Manager Career' : 'Player Career'}
        onBack={() => navigation.goBack()}
      />

      {save ? <WalletBar wallet={save.wallet} showEnergy={save.mode !== 'manager'} /> : null}
      <TrustBar storeName={storeName} />
      {suggestedProduct ? (
        <Card>
          <Text>For your current action</Text>
          <ProductRow p={suggestedProduct} busy={busy} onBuy={() => void onBuy(suggestedProduct)}
            benefits={[suggestedProduct.description]} valueNote={valueNoteFor(suggestedProduct)}
            unavailableReason={unavailableReason(suggestedProduct)}
            unavailableLabel="Unavailable" />
        </Card>
      ) : null}

      {storeSetupPending ? (
        <View style={styles.storePendingCard}>
          <Ionicons name="storefront-outline" size={22} color={colors.info} />
          <View style={styles.storePendingCopy}>
            <Text style={styles.storePendingTitle}>Checkout coming soon</Text>
          </View>
        </View>
      ) : null}

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
      ) : catalogFailed ? (
        <Card>
          <Text>Could not load the Store. Check your connection and try again.</Text>
          <Button label="Retry" onPress={() => setCatalogAttempt((attempt) => attempt + 1)} />
        </Card>
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
                  <View style={styles.specialTitleRow}>
                    <Text style={styles.starterTitle}>{starterPack.title}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Starter Pack details"
                      onPress={() =>
                        setExpandedFeatureCard((current) =>
                          current === starterPack.id ? null : starterPack.id,
                        )
                      }
                      style={styles.specialInfoButton}
                    >
                      <Ionicons
                        name={expandedFeatureCard === starterPack.id ? 'arrow-back' : 'information'}
                        size={18}
                        color={colors.white}
                      />
                    </Pressable>
                  </View>
                  {expandedFeatureCard === starterPack.id ? (
                    <View style={styles.featureBenefitList}>
                      {benefitsFor(starterPack).map((benefit) => (
                        <View key={benefit} style={styles.benefitRow}>
                          <Ionicons name="checkmark-circle" size={17} color={colors.accent} />
                          <Text style={styles.featureBenefitText}>{benefit}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.starterDesc}>{starterPack.description}</Text>
                  )}

                  {/* Genuine, persisted window (from career start) — real
                      urgency, not a resetting fake timer. */}
                  <Text style={styles.starterRRP}>Offer ends in {countdown}</Text>

                  <Button
                    label={
                      purchases.isProductAvailable(starterPack)
                        ? `Buy Now · ${starterPack.priceString}`
                        : `${storeName} unavailable`
                    }
                    variant="gold"
                    loading={busy === starterPack.id}
                    disabled={!save || busy != null || !purchases.isProductAvailable(starterPack)}
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
              <Text style={styles.firstPurchaseTitle}>🎁 First purchase: 2× gems</Text>
            </Animated.View>
          )}

          {/* ── Loss Aversion: Low Energy Alert ── */}
          {save?.mode !== 'manager' && energyLow && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.energyAlertCard}>
              <View style={styles.energyAlertHeading}>
                <Text style={styles.energyAlertIcon}>⚡</Text>
                <Text style={styles.energyAlertTitle}>
                  Energy {save?.wallet.energy ?? 0}/{ECONOMY.energyMax}
                </Text>
              </View>
              <View style={styles.energyAlertActions}>
                <Button
                  label={rewardedEnergyAvailable ? 'Watch ad' : 'Ad unavailable'}
                  variant="secondary"
                  size="sm"
                  style={styles.energyAlertAction}
                  loading={busy === 'rewarded_energy'}
                  disabled={
                    !rewardedEnergyAvailable || (busy != null && busy !== 'rewarded_energy')
                  }
                  onPress={() => void onWatchEnergyAd()}
                />
                <Button
                  label={`Refill · ${ENERGY_REFILL_GEMS} gems`}
                  variant="gold"
                  size="sm"
                  style={styles.energyAlertAction}
                  disabled={(save?.wallet.gems ?? 0) < ENERGY_REFILL_GEMS || busy != null}
                  onPress={onRefillEnergy}
                />
              </View>
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
                      <View style={styles.specialTitleRow}>
                        <Text style={styles.legendBundleLabel}>{legendBundleLabel}</Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${legendProduct.title} details`}
                          onPress={() =>
                            setExpandedFeatureCard((current) =>
                              current === legendProduct.id ? null : legendProduct.id,
                            )
                          }
                          style={styles.specialInfoButton}
                        >
                          <Ionicons
                            name={
                              expandedFeatureCard === legendProduct.id
                                ? 'arrow-back'
                                : 'information'
                            }
                            size={18}
                            color={colors.white}
                          />
                        </Pressable>
                      </View>
                      <Text style={styles.legendBundleTitle}>{legendBundleTitle}</Text>
                      <Text style={styles.legendFrontDesc}>One-time bundle · No subscription</Text>
                    </View>
                  </View>
                  {expandedFeatureCard === legendProduct.id ? (
                    <View style={styles.legendBundlePerks}>
                      {benefitsFor(legendProduct).map((perk) => (
                        <View key={perk} style={styles.legendBundlePerkRow}>
                          <Text style={styles.legendBundlePerkText}>{perk}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.legendFrontDesc}>{legendProduct.description}</Text>
                  )}
                  <Button
                    label={
                      purchases.isProductAvailable(legendProduct)
                        ? `Buy · ${legendProduct.priceString} once`
                        : 'Coming soon'
                    }
                    variant="gold"
                    loading={busy === legendProduct.id}
                    disabled={!save || busy != null || !purchases.isProductAvailable(legendProduct)}
                    onPress={() => void onBuy(legendProduct)}
                    style={{ marginTop: spacing.md }}
                  />
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
                  Current streak: {save?.vipStreakDays ?? 0} day
                  {(save?.vipStreakDays ?? 0) !== 1 ? 's' : ''}
                  {' · '}Day 7: bonus gems · Day 30: exclusive frame
                </Text>
              </Card>
            </Animated.View>
          )}

          {/* ── Season Pass ── */}
          {passProduct && (
            <Animated.View entering={FadeInDown.duration(320).delay(80)}>
              <LinearGradient
                colors={[colors.info + '22', colors.surface]}
                style={[styles.passCard, { borderColor: colors.info }]}
              >
                <View style={styles.passLeft}>
                  <View style={styles.specialTitleRow}>
                    <View style={styles.passHeader}>
                      <PassIcon size={28} />
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Mode VIP details"
                      onPress={() =>
                        setExpandedFeatureCard((current) =>
                          current === passProduct.id ? null : passProduct.id,
                        )
                      }
                      style={styles.infoButton}
                    >
                      <Ionicons
                        name={expandedFeatureCard === passProduct.id ? 'arrow-back' : 'information'}
                        size={18}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  </View>
                  <Text style={styles.passTitle}>{passProduct.title}</Text>
                  {expandedFeatureCard === passProduct.id ? (
                    <View style={styles.benefitList}>
                      {benefitsFor(passProduct).map((benefit) => (
                        <View key={benefit} style={styles.benefitRow}>
                          <Ionicons name="checkmark-circle" size={17} color={colors.info} />
                          <Text style={styles.benefitText}>{benefit}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.passPerks}>
                      12 collections · {save?.mode === 'manager' ? 'Manager' : 'Player'} only · One-time purchase
                    </Text>
                  )}
                </View>
                <Button
                  label={
                    hasModeVip(save)
                      ? '✓ Active'
                      : purchases.isProductAvailable(passProduct)
                        ? passProduct.priceString
                        : 'Coming soon'
                  }
                  variant={hasModeVip(save) ? 'secondary' : 'primary'}
                  size="sm"
                  fullWidth={false}
                  disabled={
                    !save || busy != null ||
                    hasModeVip(save) ||
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
                  owned={
                    (product.id === 'contract_boost' && contractBoostStored) ||
                    (purchases.isSaveSponsorProduct(product.id) &&
                      ownedSaveSponsorProductId === product.id)
                  }
                  unavailableReason={unavailableReason(product)}
                  hideUnavailableReason={false}
                  unavailableLabel={unavailableLabel}
                  valueNote={valueNoteFor(product)}
                  benefits={benefitsFor(product)}
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
                  owned={product.id === 'remove_ads' && removeAds}
                  unavailableReason={unavailableReason(product)}
                  hideUnavailableReason={false}
                  unavailableLabel={unavailableLabel}
                  valueNote={valueNoteFor(product)}
                  benefits={benefitsFor(product)}
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
                  hideUnavailableReason={false}
                  unavailableLabel={unavailableLabel}
                  benefits={benefitsFor(p)}
                  delay={idx * 40}
                />
              ))}
            </Animated.View>
          )}

          {/* ── Gems ── */}
          {(gemProducts.length > 0 || save?.mode === 'career') && (
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
                  hideUnavailableReason={false}
                  unavailableLabel={unavailableLabel}
                  benefits={benefitsFor(p)}
                  delay={idx * 40}
                />
              ))}
              {save?.mode === 'career' ? (
                <Card style={styles.gemExchangeCard}>
                  <View style={styles.gemExchangeHeader}>
                    <Text style={styles.gemExchangeTitle}>Gem Exchange</Text>
                    <Text style={styles.gemExchangeRate}>
                      1 gem = {PLAYER_GEM_TO_COIN_RATE} coins
                    </Text>
                  </View>
                  <View style={styles.gemExchangeActions}>
                    {PLAYER_GEM_CONVERSION_PRESETS.map((gems) => (
                      <Button
                        key={gems}
                        label={`${gems} → ${playerGemConversionCoins(gems) / 1_000}K`}
                        variant="secondary"
                        size="sm"
                        fullWidth={false}
                        style={styles.gemExchangeAction}
                        loading={busy === `gem_conversion_${gems}`}
                        disabled={(save.wallet.gems ?? 0) < gems || busy != null}
                        onPress={() => confirmGemConversion(gems)}
                      />
                    ))}
                  </View>
                </Card>
              ) : null}
            </Animated.View>
          )}

          <View style={styles.restoreBlock}>
            {reviewerAccess ? <>
              <Button
                label="Reviewer access · Free"
                variant="secondary"
                fullWidth
                disabled={!save || busy != null}
                loading={busy === 'reviewer_access'}
                onPress={() => {
                  if (busy != null) return;
                  setBusy('reviewer_access');
                  void claimReviewerAccess().then(() => {
                    Alert.alert('Reviewer access ready', save?.mode === 'manager'
                      ? 'Scout and conditioning tokens are ready in Transfers and Medical Centre. Return here to replenish them for testing.'
                      : 'Mental coaching applied: form and confidence at least 99, with Focus refilled.');
                  }).catch((error: unknown) => {
                    Alert.alert('Reviewer access unavailable', error instanceof Error ? error.message : 'Please retry.');
                  }).finally(() => setBusy(null));
                }}
              />
              <Text style={styles.restoreHint}>Complimentary review access. No purchase or charge.</Text>
            </> : null}
            <Button
              label="Restore Purchases"
              variant="secondary"
              size="sm"
              fullWidth
              loading={busy === 'restore_purchases'}
              disabled={!save || busy != null}
              onPress={() => void onRestorePurchases()}
              style={styles.restoreButton}
            />
            <Text style={styles.restoreHint}>
              {save
                ? 'Restores permanent upgrades and active passes. Consumable rewards go to the active save at purchase and are not granted again on restore.'
                : 'Open a Player or Manager career to buy or restore purchases.'}
            </Text>
          </View>
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
    storePendingCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginTop: spacing.sm,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.info + '55',
      backgroundColor: colors.info + '10',
      borderRadius: radius.md,
    },
    storePendingCopy: { flex: 1, minWidth: 0 },
    storePendingTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    storePendingText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 18,
      marginTop: 2,
    },

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
    specialTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    specialInfoButton: {
      width: 30,
      height: 30,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    featureBenefitList: { gap: spacing.xs, marginTop: spacing.sm },
    featureBenefitText: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: fontSize.sm,
      lineHeight: 19,
      flex: 1,
    },
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
      gap: spacing.sm,
      backgroundColor: colors.danger + '18',
      borderWidth: 1.5,
      borderColor: colors.danger,
      borderRadius: radius.xl,
      padding: spacing.md,
      marginTop: spacing.md,
    },
    energyAlertHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    energyAlertActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      width: '100%',
    },
    energyAlertAction: { flex: 1, minWidth: 0 },
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
    legendFrontDesc: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
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
    gemExchangeCard: {
      gap: spacing.sm,
      marginTop: spacing.xs,
      borderWidth: 1,
      borderColor: colors.info + '55',
    },
    gemExchangeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    gemExchangeTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    gemExchangeRate: { color: colors.info, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
    gemExchangeActions: { flexDirection: 'row', gap: spacing.xs },
    gemExchangeAction: { flex: 1, minWidth: 0 },

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
    itemDetails: { padding: spacing.md, gap: spacing.md },
    detailsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    infoButton: {
      width: 30,
      height: 30,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    benefitList: { gap: spacing.xs },
    benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    benefitText: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 19, flex: 1 },
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

    restoreBlock: {
      alignItems: 'center',
      marginTop: spacing.xl,
      gap: spacing.xs,
    },
    restoreButton: { width: '100%', maxWidth: 360 },
    restoreHint: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 17,
      textAlign: 'center',
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
