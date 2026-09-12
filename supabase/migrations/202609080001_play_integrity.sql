-- Short-lived challenges only; no raw tokens, device IDs or verdict histories.
create table public.play_integrity_challenges (
  user_id uuid primary key references auth.users(id) on delete cascade,
  request_hash text not null,
  issued_at timestamptz not null default now(),
  consumed boolean not null default false
);
alter table public.play_integrity_challenges enable row level security;
revoke all on public.play_integrity_challenges from public, anon, authenticated;
grant select, insert, update, delete on public.play_integrity_challenges to service_role;
create index play_integrity_challenge_expiry on public.play_integrity_challenges(issued_at);
create trigger play_integrity_account_deletion_guard
  before insert or update on public.play_integrity_challenges
  for each row execute function public.enforce_account_deletion_write_block();

create function public.issue_play_integrity_challenge(p_user_id uuid, p_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  delete from public.play_integrity_challenges where issued_at < now() - interval '1 day';
  insert into public.play_integrity_challenges(user_id, request_hash)
  values(p_user_id, p_hash)
  on conflict (user_id) do update set request_hash = excluded.request_hash,
    issued_at = now(), consumed = false
  where public.play_integrity_challenges.issued_at < now() - interval '15 seconds';
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;
revoke all on function public.issue_play_integrity_challenge(uuid, text) from public, anon, authenticated;
grant execute on function public.issue_play_integrity_challenge(uuid, text) to service_role;
