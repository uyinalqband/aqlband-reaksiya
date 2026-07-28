-- Checkers Online support inbox and daily/weekly champion announcements.
-- Safe to run more than once.

alter table public.users
  add column if not exists avatar text not null default '🧠';

alter table public.users drop constraint if exists users_avatar_check;
alter table public.users add constraint users_avatar_check check (
  avatar in ('🧠','⚡','🚀','🦊','🐼','🦁','🐯','🦉','🤖','👾','🎯','🏆')
);

create table if not exists public.bot_support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_telegram_id bigint not null,
  user_name text not null,
  status text not null default 'open'
    check (status in ('open', 'answered', 'closed')),
  last_user_message_at timestamptz not null default now(),
  last_admin_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bot_support_tickets_status
  on public.bot_support_tickets(status, updated_at desc);

create table if not exists public.bot_support_messages (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.bot_support_tickets(id) on delete cascade,
  sender text not null check (sender in ('user', 'admin')),
  sender_telegram_id bigint not null,
  message_text text not null check (char_length(message_text) between 1 and 3500),
  telegram_message_id bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.bot_conversation_state (
  telegram_id bigint primary key,
  mode text not null check (mode in ('awaiting_support', 'awaiting_admin_reply')),
  ticket_id uuid references public.bot_support_tickets(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  updated_at timestamptz not null default now()
);

create table if not exists public.bot_announcement_runs (
  period_key text primary key,
  kind text not null check (kind in ('daily', 'weekly')),
  champion_user_id uuid not null references public.users(id) on delete cascade,
  wins integer not null check (wins > 0),
  announced_at timestamptz not null default now()
);

alter table public.bot_support_tickets enable row level security;
alter table public.bot_support_messages enable row level security;
alter table public.bot_conversation_state enable row level security;
alter table public.bot_announcement_runs enable row level security;

revoke all on public.bot_support_tickets from anon, authenticated;
revoke all on public.bot_support_messages from anon, authenticated;
revoke all on public.bot_conversation_state from anon, authenticated;
revoke all on public.bot_announcement_runs from anon, authenticated;

grant all on public.bot_support_tickets to service_role;
grant all on public.bot_support_messages to service_role;
grant all on public.bot_conversation_state to service_role;
grant all on public.bot_announcement_runs to service_role;
grant usage, select on all sequences in schema public to service_role;

