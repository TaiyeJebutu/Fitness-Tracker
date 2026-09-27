-- =====================================================================
-- Fitness Tracker — upgrade to v2.1
-- Adds: runs, swims and other activities (table + privacy rules), and
-- updates badges so activities count towards streaks, plus 8 new badges.
-- Paste into Supabase: SQL Editor -> New query -> Run. Safe to run more than once.
-- =====================================================================
-- ---------- Runs, swims and other activities -------------------------
-- Entered after the event (no GPS). Distances in metres, time in seconds.
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  kind        text not null check (kind in ('run', 'swim', 'other')),
  sport       text check (sport is null or length(trim(sport)) between 1 and 40),   -- 'other' only, e.g. Cycling
  title       text check (title is null or length(title) <= 80),
  started_at  timestamptz not null default now(),
  duration_s  int not null check (duration_s between 30 and 172800),
  distance_m  numeric(9,1) check (distance_m is null or distance_m > 0),
  feel        smallint check (feel between 1 and 5),                                  -- runs: 1 very easy … 5 very hard
  pool        text check (pool in ('25m', '50m', '25yd', 'open')),                    -- swims
  stroke      text check (stroke in ('freestyle', 'breaststroke', 'backstroke', 'butterfly', 'mixed')),
  notes       text check (length(notes) <= 1000),
  created_at  timestamptz not null default now(),
  -- realistic values: distance ranges, and nothing faster than world-record pace
  constraint activities_sensible check (case kind
    when 'run'  then sport is null and distance_m between 100 and 300000 and distance_m <= duration_s * 12
    when 'swim' then sport is null and distance_m between 25 and 30000 and distance_m <= duration_s * 3
    else sport is not null and (distance_m is null or distance_m <= 1000000) end)
);
create index if not exists activities_owner_started on public.activities (owner, started_at desc);
alter table public.activities enable row level security;
drop policy if exists "act read" on public.activities;
drop policy if exists "act add"  on public.activities;
drop policy if exists "act edit" on public.activities;
drop policy if exists "act del"  on public.activities;
-- Same as workouts: you and your friends can see them; only you can change yours.
create policy "act read" on public.activities for select to authenticated
  using (owner = auth.uid() or public.are_friends(owner, auth.uid()));
create policy "act add"  on public.activities for insert to authenticated with check (owner = auth.uid());
create policy "act edit" on public.activities for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy "act del"  on public.activities for delete to authenticated using (owner = auth.uid());
revoke all on public.activities from anon, authenticated;
grant select, insert, update, delete on public.activities to authenticated;

-- ---------- Badges: activities count towards streaks; running & swimming badges ----------
create or replace function public.check_achievements() returns setof text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  n_w int; w_streak int; n_pr int; vol numeric; b_streak int;
  has_friend boolean; has_copy boolean;
  bw_bench boolean; bw_squat boolean; bw_dead boolean; club boolean;
  n_run int; run_max numeric; run_total numeric; n_swim int; swim_max numeric; swim_total numeric;
begin
  if me is null then return; end if;

  select count(*) into n_w from workouts where owner = me and ended_at is not null;

  -- longest run of consecutive weeks (Mon–Sun) with a finished workout or a run / swim / other activity
  with wk as (select distinct date_trunc('week', started_at)::date d from workouts where owner = me and ended_at is not null
              union select distinct date_trunc('week', started_at)::date from activities where owner = me),
       g  as (select d - (row_number() over (order by d))::int * 7 as grp from wk)
  select coalesce(max(c), 0) into w_streak from (select count(*) c from g group by grp) x;

  -- personal records: a set whose estimated 1RM beats every earlier set of that exercise
  with s as (
    select e1rm(weight_kg, reps) v,
           max(e1rm(weight_kg, reps)) over (partition by exercise_id order by created_at, id
                                            rows between unbounded preceding and 1 preceding) prev
    from sets where owner = me)
  select count(*) into n_pr from s where v is not null and prev is not null and v > prev;

  select coalesce(sum(weight_kg * reps), 0) into vol from sets where owner = me;

  with wk as (select distinct date_trunc('week', measured_on)::date d from body_metrics where owner = me),
       g  as (select d - (row_number() over (order by d))::int * 7 as grp from wk)
  select coalesce(max(c), 0) into b_streak from (select count(*) c from g group by grp) x;

  select exists (select 1 from friendships f where f.status = 'accepted' and me in (f.requester, f.addressee)) into has_friend;
  select exists (select 1 from routines r where r.owner = me and (r.copied_from is not null or r.name like '%(from @%)')) into has_copy;

  -- lifts vs bodyweight (nearest bodyweight entry on or before the set, else the closest one after)
  with lifts as (
    select e.name, s.weight_kg, (
      select b.value from body_metrics b where b.owner = me and b.metric = 'bodyweight'
      order by (b.measured_on <= s.created_at::date) desc, abs(b.measured_on - s.created_at::date) limit 1) bw
    from sets s join exercises e on e.id = s.exercise_id and e.owner is null
    where s.owner = me and s.reps >= 1 and e.name in ('Bench Press (Barbell)', 'Back Squat', 'Deadlift'))
  select coalesce(bool_or(name = 'Bench Press (Barbell)' and weight_kg >= bw), false),
         coalesce(bool_or(name = 'Back Squat' and weight_kg >= bw * 1.5), false),
         coalesce(bool_or(name = 'Deadlift' and weight_kg >= bw * 2), false),
         coalesce(bool_or(name = 'Bench Press (Barbell)' and weight_kg >= 100), false)
    into bw_bench, bw_squat, bw_dead, club
  from lifts;

  select count(*) filter (where kind = 'run'), coalesce(max(distance_m) filter (where kind = 'run'), 0), coalesce(sum(distance_m) filter (where kind = 'run'), 0),
         count(*) filter (where kind = 'swim'), coalesce(max(distance_m) filter (where kind = 'swim'), 0), coalesce(sum(distance_m) filter (where kind = 'swim'), 0)
    into n_run, run_max, run_total, n_swim, swim_max, swim_total
  from activities where owner = me;

  return query
  with ins as (
    insert into achievements (user_id, badge)
    select me, t.b from (values
      ('w1', n_w >= 1), ('w10', n_w >= 10), ('w25', n_w >= 25), ('w50', n_w >= 50),
      ('w100', n_w >= 100), ('w250', n_w >= 250), ('w500', n_w >= 500),
      ('streak4', w_streak >= 4), ('streak12', w_streak >= 12), ('streak26', w_streak >= 26), ('streak52', w_streak >= 52),
      ('pr1', n_pr >= 1), ('pr10', n_pr >= 10), ('pr50', n_pr >= 50),
      ('bw_bench', bw_bench), ('bw_squat', bw_squat), ('bw_deadlift', bw_dead), ('club100', club),
      ('vol10t', vol >= 10000), ('vol100t', vol >= 100000), ('vol1000t', vol >= 1000000),
      ('friend1', has_friend), ('copy1', has_copy),
      ('body4', b_streak >= 4), ('body12', b_streak >= 12),
      ('run1', n_run >= 1), ('run5k', run_max >= 5000), ('run_half', run_max >= 21097.5), ('run_full', run_max >= 42195),
      ('run100', run_total >= 100000), ('swim1', n_swim >= 1), ('swim1k', swim_max >= 1000), ('swim10k', swim_total >= 10000)
    ) t(b, ok)
    where t.ok
    on conflict do nothing
    returning badge)
  select badge from ins;
end $$;
revoke all on function public.check_achievements() from public, anon;
grant execute on function public.check_achievements() to authenticated;
