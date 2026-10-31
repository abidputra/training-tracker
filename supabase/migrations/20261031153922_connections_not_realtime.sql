-- The app now polls `connections` instead of subscribing to it (2 rows per user, a few changes
-- a day), so it no longer needs to be in the Realtime publication.
alter publication supabase_realtime drop table public.connections;
