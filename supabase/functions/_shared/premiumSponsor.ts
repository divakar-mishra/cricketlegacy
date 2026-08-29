import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.110.1';

export const PREMIUM_SPONSOR_PRODUCTS = {
  player_save_sponsor: 'career',
  manager_save_sponsor: 'manager',
} as const;

export type PremiumSponsorProductId = keyof typeof PREMIUM_SPONSOR_PRODUCTS;
export type PremiumSponsorMode = (typeof PREMIUM_SPONSOR_PRODUCTS)[PremiumSponsorProductId];
export type RevenueCatStore = 'APP_STORE' | 'PLAY_STORE';
export type RevenueCatEnvironment = 'SANDBOX' | 'PRODUCTION';

export interface SponsorProductMapping {
  revenueCatProductId: string;
  storeProductId: string;
  appId: string;
}

const MAX_BODY_BYTES = 8 * 1024 * 1024 + 64 * 1024;
const WEBHOOK_TOLERANCE_SECONDS = 300;

export interface SponsorServerConfig {
  checkoutEnabled: boolean;
  supabaseUrl: string;
  serviceRoleKey: string;
  revenueCatSecretApiKey: string;
  revenueCatProjectId: string;
  webhookAuthorization: string;
  webhookHmacSecret: string;
  transactionPepper: string;
  webhookAuditDays: number;
  allowedProducts: ReadonlySet<PremiumSponsorProductId>;
  allowedEnvironments: ReadonlySet<RevenueCatEnvironment>;
  storeAppIds: ReadonlyMap<RevenueCatStore, string>;
  productStoreMappings: ReadonlyMap<
    PremiumSponsorProductId,
    ReadonlyMap<RevenueCatStore, SponsorProductMapping>
  >;
}

export interface VerifiedRevenueCatPurchase {
  transactionId: string;
  originalTransactionId?: string;
  purchasedAt: string;
  store: RevenueCatStore;
  environment: RevenueCatEnvironment;
  revenueCatAppId: string;
}

export interface PurchaseBindingRow {
  id: string;
  product_id: PremiumSponsorProductId;
  save_id: string;
  status: 'ACTIVE' | 'REVOKED' | 'TRANSFER_BLOCKED' | 'REVERSAL_REVIEW';
  transaction_id: string;
  original_transaction_id?: string | null;
  store: RevenueCatStore;
  environment: RevenueCatEnvironment;
  revenuecat_app_id: string;
  last_verified_at: string;
  offline_grace_expires_at: string;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing_server_secret:${name}`);
  return value;
}

function commaSet(name: string): Set<string> {
  return new Set(
    requireEnv(name)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function isProduct(value: string): value is PremiumSponsorProductId {
  return Object.hasOwn(PREMIUM_SPONSOR_PRODUCTS, value);
}

function isEnvironment(value: string): value is RevenueCatEnvironment {
  return value === 'SANDBOX' || value === 'PRODUCTION';
}

function isStore(value: string): value is RevenueCatStore {
  return value === 'APP_STORE' || value === 'PLAY_STORE';
}

function parseProductStoreMappings(): {
  allowedProducts: Set<PremiumSponsorProductId>;
  storeAppIds: Map<RevenueCatStore, string>;
  productStoreMappings: Map<
    PremiumSponsorProductId,
    ReadonlyMap<RevenueCatStore, SponsorProductMapping>
  >;
} {
  let rawMappings: unknown;
  try {
    rawMappings = JSON.parse(requireEnv('REVENUECAT_SPONSOR_PRODUCTS_JSON'));
  } catch {
    throw new Error('invalid_server_allowlist:REVENUECAT_SPONSOR_PRODUCTS_JSON');
  }
  if (!rawMappings || typeof rawMappings !== 'object' || Array.isArray(rawMappings)) {
    throw new Error('invalid_server_allowlist:REVENUECAT_SPONSOR_PRODUCTS_JSON');
  }

  const allowedProducts = new Set<PremiumSponsorProductId>();
  const storeAppIds = new Map<RevenueCatStore, string>();
  const productStoreMappings = new Map<
    PremiumSponsorProductId,
    ReadonlyMap<RevenueCatStore, SponsorProductMapping>
  >();
  for (const [productId, rawStores] of Object.entries(rawMappings)) {
    if (
      !isProduct(productId) ||
      !rawStores ||
      typeof rawStores !== 'object' ||
      Array.isArray(rawStores)
    ) {
      throw new Error('invalid_server_allowlist:REVENUECAT_SPONSOR_PRODUCTS_JSON');
    }
    const stores = new Map<RevenueCatStore, SponsorProductMapping>();
    for (const [store, rawMapping] of Object.entries(rawStores as Record<string, unknown>)) {
      if (
        !isStore(store) ||
        !rawMapping ||
        typeof rawMapping !== 'object' ||
        Array.isArray(rawMapping)
      ) {
        throw new Error('invalid_server_allowlist:REVENUECAT_SPONSOR_PRODUCTS_JSON');
      }
      const mapping = rawMapping as Record<string, unknown>;
      if (
        typeof mapping.revenueCatProductId !== 'string' ||
        !/^prod[a-zA-Z0-9_-]{3,251}$/.test(mapping.revenueCatProductId) ||
        typeof mapping.storeProductId !== 'string' ||
        !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/.test(mapping.storeProductId) ||
        typeof mapping.appId !== 'string' ||
        !/^app[a-zA-Z0-9_-]{3,252}$/.test(mapping.appId)
      ) {
        throw new Error('invalid_server_allowlist:REVENUECAT_SPONSOR_PRODUCTS_JSON');
      }
      const existingAppId = storeAppIds.get(store);
      if (existingAppId && existingAppId !== mapping.appId) {
        throw new Error('invalid_server_allowlist:REVENUECAT_SPONSOR_PRODUCTS_JSON');
      }
      const existingStoreForApp = [...storeAppIds.entries()].find(
        ([configuredStore, configuredAppId]) =>
          configuredAppId === mapping.appId && configuredStore !== store,
      );
      if (existingStoreForApp) {
        throw new Error('invalid_server_allowlist:REVENUECAT_SPONSOR_PRODUCTS_JSON');
      }
      const duplicateStoreProduct = [...productStoreMappings.values()].some(
        (configuredStores) =>
          configuredStores.get(store)?.storeProductId === mapping.storeProductId,
      );
      if (duplicateStoreProduct) {
        throw new Error('invalid_server_allowlist:REVENUECAT_SPONSOR_PRODUCTS_JSON');
      }
      storeAppIds.set(store, mapping.appId);
      stores.set(store, {
        revenueCatProductId: mapping.revenueCatProductId,
        storeProductId: mapping.storeProductId,
        appId: mapping.appId,
      });
    }
    if (stores.size === 0) {
      throw new Error('invalid_server_allowlist:REVENUECAT_SPONSOR_PRODUCTS_JSON');
    }
    allowedProducts.add(productId);
    productStoreMappings.set(productId, stores);
  }
  if (allowedProducts.size === 0 || storeAppIds.size === 0) {
    throw new Error('invalid_server_allowlist:REVENUECAT_SPONSOR_PRODUCTS_JSON');
  }
  return { allowedProducts, storeAppIds, productStoreMappings };
}

/**
 * Loads the complete production configuration and fails closed. Merely setting
 * a Supabase URL is not enough to enable a paid checkout.
 */
export function loadSponsorServerConfig(): SponsorServerConfig {
  const checkoutFlag = requireEnv('PREMIUM_SPONSOR_CHECKOUT_ENABLED');
  if (checkoutFlag !== 'true' && checkoutFlag !== 'false') {
    throw new Error('invalid_server_allowlist:PREMIUM_SPONSOR_CHECKOUT_ENABLED');
  }

  const environments = commaSet('REVENUECAT_ALLOWED_ENVIRONMENTS');
  if (environments.size === 0 || [...environments].some((value) => !isEnvironment(value))) {
    throw new Error('invalid_server_allowlist:REVENUECAT_ALLOWED_ENVIRONMENTS');
  }
  const { allowedProducts, storeAppIds, productStoreMappings } = parseProductStoreMappings();

  const webhookHmacSecret = requireEnv('REVENUECAT_WEBHOOK_HMAC_SECRET');
  if (webhookHmacSecret.length < 32) {
    throw new Error('weak_server_secret:REVENUECAT_WEBHOOK_HMAC_SECRET');
  }
  const webhookAuthorization = requireEnv('REVENUECAT_WEBHOOK_AUTHORIZATION');
  if (webhookAuthorization.length < 24) {
    throw new Error('weak_server_secret:REVENUECAT_WEBHOOK_AUTHORIZATION');
  }
  const revenueCatProjectId = requireEnv('REVENUECAT_PROJECT_ID');
  if (!/^proj[a-zA-Z0-9_-]{3,251}$/.test(revenueCatProjectId)) {
    throw new Error('invalid_server_allowlist:REVENUECAT_PROJECT_ID');
  }
  const revenueCatSecretApiKey = requireEnv('REVENUECAT_SECRET_API_KEY');
  if (!revenueCatSecretApiKey.startsWith('sk_') || revenueCatSecretApiKey.length < 24) {
    throw new Error('invalid_server_secret:REVENUECAT_SECRET_API_KEY');
  }
  const transactionPepper = requireEnv('PREMIUM_SPONSOR_TRANSACTION_PEPPER');
  if (transactionPepper.length < 32) {
    throw new Error('weak_server_secret:PREMIUM_SPONSOR_TRANSACTION_PEPPER');
  }
  const webhookAuditDays = Number(requireEnv('PREMIUM_SPONSOR_WEBHOOK_AUDIT_DAYS'));
  if (!Number.isInteger(webhookAuditDays) || webhookAuditDays < 1 || webhookAuditDays > 3650) {
    throw new Error('invalid_server_allowlist:PREMIUM_SPONSOR_WEBHOOK_AUDIT_DAYS');
  }

  return {
    checkoutEnabled: checkoutFlag === 'true',
    supabaseUrl: requireEnv('SUPABASE_URL'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    revenueCatSecretApiKey,
    revenueCatProjectId,
    webhookAuthorization,
    webhookHmacSecret,
    transactionPepper,
    webhookAuditDays,
    allowedProducts,
    allowedEnvironments: environments as Set<RevenueCatEnvironment>,
    storeAppIds,
    productStoreMappings,
  };
}

/** Only creation and confirmation are disabled by the checkout kill switch. */
export function assertSponsorCheckoutEnabled(config: SponsorServerConfig): void {
  if (!config.checkoutEnabled) throw new Error('premium_sponsor_checkout_disabled');
}

export function adminClient(config: SponsorServerConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')?.trim() ?? '';
  const match = /^Bearer\s+([^\s]+)$/i.exec(header);
  return match?.[1] ?? null;
}

function hasRecoverableIdentity(user: User): boolean {
  if (user.is_anonymous === true) return false;
  if (typeof user.email === 'string' && user.email.length > 0) return true;
  if (typeof user.phone === 'string' && user.phone.length > 0) return true;
  return (user.identities ?? []).some((identity) => identity.provider !== 'anonymous');
}

/** Verifies the JWT against Supabase Auth and rejects device-only/anonymous identities. */
export async function authenticateRecoverableUser(
  request: Request,
  admin: SupabaseClient,
): Promise<User> {
  const token = bearerToken(request);
  if (!token) throw new HttpError(401, 'authenticated_account_required');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'invalid_auth_session');
  if (!hasRecoverableIdentity(data.user)) {
    throw new HttpError(403, 'recoverable_sign_in_required');
  }
  return data.user;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail?: string,
  ) {
    super(code);
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonResponse({ ok: false, error: error.code, detail: error.detail }, error.status);
  }
  const code = error instanceof Error ? error.message : 'internal_error';
  const configurationFailure =
    code.startsWith('missing_server_secret:') ||
    code.startsWith('invalid_server_allowlist:') ||
    code.startsWith('invalid_server_secret:') ||
    code.startsWith('weak_server_secret:') ||
    code === 'premium_sponsor_checkout_disabled';
  // Never return a secret or upstream body to the client.
  return jsonResponse(
    {
      ok: false,
      error: configurationFailure ? 'premium_sponsor_checkout_unavailable' : 'internal_error',
    },
    configurationFailure ? 503 : 500,
  );
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new HttpError(413, 'request_too_large');
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new HttpError(413, 'request_too_large');
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

/** Stable JSON used only to hash the server-held recovery snapshot. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null;
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
}

export function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

function exactSecretEqual(actual: string, expected: string): boolean {
  return constantTimeEqual(new TextEncoder().encode(actual), new TextEncoder().encode(expected));
}

/** Validates RevenueCat's raw-body HMAC and five-minute replay window. */
export async function verifyRevenueCatWebhook(
  request: Request,
  rawBody: string,
  config: SponsorServerConfig,
  nowMs = Date.now(),
): Promise<void> {
  const authorization = request.headers.get('authorization') ?? '';
  if (!exactSecretEqual(authorization, config.webhookAuthorization)) {
    throw new HttpError(401, 'invalid_webhook_authorization');
  }
  const signatureHeader = request.headers.get('x-revenuecat-webhook-signature') ?? '';
  const parts = Object.fromEntries(
    signatureHeader.split(',').flatMap((part) => {
      const index = part.indexOf('=');
      return index > 0 ? [[part.slice(0, index).trim(), part.slice(index + 1).trim()]] : [];
    }),
  );
  if (!/^\d{10}$/.test(parts.t ?? '') || !/^[0-9a-f]{64}$/i.test(parts.v1 ?? '')) {
    throw new HttpError(401, 'invalid_webhook_signature');
  }
  const timestamp = Number(parts.t);
  if (Math.abs(Math.floor(nowMs / 1000) - timestamp) > WEBHOOK_TOLERANCE_SECONDS) {
    throw new HttpError(401, 'stale_webhook_signature');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(config.webhookHmacSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const computed = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${parts.t}.${rawBody}`)),
  );
  const expected = hexToBytes(parts.v1);
  if (!expected || !constantTimeEqual(computed, expected)) {
    throw new HttpError(401, 'invalid_webhook_signature');
  }
}

export function parseProduct(value: unknown, config: SponsorServerConfig): PremiumSponsorProductId {
  if (typeof value !== 'string' || !isProduct(value) || !config.allowedProducts.has(value)) {
    throw new HttpError(400, 'unsupported_product');
  }
  return value;
}

export function parseModeForProduct(
  value: unknown,
  productId: PremiumSponsorProductId,
): PremiumSponsorMode {
  if (value !== PREMIUM_SPONSOR_PRODUCTS[productId]) {
    throw new HttpError(400, 'product_mode_mismatch');
  }
  return value;
}

export function parseSaveId(value: unknown, mode: PremiumSponsorMode): string {
  if (typeof value !== 'string' || !new RegExp(`^${mode}-[A-Za-z0-9_-]{1,112}$`).test(value)) {
    throw new HttpError(400, 'invalid_save_id');
  }
  return value;
}

export function parseSaveSlot(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 6) {
    throw new HttpError(400, 'invalid_save_slot');
  }
  return Number(value);
}

export function parseIdempotencyKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9:_-]{16,128}$/.test(value)) {
    throw new HttpError(400, 'invalid_idempotency_key');
  }
  return value;
}

export function parseSnapshot(
  value: unknown,
  saveId: string,
  mode: PremiumSponsorMode,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'invalid_save_snapshot');
  }
  const snapshot = value as Record<string, unknown>;
  if (
    snapshot.id !== saveId ||
    snapshot.mode !== mode ||
    !Number.isInteger(snapshot.schemaVersion) ||
    typeof snapshot.updatedAt !== 'number'
  ) {
    throw new HttpError(400, 'save_snapshot_mismatch');
  }
  return snapshot;
}

function normalizedStore(value: unknown): RevenueCatStore | null {
  if (typeof value !== 'string') return null;
  switch (value.toLowerCase()) {
    case 'app_store':
      return 'APP_STORE';
    case 'play_store':
      return 'PLAY_STORE';
    default:
      return null;
  }
}

/**
 * Looks up the exact one-time store transaction through RevenueCat API v2.
 * The response is accepted only when account, original account, product,
 * store, app, environment, ownership, quantity and live status all match the
 * server configuration. The client-provided transaction ID alone grants
 * nothing.
 */
export async function fetchRevenueCatPurchase(
  appUserId: string,
  productId: PremiumSponsorProductId,
  transactionId: string,
  config: SponsorServerConfig,
): Promise<VerifiedRevenueCatPurchase | null> {
  if (transactionId.length < 1 || transactionId.length > 255) {
    throw new HttpError(400, 'invalid_transaction_id');
  }
  let response: Response;
  try {
    response = await fetch(
      `https://api.revenuecat.com/v2/projects/${encodeURIComponent(config.revenueCatProjectId)}/purchases?store_purchase_identifier=${encodeURIComponent(transactionId)}`,
      {
        headers: {
          authorization: `Bearer ${config.revenueCatSecretApiKey}`,
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(8_000),
      },
    );
  } catch {
    throw new HttpError(503, 'purchase_verification_unavailable');
  }
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new HttpError(503, 'purchase_verification_unavailable');
  }
  let body: unknown;
  try {
    body = (await response.json()) as unknown;
  } catch {
    throw new HttpError(502, 'invalid_purchase_verification_response');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(502, 'invalid_purchase_verification_response');
  }
  const items = (body as Record<string, unknown>).items;
  if (!Array.isArray(items)) {
    throw new HttpError(502, 'invalid_purchase_verification_response');
  }
  const matches = items.filter(
    (value): value is Record<string, unknown> =>
      Boolean(value) &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      String((value as Record<string, unknown>).store_purchase_identifier ?? '') === transactionId,
  );
  if (matches.length === 0) return null;
  if (matches.length !== 1) {
    throw new HttpError(409, 'ambiguous_store_transaction');
  }

  const purchase = matches[0];
  if (
    purchase.object !== 'purchase' ||
    purchase.customer_id !== appUserId ||
    purchase.original_customer_id !== appUserId
  ) {
    throw new HttpError(409, 'purchase_identity_mismatch');
  }
  const store = normalizedStore(purchase.store);
  if (!store) throw new HttpError(403, 'store_not_allowed');
  const mapping = config.productStoreMappings.get(productId)?.get(store);
  if (!mapping || config.storeAppIds.get(store) !== mapping.appId) {
    throw new HttpError(403, 'product_store_not_allowed');
  }
  if (purchase.product_id !== mapping.revenueCatProductId) {
    throw new HttpError(409, 'purchase_product_mismatch');
  }
  const rawEnvironment =
    typeof purchase.environment === 'string' ? purchase.environment.toUpperCase() : '';
  if (!isEnvironment(rawEnvironment) || !config.allowedEnvironments.has(rawEnvironment)) {
    throw new HttpError(403, 'purchase_environment_not_allowed');
  }
  if (purchase.status !== 'owned') {
    throw new HttpError(409, 'purchase_not_owned');
  }
  if (purchase.ownership !== 'purchased') {
    throw new HttpError(409, 'purchase_ownership_not_allowed');
  }
  if (purchase.quantity !== 1) {
    throw new HttpError(409, 'purchase_quantity_not_supported');
  }
  if (
    typeof purchase.purchased_at !== 'number' ||
    !Number.isSafeInteger(purchase.purchased_at) ||
    purchase.purchased_at < 0
  ) {
    throw new HttpError(502, 'invalid_purchase_verification_response');
  }
  const purchasedAt = new Date(purchase.purchased_at);
  if (!Number.isFinite(purchasedAt.getTime())) {
    throw new HttpError(502, 'invalid_purchase_verification_response');
  }
  return {
    transactionId,
    purchasedAt: purchasedAt.toISOString(),
    store,
    environment: rawEnvironment,
    revenueCatAppId: mapping.appId,
  };
}

export function assertSponsorProductMapping(
  productId: PremiumSponsorProductId,
  store: RevenueCatStore,
  appId: string,
  config: SponsorServerConfig,
): void {
  const mapping = config.productStoreMappings.get(productId)?.get(store);
  if (!mapping || mapping.appId !== appId || config.storeAppIds.get(store) !== appId) {
    throw new HttpError(403, 'webhook_product_app_store_mismatch');
  }
}

/** Maps a webhook's store-facing product ID to the canonical save product. */
export function resolveWebhookProduct(
  storeProductId: unknown,
  store: RevenueCatStore,
  appId: string,
  config: SponsorServerConfig,
): PremiumSponsorProductId | null {
  if (typeof storeProductId !== 'string') return null;
  for (const productId of config.allowedProducts) {
    const mapping = config.productStoreMappings.get(productId)?.get(store);
    if (mapping?.appId === appId && mapping.storeProductId === storeProductId) {
      return productId;
    }
  }
  return null;
}

export function parseWebhookEnvironment(
  value: unknown,
  config: SponsorServerConfig,
): RevenueCatEnvironment {
  if (
    typeof value !== 'string' ||
    !isEnvironment(value) ||
    !config.allowedEnvironments.has(value)
  ) {
    throw new HttpError(403, 'webhook_environment_not_allowed');
  }
  return value;
}

export function parseWebhookStore(value: unknown, config: SponsorServerConfig): RevenueCatStore {
  if (typeof value !== 'string' || !isStore(value) || !config.storeAppIds.has(value)) {
    throw new HttpError(403, 'webhook_store_not_allowed');
  }
  return value;
}

export function assertWebhookAppId(
  appId: unknown,
  store: RevenueCatStore | null,
  config: SponsorServerConfig,
): string {
  if (typeof appId !== 'string' || ![...config.storeAppIds.values()].includes(appId)) {
    throw new HttpError(403, 'webhook_app_not_allowed');
  }
  if (store && config.storeAppIds.get(store) !== appId) {
    throw new HttpError(403, 'webhook_app_store_mismatch');
  }
  return appId;
}

export function stringField(value: unknown, code: string, maxLength = 512): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > maxLength) {
    throw new HttpError(400, code);
  }
  return value;
}

export function millisecondDate(value: unknown, code: string): string {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new HttpError(400, code);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new HttpError(400, code);
  return date.toISOString();
}

export function uniqueSubjectIds(event: Record<string, unknown>): string[] {
  const values = [
    event.app_user_id,
    event.original_app_user_id,
    ...(Array.isArray(event.aliases) ? event.aliases : []),
    ...(Array.isArray(event.transferred_from) ? event.transferred_from : []),
    ...(Array.isArray(event.transferred_to) ? event.transferred_to : []),
  ];
  return [
    ...new Set(
      values.filter((value): value is string => typeof value === 'string' && value.length > 0),
    ),
  ];
}

export function accessState(row: PurchaseBindingRow, nowMs = Date.now()): string {
  if (row.status !== 'ACTIVE') return row.status;
  return Date.parse(row.offline_grace_expires_at) >= nowMs
    ? 'ACTIVE_OR_OFFLINE_GRACE'
    : 'VERIFICATION_REQUIRED';
}
