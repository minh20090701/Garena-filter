-- OPTIONAL. Run only in your own Supabase project.
-- WARNING: This table stores user-supplied data as plaintext JSON.
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{"accounts":[],"sets":{}}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;
revoke all on public.user_data from anon;
grant select, insert, update on public.user_data to authenticated;

drop policy if exists "Owners can read their data" on public.user_data;
drop policy if exists "Owners can insert their data" on public.user_data;
drop policy if exists "Owners can update their data" on public.user_data;
create policy "Owners can read their data" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners can insert their data" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owners can update their data" on public.user_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
