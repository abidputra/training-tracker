-- =============================================================================
-- init_training_tracker  |  Training Tracker core schema
--
-- Tables
--   connections      one row per (user, provider). Non-secret metadata only,
--                    readable by the owner (status, last sync, etc.).
--   provider_tokens  OAuth / session secrets. RLS is ON with NO policies, so
--                    only the service role (Edge Functions, Garmin service)
--                    can read or write it. The browser never sees tokens.
--   activities       normalized workouts from every provider. Owner can read,
--                    only the service role can write.
--
-- Realtime: activities + connections are published so the PWA updates live.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- connections
-- -----------------------------------------------------------------------------
create table public.connections (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  provider       text not null check (provider in ('strava', 'garmin')),
  -- Strava athlete id. Unique per provider so one Strava account can't be
  -- linked to two app users (webhooks map owner_id -> exactly one user).
  external_id    text,
  status         text not null default 'active'
                 check (status in ('active', 'needs_reauth', 'error')),
  last_synced_at timestamptz,
  last_error     text,
  created_at     timestamptz not null default now(),
  unique (user_id, provider),
  unique (provider, external_id)
);

-- -----------------------------------------------------------------------------
-- provider_tokens  (service role only)
-- -----------------------------------------------------------------------------
create table public.provider_tokens (
  connection_id uuid primary key references public.connections(id) on delete cascade,
  -- Strava
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  -- Garmin: Fernet-encrypted garmin_tokens.json (encrypted by the Garmin
  -- service, so even a DB leak does not expose usable Garmin sessions).
  token_blob    text
);

-- -----------------------------------------------------------------------------
-- activities
-- -----------------------------------------------------------------------------
create table public.activities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  provider         text not null check (provider in ('strava', 'garmin')),
  external_id      text not null,
  name             text,
  sport_type       text,
  start_time       timestamptz not null,
  distance_m       double precision,
  -- double precision on purpose: Garmin returns fractional seconds.
  moving_time_s    double precision,
  elapsed_time_s   double precision,
  elevation_gain_m double precision,
  avg_hr           double precision,
  max_hr           double precision,
  avg_speed_mps    double precision,
  calories         double precision,
  raw              jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Idempotency: webhook retries and re-syncs upsert onto this key.
  unique (user_id, provider, external_id)
);

create index activities_user_start_idx on public.activities (user_id, start_time desc);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.connections     enable row level security;
alter table public.provider_tokens enable row level security;  -- no policies = locked
alter table public.activities      enable row level security;

create policy "owner can read own connections"
  on public.connections for select
  using ((select auth.uid()) = user_id);

create policy "owner can read own activities"
  on public.activities for select
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- Realtime
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.activities;
alter publication supabase_realtime add table public.connections;
