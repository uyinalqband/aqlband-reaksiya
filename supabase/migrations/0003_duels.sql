-- ============================================================
-- AqlBand Reaksiya — real-time 1v1 duels
-- Applied via: supabase db push
-- Idempotent: safe to re-run.
-- ============================================================

create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  host_telegram_id bigint not null,
  host_name text not null,
  guest_telegram_id bigint,
  guest_name text,
  status text not null default 'waiting' check (status in ('waiting', 'ready_check', 'countdown', 'finished')),
  host_ready boolean not null default false,
  guest_ready boolean not null default false,
  countdown_start_at timestamp with time zone,
  host_time_ms integer,
  guest_time_ms integer,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_duels_host on public.duels (host_telegram_id);
create index if not exists idx_duels_guest on public.duels (guest_telegram_id);
create index if not exists idx_duels_status on public.duels (status);

alter table public.duels enable row level security;

drop policy if exists "duels are publicly readable" on public.duels;
create policy "duels are publicly readable"
  on public.duels for select
  using (true);

drop policy if exists "anyone can create a duel" on public.duels;
create policy "anyone can create a duel"
  on public.duels for insert
  with check (true);

drop policy if exists "anyone can update a duel" on public.duels;
create policy "anyone can update a duel"
  on public.duels for update
  using (true);

-- Enable Supabase Realtime change broadcasts for this table — required for
-- both players' clients to see status/ready/time updates live without
-- polling. `alter publication ... add table` errors if run twice, so this
-- is wrapped in an existence check to keep the whole migration idempotent.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'duels'
  ) then
    alter publication supabase_realtime add table public.duels;
  end if;
end $$;
