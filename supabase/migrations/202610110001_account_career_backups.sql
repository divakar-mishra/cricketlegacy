-- Account recovery snapshots, NOT a receipt ledger or a consumable re-grant.
-- Text preserves the exact checksum bytes across JSONB key normalization.
create table if not exists public.account_career_backups (
  user_id uuid not null references auth.users(id) on delete cascade,
  save_id text not null,
  mode text not null check (mode in ('career', 'manager')),
  slot integer not null check (slot between 1 and 6),
  revision bigint not null check (revision > 0),
  save_json text,
  checksum text,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, save_id),
  check ((deleted and save_json is null and checksum is null) or
         (not deleted and save_json is not null and checksum is not null))
);
alter table public.account_career_backups enable row level security;
revoke all on public.account_career_backups from public, anon, authenticated;
grant select, delete on public.account_career_backups to service_role;
drop trigger if exists account_career_backups_deletion_guard on public.account_career_backups;
create trigger account_career_backups_deletion_guard
  before insert or update on public.account_career_backups
  for each row execute function public.enforce_account_deletion_write_block();

-- Every RPC pins the caller to the captured account. A late request after an
-- auth switch cannot accidentally write A's career under B's session.
create or replace function public.assert_career_backup_account(p_owner_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_owner_id is null or auth.uid() is distinct from p_owner_id or
     not exists (select 1 from auth.users where id = p_owner_id and not coalesce(is_anonymous, true)) then
    raise exception 'A recoverable signed-in account is required' using errcode = '28000';
  end if;
  perform public.assert_premium_sponsor_account_mutable(p_owner_id);
end;
$$;
revoke all on function public.assert_career_backup_account(uuid) from public, anon, authenticated;

create or replace function public.list_account_career_backups(p_owner_id uuid)
returns table (save_id text, mode text, slot integer, revision bigint, deleted boolean,
               checksum text, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_career_backup_account(p_owner_id);
  return query select b.save_id, b.mode, b.slot, b.revision, b.deleted, b.checksum, b.updated_at
    from public.account_career_backups b where b.user_id = p_owner_id
    order by b.updated_at desc, b.save_id;
end;
$$;

create or replace function public.read_account_career_backup(p_owner_id uuid, p_save_id text, p_revision bigint)
returns text language plpgsql security definer set search_path = '' as $$
declare result text;
begin
  perform public.assert_career_backup_account(p_owner_id);
  select b.save_json into result from public.account_career_backups b
    where b.user_id = p_owner_id and b.save_id = p_save_id
      and b.revision = p_revision and not b.deleted;
  return result;
end;
$$;

create or replace function public.write_account_career_backup(
  p_owner_id uuid, p_save_id text, p_mode text, p_slot integer,
  p_expected_revision bigint, p_save_json text, p_checksum text, p_delete boolean
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous public.account_career_backups%rowtype; payload jsonb; next_revision bigint;
begin
  perform public.assert_career_backup_account(p_owner_id);
  if p_save_id is null or length(p_save_id) not between 1 and 200 or
     p_mode is null or p_mode not in ('career','manager') or
     p_slot is null or p_slot not between 1 and 6 or
     p_expected_revision is null or p_expected_revision < 0 or p_delete is null then
    raise exception 'Invalid career backup identity';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'career-backup:' || p_owner_id::text || ':' || p_save_id, 0));
  select * into previous from public.account_career_backups
    where user_id = p_owner_id and save_id = p_save_id for update;
  -- A tombstone cannot be revived by stale offline autosaves, even revision 0.
  if previous.deleted then
    return jsonb_build_object('status','DELETED','revision',previous.revision);
  end if;
  if not p_delete then
    if p_save_json is null or octet_length(p_save_json) > 33554432 or
       p_checksum is null or p_checksum !~ '^[0-9a-f]{1,8}$' then
      raise exception 'Invalid career backup payload';
    end if;
    payload := p_save_json::jsonb;
    if jsonb_typeof(payload) is distinct from 'object' or
       (payload->>'id') is distinct from p_save_id or
       (payload->>'mode') is distinct from p_mode or
       jsonb_typeof(payload->'schemaVersion') is distinct from 'number' or
       jsonb_typeof(payload->'wallet') is distinct from 'object' or
       jsonb_typeof(payload->'entitlements') is distinct from 'object' then
      raise exception 'Career payload does not match its identity';
    end if;
    -- Idempotent retry after the server committed but the response was lost.
    if previous.save_json = p_save_json and previous.checksum = p_checksum and previous.slot = p_slot then
      return jsonb_build_object('status','SAVED','revision',previous.revision);
    end if;
  end if;
  if coalesce(previous.revision, 0) <> p_expected_revision or
     (previous.mode is not null and previous.mode <> p_mode) then
    return jsonb_build_object('status','CONFLICT','revision',coalesce(previous.revision,0));
  end if;
  next_revision := coalesce(previous.revision,0) + 1;
  insert into public.account_career_backups (user_id,save_id,mode,slot,revision,save_json,checksum,deleted)
    values (p_owner_id,p_save_id,p_mode,p_slot,next_revision,
      case when p_delete then null else p_save_json end,
      case when p_delete then null else p_checksum end,p_delete)
    on conflict (user_id,save_id) do update set
      slot = excluded.slot, revision = excluded.revision, save_json = excluded.save_json,
      checksum = excluded.checksum, deleted = excluded.deleted, updated_at = now();
  return jsonb_build_object('status',case when p_delete then 'DELETED' else 'SAVED' end,'revision',next_revision);
end;
$$;
revoke all on function public.list_account_career_backups(uuid) from public, anon;
revoke all on function public.read_account_career_backup(uuid,text,bigint) from public, anon;
revoke all on function public.write_account_career_backup(uuid,text,text,integer,bigint,text,text,boolean) from public, anon;
grant execute on function public.list_account_career_backups(uuid) to authenticated;
grant execute on function public.read_account_career_backup(uuid,text,bigint) to authenticated;
grant execute on function public.write_account_career_backup(uuid,text,text,integer,bigint,text,text,boolean) to authenticated;
