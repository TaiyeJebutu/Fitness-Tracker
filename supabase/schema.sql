-- =====================================================================
-- Fitness Tracker — database setup
-- Paste this whole file into Supabase: SQL Editor -> New query -> Run.
-- Safe to run once on a fresh project.
-- =====================================================================

-- ---------- Profiles -------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  username       text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  units          text not null default 'metric' check (units in ('metric','imperial')),
  shared_metrics text[] not null default '{}',   -- body metrics friends may see
  created_at     timestamptz not null default now()
);
create unique index profiles_username_lower on public.profiles (lower(username));

-- Create a profile automatically when someone signs up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets the sign-up screen check a username before creating the account.
create function public.username_available(name text) returns boolean
language sql security definer set search_path = '' stable as $$
  select name ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles p where lower(p.username) = lower(name));
$$;

-- ---------- Friendships ----------------------------------------------
create table public.friendships (
  requester  uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  addressee  uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
-- Only one friendship row per pair, whichever direction it was sent.
create unique index friendships_pair on public.friendships
  (least(requester, addressee), greatest(requester, addressee));

create function public.are_friends(a uuid, b uuid) returns boolean
language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a)));
$$;

-- Me plus my accepted friends.
create function public.my_circle() returns setof uuid
language sql security definer set search_path = '' stable as $$
  select auth.uid()
  union
  select case when f.requester = auth.uid() then f.addressee else f.requester end
  from public.friendships f
  where f.status = 'accepted' and auth.uid() in (f.requester, f.addressee);
$$;

-- ---------- Exercises ------------------------------------------------
create table public.exercises (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid references public.profiles(id) on delete cascade default auth.uid(), -- null = built-in
  name       text not null check (length(name) between 1 and 80),
  category   text not null default 'Other',
  created_at timestamptz not null default now()
);

-- Personal notes/settings per exercise (seat height, machine, adjustments…)
create table public.exercise_details (
  user_id       uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  exercise_id   uuid not null references public.exercises(id) on delete cascade,
  machine_brand text,
  machine_model text,
  seat_height   text,
  adjustments   jsonb not null default '[]',  -- [{ "label": "Back pad", "value": "3" }]
  notes         text,
  updated_at    timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

-- ---------- Routines & workouts ---------------------------------------
create table public.routines (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  name       text not null check (length(name) between 1 and 80),
  items      jsonb not null default '[]',  -- [{ "exercise_id", "sets", "reps", "rest" }]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workouts (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  routine_id uuid,
  name       text not null default 'Workout',
  notes      text,
  started_at timestamptz not null default now(),
  ended_at   timestamptz
);
create index workouts_owner_started on public.workouts (owner, started_at desc);

create table public.sets (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references public.workouts(id) on delete cascade,
  owner       uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  position    int not null default 0,   -- order of the exercise within the workout
  set_no      int not null default 1,
  reps        int not null check (reps between 0 and 1000),
  weight_kg   numeric(8,3) not null default 0 check (weight_kg >= 0),
  created_at  timestamptz not null default now()
);
create index sets_owner_exercise on public.sets (owner, exercise_id, created_at desc);
create index sets_workout on public.sets (workout_id);

-- ---------- Body stats -----------------------------------------------
-- Values are stored in kg (bodyweight), % (body_fat) or cm (everything else).
create table public.body_metrics (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  metric      text not null check (metric in
                ('bodyweight','body_fat','chest','waist','hips','neck','shoulders','arms','forearms','thighs','calves')),
  value       numeric(8,3) not null check (value > 0),
  measured_on date not null default current_date,
  created_at  timestamptz not null default now()
);
create index body_metrics_owner on public.body_metrics (owner, metric, measured_on);

-- =====================================================================
-- Row Level Security: who can see and change what
-- =====================================================================
-- Table access for signed-in users (the policies below narrow it down).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

alter table public.profiles         enable row level security;
alter table public.friendships      enable row level security;
alter table public.exercises        enable row level security;
alter table public.exercise_details enable row level security;
alter table public.routines         enable row level security;
alter table public.workouts         enable row level security;
alter table public.sets             enable row level security;
alter table public.body_metrics     enable row level security;

-- Profiles: any signed-in user can look up usernames; you edit only your own.
create policy "profiles read"   on public.profiles for select to authenticated using (true);
create policy "profiles update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (username, units, shared_metrics) on public.profiles to authenticated;

-- Friendships: you see rows you're part of; you send requests as yourself;
-- only the person asked can accept; either side can remove.
create policy "friend read"   on public.friendships for select to authenticated
  using (auth.uid() in (requester, addressee));
create policy "friend ask"    on public.friendships for insert to authenticated
  with check (requester = auth.uid() and status = 'pending');
create policy "friend accept" on public.friendships for update to authenticated
  using (addressee = auth.uid()) with check (addressee = auth.uid());
create policy "friend remove" on public.friendships for delete to authenticated
  using (auth.uid() in (requester, addressee));
revoke update on public.friendships from authenticated, anon;
grant update (status) on public.friendships to authenticated;

-- Exercises: built-ins for everyone; custom ones for the owner and their friends.
create policy "exercise read" on public.exercises for select to authenticated
  using (owner is null or owner = auth.uid() or public.are_friends(owner, auth.uid()));
create policy "exercise add"  on public.exercises for insert to authenticated with check (owner = auth.uid());
create policy "exercise edit" on public.exercises for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy "exercise del"  on public.exercises for delete to authenticated using (owner = auth.uid());

-- Exercise details: private to you.
create policy "details all" on public.exercise_details for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Routines and workouts: yours to change; friends can view.
create policy "routine read" on public.routines for select to authenticated
  using (owner = auth.uid() or public.are_friends(owner, auth.uid()));
create policy "routine add"  on public.routines for insert to authenticated with check (owner = auth.uid());
create policy "routine edit" on public.routines for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy "routine del"  on public.routines for delete to authenticated using (owner = auth.uid());

create policy "workout read" on public.workouts for select to authenticated
  using (owner = auth.uid() or public.are_friends(owner, auth.uid()));
create policy "workout add"  on public.workouts for insert to authenticated with check (owner = auth.uid());
create policy "workout edit" on public.workouts for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy "workout del"  on public.workouts for delete to authenticated using (owner = auth.uid());

create policy "set read" on public.sets for select to authenticated
  using (owner = auth.uid() or public.are_friends(owner, auth.uid()));
create policy "set add"  on public.sets for insert to authenticated
  with check (owner = auth.uid()
    and exists (select 1 from public.workouts w where w.id = workout_id and w.owner = auth.uid()));
create policy "set edit" on public.sets for update to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid()
    and exists (select 1 from public.workouts w where w.id = workout_id and w.owner = auth.uid()));
create policy "set del"  on public.sets for delete to authenticated using (owner = auth.uid());

-- Body stats: yours; friends see only the metrics you chose to share.
create policy "body read" on public.body_metrics for select to authenticated
  using (owner = auth.uid()
    or (public.are_friends(owner, auth.uid())
        and exists (select 1 from public.profiles p
                    where p.id = owner and metric = any (p.shared_metrics))));
create policy "body add"  on public.body_metrics for insert to authenticated with check (owner = auth.uid());
create policy "body edit" on public.body_metrics for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy "body del"  on public.body_metrics for delete to authenticated using (owner = auth.uid());

-- =====================================================================
-- Leaderboards (you + accepted friends). These run with the caller's
-- permissions, so the rules above still apply.
-- =====================================================================

-- Estimated 1-rep max (Epley). Sets over 12 reps are ignored as unreliable.
create function public.e1rm(weight numeric, reps int) returns numeric
language sql immutable as $$
  select case when reps <= 0 or reps > 12 then null
              when reps = 1 then weight
              else round(weight * (1 + reps / 30.0), 2) end;
$$;

create function public.lb_best_lift(p_exercise uuid)
returns table (user_id uuid, username text, best_e1rm numeric, best_weight numeric)
language sql stable set search_path = public as $$
  select s.owner, p.username, max(e1rm(s.weight_kg, s.reps)), max(s.weight_kg)
  from sets s join profiles p on p.id = s.owner
  where s.exercise_id = p_exercise and s.owner in (select my_circle())
  group by s.owner, p.username
  having max(e1rm(s.weight_kg, s.reps)) is not null
  order by 3 desc;
$$;

-- % change in best estimated 1RM: last 4 weeks vs the 4 weeks before.
create function public.lb_progress(p_exercise uuid)
returns table (user_id uuid, username text, before_e1rm numeric, recent_e1rm numeric, pct numeric)
language sql stable set search_path = public as $$
  with w as (
    select s.owner,
           max(e1rm(s.weight_kg, s.reps)) filter (where s.created_at >= now() - interval '28 days') as recent,
           max(e1rm(s.weight_kg, s.reps)) filter (where s.created_at <  now() - interval '28 days'
                                                    and s.created_at >= now() - interval '56 days') as before
    from sets s
    where s.exercise_id = p_exercise and s.owner in (select my_circle())
      and s.created_at >= now() - interval '56 days'
    group by s.owner)
  select w.owner, p.username, w.before, w.recent,
         round((w.recent - w.before) / w.before * 100, 1)
  from w join profiles p on p.id = w.owner
  where w.recent is not null and w.before is not null and w.before > 0
  order by 5 desc;
$$;

-- Total kg lifted (weight x reps) since a given moment (the app sends Monday 00:00).
create function public.lb_volume(p_since timestamptz)
returns table (user_id uuid, username text, volume_kg numeric, set_count bigint)
language sql stable set search_path = public as $$
  select s.owner, p.username, sum(s.weight_kg * s.reps), count(*)
  from sets s join profiles p on p.id = s.owner
  where s.created_at >= p_since and s.owner in (select my_circle())
  group by s.owner, p.username
  order by 3 desc;
$$;

grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.lb_best_lift(uuid), public.lb_progress(uuid),
  public.lb_volume(timestamptz), public.e1rm(numeric, int),
  public.are_friends(uuid, uuid), public.my_circle() to authenticated;

-- =====================================================================
-- Built-in exercises
-- =====================================================================
insert into public.exercises (owner, name, category) values
 (null,'Bench Press (Barbell)','Chest'),(null,'Incline Bench Press (Barbell)','Chest'),
 (null,'Bench Press (Dumbbell)','Chest'),(null,'Incline Press (Dumbbell)','Chest'),
 (null,'Chest Press (Machine)','Chest'),(null,'Chest Fly (Dumbbell)','Chest'),
 (null,'Cable Fly','Chest'),(null,'Pec Deck','Chest'),(null,'Push-up','Chest'),(null,'Dip','Chest'),
 (null,'Deadlift','Back'),(null,'Romanian Deadlift','Back'),(null,'Pull-up','Back'),(null,'Chin-up','Back'),
 (null,'Lat Pulldown','Back'),(null,'Seated Cable Row','Back'),(null,'Bent-over Row (Barbell)','Back'),
 (null,'One-arm Row (Dumbbell)','Back'),(null,'T-bar Row','Back'),(null,'Machine Row','Back'),
 (null,'Back Extension','Back'),(null,'Shrug','Back'),
 (null,'Overhead Press (Barbell)','Shoulders'),(null,'Shoulder Press (Dumbbell)','Shoulders'),
 (null,'Shoulder Press (Machine)','Shoulders'),(null,'Lateral Raise','Shoulders'),
 (null,'Cable Lateral Raise','Shoulders'),(null,'Front Raise','Shoulders'),
 (null,'Rear Delt Fly','Shoulders'),(null,'Face Pull','Shoulders'),(null,'Upright Row','Shoulders'),
 (null,'Bicep Curl (Barbell)','Arms'),(null,'Bicep Curl (Dumbbell)','Arms'),(null,'Hammer Curl','Arms'),
 (null,'Preacher Curl','Arms'),(null,'Cable Curl','Arms'),(null,'Tricep Pushdown','Arms'),
 (null,'Overhead Tricep Extension','Arms'),(null,'Skull Crusher','Arms'),(null,'Close-grip Bench Press','Arms'),
 (null,'Back Squat','Legs'),(null,'Front Squat','Legs'),(null,'Leg Press','Legs'),(null,'Hack Squat','Legs'),
 (null,'Bulgarian Split Squat','Legs'),(null,'Lunge','Legs'),(null,'Leg Extension','Legs'),
 (null,'Lying Leg Curl','Legs'),(null,'Seated Leg Curl','Legs'),(null,'Hip Thrust','Legs'),
 (null,'Goblet Squat','Legs'),(null,'Standing Calf Raise','Legs'),(null,'Seated Calf Raise','Legs'),
 (null,'Hip Abduction (Machine)','Legs'),(null,'Hip Adduction (Machine)','Legs'),
 (null,'Plank','Core'),(null,'Crunch','Core'),(null,'Hanging Leg Raise','Core'),(null,'Cable Crunch','Core'),
 (null,'Russian Twist','Core'),(null,'Ab Wheel Rollout','Core'),
 (null,'Kettlebell Swing','Full body'),(null,'Clean','Full body'),(null,'Farmer''s Carry','Full body');


-- =====================================================================
-- v1.2 additions (same as upgrade-1.2.sql)
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
