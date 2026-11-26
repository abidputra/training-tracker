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
    if (error) return false; // keep what we have; "loaded" stays false so nothing is decided from a failed read
    setConnections(Object.fromEntries((data ?? []).map((c) => [c.provider, c])));
    setLoaded(true);
    return true;
  }, []);

  useEffect(() => {
    // A different account (sign out, then another sign-up in the same tab) must not inherit the
    // previous account's connections, or it would be treated as "already connected" and skip onboarding.
    setConnections({});
    setLoaded(false);
    if (!userId) return undefined;

    // The first read can fail (session not ready, flaky network): retry, or the first-run sheet is never decided.
    let cancelled = false;
    let timer;
    const first = async (attempt) => {
      const ok = await reload();
      if (!ok && !cancelled && attempt < 4) timer = setTimeout(() => first(attempt + 1), 1500 * (attempt + 1));
    };
    first(0);

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
      cancelled = true;
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [userId, reload]);

  return { connections, loaded, reload };
}
