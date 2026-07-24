-- ============================================================
-- AqlBand V2 final direct-start flow.
-- Run after 0016_aqlband_v2_platform.sql. Safe to re-run.
-- Rated Checkers starts immediately when a match is created.
-- Friendly Checkers and Tic Tac Toe start immediately in the Edge Function.
-- ============================================================

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
    countdown_start_at,
    game_start_at,
    ready_deadline_at,
    expires_at,
    checkers_mode,
    checkers_host_rating_before,
    checkers_guest_rating_before,
    checkers_turn,
    checkers_turn_deadline_at,
    checkers_position_history
  )
  values (
    case when account_is_host then p_user_id else candidate.user_id end,
    case when account_is_host then candidate.user_id else p_user_id end,
    case when account_is_host then me.display_name else candidate.display_name end,
    case when account_is_host then candidate.display_name else me.display_name end,
    'playing',
    true,
    true,
    'checkers',
    1,
    false,
    'medium',
    '{}'::jsonb,
    null,
    now(),
    null,
    now() + interval '30 minutes',
    'rated',
    case when account_is_host
      then my_queue.rating_snapshot
      else candidate.rating_snapshot
    end,
    case when account_is_host
      then candidate.rating_snapshot
      else my_queue.rating_snapshot
    end,
    'host',
    now() + interval '120 seconds',
    jsonb_build_object(
      'bbbbbbbbbbbb........wwwwwwwwwwww:host',
      1
    )
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
