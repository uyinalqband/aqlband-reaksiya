-- ============================================================
-- AqlBand per-game best-time leaderboard
-- Top 30 by each player's best duration_ms result.
-- Also returns the verified current user's exact position even
-- when that user is outside the visible top list.
-- Run after 0012_add_sudoku.sql. Safe to re-run.
-- ============================================================

create index if not exists idx_game_attempts_game_best_time
  on public.game_attempts (game_id, metric, value asc, played_at asc, user_id)
  where metric = 'duration_ms';

create or replace function public.get_game_best_leaderboard(
  p_game_id text,
  p_limit integer default 30,
  p_user_id uuid default null
)
returns table (
  user_id uuid,
  display_name text,
  username text,
  best_ms integer,
  rank bigint,
  is_current boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with best_per_user as (
    select distinct on (ga.user_id)
      ga.user_id,
      ga.value::integer as best_ms,
      ga.played_at,
      ga.id
    from public.game_attempts ga
    where ga.game_id = p_game_id
      and ga.metric = 'duration_ms'
      and ga.value > 0
    order by
      ga.user_id,
      ga.value asc,
      ga.played_at asc,
      ga.id asc
  ),
  ranked as (
    select
      best.user_id,
      coalesce(nullif(trim(u.display_name), ''), 'Player') as display_name,
      u.username,
      best.best_ms,
      row_number() over (
        order by
          best.best_ms asc,
          best.played_at asc,
          best.user_id asc
      ) as rank
    from best_per_user best
    join public.users u on u.id = best.user_id
  )
  select
    ranked.user_id,
    ranked.display_name,
    ranked.username,
    ranked.best_ms,
    ranked.rank,
    ranked.user_id = p_user_id as is_current
  from ranked
  where ranked.rank <= greatest(1, least(coalesce(p_limit, 30), 100))
     or ranked.user_id = p_user_id
  order by ranked.rank asc;
$$;

revoke all on function public.get_game_best_leaderboard(text, integer, uuid)
  from public, anon, authenticated;

grant execute on function public.get_game_best_leaderboard(text, integer, uuid)
  to service_role;
