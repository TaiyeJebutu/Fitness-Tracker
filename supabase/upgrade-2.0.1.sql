-- Fitness Tracker v2.0.1 — feedback posts can no longer be edited after posting.
-- Run once in Supabase → SQL Editor → New query → paste → Run. Safe to run more than once.
-- Authors can still delete their own posts and comments; the owner can still set status and delete anything.

drop policy if exists "fb edit" on public.feedback_posts;
revoke update on public.feedback_posts from anon, authenticated;
revoke update (kind, title, body, updated_at) on public.feedback_posts from anon, authenticated;
