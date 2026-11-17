-- Garmin's current running VO2max (one decimal), saved with the daily wellness rows.
-- Until now the app read the value stored on the latest activity, which Garmin rounds to a whole
-- number and which lags behind the figure the watch and Garmin Connect show.
alter table public.daily_metrics add column if not exists vo2max double precision;
