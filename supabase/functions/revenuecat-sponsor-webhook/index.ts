import {
  adminClient,
  assertSponsorProductMapping,
  assertWebhookAppId,
  errorResponse,
  HttpError,
  jsonResponse,
  loadSponsorServerConfig,
  millisecondDate,
  parseWebhookEnvironment,
  parseWebhookStore,
  resolveWebhookProduct,
  sha256Hex,
  stringField,
  uniqueSubjectIds,
  verifyRevenueCatWebhook,
  type RevenueCatStore,
} from '../_shared/premiumSponsor.ts';

const MAX_WEBHOOK_BYTES = 512 * 1024;

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  }

  try {
    const config = loadSponsorServerConfig();
    const declaredSize = Number(request.headers.get('content-length') ?? 0);
    if (Number.isFinite(declaredSize) && declaredSize > MAX_WEBHOOK_BYTES) {
      throw new HttpError(413, 'webhook_too_large');
    }
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BYTES) {
      throw new HttpError(413, 'webhook_too_large');
    }
    await verifyRevenueCatWebhook(request, rawBody, config);

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new HttpError(400, 'invalid_webhook_json');
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new HttpError(400, 'invalid_webhook_payload');
    }
    const root = payload as Record<string, unknown>;
    if (
      root.api_version !== '1.0' ||
      !root.event ||
      typeof root.event !== 'object' ||
      Array.isArray(root.event)
    ) {
      throw new HttpError(400, 'unsupported_webhook_version');
    }
    const event = root.event as Record<string, unknown>;
    const eventId = stringField(event.id, 'invalid_webhook_event_id', 128);
    const eventType = stringField(event.type, 'invalid_webhook_event_type', 80);
    const eventTimestamp = millisecondDate(
      event.event_timestamp_ms,
      'invalid_webhook_event_timestamp',
    );
    // RevenueCat documents store/environment as optional on TRANSFER. A
    // missing environment can only trigger the conservative operation of
    // freezing matching bindings; it can never grant or reactivate access.
    const environment =
      eventType === 'TRANSFER' && event.environment == null
        ? 'UNSPECIFIED'
        : parseWebhookEnvironment(event.environment, config);

    let store: RevenueCatStore | null = null;
    if (event.store != null) store = parseWebhookStore(event.store, config);
    const appId = assertWebhookAppId(event.app_id, store, config);
    if (!store) {
      store =
        [...config.storeAppIds.entries()].find(
          ([, configuredAppId]) => configuredAppId === appId,
        )?.[0] ?? null;
      if (!store) throw new HttpError(403, 'webhook_store_not_allowed');
    }

    const productId = resolveWebhookProduct(event.product_id, store, appId, config);
    if (eventType !== 'TRANSFER' && !productId) {
      // This dedicated endpoint has no authority over any other catalog item.
      return jsonResponse({ ok: true, ignored: true, reason: 'product_not_allowlisted' });
    }
    if (productId) assertSponsorProductMapping(productId, store, appId, config);

    const subjectIds = uniqueSubjectIds(event);
    if (
      subjectIds.length > 64 ||
      subjectIds.some((value) => value.length > 128) ||
      (eventType === 'TRANSFER' && subjectIds.length === 0)
    ) {
      throw new HttpError(400, 'invalid_webhook_subjects');
    }

    const needsTransaction =
      eventType === 'NON_RENEWING_PURCHASE' ||
      eventType === 'CANCELLATION' ||
      eventType === 'REFUND_REVERSED';
    const transactionId = needsTransaction
      ? stringField(event.transaction_id, 'invalid_webhook_transaction_id', 255)
      : null;
    const originalTransactionId =
      typeof event.original_transaction_id === 'string' && event.original_transaction_id.length > 0
        ? stringField(event.original_transaction_id, 'invalid_webhook_original_transaction_id', 255)
        : null;
    const purchasedAt =
      eventType === 'NON_RENEWING_PURCHASE'
        ? millisecondDate(event.purchased_at_ms, 'invalid_webhook_purchase_timestamp')
        : null;
    const bodySha256 = await sha256Hex(rawBody);

    const admin = adminClient(config);
    const { data, error } = await admin.rpc('process_premium_sponsor_webhook', {
      p_event_id: eventId,
      p_body_sha256: bodySha256,
      p_event_type: eventType,
      p_revenuecat_app_id: appId,
      p_environment: environment,
      p_event_timestamp: eventTimestamp,
      p_transaction_pepper: config.transactionPepper,
      p_audit_retention_days: config.webhookAuditDays,
      p_product_id: productId,
      p_transaction_id: transactionId,
      p_original_transaction_id: originalTransactionId,
      p_store: store,
      p_purchased_at: purchasedAt,
      p_subject_app_user_ids: subjectIds,
    });
    if (error) {
      if (error.message.includes('different payload')) {
        throw new HttpError(409, 'webhook_event_payload_mismatch');
      }
      throw new Error('webhook_processing_failed');
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (!result || typeof result !== 'object') throw new Error('webhook_processing_failed');
    const record = result as Record<string, unknown>;
    return jsonResponse({
      ok: true,
      outcome: record.event_outcome,
      matchedPurchaseId:
        typeof record.matched_purchase_id === 'string' ? record.matched_purchase_id : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
