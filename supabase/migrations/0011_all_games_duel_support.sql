-- ============================================================
-- AqlBand — all catalog games in friend duels
-- Run after 0010_expand_game_catalog.sql.
-- Safe to re-run.
-- ============================================================

alter table public.duels
  add column if not exists game_config jsonb not null default '{}'::jsonb;

alter table public.duels
  drop constraint if exists duels_game_id_check;

alter table public.duels
  add constraint duels_game_id_check check (
    game_id in (
      'reaction', 'emoji-find', 'number-memory', 'stroop-test',
      'ascending-numbers', 'odd-one-out', 'pattern-memory', 'go-no-go',
      'mental-math', 'sequence-memory', 'card-memory', 'time-estimation',
      'peripheral-vision', 'twenty-four', 'dual-n-back', 'fifteen-puzzle'
    )
  );

update public.duels
set game_config = '{}'::jsonb
where game_config is null;
