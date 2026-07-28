-- Checkers Online V3.2 — Shashka masalalari va xavfsiz XP mukofoti.
-- 0031 dan keyin bir marta bajaring.

begin;

alter table public.xp_events drop constraint if exists xp_events_game_check;
alter table public.xp_events add constraint xp_events_game_check check (
  game_id in (
    'checkers','tic-tac-toe','reaction','emoji-find','number-memory',
    'stroop-test','ascending-numbers','odd-one-out','pattern-memory',
    'go-no-go','mental-math','sequence-memory','card-memory',
    'time-estimation','peripheral-vision','twenty-four','dual-n-back',
    'fifteen-puzzle','sudoku','duel-reaction','checkers-puzzle'
  )
);

do $$
begin
  if to_regprocedure(
    'public.award_minigame_completion_xp_v31(uuid,text,text,text,timestamp with time zone)'
  ) is null then
    alter function public.award_minigame_completion_xp(
      uuid,text,text,text,timestamp with time zone
    ) rename to award_minigame_completion_xp_v31;
  end if;
end;
$$;

create or replace function public.award_minigame_completion_xp(
  p_user_id uuid,
  p_completion_id text,
  p_game_id text,
  p_outcome text,
  p_played_at timestamp with time zone
) returns integer
language plpgsql security definer set search_path=public
as $$
declare
  safe_played_at timestamptz:=coalesce(p_played_at,now());
  day_start timestamptz;
  day_end timestamptz;
  game_count integer:=0;
  total_count integer:=0;
  today_xp integer:=0;
  multiplier integer:=0;
  daily_bonus integer:=0;
  variety_bonus integer:=0;
  final_xp integer:=0;
begin
  if p_game_id<>'checkers-puzzle' then
    return public.award_minigame_completion_xp_v31(
      p_user_id,p_completion_id,p_game_id,p_outcome,p_played_at
    );
  end if;

  if p_completion_id is null or btrim(p_completion_id)=''
    or length(p_completion_id)>100 then return 0; end if;
  if safe_played_at>now()+interval '5 minutes'
    or safe_played_at<now()-interval '365 days' then return 0; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  select awarded_xp into final_xp from public.xp_events
  where user_id=p_user_id and client_attempt_id=p_completion_id;
  if found then return coalesce(final_xp,0); end if;

  day_start:=date_trunc('day',safe_played_at at time zone 'Asia/Tashkent')
    at time zone 'Asia/Tashkent';
  day_end:=day_start+interval '1 day';

  select count(*)::integer,coalesce(sum(awarded_xp),0)::integer
  into total_count,today_xp from public.xp_events
  where user_id=p_user_id and played_at>=day_start and played_at<day_end;
  select count(*)::integer into game_count from public.xp_events
  where user_id=p_user_id and game_id='checkers-puzzle'
    and played_at>=day_start and played_at<day_end;

  multiplier:=case when game_count<5 then 100
    when game_count<10 then 50 when game_count<15 then 25 else 0 end;
  if total_count=0 then daily_bonus:=10; end if;
  if game_count=0 then variety_bonus:=5; end if;
  final_xp:=greatest(0,least(
    floor(20*multiplier/100.0)::integer+daily_bonus+variety_bonus,
    greatest(0,500-today_xp)
  ));

  insert into public.xp_events(
    user_id,client_attempt_id,game_id,metric,value,raw_xp,
    multiplier_percent,daily_bonus_xp,variety_bonus_xp,
    personal_best_bonus_xp,awarded_xp,rule_version,played_at
  ) values (
    p_user_id,p_completion_id,'checkers-puzzle','correct_count',1,20,
    multiplier,daily_bonus,variety_bonus,0,final_xp,7,safe_played_at
  ) on conflict(user_id,client_attempt_id) do nothing;

  if found and final_xp>0 then
    update public.users set total_xp=total_xp+final_xp where id=p_user_id;
  end if;
  return final_xp;
end;
$$;

revoke all on function public.award_minigame_completion_xp(
  uuid,text,text,text,timestamp with time zone
) from public,anon,authenticated;
grant execute on function public.award_minigame_completion_xp(
  uuid,text,text,text,timestamp with time zone
) to service_role;

commit;
