-- ============================================================
-- AqlBand V2.1.3 — XP-only mini-games
-- Run after 0019_checkers_direct_start_fix.sql. Safe to re-run.
--
-- Database policy after this migration:
--   * game_attempts stores ONLY official Checkers match history.
--   * mini-games and Tic Tac Toe store only a deduplicated XP event.
--   * milliseconds, scores, mistakes and mini-game metadata are never kept
--     in Supabase.
-- ============================================================

begin;

-- Remove old mini-game/Tic Tac Toe result rows while retaining Checkers
-- history. This also removes old millisecond values from game_attempts.
delete from public.game_attempts
where game_id <> 'checkers';

-- Enforce the policy at database level, not only in frontend/API code.
alter table public.game_attempts
  drop constraint if exists game_attempts_game_check;

alter table public.game_attempts
  add constraint game_attempts_game_check check (
    game_id = 'checkers'
  );

-- Preserve already-earned XP but erase result-shaped values that may contain
-- old milliseconds/scores. Every non-Checkers XP event becomes a simple
-- completion marker.
update public.xp_events
set
  metric = 'correct_count',
  value = 1,
  personal_best_bonus_xp = 0
where game_id <> 'checkers';

create or replace function public.award_minigame_completion_xp(
  p_user_id uuid,
  p_completion_id text,
  p_game_id text,
  p_outcome text,
  p_played_at timestamp with time zone
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_games constant text[] := array[
    'reaction',
    'emoji-find',
    'number-memory',
    'stroop-test',
    'ascending-numbers',
    'odd-one-out',
    'pattern-memory',
    'go-no-go',
    'mental-math',
    'sequence-memory',
    'card-memory',
    'time-estimation',
    'peripheral-vision',
    'twenty-four',
    'dual-n-back',
    'fifteen-puzzle',
    'sudoku',
    'tic-tac-toe'
  ];
  safe_played_at timestamp with time zone := coalesce(p_played_at, now());
  day_start timestamp with time zone;
  day_end timestamp with time zone;
  game_count_today integer := 0;
  total_count_today integer := 0;
  today_xp integer := 0;
  raw_xp integer := 0;
  multiplier integer := 0;
  daily_bonus integer := 0;
  variety_bonus integer := 0;
  final_xp integer := 0;
begin
  if p_completion_id is null
     or btrim(p_completion_id) = ''
     or length(p_completion_id) > 100 then
    return 0;
  end if;

  if not (p_game_id = any(allowed_games)) then
    return 0;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  if exists (
    select 1
    from public.xp_events
    where user_id = p_user_id
      and client_attempt_id = p_completion_id
  ) then
    select awarded_xp
    into final_xp
    from public.xp_events
    where user_id = p_user_id
      and client_attempt_id = p_completion_id;
    return coalesce(final_xp, 0);
  end if;

  raw_xp := case p_game_id
    when 'reaction' then 10
    when 'emoji-find' then 12
    when 'number-memory' then 16
    when 'stroop-test' then 14
    when 'ascending-numbers' then 14
    when 'odd-one-out' then 14
    when 'pattern-memory' then 16
    when 'go-no-go' then 14
    when 'mental-math' then 16
    when 'sequence-memory' then 16
    when 'card-memory' then 16
    when 'time-estimation' then 12
    when 'peripheral-vision' then 14
    when 'twenty-four' then 18
    when 'dual-n-back' then 18
    when 'fifteen-puzzle' then 18
    when 'sudoku' then 20
    when 'tic-tac-toe' then case lower(coalesce(p_outcome, 'complete'))
      when 'win' then 20
      when 'draw' then 14
      when 'loss' then 8
      else 10
    end
    else 0
  end;

  day_start := date_trunc('day', safe_played_at at time zone 'UTC')
    at time zone 'UTC';
  day_end := day_start + interval '1 day';

  select
    count(*)::integer,
    coalesce(sum(awarded_xp), 0)::integer
  into total_count_today, today_xp
  from public.xp_events
  where user_id = p_user_id
    and played_at >= day_start
    and played_at < day_end;

  select count(*)::integer
  into game_count_today
  from public.xp_events
  where user_id = p_user_id
    and game_id = p_game_id
    and played_at >= day_start
    and played_at < day_end;

  multiplier := case
    when game_count_today < 5 then 100
    when game_count_today < 10 then 50
    when game_count_today < 15 then 25
    else 0
  end;

  if total_count_today = 0 then
    daily_bonus := 10;
  end if;
  if game_count_today = 0 then
    variety_bonus := 5;
  end if;

  final_xp := floor(raw_xp * multiplier / 100.0)::integer
    + daily_bonus
    + variety_bonus;

  -- One account can earn at most 500 XP per UTC day.
  final_xp := greatest(
    0,
    least(final_xp, greatest(0, 500 - today_xp))
  );

  insert into public.xp_events (
    user_id,
    client_attempt_id,
    game_id,
    metric,
    value,
    raw_xp,
    multiplier_percent,
    daily_bonus_xp,
    variety_bonus_xp,
    personal_best_bonus_xp,
    awarded_xp,
    rule_version,
    played_at
  ) values (
    p_user_id,
    p_completion_id,
    p_game_id,
    'correct_count',
    1,
    raw_xp,
    multiplier,
    daily_bonus,
    variety_bonus,
    0,
    final_xp,
    6,
    safe_played_at
  )
  on conflict (user_id, client_attempt_id) do nothing;

  if found and final_xp > 0 then
    update public.users
    set total_xp = total_xp + final_xp
    where id = p_user_id;
  end if;

  return final_xp;
end;
$$;

-- game_attempts now represents Checkers history only. Its existing trigger is
-- retained for Checkers XP, but explicitly ignores every other game.
create or replace function public.aqlband_award_xp_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.game_id <> 'checkers' then
    return new;
  end if;

  perform public.award_game_attempt_xp(
    new.user_id,
    new.client_attempt_id,
    new.game_id,
    new.metric,
    new.value,
    new.meta,
    new.played_at
  );
  return new;
end;
$$;

revoke all on function public.award_minigame_completion_xp(
  uuid,
  text,
  text,
  text,
  timestamp with time zone
) from public, anon, authenticated;

grant execute on function public.award_minigame_completion_xp(
  uuid,
  text,
  text,
  text,
  timestamp with time zone
) to service_role;

commit;
