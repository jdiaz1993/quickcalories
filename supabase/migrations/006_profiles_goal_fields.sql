-- Extend profiles with daily macro goals
alter table public.profiles add column if not exists daily_calories_goal integer default 2000;
alter table public.profiles add column if not exists daily_protein_goal integer default 150;
alter table public.profiles add column if not exists daily_carbs_goal integer default 200;
alter table public.profiles add column if not exists daily_fat_goal integer default 70;

-- Backfill defaults where NULL
update public.profiles set daily_calories_goal = 2000 where daily_calories_goal is null;
update public.profiles set daily_protein_goal = 150 where daily_protein_goal is null;
update public.profiles set daily_carbs_goal = 200 where daily_carbs_goal is null;
update public.profiles set daily_fat_goal = 70 where daily_fat_goal is null;
