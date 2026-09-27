-- Fitness Tracker v2.0.2 — sensible limits for body stats.
-- Run once in Supabase → SQL Editor → New query → paste → Run. Safe to run more than once.
-- Body fat 1–75 %, bodyweight 20–400 kg, measurements 5–300 cm.
-- NOT VALID: only new entries are checked; entries already saved are kept as they are.

alter table public.body_metrics drop constraint if exists body_metrics_value_range;
alter table public.body_metrics add constraint body_metrics_value_range check (case metric
  when 'bodyweight' then value between 20 and 400
  when 'body_fat'   then value between 1 and 75
  else value between 5 and 300 end) not valid;
