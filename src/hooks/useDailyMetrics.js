/**
 * Daily wellness rows (HRV, sleep, weight) from `daily_metrics`, kept live.
 * Oldest first. Each row gets `t` (local midnight of its calendar day, ms) so
 * it can share chart and window helpers with runs.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const LOOKBACK_DAYS = 200;

const withT = (row) => ({ ...row, t: new Date(`${row.day}T00:00:00`).getTime() });

async function fetchDaily() {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('daily_metrics')
    .select('*')
    .gte('day', since)
    .order('day', { ascending: true });
  if (error) throw error;
  return data.map(withT);
}

export function useDailyMetrics(userId) {
  const [days, setDays] = useState([]);

  const reload = useCallback(async () => {
    if (!userId) return;
    setDays(await fetchDaily());
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    let timer = null;

    fetchDaily()
      .then((rows) => !cancelled && setDays(rows))
      .catch((e) => console.error('loading daily metrics failed:', e.message));

    // A sync upserts a few rows at once; refetch once per burst (the table is small).
    const channel = supabase
      .channel(`daily_metrics:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_metrics', filter: `user_id=eq.${userId}` },
        () => {
          clearTimeout(timer);
          timer = setTimeout(() => fetchDaily().then((rows) => !cancelled && setDays(rows)).catch(() => {}), 500);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { days, reload };
}
