-- Server-owned exact-save premium sponsor purchase ledger.
--
-- The mobile client receives intent/binding status and recovery data only
-- through authenticated Edge Functions. All table access and writes are
-- service-owned so raw snapshots can never bypass live recovery checks.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
-- An earlier project migration installed pgcrypto without an explicit target
-- schema. Normalize it so the security-definer functions below can use a
-- fixed, non-public-qualified HMAC implementation on both fresh and upgraded
-- projects.
do $$
begin
  if exists (
    select 1
      from pg_catalog.pg_extension e
      join pg_catalog.pg_namespace n on n.oid = e.extnamespace
     where e.extname = 'pgcrypto' and n.nspname <> 'extensions'
  ) then
    alter extension pgcrypto set schema extensions;
  end if;
end;
$$;

create table if not exists public.premium_sponsor_checkout_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null check (product_id in ('player_save_sponsor', 'manager_save_sponsor')),
  mode text not null check (mode in ('career', 'manager')),
  save_id text not null check (char_length(save_id) between 8 and 128),
  save_slot smallint not null check (save_slot between 1 and 6),
  save_key text not null check (char_length(save_key) between 8 and 32),
  revenuecat_app_user_id text not null check (char_length(revenuecat_app_user_id) between 1 and 128),
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 128),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'BOUND', 'EXPIRED', 'CANCELLED')),
  save_snapshot jsonb not null check (jsonb_typeof(save_snapshot) = 'object'),
  snapshot_sha256 text not null check (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  unique (user_id, idempotency_key),
  check (
    (mode = 'career' and product_id = 'player_save_sponsor') or
    (mode = 'manager' and product_id = 'manager_save_sponsor')
  ),
  check (save_key = 'sg:' || mode || ':' || save_slot::text),
  check (save_snapshot ->> 'id' = save_id),
  check (save_snapshot ->> 'mode' = mode),
  check (pg_column_size(save_snapshot) <= 8388608)
);

-- A webhook carries a store transaction but no checkout-intent ID. Limiting an
-- account/product to one pending intent prevents an event from guessing between
-- two exact saves.
create unique index if not exists premium_sponsor_one_pending_intent_per_product
  on public.premium_sponsor_checkout_intents (user_id, product_id)
  where status = 'PENDING';

create index if not exists premium_sponsor_checkout_intents_user_created_idx
  on public.premium_sponsor_checkout_intents (user_id, created_at desc);

create table if not exists public.premium_sponsor_purchases (
  id uuid primary key default gen_random_uuid(),
  checkout_intent_id uuid not null unique
    references public.premium_sponsor_checkout_intents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null check (product_id in ('player_save_sponsor', 'manager_save_sponsor')),
  mode text not null check (mode in ('career', 'manager')),
  save_id text not null check (char_length(save_id) between 8 and 128),
  save_slot smallint not null check (save_slot between 1 and 6),
  save_key text not null check (char_length(save_key) between 8 and 32),
  revenuecat_app_user_id text not null check (char_length(revenuecat_app_user_id) between 1 and 128),
  transaction_id text not null check (char_length(transaction_id) between 1 and 255),
  original_transaction_id text check (
    original_transaction_id is null or char_length(original_transaction_id) between 1 and 255
  ),
  revenuecat_app_id text not null check (char_length(revenuecat_app_id) between 1 and 128),
  store text not null check (store in ('APP_STORE', 'PLAY_STORE')),
  environment text not null check (environment in ('SANDBOX', 'PRODUCTION')),
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'REVOKED', 'TRANSFER_BLOCKED', 'REVERSAL_REVIEW')),
  status_reason text,
  purchased_at timestamptz not null,
  first_verified_at timestamptz not null,
  last_verified_at timestamptz not null,
  offline_grace_expires_at timestamptz not null,
  last_store_event_at timestamptz not null,
  last_store_event_priority smallint not null default 10
    check (last_store_event_priority between 0 and 100),
  revoked_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (store, environment, transaction_id),
  check (
    (mode = 'career' and product_id = 'player_save_sponsor') or
    (mode = 'manager' and product_id = 'manager_save_sponsor')
  ),
  check (save_key = 'sg:' || mode || ':' || save_slot::text),
  check (offline_grace_expires_at >= last_verified_at)
);

-- A refunded transaction may be replaced by a later purchase for the same
-- save. A transfer-blocked binding remains protected until support resolves it.
create unique index if not exists premium_sponsor_one_effective_license_per_save
  on public.premium_sponsor_purchases (user_id, save_id, product_id)
  where status in ('ACTIVE', 'TRANSFER_BLOCKED');

create index if not exists premium_sponsor_purchases_user_save_idx
  on public.premium_sponsor_purchases (user_id, save_id, purchased_at desc);

create index if not exists premium_sponsor_purchases_revenuecat_user_idx
  on public.premium_sponsor_purchases (revenuecat_app_user_id);

create table if not exists public.premium_sponsor_save_backups (
  purchase_id uuid primary key references public.premium_sponsor_purchases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null check (product_id in ('player_save_sponsor', 'manager_save_sponsor')),
  mode text not null check (mode in ('career', 'manager')),
  save_id text not null,
  save_slot smallint not null check (save_slot between 1 and 6),
  save_key text not null,
  save_snapshot jsonb not null check (jsonb_typeof(save_snapshot) = 'object'),
  snapshot_sha256 text not null check (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  captured_at timestamptz not null default clock_timestamp(),
  check (save_snapshot ->> 'id' = save_id),
  check (save_snapshot ->> 'mode' = mode),
  check (pg_column_size(save_snapshot) <= 8388608)
);

create index if not exists premium_sponsor_save_backups_user_save_idx
  on public.premium_sponsor_save_backups (user_id, save_id);

-- Deletion spans several external calls and therefore cannot be protected by a
-- transaction lock alone. This service-owned marker is created atomically with
-- transaction tombstoning, survives retries, and is removed only when the Auth
-- user is deleted. It also closes the valid-but-stale JWT write window.
create table if not exists public.account_deletion_write_blocks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  blocked_at timestamptz not null default clock_timestamp()
);

-- This table intentionally stores no raw webhook body, App User ID, alias, or
-- store transaction ID. The hashes are sufficient for replay/audit checks and
-- are no longer attributable after the user's purchase rows are deleted.
create table if not exists public.premium_sponsor_webhook_events (
  event_id text primary key check (char_length(event_id) between 1 and 128),
  body_sha256 text not null check (body_sha256 ~ '^[0-9a-f]{64}$'),
  pepper_verifier text not null check (pepper_verifier ~ '^[0-9a-f]{64}$'),
  transaction_fingerprint text check (
    transaction_fingerprint is null or transaction_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  event_type text not null check (char_length(event_type) between 1 and 80),
  revenuecat_app_id text not null check (char_length(revenuecat_app_id) between 1 and 128),
  environment text not null check (environment in ('SANDBOX', 'PRODUCTION', 'UNSPECIFIED')),
  event_timestamp timestamptz not null,
  received_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  processed_at timestamptz,
  outcome text not null default 'RECEIVED',
  matched_purchase_id uuid references public.premium_sponsor_purchases(id) on delete set null
);

-- Account deletion removes the entitlement, save backup and all attributable
-- purchase data. This minimal peppered fingerprint prevents the same consumed
-- store transaction being rebound after deletion. It contains no user/save ID,
-- store transaction ID, App User ID or branding and expires after the approved
-- purchase-audit retention period.
create table if not exists public.premium_sponsor_transaction_tombstones (
  transaction_fingerprint text primary key
    check (transaction_fingerprint ~ '^[0-9a-f]{64}$'),
  pepper_verifier text not null check (pepper_verifier ~ '^[0-9a-f]{64}$'),
  product_id text not null
    check (product_id in ('player_save_sponsor', 'manager_save_sponsor')),
  store text not null check (store in ('APP_STORE', 'PLAY_STORE')),
  environment text not null check (environment in ('SANDBOX', 'PRODUCTION')),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  check (expires_at > created_at)
);

create index if not exists premium_sponsor_transaction_tombstones_expiry_idx
  on public.premium_sponsor_transaction_tombstones (expires_at);

create index if not exists premium_sponsor_webhook_events_expiry_idx
  on public.premium_sponsor_webhook_events (expires_at);

alter table public.premium_sponsor_checkout_intents enable row level security;
alter table public.premium_sponsor_purchases enable row level security;
alter table public.premium_sponsor_save_backups enable row level security;
alter table public.account_deletion_write_blocks enable row level security;
alter table public.premium_sponsor_webhook_events enable row level security;
alter table public.premium_sponsor_transaction_tombstones enable row level security;

drop policy if exists "premium_sponsor_checkout_intents_select_own"
  on public.premium_sponsor_checkout_intents;
drop policy if exists "premium_sponsor_purchases_select_own"
  on public.premium_sponsor_purchases;

-- There are deliberately no authenticated PostgREST policies. Intents and
-- backups both contain raw snapshots, while binding status must be reconciled
-- before the app trusts it.
drop policy if exists "premium_sponsor_save_backups_select_own"
  on public.premium_sponsor_save_backups;

revoke all on table public.premium_sponsor_checkout_intents from anon, authenticated;
revoke all on table public.premium_sponsor_purchases from anon, authenticated;
revoke all on table public.premium_sponsor_save_backups from anon, authenticated;
revoke all on table public.account_deletion_write_blocks from anon, authenticated;
revoke all on table public.premium_sponsor_webhook_events from anon, authenticated;
revoke all on table public.premium_sponsor_transaction_tombstones from anon, authenticated;

grant select on table public.premium_sponsor_checkout_intents to service_role;
grant select on table public.premium_sponsor_purchases to service_role;
grant select on table public.premium_sponsor_save_backups to service_role;
grant select on table public.account_deletion_write_blocks to service_role;

create or replace function public.premium_sponsor_lock_account_for_write(
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_user_id is null then
    return false;
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended('account-deletion-write:' || p_user_id::text, 0)
  );
  return exists (select 1 from auth.users where id = p_user_id)
    and not exists (
      select 1 from public.account_deletion_write_blocks where user_id = p_user_id
    );
end;
$$;

create or replace function public.assert_premium_sponsor_account_mutable(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if not public.premium_sponsor_lock_account_for_write(p_user_id) then
    raise exception 'Account is being deleted or no longer exists';
  end if;
end;
$$;

-- Account deletion purges these tables before Auth deletion. Serializing their
-- writes on the same key prevents a still-valid JWT or an in-flight service RPC
-- from recreating rows after its table was purged.
create or replace function public.enforce_account_deletion_write_block()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_user_id_text text := to_jsonb(new) ->> 'user_id';
  v_user_id uuid;
begin
  if v_user_id_text is null or
     v_user_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return new;
  end if;
  v_user_id := v_user_id_text::uuid;
  perform pg_advisory_xact_lock(
    hashtextextended('account-deletion-write:' || v_user_id::text, 0)
  );
  if exists (
    select 1 from public.account_deletion_write_blocks where user_id = v_user_id
  ) then
    raise exception 'Account deletion is in progress' using errcode = '28000';
  end if;
  return new;
end;
$$;

drop trigger if exists cloud_saves_account_deletion_guard on public.cloud_saves;
create trigger cloud_saves_account_deletion_guard
  before insert or update on public.cloud_saves
  for each row execute function public.enforce_account_deletion_write_block();

drop trigger if exists daily_verifications_account_deletion_guard
  on public.daily_verifications;
create trigger daily_verifications_account_deletion_guard
  before insert or update on public.daily_verifications
  for each row execute function public.enforce_account_deletion_write_block();

drop trigger if exists reward_transactions_account_deletion_guard
  on public.reward_transactions;
create trigger reward_transactions_account_deletion_guard
  before insert or update on public.reward_transactions
  for each row execute function public.enforce_account_deletion_write_block();

drop trigger if exists leaderboard_account_deletion_guard on public.leaderboard;
create trigger leaderboard_account_deletion_guard
  before insert or update on public.leaderboard
  for each row execute function public.enforce_account_deletion_write_block();

drop trigger if exists shadow_leaderboard_account_deletion_guard on public.shadow_leaderboard;
create trigger shadow_leaderboard_account_deletion_guard
  before insert or update on public.shadow_leaderboard
  for each row execute function public.enforce_account_deletion_write_block();

create or replace function public.premium_sponsor_transaction_fingerprint(
  p_product_id text,
  p_store text,
  p_environment text,
  p_transaction_id text,
  p_transaction_pepper text
)
returns text
language plpgsql
immutable
strict
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_product_id not in ('player_save_sponsor', 'manager_save_sponsor') or
     p_store not in ('APP_STORE', 'PLAY_STORE') or
     p_environment not in ('SANDBOX', 'PRODUCTION') or
     char_length(p_transaction_id) not between 1 and 255 then
    raise exception 'Malformed premium sponsor transaction fingerprint input';
  end if;
  if char_length(p_transaction_pepper) < 32 then
    raise exception 'Premium sponsor transaction pepper is too weak';
  end if;
  return encode(
    extensions.hmac(
      p_product_id || chr(31) || p_store || chr(31) || p_environment || chr(31) ||
        p_transaction_id,
      p_transaction_pepper,
      'sha256'
    ),
    'hex'
  );
end;
$$;

create or replace function public.premium_sponsor_pepper_verifier(
  p_transaction_pepper text
)
returns text
language plpgsql
immutable
strict
set search_path = pg_catalog, pg_temp
as $$
begin
  if char_length(p_transaction_pepper) < 32 then
    raise exception 'Premium sponsor transaction pepper is too weak';
  end if;
  return encode(
    extensions.hmac(
      'premium-sponsor-transaction-pepper-verifier-v1',
      p_transaction_pepper,
      'sha256'
    ),
    'hex'
  );
end;
$$;

create or replace function public.assert_premium_sponsor_transaction_pepper(
  p_transaction_pepper text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_verifier text := public.premium_sponsor_pepper_verifier(p_transaction_pepper);
begin
  perform pg_advisory_xact_lock(hashtextextended('premium-sponsor-pepper-v1', 0));
  if exists (
    select 1 from public.premium_sponsor_transaction_tombstones
     where expires_at > clock_timestamp() and pepper_verifier <> v_verifier
  ) then
    raise exception 'Premium sponsor transaction pepper does not match live tombstones';
  end if;
  if exists (
    select 1 from public.premium_sponsor_webhook_events
     where expires_at > clock_timestamp() and pepper_verifier <> v_verifier
  ) then
    raise exception 'Premium sponsor transaction pepper does not match live webhook events';
  end if;
end;
$$;

create or replace function public.tombstone_premium_sponsor_transactions(
  p_user_id uuid,
  p_transaction_pepper text,
  p_retention_days integer
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_count integer := 0;
  v_now timestamptz := clock_timestamp();
  v_pepper_verifier text;
begin
  if p_user_id is null then
    raise exception 'Account ID is required for premium sponsor tombstoning';
  end if;
  if char_length(coalesce(p_transaction_pepper, '')) < 32 then
    raise exception 'Premium sponsor transaction pepper is too weak';
  end if;
  if p_retention_days is null or p_retention_days not between 1 and 3650 then
    raise exception 'Premium sponsor audit retention must be between 1 and 3650 days';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('premium-sponsor-pepper-v1', 0));
  perform public.assert_premium_sponsor_transaction_pepper(p_transaction_pepper);
  v_pepper_verifier := public.premium_sponsor_pepper_verifier(p_transaction_pepper);

  perform pg_advisory_xact_lock(
    hashtextextended('account-deletion-write:' || p_user_id::text, 0)
  );
  if exists (select 1 from auth.users where id = p_user_id) then
    insert into public.account_deletion_write_blocks (user_id, blocked_at)
    values (p_user_id, v_now)
    on conflict (user_id) do nothing;
  elsif exists (
    select 1 from public.premium_sponsor_purchases where user_id = p_user_id
  ) then
    raise exception 'Sponsor purchases exist without their Auth account';
  end if;

  update public.premium_sponsor_checkout_intents
     set status = 'CANCELLED', updated_at = v_now
   where user_id = p_user_id and status = 'PENDING';

  update public.premium_sponsor_purchases
     set status = 'REVOKED', status_reason = 'ACCOUNT_DELETION',
         revoked_at = coalesce(revoked_at, v_now), updated_at = v_now
   where user_id = p_user_id and status <> 'REVOKED';

  insert into public.premium_sponsor_transaction_tombstones (
    transaction_fingerprint, pepper_verifier, product_id, store, environment,
    created_at, expires_at
  )
  select public.premium_sponsor_transaction_fingerprint(
      product_id, store, environment, transaction_id, p_transaction_pepper
    ),
    v_pepper_verifier, product_id, store, environment, v_now,
    v_now + make_interval(days => p_retention_days)
    from public.premium_sponsor_purchases
   where user_id = p_user_id
  on conflict (transaction_fingerprint) do update
    set expires_at = greatest(
      public.premium_sponsor_transaction_tombstones.expires_at,
      excluded.expires_at
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- A deliberate in-app save deletion destroys only that exact save's permanent
-- sponsor binding and recovery snapshot. The transaction fingerprint remains
-- temporarily so the consumed purchase can never be rebound to another save.
create or replace function public.delete_premium_sponsor_exact_save(
  p_user_id uuid,
  p_product_id text,
  p_save_id text,
  p_transaction_pepper text,
  p_retention_days integer
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_count integer := 0;
  v_now timestamptz := clock_timestamp();
  v_pepper_verifier text;
begin
  if p_product_id not in ('player_save_sponsor', 'manager_save_sponsor') then
    raise exception 'Unsupported premium sponsor product';
  end if;
  if p_save_id is null or p_save_id !~ '^(career|manager)-[A-Za-z0-9_-]{1,112}$' then
    raise exception 'Malformed save ID';
  end if;
  if (p_product_id = 'player_save_sponsor' and p_save_id !~ '^career-') or
     (p_product_id = 'manager_save_sponsor' and p_save_id !~ '^manager-') then
    raise exception 'Product does not match save mode';
  end if;
  if char_length(coalesce(p_transaction_pepper, '')) < 32 then
    raise exception 'Premium sponsor transaction pepper is too weak';
  end if;
  if p_retention_days is null or p_retention_days not between 1 and 3650 then
    raise exception 'Premium sponsor audit retention must be between 1 and 3650 days';
  end if;

  perform public.assert_premium_sponsor_account_mutable(p_user_id);
  perform pg_advisory_xact_lock(hashtextextended('premium-sponsor-pepper-v1', 0));
  perform public.assert_premium_sponsor_transaction_pepper(p_transaction_pepper);
  v_pepper_verifier := public.premium_sponsor_pepper_verifier(p_transaction_pepper);
  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_save_id || ':' || p_product_id, 0)
  );

  insert into public.premium_sponsor_transaction_tombstones (
    transaction_fingerprint, pepper_verifier, product_id, store, environment,
    created_at, expires_at
  )
  select public.premium_sponsor_transaction_fingerprint(
      product_id, store, environment, transaction_id, p_transaction_pepper
    ),
    v_pepper_verifier, product_id, store, environment, v_now,
    v_now + make_interval(days => p_retention_days)
    from public.premium_sponsor_purchases
   where user_id = p_user_id and product_id = p_product_id and save_id = p_save_id
  on conflict (transaction_fingerprint) do update
    set expires_at = greatest(
      public.premium_sponsor_transaction_tombstones.expires_at,
      excluded.expires_at
    );
  get diagnostics v_count = row_count;

  -- Deleting the intent cascades through purchase and exact-save backup rows.
  delete from public.premium_sponsor_checkout_intents
   where user_id = p_user_id and product_id = p_product_id and save_id = p_save_id;

  return v_count;
end;
$$;

create or replace function public.prune_expired_premium_sponsor_transaction_tombstones()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_count integer := 0;
begin
  delete from public.premium_sponsor_transaction_tombstones
   where expires_at <= clock_timestamp();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.prune_expired_premium_sponsor_webhook_events()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_count integer := 0;
begin
  delete from public.premium_sponsor_webhook_events
   where expires_at <= clock_timestamp();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.create_premium_sponsor_checkout_intent(
  p_user_id uuid,
  p_product_id text,
  p_mode text,
  p_save_id text,
  p_save_slot smallint,
  p_revenuecat_app_user_id text,
  p_idempotency_key text,
  p_save_snapshot jsonb,
  p_snapshot_sha256 text
)
returns table(intent_id uuid, intent_status text, intent_expires_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_existing public.premium_sponsor_checkout_intents%rowtype;
  v_now timestamptz := clock_timestamp();
  v_save_key text := 'sg:' || p_mode || ':' || p_save_slot::text;
begin
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Valid authenticated user is required';
  end if;
  perform public.assert_premium_sponsor_account_mutable(p_user_id);
  if p_revenuecat_app_user_id is distinct from p_user_id::text then
    raise exception 'RevenueCat App User ID must equal the authenticated account ID';
  end if;
  if p_product_id not in ('player_save_sponsor', 'manager_save_sponsor') then
    raise exception 'Unsupported premium sponsor product';
  end if;
  if (p_product_id = 'player_save_sponsor' and p_mode <> 'career') or
     (p_product_id = 'manager_save_sponsor' and p_mode <> 'manager') then
    raise exception 'Product does not match save mode';
  end if;
  if p_save_id is null or p_save_id !~ '^(career|manager)-[A-Za-z0-9_-]{1,112}$' then
    raise exception 'Malformed save ID';
  end if;
  if p_save_slot not between 1 and 6 then
    raise exception 'Save slot must be between 1 and 6';
  end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9:_-]{16,128}$' then
    raise exception 'Malformed idempotency key';
  end if;
  if jsonb_typeof(p_save_snapshot) <> 'object' or
     p_save_snapshot ->> 'id' is distinct from p_save_id or
     p_save_snapshot ->> 'mode' is distinct from p_mode or
     jsonb_typeof(p_save_snapshot -> 'schemaVersion') <> 'number' then
    raise exception 'Save snapshot does not match the requested exact save';
  end if;
  if pg_column_size(p_save_snapshot) > 8388608 then
    raise exception 'Save snapshot exceeds 8 MiB';
  end if;
  if p_snapshot_sha256 is null or p_snapshot_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Malformed snapshot hash';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_product_id, 0)
  );

  update public.premium_sponsor_checkout_intents
     set status = 'EXPIRED', updated_at = v_now
   where user_id = p_user_id and status = 'PENDING' and expires_at <= v_now;

  select * into v_existing
    from public.premium_sponsor_checkout_intents
   where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.product_id <> p_product_id or v_existing.mode <> p_mode or
       v_existing.save_id <> p_save_id or v_existing.save_slot <> p_save_slot then
      raise exception 'Idempotency key was already used for different checkout parameters';
    end if;
    return query select v_existing.id, v_existing.status, v_existing.expires_at;
    return;
  end if;

  if exists (
    select 1 from public.premium_sponsor_purchases
     where user_id = p_user_id and save_id = p_save_id and product_id = p_product_id
       and status in ('ACTIVE', 'TRANSFER_BLOCKED')
  ) then
    raise exception 'This exact save already has an effective premium sponsor binding';
  end if;

  select * into v_existing
    from public.premium_sponsor_checkout_intents
   where user_id = p_user_id and product_id = p_product_id
     and status = 'PENDING'
   order by created_at desc
   limit 1;
  if found then
    if v_existing.save_id <> p_save_id or v_existing.save_slot <> p_save_slot then
      raise exception 'Another exact save already has a pending checkout for this product';
    end if;
    return query select v_existing.id, v_existing.status, v_existing.expires_at;
    return;
  end if;

  insert into public.premium_sponsor_checkout_intents (
    user_id, product_id, mode, save_id, save_slot, save_key,
    revenuecat_app_user_id, idempotency_key, status, save_snapshot,
    snapshot_sha256, created_at, updated_at, expires_at
  ) values (
    p_user_id, p_product_id, p_mode, p_save_id, p_save_slot, v_save_key,
    p_revenuecat_app_user_id, p_idempotency_key, 'PENDING', p_save_snapshot,
    p_snapshot_sha256, v_now, v_now, v_now + interval '30 minutes'
  )
  returning id, status, expires_at into intent_id, intent_status, intent_expires_at;

  return next;
end;
$$;

create or replace function public.confirm_premium_sponsor_purchase(
  p_user_id uuid,
  p_intent_id uuid,
  p_transaction_id text,
  p_original_transaction_id text,
  p_revenuecat_app_user_id text,
  p_store text,
  p_revenuecat_app_id text,
  p_environment text,
  p_purchased_at timestamptz,
  p_transaction_pepper text
)
returns table(
  purchase_id uuid,
  purchase_status text,
  product_id text,
  save_id text,
  last_verified_at timestamptz,
  offline_grace_expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_intent public.premium_sponsor_checkout_intents%rowtype;
  v_existing public.premium_sponsor_purchases%rowtype;
  v_latest_event_type text;
  v_latest_event_timestamp timestamptz;
  v_latest_event_priority smallint;
  v_now timestamptz := clock_timestamp();
begin
  if p_transaction_id is null or char_length(p_transaction_id) not between 1 and 255 then
    raise exception 'Malformed transaction ID';
  end if;
  if p_store not in ('APP_STORE', 'PLAY_STORE') or
     p_environment not in ('SANDBOX', 'PRODUCTION') then
    raise exception 'Unsupported store or environment';
  end if;
  if char_length(coalesce(p_transaction_pepper, '')) < 32 then
    raise exception 'Premium sponsor transaction pepper is too weak';
  end if;
  perform public.assert_premium_sponsor_transaction_pepper(p_transaction_pepper);
  perform public.assert_premium_sponsor_account_mutable(p_user_id);

  select * into v_intent
    from public.premium_sponsor_checkout_intents
   where id = p_intent_id and user_id = p_user_id
   for update;
  if not found then
    raise exception 'Checkout intent was not found for this account';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || v_intent.save_id || ':' || v_intent.product_id, 0)
  );

  if exists (
    select 1 from public.premium_sponsor_transaction_tombstones
     where transaction_fingerprint = public.premium_sponsor_transaction_fingerprint(
       v_intent.product_id, p_store, p_environment, p_transaction_id, p_transaction_pepper
     ) and expires_at > v_now
  ) then
    raise exception 'Store transaction was previously consumed by a deleted account';
  end if;

  select * into v_existing
    from public.premium_sponsor_purchases
   where store = p_store and environment = p_environment and transaction_id = p_transaction_id
   for update;
  if found then
    if v_existing.user_id <> p_user_id or v_existing.checkout_intent_id <> p_intent_id or
       v_existing.save_id <> v_intent.save_id or v_existing.product_id <> v_intent.product_id then
      raise exception 'Store transaction is already bound to another exact save';
    end if;
    -- A historical purchase still appearing in RevenueCat is not proof that a
    -- refund was reversed. Only REFUND_REVERSED may reactivate a revoked row.
    if v_existing.status = 'ACTIVE' then
      update public.premium_sponsor_purchases
         set last_verified_at = v_now,
             offline_grace_expires_at = v_now + interval '7 days',
             updated_at = v_now
       where id = v_existing.id
       returning * into v_existing;
    end if;
    return query select v_existing.id, v_existing.status, v_existing.product_id,
      v_existing.save_id, v_existing.last_verified_at, v_existing.offline_grace_expires_at;
    return;
  end if;

  if v_intent.status = 'BOUND' then
    raise exception 'Checkout intent is already bound to a different transaction';
  end if;
  if v_intent.status in ('EXPIRED', 'CANCELLED') then
    raise exception 'Checkout intent is no longer eligible';
  end if;
  if p_revenuecat_app_user_id is distinct from v_intent.revenuecat_app_user_id or
     p_revenuecat_app_user_id is distinct from p_user_id::text then
    raise exception 'Purchase identity does not match the authenticated account';
  end if;
  if p_purchased_at < v_intent.created_at - interval '5 minutes' or
     p_purchased_at > v_intent.expires_at + interval '5 minutes' or
     p_purchased_at > v_now + interval '5 minutes' then
    raise exception 'Purchase timestamp is outside the checkout intent window';
  end if;
  if exists (
    select 1 from public.premium_sponsor_purchases
     where user_id = p_user_id and save_id = v_intent.save_id
       and product_id = v_intent.product_id and status in ('ACTIVE', 'TRANSFER_BLOCKED')
  ) then
    raise exception 'This exact save already has an effective premium sponsor binding';
  end if;

  insert into public.premium_sponsor_purchases (
    checkout_intent_id, user_id, product_id, mode, save_id, save_slot, save_key,
    revenuecat_app_user_id, transaction_id, original_transaction_id,
    revenuecat_app_id, store, environment, status, purchased_at,
    first_verified_at, last_verified_at, offline_grace_expires_at,
    last_store_event_at, last_store_event_priority,
    created_at, updated_at
  ) values (
    v_intent.id, p_user_id, v_intent.product_id, v_intent.mode, v_intent.save_id,
    v_intent.save_slot, v_intent.save_key, p_revenuecat_app_user_id,
    p_transaction_id, nullif(p_original_transaction_id, ''), p_revenuecat_app_id,
    p_store, p_environment, 'ACTIVE', p_purchased_at, v_now, v_now,
    v_now + interval '7 days', p_purchased_at, 10, v_now, v_now
  ) returning * into v_existing;

  -- A refund webhook can beat the purchase webhook/client reconcile. Recover
  -- the latest retained transaction state so late binding cannot resurrect an
  -- already-refunded transaction.
  select event.event_type, event.event_timestamp,
         case event.event_type when 'CANCELLATION' then 30
                               when 'REFUND_REVERSED' then 20 else 0 end
    into v_latest_event_type, v_latest_event_timestamp, v_latest_event_priority
    from public.premium_sponsor_webhook_events event
   where event.transaction_fingerprint = public.premium_sponsor_transaction_fingerprint(
       v_intent.product_id, p_store, p_environment, p_transaction_id,
       p_transaction_pepper
     )
     and event.event_type in ('CANCELLATION', 'REFUND_REVERSED')
   order by event.event_timestamp desc,
            case event.event_type when 'CANCELLATION' then 30
                                  when 'REFUND_REVERSED' then 20 else 0 end desc
   limit 1;
  if found and v_latest_event_timestamp >= p_purchased_at then
    update public.premium_sponsor_purchases
       set status = case when v_latest_event_type = 'CANCELLATION'
                         then 'REVOKED' else status end,
           status_reason = case when v_latest_event_type = 'CANCELLATION'
                                then 'REFUND_OR_REVOCATION' else status_reason end,
           revoked_at = case when v_latest_event_type = 'CANCELLATION'
                             then v_now else revoked_at end,
           last_store_event_at = v_latest_event_timestamp,
           last_store_event_priority = v_latest_event_priority,
           updated_at = v_now
     where id = v_existing.id
     returning * into v_existing;
  end if;

  insert into public.premium_sponsor_save_backups (
    purchase_id, user_id, product_id, mode, save_id, save_slot, save_key,
    save_snapshot, snapshot_sha256, captured_at
  ) values (
    v_existing.id, v_existing.user_id, v_existing.product_id, v_existing.mode,
    v_existing.save_id, v_existing.save_slot, v_existing.save_key,
    v_intent.save_snapshot, v_intent.snapshot_sha256, v_now
  );

  update public.premium_sponsor_checkout_intents
     set status = 'BOUND', updated_at = v_now
   where id = v_intent.id;

  return query select v_existing.id, v_existing.status, v_existing.product_id,
    v_existing.save_id, v_existing.last_verified_at, v_existing.offline_grace_expires_at;
end;
$$;

create or replace function public.refresh_premium_sponsor_verification(
  p_user_id uuid,
  p_purchase_id uuid
)
returns table(
  purchase_id uuid,
  purchase_status text,
  last_verified_at timestamptz,
  offline_grace_expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_purchase public.premium_sponsor_purchases%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  perform public.assert_premium_sponsor_account_mutable(p_user_id);
  update public.premium_sponsor_purchases
     set last_verified_at = v_now,
         offline_grace_expires_at = v_now + interval '7 days',
         updated_at = v_now
   where id = p_purchase_id and user_id = p_user_id and status = 'ACTIVE'
   returning * into v_purchase;
  if not found then
    select * into v_purchase from public.premium_sponsor_purchases
     where id = p_purchase_id and user_id = p_user_id;
  end if;
  if not found then
    raise exception 'Premium sponsor purchase not found for this account';
  end if;
  return query select v_purchase.id, v_purchase.status,
    v_purchase.last_verified_at, v_purchase.offline_grace_expires_at;
end;
$$;

create or replace function public.update_premium_sponsor_save_backup(
  p_user_id uuid,
  p_purchase_id uuid,
  p_save_snapshot jsonb,
  p_snapshot_sha256 text
)
returns table(snapshot_sha256 text, captured_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_purchase public.premium_sponsor_purchases%rowtype;
  v_backup public.premium_sponsor_save_backups%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  perform public.assert_premium_sponsor_account_mutable(p_user_id);
  select * into v_purchase from public.premium_sponsor_purchases
   where id = p_purchase_id and user_id = p_user_id
   for update;
  if not found then
    raise exception 'Premium sponsor purchase not found for this account';
  end if;
  if v_purchase.status <> 'ACTIVE' or v_purchase.offline_grace_expires_at < v_now then
    raise exception 'Premium sponsor binding is not eligible for cloud backup';
  end if;
  if jsonb_typeof(p_save_snapshot) <> 'object' or
     p_save_snapshot ->> 'id' is distinct from v_purchase.save_id or
     p_save_snapshot ->> 'mode' is distinct from v_purchase.mode or
     jsonb_typeof(p_save_snapshot -> 'schemaVersion') <> 'number' or
     jsonb_typeof(p_save_snapshot -> 'updatedAt') <> 'number' then
    raise exception 'Cloud backup snapshot does not match the bound exact save';
  end if;
  if pg_column_size(p_save_snapshot) > 8388608 then
    raise exception 'Save snapshot exceeds 8 MiB';
  end if;
  if p_snapshot_sha256 is null or p_snapshot_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Malformed snapshot hash';
  end if;

  select * into v_backup
    from public.premium_sponsor_save_backups
   where purchase_id = v_purchase.id and user_id = v_purchase.user_id
   for update;
  if not found then
    raise exception 'Premium sponsor cloud backup is missing';
  end if;
  if (p_save_snapshot ->> 'updatedAt')::numeric <
     (v_backup.save_snapshot ->> 'updatedAt')::numeric then
    raise exception 'Cloud backup snapshot is older than the stored snapshot';
  end if;
  if (p_save_snapshot ->> 'updatedAt')::numeric =
       (v_backup.save_snapshot ->> 'updatedAt')::numeric and
     p_snapshot_sha256 <> v_backup.snapshot_sha256 then
    raise exception 'Cloud backup timestamp conflicts with different save data';
  end if;
  if p_snapshot_sha256 = v_backup.snapshot_sha256 then
    snapshot_sha256 := v_backup.snapshot_sha256;
    captured_at := v_backup.captured_at;
    return next;
    return;
  end if;

  update public.premium_sponsor_save_backups as backup
     set save_snapshot = p_save_snapshot, snapshot_sha256 = p_snapshot_sha256,
         captured_at = v_now
   where backup.purchase_id = v_purchase.id and backup.user_id = v_purchase.user_id
     and backup.product_id = v_purchase.product_id and backup.mode = v_purchase.mode
     and backup.save_id = v_purchase.save_id and backup.save_slot = v_purchase.save_slot
   returning backup.snapshot_sha256, backup.captured_at
     into snapshot_sha256, captured_at;
  return next;
end;
$$;

create or replace function public.mark_premium_sponsor_verification_failure(
  p_user_id uuid,
  p_purchase_id uuid,
  p_outcome text
)
returns table(
  purchase_id uuid,
  purchase_status text,
  last_verified_at timestamptz,
  offline_grace_expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_purchase public.premium_sponsor_purchases%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_outcome not in ('NOT_OWNED', 'NOT_FOUND', 'VERIFICATION_MISMATCH') then
    raise exception 'Unsupported premium sponsor verification failure';
  end if;
  perform public.assert_premium_sponsor_account_mutable(p_user_id);
  select * into v_purchase
    from public.premium_sponsor_purchases
   where id = p_purchase_id and user_id = p_user_id
   for update;
  if not found then
    raise exception 'Premium sponsor purchase not found for this account';
  end if;

  if v_purchase.status = 'ACTIVE' then
    update public.premium_sponsor_purchases
       set status = case when p_outcome = 'NOT_OWNED' then 'REVOKED'
                         else 'TRANSFER_BLOCKED' end,
           status_reason = case p_outcome
             when 'NOT_OWNED' then 'LIVE_VERIFICATION_NOT_OWNED'
             when 'NOT_FOUND' then 'LIVE_VERIFICATION_NOT_FOUND'
             else 'LIVE_VERIFICATION_MISMATCH'
           end,
           revoked_at = coalesce(revoked_at, v_now),
           last_store_event_at = v_now,
           last_store_event_priority = 90,
           updated_at = v_now
     where id = v_purchase.id
     returning * into v_purchase;
  end if;

  return query select v_purchase.id, v_purchase.status,
    v_purchase.last_verified_at, v_purchase.offline_grace_expires_at;
end;
$$;

create or replace function public.process_premium_sponsor_webhook(
  p_event_id text,
  p_body_sha256 text,
  p_event_type text,
  p_revenuecat_app_id text,
  p_environment text,
  p_event_timestamp timestamptz,
  p_transaction_pepper text,
  p_audit_retention_days integer,
  p_product_id text default null,
  p_transaction_id text default null,
  p_original_transaction_id text default null,
  p_store text default null,
  p_purchased_at timestamptz default null,
  p_subject_app_user_ids text[] default '{}'
)
returns table(event_outcome text, matched_purchase_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_event public.premium_sponsor_webhook_events%rowtype;
  v_purchase public.premium_sponsor_purchases%rowtype;
  v_other_purchase_id uuid;
  v_transaction_fingerprint text;
  v_matched_purchase_id uuid;
  v_count integer := 0;
  v_candidates integer := 0;
  v_deleting integer := 0;
  v_event_priority smallint := case p_event_type
    when 'TRANSFER' then 40
    when 'CANCELLATION' then 30
    when 'REFUND_REVERSED' then 20
    when 'NON_RENEWING_PURCHASE' then 10
    else 0
  end;
  v_now timestamptz := clock_timestamp();
begin
  if char_length(coalesce(p_transaction_pepper, '')) < 32 then
    raise exception 'Premium sponsor transaction pepper is too weak';
  end if;
  if p_audit_retention_days is null or p_audit_retention_days not between 1 and 3650 then
    raise exception 'Premium sponsor webhook audit retention must be between 1 and 3650 days';
  end if;
  perform public.assert_premium_sponsor_transaction_pepper(p_transaction_pepper);

  delete from public.premium_sponsor_webhook_events where expires_at <= v_now;
  perform pg_advisory_xact_lock(
    hashtextextended('premium-sponsor-webhook:' || p_event_id, 0)
  );
  select * into v_event from public.premium_sponsor_webhook_events
   where event_id = p_event_id for update;
  if found then
    if v_event.body_sha256 <> p_body_sha256 then
      raise exception 'Webhook event ID was replayed with a different payload';
    end if;
    return query select 'DUPLICATE'::text, v_event.matched_purchase_id;
    return;
  end if;

  if p_transaction_id is not null and
     p_product_id in ('player_save_sponsor', 'manager_save_sponsor') then
    v_transaction_fingerprint := public.premium_sponsor_transaction_fingerprint(
      p_product_id, p_store, p_environment, p_transaction_id, p_transaction_pepper
    );
  end if;

  insert into public.premium_sponsor_webhook_events (
    event_id, body_sha256, pepper_verifier, transaction_fingerprint, event_type,
    revenuecat_app_id, environment, event_timestamp, received_at, expires_at, outcome
  ) values (
    p_event_id, p_body_sha256,
    public.premium_sponsor_pepper_verifier(p_transaction_pepper),
    v_transaction_fingerprint,
    p_event_type, p_revenuecat_app_id, p_environment,
    p_event_timestamp, v_now,
    v_now + make_interval(days => p_audit_retention_days), 'RECEIVED'
  );

  if p_event_type = 'TRANSFER' then
    for v_purchase in
      select purchase.*
        from public.premium_sponsor_purchases purchase
       where purchase.revenuecat_app_user_id = any(coalesce(p_subject_app_user_ids, '{}'))
         and purchase.revenuecat_app_id = p_revenuecat_app_id
         and (p_environment = 'UNSPECIFIED' or purchase.environment = p_environment)
       order by purchase.user_id, purchase.id
    loop
      v_candidates := v_candidates + 1;
      if not public.premium_sponsor_lock_account_for_write(v_purchase.user_id) then
        v_deleting := v_deleting + 1;
        continue;
      end if;
      update public.premium_sponsor_purchases
         set status = case when status = 'ACTIVE' then 'TRANSFER_BLOCKED' else status end,
             status_reason = case when status = 'ACTIVE' then 'REVENUECAT_TRANSFER'
                                  else 'REVENUECAT_TRANSFER_HISTORICAL' end,
             revoked_at = coalesce(revoked_at, v_now),
             last_store_event_at = p_event_timestamp,
             last_store_event_priority = v_event_priority,
             updated_at = v_now
       where id = v_purchase.id and (
           p_event_timestamp > last_store_event_at or
           (p_event_timestamp = last_store_event_at and
             v_event_priority > last_store_event_priority)
         );
      if found then
        v_count := v_count + 1;
        v_matched_purchase_id := v_purchase.id;
      end if;
    end loop;
    event_outcome := case
      when v_count > 0 then 'TRANSFER_BLOCKED_' || v_count
      when v_deleting > 0 then 'TRANSFER_ACCOUNT_DELETING_' || v_deleting
      when v_candidates > 0 then 'TRANSFER_STALE'
      else 'TRANSFER_NO_BINDING'
    end;

  elsif p_product_id not in ('player_save_sponsor', 'manager_save_sponsor') then
    event_outcome := 'IGNORED_NON_SPONSOR_PRODUCT';

  elsif p_event_type = 'NON_RENEWING_PURCHASE' then
    select * into v_purchase from public.premium_sponsor_purchases
     where store = p_store and environment = p_environment and transaction_id = p_transaction_id;
    if found then
      event_outcome := 'PURCHASE_ALREADY_BOUND';
      v_matched_purchase_id := v_purchase.id;
    elsif exists (
      select 1 from public.premium_sponsor_transaction_tombstones
       where transaction_fingerprint = v_transaction_fingerprint and expires_at > v_now
    ) then
      event_outcome := 'PURCHASE_TOMBSTONED';
    else
      -- A signed webhook proves origin, not the complete current purchase
      -- contract. Only authenticated reconcile may grant after the v2 API
      -- confirms exact current/original customer, live ownership and quantity.
      event_outcome := 'PURCHASE_AWAITING_CLIENT_RECONCILE';
    end if;

  elsif p_event_type = 'CANCELLATION' then
    select * into v_purchase from public.premium_sponsor_purchases
     where product_id = p_product_id and store = p_store and environment = p_environment
       and transaction_id = p_transaction_id
     limit 1;
    if not found and p_original_transaction_id is not null then
      select * into v_purchase from public.premium_sponsor_purchases
       where product_id = p_product_id and store = p_store and environment = p_environment
         and (transaction_id = p_original_transaction_id or original_transaction_id = p_original_transaction_id)
       order by purchased_at desc limit 1;
    end if;
    if not found then
      event_outcome := case when exists (
        select 1 from public.premium_sponsor_transaction_tombstones
         where transaction_fingerprint = v_transaction_fingerprint and expires_at > v_now
      ) then 'REFUND_TOMBSTONED' else 'REFUND_NO_BINDING' end;
    elsif not public.premium_sponsor_lock_account_for_write(v_purchase.user_id) then
      event_outcome := 'REFUND_ACCOUNT_DELETING';
      v_matched_purchase_id := v_purchase.id;
    else
      select * into v_purchase from public.premium_sponsor_purchases
       where id = v_purchase.id for update;
      if not found then
        event_outcome := 'REFUND_NO_BINDING';
      elsif p_event_timestamp < v_purchase.last_store_event_at or
            (p_event_timestamp = v_purchase.last_store_event_at and
              v_event_priority <= v_purchase.last_store_event_priority) then
        event_outcome := 'REFUND_STALE';
        v_matched_purchase_id := v_purchase.id;
      elsif v_purchase.status = 'TRANSFER_BLOCKED' then
        update public.premium_sponsor_purchases
           set last_store_event_at = p_event_timestamp,
               last_store_event_priority = v_event_priority, updated_at = v_now
         where id = v_purchase.id;
        event_outcome := 'REFUND_RECORDED_ON_FROZEN_BINDING';
        v_matched_purchase_id := v_purchase.id;
      else
        update public.premium_sponsor_purchases
           set status = 'REVOKED', status_reason = 'REFUND_OR_REVOCATION',
               revoked_at = v_now, last_store_event_at = p_event_timestamp,
               last_store_event_priority = v_event_priority, updated_at = v_now
         where id = v_purchase.id;
        event_outcome := 'PURCHASE_REVOKED';
        v_matched_purchase_id := v_purchase.id;
      end if;
    end if;

  elsif p_event_type = 'REFUND_REVERSED' then
    select * into v_purchase from public.premium_sponsor_purchases
     where product_id = p_product_id and store = p_store and environment = p_environment
       and transaction_id = p_transaction_id
     limit 1;
    if not found and p_original_transaction_id is not null then
      select * into v_purchase from public.premium_sponsor_purchases
       where product_id = p_product_id and store = p_store and environment = p_environment
         and (transaction_id = p_original_transaction_id or original_transaction_id = p_original_transaction_id)
       order by purchased_at desc limit 1;
    end if;
    if not found then
      event_outcome := case when exists (
        select 1 from public.premium_sponsor_transaction_tombstones
         where transaction_fingerprint = v_transaction_fingerprint and expires_at > v_now
      ) then 'REVERSAL_TOMBSTONED' else 'REVERSAL_NO_BINDING' end;
    elsif not public.premium_sponsor_lock_account_for_write(v_purchase.user_id) then
      event_outcome := 'REVERSAL_ACCOUNT_DELETING';
      v_matched_purchase_id := v_purchase.id;
    else
      select * into v_purchase from public.premium_sponsor_purchases
       where id = v_purchase.id for update;
      if not found then
        event_outcome := 'REVERSAL_NO_BINDING';
      elsif v_purchase.status = 'TRANSFER_BLOCKED' then
        event_outcome := 'REVERSAL_BLOCKED_TRANSFER';
        v_matched_purchase_id := v_purchase.id;
      elsif p_event_timestamp < v_purchase.last_store_event_at or
            (p_event_timestamp = v_purchase.last_store_event_at and
              v_event_priority <= v_purchase.last_store_event_priority) then
        event_outcome := 'REVERSAL_STALE';
        v_matched_purchase_id := v_purchase.id;
      elsif v_purchase.status = 'ACTIVE' then
        update public.premium_sponsor_purchases
           set last_store_event_at = p_event_timestamp,
               last_store_event_priority = v_event_priority, updated_at = v_now
         where id = v_purchase.id;
        event_outcome := 'REVERSAL_ALREADY_ACTIVE';
        v_matched_purchase_id := v_purchase.id;
      elsif v_purchase.status <> 'REVOKED' or v_purchase.status_reason is null or
            v_purchase.status_reason not in (
              'REFUND_OR_REVOCATION', 'LIVE_VERIFICATION_NOT_OWNED'
            ) then
        update public.premium_sponsor_purchases
           set last_store_event_at = p_event_timestamp,
               last_store_event_priority = v_event_priority, updated_at = v_now
         where id = v_purchase.id;
        event_outcome := 'REVERSAL_NOT_REFUND_REVOKED';
        v_matched_purchase_id := v_purchase.id;
      else
        select id into v_other_purchase_id from public.premium_sponsor_purchases
         where user_id = v_purchase.user_id and save_id = v_purchase.save_id
           and product_id = v_purchase.product_id and id <> v_purchase.id
           and status in ('ACTIVE', 'TRANSFER_BLOCKED')
         limit 1;
        if v_other_purchase_id is not null then
          update public.premium_sponsor_purchases
             set status = 'REVERSAL_REVIEW', status_reason = 'REFUND_REVERSED_AFTER_REPURCHASE',
                 last_store_event_at = p_event_timestamp,
                 last_store_event_priority = v_event_priority, updated_at = v_now
           where id = v_purchase.id;
          event_outcome := 'REVERSAL_REQUIRES_REVIEW';
        else
          update public.premium_sponsor_purchases
             set status = 'ACTIVE', status_reason = null, revoked_at = null,
                 last_verified_at = v_now,
                 offline_grace_expires_at = v_now + interval '7 days',
                 last_store_event_at = p_event_timestamp,
                 last_store_event_priority = v_event_priority, updated_at = v_now
           where id = v_purchase.id;
          event_outcome := 'PURCHASE_REACTIVATED';
        end if;
        v_matched_purchase_id := v_purchase.id;
      end if;
    end if;

  else
    event_outcome := 'IGNORED_EVENT_TYPE';
  end if;

  update public.premium_sponsor_webhook_events
     set processed_at = v_now, outcome = event_outcome,
         matched_purchase_id = v_matched_purchase_id
   where event_id = p_event_id;
  matched_purchase_id := v_matched_purchase_id;
  return next;
end;
$$;

revoke all on function public.premium_sponsor_lock_account_for_write(uuid)
  from public, anon, authenticated;
revoke all on function public.assert_premium_sponsor_account_mutable(uuid)
  from public, anon, authenticated;
revoke all on function public.enforce_account_deletion_write_block()
  from public, anon, authenticated;
revoke all on function public.premium_sponsor_transaction_fingerprint(
  text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.premium_sponsor_pepper_verifier(text)
  from public, anon, authenticated;
revoke all on function public.assert_premium_sponsor_transaction_pepper(text)
  from public, anon, authenticated;
revoke all on function public.tombstone_premium_sponsor_transactions(uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.delete_premium_sponsor_exact_save(uuid, text, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.prune_expired_premium_sponsor_transaction_tombstones()
  from public, anon, authenticated;
revoke all on function public.prune_expired_premium_sponsor_webhook_events()
  from public, anon, authenticated;
revoke all on function public.create_premium_sponsor_checkout_intent(
  uuid, text, text, text, smallint, text, text, jsonb, text
) from public, anon, authenticated;
revoke all on function public.confirm_premium_sponsor_purchase(
  uuid, uuid, text, text, text, text, text, text, timestamptz, text
) from public, anon, authenticated;
revoke all on function public.refresh_premium_sponsor_verification(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.update_premium_sponsor_save_backup(uuid, uuid, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.mark_premium_sponsor_verification_failure(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.process_premium_sponsor_webhook(
  text, text, text, text, text, timestamptz, text, integer,
  text, text, text, text, timestamptz, text[]
) from public, anon, authenticated;

grant execute on function public.premium_sponsor_lock_account_for_write(uuid)
  to service_role;
grant execute on function public.assert_premium_sponsor_account_mutable(uuid)
  to service_role;
grant execute on function public.enforce_account_deletion_write_block()
  to service_role;
grant execute on function public.premium_sponsor_transaction_fingerprint(
  text, text, text, text, text
) to service_role;
grant execute on function public.premium_sponsor_pepper_verifier(text)
  to service_role;
grant execute on function public.assert_premium_sponsor_transaction_pepper(text)
  to service_role;
grant execute on function public.tombstone_premium_sponsor_transactions(uuid, text, integer)
  to service_role;
grant execute on function public.delete_premium_sponsor_exact_save(uuid, text, text, text, integer)
  to service_role;
grant execute on function public.prune_expired_premium_sponsor_transaction_tombstones()
  to service_role;
grant execute on function public.prune_expired_premium_sponsor_webhook_events()
  to service_role;
grant execute on function public.create_premium_sponsor_checkout_intent(
  uuid, text, text, text, smallint, text, text, jsonb, text
) to service_role;
grant execute on function public.confirm_premium_sponsor_purchase(
  uuid, uuid, text, text, text, text, text, text, timestamptz, text
) to service_role;
grant execute on function public.refresh_premium_sponsor_verification(uuid, uuid)
  to service_role;
grant execute on function public.update_premium_sponsor_save_backup(uuid, uuid, jsonb, text)
  to service_role;
grant execute on function public.mark_premium_sponsor_verification_failure(uuid, uuid, text)
  to service_role;
grant execute on function public.process_premium_sponsor_webhook(
  text, text, text, text, text, timestamptz, text, integer,
  text, text, text, text, timestamptz, text[]
) to service_role;
