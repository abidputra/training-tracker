/**
 * Loads ALL of the user's runs (paged) and keeps them live.
 *
 * Flow: paged initial SELECT, then a Supabase Realtime subscription. When a
 * Strava webhook or Garmin sync upserts a row, Postgres broadcasts the change
 * and the dashboard updates, no polling or refresh needed. Events are batched
 * (a full-history import arrives as hundreds of rows in a few seconds).
 *
 * RLS applies to Realtime too, so only the signed-in user's rows arrive.
 * (DELETE events carry only the primary key `id`, which is all we need.)
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const PAGE = 1000; // Supabase's default max rows per request
const MAX_ROWS = 20000;
const RUN_TYPES = ['running', 'treadmill_running', 'track_running', 'trail_running', 'virtual_run'];
const isRun = (a) => RUN_TYPES.includes((a.sport_type ?? '').toLowerCase());

// Explicit columns + a few JSON fields lifted out of `raw`, so we don't pull
// every full Garmin/Strava payload to the browser just for the analysis.
const COLUMNS = [
  'id', 'provider', 'sport_type', 'name', 'start_time',
  'distance_m', 'moving_time_s', 'avg_hr', 'max_hr', 'avg_speed_mps',
  'cadence:raw->averageRunningCadenceInStepsPerMinute',
  'stride:raw->avgStrideLength',
  'vosc:raw->avgVerticalOscillation',
  'gct:raw->avgGroundContactTime',
  'vratio:raw->avgVerticalRatio',
  'power:raw->avgPower',
  'vo2max:raw->vO2MaxValue',
  'te:raw->aerobicTrainingEffect',
  // Strava summaries: cadence is per leg (x2 = steps/min), watts if a power meter was used
  'scadence:raw->average_cadence',
  'swatts:raw->average_watts',
].join(',');

const byNewest = (a, b) => new Date(b.start_time) - new Date(a.start_time);

/** Upserts `incoming` rows into `list` by id and removes `removedIds`. */
function merge(list, incoming, removedIds = []) {
  const map = new Map(list.map((a) => [a.id, a]));
  removedIds.forEach((id) => map.delete(id));
  incoming.forEach((a) => map.set(a.id, a));
  return [...map.values()].sort(byNewest);
}

async function fetchAllRuns() {
  const all = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await supabase
      .from('activities')
      .select(COLUMNS)
      .in('sport_type', RUN_TYPES)
      .order('start_time', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

export function useActivities(userId) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    let upserts = [];
    let removals = [];
    let timer = null;

    const flush = () => {
      timer = null;
      const up = upserts;
      const rm = removals;
      upserts = [];
      removals = [];
      setActivities((prev) => merge(prev, up, rm));
    };

    fetchAllRuns()
      .then((rows) => {
        if (cancelled) return;
        // merge, not replace: realtime events may already have arrived
        setActivities((prev) => merge(rows, prev));
      })
      .catch((e) => console.error('loading activities failed:', e.message))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const channel = supabase
      .channel(`activities:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activities', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') removals.push(payload.old.id);
          else if (isRun(payload.new)) upserts.push(payload.new);
          else return;
          if (!timer) timer = setTimeout(flush, 400);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Manual refresh (pull-to-refresh / refresh button): refetch everything.
  // Realtime keeps things live, but a phone that slept may have missed events.
  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      setActivities(await fetchAllRuns());
    } catch (e) {
      console.error('reloading activities failed:', e.message);
      throw e;
    }
  }, [userId]);

  return { activities, loading, reload };
}
