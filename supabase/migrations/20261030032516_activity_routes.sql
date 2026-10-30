-- =============================================================================
-- activity_routes  |  GPS track of an activity, for the route map
--
-- Filled on demand by the Garmin service the first time a run's detail is
-- opened (GPX download from Garmin, thinned to about 1,000 points), then
-- cached here. Same access model as `activities`: the owner can read, only the
-- service role writes.
--
-- points: [[lat, lon, elevation_m], ...] in recording order. An EMPTY array
-- means "Garmin has no GPS track for this activity" (treadmill, indoor...), so
-- we do not ask Garmin again.
-- =============================================================================

create table public.activity_routes (
  activity_id uuid primary key references public.activities(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  points      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create index activity_routes_user_idx on public.activity_routes (user_id);

alter table public.activity_routes enable row level security;

create policy "owner can read own routes"
  on public.activity_routes for select
  using ((select auth.uid()) = user_id);
