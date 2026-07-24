-- ============================================================
-- Separate Checkers board and piece skins
--
-- Profile selection:
--   selected_checkers_skin       = board skin
--   selected_checkers_piece_skin = the player's own piece skin
--
-- Match ownership:
--   board        = guest/black player's board skin
--   white pieces = host/white player's piece skin
--   black pieces = guest/black player's piece skin
--
-- New emoji piece skins Flower and Wheel unlock at LEVEL 2.
-- Safe to re-run.
-- ============================================================

create table if not exists public.checkers_piece_skins (
  id text primary key,
  required_level integer not null default 1,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint checkers_piece_skins_id_format check (
    id ~ '^[a-z][a-z0-9_-]{0,39}$'
  ),
  constraint checkers_piece_skins_level_positive check (
    required_level >= 1
  )
);

insert into public.checkers_piece_skins (
  id,
  required_level,
  sort_order,
  active
)
values
  ('classic', 1, 10, true),
  ('flower', 2, 20, true),
  ('wheel', 2, 30, true)
on conflict (id) do update
set
  required_level = excluded.required_level,
  sort_order = excluded.sort_order,
  active = excluded.active;

alter table public.users
  add column if not exists selected_checkers_piece_skin text not null
  default 'classic';

update public.users
set selected_checkers_piece_skin = 'classic'
where selected_checkers_piece_skin is null
   or not exists (
     select 1
     from public.checkers_piece_skins skin
     where skin.id = public.users.selected_checkers_piece_skin
   );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_selected_checkers_piece_skin_fkey'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_selected_checkers_piece_skin_fkey
      foreign key (selected_checkers_piece_skin)
      references public.checkers_piece_skins(id)
      on update cascade
      on delete set default;
  end if;
end;
$$;

alter table public.duels
  add column if not exists checkers_host_piece_skin text not null
  default 'classic';

alter table public.duels
  add column if not exists checkers_guest_piece_skin text not null
  default 'classic';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'duels_checkers_host_piece_skin_fkey'
      and conrelid = 'public.duels'::regclass
  ) then
    alter table public.duels
      add constraint duels_checkers_host_piece_skin_fkey
      foreign key (checkers_host_piece_skin)
      references public.checkers_piece_skins(id)
      on update cascade
      on delete set default;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'duels_checkers_guest_piece_skin_fkey'
      and conrelid = 'public.duels'::regclass
  ) then
    alter table public.duels
      add constraint duels_checkers_guest_piece_skin_fkey
      foreign key (checkers_guest_piece_skin)
      references public.checkers_piece_skins(id)
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

  select
    coalesce(u.selected_checkers_skin, 'classic'),
    coalesce(u.selected_checkers_piece_skin, 'classic')
  into
    new.checkers_host_skin,
    new.checkers_host_piece_skin
  from public.users u
  where u.id = new.host_user_id;

  new.checkers_host_skin := coalesce(
    new.checkers_host_skin,
    'classic'
  );
  new.checkers_host_piece_skin := coalesce(
    new.checkers_host_piece_skin,
    'classic'
  );

  if new.guest_user_id is null then
    new.checkers_guest_skin := 'classic';
    new.checkers_guest_piece_skin := 'classic';
  else
    select
      coalesce(u.selected_checkers_skin, 'classic'),
      coalesce(u.selected_checkers_piece_skin, 'classic')
    into
      new.checkers_guest_skin,
      new.checkers_guest_piece_skin
    from public.users u
    where u.id = new.guest_user_id;

    new.checkers_guest_skin := coalesce(
      new.checkers_guest_skin,
      'classic'
    );
    new.checkers_guest_piece_skin := coalesce(
      new.checkers_guest_piece_skin,
      'classic'
    );
  end if;

  return new;
end;
$$;

update public.duels duel
set
  checkers_host_piece_skin = coalesce(
    (
      select host_user.selected_checkers_piece_skin
      from public.users host_user
      where host_user.id = duel.host_user_id
    ),
    'classic'
  ),
  checkers_guest_piece_skin = coalesce(
    (
      select guest_user.selected_checkers_piece_skin
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

alter table public.checkers_piece_skins enable row level security;

revoke all on table public.checkers_piece_skins
  from public, anon, authenticated;
grant all on table public.checkers_piece_skins
  to service_role;

revoke all on function public.snapshot_checkers_skins()
  from public, anon, authenticated;
