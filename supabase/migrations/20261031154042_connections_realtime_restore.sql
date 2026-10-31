-- Undoes 20261031153922_connections_not_realtime: the memory saving was too small to be worth it,
-- so `connections` goes back into the Realtime publication and the app subscribes to it again.
alter publication supabase_realtime add table public.connections;
