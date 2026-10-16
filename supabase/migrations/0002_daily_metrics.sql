-- =============================================================================
-- 0002_daily_metrics.sql  |  Daily wellness numbers (one row per user per day)
--
-- Filled by the Garmin service on every sync: HRV status, sleep score and
-- body weight. Same access model as `activities`: the owner can read, only
-- the service role writes. Published to Realtime so the PWA updates live.
-- =============================================================================

create table public.daily_metrics (
  user_id            uuid not null references auth.users(id) on delete cascade,
  day                date not null,              -- Garmin calendar date (user's local day)
  provider           text not null default 'garmin' check (provider in ('garmin')),
  -- HRV (ms), from the overnight reading
  hrv_last_night     double precision,
  hrv_weekly_avg     double precision,
  hrv_status         text,                       -- BALANCED | UNBALANCED | LOW | POOR | NONE
  hrv_baseline_low   double precision,           -- balanced range lower bound
  hrv_baseline_high  double precision,           -- balanced range upper bound
  -- Sleep
  sleep_score        double precision,           -- 0..100
  sleep_quality      text,                       -- EXCELLENT | GOOD | FAIR | POOR
  sleep_seconds      double precision,
  resting_hr         double precision,
  -- Body
  weight_kg          double precision,
  weight_source      text check (weight_source in ('weigh_in', 'profile')),
  updated_at         timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.daily_metrics enable row level security;

create policy "owner can read own daily metrics"
  on public.daily_metrics for select
  using (auth.uid() = user_id);

alter publication supabase_realtime add table public.daily_metrics;
