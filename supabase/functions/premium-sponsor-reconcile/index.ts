import {
  accessState,
  adminClient,
  assertSponsorCheckoutEnabled,
  authenticateRecoverableUser,
  canonicalJson,
  errorResponse,
  fetchRevenueCatPurchase,
  HttpError,
  jsonResponse,
  loadSponsorServerConfig,
  type PremiumSponsorProductId,
  type PurchaseBindingRow,
  parseModeForProduct,
  parseProduct,
  parseSaveId,
  parseSnapshot,
  readJsonBody,
  sha256Hex,
  stringField,
} from '../_shared/premiumSponsor.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseIntentId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new HttpError(400, 'invalid_intent_id');
  }
  return value;
}

function parseBinding(value: unknown): PurchaseBindingRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('invalid_purchase_binding');
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== 'string' ||
    typeof row.product_id !== 'string' ||
    typeof row.save_id !== 'string' ||
    typeof row.status !== 'string' ||
    typeof row.transaction_id !== 'string' ||
    typeof row.store !== 'string' ||
    typeof row.environment !== 'string' ||
    typeof row.revenuecat_app_id !== 'string' ||
    typeof row.last_verified_at !== 'string' ||
    typeof row.offline_grace_expires_at !== 'string'
  ) {
    throw new Error('invalid_purchase_binding');
  }
  return row as unknown as PurchaseBindingRow;
}

function publicBinding(row: PurchaseBindingRow, verifiedNow: boolean) {
  return {
    bindingId: row.id,
    productId: row.product_id,
    saveId: row.save_id,
    status: row.status,
    accessState: accessState(row),
    lastVerifiedAt: row.last_verified_at,
    offlineGraceExpiresAt: row.offline_grace_expires_at,
    verifiedNow,
  };
}

type VerificationFailure = 'NOT_OWNED' | 'NOT_FOUND' | 'VERIFICATION_MISMATCH';

function definitiveVerificationFailure(error: unknown): VerificationFailure | null {
  if (!(error instanceof HttpError)) return null;
  if (error.code === 'purchase_not_owned') return 'NOT_OWNED';
  if (
    [
      'purchase_identity_mismatch',
      'purchase_ownership_not_allowed',
      'purchase_product_mismatch',
      'purchase_quantity_not_supported',
      'store_not_allowed',
      'product_store_not_allowed',
      'purchase_environment_not_allowed',
      'ambiguous_store_transaction',
    ].includes(error.code)
  ) {
    return 'VERIFICATION_MISMATCH';
  }
  return null;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  }

  try {
    const config = loadSponsorServerConfig();
    const admin = adminClient(config);
    const user = await authenticateRecoverableUser(request, admin);
    const body = await readJsonBody(request);
    const action = body.action;

    if (action === 'confirm') {
      assertSponsorCheckoutEnabled(config);
      const intentId = parseIntentId(body.intentId);
      const transactionId = stringField(body.transactionId, 'invalid_transaction_id', 255);
      const { data: intentData, error: intentError } = await admin
        .from('premium_sponsor_checkout_intents')
        .select('id, user_id, product_id, save_id, revenuecat_app_user_id')
        .eq('id', intentId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (intentError) throw new Error('checkout_intent_read_failed');
      if (!intentData) throw new HttpError(404, 'checkout_intent_not_found');

      const productId = parseProduct(intentData.product_id, config);
      if (intentData.revenuecat_app_user_id !== user.id) {
        throw new HttpError(409, 'purchase_identity_mismatch');
      }
      const verified = await fetchRevenueCatPurchase(user.id, productId, transactionId, config);
      if (!verified) throw new HttpError(409, 'purchase_not_verified');

      const { data, error } = await admin.rpc('confirm_premium_sponsor_purchase', {
        p_user_id: user.id,
        p_intent_id: intentId,
        p_transaction_id: verified.transactionId,
        p_original_transaction_id: verified.originalTransactionId ?? null,
        p_revenuecat_app_user_id: user.id,
        p_store: verified.store,
        p_revenuecat_app_id: verified.revenueCatAppId,
        p_environment: verified.environment,
        p_purchased_at: verified.purchasedAt,
        p_transaction_pepper: config.transactionPepper,
      });
      if (error) {
        if (error.message.includes('being deleted') || error.message.includes('no longer exists')) {
          throw new HttpError(409, 'account_deletion_in_progress');
        }
        if (error.message.includes('already bound to another')) {
          throw new HttpError(409, 'transaction_already_bound');
        }
        if (error.message.includes('previously consumed by a deleted account')) {
          throw new HttpError(409, 'transaction_previously_consumed');
        }
        if (error.message.includes('already has an effective')) {
          throw new HttpError(409, 'already_owned_for_save');
        }
        if (error.message.includes('no longer eligible') || error.message.includes('timestamp')) {
          throw new HttpError(409, 'checkout_intent_expired');
        }
        throw new Error('purchase_binding_failed');
      }
      const result = Array.isArray(data) ? data[0] : data;
      if (!result || typeof result !== 'object') throw new Error('purchase_binding_failed');
      const record = result as Record<string, unknown>;
      const binding = parseBinding({
        id: record.purchase_id,
        product_id: record.product_id,
        save_id: record.save_id,
        status: record.purchase_status,
        transaction_id: verified.transactionId,
        store: verified.store,
        environment: verified.environment,
        revenuecat_app_id: verified.revenueCatAppId,
        last_verified_at: record.last_verified_at,
        offline_grace_expires_at: record.offline_grace_expires_at,
      });
      return jsonResponse({ ok: true, ...publicBinding(binding, binding.status === 'ACTIVE') });
    }

    if (action !== 'status' && action !== 'recover' && action !== 'backup' && action !== 'delete') {
      throw new HttpError(400, 'unsupported_reconcile_action');
    }

    const productId = parseProduct(body.productId, config);
    const mode = parseModeForProduct(body.mode, productId);
    const saveId = parseSaveId(body.saveId, mode);
    const { data, error } = await admin
      .from('premium_sponsor_purchases')
      .select(
        'id, product_id, save_id, status, transaction_id, original_transaction_id, store, environment, revenuecat_app_id, last_verified_at, offline_grace_expires_at',
      )
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .eq('save_id', saveId)
      .order('purchased_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error('purchase_binding_read_failed');

    if (action === 'delete') {
      const { data: deleted, error: deleteError } = await admin.rpc(
        'delete_premium_sponsor_exact_save',
        {
          p_user_id: user.id,
          p_product_id: productId,
          p_save_id: saveId,
          p_transaction_pepper: config.transactionPepper,
          p_retention_days: config.webhookAuditDays,
        },
      );
      if (deleteError) {
        if (
          deleteError.message.includes('being deleted') ||
          deleteError.message.includes('no longer exists')
        ) {
          throw new HttpError(409, 'account_deletion_in_progress');
        }
        throw new Error('premium_sponsor_save_deletion_failed');
      }
      const deletedCount = typeof deleted === 'number' ? deleted : Number(deleted ?? 0);
      if (!Number.isInteger(deletedCount) || deletedCount < 0) {
        throw new Error('premium_sponsor_save_deletion_not_confirmed');
      }
      return jsonResponse({
        ok: true,
        status: 'deleted',
        productId,
        saveId,
        deletedBindings: deletedCount,
      });
    }

    if (!data) throw new HttpError(404, 'premium_sponsor_not_found_for_save');
    let binding = parseBinding(data);

    let verifiedNow = false;

    if (binding.status === 'ACTIVE') {
      let verificationFailure: VerificationFailure | null = null;
      try {
        const verified = await fetchRevenueCatPurchase(
          user.id,
          binding.product_id as PremiumSponsorProductId,
          binding.transaction_id,
          config,
        );
        if (!verified) {
          verificationFailure = 'NOT_FOUND';
        } else if (
          verified.store !== binding.store ||
          verified.environment !== binding.environment
        ) {
          verificationFailure = 'VERIFICATION_MISMATCH';
        } else {
          const { data: refreshed, error: refreshError } = await admin.rpc(
            'refresh_premium_sponsor_verification',
            { p_user_id: user.id, p_purchase_id: binding.id },
          );
          if (refreshError) {
            if (
              refreshError.message.includes('being deleted') ||
              refreshError.message.includes('no longer exists')
            ) {
              throw new HttpError(409, 'account_deletion_in_progress');
            }
            throw new Error('purchase_verification_refresh_failed');
          }
          const refreshRow = Array.isArray(refreshed) ? refreshed[0] : refreshed;
          if (!refreshRow || typeof refreshRow !== 'object') {
            throw new Error('purchase_verification_refresh_failed');
          }
          const refreshRecord = refreshRow as Record<string, unknown>;
          binding = {
            ...binding,
            status: String(refreshRecord.purchase_status) as PurchaseBindingRow['status'],
            last_verified_at: String(refreshRecord.last_verified_at),
            offline_grace_expires_at: String(refreshRecord.offline_grace_expires_at),
          };
          verifiedNow = true;
        }
      } catch (error) {
        verificationFailure = definitiveVerificationFailure(error);
        if (
          !verificationFailure &&
          (action === 'recover' || !(error instanceof HttpError) || error.status < 500)
        ) {
          throw error;
        }
        if (!verificationFailure) {
          // Status checks remain useful during a RevenueCat outage. The returned
          // grace deadline tells the client whether cached access can continue.
        }
      }

      if (verificationFailure) {
        const { data: marked, error: markError } = await admin.rpc(
          'mark_premium_sponsor_verification_failure',
          {
            p_user_id: user.id,
            p_purchase_id: binding.id,
            p_outcome: verificationFailure,
          },
        );
        if (markError) {
          if (
            markError.message.includes('being deleted') ||
            markError.message.includes('no longer exists')
          ) {
            throw new HttpError(409, 'account_deletion_in_progress');
          }
          throw new Error('purchase_verification_failure_write_failed');
        }
        const markedRow = Array.isArray(marked) ? marked[0] : marked;
        if (!markedRow || typeof markedRow !== 'object') {
          throw new Error('purchase_verification_failure_write_failed');
        }
        const markedRecord = markedRow as Record<string, unknown>;
        binding = {
          ...binding,
          status: String(markedRecord.purchase_status) as PurchaseBindingRow['status'],
          last_verified_at: String(markedRecord.last_verified_at),
          offline_grace_expires_at: String(markedRecord.offline_grace_expires_at),
        };
      }
    }

    if (action === 'status') {
      return jsonResponse({ ok: true, ...publicBinding(binding, verifiedNow) });
    }

    if (action === 'backup') {
      if (
        binding.status !== 'ACTIVE' ||
        Date.parse(binding.offline_grace_expires_at) < Date.now()
      ) {
        throw new HttpError(409, 'active_or_grace_binding_required_for_backup');
      }
      const snapshot = parseSnapshot(body.saveSnapshot, saveId, mode);
      const snapshotSha256 = await sha256Hex(canonicalJson(snapshot));
      const { data: backupResult, error: backupWriteError } = await admin.rpc(
        'update_premium_sponsor_save_backup',
        {
          p_user_id: user.id,
          p_purchase_id: binding.id,
          p_save_snapshot: snapshot,
          p_snapshot_sha256: snapshotSha256,
        },
      );
      if (backupWriteError) {
        if (
          backupWriteError.message.includes('being deleted') ||
          backupWriteError.message.includes('no longer exists')
        ) {
          throw new HttpError(409, 'account_deletion_in_progress');
        }
        if (backupWriteError.message.includes('not eligible')) {
          throw new HttpError(409, 'active_or_grace_binding_required_for_backup');
        }
        throw new Error('sponsor_backup_write_failed');
      }
      const backupRow = Array.isArray(backupResult) ? backupResult[0] : backupResult;
      if (!backupRow || typeof backupRow !== 'object') {
        throw new Error('sponsor_backup_write_failed');
      }
      const backupRecord = backupRow as Record<string, unknown>;
      if (
        backupRecord.snapshot_sha256 !== snapshotSha256 ||
        typeof backupRecord.captured_at !== 'string'
      ) {
        throw new Error('sponsor_backup_write_failed');
      }
      return jsonResponse({
        ok: true,
        ...publicBinding(binding, verifiedNow),
        snapshotSha256,
        capturedAt: backupRecord.captured_at,
      });
    }

    if (binding.status !== 'ACTIVE' || !verifiedNow) {
      throw new HttpError(409, 'live_verification_required_for_recovery');
    }
    const { data: backup, error: backupError } = await admin
      .from('premium_sponsor_save_backups')
      .select('save_snapshot, snapshot_sha256, save_id, product_id')
      .eq('purchase_id', binding.id)
      .eq('user_id', user.id)
      .eq('save_id', saveId)
      .eq('product_id', productId)
      .maybeSingle();
    if (backupError) throw new Error('sponsor_backup_read_failed');
    if (!backup) throw new HttpError(404, 'sponsor_backup_not_found');
    const actualHash = await sha256Hex(canonicalJson(backup.save_snapshot));
    if (actualHash !== backup.snapshot_sha256) {
      throw new Error('sponsor_backup_integrity_failed');
    }

    return jsonResponse({
      ok: true,
      ...publicBinding(binding, true),
      saveSnapshot: backup.save_snapshot,
      snapshotSha256: backup.snapshot_sha256,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
