-- One subscription row per user for webhook upsert (onConflict: user_id).
-- Run in Supabase SQL editor if you already applied 001_tables_and_rls.sql.

alter table public.subscriptions
  add constraint subscriptions_user_id_key unique (user_id);
