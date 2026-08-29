-- Authenticated account deletion foundation.
--
-- Durable request rows contain only a keyed, one-way account reference. They
-- intentionally contain no user UUID, email, receipt, save payload or raw
-- error. The Edge Function owns the HMAC key and calls these service-role-only
-- functions. Retention is configured at deployment after owner approval.

create table if not exists public.account_deletion_requests (
  request_key text primary key check (request_key ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('processing', 'succeeded', 'failed')),
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null,
  attempt_count integer not null default 1 check (attempt_count > 0),
  last_error_code text check (
    last_error_code is null or
    (char_length(last_error_code) between 1 and 80 and last_error_code ~ '^[a-z0-9_]+$')
  )
);

comment on table public.account_deletion_requests is
  'Pseudonymous, expiring account-deletion status and retry records; no raw user identifier.';

alter table public.account_deletion_requests enable row level security;
revoke all on table public.account_deletion_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.account_deletion_requests to service_role;

-- Deleting auth.users removes refresh tokens and auth.sessions, but an already
-- issued access JWT remains cryptographically valid until its short expiry.
-- Sensitive write paths can call this helper (or include the same session_id
-- check) so a deleted account cannot recreate data during that window.
create or replace function public.has_live_auth_session()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id_text text := auth.jwt() ->> 'session_id';
  v_session_id uuid;
begin
  if v_user_id is null or v_session_id_text is null or
     v_session_id_text !~ '^[0-9a-fA-F-]{36}$' then
    return false;
  end if;
  v_session_id := v_session_id_text::uuid;
  return exists (
    select 1
    from auth.sessions s
    where s.id = v_session_id and s.user_id = v_user_id
  );
exception when invalid_text_representation then
  return false;
end;
$$;

revoke all on function public.has_live_auth_session() from public, anon;
grant execute on function public.has_live_auth_session() to authenticated, service_role;

create or replace function public.enforce_live_leaderboard_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- SQL maintenance/service jobs have no end-user auth.uid and are unaffected.
  if auth.uid() is not null and not public.has_live_auth_session() then
    raise exception 'A live authentication session is required' using errcode = '28000';
  end if;
  return new;
end;
$$;

drop trigger if exists leaderboard_live_session_guard on public.leaderboard;
create trigger leaderboard_live_session_guard
  before insert or update on public.leaderboard
  for each row execute function public.enforce_live_leaderboard_session();

drop trigger if exists shadow_leaderboard_live_session_guard on public.shadow_leaderboard;
create trigger shadow_leaderboard_live_session_guard
  before insert or update on public.shadow_leaderboard
  for each row execute function public.enforce_live_leaderboard_session();

revoke all on function public.enforce_live_leaderboard_session() from public, anon, authenticated;
grant execute on function public.enforce_live_leaderboard_session() to service_role;

create or replace function public.begin_account_deletion(
  p_request_key text,
  p_expires_at timestamptz
)
returns table(status text, attempt_count integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_request_key is null or p_request_key !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid deletion request key';
  end if;
  if p_expires_at is null or p_expires_at <= statement_timestamp() then
    raise exception 'Deletion request expiry must be in the future';
  end if;

  insert into public.account_deletion_requests (
    request_key,
    status,
    expires_at
  ) values (
    p_request_key,
    'processing',
    p_expires_at
  )
  on conflict (request_key) do update
    set status = case
          when public.account_deletion_requests.status = 'succeeded' then 'succeeded'
          else 'processing'
        end,
        updated_at = statement_timestamp(),
        expires_at = greatest(public.account_deletion_requests.expires_at, excluded.expires_at),
        attempt_count = public.account_deletion_requests.attempt_count + 1,
        last_error_code = case
          when public.account_deletion_requests.status = 'succeeded'
            then public.account_deletion_requests.last_error_code
          else null
        end;

  return query
    select r.status, r.attempt_count
    from public.account_deletion_requests r
    where r.request_key = p_request_key;
end;
$$;

create or replace function public.finish_account_deletion(
  p_request_key text,
  p_status text,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('succeeded', 'failed') then
    raise exception 'Invalid deletion completion status';
  end if;
  if p_error_code is not null and p_error_code !~ '^[a-z0-9_]{1,80}$' then
    raise exception 'Invalid deletion error code';
  end if;

  update public.account_deletion_requests
  set status = case
        when status = 'succeeded' then 'succeeded'
        else p_status
      end,
      completed_at = case
        when status = 'succeeded' or p_status = 'succeeded' then statement_timestamp()
        else null
      end,
      updated_at = statement_timestamp(),
      last_error_code = case
        when status = 'succeeded' or p_status = 'succeeded' then null
        else p_error_code
      end
  where request_key = p_request_key;
end;
$$;

create or replace function public.purge_user_data_for_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cloud_saves integer := 0;
  v_daily_verifications integer := 0;
  v_reward_transactions integer := 0;
  v_leaderboard integer := 0;
  v_shadow_leaderboard integer := 0;
  v_sponsor_intents integer := 0;
  v_sponsor_backups integer := 0;
  v_sponsor_purchases integer := 0;
begin
  if p_user_id is null then
    raise exception 'User ID is required';
  end if;

  delete from public.cloud_saves where user_id = p_user_id;
  get diagnostics v_cloud_saves = row_count;

  delete from public.daily_verifications where user_id = p_user_id;
  get diagnostics v_daily_verifications = row_count;

  delete from public.reward_transactions where user_id = p_user_id;
  get diagnostics v_reward_transactions = row_count;

  -- These first-generation leaderboard tables use text user IDs and do not
  -- have an auth.users foreign key, so they must be removed explicitly.
  delete from public.leaderboard where user_id = p_user_id::text;
  get diagnostics v_leaderboard = row_count;

  delete from public.shadow_leaderboard where user_id = p_user_id::text;
  get diagnostics v_shadow_leaderboard = row_count;

  -- The premium-sponsor migration runs after this migration. Dynamic SQL lets
  -- this function remain deployable before those tables exist while ensuring
  -- retries purge them before the Auth user is removed. Their foreign keys also
  -- use ON DELETE CASCADE as a final integrity backstop.
  -- Delete in child-to-parent order for deterministic counts and to remain
  -- compatible with stricter foreign-key rules in future schema revisions.
  if to_regclass('public.premium_sponsor_save_backups') is not null then
    execute 'delete from public.premium_sponsor_save_backups where user_id = $1'
      using p_user_id;
    get diagnostics v_sponsor_backups = row_count;
  end if;

  if to_regclass('public.premium_sponsor_purchases') is not null then
    execute 'delete from public.premium_sponsor_purchases where user_id = $1'
      using p_user_id;
    get diagnostics v_sponsor_purchases = row_count;
  end if;

  if to_regclass('public.premium_sponsor_checkout_intents') is not null then
    execute 'delete from public.premium_sponsor_checkout_intents where user_id = $1'
      using p_user_id;
    get diagnostics v_sponsor_intents = row_count;
  end if;

  return jsonb_build_object(
    'cloud_saves', v_cloud_saves,
    'daily_verifications', v_daily_verifications,
    'reward_transactions', v_reward_transactions,
    'leaderboard', v_leaderboard,
    'shadow_leaderboard', v_shadow_leaderboard,
    'premium_sponsor_checkout_intents', v_sponsor_intents,
    'premium_sponsor_save_backups', v_sponsor_backups,
    'premium_sponsor_purchases', v_sponsor_purchases
  );
end;
$$;

create or replace function public.prune_expired_account_deletion_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer := 0;
begin
  delete from public.account_deletion_requests
  where expires_at <= statement_timestamp();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.begin_account_deletion(text, timestamptz) from public, anon, authenticated;
revoke all on function public.finish_account_deletion(text, text, text) from public, anon, authenticated;
revoke all on function public.purge_user_data_for_account_deletion(uuid) from public, anon, authenticated;
revoke all on function public.prune_expired_account_deletion_requests() from public, anon, authenticated;

grant execute on function public.begin_account_deletion(text, timestamptz) to service_role;
grant execute on function public.finish_account_deletion(text, text, text) to service_role;
grant execute on function public.purge_user_data_for_account_deletion(uuid) to service_role;
grant execute on function public.prune_expired_account_deletion_requests() to service_role;
