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
