-- Private, operator-managed allowlist. No client can enroll itself.
create table public.reviewer_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false
);
alter table public.reviewer_accounts enable row level security;
revoke all on public.reviewer_accounts from public, anon, authenticated;

-- Read the live allowlist, not editable user metadata or a stale JWT claim.
create or replace function public.authorize_reviewer_access()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select r.user_id from public.reviewer_accounts r
  join auth.users u on u.id = r.user_id
  where r.user_id = auth.uid() and r.enabled
    and coalesce(u.is_anonymous, false) = false
    and (u.banned_until is null or u.banned_until < now());
$$;
revoke all on function public.authorize_reviewer_access() from public, anon;
grant execute on function public.authorize_reviewer_access() to authenticated;
