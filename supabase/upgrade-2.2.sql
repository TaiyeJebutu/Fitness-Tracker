-- =====================================================================
-- Fitness Tracker — upgrade to v2.2
-- Adds: reps in reserve (RIR) for each set: 0 = failure … 5 = "5+".
-- Paste into Supabase: SQL Editor -> New query -> Run. Safe to run more than once.
-- Friends can see it (same privacy as the rest of the set).
-- =====================================================================
alter table public.sets add column if not exists rir smallint;
alter table public.sets drop constraint if exists sets_rir_check;
alter table public.sets add constraint sets_rir_check check (rir is null or rir between 0 and 5);
