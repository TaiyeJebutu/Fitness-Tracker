-- =====================================================================
-- Fitness Tracker — upgrade to v1.2
-- Adds: left/right (unilateral) sets, avatars, achievement badges.
-- Paste into Supabase: SQL Editor -> New query -> Run.
-- Only ADDS things; safe to run more than once.
-- =====================================================================

-- ---------- Unilateral exercises -----------------------------------
alter table public.sets add column if not exists side text;
alter table public.sets drop constraint if exists sets_side_check;
alter table public.sets add constraint sets_side_check check (side is null or side in ('L', 'R'));
alter table public.exercise_details add column if not exists unilateral boolean not null default false;

-- ---------- Avatars -------------------------------------------------
alter table public.profiles add column if not exists avatar_icon  text not null default 'dumbbell';
alter table public.profiles add column if not exists avatar_color text not null default '#2f5fe0';
alter table public.profiles drop constraint if exists profiles_avatar_check;
alter table public.profiles add constraint profiles_avatar_check
  check (avatar_icon ~ '^[a-z0-9_]{1,20}$' and avatar_color ~ '^#[0-9a-fA-F]{6}$');
grant update (username, units, shared_metrics, avatar_icon, avatar_color) on public.profiles to authenticated;

-- Remember where a copied routine came from (for the "first copied routine" badge).
alter table public.routines add column if not exists copied_from uuid;

-- ---------- Achievements -------------------------------------------
create table if not exists public.achievements (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  badge     text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge)
);
alter table public.achievements enable row level security;
drop policy if exists "badges read" on public.achievements;
create policy "badges read" on public.achievements for select to authenticated
  using (user_id = auth.uid() or public.are_friends(user_id, auth.uid()));
-- Nobody can add or change badges directly; only check_achievements() below awards them.
revoke all on public.achievements from anon, authenticated;
grant select on public.achievements to authenticated;
create index if not exists achievements_earned on public.achievements (user_id, earned_at desc);

-- Works out which badges the signed-in person has earned from their real data,
-- awards any new ones, and returns the newly earned badge keys.
create or replace function public.check_achievements() returns setof text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  n_w int; w_streak int; n_pr int; vol numeric; b_streak int;
  has_friend boolean; has_copy boolean;
  bw_bench boolean; bw_squat boolean; bw_dead boolean; club boolean;
begin
  if me is null then return; end if;

  select count(*) into n_w from workouts where owner = me and ended_at is not null;

  -- longest run of consecutive weeks (Mon–Sun) with a finished workout
  with wk as (select distinct date_trunc('week', started_at)::date d from workouts where owner = me and ended_at is not null),
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
      ('body4', b_streak >= 4), ('body12', b_streak >= 12)
    ) t(b, ok)
    where t.ok
    on conflict do nothing
    returning badge)
  select badge from ins;
end $$;
revoke all on function public.check_achievements() from public, anon;
grant execute on function public.check_achievements() to authenticated;
