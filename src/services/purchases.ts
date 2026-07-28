/**
 * In-app purchase (IAP) abstraction.
 *
 * Modeled on RevenueCat's `react-native-purchases` surface but with NO hard
 * dependency on it. In {@link MOCK_MODE} (default `true`) purchases resolve
 * successfully so the entitlement/wallet flow can be exercised end-to-end in
 * development without any store configuration.
 *
 * ---------------------------------------------------------------------------
 * TODO(provider): drop in `react-native-purchases` behind this exact interface.
 * Do NOT import it elsewhere — keep all SDK usage inside this module and flip
 * {@link MOCK_MODE} to `false`.
 *
 *   import Purchases from 'react-native-purchases';
 *
 *   // once at startup:
 *   Purchases.configure({ apiKey: '<public sdk key>' });
 *
 *   getProducts -> const offerings = await Purchases.getOfferings();
 *                  return (offerings.current?.availablePackages ?? []).map(toProduct);
 *   purchase    -> const { customerInfo } = await Purchases.purchasePackage(pkg);
 *                  return { ok: hasEntitlement(customerInfo, productId), productId };
 *   restore     -> const info = await Purchases.restorePurchases();
 *                  return entitlementsToResults(info);
 * ---------------------------------------------------------------------------
 */

import { Platform } from 'react-native';
import type { Entitlements, Wallet } from '../domain/types';

/**
 * When true, all purchases succeed locally without contacting a store.
 * ─────────────────────────────────────────────────────────────────────
 * PRODUCTION SWITCH:
 *   1. Set MOCK_MODE = false
 *   2. Install: npm install react-native-purchases
 *   3. Configure RevenueCat API keys:
 *        iOS   → info.plist: REVENUECAT_IOS_KEY = 'appl_xxxxxxxxx'
 *        Android → google-services.json or BuildConfig: REVENUECAT_ANDROID_KEY = 'goog_xxxxxxxxx'
 *   4. In App.tsx startup: Purchases.configure({ apiKey: Platform.select({ ios: IOS_KEY, android: ANDROID_KEY }) });
 *   5. Replace the PROVIDER stubs below with real RevenueCat calls.
 * ─────────────────────────────────────────────────────────────────────
 */
export const MOCK_MODE = __DEV__; // auto-false in production builds

/* ---------------------------------------------------------------------------
 * RevenueCat provider (react-native-purchases).
 *
 * The SDK is loaded lazily so the app NEVER crashes if the dependency isn't
 * installed yet (e.g. running in Expo Go, or before `npx expo install
 * react-native-purchases`). When it's missing we fall back to the local
 * catalog and `purchase()` reports `not_configured` instead of throwing.
 *
 * To go live:
 *   1. npx expo install react-native-purchases
 *   2. Add "react-native-purchases" to app.json → plugins, then EAS dev build.
 *   3. Call configurePurchases({ ios, android }) once at App.tsx startup.
 *   4. Create products in the relevant store console with IDs that match
 *      the `id` fields in CATALOG below, and link them in RevenueCat.
 * ------------------------------------------------------------------------- */
type RevenueCatModule = any; // no static types — the dep may be absent
let _rc: RevenueCatModule | null | undefined;
let _rcConfigured = false;
let _requestedAppUserId: string | null | undefined;
let _identifiedAppUserId: string | null = null;
let _identitySync: Promise<void> = Promise.resolve();

function loadRevenueCat(): RevenueCatModule | null {
  if (_rc !== undefined) return _rc;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-purchases');
    _rc = mod?.default ?? mod ?? null;
  } catch {
    _rc = null; // dependency not installed / native module unavailable
  }
  return _rc;
}

/**
 * Configure RevenueCat once at app startup. No-ops in {@link MOCK_MODE}, when
 * the SDK isn't installed, or when no key is provided for the platform.
 */
export function configurePurchases(keys: { ios?: string; android?: string }): void {
  if (MOCK_MODE || _rcConfigured) return;
  const RC = loadRevenueCat();
  if (!RC) return;
  const apiKey = Platform.OS === 'ios' ? keys.ios : keys.android;
  if (!apiKey) return;
  try {
    RC.configure({ apiKey });
    _rcConfigured = true;
    void syncRequestedPurchasesUser();
  } catch {
    /* leave unconfigured — purchase() will report not_configured */
  }
}

function syncRequestedPurchasesUser(): Promise<void> {
  if (MOCK_MODE || !_rcConfigured || _requestedAppUserId === undefined) {
    return Promise.resolve();
  }

  _identitySync = _identitySync
    .catch(() => undefined)
    .then(async () => {
      const RC = loadRevenueCat();
      const requested = _requestedAppUserId;
      if (!RC || !_rcConfigured || requested === undefined) return;

      if (requested === null) {
        if (_identifiedAppUserId !== null) await RC.logOut();
        _identifiedAppUserId = null;
        return;
      }

      if (_identifiedAppUserId === requested) return;
      await RC.logIn(requested);
      _identifiedAppUserId = requested;
    });

  return _identitySync;
}

/** Associates store ownership with the authenticated application user. */
export async function identifyPurchasesUser(appUserId: string): Promise<void> {
  const normalized = appUserId.trim();
  if (!normalized) throw new Error('A non-empty purchases user id is required.');
  _requestedAppUserId = normalized;
  await syncRequestedPurchasesUser();
}

/** Clears the identified RevenueCat user after application sign-out. */
export async function clearPurchasesUser(): Promise<void> {
  _requestedAppUserId = null;
  await syncRequestedPurchasesUser();
}

/** Whether a live purchase backend is ready (SDK loaded + configured). */
export function isStoreReady(): boolean {
  return _rcConfigured && loadRevenueCat() != null;
}

function describePurchaseError(e: unknown): string {
  const err = e as { message?: string; code?: string | number } | undefined;
  if (err?.message) return String(err.message);
  if (err?.code != null) return String(err.code);
  return 'purchase_failed';
}

export type ProductKind = 'coins' | 'gems' | 'consumable' | 'entitlement';
export type StoreProductCategory = 'SUBSCRIPTION' | 'NON_SUBSCRIPTION';

const SUBSCRIPTION_PRODUCT_IDS = new Set(['season_pass']);

export function storeProductCategory(productId: string): StoreProductCategory {
  return SUBSCRIPTION_PRODUCT_IDS.has(productId) ? 'SUBSCRIPTION' : 'NON_SUBSCRIPTION';
}

export function groupProductIdsByCategory(productIds: readonly string[]): {
  subscriptionIds: string[];
  oneTimeIds: string[];
} {
  return {
    subscriptionIds: productIds.filter(
      (productId) => storeProductCategory(productId) === 'SUBSCRIPTION',
    ),
    oneTimeIds: productIds.filter(
      (productId) => storeProductCategory(productId) === 'NON_SUBSCRIPTION',
    ),
  };
}

function revenueCatProductCategory(RC: RevenueCatModule, productId: string): unknown {
  const category = storeProductCategory(productId);
  return RC.PRODUCT_CATEGORY?.[category] ?? category;
}

async function fetchStoreProducts(
  RC: RevenueCatModule,
  productIds: readonly string[],
): Promise<{ identifier: string; priceString: string }[]> {
  if (productIds.length === 0) return [];
  const { subscriptionIds, oneTimeIds } = groupProductIdsByCategory(productIds);
  const [subscriptions, oneTimeProducts] = await Promise.all([
    subscriptionIds.length
      ? RC.getProducts(subscriptionIds, revenueCatProductCategory(RC, subscriptionIds[0]))
      : Promise.resolve([]),
    oneTimeIds.length
      ? RC.getProducts(oneTimeIds, revenueCatProductCategory(RC, oneTimeIds[0]))
      : Promise.resolve([]),
  ]);
  return [...subscriptions, ...oneTimeProducts];
}

export interface Product {
  id: string;
  title: string;
  description: string;
  /** Localised, display-ready price (comes from the store in a real impl). */
  priceString: string;
  kind: ProductKind;
}

export interface PurchaseResult {
  ok: boolean;
  productId: string;
  /** Store/provider purchase token. Used by the career store to prevent duplicate grants. */
  purchaseToken?: string;
  /** PENDING purchases must not be fulfilled. */
  purchaseState?: 'PURCHASED' | 'PENDING' | 'CANCELLED' | 'REFUNDED' | 'REVOKED';
  verificationState?: 'VERIFIED' | 'UNVERIFIED' | 'LOCAL_MOCK';
  entitlement?: {
    expiresAt: number;
    periodStartedAt: number;
    lastVerifiedAt: number;
    willRenew?: boolean;
  };
  error?: string;
}

interface ProviderEntitlement {
  isActive?: boolean;
  expirationDate?: string | null;
  latestPurchaseDate?: string | null;
  willRenew?: boolean;
}

function activeProviderEntitlement(customerInfo: unknown, id: string): ProviderEntitlement | null {
  if (!customerInfo || typeof customerInfo !== 'object') return null;
  const active = (
    customerInfo as { entitlements?: { active?: Record<string, ProviderEntitlement> } }
  ).entitlements?.active;
  const entitlement = active?.[id];
  return entitlement?.isActive === false ? null : (entitlement ?? null);
}

function providerEntitlementPeriod(
  customerInfo: unknown,
  id: string,
  now: number,
): PurchaseResult['entitlement'] | undefined {
  const entitlement = activeProviderEntitlement(customerInfo, id);
  if (!entitlement?.expirationDate) return undefined;
  const expiresAt = Date.parse(entitlement.expirationDate);
  const periodStartedAt = entitlement.latestPurchaseDate
    ? Date.parse(entitlement.latestPurchaseDate)
    : now;
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return undefined;
  return {
    expiresAt,
    periodStartedAt: Number.isFinite(periodStartedAt) ? periodStartedAt : now,
    lastVerifiedAt: now,
    willRenew: entitlement.willRenew,
  };
}

export type EntitlementSnapshot =
  | { status: 'ACTIVE'; entitlement: NonNullable<PurchaseResult['entitlement']> }
  | { status: 'INACTIVE' }
  | { status: 'UNAVAILABLE' };

/** Refresh a provider entitlement without presenting a restore or purchase UI. */
export async function getEntitlementSnapshot(productId: string): Promise<EntitlementSnapshot> {
  if (MOCK_MODE) return { status: 'UNAVAILABLE' };
  const RC = loadRevenueCat();
  if (!RC || !_rcConfigured) return { status: 'UNAVAILABLE' };
  try {
    const info = await RC.getCustomerInfo();
    const entitlement = providerEntitlementPeriod(info, productId, Date.now());
    return entitlement ? { status: 'ACTIVE', entitlement } : { status: 'INACTIVE' };
  } catch {
    return { status: 'UNAVAILABLE' };
  }
}

/** RevenueCat 10.x exposes the store identity on the transaction object. */
export function providerTransactionIdentifier(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const transaction = (result as { transaction?: unknown }).transaction;
  if (!transaction || typeof transaction !== 'object') return null;
  const value = (transaction as { transactionIdentifier?: unknown }).transactionIdentifier;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * What a successful purchase grants. Kept as plain data so the caller (e.g. the
 * career store) can apply it to the {@link Wallet}/{@link Entitlements} and
 * persist on its own terms. Purchases never mutate game state directly.
 */
export interface PurchaseGrant {
  coins?: number;
  gems?: number;
  energy?: number;
  entitlement?: Partial<Entitlements>;
}

export interface ExtendedProduct extends Product {
  /** Badge text shown on the product card (e.g. "Best Value", "94% Off"). */
  badge?: string;
  /** Original price before discount (for strikethrough display). */
  originalPrice?: string;
  /** Whether this is a limited-time / starter offer. */
  isLimitedTime?: boolean;
  /** How many hours the offer is valid for. */
  offerHours?: number;
}

export const STARTER_PACK_OFFER_HOURS = 24;

/** Hardcoded catalog used in mock mode / as a fallback.
 *  India-first pricing: ₹99, ₹299, ₹599, ₹1499 price points.
 *  RevenueCat will provide locale-aware prices in production.
 */
const CATALOG: readonly ExtendedProduct[] = [
  // --- Starter Pack (24-hour contextual, only shown once) ---
  {
    id: 'starter_pack',
    title: 'Starter Pack',
    description: '3,000 coins + 50 gems + Remove Ads (7 days)',
    priceString: '₹99',
    kind: 'consumable',
    badge: 'New Player Offer',
    isLimitedTime: true,
    offerHours: STARTER_PACK_OFFER_HOURS,
  },

  // --- Coins ---
  {
    id: 'coins_small',
    title: 'Handful of Coins',
    description: '1,000 coins',
    priceString: '₹99',
    kind: 'coins',
  },
  {
    id: 'coins_medium',
    title: 'Bag of Coins',
    description: '5,000 coins',
    priceString: '₹299',
    kind: 'coins',
    badge: 'Good Value',
  },
  {
    id: 'coins_large',
    title: 'Sack of Coins',
    description: '15,000 coins',
    priceString: '₹599',
    kind: 'coins',
    badge: 'Best Value',
  },

  // --- Gems ---
  {
    id: 'gems_small',
    title: 'Pouch of Gems',
    description: '80 gems',
    priceString: '₹99',
    kind: 'gems',
  },
  {
    id: 'gems_medium',
    title: 'Bag of Gems',
    description: '300 gems',
    priceString: '₹299',
    kind: 'gems',
    badge: 'Popular',
  },
  {
    id: 'gems_large',
    title: 'Chest of Gems',
    description: '1,200 gems',
    priceString: '₹999',
    kind: 'gems',
    badge: 'Best Value',
  },

  // --- Bundles ---
  {
    id: 'bundle_starter',
    title: 'Champion Bundle',
    description: '8,000 coins + 200 gems',
    priceString: '₹599',
    kind: 'consumable',
    badge: 'Bundle',
  },
  {
    id: 'bundle_legend',
    title: 'Player Legend Edition',
    description:
      'Player-career bundle: 20,000 coins, 600 gems, Remove Ads, VIP energy and cosmetics.',
    priceString: '₹999',
    kind: 'entitlement',
    badge: 'Best Value',
  },

  // --- Entitlements ---
  {
    id: 'remove_ads',
    title: 'VIP Upgrade + Remove Ads',
    description: 'Permanent ad removal, a 60-energy cap, and +20% match coins in either mode.',
    priceString: '₹299',
    kind: 'entitlement',
  },
  {
    id: 'season_pass',
    title: 'Season Pass Premium',
    description:
      '30 days of cosmetics, scenarios, analytics, themes, bonus rewards and ad-free play.',
    priceString: '₹299',
    kind: 'entitlement',
    badge: 'Most Popular',
  },

  // --- Energy ---
  {
    id: 'energy_refill',
    title: 'Energy Refill',
    description: '+30 energy for match play in either mode and Player Career training.',
    priceString: '₹99',
    kind: 'consumable',
  },
  {
    id: 'energy_refill_3',
    title: '3× Energy Refills',
    description: '+90 energy for match play in either mode and Player Career training.',
    priceString: '₹249',
    kind: 'consumable',
    badge: 'Save ₹50',
  },

  // ── Manager-specific IAP ─────────────────────────────────────────────────

  {
    id: 'manager_legend_pack',
    title: 'Manager Legacy Edition',
    description:
      'Permanent Manager backing, an exclusive boardroom and a one-time club operations toolkit.',
    priceString: '₹599',
    kind: 'entitlement',
    badge: 'Manager',
  },
  {
    id: 'transfer_budget_sm',
    title: 'Transfer Budget Boost',
    description:
      'Inject ₹500,000 directly into your transfer budget. The 125% seasonal wage ceiling still applies.',
    priceString: '₹149',
    kind: 'consumable',
    badge: 'Manager',
  },
  {
    id: 'transfer_budget_lg',
    title: 'Mega Budget Injection',
    description: 'Inject ₹2,000,000 into your transfer war chest. Go all-in.',
    priceString: '₹399',
    kind: 'consumable',
    badge: 'Best Deal',
  },
  {
    id: 'scout_full_reveal',
    title: 'Full Scout Intelligence',
    description:
      "Grants one token to reveal a player's true overall, form, fitness, injury and estimated value.",
    priceString: '₹49',
    kind: 'consumable',
    badge: 'Manager',
  },
  {
    id: 'facility_upgrade_token',
    title: 'Instant Facility Upgrade',
    description:
      'Store one token that upgrades any non-maxed facility by one level for no club-budget cost.',
    priceString: '₹149',
    kind: 'consumable',
    badge: 'Manager',
  },
  {
    id: 'recovery_pack',
    title: 'Squad Conditioning Pack',
    description:
      'Store one token for +20 condition, +20 fitness and +15 morale across non-injured players. Injuries are not healed.',
    priceString: '₹99',
    kind: 'consumable',
  },

  // ── Career-player specific IAP ───────────────────────────────────────────

  {
    id: 'contract_boost',
    title: 'Contract Negotiation Boost',
    description:
      'Store one token. It automatically raises your next renewal wage and signing bonus by 25%.',
    priceString: '₹99',
    kind: 'consumable',
    badge: 'Career',
  },
  {
    id: 'form_recovery',
    title: 'Mental Coaching Session',
    description:
      'Immediately restores form to at least 70 and confidence to at least 65. No attributes are changed.',
    priceString: '₹49',
    kind: 'consumable',
  },
  {
    id: 'training_accelerator',
    title: 'Training Accelerator',
    description: "Triple your next 3 training sessions' gains and accelerate development.",
    priceString: '₹149',
    kind: 'consumable',
    badge: 'Popular',
  },
  {
    id: 'legend_status',
    title: 'Living Legend Edition',
    description:
      'Player-career prestige cosmetics. Does not grant stats, selection, trophies or Hall of Fame qualification.',
    priceString: '₹1,999',
    kind: 'entitlement',
    badge: '👑 Prestige',
  },
];

/** Products intentionally surfaced in each active career mode. */
export const MODE_STORE_PRODUCT_IDS = {
  career: ['training_accelerator', 'contract_boost', 'form_recovery'],
  manager: ['scout_full_reveal', 'facility_upgrade_token', 'recovery_pack', 'transfer_budget_sm'],
} as const;

/** Account-wide products that remain useful in either career mode. */
export const SHARED_STORE_PRODUCT_IDS = ['remove_ads'] as const;

/**
 * Gem-exclusive premium items (not IAP — purchased with gems inside the app).
 * These are the gem "sinks" that give gems real purpose beyond coins conversion.
 * These do NOT go through the store flow; they're applied directly in the career store.
 */
export const GEM_SHOP_ITEMS = [
  {
    id: 'gem_skip_training',
    title: 'Skip Training Week',
    description: "Instantly apply this week's training gains without waiting.",
    gemCost: 50,
    icon: '⚡',
  },
  {
    id: 'gem_kit_colour',
    title: 'Premium Kit Colour',
    description: 'Unlock an exclusive kit colour for your player or club.',
    gemCost: 80,
    icon: '🎨',
  },
  {
    id: 'gem_story_reroll',
    title: 'Re-Roll Story Choice',
    description: 'Reset a story event to try a different outcome.',
    gemCost: 40,
    icon: '🎲',
  },
  {
    id: 'gem_scout_reveal',
    title: 'Full Scout Report',
    description: "Instantly reveal a player's true overall — no uncertainty.",
    gemCost: 30,
    icon: '🔍',
  },
  {
    id: 'gem_avatar_unlock',
    title: 'Premium Avatar',
    description: 'Unlock an exclusive player avatar style.',
    gemCost: 120,
    icon: '👤',
  },
  {
    id: 'gem_double_xp',
    title: 'Double XP Weekend',
    description: 'Earn double pass XP for the next 3 matches.',
    gemCost: 60,
    icon: '🌟',
  },
] as const;

/** What each catalog product grants on success (business-facing, not applied here). */
export const GRANTS: Readonly<Record<string, PurchaseGrant>> = {
  starter_pack: { coins: 3_000, gems: 50, entitlement: { removeAds: false } },
  coins_small: { coins: 1_000 },
  coins_medium: { coins: 5_000 },
  coins_large: { coins: 15_000 },
  gems_small: { gems: 80 },
  gems_medium: { gems: 300 },
  gems_large: { gems: 1_200 },
  bundle_starter: { coins: 8_000, gems: 200 },
  bundle_legend: { coins: 20_000, gems: 600, entitlement: { removeAds: true } },
  remove_ads: { entitlement: { removeAds: true } },
  season_pass: { entitlement: {} },
  energy_refill: { energy: 30 },
  energy_refill_3: { energy: 90 },
  // Manager-specific (budget injections handled in store, not wallet)
  transfer_budget_sm: { coins: 0 }, // handled specially in store
  transfer_budget_lg: { coins: 0 }, // handled specially in store
  manager_legend_pack: { coins: 0 }, // manager-only entitlement handled in store
  scout_full_reveal: { gems: 0 }, // handled specially in store
  facility_upgrade_token: { gems: 0 }, // handled specially in store
  recovery_pack: { coins: 0 }, // handled specially in store
  // Career-player specific
  contract_boost: { coins: 0 }, // handled specially in store
  form_recovery: { coins: 0 }, // handled specially in store
  training_accelerator: { coins: 0 }, // handled specially in store
  legend_status: { coins: 0 }, // player prestige cosmetic entitlement handled in store
};

let mockPurchaseSeq = 0;

export const PRICE_UNAVAILABLE = 'Connect to view price';
export const MAX_TRAINING_ACCELERATOR_CHARGES = 6;

export function isProductAvailable(product: Pick<Product, 'priceString'>): boolean {
  return product.priceString !== PRICE_UNAVAILABLE;
}

/**
 * Returns the purchasable catalog. In production we keep our own catalog
 * metadata (title/description/badges) but overlay the store's localized,
 * tax-inclusive price strings from RevenueCat so what we display always
 * matches what the store charges.
 */
export async function getProducts(): Promise<ExtendedProduct[]> {
  if (!MOCK_MODE && isStoreReady()) {
    try {
      const RC = loadRevenueCat();
      const ids = CATALOG.map((p) => p.id);
      const store = await fetchStoreProducts(RC, ids);
      const priceById = new Map(store.map((s) => [s.identifier, s.priceString]));
      return CATALOG.map((p) => ({
        ...p,
        priceString: priceById.get(p.id) ?? PRICE_UNAVAILABLE,
      }));
    } catch {
      // Fall through to the local catalog on any store error.
    }
  }
  if (!MOCK_MODE) {
    return CATALOG.map((p) => ({ ...p, priceString: PRICE_UNAVAILABLE }));
  }
  return CATALOG.map((p) => ({ ...p }));
}

/** Returns only the starter pack if it hasn't been purchased yet. */
export function getStarterPack(): ExtendedProduct {
  return CATALOG.find((p) => p.id === 'starter_pack')!;
}

/**
 * Attempts to purchase a product.
 * In {@link MOCK_MODE} this resolves `ok: true` for any known product so the
 * downstream entitlement/wallet flow can be tested without a store.
 */
export async function purchase(productId: string): Promise<PurchaseResult> {
  const product = CATALOG.find((p) => p.id === productId);
  if (!product) return { ok: false, productId, error: 'unknown_product' };

  if (MOCK_MODE) {
    mockPurchaseSeq += 1;
    const now = Date.now();
    return {
      ok: true,
      productId,
      purchaseToken: `mock:${productId}:${mockPurchaseSeq}`,
      purchaseState: 'PURCHASED',
      verificationState: 'LOCAL_MOCK',
      entitlement:
        productId === 'season_pass'
          ? {
              periodStartedAt: now,
              expiresAt: now + 30 * 24 * 60 * 60 * 1000,
              lastVerifiedAt: now,
              willRenew: true,
            }
          : undefined,
    };
  }

  const RC = loadRevenueCat();
  if (!RC || !_rcConfigured) return { ok: false, productId, error: 'not_configured' };

  try {
    const store = await fetchStoreProducts(RC, [productId]);
    const sku = store.find((s) => s.identifier === productId);
    if (!sku) return { ok: false, productId, error: 'unavailable' };
    const result = await RC.purchaseStoreProduct(sku);
    const token = providerTransactionIdentifier(result);
    if (!token) return { ok: false, productId, error: 'missing_transaction_id' };
    const now = Date.now();
    const entitlement =
      productId === 'season_pass'
        ? providerEntitlementPeriod(
            (result as { customerInfo?: unknown }).customerInfo,
            'season_pass',
            now,
          )
        : undefined;
    if (productId === 'season_pass' && !entitlement) {
      return { ok: false, productId, error: 'season_pass_entitlement_inactive' };
    }
    return {
      ok: true,
      productId,
      purchaseToken: token,
      purchaseState: 'PURCHASED',
      verificationState: 'VERIFIED',
      entitlement,
    };
  } catch (e) {
    const err = e as { userCancelled?: boolean };
    if (err?.userCancelled) return { ok: false, productId, error: 'cancelled' };
    return { ok: false, productId, error: describePurchaseError(e) };
  }
}

/**
 * Restores currently-active non-consumable entitlements. Expired product
 * history is deliberately excluded so a lapsed subscription cannot be revived.
 * (For the mapping to line up, configure RevenueCat entitlement identifiers to
 * match the relevant product ids, e.g. `remove_ads`.)
 */
export async function restore(): Promise<PurchaseResult[]> {
  if (MOCK_MODE) return [];
  const RC = loadRevenueCat();
  if (!RC || !_rcConfigured) return [];
  try {
    const info = await RC.restorePurchases();
    const active: string[] = Object.keys(info?.entitlements?.active ?? {});
    const known = new Set(CATALOG.map((p) => p.id));
    const ids = Array.from(new Set(active)).filter((id) => known.has(id));
    const now = Date.now();
    return ids.map((productId) => ({
      ok: true,
      productId,
      purchaseState: 'PURCHASED' as const,
      verificationState: 'VERIFIED' as const,
      entitlement:
        productId === 'season_pass'
          ? providerEntitlementPeriod(info, 'season_pass', now)
          : undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Pure helper: applies a {@link PurchaseGrant} to a {@link Wallet} and returns a
 * new wallet. Side-effect free — the caller decides when to persist. Preserves
 * `energyUpdatedAt` so energy regen accounting is unaffected.
 */
export function applyGrantToWallet(wallet: Wallet, grant: PurchaseGrant): Wallet {
  return {
    ...wallet,
    coins: wallet.coins + (grant.coins ?? 0),
    gems: wallet.gems + (grant.gems ?? 0),
    energy: wallet.energy + (grant.energy ?? 0),
  };
}
