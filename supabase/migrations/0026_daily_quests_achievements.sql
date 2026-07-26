-- Checkers Online V2.6 — daily quests, streaks, reward chest and achievements.
-- Run after 0025_consent_ai_rating.sql. Existing XP and match data is preserved.

begin;

create table if not exists public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  reward_key text not null,
  reward_type text not null check (reward_type in ('daily_task','daily_chest','achievement')),
  xp integer not null check (xp between 0 and 500),
  created_at timestamptz not null default now(),
  unique(user_id,reward_key)
);
alter table public.reward_claims drop constraint if exists reward_claims_reward_type_check;
alter table public.reward_claims add constraint reward_claims_reward_type_check
  check(reward_type in ('daily_task','daily_chest','achievement'));
create index if not exists idx_reward_claims_user_created
  on public.reward_claims(user_id,created_at desc);

create table if not exists public.user_streaks (
  user_id uuid primary key references public.users(id) on delete cascade,
  current_streak integer not null default 0 check(current_streak>=0),
  best_streak integer not null default 0 check(best_streak>=0),
  last_active_day date,
  freeze_available boolean not null default true,
  perfect_days integer not null default 0 check(perfect_days>=0),
  updated_at timestamptz not null default now()
);

alter table public.reward_claims enable row level security;
alter table public.user_streaks enable row level security;
revoke all on public.reward_claims,public.user_streaks from anon,authenticated;
grant all on public.reward_claims,public.user_streaks to service_role;

create or replace function public.refresh_user_streak(p_user_id uuid)
returns public.user_streaks
language plpgsql security definer set search_path=public
as $$
declare
  s public.user_streaks;
  today date := (now() at time zone 'UTC')::date;
  active_today boolean;
begin
  insert into public.user_streaks(user_id) values(p_user_id)
  on conflict(user_id) do nothing;
  select * into s from public.user_streaks where user_id=p_user_id for update;

  select exists(
    select 1 from public.xp_events
    where user_id=p_user_id and (played_at at time zone 'UTC')::date=today
    union all
    select 1 from public.duels
    where (host_user_id=p_user_id or guest_user_id=p_user_id)
      and game_id='checkers' and status='finished'
      and (finished_at at time zone 'UTC')::date=today
  ) into active_today;

  if active_today and s.last_active_day is distinct from today then
    if s.last_active_day=today-1 then
      s.current_streak:=s.current_streak+1;
    elsif s.last_active_day=today-2 and s.freeze_available then
      s.current_streak:=s.current_streak+1;
      s.freeze_available:=false;
    else
      s.current_streak:=1;
      s.freeze_available:=true;
    end if;
    s.last_active_day:=today;
    s.best_streak:=greatest(s.best_streak,s.current_streak);
    update public.user_streaks set
      current_streak=s.current_streak,best_streak=s.best_streak,
      last_active_day=s.last_active_day,freeze_available=s.freeze_available,
      updated_at=now()
    where user_id=p_user_id returning * into s;
  end if;
  return s;
end;
$$;

create or replace function public.grant_reward_once(
  p_user_id uuid,p_reward_key text,p_reward_type text,p_xp integer
) returns integer
language plpgsql security definer set search_path=public
as $$
begin
  if p_xp<0 or p_xp>500 or length(p_reward_key)>100 then return 0; end if;
  insert into public.reward_claims(user_id,reward_key,reward_type,xp)
  values(p_user_id,p_reward_key,p_reward_type,p_xp)
  on conflict(user_id,reward_key) do nothing;
  if found then
    update public.users set total_xp=total_xp+p_xp where id=p_user_id;
    return p_xp;
  end if;
  return 0;
end;
$$;

create or replace function public.get_engagement_hub(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  today date := (now() at time zone 'UTC')::date;
  day_key text := to_char(today,'YYYY-MM-DD');
  mini_count integer;
  distinct_games integer;
  checkers_today integer;
  total_games integer;
  checkers_wins integer;
  ai_wins integer;
  rating integer;
  completed integer;
  chest_claimed boolean;
  s public.user_streaks;
  achievements jsonb := '[]'::jsonb;
  a record;
  unlocked boolean;
  claimed boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,31));
  s:=public.refresh_user_streak(p_user_id);

  select count(*)::integer,count(distinct game_id)::integer
  into mini_count,distinct_games from public.xp_events
  where user_id=p_user_id and (played_at at time zone 'UTC')::date=today
    and game_id<>'checkers';

  select count(*)::integer into checkers_today from public.duels
  where (host_user_id=p_user_id or guest_user_id=p_user_id)
    and game_id='checkers' and status='finished'
    and (finished_at at time zone 'UTC')::date=today;

  select count(*)::integer into total_games from public.xp_events where user_id=p_user_id;
  select count(*)::integer into checkers_wins from public.duels
  where game_id='checkers' and status='finished'
    and ((host_user_id=p_user_id and checkers_winner='host')
      or (guest_user_id=p_user_id and checkers_winner='guest'));
  select count(*)::integer into ai_wins from public.duels
  where game_id='checkers' and status='finished' and opponent_type='ai'
    and host_user_id=p_user_id and checkers_winner='host';
  select coalesce(r.rating,1200) into rating from public.checkers_ratings r where r.user_id=p_user_id;

  completed := (case when mini_count>=1 then 1 else 0 end)
    +(case when distinct_games>=3 then 1 else 0 end)
    +(case when checkers_today>=1 or mini_count>=5 then 1 else 0 end);
  if mini_count>=1 then
    perform public.grant_reward_once(p_user_id,'daily-task:'||day_key||':warmup','daily_task',15);
  end if;
  if distinct_games>=3 then
    perform public.grant_reward_once(p_user_id,'daily-task:'||day_key||':variety','daily_task',30);
  end if;
  if checkers_today>=1 or mini_count>=5 then
    perform public.grant_reward_once(p_user_id,'daily-task:'||day_key||':competitor','daily_task',25);
  end if;
  select exists(select 1 from public.reward_claims
    where user_id=p_user_id and reward_key='daily:'||day_key) into chest_claimed;

  for a in select * from (values
    ('first_game','Birinchi qadam','Birinchi Mini Game’ni yakunlang','🎯',total_games,1,15),
    ('explorer_5','Izlanuvchi','5 xil Mini Game’ni sinab ko‘ring','🧭',
      (select count(distinct game_id)::integer from public.xp_events where user_id=p_user_id),5,30),
    ('minigame_25','Aql mashqchisi','25 ta Mini Game yakunlang','🧠',total_games,25,50),
    ('minigame_100','Tinimsiz mashq','100 ta Mini Game yakunlang','🌟',total_games,100,100),
    ('checkers_first','Birinchi g‘alaba','Shashkada ilk g‘alabani oling','🏁',checkers_wins,1,25),
    ('checkers_10','Bronza strateg','Shashkada 10 marta g‘alaba qozoning','🥉',checkers_wins,10,60),
    ('checkers_25','Kumush strateg','Shashkada 25 marta g‘alaba qozoning','🥈',checkers_wins,25,100),
    ('checkers_100','Oltin strateg','Shashkada 100 marta g‘alaba qozoning','🥇',checkers_wins,100,200),
    ('ai_slayer','AI sinovi','AI raqibni yenging','🤖',ai_wins,1,35),
    ('ai_hunter','AI ovchisi','AI raqibni 10 marta yenging','🦾',ai_wins,10,80),
    ('elo_1300','Bronza liga','1300 ELO’ga erishing','🏆',rating,1300,50),
    ('elo_1500','Kumush liga','1500 ELO’ga erishing','🏆',rating,1500,100),
    ('elo_1800','Oltin liga','1800 ELO’ga erishing','👑',rating,1800,175),
    ('elo_2000','Elita','2000 ELO’ga erishing','💠',rating,2000,250),
    ('streak_3','Barqarorlik','3 kunlik seriyaga erishing','🔥',s.best_streak,3,30),
    ('streak_7','Hafta ustasi','7 kunlik seriyaga erishing','💎',s.best_streak,7,75),
    ('streak_14','Ikki hafta','14 kunlik seriyaga erishing','⚡',s.best_streak,14,125),
    ('streak_30','Oy afsonasi','30 kunlik seriyaga erishing','🌙',s.best_streak,30,250)
  ) as x(id,title,description,emoji,current_value,target_value,reward_xp)
  loop
    unlocked:=a.current_value>=a.target_value;
    if unlocked then perform public.grant_reward_once(
      p_user_id,'achievement:'||a.id,'achievement',a.reward_xp); end if;
    select exists(select 1 from public.reward_claims where user_id=p_user_id
      and reward_key='achievement:'||a.id) into claimed;
    achievements:=achievements||jsonb_build_array(jsonb_build_object(
      'id',a.id,'title',a.title,'description',a.description,'emoji',a.emoji,
      'unlocked',unlocked,'claimed',claimed,'rewardXp',a.reward_xp,
      'progress',least(a.current_value,a.target_value),'target',a.target_value
    ));
  end loop;

  return jsonb_build_object(
    'serverNow',extract(epoch from now())*1000,
    'resetsAt',extract(epoch from date_trunc('day',now() at time zone 'UTC')+interval '1 day')*1000,
    'streak',jsonb_build_object('current',s.current_streak,'best',s.best_streak,
      'freezeAvailable',s.freeze_available),
    'daily',jsonb_build_object(
      'completed',completed,'total',3,'chestClaimed',chest_claimed,'chestXp',50,
      'tasks',jsonb_build_array(
        jsonb_build_object('id','warmup','title','Aqlni uyg‘otish','description','1 ta Mini Game yakunlang',
          'emoji','⚡','progress',least(mini_count,1),'target',1,'route','/games','rewardXp',15),
        jsonb_build_object('id','variety','title','Har tomonlama mashq','description','3 xil Mini Game o‘ynang',
          'emoji','🧩','progress',least(distinct_games,3),'target',3,'route','/games','rewardXp',30),
        jsonb_build_object('id','competitor','title','Kun sinovi','description','Shashka o‘ynang yoki 5 ta Mini Game yakunlang',
          'emoji','⚔️','progress',case when checkers_today>=1 then 1 else least(mini_count,5) end,
          'target',case when checkers_today>=1 then 1 else 5 end,'route','/games','rewardXp',25)
      )
    ),
    'achievements',achievements
  );
end;
$$;

create or replace function public.claim_daily_chest(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare h jsonb; day_key text; awarded integer;
begin
  h:=public.get_engagement_hub(p_user_id);
  if (h#>>'{daily,completed}')::integer<3 then raise exception 'daily_incomplete'; end if;
  day_key:=to_char((now() at time zone 'UTC')::date,'YYYY-MM-DD');
  awarded:=public.grant_reward_once(p_user_id,'daily:'||day_key,'daily_chest',50);
  update public.user_streaks set perfect_days=perfect_days+case when awarded>0 then 1 else 0 end
  where user_id=p_user_id;
  return jsonb_build_object('awardedXp',awarded,'hub',public.get_engagement_hub(p_user_id));
end;
$$;

revoke all on function public.refresh_user_streak(uuid),public.grant_reward_once(uuid,text,text,integer),
  public.get_engagement_hub(uuid),public.claim_daily_chest(uuid) from public,anon,authenticated;
grant execute on function public.refresh_user_streak(uuid),public.grant_reward_once(uuid,text,text,integer),
  public.get_engagement_hub(uuid),public.claim_daily_chest(uuid) to service_role;

commit;
