-- Checkers Online V3.1
-- Bitta faol AI (Temur), to‘liq ELO va taklifni ishonchli qabul qilish.
-- 0030_match_offer_seeker_sync.sql dan keyin bir marta bajaring.

begin;

alter table public.users
  add column if not exists ai_enabled boolean not null default false;

insert into public.users (
  provider, provider_user_id, display_name, username, avatar, is_ai, ai_enabled
) values (
  'ai', 'temur', 'Temur', null, '🐯', true, true
)
on conflict (provider, provider_user_id) do update set
  display_name='Temur',
  avatar='🐯',
  is_ai=true,
  ai_enabled=true;

update public.users
set ai_enabled=(provider='ai' and provider_user_id='temur')
where is_ai=true or provider='ai';

insert into public.checkers_ratings(user_id,rating,peak_rating)
select id,1800,1800 from public.users
where provider='ai' and provider_user_id='temur'
on conflict(user_id) do update set
  rating=greatest(public.checkers_ratings.rating,1800),
  peak_rating=greatest(public.checkers_ratings.peak_rating,1800);

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
  ai_role text;
  human_is_host boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  select * into me from public.users where id=p_user_id and is_ai=false;
  if not found then raise exception 'user_not_found'; end if;

  select * into active_match from public.duels
  where game_id='checkers'
    and status in ('invited','ready_check','countdown','playing')
    and (host_user_id=p_user_id or guest_user_id=p_user_id)
  order by created_at desc limit 1;
  if found then
    my_role:=case when active_match.host_user_id=p_user_id then 'host' else 'guest' end;
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
  if now()-queue_row.queued_at<interval '20 seconds' then raise exception 'ai_not_due'; end if;

  select rating into my_rating from public.checkers_ratings where user_id=p_user_id;
  my_rating:=coalesce(my_rating,queue_row.rating_snapshot,1200);

  select u.id,u.display_name,u.provider_user_id,r.rating into bot
  from public.users u
  join public.checkers_ratings r on r.user_id=u.id
  where u.is_ai=true
    and u.ai_enabled=true
    and u.provider='ai'
    and u.provider_user_id='temur'
  limit 1;
  if not found then raise exception 'ai_not_found'; end if;

  human_is_host:=random()<0.5;
  my_role:=case when human_is_host then 'host' else 'guest' end;
  ai_role:=case when human_is_host then 'guest' else 'host' end;

  insert into public.duels (
    host_user_id,guest_user_id,host_name,guest_name,status,host_ready,guest_ready,
    game_id,round_count,survival,difficulty,game_config,game_start_at,expires_at,
    checkers_mode,checkers_host_rating_before,checkers_guest_rating_before,
    checkers_turn,checkers_turn_deadline_at,checkers_position_history,
    opponent_type,ai_persona_id
  ) values (
    case when human_is_host then p_user_id else bot.id end,
    case when human_is_host then bot.id else p_user_id end,
    case when human_is_host then me.display_name else bot.display_name end,
    case when human_is_host then bot.display_name else me.display_name end,
    'playing',true,true,'checkers',1,false,'very-hard',
    jsonb_build_object('ai',true,'aiRole',ai_role,'ratingImpact','full'),
    now(),now()+interval '30 minutes','rated',
    case when human_is_host then my_rating else bot.rating end,
    case when human_is_host then bot.rating else my_rating end,
    'host',now()+interval '60 seconds',
    '{"bbbbbbbbbbbb........wwwwwwwwwwww:host":1}'::jsonb,
    'ai','temur'
  ) returning * into created;

  update public.checkers_matchmaking_queue
  set status='matched',duel_id=created.id,role=my_role,updated_at=now()
  where user_id=p_user_id;
  update public.checkers_match_offers
  set status='cancelled',responded_at=now()
  where seeker_user_id=p_user_id and status='pending';

  return jsonb_build_object(
    'state','matched',
    'queuedAt',extract(epoch from queue_row.queued_at)*1000,
    'expandedRange',500,'duelId',created.id,'role',my_role,
    'opponentName','Temur','opponentType','ai','opponentRating',bot.rating
  );
end;
$$;

revoke all on function public.create_checkers_ai_match(uuid)
  from public,anon,authenticated;
grant execute on function public.create_checkers_ai_match(uuid) to service_role;

-- Eski Edge Function deployi qisqa vaqt ishlasa ham AI ELOsini qaytarmasin.
create or replace function public.normalize_ai_checkers_rating(p_duel_id uuid)
returns public.duels language plpgsql security definer set search_path=public
as $$
declare d public.duels;
begin
  select * into d from public.duels where id=p_duel_id;
  return d;
end;
$$;

revoke all on function public.normalize_ai_checkers_rating(uuid)
  from public,anon,authenticated;
grant execute on function public.normalize_ai_checkers_rating(uuid) to service_role;

create or replace function public.accept_checkers_match_offer(
  p_offer_id uuid,
  p_target_user_id uuid
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  offer public.checkers_match_offers;
  seeker public.users;
  target public.users;
  seeker_rating integer;
  target_rating integer;
  created public.duels;
  existing public.duels;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_offer_id::text,0));

  select * into offer from public.checkers_match_offers
  where id=p_offer_id and target_user_id=p_target_user_id
  for update;
  if not found then raise exception 'offer_not_found'; end if;

  -- Javob tarmoqda yo‘qolib, foydalanuvchi qayta bossa ham o‘sha duel qaytadi.
  if offer.status='accepted' and offer.duel_id is not null then
    select * into existing from public.duels where id=offer.duel_id;
    if found and existing.status in ('invited','ready_check','countdown','playing') then
      return jsonb_build_object(
        'duelId',existing.id,'role','guest','opponentName',existing.host_name
      );
    end if;
  end if;

  if offer.status<>'pending' or offer.expires_at<=now() then
    raise exception 'offer_expired';
  end if;

  select * into seeker from public.users where id=offer.seeker_user_id;
  select * into target from public.users where id=offer.target_user_id;
  if seeker.id is null or target.id is null then raise exception 'user_not_found'; end if;

  update public.duels set status='expired',finished_at=coalesce(finished_at,now())
  where game_id='checkers'
    and status in ('invited','ready_check','countdown','playing')
    and expires_at<=now()
    and (
      host_user_id in (seeker.id,target.id)
      or guest_user_id in (seeker.id,target.id)
    );

  select * into existing from public.duels
  where game_id='checkers'
    and status in ('invited','ready_check','countdown','playing')
    and (
      (host_user_id=seeker.id and guest_user_id=target.id)
      or (host_user_id=target.id and guest_user_id=seeker.id)
    )
  order by created_at desc limit 1;
  if found then
    update public.checkers_match_offers
    set status='accepted',duel_id=existing.id,responded_at=now(),
        seeker_notified_at=null
    where id=offer.id;
    return jsonb_build_object(
      'duelId',existing.id,
      'role',case when existing.host_user_id=target.id then 'host' else 'guest' end,
      'opponentName',case when existing.host_user_id=target.id
        then existing.guest_name else existing.host_name end
    );
  end if;

  if exists (
    select 1 from public.duels
    where game_id='checkers'
      and status in ('invited','ready_check','countdown','playing')
      and (
        host_user_id in (seeker.id,target.id)
        or guest_user_id in (seeker.id,target.id)
      )
  ) then raise exception 'player_busy'; end if;

  select rating into seeker_rating from public.checkers_ratings where user_id=seeker.id;
  select rating into target_rating from public.checkers_ratings where user_id=target.id;

  insert into public.duels (
    host_user_id,guest_user_id,host_name,guest_name,status,host_ready,guest_ready,
    game_id,round_count,survival,difficulty,game_config,game_start_at,expires_at,
    checkers_mode,checkers_host_rating_before,checkers_guest_rating_before,
    checkers_turn,checkers_turn_deadline_at,checkers_position_history,opponent_type
  ) values (
    seeker.id,target.id,seeker.display_name,target.display_name,
    'playing',true,true,'checkers',1,false,'medium',
    jsonb_build_object('matchOfferId',offer.id),
    now(),now()+interval '30 minutes','rated',
    coalesce(seeker_rating,1200),coalesce(target_rating,1200),
    'host',now()+interval '60 seconds',
    '{"bbbbbbbbbbbb........wwwwwwwwwwww:host":1}'::jsonb,'human'
  ) returning * into created;

  update public.checkers_match_offers
  set status='accepted',duel_id=created.id,responded_at=now(),
      seeker_notified_at=null
  where id=offer.id;

  insert into public.checkers_matchmaking_queue (
    user_id,rating_snapshot,status,duel_id,role,queued_at,updated_at
  ) values (
    seeker.id,coalesce(seeker_rating,1200),'matched',created.id,'host',
    coalesce(
      (select queued_at from public.checkers_matchmaking_queue
       where user_id=seeker.id),now()
    ),now()
  )
  on conflict(user_id) do update set
    rating_snapshot=excluded.rating_snapshot,status='matched',
    duel_id=excluded.duel_id,role='host',updated_at=now();

  delete from public.checkers_matchmaking_queue
  where user_id=target.id and status='waiting';

  update public.checkers_match_offers
  set status='cancelled',responded_at=now()
  where status='pending' and id<>offer.id
    and (
      seeker_user_id in (seeker.id,target.id)
      or target_user_id in (seeker.id,target.id)
    );

  return jsonb_build_object(
    'duelId',created.id,'role','guest','opponentName',seeker.display_name
  );
end;
$$;

revoke all on function public.accept_checkers_match_offer(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.accept_checkers_match_offer(uuid,uuid)
  to service_role;

commit;
