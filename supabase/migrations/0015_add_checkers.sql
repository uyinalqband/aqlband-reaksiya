-- ============================================================
-- AqlBand Shashka (Russian draughts 8x8)
-- Friend-only, server-authoritative, 60-second turn timer.
-- Run after 0014_add_tic_tac_toe.sql. Safe to re-run.
-- ============================================================

alter table public.game_attempts
  drop constraint if exists game_attempts_game_check;

alter table public.game_attempts
  add constraint game_attempts_game_check check (
    game_id in (
      'checkers',
      'tic-tac-toe',
      'reaction', 'emoji-find', 'number-memory', 'stroop-test',
      'ascending-numbers', 'odd-one-out', 'pattern-memory', 'go-no-go',
      'mental-math', 'sequence-memory', 'card-memory', 'time-estimation',
      'peripheral-vision', 'twenty-four', 'dual-n-back', 'fifteen-puzzle',
      'sudoku', 'duel-reaction'
    )
  );

alter table public.xp_events
  drop constraint if exists xp_events_game_check;

alter table public.xp_events
  add constraint xp_events_game_check check (
    game_id in (
      'checkers',
      'tic-tac-toe',
      'reaction', 'emoji-find', 'number-memory', 'stroop-test',
      'ascending-numbers', 'odd-one-out', 'pattern-memory', 'go-no-go',
      'mental-math', 'sequence-memory', 'card-memory', 'time-estimation',
      'peripheral-vision', 'twenty-four', 'dual-n-back', 'fifteen-puzzle',
      'sudoku', 'duel-reaction'
    )
  );

alter table public.duels
  add column if not exists checkers_board text
    not null default 'bbbbbbbbbbbb........wwwwwwwwwwww',
  add column if not exists checkers_turn text
    not null default 'host',
  add column if not exists checkers_winner text,
  add column if not exists checkers_result_reason text,
  add column if not exists checkers_moves integer
    not null default 0,
  add column if not exists checkers_host_captures integer
    not null default 0,
  add column if not exists checkers_guest_captures integer
    not null default 0,
  add column if not exists checkers_host_promotions integer
    not null default 0,
  add column if not exists checkers_guest_promotions integer
    not null default 0,
  add column if not exists checkers_forced_from integer,
  add column if not exists checkers_turn_deadline_at timestamp with time zone,
  add column if not exists checkers_last_move_at timestamp with time zone,
  add column if not exists checkers_draw_offer_by text,
  add column if not exists checkers_draw_offer_at timestamp with time zone,
  add column if not exists checkers_host_draw_offers integer
    not null default 0,
  add column if not exists checkers_guest_draw_offers integer
    not null default 0,
  add column if not exists checkers_no_progress_moves integer
    not null default 0,
  add column if not exists checkers_position_history jsonb
    not null default '{"bbbbbbbbbbbb........wwwwwwwwwwww:host":1}'::jsonb;

alter table public.duels
  drop constraint if exists duels_checkers_board_check;
alter table public.duels
  add constraint duels_checkers_board_check check (
    checkers_board ~ '^[wWbB.]{32}$'
  );

alter table public.duels
  drop constraint if exists duels_checkers_turn_check;
alter table public.duels
  add constraint duels_checkers_turn_check check (
    checkers_turn in ('host', 'guest')
  );

alter table public.duels
  drop constraint if exists duels_checkers_winner_check;
alter table public.duels
  add constraint duels_checkers_winner_check check (
    checkers_winner is null
    or checkers_winner in ('host', 'guest', 'draw')
  );

alter table public.duels
  drop constraint if exists duels_checkers_result_reason_check;
alter table public.duels
  add constraint duels_checkers_result_reason_check check (
    checkers_result_reason is null
    or checkers_result_reason in (
      'all_captured',
      'no_moves',
      'timeout',
      'resign',
      'draw_agreement',
      'repetition',
      'no_progress',
      'move_limit'
    )
  );

alter table public.duels
  drop constraint if exists duels_checkers_forced_from_check;
alter table public.duels
  add constraint duels_checkers_forced_from_check check (
    checkers_forced_from is null
    or checkers_forced_from between 0 and 31
  );

alter table public.duels
  drop constraint if exists duels_checkers_draw_offer_by_check;
alter table public.duels
  add constraint duels_checkers_draw_offer_by_check check (
    checkers_draw_offer_by is null
    or checkers_draw_offer_by in ('host', 'guest')
  );

alter table public.duels
  drop constraint if exists duels_checkers_counter_check;
alter table public.duels
  add constraint duels_checkers_counter_check check (
    checkers_moves >= 0
    and checkers_host_captures between 0 and 12
    and checkers_guest_captures between 0 and 12
    and checkers_host_promotions between 0 and 12
    and checkers_guest_promotions between 0 and 12
    and checkers_host_draw_offers between 0 and 3
    and checkers_guest_draw_offers between 0 and 3
    and checkers_no_progress_moves >= 0
  );

alter table public.duels
  drop constraint if exists duels_game_id_check;

alter table public.duels
  add constraint duels_game_id_check check (
    game_id in (
      'checkers',
      'tic-tac-toe',
      'reaction', 'emoji-find', 'number-memory', 'stroop-test',
      'ascending-numbers', 'odd-one-out', 'pattern-memory', 'go-no-go',
      'mental-math', 'sequence-memory', 'card-memory', 'time-estimation',
      'peripheral-vision', 'twenty-four', 'dual-n-back', 'fifteen-puzzle',
      'sudoku'
    )
  );

create index if not exists idx_duels_checkers_turn_deadline
  on public.duels (checkers_turn_deadline_at)
  where game_id = 'checkers'
    and status = 'playing'
    and checkers_winner is null;

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

    when 'checkers' then
      base_xp := case
        when coalesce((p_meta ->> 'won')::boolean, false) then 30
        when coalesce((p_meta ->> 'draw')::boolean, false) then 18
        else 8
      end;
      return base_xp;

    when 'tic-tac-toe' then
      base_xp := case
        when coalesce((p_meta ->> 'won')::boolean, false) then 28
        when coalesce((p_meta ->> 'draw')::boolean, false) then 18
        else 10
      end;
      return base_xp;

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
