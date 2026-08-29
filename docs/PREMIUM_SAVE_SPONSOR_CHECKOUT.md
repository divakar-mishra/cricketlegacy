# Premium save sponsor checkout

## Approved rules

- `player_save_sponsor` and `manager_save_sponsor` are separate ₹499 products.
- Each repeat-purchasable consumable adds one extra sponsor slot to one exact
  Player or Manager save. It is not an account-wide/restorable entitlement and
  cannot be moved to another save or mode.
- Checkout requires a recoverable Supabase account. Anonymous/device-only guest
  identities are rejected before the store is opened.
- The Player product pays Wallet Coins; the Manager product pays Club Balance.
  Existing stature-scaled Monday-to-Monday UTC settlement remains authoritative.
- The exact purchased save receives a server-owned recovery snapshot. Recovery
  can restore that same save only; it cannot apply the sponsor to another save.
- Reinstall or device loss may use that same-save recovery. An intentional
  **Delete Save** action first destroys the exact server backup and binding,
  tombstones the consumed transaction, and only then removes the local save.
  The sponsor cannot be recovered after that deliberate deletion.
- A refund/revocation removes branding, the extra slot and future stipends.
  Wallet Coins or Club Balance already paid are not clawed back.
- A last-known valid binding can remain usable offline for seven days. After the
  deadline, future sponsor settlement pauses until online verification succeeds.
- RevenueCat transfers do not transfer exact-save ownership. A transfer event
  freezes the affected binding for support review.

## What is implemented

The secure backend foundation is checked in but has not been deployed:

- `supabase/migrations/202608200002_premium_save_sponsor_backend.sql`
  creates server-owned checkout intents, immutable transaction bindings,
  recovery snapshots and an idempotent webhook event ledger.
- `premium-sponsor-create-intent` authenticates a recoverable user, validates
  product/mode/save/slot, hashes the exact snapshot and creates a 30-minute
  checkout intent atomically. Only one intent per account/product may be pending
  at once, so an asynchronous webhook can never choose between two exact saves.
- `premium-sponsor-reconcile` verifies a transaction against RevenueCat's
  v2 server API, atomically binds it, refreshes the seven-day deadline, reports
  status, accepts monotonic bound-save cloud-backup updates and performs live-verified
  same-save recovery. It also handles authenticated, idempotent intentional
  save deletion. Verification matches the account, original account,
  internal product, App ID, store, environment, ownership, quantity and live
  purchase status.
- `revenuecat-sponsor-webhook` requires both an exact Authorization value and
  RevenueCat's raw-body HMAC with a five-minute timestamp tolerance. It uses
  strict product, app, store and environment allowlists, rejects altered event
  replay, applies refunds/reversals and freezes transfers. Because RevenueCat
  documents store/environment as optional for transfers, a signed transfer
  missing environment may only freeze matching allowlisted-app bindings; it
  can never grant or reactivate access.
- Webhook lifecycle changes are ordered by RevenueCat event time with
  revocation/transfer precedence at equal timestamps. A stale refund reversal
  cannot reactivate a newer refund, transfer freeze or verification freeze.
- Definitive live checks that report a transaction as not owned persist a
  revocation; identity/product/store mismatches persist a support-review freeze.
  Provider outages still use the approved seven-day cached grace deadline.
- Sponsor ledger tables have RLS enabled but no direct client policy or grant.
  Intent/status/recovery data is returned only by authenticated Edge Functions;
  raw snapshots are service-role-only and recovery must pass through the live
  verification/hash-check endpoint. No raw webhook body, aliases or transaction
  ID are retained in the webhook ledger.
- Account deletion revokes and removes the binding and snapshot, while retaining
  only a server-peppered, non-attributable transaction tombstone for the approved
  purchase-audit period. This prevents a deleted account's transaction being
  rebound. Tombstones contain no user/save/App User ID or store transaction ID.
- Deletion atomically sets a durable write block before external/local purges,
  so an in-flight checkout, webhook, cloud write or stale-JWT leaderboard write
  cannot recreate data between purge steps. When RevenueCat is live, its v2
  customer deletion must be accepted before local Storage/DB/Auth deletion.
- The hash-only webhook audit ledger has the approved purchase-audit retention,
  opportunistic expiry and a service-only pruning RPC.

RevenueCat recommends server webhook authorization, HMAC verification over the
raw body and idempotency by event `id`. Its v2 API can search one-time purchases
by their store purchase identifier for independent server reconciliation:

- <https://www.revenuecat.com/docs/integrations/webhooks>
- <https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields>
- <https://www.revenuecat.com/docs/api-v2>

## Production remains locked

`src/services/purchases.ts` deliberately keeps release checkout disabled. The
server has a second fail-closed switch,
`PREMIUM_SPONSOR_CHECKOUT_ENABLED=false`. It blocks only new intent creation
and confirmation; lifecycle webhooks and status/recovery for an existing
binding continue to work. Do not change either gate merely because the
migration exists.

Before enabling a sandbox checkout:

1. Complete store/RevenueCat KYC and create both products as consumables with
   the exact approved identifiers.
2. Apply all Supabase migrations in filename order and deploy the three Edge
   Functions. `revenuecat-sponsor-webhook` must have gateway JWT verification
   disabled because RevenueCat is not a Supabase user; the other two retain JWT
   verification and also validate the JWT inside the function.
3. Set server secrets from
   `supabase/functions/.env.sponsor.example`. Never place a service-role key,
   RevenueCat secret key, webhook authorization or HMAC secret in Expo env or
   the mobile binary.
4. Start with `REVENUECAT_ALLOWED_ENVIRONMENTS=SANDBOX`. Add `PRODUCTION` only
   after end-to-end signed-build tests pass.
5. Create a RevenueCat v2 verification key limited to
   `customer_information:purchases:read`. Configure the project ID and each
   product/store's exact store Product ID, internal `prod...` Product ID and
   App ID in
   `REVENUECAT_SPONSOR_PRODUCTS_JSON`.
6. Configure RevenueCat to send the exact Authorization value and enable HMAC
   signing. Generate an independent transaction tombstone pepper and provide
   that same server-only value to the sponsor and account-deletion functions.
   Keep it stable for at least the longest tombstone or webhook-ledger
   retention. Rotation must wait until every old fingerprint expires and is
   pruned, or first deploy
   versioned comparison against both peppers. Existing fingerprints cannot be
   re-keyed because their raw store transaction IDs were deliberately deleted.
   The database stores a non-secret pepper verifier and fails confirmation,
   webhooks and deletion tombstoning if a replacement key is used while older
   tombstones or webhook events remain live.
7. Set `PREMIUM_SPONSOR_WEBHOOK_AUDIT_DAYS` and account-deletion purchase audit
   days to the same approved `legal.config.json` retention. Schedule both
   webhook-event and tombstone pruning RPCs.
8. Create a separate RevenueCat v2 key limited to
   `customer_information:customers:read_write`, configure it only on
   `delete-account`, and turn on `REVENUECAT_ANY_IAP_ENABLED`,
   `REVENUECAT_USES_SUPABASE_UUID_IDENTITY` and
   `REVENUECAT_CUSTOMER_DELETION_ENABLED` before any release IAP path. Account
   deletion rejects a live-IAP configuration if UUID identity or provider
   erasure is not enabled.
9. Configure the RevenueCat mobile SDK with the recoverable Supabase user UUID
   as its App User ID before showing these products. Anonymous RevenueCat IDs
   are not eligible. The shared SDK now configures/logs in only after Supabase
   server-validates a non-anonymous account, and all purchase/restore calls are
   closed on sign-out. Historical development builds did not retain a
   trustworthy mapping for anonymous RevenueCat aliases; do not enable release
   IAP on the assumption those aliases can be erased by Supabase UUID.
10. Wire the remaining client sequence below, including checkout, recovery,
    revocation, grace handling and automatic backups, and
    only then replace the client release gate with a remote/backend readiness
    check.

## Client contract still to wire

The destructive client path is already wired: Saved Games requires a confirmed
`delete` response before removing a locally stored purchased save. Checkout,
status/revocation, automatic backup and recovery UI remain gated and pending.

The release client must use this sequence; a successful SDK callback alone must
never grant the sponsor:

1. Persist the current save locally.
2. `POST premium-sponsor-create-intent` with bearer JWT and:

   ```json
   {
     "productId": "player_save_sponsor",
     "mode": "career",
     "saveId": "career-1234567890",
     "saveSlot": 1,
     "idempotencyKey": "checkout:random-unique-value",
     "saveSnapshot": { "id": "career-1234567890", "mode": "career", "schemaVersion": 1 }
   }
   ```

3. Confirm the returned RevenueCat App User ID equals the signed-in Supabase
   user, then initiate the store purchase.
4. `POST premium-sponsor-reconcile` with
   `{ "action": "confirm", "intentId", "transactionId" }`.
5. Grant the in-save sponsor only from the server's `ACTIVE` binding response,
   use its binding ID as the durable purchase token and persist immediately.
6. On launch and before weekly settlement, call `status` for the same
   product/mode/save. Remove sponsor presentation/slot/future payment when the
   server reports `REVOKED`, `TRANSFER_BLOCKED` or `REVERSAL_REVIEW`. Preserve
   previously paid balances.
7. If online verification is unavailable, use the cached
   `offlineGraceExpiresAt`; pause sponsor settlement once it passes.
8. After subsequent local saves, call `backup` with the same
   product/mode/save plus the complete `saveSnapshot`. It updates only the
   authenticated active-or-grace binding for that exact save and rejects older
   `updatedAt` values or same-time conflicting data. The backend endpoint is
   implemented; the client autosave caller/cadence is still pending and must be
   completed before checkout is enabled.
9. `recover` requires live RevenueCat verification and returns only the latest
   hash-checked snapshot whose save ID and product match the authenticated
   binding.
10. Intentional deletion calls `delete` for the exact product/mode/save. The
    service tombstones every consumed transaction for that save and cascades
    removal of its intent, binding and backup. A zero-count retry is a valid
    idempotent confirmation that nothing recoverable remains.

## Required sandbox tests

- unauthenticated and anonymous accounts cannot create an intent;
- a Player product cannot bind to a Manager save or vice versa;
- the same idempotency key returns the same intent;
- one transaction cannot bind to another user/save, including concurrent calls;
- webhook HMAC, timestamp, app, store, product and environment failures reject;
- webhook retries return `DUPLICATE`, while the same event ID with a different
  body hash rejects;
- webhook store-facing product IDs resolve only through the configured
  store/App/internal-product allowlist;
- refund revokes future access without changing already-paid game currency;
- refund reversal reactivates only the original same-save binding, or enters
  review if that save has since been repurchased;
- RevenueCat transfer freezes rather than moves the binding;
- stale lifecycle events cannot override a newer refund/transfer state;
- authoritative non-owned live verification persists revocation;
- seven days of provider outage preserves cached access, then pauses payment;
- cloud-backup writes cannot cross user, mode, product, slot or save boundaries;
- recovery returns the exact hash-checked save and never another slot/save;
- deliberate save deletion removes the server binding/backup before local
  deletion, is safe to retry after a lost response and never frees the
  transaction for another save;
- account deletion first creates an expiring peppered transaction tombstone,
  sets the durable write block, requests RevenueCat customer erasure when live,
  then removes checkout intents, bindings and backups; the same store
  transaction remains unusable while the approved audit period is active.
