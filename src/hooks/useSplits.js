/**
 * Laps and per-km splits of one activity. Reads the cached rows from
 * `activity_splits` (RLS: own rows only); if they are not cached yet, asks the
 * Garmin service, which fetches them once and stores them.
 *
 * status: 'loading' | 'ready' | 'none' (Garmin has nothing) | 'error'
 * `laps` / `splits` are the lists described in garmin-service/app/splits.py.
 */
import { useCallback, useEffect, useState } from 'react';
import { garminApi } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';

async function loadSplits(activityId) {
  const { data, error } = await supabase
    .from('activity_splits')
    .select('laps,splits')
    .eq('activity_id', activityId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;
  return garminApi(`/garmin/activities/${activityId}/splits`, { method: 'GET' });
}

export function useSplits(activityId, enabled) {
  const [state, setState] = useState({ status: 'loading', laps: [], splits: [], error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setState({ status: 'loading', laps: [], splits: [], error: null });
    loadSplits(activityId)
      .then((res) => {
        if (cancelled) return;
        const laps = Array.isArray(res.laps) ? res.laps : [];
        const splits = Array.isArray(res.splits) ? res.splits : [];
        setState({ status: laps.length || splits.length ? 'ready' : 'none', laps, splits, error: null });
      })
      .catch((e) => {
        if (!cancelled) setState({ status: 'error', laps: [], splits: [], error: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [activityId, enabled, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
