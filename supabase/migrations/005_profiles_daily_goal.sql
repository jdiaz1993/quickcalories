-- Add daily_goal to profiles for Daily Calorie Goal feature
alter table public.profiles
add column if not exists daily_goal integer;

-- optional: set a default
update public.profiles set daily_goal = 2000 where daily_goal is null;
