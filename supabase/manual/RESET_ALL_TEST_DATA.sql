-- ============================================================
-- AqlBand test reset — ALL APPLICATION DATA
-- Deletes app users, friendships, matches, history, XP, ELO and queues.
-- Supabase Auth users are NOT deleted.
-- public.users rows will be recreated when people open the Mini App again.
-- Run manually in Supabase SQL Editor. This cannot be undone.
-- ============================================================

begin;

do $$
declare
  reset_tables text[] := array[
    'checkers_matchmaking_queue',
    'checkers_rating_events',
    'checkers_ratings',
    'xp_events',
    'game_attempts',
    'duels',
    'friendships',
    'leaderboard',
    'users'
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

commit;

select
  'All AqlBand application test data was cleared.' as result;
