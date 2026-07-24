-- ============================================================
-- AqlBand — direct friend game invitations and shared lobby
-- - The inviter chooses the game, rounds and difficulty.
-- - The invited player accepts or rejects from the home screen.
-- - Both players have 20 seconds to press "Tayyorman".
-- - When both are ready, the same 5-second countdown starts.
-- Safe to re-run.
-- ============================================================

alter table public.duels
  add column if not exists game_id text not null default 'reaction',
  add column if not exists round_count smallint not null default 5,
  add column if not exists survival boolean not null default false,
  add column if not exists difficulty text not null default 'medium',
  add column if not exists invited_at timestamp with time zone not null default now(),
  add column if not exists responded_at timestamp with time zone,
  add column if not exists ready_deadline_at timestamp with time zone,
  add column if not exists game_start_at timestamp with time zone,
  add column if not exists cancelled_at timestamp with time zone,
  add column if not exists cancelled_by uuid;

alter table public.duels
  drop constraint if exists duels_game_id_check;
alter table public.duels
  add constraint duels_game_id_check
  check (game_id in ('reaction', 'emoji-find', 'number-memory', 'stroop-test'));

alter table public.duels
  drop constraint if exists duels_round_count_check;
alter table public.duels
  add constraint duels_round_count_check
  check (round_count between 1 and 10);

alter table public.duels
  drop constraint if exists duels_difficulty_check;
alter table public.duels
  add constraint duels_difficulty_check
  check (difficulty in ('easy', 'medium', 'hard', 'very-hard', 'progressive'));

alter table public.duels
  drop constraint if exists duels_status_check;
alter table public.duels
  add constraint duels_status_check
  check (
    status in (
      'waiting',
      'invited',
      'ready_check',
      'countdown',
      'playing',
      'finished',
      'expired',
      'cancelled'
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'duels_cancelled_by_fkey'
      and conrelid = 'public.duels'::regclass
  ) then
    alter table public.duels
      add constraint duels_cancelled_by_fkey
      foreign key (cancelled_by)
      references public.users(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_duels_guest_status_created
  on public.duels(guest_user_id, status, created_at desc);

create index if not exists idx_duels_participants_active
  on public.duels(host_user_id, guest_user_id, status);

create index if not exists idx_duels_ready_deadline
  on public.duels(ready_deadline_at)
  where status = 'ready_check';

-- Old link-based rows remain valid. New direct invitations use status='invited'.
update public.duels
set
  game_id = coalesce(game_id, 'reaction'),
  round_count = coalesce(round_count, 5),
  survival = coalesce(survival, false),
  difficulty = coalesce(difficulty, 'medium'),
  invited_at = coalesce(invited_at, created_at)
where true;

revoke all on table public.duels from anon, authenticated;
