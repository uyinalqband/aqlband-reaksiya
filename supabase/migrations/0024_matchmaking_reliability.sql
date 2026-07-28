-- AI V2.3.1 — reliable 20-second AI fallback.
-- Run after 0023_social_retention.sql. Safe to re-run.

create or replace function public.create_checkers_ai_match(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.users;
  bot record;
  queue_row public.checkers_matchmaking_queue;
  active_match public.duels;
  my_rating integer;
  created public.duels;
  my_role text;
begin
  -- Serializes concurrent 1.5-second client polls for the same account.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select * into me
  from public.users
  where id = p_user_id and is_ai = false;
  if not found then raise exception 'user_not_found'; end if;

  -- A concurrent human match always wins; never create a second duel.
  select * into active_match
  from public.duels
  where game_id = 'checkers'
    and status in ('invited', 'ready_check', 'countdown', 'playing')
    and (host_user_id = p_user_id or guest_user_id = p_user_id)
  order by created_at desc
  limit 1;

  if found then
    my_role := case
      when active_match.host_user_id = p_user_id then 'host'
      else 'guest'
    end;
    return jsonb_build_object(
      'state', 'matched',
      'queuedAt', null,
      'expandedRange', 500,
      'duelId', active_match.id,
      'role', my_role,
      'opponentName', case
        when my_role = 'host' then active_match.guest_name
        else active_match.host_name
      end,
      'opponentType', active_match.opponent_type
    );
  end if;

  select * into queue_row
  from public.checkers_matchmaking_queue
  where user_id = p_user_id
  for update;
  if not found then raise exception 'queue_not_found'; end if;
  if queue_row.status <> 'waiting' then raise exception 'queue_not_waiting'; end if;
  if now() - queue_row.queued_at < interval '20 seconds' then
    raise exception 'ai_not_due';
  end if;

  select rating into my_rating
  from public.checkers_ratings
  where user_id = p_user_id;
  my_rating := coalesce(my_rating, queue_row.rating_snapshot, 1200);

  select u.id, u.display_name, u.provider_user_id, r.rating
  into bot
  from public.users u
  join public.checkers_ratings r on r.user_id = u.id
  where u.is_ai = true and u.provider = 'ai'
  order by abs(r.rating - my_rating), random()
  limit 1;
  if not found then raise exception 'ai_not_found'; end if;

  insert into public.duels (
    host_user_id, guest_user_id, host_name, guest_name, status,
    host_ready, guest_ready, game_id, round_count, survival, difficulty,
    game_config, game_start_at, expires_at, checkers_mode,
    checkers_host_rating_before, checkers_guest_rating_before,
    checkers_turn, checkers_turn_deadline_at, checkers_position_history,
    opponent_type, ai_persona_id
  ) values (
    p_user_id, bot.id, me.display_name, bot.display_name, 'playing',
    true, true, 'checkers', 1, false, 'very-hard',
    '{"ai":true}'::jsonb, now(), now() + interval '30 minutes', 'friendly',
    my_rating, bot.rating, 'host', now() + interval '60 seconds',
    '{"bbbbbbbbbbbb........wwwwwwwwwwww:host":1}'::jsonb,
    'ai', bot.provider_user_id
  )
  returning * into created;

  update public.checkers_matchmaking_queue
  set status = 'matched', duel_id = created.id, role = 'host', updated_at = now()
  where user_id = p_user_id;

  update public.checkers_match_offers
  set status = 'cancelled', responded_at = now()
  where seeker_user_id = p_user_id and status = 'pending';

  return jsonb_build_object(
    'state', 'matched',
    'queuedAt', extract(epoch from queue_row.queued_at) * 1000,
    'expandedRange', 500,
    'duelId', created.id,
    'role', 'host',
    'opponentName', bot.display_name,
    'opponentType', 'ai',
    'opponentRating', bot.rating
  );
end;
$$;

revoke all on function public.create_checkers_ai_match(uuid)
  from public, anon, authenticated;
grant execute on function public.create_checkers_ai_match(uuid)
  to service_role;
