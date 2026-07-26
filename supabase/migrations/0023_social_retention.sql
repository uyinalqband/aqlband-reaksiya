-- AqlBand V2.3 — presence, passive match offers and in-game reactions.
-- Safe to re-run.

alter table public.users
  add column if not exists presence_status text not null default 'offline',
  add column if not exists last_seen_at timestamptz,
  add column if not exists accept_passive_invites boolean not null default true,
  add column if not exists ai_fallback_seconds integer not null default 20,
  add column if not exists is_ai boolean not null default false;

alter table public.users drop constraint if exists users_provider_check;
alter table public.users add constraint users_provider_check
  check (provider in ('telegram', 'google', 'ai'));

alter table public.users drop constraint if exists users_presence_status_check;
alter table public.users add constraint users_presence_status_check
  check (presence_status in ('offline', 'available', 'dnd', 'in_game'));
alter table public.users drop constraint if exists users_ai_fallback_seconds_check;
alter table public.users add constraint users_ai_fallback_seconds_check
  check (ai_fallback_seconds between 10 and 90);

alter table public.duels
  add column if not exists opponent_type text not null default 'human',
  add column if not exists ai_persona_id text,
  add column if not exists host_reaction text,
  add column if not exists guest_reaction text,
  add column if not exists host_reaction_at timestamptz,
  add column if not exists guest_reaction_at timestamptz;

alter table public.duels drop constraint if exists duels_opponent_type_check;
alter table public.duels add constraint duels_opponent_type_check
  check (opponent_type in ('human', 'ai'));

create table if not exists public.checkers_match_offers (
  id uuid primary key default gen_random_uuid(),
  seeker_user_id uuid not null references public.users(id) on delete cascade,
  target_user_id uuid not null references public.users(id) on delete cascade,
  seeker_rating integer not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  duel_id uuid references public.duels(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '18 seconds'),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (seeker_user_id <> target_user_id)
);

create unique index if not exists idx_match_offers_one_target
  on public.checkers_match_offers(target_user_id)
  where status = 'pending';
create unique index if not exists idx_match_offers_one_seeker
  on public.checkers_match_offers(seeker_user_id)
  where status = 'pending';
create index if not exists idx_users_presence
  on public.users(presence_status, last_seen_at)
  where accept_passive_invites = true and is_ai = false;

alter table public.checkers_match_offers enable row level security;
revoke all on public.checkers_match_offers from anon, authenticated;
grant all on public.checkers_match_offers to service_role;

-- Reactions are intentionally ephemeral: clear them when a new match is made.
comment on column public.duels.host_reaction is
  'Last whitelisted live-game emoji from host; client uses timestamp for animation.';
comment on column public.users.accept_passive_invites is
  'Allows a non-interruptive incoming rated-match card while browsing the app.';

insert into public.users (
  provider, provider_user_id, display_name, username, first_name, is_ai
) values
  ('ai', 'temur', 'Temur', null, 'Temur', true),
  ('ai', 'nilufar', 'Nilufar', null, 'Nilufar', true),
  ('ai', 'jasur', 'Jasur', null, 'Jasur', true),
  ('ai', 'madina', 'Madina', null, 'Madina', true),
  ('ai', 'sardor', 'Sardor', null, 'Sardor', true),
  ('ai', 'aziza', 'Aziza', null, 'Aziza', true)
on conflict (provider, provider_user_id) do update
set display_name = excluded.display_name, is_ai = true;

insert into public.checkers_ratings(user_id, rating, peak_rating)
select id,
  1320 + (row_number() over (order by provider_user_id) * 85)::integer,
  1320 + (row_number() over (order by provider_user_id) * 85)::integer
from public.users
where provider = 'ai'
on conflict (user_id) do nothing;

create or replace function public.create_checkers_ai_match(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.users;
  bot record;
  my_rating integer;
  created public.duels;
begin
  select * into me from public.users where id = p_user_id;
  if not found then raise exception 'user_not_found'; end if;

  select rating into my_rating
  from public.checkers_ratings where user_id = p_user_id;
  my_rating := coalesce(my_rating, 1200);

  select u.id, u.display_name, u.provider_user_id, r.rating
  into bot
  from public.users u
  join public.checkers_ratings r on r.user_id = u.id
  where u.is_ai = true
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
  ) returning * into created;

  update public.checkers_matchmaking_queue
  set status='matched', duel_id=created.id, role='host', updated_at=now()
  where user_id=p_user_id;

  return jsonb_build_object(
    'state','matched', 'queuedAt',null, 'expandedRange',500,
    'duelId',created.id, 'role','host', 'opponentName',bot.display_name,
    'opponentType','ai', 'opponentRating',bot.rating
  );
end;
$$;

revoke all on function public.create_checkers_ai_match(uuid)
  from public, anon, authenticated;
grant execute on function public.create_checkers_ai_match(uuid) to service_role;

create or replace function public.accept_checkers_match_offer(
  p_offer_id uuid, p_target_user_id uuid
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
begin
  select * into offer from public.checkers_match_offers
  where id=p_offer_id and target_user_id=p_target_user_id and status='pending'
  for update;
  if not found or offer.expires_at <= now() then raise exception 'offer_expired'; end if;
  select * into seeker from public.users where id=offer.seeker_user_id;
  select * into target from public.users where id=offer.target_user_id;
  select rating into seeker_rating from public.checkers_ratings where user_id=seeker.id;
  select rating into target_rating from public.checkers_ratings where user_id=target.id;

  insert into public.duels (
    host_user_id,guest_user_id,host_name,guest_name,status,host_ready,guest_ready,
    game_id,round_count,survival,difficulty,game_config,game_start_at,expires_at,
    checkers_mode,checkers_host_rating_before,checkers_guest_rating_before,
    checkers_turn,checkers_turn_deadline_at,checkers_position_history
  ) values (
    seeker.id,target.id,seeker.display_name,target.display_name,'playing',true,true,
    'checkers',1,false,'medium','{}'::jsonb,now(),now()+interval '30 minutes',
    'rated',coalesce(seeker_rating,1200),coalesce(target_rating,1200),
    'host',now()+interval '60 seconds',
    '{"bbbbbbbbbbbb........wwwwwwwwwwww:host":1}'::jsonb
  ) returning * into created;

  update public.checkers_match_offers set status='accepted',duel_id=created.id,
    responded_at=now() where id=offer.id;
  delete from public.checkers_matchmaking_queue
    where user_id in (seeker.id,target.id);
  return jsonb_build_object(
    'duelId',created.id,'role','guest','opponentName',seeker.display_name
  );
end;
$$;
revoke all on function public.accept_checkers_match_offer(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.accept_checkers_match_offer(uuid,uuid)
  to service_role;
