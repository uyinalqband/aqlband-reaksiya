-- Checkers appearance packs.
-- The selected value lives on the player profile. A duel stores a snapshot of
-- the black player's selection so both clients render the same board and pieces.

alter table public.users
  add column if not exists selected_checkers_skin text not null default 'classic';

alter table public.duels
  add column if not exists checkers_skin_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_selected_checkers_skin_format'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_selected_checkers_skin_format
      check (selected_checkers_skin ~ '^[a-z0-9-]{1,40}$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'duels_checkers_skin_id_format'
      and conrelid = 'public.duels'::regclass
  ) then
    alter table public.duels
      add constraint duels_checkers_skin_id_format
      check (
        checkers_skin_id is null
        or checkers_skin_id ~ '^[a-z0-9-]{1,40}$'
      );
  end if;
end
$$;

comment on column public.users.selected_checkers_skin is
  'The checkers appearance pack selected in Profile.';

comment on column public.duels.checkers_skin_id is
  'Immutable match snapshot of the black (guest) player selected skin.';

-- Preserve a stable appearance for active and historical games that predate
-- this migration. New rated games are locked by the API on their first read.
update public.duels as duel
set checkers_skin_id = coalesce(player.selected_checkers_skin, 'classic')
from public.users as player
where duel.game_id = 'checkers'
  and duel.guest_user_id = player.id
  and duel.checkers_skin_id is null;
