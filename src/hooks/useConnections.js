/**
 * Live view of the user's provider connections (strava / garmin).
 * Returns a map keyed by provider, e.g. { strava: {status, last_synced_at, ...} }.
 * Only non-secret columns exist in this table (tokens live in provider_tokens).
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export function useConnections(userId) {
  const [connections, setConnections] = useState({});
  const [loaded, setLoaded] = useState(false); // false until the first fetch has answered

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('connections').select('*');
    if (error) return; // keep what we have; "loaded" stays false so nothing is decided from a failed read
    setConnections(Object.fromEntries((data ?? []).map((c) => [c.provider, c])));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    reload();

    const channel = supabase
      .channel(`connections:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connections', filter: `user_id=eq.${userId}` },
        // Simplest correct approach for a 2-row table: refetch on any change
        // (also covers DELETE, whose payload lacks provider).
        () => reload(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, reload]);

  return { connections, loaded, reload };
}
