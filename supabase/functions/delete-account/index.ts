import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.110.1';

type RequestStatusRow = { status: 'processing' | 'succeeded' | 'failed'; attempt_count: number };
type RevenueCatDeletionConfig = { projectId: string; secretApiKey: string };

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function json(status: number, body: Record<string, unknown>, extraHeaders = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function env(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization')?.trim();
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

function allowedCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin');
  const allowed = Deno.env.get('ACCOUNT_DELETION_ALLOWED_ORIGIN')?.trim();
  if (!origin || !allowed || origin !== allowed) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

async function hmacAccountReference(userId: string, secret: string): Promise<string> {
  if (secret.length < 32) throw new Error('weak_account_deletion_hmac_secret');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(userId));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

function requestRetentionDays(): number {
  const value = Number(env('ACCOUNT_DELETION_REQUEST_RETENTION_DAYS'));
  if (!Number.isInteger(value) || value < 1 || value > 3650) {
    throw new Error('invalid_account_deletion_request_retention_days');
  }
  return value;
}

function purchaseAuditRetentionDays(): number {
  const value = Number(env('ACCOUNT_DELETION_PURCHASE_AUDIT_DAYS'));
  if (!Number.isInteger(value) || value < 1 || value > 3650) {
    throw new Error('invalid_account_deletion_purchase_audit_days');
  }
  return value;
}

function storageBuckets(): string[] {
  const raw = Deno.env.get('ACCOUNT_DELETION_STORAGE_BUCKETS')?.trim();
  if (!raw) return [];
  const buckets = [
    ...new Set(
      raw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  if (buckets.some((bucket) => !/^[a-z0-9][a-z0-9._-]{0,62}$/.test(bucket))) {
    throw new Error('invalid_account_deletion_storage_buckets');
  }
  return buckets;
}

function explicitBooleanEnv(name: string): boolean {
  const value = env(name);
  if (value !== 'true' && value !== 'false') {
    throw new Error(`invalid_${name.toLowerCase()}`);
  }
  return value === 'true';
}

function revenueCatDeletionConfig(): RevenueCatDeletionConfig | null {
  const checkoutEnabled = explicitBooleanEnv('PREMIUM_SPONSOR_CHECKOUT_ENABLED');
  const anyIapEnabled = explicitBooleanEnv('REVENUECAT_ANY_IAP_ENABLED');
  const uuidIdentityEnabled = explicitBooleanEnv('REVENUECAT_USES_SUPABASE_UUID_IDENTITY');
  const deletionEnabled = explicitBooleanEnv('REVENUECAT_CUSTOMER_DELETION_ENABLED');
  if (checkoutEnabled && !anyIapEnabled) {
    throw new Error('invalid_revenuecat_any_iap_enabled');
  }
  if (anyIapEnabled && (!deletionEnabled || !uuidIdentityEnabled)) {
    throw new Error('invalid_revenuecat_iap_deletion_contract');
  }
  if (deletionEnabled && !uuidIdentityEnabled) {
    throw new Error('invalid_revenuecat_customer_deletion_enabled');
  }
  if (!deletionEnabled) return null;

  const projectId = env('REVENUECAT_PROJECT_ID');
  const secretApiKey = env('REVENUECAT_CUSTOMER_DELETION_SECRET_API_KEY');
  if (!/^proj[a-zA-Z0-9_-]{3,251}$/.test(projectId)) {
    throw new Error('invalid_revenuecat_project_id');
  }
  if (!secretApiKey.startsWith('sk_') || secretApiKey.length < 24) {
    throw new Error('invalid_revenuecat_customer_deletion_secret_api_key');
  }
  return { projectId, secretApiKey };
}

async function deleteRevenueCatCustomer(
  userId: string,
  config: RevenueCatDeletionConfig | null,
): Promise<void> {
  if (!config) return;
  let response: Response;
  try {
    response = await fetch(
      `https://api.revenuecat.com/v2/projects/${encodeURIComponent(config.projectId)}/customers/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: {
          authorization: `Bearer ${config.secretApiKey}`,
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(8_000),
      },
    );
  } catch {
    throw new Error('revenuecat_customer_delete_failed');
  }
  // 202 means RevenueCat durably accepted a queued deletion; 404 makes retries
  // idempotent after an earlier attempt already removed the customer.
  if (![200, 202, 404].includes(response.status)) {
    throw new Error('revenuecat_customer_delete_failed');
  }
}

async function listStoragePaths(
  service: SupabaseClient,
  bucket: string,
  prefix: string,
  collected: string[] = [],
): Promise<string[]> {
  if (collected.length > 10_000) throw new Error('storage_object_limit_exceeded');
  let offset = 0;
  while (true) {
    const { data, error } = await service.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error('storage_list_failed');
    const rows = data ?? [];
    for (const item of rows) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) collected.push(itemPath);
      else await listStoragePaths(service, bucket, itemPath, collected);
    }
    if (rows.length < 1000) break;
    offset += rows.length;
  }
  return collected;
}

async function purgeStorage(service: SupabaseClient, userId: string): Promise<void> {
  for (const bucket of storageBuckets()) {
    const paths = await listStoragePaths(service, bucket, userId);
    for (let offset = 0; offset < paths.length; offset += 1000) {
      const { error } = await service.storage
        .from(bucket)
        .remove(paths.slice(offset, offset + 1000));
      if (error) throw new Error('storage_delete_failed');
    }
  }
}

async function finish(
  service: SupabaseClient,
  requestKey: string,
  status: 'succeeded' | 'failed',
  errorCode: string | null = null,
): Promise<void> {
  const { error } = await service.rpc('finish_account_deletion', {
    p_request_key: requestKey,
    p_status: status,
    p_error_code: errorCode,
  });
  if (error) throw new Error('deletion_status_update_failed');
}

function safeErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  return /^[a-z0-9_]{1,80}$/.test(message) ? message : 'account_deletion_failed';
}

Deno.serve(async (request) => {
  const cors = allowedCorsHeaders(request);
  if (request.method === 'OPTIONS') {
    return Object.keys(cors).length
      ? new Response(null, { status: 204, headers: cors })
      : json(403, { error: 'origin_not_allowed' });
  }
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, cors);

  const token = bearerToken(request);
  if (!token) return json(401, { error: 'authentication_required' }, cors);

  let service: SupabaseClient | null = null;
  let requestKey: string | null = null;
  try {
    const supabaseUrl = env('SUPABASE_URL');
    const publicKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')?.trim() || env('SUPABASE_ANON_KEY');
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
    const hmacSecret = env('ACCOUNT_DELETION_HMAC_SECRET');
    const retentionDays = requestRetentionDays();
    const transactionPepper = env('PREMIUM_SPONSOR_TRANSACTION_PEPPER');
    const purchaseAuditDays = purchaseAuditRetentionDays();
    const revenueCatDeletion = revenueCatDeletionConfig();
    if (transactionPepper.length < 32) throw new Error('weak_premium_sponsor_transaction_pepper');

    const userClient = createClient(supabaseUrl, publicKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // getClaims verifies the signed JWT and derives the account from its `sub`.
    // No client-supplied user ID is accepted anywhere in this endpoint.
    const { data: claimData, error: claimError } = await userClient.auth.getClaims(token);
    const userId = claimData?.claims?.sub;
    if (claimError || typeof userId !== 'string' || !userId) {
      return json(401, { error: 'invalid_session' }, cors);
    }

    requestKey = await hmacAccountReference(userId, hmacSecret);
    const expiresAt = new Date(Date.now() + retentionDays * 86_400_000).toISOString();
    const { data: beginData, error: beginError } = await service.rpc('begin_account_deletion', {
      p_request_key: requestKey,
      p_expires_at: expiresAt,
    });
    if (beginError) throw new Error('deletion_status_create_failed');
    const begin = (Array.isArray(beginData) ? beginData[0] : beginData) as
      RequestStatusRow | undefined;
    if (!begin) throw new Error('deletion_status_missing');
    if (begin.status === 'succeeded') {
      return json(200, { status: 'deleted', requestId: requestKey }, cors);
    }

    // An authoritative lookup blocks deletion for forged, stale or externally
    // removed accounts. A retry may continue after the previous attempt already
    // removed Auth but failed before marking the durable status row complete.
    const { data: userData, error: userError } = await service.auth.getUser(token);
    const activeUserId = userData.user?.id;
    const resumableAfterAuthRemoval = begin.attempt_count > 1 && !activeUserId;
    if (userError && !resumableAfterAuthRemoval) {
      await finish(service, requestKey, 'failed', 'invalid_session');
      return json(401, { error: 'invalid_session' }, cors);
    }
    if (activeUserId && activeUserId !== userId) {
      await finish(service, requestKey, 'failed', 'account_mismatch');
      return json(403, { error: 'account_mismatch' }, cors);
    }

    // Preserve only a peppered, non-attributable consumed-transaction marker
    // for replay/refund defense. User, save, branding and entitlement linkage
    // is removed by the purges immediately afterwards. This validation must
    // happen before the irreversible storage deletion so a key/configuration
    // mismatch cannot leave a partially deleted account.
    const { error: tombstoneError } = await service.rpc('tombstone_premium_sponsor_transactions', {
      p_user_id: userId,
      p_transaction_pepper: transactionPepper,
      p_retention_days: purchaseAuditDays,
    });
    if (tombstoneError) throw new Error('purchase_tombstone_failed');

    // RevenueCat's v2 customer erasure is server-only and may return 202 while
    // queued. It runs after transaction tombstoning but before local irreversible
    // purges; failures retain the durable write block and are safe to retry.
    await deleteRevenueCatCustomer(userId, revenueCatDeletion);
    await purgeStorage(service, userId);
    const { error: purgeError } = await service.rpc('purge_user_data_for_account_deletion', {
      p_user_id: userId,
    });
    if (purgeError) throw new Error('database_purge_failed');

    if (activeUserId) {
      const { error: deleteUserError } = await service.auth.admin.deleteUser(userId, false);
      if (deleteUserError) throw new Error('auth_user_delete_failed');
    }

    await finish(service, requestKey, 'succeeded');
    // Expired pseudonymous status rows are opportunistically pruned. A scheduled
    // call can also invoke the same service-role-only RPC.
    await service.rpc('prune_expired_account_deletion_requests');
    await service.rpc('prune_expired_premium_sponsor_transaction_tombstones');
    await service.rpc('prune_expired_premium_sponsor_webhook_events');
    return json(200, { status: 'deleted', requestId: requestKey }, cors);
  } catch (error) {
    const errorCode = safeErrorCode(error);
    if (service && requestKey) {
      try {
        await finish(service, requestKey, 'failed', errorCode);
      } catch {
        // The primary failure is returned; no secret or raw provider error is exposed.
      }
    }
    const configurationFailure =
      errorCode.startsWith('missing_') ||
      errorCode.startsWith('invalid_account_deletion_') ||
      errorCode.startsWith('invalid_revenuecat_') ||
      errorCode === 'weak_account_deletion_hmac_secret' ||
      errorCode === 'weak_premium_sponsor_transaction_pepper';
    return json(
      configurationFailure ? 503 : 500,
      { error: configurationFailure ? 'deletion_service_not_configured' : 'deletion_failed' },
      cors,
    );
  }
});
