-- ============================================================
-- AqlBand Checkers skins
--
-- Match ownership rule:
--   host  = white pieces = host's selected skin
--   guest = black pieces = guest's selected skin
--   board = guest/black player's selected skin
--
-- Skin ids are snapshotted into a duel at creation time. A later profile
-- change affects only future matches and cannot visually change a live game.
-- Safe to re-run.
-- ============================================================

create table if not exists public.checkers_skins (
  id text primary key,
  required_level integer not null default 1,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint checkers_skins_id_format check (
    id ~ '^[a-z][a-z0-9_-]{0,39}$'
  ),
  constraint checkers_skins_level_positive check (
    required_level >= 1
  )
);

insert into public.checkers_skins (
  id,
  required_level,
  sort_order,
  active
)
values
  ('classic', 1, 10, true),
  ('butterfly', 5, 20, true),
  ('dragon', 10, 30, true),
  ('obsidian', 20, 40, true)
on conflict (id) do update
set
  required_level = excluded.required_level,
  sort_order = excluded.sort_order,
  active = excluded.active;

alter table public.users
  add column if not exists selected_checkers_skin text not null
  default 'classic';

update public.users
set selected_checkers_skin = 'classic'
where selected_checkers_skin is null
   or not exists (
     select 1
     from public.checkers_skins skin
     where skin.id = public.users.selected_checkers_skin
   );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_selected_checkers_skin_fkey'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_selected_checkers_skin_fkey
      foreign key (selected_checkers_skin)
      references public.checkers_skins(id)
      on update cascade
      on delete set default;
  end if;
end;
$$;

alter table public.duels
  add column if not exists checkers_host_skin text not null
  default 'classic';

alter table public.duels
  add column if not exists checkers_guest_skin text not null
  default 'classic';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'duels_checkers_host_skin_fkey'
      and conrelid = 'public.duels'::regclass
  ) then
    alter table public.duels
      add constraint duels_checkers_host_skin_fkey
      foreign key (checkers_host_skin)
      references public.checkers_skins(id)
      on update cascade
      on delete set default;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'duels_checkers_guest_skin_fkey'
      and conrelid = 'public.duels'::regclass
  ) then
    alter table public.duels
      add constraint duels_checkers_guest_skin_fkey
      foreign key (checkers_guest_skin)
      references public.checkers_skins(id)
      on update cascade
      on delete set default;
  end if;
end;
$$;

create or replace function public.snapshot_checkers_skins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.game_id <> 'checkers' then
    return new;
  end if;

  select coalesce(u.selected_checkers_skin, 'classic')
  into new.checkers_host_skin
  from public.users u
  where u.id = new.host_user_id;

  new.checkers_host_skin := coalesce(
    new.checkers_host_skin,
    'classic'
  );

  if new.guest_user_id is null then
    new.checkers_guest_skin := 'classic';
  else
    select coalesce(u.selected_checkers_skin, 'classic')
    into new.checkers_guest_skin
    from public.users u
    where u.id = new.guest_user_id;

    new.checkers_guest_skin := coalesce(
      new.checkers_guest_skin,
      'classic'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_snapshot_checkers_skins
  on public.duels;

create trigger trg_snapshot_checkers_skins
before insert or update of
  host_user_id,
  guest_user_id,
  game_id
on public.duels
for each row
execute function public.snapshot_checkers_skins();

update public.duels duel
set
  checkers_host_skin = coalesce(
    (
      select host_user.selected_checkers_skin
      from public.users host_user
      where host_user.id = duel.host_user_id
    ),
    'classic'
  ),
  checkers_guest_skin = coalesce(
    (
      select guest_user.selected_checkers_skin
      from public.users guest_user
      where guest_user.id = duel.guest_user_id
    ),
    'classic'
  )
where duel.game_id = 'checkers'
  and duel.status in (
    'waiting',
    'invited',
    'ready_check',
    'countdown',
    'playing'
  );

alter table public.checkers_skins enable row level security;

revoke all on table public.checkers_skins
  from public, anon, authenticated;
grant all on table public.checkers_skins
  to service_role;

revoke all on function public.snapshot_checkers_skins()
  from public, anon, authenticated;
