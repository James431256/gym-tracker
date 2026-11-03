-- Gym Tracker tables. Paste this into the Supabase SQL editor and run it once.
-- Row level security means each signed-in person only ever sees their own rows.

-- One row per finished workout. Sets live in the exercises column as JSON:
-- [{ "name": "Bicep Curls", "sets": [{ "weight": 20, "reps": 10 }] }]
create table if not exists public.workouts (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  type text not null,
  date timestamptz not null,
  exercises jsonb not null default '[]'::jsonb,
  -- Which of your gyms (from settings.gyms) it was at; empty for older workouts
  gym_id text,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Added after the first release, for projects set up before gyms
alter table public.workouts add column if not exists gym_id text;

create index if not exists workouts_user_date on public.workouts (user_id, date desc);

-- Plans, settings and the exercises you've added to each muscle
create table if not exists public.user_data (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  exercises jsonb,
  custom_plans jsonb,
  settings jsonb,
  muscle_exercises jsonb,
  updated_at timestamptz not null default now()
);

alter table public.workouts enable row level security;
alter table public.user_data enable row level security;

drop policy if exists "Own workouts" on public.workouts;
create policy "Own workouts" on public.workouts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Own data" on public.user_data;
create policy "Own data" on public.user_data
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, update, delete on public.user_data to authenticated;
