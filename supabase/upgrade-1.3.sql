-- =====================================================================
-- Fitness Tracker — upgrade to v1.3
-- Adds: a shared feedback board (feature requests + bug reports).
-- Paste into Supabase: SQL Editor -> New query -> Run.
-- Only ADDS things; safe to run more than once.
-- =====================================================================

-- ---------- Owner(s) of the app, who can set a post's status ---------
create table if not exists public.app_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade
);
alter table public.app_admins enable row level security;
drop policy if exists "admins read" on public.app_admins;
create policy "admins read" on public.app_admins for select to authenticated using (true);
revoke all on public.app_admins from anon, authenticated;
grant select on public.app_admins to authenticated;

-- The app owner: @TJ123
insert into public.app_admins (user_id)
select id from public.profiles where lower(username) = 'tj123'
on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid());
$$;

-- ---------- Posts -----------------------------------------------------
create table if not exists public.feedback_posts (
  id          uuid primary key default gen_random_uuid(),
  author      uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  kind        text not null check (kind in ('feature', 'bug')),
  title       text not null check (length(trim(title)) between 3 and 120),
  body        text not null default '' check (length(body) <= 4000),
  status      text not null default 'open' check (status in ('open', 'planned', 'in_progress', 'done', 'wont_do')),
  app_version text check (length(app_version) <= 20),
  device      text check (length(device) <= 200),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists feedback_posts_created on public.feedback_posts (created_at desc);

create table if not exists public.feedback_votes (
  post_id    uuid not null references public.feedback_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.feedback_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.feedback_posts(id) on delete cascade,
  author     uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  body       text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists feedback_comments_post on public.feedback_comments (post_id, created_at);

alter table public.feedback_posts    enable row level security;
alter table public.feedback_votes    enable row level security;
alter table public.feedback_comments enable row level security;

-- Everyone signed in can read the board.
drop policy if exists "fb read"   on public.feedback_posts;
drop policy if exists "fb add"    on public.feedback_posts;
drop policy if exists "fb edit"   on public.feedback_posts;
drop policy if exists "fb del"    on public.feedback_posts;
create policy "fb read" on public.feedback_posts for select to authenticated using (true);
-- New posts are yours and start as "open".
create policy "fb add"  on public.feedback_posts for insert to authenticated
  with check (author = auth.uid() and status = 'open');
-- Authors can edit their own title/text (status is changed only via set_feedback_status).
create policy "fb edit" on public.feedback_posts for update to authenticated
  using (author = auth.uid()) with check (author = auth.uid());
create policy "fb del"  on public.feedback_posts for delete to authenticated
  using (author = auth.uid() or public.is_admin());
revoke all on public.feedback_posts from anon, authenticated;
grant select, insert, delete on public.feedback_posts to authenticated;
grant update (kind, title, body, updated_at) on public.feedback_posts to authenticated;

drop policy if exists "vote read" on public.feedback_votes;
drop policy if exists "vote add"  on public.feedback_votes;
drop policy if exists "vote del"  on public.feedback_votes;
create policy "vote read" on public.feedback_votes for select to authenticated using (true);
create policy "vote add"  on public.feedback_votes for insert to authenticated with check (user_id = auth.uid());
create policy "vote del"  on public.feedback_votes for delete to authenticated using (user_id = auth.uid());
revoke all on public.feedback_votes from anon, authenticated;
grant select, insert, delete on public.feedback_votes to authenticated;

drop policy if exists "fbc read" on public.feedback_comments;
drop policy if exists "fbc add"  on public.feedback_comments;
drop policy if exists "fbc del"  on public.feedback_comments;
create policy "fbc read" on public.feedback_comments for select to authenticated using (true);
create policy "fbc add"  on public.feedback_comments for insert to authenticated with check (author = auth.uid());
create policy "fbc del"  on public.feedback_comments for delete to authenticated
  using (author = auth.uid() or public.is_admin());
revoke all on public.feedback_comments from anon, authenticated;
grant select, insert, delete on public.feedback_comments to authenticated;

-- Only the owner can change a post's status.
create or replace function public.set_feedback_status(p_post uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only the app owner can change the status'; end if;
  update feedback_posts set status = p_status, updated_at = now() where id = p_post;
end $$;
revoke all on function public.set_feedback_status(uuid, text) from public, anon;
grant execute on function public.set_feedback_status(uuid, text) to authenticated;
grant execute on function public.is_admin() to authenticated;
