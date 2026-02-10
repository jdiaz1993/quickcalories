-- Stripe IDs on subscriptions for webhook sync (customer + subscription).
alter table public.subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;
