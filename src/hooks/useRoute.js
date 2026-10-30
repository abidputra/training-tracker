/**
 * GPS route of one activity. Reads the cached track from `activity_routes`
 * (RLS: own rows only); if it is not cached yet, asks the Garmin service, which
 * downloads the GPX once and stores it.
 *
 * status: 'loading' | 'ready' | 'none' (no GPS recorded) | 'error'
 */
import { useCallback, useEffect, useState } from 'react';
import { garminApi } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';

async function loadRoute(activityId) {
  const { data, error } = await supabase
    .from('activity_routes')
    .select('points')
    .eq('activity_id', activityId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data.points;
  const res = await garminApi(`/garmin/activities/${activityId}/route`, { method: 'GET' });
  return res.points;
}

export function useRoute(activityId, enabled) {
  const [state, setState] = useState({ status: 'loading', points: [], error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setState({ status: 'loading', points: [], error: null });
    loadRoute(activityId)
      .then((points) => {
        if (cancelled) return;
        const list = Array.isArray(points) ? points : [];
        setState({ status: list.length > 1 ? 'ready' : 'none', points: list, error: null });
      })
      .catch((e) => {
        if (!cancelled) setState({ status: 'error', points: [], error: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [activityId, enabled, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
