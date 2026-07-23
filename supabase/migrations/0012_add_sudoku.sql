-- ============================================================
-- Add Sudoku to game history, XP and duel constraints.
-- Run after 0011_all_games_duel_support.sql.
-- Safe to re-run.
-- ============================================================

alter table public.game_attempts drop constraint if exists game_attempts_game_check;
alter table public.game_attempts add constraint game_attempts_game_check check (
  game_id in ('reaction', 'emoji-find', 'number-memory', 'stroop-test', 'ascending-numbers', 'odd-one-out', 'pattern-memory', 'go-no-go', 'mental-math', 'sequence-memory', 'card-memory', 'time-estimation', 'peripheral-vision', 'twenty-four', 'dual-n-back', 'fifteen-puzzle', 'sudoku', 'duel-reaction')
);

alter table public.xp_events drop constraint if exists xp_events_game_check;
alter table public.xp_events add constraint xp_events_game_check check (
  game_id in ('reaction', 'emoji-find', 'number-memory', 'stroop-test', 'ascending-numbers', 'odd-one-out', 'pattern-memory', 'go-no-go', 'mental-math', 'sequence-memory', 'card-memory', 'time-estimation', 'peripheral-vision', 'twenty-four', 'dual-n-back', 'fifteen-puzzle', 'sudoku', 'duel-reaction')
);

alter table public.xp_events alter column rule_version set default 4;

create or replace function public.aqlband_raw_xp(
  p_game_id text,
  p_value integer,
  p_meta jsonb default '{}'::jsonb
)
returns integer
language plpgsql
immutable
as $$
declare
  base_xp integer := 0;
  result integer := 0;
  completed_rounds integer := greatest(1, least(100, public.aqlband_json_int(p_meta, 'rounds', 1)));
  correct_count integer := greatest(0, least(100, public.aqlband_json_int(p_meta, 'correct', completed_rounds)));
  difficulty text := coalesce(nullif(p_meta ->> 'difficulty', ''), 'medium');
  difficulty_percent integer := 100;
  accuracy_percent integer := 100;
  rounds_bonus integer := 0;
  survival_bonus integer := 0;
  survival_mode boolean := coalesce((p_meta ->> 'survival')::boolean, false);
begin
  case p_game_id
    when 'reaction' then
      base_xp := case
        when p_value <= 180 then 44
        when p_value <= 220 then 38
        when p_value <= 280 then 32
        when p_value <= 360 then 26
        when p_value <= 500 then 20
        when p_value <= 800 then 14
        else 9
      end;

    when 'emoji-find' then
      base_xp := case
        when p_value <= 700 then 44
        when p_value <= 1000 then 38
        when p_value <= 1400 then 32
        when p_value <= 1900 then 26
        when p_value <= 2600 then 20
        when p_value <= 4000 then 14
        else 9
      end;

    when 'number-memory' then
      base_xp := case
        when p_value <= 650 then 44
        when p_value <= 900 then 38
        when p_value <= 1300 then 32
        when p_value <= 1800 then 26
        when p_value <= 2500 then 20
        when p_value <= 4000 then 14
        else 9
      end;

    when 'stroop-test' then
      base_xp := case
        when p_value <= 600 then 44
        when p_value <= 850 then 38
        when p_value <= 1200 then 32
        when p_value <= 1650 then 26
        when p_value <= 2300 then 20
        when p_value <= 3500 then 14
        else 9
      end;

    when 'ascending-numbers' then
      base_xp := case when p_value <= 2500 then 44 when p_value <= 4000 then 38 when p_value <= 6500 then 32 when p_value <= 9000 then 26 when p_value <= 13000 then 20 when p_value <= 20000 then 14 else 9 end;
    when 'odd-one-out' then
      base_xp := case when p_value <= 700 then 44 when p_value <= 1000 then 38 when p_value <= 1500 then 32 when p_value <= 2200 then 26 when p_value <= 3200 then 20 when p_value <= 5000 then 14 else 9 end;
    when 'pattern-memory' then
      base_xp := case when p_value <= 1800 then 44 when p_value <= 2600 then 38 when p_value <= 3800 then 32 when p_value <= 5200 then 26 when p_value <= 7500 then 20 when p_value <= 11000 then 14 else 9 end;
    when 'go-no-go' then
      base_xp := case when p_value <= 350 then 44 when p_value <= 500 then 38 when p_value <= 750 then 32 when p_value <= 1100 then 26 when p_value <= 1600 then 20 when p_value <= 2400 then 14 else 9 end;
    when 'mental-math' then
      base_xp := case when p_value <= 1800 then 44 when p_value <= 2800 then 38 when p_value <= 4200 then 32 when p_value <= 6200 then 26 when p_value <= 9000 then 20 when p_value <= 14000 then 14 else 9 end;
    when 'sequence-memory' then
      base_xp := case when p_value <= 1600 then 44 when p_value <= 2400 then 38 when p_value <= 3600 then 32 when p_value <= 5200 then 26 when p_value <= 7600 then 20 when p_value <= 11000 then 14 else 9 end;
    when 'card-memory' then
      base_xp := case when p_value <= 5000 then 44 when p_value <= 8000 then 38 when p_value <= 12000 then 32 when p_value <= 18000 then 26 when p_value <= 26000 then 20 when p_value <= 40000 then 14 else 9 end;
    when 'time-estimation' then
      base_xp := case when p_value <= 80 then 44 when p_value <= 150 then 38 when p_value <= 300 then 32 when p_value <= 550 then 26 when p_value <= 900 then 20 when p_value <= 1500 then 14 else 9 end;
    when 'peripheral-vision' then
      base_xp := case when p_value <= 450 then 44 when p_value <= 650 then 38 when p_value <= 900 then 32 when p_value <= 1300 then 26 when p_value <= 1900 then 20 when p_value <= 2800 then 14 else 9 end;
    when 'twenty-four' then
      base_xp := case when p_value <= 3500 then 44 when p_value <= 5500 then 38 when p_value <= 8000 then 32 when p_value <= 12000 then 26 when p_value <= 18000 then 20 when p_value <= 28000 then 14 else 9 end;
    when 'dual-n-back' then
      base_xp := case when p_value <= 1000 then 44 when p_value <= 1500 then 38 when p_value <= 2200 then 32 when p_value <= 3200 then 26 when p_value <= 4700 then 20 when p_value <= 7000 then 14 else 9 end;
    when 'fifteen-puzzle' then
      base_xp := case when p_value <= 15000 then 44 when p_value <= 25000 then 38 when p_value <= 40000 then 32 when p_value <= 65000 then 26 when p_value <= 100000 then 20 when p_value <= 160000 then 14 else 9 end;
    when 'sudoku' then
      base_xp := case
        when p_value <= 60000 then 44
        when p_value <= 100000 then 38
        when p_value <= 160000 then 32
        when p_value <= 240000 then 26
        when p_value <= 360000 then 20
        when p_value <= 600000 then 14
        else 9
      end;

    when 'duel-reaction' then
      base_xp := case
        when coalesce((p_meta ->> 'won')::boolean, false) then 30
        when coalesce((p_meta ->> 'draw')::boolean, false) then 25
        else 18
      end;
      base_xp := least(35, base_xp + case when p_value <= 220 then 5 when p_value <= 300 then 3 else 0 end);
      return base_xp;

    else
      return 0;
  end case;

  difficulty_percent := case difficulty
    when 'easy' then 85
    when 'medium' then 100
    when 'hard' then 115
    when 'very-hard' then 135
    when 'progressive' then 125
    else 100
  end;

  accuracy_percent := greatest(45, least(100, round(correct_count * 100.0 / completed_rounds)::integer));
  rounds_bonus := least(18, greatest(0, completed_rounds - 1) * 2);
  if survival_mode then
    survival_bonus := least(20, 5 + completed_rounds);
  end if;

  result := round(base_xp * difficulty_percent / 100.0 * accuracy_percent / 100.0)::integer
    + rounds_bonus
    + survival_bonus;

  return greatest(5, least(90, result));
exception when others then
  return 0;
end;
$$;

create or replace function public.award_game_attempt_xp(
  p_user_id uuid,
  p_client_attempt_id text,
  p_game_id text,
  p_metric text,
  p_value integer,
  p_meta jsonb,
  p_played_at timestamp with time zone
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  day_start timestamp with time zone;
  day_end timestamp with time zone;
  game_count_today integer := 0;
  total_count_today integer := 0;
  pb_count_today integer := 0;
  today_xp integer := 0;
  raw_xp integer := 0;
  multiplier integer := 0;
  daily_bonus integer := 0;
  variety_bonus integer := 0;
  pb_bonus integer := 0;
  final_xp integer := 0;
  prior_count integer := 0;
  prior_best integer := null;
  is_personal_best boolean := false;
begin
  if p_client_attempt_id is null or btrim(p_client_attempt_id) = '' then
    return 0;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  if exists (
    select 1 from public.xp_events
    where user_id = p_user_id and client_attempt_id = p_client_attempt_id
  ) then
    select awarded_xp into final_xp
    from public.xp_events
    where user_id = p_user_id and client_attempt_id = p_client_attempt_id;
    return coalesce(final_xp, 0);
  end if;

  if p_game_id in ('reaction', 'emoji-find', 'number-memory', 'stroop-test', 'ascending-numbers', 'odd-one-out', 'pattern-memory', 'go-no-go', 'mental-math', 'sequence-memory', 'card-memory', 'time-estimation', 'peripheral-vision', 'twenty-four', 'dual-n-back', 'fifteen-puzzle', 'sudoku') and p_metric <> 'duration_ms' then
    raw_xp := 0;
  else
    raw_xp := public.aqlband_raw_xp(p_game_id, p_value, coalesce(p_meta, '{}'::jsonb));
  end if;
  day_start := date_trunc('day', p_played_at at time zone 'UTC') at time zone 'UTC';
  day_end := day_start + interval '1 day';

  select count(*)::integer, coalesce(sum(awarded_xp), 0)::integer
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

  if raw_xp > 0 and total_count_today = 0 then daily_bonus := 10; end if;
  if raw_xp > 0 and game_count_today = 0 then variety_bonus := 5; end if;

  if p_game_id in ('reaction', 'emoji-find', 'number-memory', 'stroop-test', 'ascending-numbers', 'odd-one-out', 'pattern-memory', 'go-no-go', 'mental-math', 'sequence-memory', 'card-memory', 'time-estimation', 'peripheral-vision', 'twenty-four', 'dual-n-back', 'fifteen-puzzle', 'sudoku') and p_metric = 'duration_ms' then
    select count(*)::integer, min(value)
    into prior_count, prior_best
    from public.game_attempts
    where user_id = p_user_id
      and game_id = p_game_id
      and metric = 'duration_ms'
      and client_attempt_id <> p_client_attempt_id;

    is_personal_best := prior_count > 0 and p_value < prior_best;
    if is_personal_best then
      select count(*)::integer
      into pb_count_today
      from public.xp_events
      where user_id = p_user_id
        and game_id = p_game_id
        and personal_best_bonus_xp > 0
        and played_at >= day_start
        and played_at < day_end;
      if pb_count_today < 2 then pb_bonus := 8; end if;
    end if;
  end if;

  final_xp := floor(raw_xp * multiplier / 100.0)::integer
    + daily_bonus
    + variety_bonus
    + pb_bonus;

  final_xp := greatest(0, least(final_xp, greatest(0, 500 - today_xp)));

  insert into public.xp_events (
    user_id, client_attempt_id, game_id, metric, value, raw_xp,
    multiplier_percent, daily_bonus_xp, variety_bonus_xp,
    personal_best_bonus_xp, awarded_xp, rule_version, played_at
  ) values (
    p_user_id, p_client_attempt_id, p_game_id, p_metric, p_value, raw_xp,
    multiplier, daily_bonus, variety_bonus, pb_bonus, final_xp, 4, p_played_at
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

revoke all on function public.aqlband_raw_xp(text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.award_game_attempt_xp(uuid, text, text, text, integer, jsonb, timestamp with time zone) from public, anon, authenticated;


alter table public.duels
  drop constraint if exists duels_game_id_check;

alter table public.duels
  add constraint duels_game_id_check check (
    game_id in (
      'reaction', 'emoji-find', 'number-memory', 'stroop-test',
      'ascending-numbers', 'odd-one-out', 'pattern-memory', 'go-no-go',
      'mental-math', 'sequence-memory', 'card-memory', 'time-estimation',
      'peripheral-vision', 'twenty-four', 'dual-n-back', 'fifteen-puzzle',
      'sudoku'
    )
  );
