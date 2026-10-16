/**
 * Every activity of the user (all sports, not only runs) for the Activity
 * History list. Only the summary columns are loaded here. The full provider
 * payload (`raw`) is fetched by ActivityDetail when a card is opened.
 *
 * Loads when `enabled` becomes true, so opening the view always shows fresh
 * data. Realtime is not used here; pull-to-refresh calls `reload`.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const PAGE = 1000; // Supabase's default max rows per request
const MAX_ROWS = 20000;
const COLUMNS = [
  'id', 'provider', 'external_id', 'sport_type', 'name', 'start_time',
  'distance_m', 'moving_time_s', 'elapsed_time_s', 'elevation_gain_m',
  'avg_hr', 'max_hr', 'avg_speed_mps', 'calories',
  // lifted out of `raw` for strength-style workouts (null for everything else)
  'duration:raw->duration',
  'sets:raw->totalSets',
  'reps:raw->totalReps',
  'exercises:raw->summarizedExerciseSets',
].join(',');

async function fetchAllActivities() {
  const all = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await supabase
      .from('activities')
      .select(COLUMNS)
      .order('start_time', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

export function useActivityHistory(userId, enabled) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setItems(await fetchAllActivities());
      setError(null);
    } catch (e) {
      console.error('loading activity history failed:', e.message);
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (enabled) reload().catch(() => {});
  }, [enabled, reload]);

  return { items, loading, error, reload };
}
