import fs from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '../../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('premium sponsor backend contract', () => {
  const migration = read('supabase/migrations/202608200002_premium_save_sponsor_backend.sql');
  const shared = read('supabase/functions/_shared/premiumSponsor.ts');
  const createIntent = read('supabase/functions/premium-sponsor-create-intent/index.ts');
  const reconcile = read('supabase/functions/premium-sponsor-reconcile/index.ts');
  const webhook = read('supabase/functions/revenuecat-sponsor-webhook/index.ts');
  const envExample = read('supabase/functions/.env.sponsor.example');
  const purchases = read('src/services/purchases.ts');
  const auth = read('src/services/auth.ts');
  const supabaseClient = read('src/services/supabaseClient.ts');
  const app = read('App.tsx');

  it('keeps the entire paid ledger service-owned and endpoint-only', () => {
    for (const table of [
      'premium_sponsor_checkout_intents',
      'premium_sponsor_purchases',
      'premium_sponsor_save_backups',
      'account_deletion_write_blocks',
      'premium_sponsor_webhook_events',
      'premium_sponsor_transaction_tombstones',
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toContain(`revoke all on table public.${table} from anon, authenticated`);
    }
    for (const table of [
      'premium_sponsor_checkout_intents',
      'premium_sponsor_purchases',
      'premium_sponsor_save_backups',
    ]) {
      expect(migration).not.toContain(`grant select on table public.${table} to authenticated`);
      expect(migration).not.toContain(`create policy "${table}_select_own"`);
      expect(migration).toContain(`grant select on table public.${table} to service_role`);
    }
    expect(migration).not.toContain(
      'grant insert on table public.premium_sponsor_purchases to authenticated',
    );
    expect(migration).toMatch(
      /revoke all on function public\.confirm_premium_sponsor_purchase[\s\S]+from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.confirm_premium_sponsor_purchase[\s\S]+to service_role/,
    );
  });

  it('atomically binds one store transaction to one exact save and snapshots it', () => {
    expect(migration).toContain('unique (store, environment, transaction_id)');
    expect(migration).toContain(
      'transaction_id text not null check (char_length(transaction_id) between 1 and 255)',
    );
    expect(migration).toContain('char_length(p_transaction_id) not between 1 and 255');
    expect(reconcile).toContain("stringField(body.transactionId, 'invalid_transaction_id', 255)");
    expect(migration).toContain('premium_sponsor_one_effective_license_per_save');
    expect(migration).toMatch(
      /premium_sponsor_one_pending_intent_per_product[\s\S]+\(user_id, product_id\)[\s\S]+where status = 'PENDING'/,
    );
    expect(migration).toContain(
      'Another exact save already has a pending checkout for this product',
    );
    expect(createIntent).toContain('checkout_already_pending_for_another_save');
    expect(migration).toContain("save_key = 'sg:' || mode || ':' || save_slot::text");
    expect(migration).toContain("save_snapshot ->> 'id' = save_id");
    expect(migration).toContain("save_snapshot ->> 'mode' = mode");
    expect(migration).toContain('Store transaction is already bound to another exact save');
    expect(migration).toMatch(
      /insert into public\.premium_sponsor_save_backups[\s\S]+v_intent\.save_snapshot/,
    );
    expect(migration).toContain("v_now + interval '7 days'");
  });

  it('removes user-owned data while retaining only peppered replay tombstones', () => {
    expect(
      migration.match(/user_id uuid not null references auth\.users\(id\) on delete cascade/g),
    ).toHaveLength(3);
    expect(migration).toContain(
      'user_id uuid primary key references auth.users(id) on delete cascade',
    );
    expect(migration).toContain('body_sha256 text not null');
    expect(migration).toContain('transaction_fingerprint text');
    const webhookTable = migration.slice(
      migration.indexOf('create table if not exists public.premium_sponsor_webhook_events'),
      migration.indexOf(
        'alter table public.premium_sponsor_checkout_intents enable row level security',
      ),
    );
    expect(webhookTable).not.toContain('raw_payload');
    expect(webhookTable).not.toContain('app_user_id');
    expect(migration).toContain('tombstone_premium_sponsor_transactions');
    expect(migration).toContain('premium_sponsor_transaction_fingerprint');
    expect(migration).toContain('pepper_verifier text not null');
    expect(migration).toContain('assert_premium_sponsor_transaction_pepper');
    expect(migration).toContain('transaction pepper does not match live tombstones');
    expect(migration).toContain('transaction pepper does not match live webhook events');
    expect(migration).toContain(
      "pg_advisory_xact_lock(hashtextextended('premium-sponsor-pepper-v1', 0))",
    );
    expect(migration).toContain('create extension if not exists pgcrypto with schema extensions');
    expect(migration).toContain('alter extension pgcrypto set schema extensions');
    expect(migration).toContain('extensions.hmac(');
    expect(migration).toContain("status_reason = 'ACCOUNT_DELETION'");
    expect(migration).toContain('Store transaction was previously consumed by a deleted account');
    const tombstoneTable = migration.slice(
      migration.indexOf('create table if not exists public.premium_sponsor_transaction_tombstones'),
      migration.indexOf('create index if not exists premium_sponsor_transaction_tombstones'),
    );
    expect(tombstoneTable).not.toContain('user_id');
    expect(tombstoneTable).not.toContain('save_id');
    expect(tombstoneTable).not.toContain('transaction_id');
  });

  it('rejects anonymous accounts and requires exact RevenueCat account identity', () => {
    expect(shared).toContain("throw new HttpError(403, 'recoverable_sign_in_required')");
    expect(shared).toContain('admin.auth.getUser(token)');
    expect(createIntent).toContain('p_revenuecat_app_user_id: user.id');
    expect(reconcile).toContain(
      'fetchRevenueCatPurchase(user.id, productId, transactionId, config)',
    );
    expect(migration).toContain('RevenueCat App User ID must equal the authenticated account ID');
    expect(supabaseClient).toContain('currentRecoverableSupabaseUserId');
    expect(supabaseClient).toContain('supabase.auth.getUser()');
    expect(supabaseClient).toContain('hasRecoverableUserIdentity(data.user)');
    expect(supabaseClient).toContain("identity.provider !== 'anonymous'");
    expect(purchases).toContain('currentRecoverableSupabaseUserId()');
    expect(purchases).toContain('RC.configure({ apiKey, appUserID: appUserId })');
    expect(purchases).toContain('await RC.logIn(appUserId)');
    expect(purchases).toContain('await synchronizePurchaseIdentity()');
    expect(purchases).toContain('recoverable_sign_in_required');
    const signOut = auth.slice(auth.indexOf('export async function signOut'));
    expect(signOut.indexOf('clearPurchaseIdentity()')).toBeLessThan(
      signOut.indexOf('getSupabaseClient()?.auth.signOut()'),
    );
    expect(purchases).not.toContain('RC.logOut()');
    expect(app).toContain('void purchases.configurePurchases(MONETIZATION.revenueCat)');
  });

  it('fails closed behind server product, app, store and environment allowlists', () => {
    expect(shared).toContain("requireEnv('PREMIUM_SPONSOR_CHECKOUT_ENABLED')");
    expect(shared).toContain('assertSponsorCheckoutEnabled');
    expect(createIntent).toContain('assertSponsorCheckoutEnabled(config)');
    expect(reconcile).toContain("if (action === 'confirm')");
    expect(webhook).not.toContain('assertSponsorCheckoutEnabled');
    expect(shared).toContain("requireEnv('REVENUECAT_PROJECT_ID')");
    expect(shared).toContain("commaSet('REVENUECAT_ALLOWED_ENVIRONMENTS')");
    expect(shared).toContain("requireEnv('REVENUECAT_SPONSOR_PRODUCTS_JSON')");
    expect(shared).toContain("requireEnv('REVENUECAT_SECRET_API_KEY')");
    expect(shared).toContain("revenueCatSecretApiKey.startsWith('sk_')");
    expect(shared).toContain("requireEnv('PREMIUM_SPONSOR_TRANSACTION_PEPPER')");
    expect(shared).toContain(
      '/v2/projects/${encodeURIComponent(config.revenueCatProjectId)}/purchases',
    );
    expect(shared).toContain("purchase.status !== 'owned'");
    expect(shared).toContain("purchase.ownership !== 'purchased'");
    expect(shared).toContain('purchase.original_customer_id !== appUserId');
    expect(shared).toContain('purchase.product_id !== mapping.revenueCatProductId');
    expect(shared).toContain('mapping.storeProductId === storeProductId');
    expect(webhook).toContain('resolveWebhookProduct(event.product_id, store, appId, config)');
    expect(envExample).toContain('PREMIUM_SPONSOR_CHECKOUT_ENABLED=false');
    expect(envExample).toContain('REVENUECAT_PROJECT_ID=');
    expect(envExample).toContain('REVENUECAT_SPONSOR_PRODUCTS_JSON=');
    expect(envExample).toContain('PREMIUM_SPONSOR_TRANSACTION_PEPPER=');
    expect(envExample).toContain('PREMIUM_SPONSOR_WEBHOOK_AUDIT_DAYS=');
    expect(envExample).toContain('"storeProductId":');
    expect(envExample).toContain(
      'Keep it stable for at least the longest approved tombstone or webhook-ledger',
    );
    expect(envExample).toContain('versioned multi-pepper comparison');
    expect(envExample).toContain(
      'Existing HMACs cannot be\n# re-keyed without the deleted raw transaction IDs',
    );
    expect(envExample).not.toContain('EXPO_PUBLIC_SUPABASE_SERVICE_ROLE');
    expect(envExample).not.toContain('EXPO_PUBLIC_REVENUECAT_SECRET');
    expect(purchases).toMatch(
      /export function isSaveSponsorCheckoutReady\(\): boolean \{\s+return MOCK_MODE;/,
    );
  });

  it('verifies RevenueCat raw-body HMAC and makes webhook processing replay-safe', () => {
    expect(shared).toContain('x-revenuecat-webhook-signature');
    expect(shared).toContain('`${parts.t}.${rawBody}`');
    expect(shared).toContain('WEBHOOK_TOLERANCE_SECONDS = 300');
    expect(shared).toContain('constantTimeEqual(computed, expected)');
    expect(webhook).toContain('verifyRevenueCatWebhook(request, rawBody, config)');
    expect(migration).toContain("return query select 'DUPLICATE'::text");
    expect(migration).toContain('Webhook event ID was replayed with a different payload');
    expect(migration).toContain('prune_expired_premium_sponsor_webhook_events');
    expect(migration).toContain('p_audit_retention_days');
    expect(webhook).toContain('p_audit_retention_days: config.webhookAuditDays');
  });

  it('revokes refunds, blocks transfers and only webhook-reactivates reversed refunds', () => {
    expect(migration).toContain("p_event_type = 'TRANSFER'");
    expect(migration).toContain("status = 'TRANSFER_BLOCKED'");
    expect(migration).toContain("p_event_type = 'CANCELLATION'");
    expect(migration).toContain("status = 'REVOKED'");
    expect(migration).toContain("p_event_type = 'REFUND_REVERSED'");
    expect(migration).toContain("status = 'REVERSAL_REVIEW'");
    expect(migration).toContain('Only REFUND_REVERSED may reactivate a revoked row');
    expect(migration).toContain('last_store_event_at');
    expect(migration).toContain('REVERSAL_STALE');
    expect(migration).toContain('REVERSAL_BLOCKED_TRANSFER');
    expect(migration).toContain("'REFUND_OR_REVOCATION', 'LIVE_VERIFICATION_NOT_OWNED'");
  });

  it('blocks deletion races and persists definitive live verification failures', () => {
    expect(migration).toContain('create table if not exists public.account_deletion_write_blocks');
    expect(migration).toContain("hashtextextended('account-deletion-write:'");
    expect(migration).toContain('assert_premium_sponsor_account_mutable');
    expect(migration).toContain('enforce_account_deletion_write_block');
    expect(migration).toContain('cloud_saves_account_deletion_guard');
    expect(migration).toContain('leaderboard_account_deletion_guard');
    expect(migration).toContain('mark_premium_sponsor_verification_failure');
    expect(reconcile).toContain("verificationFailure = 'NOT_FOUND'");
    expect(reconcile).toContain('p_outcome: verificationFailure');
  });

  it('requires live verification and hash integrity for same-save recovery', () => {
    expect(reconcile).toContain("action === 'recover'");
    expect(reconcile).toContain(
      "throw new HttpError(409, 'live_verification_required_for_recovery')",
    );
    expect(reconcile).toContain(".from('premium_sponsor_save_backups')");
    expect(reconcile).toContain(".eq('user_id', user.id)");
    expect(reconcile).toContain(".eq('save_id', saveId)");
    expect(reconcile).toContain('actualHash !== backup.snapshot_sha256');
  });

  it('permanently destroys an intentionally deleted exact-save binding before local deletion', () => {
    expect(reconcile).toContain("action !== 'delete'");
    expect(reconcile).toContain("'delete_premium_sponsor_exact_save'");
    expect(migration).toContain(
      'create or replace function public.delete_premium_sponsor_exact_save',
    );
    expect(migration).toContain("status_reason = 'ACCOUNT_DELETION'");
    expect(migration).toContain('delete from public.premium_sponsor_checkout_intents');
    expect(migration).toContain('revoke all on function public.delete_premium_sponsor_exact_save');
    expect(migration).toContain(
      'grant execute on function public.delete_premium_sponsor_exact_save',
    );
  });

  it('refreshes cloud backup only for the bound exact save during active or grace access', () => {
    expect(reconcile).toContain("action === 'backup'");
    expect(reconcile).toContain("'update_premium_sponsor_save_backup'");
    expect(migration).toContain(
      'create or replace function public.update_premium_sponsor_save_backup',
    );
    expect(migration).toContain("p_save_snapshot ->> 'id' is distinct from v_purchase.save_id");
    expect(migration).toContain("p_save_snapshot ->> 'mode' is distinct from v_purchase.mode");
    expect(migration).toContain('v_purchase.offline_grace_expires_at < v_now');
    expect(migration).toContain('Cloud backup snapshot is older than the stored snapshot');
    expect(migration).toContain('Cloud backup timestamp conflicts with different save data');
    expect(migration).toContain(
      'revoke all on function public.update_premium_sponsor_save_backup(uuid, uuid, jsonb, text)',
    );
  });
});
