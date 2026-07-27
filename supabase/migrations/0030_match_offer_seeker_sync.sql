-- Checkers Online: passive taklif qabul qilinganda qidirayotgan o‘yinchini
-- qidiruv ekranida qoldirib ketmaslik.
-- 0029_random_ai_side.sql dan keyin SQL Editor orqali bir marta bajaring.

create or replace function public.accept_checkers_match_offer(
  p_offer_id uuid,
  p_target_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  offer public.checkers_match_offers;
  seeker public.users;
  target public.users;
  seeker_rating integer;
  target_rating integer;
  created public.duels;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_offer_id::text, 0));

  select * into offer
  from public.checkers_match_offers
  where id=p_offer_id
    and target_user_id=p_target_user_id
    and status='pending'
  for update;

  if not found or offer.expires_at <= now() then
    raise exception 'offer_expired';
  end if;

  select * into seeker from public.users where id=offer.seeker_user_id;
  select * into target from public.users where id=offer.target_user_id;
  if seeker.id is null or target.id is null then
    raise exception 'user_not_found';
  end if;

  -- Qabul qilish bosilgan paytda tomonlardan biri boshqa faol o‘yinga kirgan
  -- bo‘lsa, ikkinchi duel yaratmaymiz.
  if exists (
    select 1 from public.duels
    where game_id='checkers'
      and status in ('invited','ready_check','countdown','playing')
      and (
        host_user_id in (seeker.id,target.id)
        or guest_user_id in (seeker.id,target.id)
      )
  ) then
    raise exception 'player_busy';
  end if;

  select rating into seeker_rating
  from public.checkers_ratings where user_id=seeker.id;
  select rating into target_rating
  from public.checkers_ratings where user_id=target.id;

  insert into public.duels (
    host_user_id,guest_user_id,host_name,guest_name,status,host_ready,guest_ready,
    game_id,round_count,survival,difficulty,game_config,game_start_at,expires_at,
    checkers_mode,checkers_host_rating_before,checkers_guest_rating_before,
    checkers_turn,checkers_turn_deadline_at,checkers_position_history,
    opponent_type
  ) values (
    seeker.id,target.id,seeker.display_name,target.display_name,
    'playing',true,true,'checkers',1,false,'medium',
    jsonb_build_object('matchOfferId',offer.id),
    now(),now()+interval '30 minutes','rated',
    coalesce(seeker_rating,1200),coalesce(target_rating,1200),
    'host',now()+interval '60 seconds',
    '{"bbbbbbbbbbbb........wwwwwwwwwwww:host":1}'::jsonb,
    'human'
  ) returning * into created;

  update public.checkers_match_offers
  set status='accepted',duel_id=created.id,responded_at=now(),
      seeker_notified_at=null
  where id=offer.id;

  -- Muhim: seeker qatori o‘chirilmaydi. Temurning polling so‘rovi aynan shu
  -- qator orqali duelId va host rolini oladi.
  insert into public.checkers_matchmaking_queue (
    user_id,rating_snapshot,status,duel_id,role,queued_at,updated_at
  ) values (
    seeker.id,coalesce(seeker_rating,1200),'matched',created.id,'host',
    coalesce(
      (select queued_at from public.checkers_matchmaking_queue
       where user_id=seeker.id),
      now()
    ),
    now()
  )
  on conflict (user_id) do update set
    rating_snapshot=excluded.rating_snapshot,
    status='matched',
    duel_id=excluded.duel_id,
    role='host',
    updated_at=now();

  -- Target boshqa qidiruvni ham ochgan bo‘lsa, uning eski waiting qatori
  -- yangi duelga xalaqit bermasligi uchun faqat target qatori tozalanadi.
  delete from public.checkers_matchmaking_queue
  where user_id=target.id and status='waiting';

  update public.checkers_match_offers
  set status='cancelled',responded_at=now()
  where status='pending'
    and id<>offer.id
    and (
      seeker_user_id in (seeker.id,target.id)
      or target_user_id in (seeker.id,target.id)
    );

  return jsonb_build_object(
    'duelId',created.id,
    'role','guest',
    'opponentName',seeker.display_name
  );
end;
$$;

revoke all on function public.accept_checkers_match_offer(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.accept_checkers_match_offer(uuid,uuid)
  to service_role;
