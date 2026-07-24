-- ============================================================
-- AqlBand Tic Tac Toe
-- Friend-only, server-authoritative, turn-based game.
-- Run after 0013_game_best_leaderboard.sql. Safe to re-run.
-- ============================================================

alter table public.game_attempts
  drop constraint if exists game_attempts_game_check;

alter table public.game_attempts
  add constraint game_attempts_game_check check (
    game_id in (
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
      'tic-tac-toe',
      'reaction', 'emoji-find', 'number-memory', 'stroop-test',
      'ascending-numbers', 'odd-one-out', 'pattern-memory', 'go-no-go',
      'mental-math', 'sequence-memory', 'card-memory', 'time-estimation',
      'peripheral-vision', 'twenty-four', 'dual-n-back', 'fifteen-puzzle',
      'sudoku', 'duel-reaction'
    )
  );

alter table public.duels
  add column if not exists tic_tac_toe_board text not null default '.........',
  add column if not exists tic_tac_toe_turn text not null default 'host',
  add column if not exists tic_tac_toe_winner text,
  add column if not exists tic_tac_toe_moves integer not null default 0,
  add column if not exists tic_tac_toe_last_move_at timestamp with time zone;

alter table public.duels
  drop constraint if exists duels_tic_tac_toe_board_check;
alter table public.duels
  add constraint duels_tic_tac_toe_board_check check (
    tic_tac_toe_board ~ '^[XO.]{9}$'
  );

alter table public.duels
  drop constraint if exists duels_tic_tac_toe_turn_check;
alter table public.duels
  add constraint duels_tic_tac_toe_turn_check check (
    tic_tac_toe_turn in ('host', 'guest')
  );

alter table public.duels
  drop constraint if exists duels_tic_tac_toe_winner_check;
alter table public.duels
  add constraint duels_tic_tac_toe_winner_check check (
    tic_tac_toe_winner is null
    or tic_tac_toe_winner in ('host', 'guest', 'draw')
  );

alter table public.duels
  drop constraint if exists duels_game_id_check;

alter table public.duels
  add constraint duels_game_id_check check (
    game_id in (
      'tic-tac-toe',
      'reaction', 'emoji-find', 'number-memory', 'stroop-test',
      'ascending-numbers', 'odd-one-out', 'pattern-memory', 'go-no-go',
      'mental-math', 'sequence-memory', 'card-memory', 'time-estimation',
      'peripheral-vision', 'twenty-four', 'dual-n-back', 'fifteen-puzzle',
      'sudoku'
    )
  );

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

create or replace function public.play_tic_tac_toe_move(
  p_duel_id uuid,
  p_user_id uuid,
  p_cell integer
)
returns public.duels
language plpgsql
security definer
set search_path = public
as $$
declare
  duel_row public.duels;
  player_role text;
  mark text;
  board text;
  new_board text;
  winner_role text := null;
  winning_mark text := null;
  next_moves integer;
begin
  if p_cell < 0 or p_cell > 8 then
    raise exception 'invalid_cell';
  end if;

  select *
  into duel_row
  from public.duels
  where id = p_duel_id
  for update;

  if not found then
    raise exception 'duel_not_found';
  end if;

  if duel_row.game_id <> 'tic-tac-toe' then
    raise exception 'invalid_game';
  end if;

  if duel_row.host_user_id = p_user_id then
    player_role := 'host';
    mark := 'X';
  elsif duel_row.guest_user_id = p_user_id then
    player_role := 'guest';
    mark := 'O';
  else
    raise exception 'duel_forbidden';
  end if;

  if duel_row.status not in ('countdown', 'playing') then
    if duel_row.status = 'finished' then
      return duel_row;
    end if;
    raise exception 'game_not_started';
  end if;

  if duel_row.game_start_at is null
     or now() < duel_row.game_start_at - interval '250 milliseconds' then
    raise exception 'game_not_started';
  end if;

  if duel_row.tic_tac_toe_winner is not null then
    return duel_row;
  end if;

  if duel_row.tic_tac_toe_turn <> player_role then
    raise exception 'not_your_turn';
  end if;

  board := coalesce(duel_row.tic_tac_toe_board, '.........');

  if substr(board, p_cell + 1, 1) <> '.' then
    raise exception 'cell_occupied';
  end if;

  new_board :=
    substr(board, 1, p_cell)
    || mark
    || substr(board, p_cell + 2);

  winning_mark := case
    when substr(new_board, 1, 1) <> '.'
      and substr(new_board, 1, 1) = substr(new_board, 2, 1)
      and substr(new_board, 1, 1) = substr(new_board, 3, 1)
      then substr(new_board, 1, 1)
    when substr(new_board, 4, 1) <> '.'
      and substr(new_board, 4, 1) = substr(new_board, 5, 1)
      and substr(new_board, 4, 1) = substr(new_board, 6, 1)
      then substr(new_board, 4, 1)
    when substr(new_board, 7, 1) <> '.'
      and substr(new_board, 7, 1) = substr(new_board, 8, 1)
      and substr(new_board, 7, 1) = substr(new_board, 9, 1)
      then substr(new_board, 7, 1)
    when substr(new_board, 1, 1) <> '.'
      and substr(new_board, 1, 1) = substr(new_board, 4, 1)
      and substr(new_board, 1, 1) = substr(new_board, 7, 1)
      then substr(new_board, 1, 1)
    when substr(new_board, 2, 1) <> '.'
      and substr(new_board, 2, 1) = substr(new_board, 5, 1)
      and substr(new_board, 2, 1) = substr(new_board, 8, 1)
      then substr(new_board, 2, 1)
    when substr(new_board, 3, 1) <> '.'
      and substr(new_board, 3, 1) = substr(new_board, 6, 1)
      and substr(new_board, 3, 1) = substr(new_board, 9, 1)
      then substr(new_board, 3, 1)
    when substr(new_board, 1, 1) <> '.'
      and substr(new_board, 1, 1) = substr(new_board, 5, 1)
      and substr(new_board, 1, 1) = substr(new_board, 9, 1)
      then substr(new_board, 1, 1)
    when substr(new_board, 3, 1) <> '.'
      and substr(new_board, 3, 1) = substr(new_board, 5, 1)
      and substr(new_board, 3, 1) = substr(new_board, 7, 1)
      then substr(new_board, 3, 1)
    else null
  end;

  next_moves := coalesce(duel_row.tic_tac_toe_moves, 0) + 1;

  if winning_mark = 'X' then
    winner_role := 'host';
  elsif winning_mark = 'O' then
    winner_role := 'guest';
  elsif position('.' in new_board) = 0 then
    winner_role := 'draw';
  end if;

  update public.duels
  set
    tic_tac_toe_board = new_board,
    tic_tac_toe_turn = case when player_role = 'host' then 'guest' else 'host' end,
    tic_tac_toe_winner = winner_role,
    tic_tac_toe_moves = next_moves,
    tic_tac_toe_last_move_at = now(),
    status = case when winner_role is null then 'playing' else 'finished' end,
    finished_at = case when winner_role is null then finished_at else now() end,
    expires_at = case
      when winner_role is null then now() + interval '30 minutes'
      else expires_at
    end
  where id = p_duel_id
  returning * into duel_row;

  return duel_row;
end;
$$;

revoke all on function public.play_tic_tac_toe_move(uuid, uuid, integer)
  from public, anon, authenticated;

grant execute on function public.play_tic_tac_toe_move(uuid, uuid, integer)
  to service_role;
