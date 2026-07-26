-- ============================================================
-- AqlBand Reaksiya — users + friendships
-- Applied via: supabase db push
-- Idempotent: safe to re-run.
-- ============================================================

-- ---------- users ----------
-- Minimal identity registry: only what's needed to find and display a
-- player. No avatar, no last_name, no phone — intentionally, per product
-- decision. A row is created/updated (upsert) every time the Mini App
-- launches, via ensureUser().
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  username text,          -- Telegram @handle; nullable, not every user has one
  first_name text not null,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_users_telegram_id on public.users (telegram_id);
create index if not exists idx_users_username on public.users (lower(username));

alter table public.users enable row level security;

drop policy if exists "users are publicly readable" on public.users;
create policy "users are publicly readable"
  on public.users for select
  using (true);

drop policy if exists "anyone can create or update their user row" on public.users;
create policy "anyone can create or update their user row"
  on public.users for insert
  with check (true);

drop policy if exists "anyone can update a user row" on public.users;
create policy "anyone can update a user row"
  on public.users for update
  using (true);

-- ---------- friendships ----------
-- A single row represents a directed request. status='accepted' means both
-- sides are friends. Unfriending / declining / cancelling are all just a
-- DELETE — there's no need to keep history of ended friendships.
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users (id) on delete cascade,
  addressee_id uuid not null references public.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamp with time zone not null default now(),
  responded_at timestamp with time zone,
  constraint no_self_friendship check (requester_id <> addressee_id),
  constraint unique_pair unique (requester_id, addressee_id)
);

create index if not exists idx_friendships_requester on public.friendships (requester_id);
create index if not exists idx_friendships_addressee on public.friendships (addressee_id);
create index if not exists idx_friendships_status on public.friendships (status);

alter table public.friendships enable row level security;

drop policy if exists "friendships are publicly readable" on public.friendships;
create policy "friendships are publicly readable"
  on public.friendships for select
  using (true);

drop policy if exists "anyone can send a friend request" on public.friendships;
create policy "anyone can send a friend request"
  on public.friendships for insert
  with check (true);

drop policy if exists "anyone can update a friendship" on public.friendships;
create policy "anyone can update a friendship"
  on public.friendships for update
  using (true);

drop policy if exists "anyone can delete a friendship" on public.friendships;
create policy "anyone can delete a friendship"
  on public.friendships for delete
  using (true);

-- Note on RLS above: since this project has no server-side auth layer yet
-- (Telegram initData isn't verified server-side), these policies can't
-- actually restrict "only the real owner can act on their own row" — that
-- would require an Edge Function or Supabase Auth to establish a verified
-- identity. Same trade-off already accepted for the leaderboard table.
