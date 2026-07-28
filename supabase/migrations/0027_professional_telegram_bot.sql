-- Checkers Online professional Telegram bot foundation.
-- Safe to run more than once.

create table if not exists public.bot_user_settings (
  telegram_id bigint primary key,
  language text not null default 'uz'
    check (language in ('uz', 'ru', 'en')),
  game_invites boolean not null default true,
  friend_requests boolean not null default true,
  daily_reminders boolean not null default true,
  tournament_news boolean not null default true,
  achievement_news boolean not null default true,
  product_news boolean not null default false,
  quiet_hours_start smallint not null default 22
    check (quiet_hours_start between 0 and 23),
  quiet_hours_end smallint not null default 8
    check (quiet_hours_end between 0 and 23),
  bot_blocked boolean not null default false,
  last_interaction_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bot_referrals (
  invited_telegram_id bigint primary key,
  inviter_telegram_id bigint not null,
  status text not null default 'started'
    check (status in ('started', 'qualified', 'rewarded', 'rejected')),
  qualified_at timestamptz,
  rewarded_at timestamptz,
  created_at timestamptz not null default now(),
  check (invited_telegram_id <> inviter_telegram_id)
);

create index if not exists idx_bot_referrals_inviter
  on public.bot_referrals(inviter_telegram_id, status);

create table if not exists public.bot_processed_updates (
  update_id bigint primary key,
  processed_at timestamptz not null default now()
);

create table if not exists public.bot_admin_audit (
  id bigint generated always as identity primary key,
  admin_telegram_id bigint not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.bot_notification_outbox (
  id bigint generated always as identity primary key,
  telegram_id bigint not null,
  kind text not null
    check (kind in ('game_invite', 'friend_request', 'daily', 'tournament',
                    'achievement', 'rating', 'system')),
  dedupe_key text unique,
  text_uz text not null,
  text_ru text,
  text_en text,
  start_parameter text,
  not_before timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  attempts smallint not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_bot_outbox_pending
  on public.bot_notification_outbox(not_before, id)
  where status = 'pending';

create table if not exists public.bot_tournaments (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 80),
  status text not null default 'registration'
    check (status in ('draft', 'registration', 'playing', 'finished', 'cancelled')),
  capacity smallint not null default 16 check (capacity in (4, 8, 16, 32)),
  starts_at timestamptz not null,
  winner_user_id uuid references public.users(id) on delete set null,
  created_by_telegram_id bigint not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bot_tournament_participants (
  tournament_id uuid not null references public.bot_tournaments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  seed smallint,
  eliminated_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

alter table public.bot_user_settings enable row level security;
alter table public.bot_referrals enable row level security;
alter table public.bot_processed_updates enable row level security;
alter table public.bot_admin_audit enable row level security;
alter table public.bot_notification_outbox enable row level security;
alter table public.bot_tournaments enable row level security;
alter table public.bot_tournament_participants enable row level security;

revoke all on public.bot_user_settings from anon, authenticated;
revoke all on public.bot_referrals from anon, authenticated;
revoke all on public.bot_processed_updates from anon, authenticated;
revoke all on public.bot_admin_audit from anon, authenticated;
revoke all on public.bot_notification_outbox from anon, authenticated;
revoke all on public.bot_tournaments from anon, authenticated;
revoke all on public.bot_tournament_participants from anon, authenticated;

grant all on public.bot_user_settings to service_role;
grant all on public.bot_referrals to service_role;
grant all on public.bot_processed_updates to service_role;
grant all on public.bot_admin_audit to service_role;
grant all on public.bot_notification_outbox to service_role;
grant all on public.bot_tournaments to service_role;
grant all on public.bot_tournament_participants to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Old webhook update ids do not need permanent storage.
create or replace function public.cleanup_bot_processed_updates()
returns void language sql security definer set search_path = public as $$
  delete from public.bot_processed_updates
  where processed_at < now() - interval '7 days';
$$;

revoke all on function public.cleanup_bot_processed_updates() from public, anon, authenticated;
grant execute on function public.cleanup_bot_processed_updates() to service_role;
