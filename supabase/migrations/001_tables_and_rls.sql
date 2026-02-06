-- QuickCalories: profiles, subscriptions, estimates + RLS
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

-- =============================================================================
-- 1. PROFILES
-- =============================================================================
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text
);

alter table public.profiles enable row level security;

-- User can select only their row
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = user_id);

-- User can insert their row (e.g. on first signup)
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

-- User can update only their row
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- 2. SUBSCRIPTIONS
-- =============================================================================
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null,
  price_id text,
  current_period_end timestamptz
);

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;

-- User can select only their rows
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- =============================================================================
-- 3. ESTIMATES
-- =============================================================================
create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meal text not null,
  portion text,
  details text,
  calories int,
  protein_g int,
  carbs_g int,
  fat_g int,
  created_at timestamptz not null default now()
);

create index if not exists estimates_user_id_idx on public.estimates (user_id);
create index if not exists estimates_created_at_idx on public.estimates (created_at desc);

alter table public.estimates enable row level security;

-- User can select only their rows
create policy "estimates_select_own"
  on public.estimates for select
  using (auth.uid() = user_id);

-- User can insert only their rows
create policy "estimates_insert_own"
  on public.estimates for insert
  with check (auth.uid() = user_id);

-- User can update only their rows
create policy "estimates_update_own"
  on public.estimates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- User can delete only their rows
create policy "estimates_delete_own"
  on public.estimates for delete
  using (auth.uid() = user_id);

-- =============================================================================
-- Optional: auto-create profile on signup (trigger)
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
