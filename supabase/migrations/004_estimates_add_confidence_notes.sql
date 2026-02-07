-- Add confidence and notes columns if missing (for setups that ran 001 but not 003)
alter table public.estimates add column if not exists confidence text default 'medium';
alter table public.estimates add column if not exists notes text default '';
