/**
 * Loads the user's latest activities and keeps them live.
 *
 * Flow: initial SELECT, then a Supabase Realtime subscription. When a Strava
 * webhook or Garmin sync upserts a row, Postgres broadcasts the change and the
 * list updates instantly, no polling or refresh needed.
 *
 * RLS applies to Realtime too, so only the signed-in user's rows arrive.
 * (DELETE events carry only the primary key `id`, which is all we need.)
 */
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const LIMIT = 500;

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
].join(',');
const byNewest = (a, b) => new Date(b.start_time) - new Date(a.start_time);

export function useActivities(userId) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;

    supabase
      .from('activities')
      .select(COLUMNS)
      .order('start_time', { ascending: false })
      .limit(LIMIT)
      .then(({ data }) => {
        if (cancelled) return;
        setActivities(data ?? []);
        setLoading(false);
      });

    const channel = supabase
      .channel(`activities:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activities', filter: `user_id=eq.${userId}` },
        (payload) => {
          setActivities((prev) => {
            if (payload.eventType === 'DELETE') return prev.filter((a) => a.id !== payload.old.id);
            const rest = prev.filter((a) => a.id !== payload.new.id);
            return [...rest, payload.new].sort(byNewest).slice(0, LIMIT);
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { activities, loading };
}
