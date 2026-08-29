-- Online trust boundary: clients may read rankings and write their own cloud
-- saves, but may not mutate leaderboards/reward ledgers directly.

revoke insert, update on public.daily_verifications from authenticated;
revoke insert on public.reward_transactions from authenticated;
revoke insert, update on public.leaderboard from authenticated;
revoke insert on public.shadow_leaderboard from authenticated;

drop policy if exists "daily_verifications_insert_own" on public.daily_verifications;
drop policy if exists "daily_verifications_update_own" on public.daily_verifications;
drop policy if exists "reward_transactions_insert_own" on public.reward_transactions;
drop policy if exists "leaderboard_insert_own" on public.leaderboard;
drop policy if exists "leaderboard_update_own" on public.leaderboard;
drop policy if exists "shadow_leaderboard_insert_own" on public.shadow_leaderboard;

-- The old generic reward function accepted an arbitrary client-provided amount.
-- It is intentionally disabled until each reward source has a server-owned
-- catalog/rule implementation.
revoke all on function public.claim_reward_once(text, text, text, integer, jsonb) from authenticated;

create or replace function public.submit_leaderboard_score(
  p_player_name text,
  p_score_type text,
  p_score integer,
  p_country text default null,
  p_seasons integer default 0,
  p_matches integer default 0,
  p_wins integer default 0,
  p_wallet_coins bigint default 0,
  p_wallet_gems bigint default 0
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reasons text[] := '{}';
  v_global_limit integer;
  v_per_match_limit integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required for leaderboard submission' using errcode = '28000';
  end if;

  if p_score_type is null or p_score_type not in (
    'career_runs', 'career_wickets', 'career_centuries', 'career_fifties',
    'manager_titles', 'gamerscore', 'hof_legacy'
  ) then
    raise exception 'Unsupported score type';
  end if;

  if p_player_name is null or char_length(btrim(p_player_name)) not between 1 and 40 then
    raise exception 'Player name must contain 1 to 40 characters';
  end if;

  if p_country is not null and char_length(p_country) > 40 then
    raise exception 'Country value is too long';
  end if;

  if p_score is null or p_score < 0 then
    v_reasons := array_append(v_reasons, 'invalid_score');
  end if;
  if p_seasons is null or p_matches is null or p_wins is null
     or p_seasons < 0 or p_matches < 0 or p_wins < 0 or p_wins > p_matches then
    v_reasons := array_append(v_reasons, 'invalid_career_totals');
  end if;
  if p_wallet_coins is null or p_wallet_gems is null
     or p_wallet_coins < 0 or p_wallet_gems < 0 then
    v_reasons := array_append(v_reasons, 'negative_wallet_balance_impossible');
  end if;
  if p_wallet_coins > 1000000000 or p_wallet_gems > 250000 then
    v_reasons := array_append(v_reasons, 'wallet_above_global_limit');
  end if;

  v_global_limit := case p_score_type
    when 'career_runs' then 40000
    when 'career_wickets' then 2000
    when 'career_centuries' then 150
    when 'career_fifties' then 350
    when 'manager_titles' then 80
    when 'gamerscore' then 100000
    when 'hof_legacy' then 1000000
  end;
  if p_score > v_global_limit then
    v_reasons := array_append(v_reasons, 'score_above_global_limit');
  end if;

  v_per_match_limit := case p_score_type
    when 'career_runs' then 260
    when 'career_wickets' then 10
    when 'career_centuries' then 1
    when 'career_fifties' then 1
    else null
  end;
  if v_per_match_limit is not null and p_matches > 0 and p_score::bigint > p_matches::bigint * v_per_match_limit then
    v_reasons := array_append(v_reasons, 'score_above_match_limit');
  end if;
  if p_score_type = 'manager_titles' and p_seasons > 0 and p_score > p_seasons then
    v_reasons := array_append(v_reasons, 'manager_titles_above_seasons_impossible');
  end if;
  if p_seasons <= 1 and p_score_type = 'career_runs' and p_score > 2500 then
    v_reasons := array_append(v_reasons, 'season_one_runs_impossible');
  end if;
  if p_seasons <= 1 and p_score_type = 'career_wickets' and p_score > 120 then
    v_reasons := array_append(v_reasons, 'season_one_wickets_impossible');
  end if;
  if p_matches >= 25 and p_wins::numeric / greatest(p_matches, 1) >= 0.98 then
    v_reasons := array_append(v_reasons, 'suspicious_near_perfect_win_rate');
  end if;

  if cardinality(v_reasons) > 0 then
    insert into public.shadow_leaderboard (
      user_id, player_name, score_type, score, country, reasons
    ) values (
      v_user_id::text, btrim(p_player_name), p_score_type, coalesce(greatest(p_score, 0), 0), p_country, v_reasons
    );
    return 'review';
  end if;

  insert into public.leaderboard (
    user_id, player_name, score_type, score, country, updated_at
  ) values (
    v_user_id::text, btrim(p_player_name), p_score_type, p_score, p_country, now()
  )
  on conflict (user_id, score_type) do update
    set player_name = excluded.player_name,
        score = greatest(public.leaderboard.score, excluded.score),
        country = excluded.country,
        updated_at = now();

  return 'accepted';
end;
$$;

revoke all on function public.submit_leaderboard_score(text, text, integer, text, integer, integer, integer, bigint, bigint) from public;
grant execute on function public.submit_leaderboard_score(text, text, integer, text, integer, integer, integer, bigint, bigint) to authenticated;
