-- Repairs partially applied older migrations used by match-offer acceptance.
-- Safe to run repeatedly. No user, rating or game data is deleted.

begin;

alter table public.users
  add column if not exists selected_checkers_skin text not null default 'classic',
  add column if not exists selected_checkers_piece_skin text not null default 'classic';

alter table public.duels
  add column if not exists host_user_id uuid references public.users(id) on delete cascade,
  add column if not exists guest_user_id uuid references public.users(id) on delete cascade,
  add column if not exists game_id text not null default 'reaction',
  add column if not exists round_count smallint not null default 1,
  add column if not exists survival boolean not null default false,
  add column if not exists difficulty text not null default 'medium',
  add column if not exists game_config jsonb not null default '{}'::jsonb,
  add column if not exists game_start_at timestamptz,
  add column if not exists expires_at timestamptz not null default (now() + interval '30 minutes'),
  add column if not exists finished_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists checkers_mode text not null default 'friendly',
  add column if not exists checkers_host_rating_before integer,
  add column if not exists checkers_guest_rating_before integer,
  add column if not exists checkers_turn text not null default 'host',
  add column if not exists checkers_turn_deadline_at timestamptz,
  add column if not exists checkers_moves integer not null default 0,
  add column if not exists checkers_winner text,
  add column if not exists checkers_position_history jsonb not null
    default '{"bbbbbbbbbbbb........wwwwwwwwwwww:host":1}'::jsonb,
  add column if not exists opponent_type text not null default 'human',
  add column if not exists ai_persona_id text,
  add column if not exists checkers_host_skin text not null default 'classic',
  add column if not exists checkers_guest_skin text not null default 'classic',
  add column if not exists checkers_host_piece_skin text not null default 'classic',
  add column if not exists checkers_guest_piece_skin text not null default 'classic';

alter table public.checkers_match_offers
  add column if not exists duel_id uuid references public.duels(id) on delete set null,
  add column if not exists responded_at timestamptz,
  add column if not exists seeker_notified_at timestamptz,
  add column if not exists delivered_at timestamptz;

alter table public.checkers_matchmaking_queue
  add column if not exists rating_snapshot integer not null default 1200,
  add column if not exists status text not null default 'waiting',
  add column if not exists duel_id uuid references public.duels(id) on delete set null,
  add column if not exists role text,
  add column if not exists queued_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Make sure the two partial unique indexes required by the acceptance flow
-- exist after any interrupted migration.
create unique index if not exists idx_match_offers_one_target
  on public.checkers_match_offers(target_user_id)
  where status = 'pending';

create unique index if not exists idx_match_offers_one_seeker
  on public.checkers_match_offers(seeker_user_id)
  where status = 'pending';

commit;
