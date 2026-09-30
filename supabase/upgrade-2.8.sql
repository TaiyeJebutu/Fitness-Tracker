-- =====================================================================
-- Fitness Tracker — upgrade to v2.8
-- Adds: a weekly plan (which sessions you mean to do on which day). Private: only you can see yours.
-- Paste into Supabase: SQL Editor -> New query -> Run. Safe to run more than once.
-- =====================================================================
create table if not exists public.training_plans (
  owner       uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  template    jsonb not null default '[[],[],[],[],[],[],[]]',
  weeks       jsonb not null default '{}',
  updated_at  timestamptz not null default now(),
  -- a usual week of 7 days, a map of week changes, and a sensible size
  constraint training_plans_shape check (
    jsonb_typeof(template) = 'array' and jsonb_array_length(template) = 7
    and jsonb_typeof(weeks) = 'object'
    and length(template::text) + length(weeks::text) <= 50000)
);
alter table public.training_plans enable row level security;
drop policy if exists "plan read" on public.training_plans;
drop policy if exists "plan add"  on public.training_plans;
drop policy if exists "plan edit" on public.training_plans;
drop policy if exists "plan del"  on public.training_plans;
create policy "plan read" on public.training_plans for select to authenticated using (owner = auth.uid());
create policy "plan add"  on public.training_plans for insert to authenticated with check (owner = auth.uid());
create policy "plan edit" on public.training_plans for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy "plan del"  on public.training_plans for delete to authenticated using (owner = auth.uid());
revoke all on public.training_plans from anon, authenticated;
grant select, insert, update, delete on public.training_plans to authenticated;
