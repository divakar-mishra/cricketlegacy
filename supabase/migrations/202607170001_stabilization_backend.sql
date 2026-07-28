create extension if not exists pgcrypto;

create table if not exists public.daily_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  verified_at timestamptz not null,
  expires_at timestamptz not null,
  client_seen_at timestamptz,
  app_version text,
  build_commit text,
  updated_at timestamptz not null default now()
);

alter table public.daily_verifications enable row level security;

drop policy if exists "daily_verifications_select_own" on public.daily_verifications;
create policy "daily_verifications_select_own"
  on public.daily_verifications
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "daily_verifications_insert_own" on public.daily_verifications;
create policy "daily_verifications_insert_own"
  on public.daily_verifications
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "daily_verifications_update_own" on public.daily_verifications;
create policy "daily_verifications_update_own"
  on public.daily_verifications
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.cloud_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  save_key text not null,
  slot integer not null,
  mode text not null check (mode in ('career', 'manager', 'unknown')),
  save_json jsonb not null,
  checksum text not null,
  schema_version integer,
  local_updated_at timestamptz,
  remote_updated_at timestamptz not null default now(),
  primary key (user_id, save_key)
);

alter table public.cloud_saves enable row level security;

drop policy if exists "cloud_saves_select_own" on public.cloud_saves;
create policy "cloud_saves_select_own"
  on public.cloud_saves
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "cloud_saves_insert_own" on public.cloud_saves;
create policy "cloud_saves_insert_own"
  on public.cloud_saves
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "cloud_saves_update_own" on public.cloud_saves;
create policy "cloud_saves_update_own"
  on public.cloud_saves
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.reward_transactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id text not null,
  reward_source text not null,
  currency text not null check (currency in ('coins', 'gems', 'energy', 'xp', 'training_points')),
  amount integer not null check (amount > 0),
  payload jsonb not null default '{}'::jsonb,
  granted_at timestamptz not null default now(),
  primary key (user_id, transaction_id)
);

alter table public.reward_transactions enable row level security;

drop policy if exists "reward_transactions_select_own" on public.reward_transactions;
create policy "reward_transactions_select_own"
  on public.reward_transactions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "reward_transactions_insert_own" on public.reward_transactions;
create policy "reward_transactions_insert_own"
  on public.reward_transactions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create table if not exists public.leaderboard (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  user_id text not null,
  score_type text not null,
  score integer not null check (score >= 0),
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, score_type)
);

alter table public.leaderboard enable row level security;

drop policy if exists "leaderboard_read_all" on public.leaderboard;
create policy "leaderboard_read_all"
  on public.leaderboard
  for select
  to anon, authenticated
  using (true);

drop policy if exists "leaderboard_insert_own" on public.leaderboard;
create policy "leaderboard_insert_own"
  on public.leaderboard
  for insert
  to authenticated
  with check (auth.uid()::text = user_id);

drop policy if exists "leaderboard_update_own" on public.leaderboard;
create policy "leaderboard_update_own"
  on public.leaderboard
  for update
  to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

create table if not exists public.shadow_leaderboard (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  user_id text not null,
  score_type text not null,
  score integer not null,
  country text,
  reasons text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.shadow_leaderboard enable row level security;

drop policy if exists "shadow_leaderboard_insert_own" on public.shadow_leaderboard;
create policy "shadow_leaderboard_insert_own"
  on public.shadow_leaderboard
  for insert
  to authenticated
  with check (auth.uid()::text = user_id);

create or replace function public.record_daily_verification(
  p_client_seen_at timestamptz default null,
  p_app_version text default null,
  p_build_commit text default null
)
returns table(user_id uuid, server_time timestamptz, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_server_time timestamptz := statement_timestamp();
  v_expires_at timestamptz := statement_timestamp() + interval '24 hours';
begin
  if v_user_id is null then
    raise exception 'Authentication required for daily verification' using errcode = '28000';
  end if;

  insert into public.daily_verifications (
    user_id,
    verified_at,
    expires_at,
    client_seen_at,
    app_version,
    build_commit,
    updated_at
  )
  values (
    v_user_id,
    v_server_time,
    v_expires_at,
    p_client_seen_at,
    p_app_version,
    p_build_commit,
    v_server_time
  )
  on conflict on constraint daily_verifications_pkey do update
    set verified_at = excluded.verified_at,
        expires_at = excluded.expires_at,
        client_seen_at = excluded.client_seen_at,
        app_version = excluded.app_version,
        build_commit = excluded.build_commit,
        updated_at = excluded.updated_at;

  return query select v_user_id, v_server_time, v_expires_at;
end;
$$;

create or replace function public.claim_reward_once(
  p_transaction_id text,
  p_reward_source text,
  p_currency text,
  p_amount integer,
  p_payload jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_inserted integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required for reward claim' using errcode = '28000';
  end if;

  insert into public.reward_transactions (
    user_id,
    transaction_id,
    reward_source,
    currency,
    amount,
    payload
  )
  values (
    v_user_id,
    p_transaction_id,
    p_reward_source,
    p_currency,
    p_amount,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (user_id, transaction_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end;
$$;

revoke all on function public.record_daily_verification(timestamptz, text, text) from public;
grant execute on function public.record_daily_verification(timestamptz, text, text) to authenticated;

revoke all on function public.claim_reward_once(text, text, text, integer, jsonb) from public;
grant execute on function public.claim_reward_once(text, text, text, integer, jsonb) to authenticated;

grant select, insert, update on public.daily_verifications to authenticated;
grant select, insert, update on public.cloud_saves to authenticated;
grant select, insert on public.reward_transactions to authenticated;
grant select on public.leaderboard to anon, authenticated;
grant insert, update on public.leaderboard to authenticated;
grant insert on public.shadow_leaderboard to authenticated;
