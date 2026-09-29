-- =====================================================================
-- Fitness Tracker — upgrade to v2.6
-- Adds: a weekly goal (sessions per week, 1–30) saved on each person's profile. Starts at 3.
-- Paste into Supabase: SQL Editor -> New query -> Run. Safe to run more than once.
-- =====================================================================
alter table public.profiles add column if not exists weekly_goal smallint not null default 3;
alter table public.profiles drop constraint if exists profiles_weekly_goal_check;
alter table public.profiles add constraint profiles_weekly_goal_check check (weekly_goal between 1 and 30);
grant update (username, units, shared_metrics, avatar_icon, avatar_color, share_activity, weekly_goal) on public.profiles to authenticated;
