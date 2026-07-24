-- ============================================================
-- AqlBand test reset — GAME DATA ONLY
-- Keeps public.users and public.friendships.
-- Deletes all matches, millisecond attempts, XP, ELO and matchmaking data.
-- Run manually in Supabase SQL Editor. Do not add to automatic migrations.
-- ============================================================

begin;

-- Lock the main identity table while the reset is in progress.
lock table public.users in share row exclusive mode;

do $$
declare
  reset_tables text[] := array[
    'checkers_matchmaking_queue',
    'checkers_rating_events',
    'checkers_ratings',
    'xp_events',
    'game_attempts',
    'duels',
    'leaderboard'
  ];
  table_list text;
begin
  select string_agg(format('%I.%I', schemaname, tablename), ', ')
  into table_list
  from pg_tables
  where schemaname = 'public'
    and tablename = any(reset_tables);

  if table_list is not null then
    execute 'truncate table ' || table_list || ' restart identity cascade';
  end if;
end;
$$;

-- Reset cached XP and invalidate every user's old history generation.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'total_xp'
  ) then
    update public.users set total_xp = 0;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'history_generation'
  ) then
    update public.users
    set history_generation = gen_random_uuid(),
        history_cleared_at = now();
  end if;
end;
$$;

commit;

select
  'Game data cleared. Users and friendships were preserved.' as result;
