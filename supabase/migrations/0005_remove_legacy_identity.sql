-- Remove Telegram-only duplicate fields after the provider-neutral migration.
-- Run after 0004_secure_accounts_history.sql and deploy the new frontend/API together.


-- Telegram usernames are unique and may move to another Telegram account.
with ranked_usernames as (
  select
    id,
    row_number() over (
      partition by lower(username)
      order by updated_at desc, created_at desc, id desc
    ) as duplicate_number
  from public.users
  where provider = 'telegram' and username is not null
)
update public.users u
set username = null
from ranked_usernames r
where u.id = r.id and r.duplicate_number > 1;

drop index if exists public.idx_users_username_lower;
create unique index if not exists idx_users_telegram_username_unique
  on public.users (lower(username))
  where provider = 'telegram' and username is not null;


-- Duel history keeps only game outcome data, never the opponent's profile name.
update public.game_attempts
set meta = meta - 'opponentName'
where game_id = 'duel-reaction' and meta ? 'opponentName';

-- Online history and ranking now live in game_attempts.
drop table if exists public.leaderboard cascade;

alter table public.duels drop column if exists host_telegram_id;
alter table public.duels drop column if exists guest_telegram_id;

alter table public.users drop column if exists telegram_id;
alter table public.users drop column if exists first_name;

-- The old public Realtime publication is no longer used by the client.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'duels'
  ) then
    alter publication supabase_realtime drop table public.duels;
  end if;
end $$;

-- Deleting a Google Auth user also deletes the matching app account; all
-- related history, friendships and duels then cascade from public.users.
create or replace function public.delete_google_app_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.users
  where provider = 'google' and provider_user_id = old.id::text;
  return old;
end;
$$;

drop trigger if exists auth_user_delete_app_account on auth.users;
create trigger auth_user_delete_app_account
after delete on auth.users
for each row execute function public.delete_google_app_account();

revoke all on function public.delete_google_app_account() from public, anon, authenticated;
