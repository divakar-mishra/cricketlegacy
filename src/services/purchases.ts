/**
 * In-app purchase (IAP) abstraction.
 *
 * RevenueCat is loaded lazily so Expo Go and tests can run without its native
 * module. Development builds use {@link MOCK_MODE}; release builds remain
 * unavailable until the platform's public SDK key is supplied. All SDK access
 * stays inside this boundary.
 */

import { Platform } from 'react-native';
import type { Entitlements, Wallet } from '../domain/types';
import { currentRecoverableSupabaseUserId } from './supabaseClient';

/**
 * Development-only purchase simulation. `__DEV__` is false in release builds,
 * so this cannot silently grant products in a production binary.
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
 * To go live, create products in the relevant store console with IDs matching
 * the catalog below, map them to RevenueCat entitlements, and provide the
 * platform public SDK keys through the configured `EXPO_PUBLIC_*` variables.
 * ------------------------------------------------------------------------- */
type RevenueCatModule = any; // no static types — the dep may be absent
let _rc: RevenueCatModule | null | undefined;
let _rcConfigured = false;
let _rcIdentityReady = false;
let _rcAppUserId: string | null = null;
let _rcIdentityEpoch = 0;
let _rcIdentitySync: Promise<boolean> | null = null;
let _rcKeys: { ios?: string; android?: string } = {};

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
 * Configure RevenueCat only after Supabase has server-validated a recoverable,
 * non-anonymous account. Passing `appUserID` on the first configure prevents
 * the SDK from generating a purchase-capable anonymous customer.
 */
export async function configurePurchases(keys: { ios?: string; android?: string }): Promise<void> {
  _rcKeys = { ...keys };
  if (MOCK_MODE) return;
  await synchronizePurchaseIdentity();
}

async function synchronizePurchaseIdentityOnce(): Promise<boolean> {
  if (MOCK_MODE) return false;
  const identityEpoch = _rcIdentityEpoch;
  const appUserId = await currentRecoverableSupabaseUserId();
  if (!appUserId || identityEpoch !== _rcIdentityEpoch) {
    _rcIdentityReady = false;
    _rcAppUserId = null;
    return false;
  }
  const RC = loadRevenueCat();
  if (!RC) return false;
  const apiKey = Platform.OS === 'ios' ? _rcKeys.ios : _rcKeys.android;
  if (!apiKey) return false;
  try {
    if (!_rcConfigured) {
      RC.configure({ apiKey, appUserID: appUserId });
      _rcConfigured = true;
    }
    if (_rcAppUserId !== appUserId || !_rcIdentityReady) {
      await RC.logIn(appUserId);
    }
    if (identityEpoch !== _rcIdentityEpoch) return false;
    _rcAppUserId = appUserId;
    _rcIdentityReady = true;
    return true;
  } catch {
    _rcIdentityReady = false;
    _rcAppUserId = null;
    return false;
  }
}

/** Re-checks the Supabase account and synchronizes RevenueCat to its UUID. */
export async function synchronizePurchaseIdentity(): Promise<boolean> {
  if (_rcIdentitySync) return _rcIdentitySync;
  _rcIdentitySync = synchronizePurchaseIdentityOnce().finally(() => {
    _rcIdentitySync = null;
  });
  return _rcIdentitySync;
}

/**
 * Immediately closes every local paid-provider operation on app sign-out.
 * RevenueCat recommends not calling `logOut()` in a custom-ID-only design,
 * because that method creates a new anonymous ID. The next recoverable account
 * switches safely with `logIn()`; no operation can use the cached old identity.
 */
export function clearPurchaseIdentity(): void {
  _rcIdentityEpoch += 1;
  _rcIdentityReady = false;
  _rcAppUserId = null;
}

/** Whether a live purchase backend is ready (SDK loaded + configured). */
export function isStoreReady(): boolean {
  return _rcConfigured && _rcIdentityReady && _rcAppUserId != null && loadRevenueCat() != null;
}

function describePurchaseError(e: unknown): string {
  const err = e as { message?: string; code?: string | number } | undefined;
  if (err?.message) return String(err.message);
  if (err?.code != null) return String(err.code);
  return 'purchase_failed';
}

export type ProductKind = 'coins' | 'gems' | 'consumable' | 'entitlement';
export type StoreProductCategory = 'SUBSCRIPTION' | 'NON_SUBSCRIPTION';
export type SaveSponsorProductId = 'player_save_sponsor' | 'manager_save_sponsor';
export type RestorableProductId =
  'remove_ads' | 'bundle_legend' | 'manager_legend_pack' | 'season_pass';

const SAVE_SPONSOR_PRODUCT_IDS = new Set<SaveSponsorProductId>([
  'player_save_sponsor',
  'manager_save_sponsor',
]);

/**
 * Only durable non-consumables and an active subscription may be restored.
 * Store-consumed currency, boosts, facility tokens and exact-save sponsors are
 * intentionally absent: restoring any of them would duplicate a consumed grant
 * or move a purchase that was explicitly bound to one save.
 */
const RESTORABLE_PRODUCT_IDS = new Set<RestorableProductId>([
  'remove_ads',
  'bundle_legend',
  'manager_legend_pack',
  'season_pass',
]);

/**
 * These products are repeat-purchasable consumables because each checkout is
 * bound to a different save. They must never be treated as account-wide,
 * restorable entitlements.
 */
export function isSaveSponsorProduct(productId: string): productId is SaveSponsorProductId {
  return SAVE_SPONSOR_PRODUCT_IDS.has(productId as SaveSponsorProductId);
}

export function isRestorableProduct(productId: string): productId is RestorableProductId {
  return RESTORABLE_PRODUCT_IDS.has(productId as RestorableProductId);
}

/**
 * Release checkout remains closed until an authenticated backend validates the
 * store receipt and atomically binds its unique transaction to one save. The
 * current Supabase setup stores client-written save JSON and cannot provide
 * that trust boundary. Local mock purchases stay enabled for development.
 */
export function isSaveSponsorCheckoutReady(): boolean {
  return MOCK_MODE;
}

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

/** Extract only the provider entitlements that are safe to restore. */
export function restorableProductIdsFromCustomerInfo(customerInfo: unknown): RestorableProductId[] {
  if (!customerInfo || typeof customerInfo !== 'object') return [];
  const active = (
    customerInfo as { entitlements?: { active?: Record<string, ProviderEntitlement> } }
  ).entitlements?.active;
  if (!active) return [];
  return Object.keys(active).filter(
    (productId): productId is RestorableProductId =>
      isRestorableProduct(productId) && activeProviderEntitlement(customerInfo, productId) != null,
  );
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
  if (!(await synchronizePurchaseIdentity())) return { status: 'UNAVAILABLE' };
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
 *  RevenueCat/store metadata remains authoritative for production prices.
 *  RevenueCat will provide locale-aware prices in production.
 */
const CATALOG: readonly ExtendedProduct[] = [
  // --- Starter Pack (24-hour contextual, only shown once) ---
  {
    id: 'starter_pack',
    title: 'Starter Pack',
    description: '3,000 coins · 50 gems · 7 ad-free days',
    priceString: '₹99',
    kind: 'consumable',
    badge: 'New Player Offer',
    isLimitedTime: true,
    offerHours: STARTER_PACK_OFFER_HOURS,
  },

  // --- Coins ---
  {
    id: 'coins_medium',
    title: 'Bag of Coins',
    description: '10,000 coins',
    priceString: '₹299',
    kind: 'coins',
    badge: 'Good Value',
  },
  {
    id: 'coins_large',
    title: 'Sack of Coins',
    description: '20,000 coins',
    priceString: '₹499',
    kind: 'coins',
    badge: 'Best Value',
  },

  // --- Gems ---
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
    id: 'bundle_legend',
    title: 'Player Legend Edition',
    description: '40,000 coins · 1,200 gems · No ads · 60 energy · Cosmetics',
    priceString: '₹999',
    kind: 'entitlement',
    badge: 'Best Value',
  },

  // --- Entitlements ---
  {
    id: 'remove_ads',
    title: 'VIP Upgrade + Remove Ads',
    description: 'No ads · 60 energy · +20% match coins',
    priceString: '₹299',
    kind: 'entitlement',
  },
  {
    id: 'season_pass',
    title: 'Season Pass Premium',
    description: '30 days · Rewards, stories, themes and no ads',
    priceString: '₹299',
    kind: 'entitlement',
    badge: 'Most Popular',
  },

  // ── Manager-specific IAP ─────────────────────────────────────────────────

  {
    id: 'manager_legend_pack',
    title: 'Manager Legacy Edition',
    description: 'Permanent backing · Boardroom · Toolkit',
    priceString: '₹599',
    kind: 'entitlement',
    badge: 'Manager',
  },
  {
    id: 'transfer_budget_sm',
    title: 'Transfer Budget Boost',
    description: '+₹500,000 transfer budget · Once per season',
    priceString: '₹149',
    kind: 'consumable',
    badge: 'Manager',
  },
  {
    id: 'scout_full_reveal',
    title: 'Full Scout Intelligence',
    description: 'Reveal OVR, form, fitness, injury and value',
    priceString: '₹49',
    kind: 'consumable',
    badge: 'Manager',
  },
  {
    id: 'facility_upgrade_token',
    title: 'Instant Facility Upgrade',
    description:
      'Optional shortcut for one facility level. Club Balance upgrades stay available; normal upkeep still applies.',
    priceString: '₹199',
    kind: 'consumable',
    badge: 'Manager',
  },
  {
    id: 'recovery_pack',
    title: 'Squad Conditioning Pack',
    description:
      '1 token gives non-injured players +20 condition, +20 fitness and +15 morale. No injury healing.',
    priceString: '₹99',
    kind: 'consumable',
  },

  // ── Career-player specific IAP ───────────────────────────────────────────

  {
    id: 'contract_boost',
    title: 'Contract Negotiation Boost',
    description: '+25% next renewal wage and signing bonus',
    priceString: '₹99',
    kind: 'consumable',
    badge: 'Career',
  },
  {
    id: 'form_recovery',
    title: 'Mental Coaching Session',
    description:
      'Sets form to at least 70 and confidence to at least 65. Attributes stay unchanged.',
    priceString: '₹49',
    kind: 'consumable',
  },
  {
    id: 'training_accelerator',
    title: 'Training Accelerator',
    description: '1.5× gains · Next 3 sessions',
    priceString: '₹149',
    kind: 'consumable',
    badge: 'Popular',
  },
  {
    id: 'player_save_sponsor',
    title: 'Legacy Crown — Player Sponsor',
    description: 'Extra kit slot · Weekly Wallet Coins · This save',
    priceString: '₹499',
    kind: 'consumable',
    badge: 'Save Only',
  },
  {
    id: 'manager_save_sponsor',
    title: 'Legacy Crown — Manager Sponsor',
    description: 'Extra kit slot · Weekly Club Balance · This save',
    priceString: '₹499',
    kind: 'consumable',
    badge: 'Save Only',
  },
];

/** Products intentionally surfaced in each active career mode. */
export const MODE_STORE_PRODUCT_IDS = {
  career: ['training_accelerator', 'contract_boost', 'form_recovery', 'player_save_sponsor'],
  manager: [
    'scout_full_reveal',
    'facility_upgrade_token',
    'recovery_pack',
    'transfer_budget_sm',
    'manager_save_sponsor',
  ],
} as const;

/** Account-wide products that remain useful in either career mode. */
export const SHARED_STORE_PRODUCT_IDS = ['remove_ads'] as const;

/** What each catalog product grants on success (business-facing, not applied here). */
export const GRANTS: Readonly<Record<string, PurchaseGrant>> = {
  starter_pack: { coins: 3_000, gems: 50, entitlement: { removeAds: false } },
  coins_medium: { coins: 10_000 },
  coins_large: { coins: 20_000 },
  gems_medium: { gems: 300 },
  gems_large: { gems: 1_200 },
  bundle_legend: { coins: 40_000, gems: 1_200, entitlement: { removeAds: true } },
  remove_ads: { entitlement: { removeAds: true } },
  season_pass: { entitlement: {} },
  // Manager-specific (budget injections handled in store, not wallet)
  transfer_budget_sm: { coins: 0 }, // handled specially in store
  manager_legend_pack: { coins: 0 }, // manager-only entitlement handled in store
  scout_full_reveal: { gems: 0 }, // handled specially in store
  facility_upgrade_token: { gems: 0 }, // handled specially in store
  recovery_pack: { coins: 0 }, // handled specially in store
  // Career-player specific
  contract_boost: { coins: 0 }, // handled specially in store
  form_recovery: { coins: 0 }, // handled specially in store
  training_accelerator: { coins: 0 }, // handled specially in store
  player_save_sponsor: { coins: 0 }, // verified one-save grant handled in store
  manager_save_sponsor: { coins: 0 }, // verified one-save grant handled in store
};

let mockPurchaseSeq = 0;

export const PRICE_UNAVAILABLE = 'Connect to view price';
export const MAX_TRAINING_ACCELERATOR_CHARGES = 6;

export function isProductAvailable(product: Pick<Product, 'priceString'>): boolean {
  return product.priceString !== PRICE_UNAVAILABLE;
}

/**
 * Returns the purchasable catalog. In production we keep our own catalog
 * metadata (title/description) but overlay the store's localized,
 * tax-inclusive price strings from RevenueCat so what we display always
 * matches what the store charges.
 */
export async function getProducts(): Promise<ExtendedProduct[]> {
  if (!MOCK_MODE && (await synchronizePurchaseIdentity()) && isStoreReady()) {
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

/**
 * Attempts to purchase a product.
 * In {@link MOCK_MODE} this resolves `ok: true` for any known product so the
 * downstream entitlement/wallet flow can be tested without a store.
 */
export async function purchase(productId: string): Promise<PurchaseResult> {
  const product = CATALOG.find((p) => p.id === productId);
  if (!product) return { ok: false, productId, error: 'unknown_product' };
  if (isSaveSponsorProduct(productId) && !isSaveSponsorCheckoutReady()) {
    return { ok: false, productId, error: 'save_sponsor_checkout_not_ready' };
  }

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

  if (!(await synchronizePurchaseIdentity())) {
    return { ok: false, productId, error: 'recoverable_sign_in_required' };
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

export type RestoreStatus = 'RESTORED' | 'NOTHING_TO_RESTORE' | 'NOT_CONFIGURED' | 'FAILED';

export interface RestoreResult {
  status: RestoreStatus;
  purchases: PurchaseResult[];
  error?: string;
}

/**
 * Restores currently-active non-consumable entitlements and subscriptions.
 * Expired history and every consumable are excluded. For the mapping to line
 * up, RevenueCat entitlement identifiers must match the durable product ids
 * (for example `remove_ads`). This must only be called from a user action,
 * because the platform may present an account sign-in prompt.
 */
export async function restore(): Promise<RestoreResult> {
  if (MOCK_MODE) return { status: 'NOTHING_TO_RESTORE', purchases: [] };
  if (!(await synchronizePurchaseIdentity())) {
    return {
      status: 'NOT_CONFIGURED',
      purchases: [],
      error: 'recoverable_sign_in_required',
    };
  }
  const RC = loadRevenueCat();
  if (!RC || !_rcConfigured) {
    return { status: 'NOT_CONFIGURED', purchases: [], error: 'not_configured' };
  }
  try {
    const info = await RC.restorePurchases();
    const ids = restorableProductIdsFromCustomerInfo(info);
    const now = Date.now();
    const restored = ids.flatMap((productId): PurchaseResult[] => {
      const entitlement =
        productId === 'season_pass'
          ? providerEntitlementPeriod(info, 'season_pass', now)
          : undefined;
      // An active subscription without a valid future period must not unlock
      // premium access. Permanent products legitimately have no expiry.
      if (productId === 'season_pass' && !entitlement) return [];
      return [
        {
          ok: true,
          productId,
          purchaseState: 'PURCHASED' as const,
          verificationState: 'VERIFIED' as const,
          entitlement,
        },
      ];
    });
    return restored.length > 0
      ? { status: 'RESTORED', purchases: restored }
      : { status: 'NOTHING_TO_RESTORE', purchases: [] };
  } catch (error) {
    return { status: 'FAILED', purchases: [], error: describePurchaseError(error) };
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
