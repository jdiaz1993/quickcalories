-- Provider and updated_at for RevenueCat (and other providers).
alter table public.subscriptions
  add column if not exists provider text,
  add column if not exists updated_at timestamptz default now();
