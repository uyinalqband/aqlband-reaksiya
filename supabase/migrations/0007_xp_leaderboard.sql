-- ============================================================
-- AqlBand XP leaderboard
-- Global/Friends: total XP
-- Weekly/Monthly: XP earned during the selected UTC period
-- Safe to re-run.
-- ============================================================

create or replace function public.get_xp_period_leaderboard(
  p_period text default 'global',
  p_limit integer default 100,
  p_user_ids uuid[] default null
)
returns table (
  user_id uuid,
  display_name text,
  username text,
  xp bigint,
  total_xp bigint,
  level integer,
  rank bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with settings as (
    select
      case
        when p_period in ('weekly', 'monthly') then p_period
        else 'global'
      end as period,
      case
        when p_period = 'weekly'
          then date_trunc('week', now() at time zone 'UTC') at time zone 'UTC'
        when p_period = 'monthly'
          then date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'
        else null::timestamp with time zone
      end as starts_at
  ),
  scored as (
    select
      u.id,
      u.display_name,
      u.username,
      u.total_xp,
      u.created_at,
      s.period,
      case
        when s.period = 'global' then u.total_xp
        else coalesce(
          sum(xe.awarded_xp) filter (where xe.played_at >= s.starts_at),
          0
        )::bigint
      end as xp
    from public.users u
    cross join settings s
    left join public.xp_events xe on xe.user_id = u.id
    where p_user_ids is null or u.id = any(p_user_ids)
    group by
      u.id,
      u.display_name,
      u.username,
      u.total_xp,
      u.created_at,
      s.period,
      s.starts_at
  ),
  filtered as (
    select *
    from scored
    where period = 'global' or p_user_ids is not null or xp > 0
  ),
  ranked as (
    select
      f.*,
      row_number() over (
        order by f.xp desc, f.total_xp desc, f.created_at asc, f.id asc
      ) as position
    from filtered f
  )
  select
    r.id,
    r.display_name,
    r.username,
    r.xp,
    r.total_xp,
    public.aqlband_level_from_xp(r.total_xp),
    r.position
  from ranked r
  order by r.position
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;

revoke all on function public.get_xp_period_leaderboard(text, integer, uuid[]) from public, anon, authenticated;
grant execute on function public.get_xp_period_leaderboard(text, integer, uuid[]) to service_role;
