import {
  adminClient,
  assertSponsorCheckoutEnabled,
  authenticateRecoverableUser,
  canonicalJson,
  errorResponse,
  HttpError,
  jsonResponse,
  loadSponsorServerConfig,
  parseIdempotencyKey,
  parseModeForProduct,
  parseProduct,
  parseSaveId,
  parseSaveSlot,
  parseSnapshot,
  readJsonBody,
  sha256Hex,
} from '../_shared/premiumSponsor.ts';

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  }

  try {
    const config = loadSponsorServerConfig();
    assertSponsorCheckoutEnabled(config);
    const admin = adminClient(config);
    const user = await authenticateRecoverableUser(request, admin);
    const body = await readJsonBody(request);

    const productId = parseProduct(body.productId, config);
    const mode = parseModeForProduct(body.mode, productId);
    const saveId = parseSaveId(body.saveId, mode);
    const saveSlot = parseSaveSlot(body.saveSlot);
    const idempotencyKey = parseIdempotencyKey(body.idempotencyKey);
    const snapshot = parseSnapshot(body.saveSnapshot, saveId, mode);
    const snapshotSha256 = await sha256Hex(canonicalJson(snapshot));

    const { data, error } = await admin.rpc('create_premium_sponsor_checkout_intent', {
      p_user_id: user.id,
      p_product_id: productId,
      p_mode: mode,
      p_save_id: saveId,
      p_save_slot: saveSlot,
      p_revenuecat_app_user_id: user.id,
      p_idempotency_key: idempotencyKey,
      p_save_snapshot: snapshot,
      p_snapshot_sha256: snapshotSha256,
    });
    if (error) {
      if (error.message.includes('being deleted') || error.message.includes('no longer exists')) {
        throw new HttpError(409, 'account_deletion_in_progress');
      }
      if (error.message.includes('already has an effective')) {
        throw new HttpError(409, 'already_owned_for_save');
      }
      if (error.message.includes('Idempotency key')) {
        throw new HttpError(409, 'idempotency_key_conflict');
      }
      if (error.message.includes('Another exact save already has a pending checkout')) {
        throw new HttpError(409, 'checkout_already_pending_for_another_save');
      }
      throw new Error('checkout_intent_write_failed');
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== 'object') throw new Error('checkout_intent_write_failed');
    const record = row as Record<string, unknown>;
    if (
      typeof record.intent_id !== 'string' ||
      typeof record.intent_status !== 'string' ||
      typeof record.intent_expires_at !== 'string'
    ) {
      throw new Error('checkout_intent_write_failed');
    }

    return jsonResponse({
      ok: true,
      intentId: record.intent_id,
      status: record.intent_status,
      expiresAt: record.intent_expires_at,
      productId,
      saveId,
      revenueCatAppUserId: user.id,
      checkoutEnabled: true,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
