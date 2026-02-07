-- QuickCalories: run this once in Supabase Dashboard → SQL Editor → New query → Run
-- https://supabase.com/dashboard/project/xmacksajgsigliuxactf/sql/new

-- 1. PROFILES
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. SUBSCRIPTIONS
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null,
  price_id text,
  current_period_end timestamptz
);
create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
alter table public.subscriptions enable row level security;
create policy "subscriptions_select_own" on public.subscriptions for select using (auth.uid() = user_id);

-- 3. ESTIMATES (full schema for history)
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
create index estimates_user_id_created_at_idx on public.estimates (user_id, created_at desc);
alter table public.estimates enable row level security;
create policy "estimates_select_own" on public.estimates for select using (auth.uid() = user_id);
create policy "estimates_insert_own" on public.estimates for insert with check (auth.uid() = user_id);
create policy "estimates_update_own" on public.estimates for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "estimates_delete_own" on public.estimates for delete using (auth.uid() = user_id);

-- 4. Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
