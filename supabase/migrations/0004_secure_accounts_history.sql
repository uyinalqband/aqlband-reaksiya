-- ============================================================
-- AqlBand platform core
-- - provider-neutral accounts (Telegram now, Google later)
-- - one server-side game history table
-- - account deletion cascades through every related table
-- - direct anonymous writes are closed
-- - scalable leaderboard RPCs
-- - duel ownership + expiry
-- Safe to re-run.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- provider-neutral user accounts ----------
alter table public.users add column if not exists provider text;
alter table public.users add column if not exists provider_user_id text;
alter table public.users add column if not exists display_name text;
alter table public.users add column if not exists updated_at timestamp with time zone not null default now();
alter table public.users add column if not exists history_generation uuid not null default gen_random_uuid();
alter table public.users add column if not exists history_cleared_at timestamp with time zone not null default '1970-01-01 00:00:00+00';

update public.users
set
  provider = coalesce(provider, 'telegram'),
  provider_user_id = coalesce(provider_user_id, telegram_id::text),
  display_name = coalesce(nullif(btrim(display_name), ''), nullif(btrim(first_name), ''), 'AqlBand'),
  updated_at = coalesce(updated_at, created_at, now())
where provider is null
   or provider_user_id is null
   or display_name is null
   or btrim(display_name) = '';

alter table public.users alter column provider set default 'telegram';
alter table public.users alter column provider set not null;
alter table public.users alter column provider_user_id set not null;
alter table public.users alter column display_name set not null;

-- Legacy Telegram-only columns are retained temporarily for rollback support,
-- but are nullable so future Google rows do not need fake Telegram data.
alter table public.users alter column telegram_id drop not null;
alter table public.users alter column first_name drop not null;

create unique index if not exists idx_users_provider_identity
  on public.users (provider, provider_user_id);
create index if not exists idx_users_username_lower
  on public.users (lower(username))
  where username is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_provider_check' and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_provider_check check (provider in ('telegram', 'google'));
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- ---------- ensure every legacy online score has an account ----------
insert into public.users (
  provider,
  provider_user_id,
  display_name,
  username,
  telegram_id,
  first_name
)
select
  'telegram',
  l.telegram_id::text,
  coalesce(nullif(max(l.first_name), ''), 'AqlBand'),
  max(l.username),
  l.telegram_id,
  coalesce(nullif(max(l.first_name), ''), 'AqlBand')
from public.leaderboard l
left join public.users u
  on u.provider = 'telegram' and u.provider_user_id = l.telegram_id::text
where u.id is null
group by l.telegram_id
on conflict (provider, provider_user_id) do nothing;

alter table public.leaderboard add column if not exists user_id uuid;
update public.leaderboard l
set user_id = u.id
from public.users u
where l.user_id is null
  and u.provider = 'telegram'
  and u.provider_user_id = l.telegram_id::text;

alter table public.leaderboard alter column user_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leaderboard_user_id_fkey' and conrelid = 'public.leaderboard'::regclass
  ) then
    alter table public.leaderboard
      add constraint leaderboard_user_id_fkey
      foreign key (user_id) references public.users(id) on delete cascade;
  end if;
end $$;

create index if not exists idx_leaderboard_user_id on public.leaderboard(user_id);

-- ---------- unified online game history ----------
create table if not exists public.game_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  history_generation uuid,
  client_attempt_id text not null,
  game_id text not null,
  metric text not null,
  value integer not null,
  meta jsonb not null default '{}'::jsonb,
  played_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  constraint game_attempts_user_client_unique unique (user_id, client_attempt_id),
  constraint game_attempts_game_check check (
    game_id in ('reaction', 'emoji-find', 'number-memory', 'stroop-test', 'duel-reaction')
  ),
  constraint game_attempts_metric_check check (
    metric in ('duration_ms', 'correct_count', 'score')
  )
);

alter table public.game_attempts add column if not exists history_generation uuid;
update public.game_attempts ga
set history_generation = u.history_generation
from public.users u
where ga.user_id = u.id and ga.history_generation is null;
alter table public.game_attempts alter column history_generation set not null;

create index if not exists idx_game_attempts_user_played
  on public.game_attempts(user_id, played_at desc);
create index if not exists idx_game_attempts_reaction_rank
  on public.game_attempts(value asc, played_at asc)
  where game_id = 'reaction' and metric = 'duration_ms';

-- Copy old reaction leaderboard rows once into the unified history.
insert into public.game_attempts (
  user_id,
  history_generation,
  client_attempt_id,
  game_id,
  metric,
  value,
  meta,
  played_at
)
select
  l.user_id,
  u.history_generation,
  'legacy-leaderboard-' || l.id::text,
  'reaction',
  'duration_ms',
  l.score,
  jsonb_build_object('mode', 'solo', 'source', 'legacy_leaderboard'),
  l.created_at
from public.leaderboard l
join public.users u on u.id = l.user_id
on conflict (user_id, client_attempt_id) do nothing;

-- ---------- friendships: prevent reversed duplicate pairs ----------
with ranked_pairs as (
  select
    id,
    row_number() over (
      partition by least(requester_id, addressee_id), greatest(requester_id, addressee_id)
      order by (status = 'accepted') desc, created_at asc, id asc
    ) as row_number_in_pair
  from public.friendships
)
delete from public.friendships f
using ranked_pairs r
where f.id = r.id and r.row_number_in_pair > 1;

create unique index if not exists idx_friendships_unordered_pair
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

-- ---------- duels: provider-neutral ownership and expiry ----------
insert into public.users (
  provider,
  provider_user_id,
  display_name,
  telegram_id,
  first_name
)
select distinct
  'telegram',
  d.host_telegram_id::text,
  coalesce(nullif(d.host_name, ''), 'AqlBand'),
  d.host_telegram_id,
  coalesce(nullif(d.host_name, ''), 'AqlBand')
from public.duels d
left join public.users u
  on u.provider = 'telegram' and u.provider_user_id = d.host_telegram_id::text
where u.id is null
on conflict (provider, provider_user_id) do nothing;

insert into public.users (
  provider,
  provider_user_id,
  display_name,
  telegram_id,
  first_name
)
select distinct
  'telegram',
  d.guest_telegram_id::text,
  coalesce(nullif(d.guest_name, ''), 'AqlBand'),
  d.guest_telegram_id,
  coalesce(nullif(d.guest_name, ''), 'AqlBand')
from public.duels d
left join public.users u
  on u.provider = 'telegram' and u.provider_user_id = d.guest_telegram_id::text
where d.guest_telegram_id is not null and u.id is null
on conflict (provider, provider_user_id) do nothing;

alter table public.duels add column if not exists host_user_id uuid;
alter table public.duels add column if not exists guest_user_id uuid;
alter table public.duels add column if not exists expires_at timestamp with time zone;
alter table public.duels add column if not exists updated_at timestamp with time zone not null default now();
alter table public.duels add column if not exists finished_at timestamp with time zone;

update public.duels d
set host_user_id = u.id
from public.users u
where d.host_user_id is null
  and u.provider = 'telegram'
  and u.provider_user_id = d.host_telegram_id::text;

update public.duels d
set guest_user_id = u.id
from public.users u
where d.guest_user_id is null
  and d.guest_telegram_id is not null
  and u.provider = 'telegram'
  and u.provider_user_id = d.guest_telegram_id::text;

update public.duels
set expires_at = coalesce(expires_at, created_at + interval '15 minutes');

alter table public.duels alter column host_user_id set not null;
alter table public.duels alter column expires_at set not null;
alter table public.duels alter column expires_at set default (now() + interval '15 minutes');

alter table public.duels drop constraint if exists duels_status_check;
alter table public.duels
  add constraint duels_status_check
  check (status in ('waiting', 'ready_check', 'countdown', 'finished', 'expired', 'cancelled'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'duels_host_user_id_fkey' and conrelid = 'public.duels'::regclass
  ) then
    alter table public.duels
      add constraint duels_host_user_id_fkey
      foreign key (host_user_id) references public.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'duels_guest_user_id_fkey' and conrelid = 'public.duels'::regclass
  ) then
    alter table public.duels
      add constraint duels_guest_user_id_fkey
      foreign key (guest_user_id) references public.users(id) on delete cascade;
  end if;
end $$;

create index if not exists idx_duels_host_user on public.duels(host_user_id);
create index if not exists idx_duels_guest_user on public.duels(guest_user_id);
create index if not exists idx_duels_expires_at on public.duels(expires_at);

drop trigger if exists duels_set_updated_at on public.duels;
create trigger duels_set_updated_at
before update on public.duels
for each row execute function public.set_updated_at();

-- ---------- scalable leaderboard functions ----------
create or replace function public.get_reaction_leaderboard(
  p_period text default 'global',
  p_limit integer default 100,
  p_user_ids uuid[] default null
)
returns table (
  user_id uuid,
  display_name text,
  username text,
  score integer,
  played_at timestamp with time zone,
  rank bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select
      ga.user_id,
      ga.value as score,
      ga.played_at,
      row_number() over (
        partition by ga.user_id
        order by ga.value asc, ga.played_at asc, ga.id asc
      ) as personal_row
    from public.game_attempts ga
    join public.users current_account
      on current_account.id = ga.user_id
     and current_account.history_generation = ga.history_generation
    where ga.game_id = 'reaction'
      and ga.metric = 'duration_ms'
      and coalesce(ga.meta->>'mode', 'solo') = 'solo'
      and (
        p_period = 'global'
        or (p_period = 'weekly' and ga.played_at >= date_trunc('week', now() at time zone 'utc') at time zone 'utc')
        or (p_period = 'monthly' and ga.played_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc')
      )
      and (p_user_ids is null or ga.user_id = any(p_user_ids))
  ),
  personal_best as (
    select user_id, score, played_at
    from eligible
    where personal_row = 1
  ),
  ranked as (
    select
      pb.*,
      row_number() over (order by pb.score asc, pb.played_at asc, pb.user_id asc) as rank
    from personal_best pb
  )
  select
    r.user_id,
    u.display_name,
    u.username,
    r.score,
    r.played_at,
    r.rank
  from ranked r
  join public.users u on u.id = r.user_id
  order by r.rank
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;

create or replace function public.get_reaction_rank(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select
      ga.user_id,
      ga.value as score,
      ga.played_at,
      ga.id,
      row_number() over (
        partition by ga.user_id
        order by ga.value asc, ga.played_at asc, ga.id asc
      ) as personal_row
    from public.game_attempts ga
    join public.users current_account
      on current_account.id = ga.user_id
     and current_account.history_generation = ga.history_generation
    where ga.game_id = 'reaction'
      and ga.metric = 'duration_ms'
      and coalesce(ga.meta->>'mode', 'solo') = 'solo'
  ),
  personal_best as (
    select user_id, score, played_at
    from eligible
    where personal_row = 1
  ),
  ranked as (
    select
      user_id,
      row_number() over (order by score asc, played_at asc, user_id asc) as rank
    from personal_best
  )
  select rank from ranked where user_id = p_user_id;
$$;

revoke all on function public.get_reaction_leaderboard(text, integer, uuid[]) from public, anon, authenticated;
revoke all on function public.get_reaction_rank(uuid) from public, anon, authenticated;
grant execute on function public.get_reaction_leaderboard(text, integer, uuid[]) to service_role;
grant execute on function public.get_reaction_rank(uuid) to service_role;

-- ---------- close all direct anonymous writes ----------
alter table public.users enable row level security;
alter table public.friendships enable row level security;
alter table public.game_attempts enable row level security;
alter table public.leaderboard enable row level security;
alter table public.duels enable row level security;

-- Remove legacy open policies.
drop policy if exists "users are publicly readable" on public.users;
drop policy if exists "anyone can create or update their user row" on public.users;
drop policy if exists "anyone can update a user row" on public.users;
drop policy if exists "friendships are publicly readable" on public.friendships;
drop policy if exists "anyone can send a friend request" on public.friendships;
drop policy if exists "anyone can update a friendship" on public.friendships;
drop policy if exists "anyone can delete a friendship" on public.friendships;
drop policy if exists "leaderboard is publicly readable" on public.leaderboard;
drop policy if exists "anyone can insert a score" on public.leaderboard;
drop policy if exists "duels are publicly readable" on public.duels;
drop policy if exists "anyone can create a duel" on public.duels;
drop policy if exists "anyone can update a duel" on public.duels;

revoke all on table public.users from anon, authenticated;
revoke all on table public.friendships from anon, authenticated;
revoke all on table public.game_attempts from anon, authenticated;
revoke all on table public.leaderboard from anon, authenticated;
revoke all on table public.duels from anon, authenticated;

-- Duel reads and writes now go through the verified Edge Function.
drop policy if exists "recent duels are readable by invite id" on public.duels;
