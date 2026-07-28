-- Release 2.7: one Tashkent day, reliable offers/outbox, clean ratings and API throttling.

-- The UI promises a 10 second decision window. Keep the database authoritative.
alter table public.checkers_match_offers
  alter column expires_at set default (now() + interval '10 seconds');

update public.checkers_match_offers
set expires_at = least(expires_at, created_at + interval '10 seconds')
where status = 'pending';

-- Existing engagement functions explicitly used UTC. Recreate the exact same
-- functions with Asia/Tashkent as their calendar boundary.
do $timezone_fix$
declare
  signature regprocedure;
  definition text;
begin
  foreach signature in array array[
    'public.refresh_user_streak(uuid)'::regprocedure,
    'public.get_engagement_hub(uuid)'::regprocedure,
    'public.claim_daily_chest(uuid)'::regprocedure
  ]
  loop
    definition := pg_get_functiondef(signature);
    definition := replace(definition, '''UTC''', '''Asia/Tashkent''');
    definition := replace(
      definition,
      'date_trunc(''day'', now() AT TIME ZONE ''Asia/Tashkent''::text) + ''1 day''::interval',
      '(date_trunc(''day'', now() AT TIME ZONE ''Asia/Tashkent''::text) + ''1 day''::interval) AT TIME ZONE ''Asia/Tashkent''::text'
    );
    execute definition;
  end loop;

  if to_regprocedure('public.award_minigame_completion_xp_v31(uuid,text,text,text,timestamp with time zone)') is not null then
    definition := pg_get_functiondef(
      'public.award_minigame_completion_xp_v31(uuid,text,text,text,timestamp with time zone)'::regprocedure
    );
    execute replace(definition, '''UTC''', '''Asia/Tashkent''');
  end if;
end
$timezone_fix$;

-- A compact, database-backed limiter works across all Edge Function instances.
create table if not exists public.api_rate_limits (
  user_id uuid not null references public.users(id) on delete cascade,
  bucket text not null check (char_length(bucket) between 1 and 32),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, bucket)
);

alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon, authenticated;

create or replace function public.consume_api_rate_limit(
  p_user_id uuid,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.api_rate_limits%rowtype;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  insert into public.api_rate_limits(user_id, bucket, request_count)
  values (p_user_id, p_bucket, 1)
  on conflict (user_id, bucket) do nothing;

  select * into current_row
  from public.api_rate_limits
  where user_id = p_user_id and bucket = p_bucket
  for update;

  if current_row.window_started_at <= now() - make_interval(secs => p_window_seconds) then
    update public.api_rate_limits
    set window_started_at = now(), request_count = 1
    where user_id = p_user_id and bucket = p_bucket;
    return true;
  end if;

  if current_row.request_count >= p_limit then
    return false;
  end if;

  update public.api_rate_limits
  set request_count = request_count + 1
  where user_id = p_user_id and bucket = p_bucket;
  return true;
end;
$$;

revoke all on function public.consume_api_rate_limit(uuid,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(uuid,text,integer,integer)
  to service_role;

create index if not exists api_rate_limits_window_idx
  on public.api_rate_limits(window_started_at);

-- Old limiter rows have no long-term value.
delete from public.api_rate_limits
where window_started_at < now() - interval '1 day';
