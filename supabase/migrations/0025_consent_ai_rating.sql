-- AI V2.4 — explicit 10-second consent, active-search heartbeat and limited AI ELO.
-- Run after 0024_matchmaking_reliability.sql. Safe to re-run.

alter table public.checkers_match_offers
  add column if not exists seeker_notified_at timestamptz;

alter table public.checkers_match_offers
  alter column expires_at set default (now() + interval '10 seconds');

update public.checkers_match_offers
set expires_at = least(expires_at, created_at + interval '10 seconds')
where status = 'pending';

-- AI games are rated while the community is growing. A normalization RPC below
-- limits the human change and restores the AI persona's fixed rating.
create or replace function public.create_checkers_ai_match(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public
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
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into me from public.users where id=p_user_id and is_ai=false;
  if not found then raise exception 'user_not_found'; end if;

  select * into active_match from public.duels
  where game_id='checkers'
    and status in ('invited','ready_check','countdown','playing')
    and (host_user_id=p_user_id or guest_user_id=p_user_id)
  order by created_at desc limit 1;
  if found then
    my_role := case when active_match.host_user_id=p_user_id then 'host' else 'guest' end;
    return jsonb_build_object(
      'state','matched','queuedAt',null,'expandedRange',500,
      'duelId',active_match.id,'role',my_role,
      'opponentName',case when my_role='host' then active_match.guest_name else active_match.host_name end,
      'opponentType',active_match.opponent_type
    );
  end if;

  select * into queue_row from public.checkers_matchmaking_queue
  where user_id=p_user_id for update;
  if not found or queue_row.status<>'waiting' then raise exception 'queue_not_waiting'; end if;
  if now()-queue_row.queued_at < interval '20 seconds' then raise exception 'ai_not_due'; end if;

  select rating into my_rating from public.checkers_ratings where user_id=p_user_id;
  my_rating := coalesce(my_rating,queue_row.rating_snapshot,1200);
  select u.id,u.display_name,u.provider_user_id,r.rating into bot
  from public.users u join public.checkers_ratings r on r.user_id=u.id
  where u.is_ai=true and u.provider='ai'
  order by abs(r.rating-my_rating),random() limit 1;
  if not found then raise exception 'ai_not_found'; end if;

  insert into public.duels (
    host_user_id,guest_user_id,host_name,guest_name,status,host_ready,guest_ready,
    game_id,round_count,survival,difficulty,game_config,game_start_at,expires_at,
    checkers_mode,checkers_host_rating_before,checkers_guest_rating_before,
    checkers_turn,checkers_turn_deadline_at,checkers_position_history,
    opponent_type,ai_persona_id
  ) values (
    p_user_id,bot.id,me.display_name,bot.display_name,'playing',true,true,
    'checkers',1,false,'very-hard','{"ai":true,"ratingImpact":"limited"}'::jsonb,
    now(),now()+interval '30 minutes','rated',my_rating,bot.rating,
    'host',now()+interval '60 seconds',
    '{"bbbbbbbbbbbb........wwwwwwwwwwww:host":1}'::jsonb,'ai',bot.provider_user_id
  ) returning * into created;

  update public.checkers_matchmaking_queue
  set status='matched',duel_id=created.id,role='host',updated_at=now()
  where user_id=p_user_id;
  update public.checkers_match_offers set status='cancelled',responded_at=now()
  where seeker_user_id=p_user_id and status='pending';

  return jsonb_build_object(
    'state','matched','queuedAt',extract(epoch from queue_row.queued_at)*1000,
    'expandedRange',500,'duelId',created.id,'role','host',
    'opponentName',bot.display_name,'opponentType','ai','opponentRating',bot.rating
  );
end;
$$;

revoke all on function public.create_checkers_ai_match(uuid) from public,anon,authenticated;
grant execute on function public.create_checkers_ai_match(uuid) to service_role;

create or replace function public.normalize_ai_checkers_rating(p_duel_id uuid)
returns public.duels language plpgsql security definer set search_path=public
as $$
declare
  d public.duels;
  human_before integer;
  original_delta integer;
  limited_delta integer;
  bot_before integer;
  today_ai_games integer;
begin
  select * into d from public.duels where id=p_duel_id for update;
  if not found or d.opponent_type<>'ai' or d.checkers_rating_processed_at is null then return d; end if;

  human_before := coalesce(d.checkers_host_rating_before,1200);
  original_delta := coalesce(d.checkers_host_rating_delta,0);
  bot_before := coalesce(d.checkers_guest_rating_before,1200);
  select count(*) into today_ai_games
  from public.checkers_rating_events e
  join public.duels x on x.id=e.duel_id
  where e.user_id=d.host_user_id and x.opponent_type='ai'
    and e.created_at >= date_trunc('day',now()) and e.duel_id<>d.id;

  limited_delta := case when today_ai_games>=3 then 0
    else greatest(-8,least(8,original_delta)) end;

  update public.checkers_ratings set
    rating=greatest(100,human_before+limited_delta),
    peak_rating=greatest(peak_rating,greatest(100,human_before+limited_delta))
  where user_id=d.host_user_id;
  update public.checkers_ratings set
    rating=bot_before,
    peak_rating=greatest(peak_rating,bot_before),
    games=greatest(0,games-1),
    wins=greatest(0,wins-case when d.checkers_winner='guest' then 1 else 0 end),
    draws=greatest(0,draws-case when d.checkers_winner='draw' then 1 else 0 end),
    losses=greatest(0,losses-case when d.checkers_winner='host' then 1 else 0 end)
  where user_id=d.guest_user_id;

  update public.checkers_rating_events set
    rating_after=greatest(100,human_before+limited_delta),rating_delta=limited_delta
  where duel_id=d.id and user_id=d.host_user_id;
  delete from public.checkers_rating_events where duel_id=d.id and user_id=d.guest_user_id;

  update public.duels set
    checkers_host_rating_after=greatest(100,human_before+limited_delta),
    checkers_host_rating_delta=limited_delta,
    checkers_guest_rating_after=bot_before,
    checkers_guest_rating_delta=0
  where id=d.id returning * into d;
  return d;
end;
$$;

revoke all on function public.normalize_ai_checkers_rating(uuid) from public,anon,authenticated;
grant execute on function public.normalize_ai_checkers_rating(uuid) to service_role;
