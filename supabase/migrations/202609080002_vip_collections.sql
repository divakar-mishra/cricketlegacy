-- Cosmetic collection ownership only. Never used as a purchase entitlement ledger.
create table if not exists public.vip_collections (
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('career', 'manager')),
  collections text[] not null default '{}',
  primary key (user_id, mode)
);
alter table public.vip_collections enable row level security;
revoke all on public.vip_collections from anon, authenticated;

create or replace function public.merge_vip_collections(p_mode text, p_collections text[])
returns text[] language plpgsql security definer set search_path = '' as $$
declare result text[]; filtered text[];
begin
  if auth.uid() is null or p_mode not in ('career','manager') then
    raise exception 'Authentication and a valid mode are required';
  end if;
  select coalesce(array_agg(distinct item), '{}') into filtered
  from unnest(coalesce(p_collections, '{}')) item
  where item = any(array['monsoon_nights','coastal_clash','heritage_cup','neon_finals',
    'winter_tour','champions_month','rising_stars','red_soil_rivalry','night_derby',
    'festival_cricket','record_breakers','legacy_finals']);
  insert into public.vip_collections as archive (user_id, mode, collections)
  values (auth.uid(), p_mode, filtered)
  on conflict (user_id, mode) do update set collections =
    array(select distinct unnest(archive.collections || excluded.collections))
  returning collections into result;
  return result;
end;
$$;
revoke all on function public.merge_vip_collections(text,text[]) from public, anon;
grant execute on function public.merge_vip_collections(text,text[]) to authenticated;
