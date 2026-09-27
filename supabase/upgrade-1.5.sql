-- =====================================================================
-- Fitness Tracker — upgrade to v1.5
-- Adds: a setting for whether friends can see your activity grid.
-- Paste into Supabase: SQL Editor -> New query -> Run.
-- Only ADDS things; safe to run more than once.
-- =====================================================================
alter table public.profiles add column if not exists share_activity boolean not null default true;
grant update (username, units, shared_metrics, avatar_icon, avatar_color, share_activity) on public.profiles to authenticated;
