-- ============================================================
-- AqlBand V2 platform migration
-- Checkers-only ELO, ranked matchmaking, official match history,
-- and migration-safe rating bootstrap.
-- Run after 0015_add_checkers.sql. Safe to re-run.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.checkers_ratings (
  user_id uuid primary key references public.users(id) on delete cascade,
  rating integer not null default 1200 check (rating >= 100 and rating <= 5000),
  peak_rating integer not null default 1200 check (peak_rating >= 100 and peak_rating <= 5000),
  games integer not null default 0 check (games >= 0),
  wins integer not null default 0 check (wins >= 0),
  draws integer not null default 0 check (draws >= 0),
  losses integer not null default 0 check (losses >= 0),
  provisional_games integer not null default 0 check (provisional_games between 0 and 10),
  updated_at timestamp with time zone not null default now()
);

insert into public.checkers_ratings (user_id)
select id from public.users
on conflict (user_id) do nothing;

create table if not exists public.checkers_rating_events (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references public.duels(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  opponent_user_id uuid not null references public.users(id) on delete cascade,
  outcome text not null check (outcome in ('win', 'draw', 'loss')),
  rating_before integer not null,
  rating_after integer not null,
  rating_delta integer not null,
  created_at timestamp with time zone not null default now(),
  unique (duel_id, user_id)
);

create index if not exists idx_checkers_rating_events_user_created
  on public.checkers_rating_events (user_id, created_at desc);

create index if not exists idx_checkers_ratings_order
  on public.checkers_ratings (rating desc, games desc, updated_at asc);

create table if not exists public.checkers_matchmaking_queue (
  user_id uuid primary key references public.users(id) on delete cascade,
  rating_snapshot integer not null default 1200,
  status text not null default 'waiting'
    check (status in ('waiting', 'matched')),
  duel_id uuid references public.duels(id) on delete set null,
  role text check (role is null or role in ('host', 'guest')),
  queued_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_checkers_queue_waiting
  on public.checkers_matchmaking_queue (status, queued_at)
  where status = 'waiting';

alter table public.duels
  add column if not exists checkers_mode text not null default 'friendly',
  add column if not exists checkers_host_rating_before integer,
  add column if not exists checkers_guest_rating_before integer,
  add column if not exists checkers_host_rating_after integer,
  add column if not exists checkers_guest_rating_after integer,
  add column if not exists checkers_host_rating_delta integer,
  add column if not exists checkers_guest_rating_delta integer,
  add column if not exists checkers_rating_processed_at timestamp with time zone;

alter table public.duels
  drop constraint if exists duels_checkers_mode_check;
alter table public.duels
  add constraint duels_checkers_mode_check check (
    checkers_mode in ('friendly', 'rated')
  );

create or replace function public.ensure_checkers_rating(p_user_id uuid)
returns public.checkers_ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.checkers_ratings;
begin
  insert into public.checkers_ratings (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into result
  from public.checkers_ratings
  where user_id = p_user_id;

  return result;
end;
$$;

revoke all on function public.ensure_checkers_rating(uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_checkers_rating(uuid)
  to service_role;

create or replace function public.finalize_checkers_rating(p_duel_id uuid)
returns public.duels
language plpgsql
security definer
set search_path = public
as $$
declare
  match_row public.duels;
  host_row public.checkers_ratings;
  guest_row public.checkers_ratings;
  host_score numeric;
  guest_score numeric;
  host_expected numeric;
  guest_expected numeric;
  host_k integer;
  guest_k integer;
  host_delta integer;
  guest_delta integer;
  host_after integer;
  guest_after integer;
  host_outcome text;
  guest_outcome text;
begin
  select *
  into match_row
  from public.duels
  where id = p_duel_id
  for update;

  if not found then
    raise exception 'duel_not_found';
  end if;

  if match_row.game_id <> 'checkers'
     or match_row.checkers_mode <> 'rated'
     or match_row.status <> 'finished'
     or match_row.checkers_winner is null
     or match_row.guest_user_id is null then
    return match_row;
  end if;

  if match_row.checkers_rating_processed_at is not null then
    return match_row;
  end if;

  perform public.ensure_checkers_rating(match_row.host_user_id);
  perform public.ensure_checkers_rating(match_row.guest_user_id);

  select *
  into host_row
  from public.checkers_ratings
  where user_id = match_row.host_user_id
  for update;

  select *
  into guest_row
  from public.checkers_ratings
  where user_id = match_row.guest_user_id
  for update;

  if match_row.checkers_winner = 'host' then
    host_score := 1;
    guest_score := 0;
    host_outcome := 'win';
    guest_outcome := 'loss';
  elsif match_row.checkers_winner = 'guest' then
    host_score := 0;
    guest_score := 1;
    host_outcome := 'loss';
    guest_outcome := 'win';
  else
    host_score := 0.5;
    guest_score := 0.5;
    host_outcome := 'draw';
    guest_outcome := 'draw';
  end if;

  host_expected := 1 / (
    1 + power(10::numeric, (guest_row.rating - host_row.rating)::numeric / 400)
  );
  guest_expected := 1 - host_expected;

  host_k := case
    when host_row.games < 10 then 48
    when host_row.rating >= 2000 then 24
    else 32
  end;
  guest_k := case
    when guest_row.games < 10 then 48
    when guest_row.rating >= 2000 then 24
    else 32
  end;

  host_delta := round(host_k * (host_score - host_expected));
  guest_delta := round(guest_k * (guest_score - guest_expected));

  -- A decisive result must always move both ratings in the expected direction.
  if host_score = 1 and host_delta < 1 then host_delta := 1; end if;
  if host_score = 0 and host_delta > -1 then host_delta := -1; end if;
  if guest_score = 1 and guest_delta < 1 then guest_delta := 1; end if;
  if guest_score = 0 and guest_delta > -1 then guest_delta := -1; end if;

  host_after := greatest(100, host_row.rating + host_delta);
  guest_after := greatest(100, guest_row.rating + guest_delta);
  host_delta := host_after - host_row.rating;
  guest_delta := guest_after - guest_row.rating;

  update public.checkers_ratings
  set
    rating = host_after,
    peak_rating = greatest(peak_rating, host_after),
    games = games + 1,
    wins = wins + case when host_outcome = 'win' then 1 else 0 end,
    draws = draws + case when host_outcome = 'draw' then 1 else 0 end,
    losses = losses + case when host_outcome = 'loss' then 1 else 0 end,
    provisional_games = least(10, provisional_games + 1),
    updated_at = now()
  where user_id = match_row.host_user_id;

  update public.checkers_ratings
  set
    rating = guest_after,
    peak_rating = greatest(peak_rating, guest_after),
    games = games + 1,
    wins = wins + case when guest_outcome = 'win' then 1 else 0 end,
    draws = draws + case when guest_outcome = 'draw' then 1 else 0 end,
    losses = losses + case when guest_outcome = 'loss' then 1 else 0 end,
    provisional_games = least(10, provisional_games + 1),
    updated_at = now()
  where user_id = match_row.guest_user_id;

  insert into public.checkers_rating_events (
    duel_id, user_id, opponent_user_id, outcome,
    rating_before, rating_after, rating_delta
  )
  values
    (
      match_row.id,
      match_row.host_user_id,
      match_row.guest_user_id,
      host_outcome,
      host_row.rating,
      host_after,
      host_delta
    ),
    (
      match_row.id,
      match_row.guest_user_id,
      match_row.host_user_id,
      guest_outcome,
      guest_row.rating,
      guest_after,
      guest_delta
    )
  on conflict (duel_id, user_id) do nothing;

  update public.duels
  set
    checkers_host_rating_before = host_row.rating,
    checkers_guest_rating_before = guest_row.rating,
    checkers_host_rating_after = host_after,
    checkers_guest_rating_after = guest_after,
    checkers_host_rating_delta = host_delta,
    checkers_guest_rating_delta = guest_delta,
    checkers_rating_processed_at = now()
  where id = match_row.id
  returning * into match_row;

  return match_row;
end;
$$;

revoke all on function public.finalize_checkers_rating(uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_checkers_rating(uuid)
  to service_role;


create or replace function public.join_checkers_matchmaking(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.users;
  my_rating public.checkers_ratings;
  my_queue public.checkers_matchmaking_queue;
  candidate record;
  active_match public.duels;
  created_match public.duels;
  my_wait_seconds integer;
  my_range integer;
  candidate_wait_seconds integer;
  candidate_range integer;
  account_is_host boolean;
  my_role text;
  candidate_role text;
begin
  select * into me
  from public.users
  where id = p_user_id;

  if not found then
    raise exception 'user_not_found';
  end if;

  select *
  into active_match
  from public.duels
  where game_id = 'checkers'
    and status in ('invited', 'ready_check', 'countdown', 'playing')
    and (host_user_id = p_user_id or guest_user_id = p_user_id)
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'state', 'matched',
      'queuedAt', null,
      'expandedRange', 500,
      'duelId', active_match.id,
      'role', case
        when active_match.host_user_id = p_user_id then 'host'
        else 'guest'
      end,
      'opponentName', case
        when active_match.host_user_id = p_user_id
          then active_match.guest_name
        else active_match.host_name
      end
    );
  end if;

  delete from public.checkers_matchmaking_queue
  where status = 'waiting'
    and queued_at < now() - interval '10 minutes';

  delete from public.checkers_matchmaking_queue q
  using public.duels d
  where q.status = 'matched'
    and q.duel_id = d.id
    and d.status not in ('invited', 'ready_check', 'countdown', 'playing');

  select * into my_rating
  from public.ensure_checkers_rating(p_user_id);

  insert into public.checkers_matchmaking_queue (
    user_id,
    rating_snapshot,
    status,
    queued_at,
    updated_at
  )
  values (
    p_user_id,
    my_rating.rating,
    'waiting',
    now(),
    now()
  )
  on conflict (user_id) do update
  set
    rating_snapshot = excluded.rating_snapshot,
    status = case
      when public.checkers_matchmaking_queue.status = 'matched'
        then public.checkers_matchmaking_queue.status
      else 'waiting'
    end,
    duel_id = case
      when public.checkers_matchmaking_queue.status = 'matched'
        then public.checkers_matchmaking_queue.duel_id
      else null
    end,
    role = case
      when public.checkers_matchmaking_queue.status = 'matched'
        then public.checkers_matchmaking_queue.role
      else null
    end,
    updated_at = now();

  select * into my_queue
  from public.checkers_matchmaking_queue
  where user_id = p_user_id
  for update;

  if my_queue.status = 'matched' and my_queue.duel_id is not null then
    select * into active_match
    from public.duels
    where id = my_queue.duel_id;

    if found and active_match.status in (
      'invited', 'ready_check', 'countdown', 'playing'
    ) then
      return jsonb_build_object(
        'state', 'matched',
        'queuedAt', extract(epoch from my_queue.queued_at) * 1000,
        'expandedRange', 500,
        'duelId', active_match.id,
        'role', my_queue.role,
        'opponentName', case
          when my_queue.role = 'host'
            then active_match.guest_name
          else active_match.host_name
        end
      );
    end if;

    update public.checkers_matchmaking_queue
    set
      status = 'waiting',
      duel_id = null,
      role = null,
      queued_at = now(),
      updated_at = now()
    where user_id = p_user_id
    returning * into my_queue;
  end if;

  my_wait_seconds := greatest(
    0,
    floor(extract(epoch from (now() - my_queue.queued_at)))::integer
  );
  my_range := least(500, 100 + (my_wait_seconds / 15) * 50);

  select
    q.*,
    u.display_name,
    greatest(
      my_range,
      least(
        500,
        100 + (
          greatest(
            0,
            floor(extract(epoch from (now() - q.queued_at)))::integer
          ) / 15
        ) * 50
      )
    ) as allowed_range
  into candidate
  from public.checkers_matchmaking_queue q
  join public.users u on u.id = q.user_id
  where q.status = 'waiting'
    and q.user_id <> p_user_id
    and abs(q.rating_snapshot - my_queue.rating_snapshot) <= greatest(
      my_range,
      least(
        500,
        100 + (
          greatest(
            0,
            floor(extract(epoch from (now() - q.queued_at)))::integer
          ) / 15
        ) * 50
      )
    )
  order by
    abs(q.rating_snapshot - my_queue.rating_snapshot) asc,
    q.queued_at asc
  for update of q skip locked
  limit 1;

  if not found then
    return jsonb_build_object(
      'state', 'searching',
      'queuedAt', extract(epoch from my_queue.queued_at) * 1000,
      'expandedRange', my_range,
      'duelId', null,
      'role', null,
      'opponentName', null
    );
  end if;

  account_is_host := random() < 0.5;
  my_role := case when account_is_host then 'host' else 'guest' end;
  candidate_role := case when account_is_host then 'guest' else 'host' end;

  insert into public.duels (
    host_user_id,
    guest_user_id,
    host_name,
    guest_name,
    status,
    host_ready,
    guest_ready,
    game_id,
    round_count,
    survival,
    difficulty,
    game_config,
    ready_deadline_at,
    expires_at,
    checkers_mode
  )
  values (
    case when account_is_host then p_user_id else candidate.user_id end,
    case when account_is_host then candidate.user_id else p_user_id end,
    case when account_is_host then me.display_name else candidate.display_name end,
    case when account_is_host then candidate.display_name else me.display_name end,
    'ready_check',
    false,
    false,
    'checkers',
    1,
    false,
    'medium',
    '{}'::jsonb,
    now() + interval '20 seconds',
    now() + interval '30 minutes',
    'rated'
  )
  returning * into created_match;

  update public.checkers_matchmaking_queue
  set
    status = 'matched',
    duel_id = created_match.id,
    role = my_role,
    updated_at = now()
  where user_id = p_user_id;

  update public.checkers_matchmaking_queue
  set
    status = 'matched',
    duel_id = created_match.id,
    role = candidate_role,
    updated_at = now()
  where user_id = candidate.user_id;

  return jsonb_build_object(
    'state', 'matched',
    'queuedAt', extract(epoch from my_queue.queued_at) * 1000,
    'expandedRange', my_range,
    'duelId', created_match.id,
    'role', my_role,
    'opponentName', candidate.display_name
  );
end;
$$;

revoke all on function public.join_checkers_matchmaking(uuid)
  from public, anon, authenticated;
grant execute on function public.join_checkers_matchmaking(uuid)
  to service_role;

-- Public clients never query these tables directly; all access goes through
-- the verified Edge Function using the service role.
alter table public.checkers_ratings enable row level security;
alter table public.checkers_rating_events enable row level security;
alter table public.checkers_matchmaking_queue enable row level security;

revoke all on public.checkers_ratings from anon, authenticated;
revoke all on public.checkers_rating_events from anon, authenticated;
revoke all on public.checkers_matchmaking_queue from anon, authenticated;
