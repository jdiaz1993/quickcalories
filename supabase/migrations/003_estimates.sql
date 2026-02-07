-- QuickCalories: estimates table (schema v2)
--
-- How to run:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Paste this file and click Run
--
-- Or with Supabase CLI:
--   supabase db push
--   (or: supabase migration up)

-- Drop existing estimates if present (from 001) so we can recreate with full schema
drop table if exists public.estimates cascade;

create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meal text not null,
  portion text not null check (portion in ('small', 'medium', 'large')),
  details text,
  calories int not null,
  protein_g int not null,
  carbs_g int not null,
  fat_g int not null,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index estimates_user_id_created_at_idx
  on public.estimates (user_id, created_at desc);

alter table public.estimates enable row level security;

create policy "estimates_select_own"
  on public.estimates for select
  using (auth.uid() = user_id);

create policy "estimates_insert_own"
  on public.estimates for insert
  with check (auth.uid() = user_id);

create policy "estimates_update_own"
  on public.estimates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "estimates_delete_own"
  on public.estimates for delete
  using (auth.uid() = user_id);
