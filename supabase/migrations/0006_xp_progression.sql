-- ============================================================
-- AqlBand XP / level progression
-- - XP is calculated only inside PostgreSQL
-- - one attempt can award XP only once
-- - daily diminishing rewards and a hard daily cap prevent farming
-- - Telegram and Google accounts remain isolated by public.users.id
-- - deleting an account cascades through all XP events
-- Safe to re-run.
-- ============================================================

alter table public.users
  add column if not exists total_xp bigint not null default 0;

alter table public.users
  drop constraint if exists users_total_xp_nonnegative;
alter table public.users
  add constraint users_total_xp_nonnegative check (total_xp >= 0);

create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  client_attempt_id text not null,
  game_id text not null,
  metric text not null,
  value integer not null,
  raw_xp integer not null,
  multiplier_percent integer not null,
  daily_bonus_xp integer not null default 0,
  variety_bonus_xp integer not null default 0,
  personal_best_bonus_xp integer not null default 0,
  awarded_xp integer not null,
  rule_version integer not null default 1,
  played_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  constraint xp_events_attempt_unique unique (user_id, client_attempt_id),
  constraint xp_events_game_check check (
    game_id in ('reaction', 'emoji-find', 'number-memory', 'stroop-test', 'duel-reaction')
  ),
  constraint xp_events_values_check check (
    raw_xp >= 0
    and multiplier_percent between 0 and 100
    and daily_bonus_xp >= 0
    and variety_bonus_xp >= 0
    and personal_best_bonus_xp >= 0
    and awarded_xp >= 0
  )
);

create index if not exists idx_xp_events_user_played
  on public.xp_events(user_id, played_at desc);
create index if not exists idx_xp_events_user_game_played
  on public.xp_events(user_id, game_id, played_at desc);
create index if not exists idx_users_total_xp_rank
  on public.users(total_xp desc, created_at asc, id asc);

create or replace function public.aqlband_json_int(
  p_meta jsonb,
  p_key text,
  p_default integer default 0
)
returns integer
language plpgsql
immutable
as $$
declare
  result integer;
begin
  if p_meta is null or not (p_meta ? p_key) then
    return p_default;
  end if;
  begin
    result := (p_meta ->> p_key)::integer;
    return result;
  exception when others then
    return p_default;
  end;
end;
$$;

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
  result integer := 0;
  errors_count integer := 0;
  correct_count integer := 0;
  timeouts_count integer := 0;
  average_ms integer := 0;
  speed_bonus integer := 0;
  won boolean := false;
  draw_result boolean := false;
begin
  case p_game_id
    when 'reaction' then
      result := case
        when p_value <= 180 then 40
        when p_value <= 220 then 35
        when p_value <= 260 then 30
        when p_value <= 320 then 25
        when p_value <= 400 then 20
        when p_value <= 600 then 15
        else 10
      end;

    when 'emoji-find' then
      errors_count := greatest(0, least(100, public.aqlband_json_int(p_meta, 'errors', 0)));
      result := case
        when p_value <= 900 then 40
        when p_value <= 1200 then 35
        when p_value <= 1600 then 30
        when p_value <= 2200 then 25
        when p_value <= 3000 then 20
        when p_value <= 4500 then 15
        else 10
      end;
      result := greatest(5, result - least(12, errors_count * 2));

    when 'number-memory' then
      result := 5 + greatest(0, least(5, p_value)) * 7;

    when 'stroop-test' then
      correct_count := greatest(0, least(8, public.aqlband_json_int(p_meta, 'correct', 0)));
      errors_count := greatest(0, least(8, public.aqlband_json_int(p_meta, 'errors', 0)));
      timeouts_count := greatest(0, least(8, public.aqlband_json_int(p_meta, 'timeouts', 0)));
      average_ms := greatest(0, public.aqlband_json_int(p_meta, 'averageMs', 0));
      speed_bonus := case
        when correct_count = 0 then 0
        when average_ms <= 700 then 8
        when average_ms <= 1000 then 6
        when average_ms <= 1400 then 4
        when average_ms <= 1800 then 2
        else 0
      end;
      result := greatest(
        5,
        least(48, 8 + correct_count * 4 + speed_bonus - errors_count * 2 - timeouts_count * 3)
      );

    when 'duel-reaction' then
      won := coalesce((p_meta ->> 'won')::boolean, false);
      draw_result := coalesce((p_meta ->> 'draw')::boolean, false);
      result := case when won then 30 when draw_result then 25 else 18 end;
      result := result + case when p_value <= 220 then 5 when p_value <= 300 then 3 else 0 end;
      result := least(35, result);

    else
      result := 0;
  end case;

  return greatest(0, result);
exception when others then
  return 0;
end;
$$;

create or replace function public.aqlband_xp_for_level(p_level integer)
returns bigint
language sql
immutable
as $$
  select case
    when p_level <= 1 then 0::bigint
    else (50::bigint * (p_level - 1)::bigint * p_level::bigint)
  end;
$$;

create or replace function public.aqlband_level_from_xp(p_total_xp bigint)
returns integer
language sql
immutable
as $$
  select greatest(
    1,
    floor((sqrt(1::numeric + greatest(p_total_xp, 0)::numeric * 0.08) - 1) / 2)::integer + 1
  );
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

  raw_xp := public.aqlband_raw_xp(p_game_id, p_value, coalesce(p_meta, '{}'::jsonb));
  day_start := date_trunc('day', p_played_at at time zone 'UTC') at time zone 'UTC';
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

  if p_game_id in ('reaction', 'emoji-find', 'number-memory', 'stroop-test') then
    if p_game_id in ('reaction', 'emoji-find') then
      select count(*)::integer, min(value)
      into prior_count, prior_best
      from public.xp_events
      where user_id = p_user_id and game_id = p_game_id;
      is_personal_best := prior_count > 0 and p_value < prior_best;
    else
      select count(*)::integer, max(value)
      into prior_count, prior_best
      from public.xp_events
      where user_id = p_user_id and game_id = p_game_id;
      is_personal_best := prior_count > 0 and p_value > prior_best;
    end if;

    if is_personal_best then
      select count(*)::integer
      into pb_count_today
      from public.xp_events
      where user_id = p_user_id
        and game_id = p_game_id
        and personal_best_bonus_xp > 0
        and played_at >= day_start
        and played_at < day_end;
      if pb_count_today < 2 then
        pb_bonus := 8;
      end if;
    end if;
  end if;

  final_xp := floor(raw_xp * multiplier / 100.0)::integer
    + daily_bonus
    + variety_bonus
    + pb_bonus;

  -- One account can earn at most 500 XP per UTC day.
  final_xp := greatest(0, least(final_xp, greatest(0, 500 - today_xp)));

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
    p_client_attempt_id,
    p_game_id,
    p_metric,
    p_value,
    raw_xp,
    multiplier,
    daily_bonus,
    variety_bonus,
    pb_bonus,
    final_xp,
    1,
    p_played_at
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

create or replace function public.aqlband_award_xp_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

drop trigger if exists game_attempts_award_xp on public.game_attempts;
create trigger game_attempts_award_xp
after insert on public.game_attempts
for each row execute function public.aqlband_award_xp_trigger();

-- Give existing valid history its fair XP once. Unique constraints make this re-runnable.
do $$
declare
  attempt_row record;
begin
  for attempt_row in
    select
      ga.user_id,
      ga.client_attempt_id,
      ga.game_id,
      ga.metric,
      ga.value,
      ga.meta,
      ga.played_at
    from public.game_attempts ga
    order by ga.user_id, ga.played_at, ga.id
  loop
    perform public.award_game_attempt_xp(
      attempt_row.user_id,
      attempt_row.client_attempt_id,
      attempt_row.game_id,
      attempt_row.metric,
      attempt_row.value,
      attempt_row.meta,
      attempt_row.played_at
    );
  end loop;
end;
$$;

create or replace function public.get_progression(p_user_id uuid)
returns table (
  total_xp bigint,
  level integer,
  current_level_xp bigint,
  next_level_xp bigint,
  today_xp bigint,
  total_rewarded_games bigint,
  xp_rank bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      u.id,
      u.total_xp,
      u.created_at,
      public.aqlband_level_from_xp(u.total_xp) as level
    from public.users u
    where u.id = p_user_id
  )
  select
    me.total_xp,
    me.level,
    public.aqlband_xp_for_level(me.level) as current_level_xp,
    public.aqlband_xp_for_level(me.level + 1) as next_level_xp,
    coalesce((
      select sum(xe.awarded_xp)
      from public.xp_events xe
      where xe.user_id = me.id
        and xe.played_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')
        and xe.played_at < (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') + interval '1 day'
    ), 0)::bigint as today_xp,
    (select count(*) from public.xp_events xe where xe.user_id = me.id)::bigint as total_rewarded_games,
    (
      1 + (
        select count(*)
        from public.users other
        where other.total_xp > me.total_xp
           or (other.total_xp = me.total_xp and other.created_at < me.created_at)
           or (other.total_xp = me.total_xp and other.created_at = me.created_at and other.id < me.id)
      )
    )::bigint as xp_rank
  from me;
$$;

create or replace function public.get_xp_leaderboard(
  p_limit integer default 100,
  p_user_ids uuid[] default null
)
returns table (
  user_id uuid,
  display_name text,
  username text,
  total_xp bigint,
  level integer,
  rank bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select
      u.id,
      u.display_name,
      u.username,
      u.total_xp,
      u.created_at
    from public.users u
    where p_user_ids is null or u.id = any(p_user_ids)
  ),
  ranked as (
    select
      e.*,
      row_number() over (order by e.total_xp desc, e.created_at asc, e.id asc) as rank
    from eligible e
  )
  select
    r.id,
    r.display_name,
    r.username,
    r.total_xp,
    public.aqlband_level_from_xp(r.total_xp),
    r.rank
  from ranked r
  order by r.rank
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;

alter table public.xp_events enable row level security;
revoke all on table public.xp_events from anon, authenticated;
revoke all on function public.aqlband_json_int(jsonb, text, integer) from public, anon, authenticated;
revoke all on function public.aqlband_raw_xp(text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.aqlband_xp_for_level(integer) from public, anon, authenticated;
revoke all on function public.aqlband_level_from_xp(bigint) from public, anon, authenticated;
revoke all on function public.award_game_attempt_xp(uuid, text, text, text, integer, jsonb, timestamp with time zone) from public, anon, authenticated;
revoke all on function public.aqlband_award_xp_trigger() from public, anon, authenticated;
revoke all on function public.get_progression(uuid) from public, anon, authenticated;
revoke all on function public.get_xp_leaderboard(integer, uuid[]) from public, anon, authenticated;

grant execute on function public.get_progression(uuid) to service_role;
grant execute on function public.get_xp_leaderboard(integer, uuid[]) to service_role;
