-- ============================================================
-- AqlBand Reaksiya — leaderboard table
-- Applied via: supabase db push
-- Idempotent: safe to re-run, will never error if already applied.
-- ============================================================

create extension if not exists pgcrypto; -- provides gen_random_uuid()

create table if not exists public.leaderboard (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  username text,
  first_name text not null,
  score integer not null check (score > 0 and score < 5000), -- reaction time in ms; lower is better
  created_at timestamp with time zone not null default now()
);

-- Best-score-first queries (leaderboard display)
create index if not exists idx_leaderboard_score
  on public.leaderboard (score asc);

-- Per-user lookups (personal best, personal history)
create index if not exists idx_leaderboard_telegram_id
  on public.leaderboard (telegram_id);

-- Row Level Security: table is public-readable and publicly insertable
-- (no auth backend yet — see security note in project README).
alter table public.leaderboard enable row level security;

drop policy if exists "leaderboard is publicly readable" on public.leaderboard;
create policy "leaderboard is publicly readable"
  on public.leaderboard for select
  using (true);

drop policy if exists "anyone can insert a score" on public.leaderboard;
create policy "anyone can insert a score"
  on public.leaderboard for insert
  with check (true);

-- No update/delete policy -> both are blocked by default under RLS.
-- Scores are immutable, append-only.
