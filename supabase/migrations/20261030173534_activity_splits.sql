-- =============================================================================
-- activity_splits  |  Laps and per-km splits of an activity (run detail screen)
--
-- Filled on demand by the Garmin service the first time a run's detail is
-- opened, then cached here (like activity_routes). The owner can read, only the
-- service role writes.
--
--   laps    what the watch recorded:
--           [{ n, intensity, trigger, dist (m), time (s), hr (bpm|null) }, ...]
--   splits  true kilometre splits worked out from the activity's time series:
--           [{ n, dist (m), time (s), hr (bpm|null) }, ...]
-- Both EMPTY = Garmin has nothing for this activity, so we do not ask again.
-- =============================================================================

create table public.activity_splits (
  activity_id uuid primary key references public.activities(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  laps        jsonb not null default '[]'::jsonb,
  splits      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create index activity_splits_user_idx on public.activity_splits (user_id);

alter table public.activity_splits enable row level security;

create policy "owner can read own splits"
  on public.activity_splits for select
  using ((select auth.uid()) = user_id);
