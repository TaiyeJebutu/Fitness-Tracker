-- =====================================================================
-- Fitness Tracker — upgrade to v2.9
-- Adds: which muscles each exercise works (main muscles + helper muscles), for the muscle heat map.
-- Fills them in for the built-in exercises. Your own exercises can be set in the app.
-- Paste into Supabase: SQL Editor -> New query -> Run. Safe to run more than once.
-- =====================================================================
alter table public.exercises add column if not exists muscles  text[] not null default '{}';
alter table public.exercises add column if not exists muscles2 text[] not null default '{}';
alter table public.exercises drop constraint if exists exercises_muscles_check;
alter table public.exercises add constraint exercises_muscles_check check (
  muscles <@ array['chest','traps','lats','lowerback','frontdelts','sidedelts','reardelts','biceps','triceps','forearms','abs','obliques','glutes','quads','hamstrings','adductors','calves']::text[] and muscles2 <@ array['chest','traps','lats','lowerback','frontdelts','sidedelts','reardelts','biceps','triceps','forearms','abs','obliques','glutes','quads','hamstrings','adductors','calves']::text[]
  and cardinality(muscles) + cardinality(muscles2) <= 17);

update public.exercises e set muscles = v.m::text[], muscles2 = v.s::text[]
from (values
  ('Bench Press (Barbell)', '{chest}', '{triceps,frontdelts}'),
  ('Incline Bench Press (Barbell)', '{chest}', '{frontdelts,triceps}'),
  ('Bench Press (Dumbbell)', '{chest}', '{triceps,frontdelts}'),
  ('Incline Press (Dumbbell)', '{chest}', '{frontdelts,triceps}'),
  ('Chest Press (Machine)', '{chest}', '{triceps,frontdelts}'),
  ('Chest Fly (Dumbbell)', '{chest}', '{frontdelts}'),
  ('Cable Fly', '{chest}', '{frontdelts}'),
  ('Pec Deck', '{chest}', '{frontdelts}'),
  ('Push-up', '{chest}', '{triceps,frontdelts,abs}'),
  ('Dip', '{chest,triceps}', '{frontdelts}'),
  ('Deadlift', '{hamstrings,glutes,lowerback}', '{quads,traps,forearms,lats}'),
  ('Romanian Deadlift', '{hamstrings,glutes}', '{lowerback,forearms}'),
  ('Pull-up', '{lats}', '{biceps,reardelts,forearms}'),
  ('Chin-up', '{lats,biceps}', '{forearms}'),
  ('Lat Pulldown', '{lats}', '{biceps,reardelts}'),
  ('Seated Cable Row', '{lats,traps}', '{biceps,reardelts}'),
  ('Bent-over Row (Barbell)', '{lats,traps}', '{biceps,reardelts,lowerback}'),
  ('One-arm Row (Dumbbell)', '{lats}', '{traps,biceps,reardelts}'),
  ('T-bar Row', '{lats,traps}', '{biceps,reardelts,lowerback}'),
  ('Machine Row', '{lats,traps}', '{biceps,reardelts}'),
  ('Back Extension', '{lowerback}', '{glutes,hamstrings}'),
  ('Shrug', '{traps}', '{forearms}'),
  ('Overhead Press (Barbell)', '{frontdelts}', '{sidedelts,triceps,traps}'),
  ('Shoulder Press (Dumbbell)', '{frontdelts}', '{sidedelts,triceps}'),
  ('Shoulder Press (Machine)', '{frontdelts}', '{sidedelts,triceps}'),
  ('Lateral Raise', '{sidedelts}', '{traps}'),
  ('Cable Lateral Raise', '{sidedelts}', '{traps}'),
  ('Front Raise', '{frontdelts}', '{sidedelts}'),
  ('Rear Delt Fly', '{reardelts}', '{traps}'),
  ('Face Pull', '{reardelts}', '{traps,sidedelts}'),
  ('Upright Row', '{sidedelts,traps}', '{frontdelts,biceps}'),
  ('Bicep Curl (Barbell)', '{biceps}', '{forearms}'),
  ('Bicep Curl (Dumbbell)', '{biceps}', '{forearms}'),
  ('Hammer Curl', '{biceps,forearms}', '{}'),
  ('Preacher Curl', '{biceps}', '{}'),
  ('Cable Curl', '{biceps}', '{forearms}'),
  ('Tricep Pushdown', '{triceps}', '{}'),
  ('Overhead Tricep Extension', '{triceps}', '{}'),
  ('Skull Crusher', '{triceps}', '{}'),
  ('Close-grip Bench Press', '{triceps}', '{chest,frontdelts}'),
  ('Back Squat', '{quads,glutes}', '{adductors,hamstrings,lowerback}'),
  ('Front Squat', '{quads}', '{glutes,abs,adductors}'),
  ('Leg Press', '{quads}', '{glutes,adductors}'),
  ('Hack Squat', '{quads}', '{glutes}'),
  ('Bulgarian Split Squat', '{quads,glutes}', '{hamstrings,adductors}'),
  ('Lunge', '{quads,glutes}', '{hamstrings,adductors}'),
  ('Leg Extension', '{quads}', '{}'),
  ('Lying Leg Curl', '{hamstrings}', '{calves}'),
  ('Seated Leg Curl', '{hamstrings}', '{}'),
  ('Hip Thrust', '{glutes}', '{hamstrings}'),
  ('Goblet Squat', '{quads,glutes}', '{adductors,abs}'),
  ('Standing Calf Raise', '{calves}', '{}'),
  ('Seated Calf Raise', '{calves}', '{}'),
  ('Hip Abduction (Machine)', '{glutes}', '{}'),
  ('Hip Adduction (Machine)', '{adductors}', '{}'),
  ('Plank', '{abs}', '{obliques}'),
  ('Crunch', '{abs}', '{}'),
  ('Hanging Leg Raise', '{abs}', '{obliques,forearms}'),
  ('Cable Crunch', '{abs}', '{obliques}'),
  ('Russian Twist', '{obliques}', '{abs}'),
  ('Ab Wheel Rollout', '{abs}', '{lats,obliques}'),
  ('Kettlebell Swing', '{glutes,hamstrings}', '{lowerback,frontdelts}'),
  ('Clean', '{glutes,quads,traps}', '{hamstrings,lowerback,frontdelts}'),
  ('Farmer''s Carry', '{forearms,traps}', '{abs,obliques,glutes}')
) as v(name, m, s)
where e.owner is null and e.name = v.name;
