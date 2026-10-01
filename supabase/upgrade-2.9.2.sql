-- =====================================================================
-- Fitness Tracker — upgrade to v2.9.2
-- Adds: "F" (taken to failure) as a reps-in-reserve choice. Stored as -1 (0–5 are reps in reserve).
-- Paste into Supabase: SQL Editor -> New query -> Run. Safe to run more than once.
-- =====================================================================
alter table public.sets drop constraint if exists sets_rir_check;
alter table public.sets add constraint sets_rir_check check (rir is null or rir between -1 and 5);
