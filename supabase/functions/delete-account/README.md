# `delete-account` Edge Function

Deploy only after `202608200001_account_deletion.sql` and all user-owned table
migrations are applied. Do not deploy with `--no-verify-jwt`.

Required secrets:

```text
SUPABASE_SERVICE_ROLE_KEY=server-only service role key
ACCOUNT_DELETION_HMAC_SECRET=random secret with at least 32 characters
ACCOUNT_DELETION_REQUEST_RETENTION_DAYS=approved request-audit retention
PREMIUM_SPONSOR_TRANSACTION_PEPPER=same >=32-character sponsor-server pepper
ACCOUNT_DELETION_PURCHASE_AUDIT_DAYS=approved purchase-audit retention
PREMIUM_SPONSOR_CHECKOUT_ENABLED=false until paid checkout is live
REVENUECAT_ANY_IAP_ENABLED=false until every release IAP path is live
REVENUECAT_USES_SUPABASE_UUID_IDENTITY=false until identity tests pass
REVENUECAT_CUSTOMER_DELETION_ENABLED=false until RevenueCat erasure is configured
```

Before any RevenueCat release checkout/restore is enabled, set
`REVENUECAT_ANY_IAP_ENABLED=true`, verify every SDK operation uses the
recoverable Supabase UUID, then set
`REVENUECAT_USES_SUPABASE_UUID_IDENTITY=true` and
`REVENUECAT_CUSTOMER_DELETION_ENABLED=true`,
`REVENUECAT_PROJECT_ID`, and a separate
`REVENUECAT_CUSTOMER_DELETION_SECRET_API_KEY` limited to
`customer_information:customers:read_write`. The function refuses a deployment
state where any IAP is enabled but UUID identity or RevenueCat customer erasure
is disabled. There is no trustworthy server mapping for anonymous RevenueCat
aliases created by historical development builds; production IAP must remain
off rather than pretending those aliases can be deleted by Supabase UUID.

Optional secrets:

```text
ACCOUNT_DELETION_STORAGE_BUCKETS=comma,separated,private-bucket-names
ACCOUNT_DELETION_ALLOWED_ORIGIN=https://approved-website.example
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are normally supplied by Supabase. The
service derives the account from a verified bearer JWT, never from request
JSON. Before purging sponsor bindings, it retains only an expiring peppered
transaction tombstone for replay/refund defense. Tombstone validation runs
before external or local deletion. A durable per-user write block is created in
that same transaction and survives retries. If RevenueCat integration is live,
the function next requests its v2 customer deletion (200/202/404 are
idempotent success), then purges Storage, gameplay data,
save/branding/entitlement links and uses the server-only Auth admin API. The
mobile app calls it with an empty body. Keep the sponsor pepper stable until all
old tombstone and webhook-ledger fingerprints expire and are pruned, unless
versioned old+new comparison has already been deployed; the database rejects
mismatches while either kind remains live.

The pseudonymous request table must be pruned using
`legal.config.json`'s approved `deletionRequestAuditDays` retention.
The function prunes opportunistically; schedule the service-role-only
`prune_expired_account_deletion_requests()` and
`prune_expired_premium_sponsor_transaction_tombstones()` plus
`prune_expired_premium_sponsor_webhook_events()` RPCs if deletion traffic is
sparse.
