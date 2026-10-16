/**
 * Activity detail, laid out like Garmin's: headline numbers, then a details
 * list. The map (GPX) is left out on purpose. The full provider payload is
 * loaded here (`raw`), since the history list does not fetch it.
 */
import { useEffect, useMemo, useState } from 'react';
import { headlineStats, summaryRows } from '../lib/activityStats.js';
import { sportInfo } from '../lib/format.js';
import { supabase } from '../lib/supabase.js';
import Spinner from './Spinner.jsx';

export default function ActivityDetail({ activity, onBack }) {
  const [raw, setRaw] = useState(undefined); // undefined = still loading
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('activities')
      .select('raw')
      .eq('id', activity.id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setRaw(data?.raw ?? {});
      });
    return () => {
      cancelled = true;
    };
  }, [activity.id]);

  const info = sportInfo(activity.sport_type);
  const provider = activity.provider === 'strava' ? 'Strava' : 'Garmin';
  const title = activity.name || info.label;
  const when = new Date(activity.start_time).toLocaleString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const rows = useMemo(() => summaryRows(activity, raw), [activity, raw]);

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="Back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-lg text-slate-200 ring-1 ring-slate-700 active:bg-slate-700"
        >
          ‹
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-white">{title}</h1>
          <p className="truncate text-xs text-slate-400">
            {when} · <span className="capitalize">{info.label}</span> · {provider}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-900 p-4">
        {headlineStats(activity).map(([label, value]) => (
          <div key={label} className="text-center">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-white">{value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-slate-900 p-4">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-400">Details</h2>

        {error && <p className="text-sm text-red-400">Could not load details: {error}</p>}
        {!error && raw === undefined && (
          <p className="flex items-center gap-2 py-2 text-sm text-slate-500">
            <Spinner /> Loading details…
          </p>
        )}
        {raw !== undefined && rows.length === 0 && (
          <p className="py-2 text-sm text-slate-500">No further details for this activity.</p>
        )}

        <dl className="divide-y divide-slate-800">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <dt className="text-slate-400">{label}</dt>
              <dd className="tabular-nums text-slate-100">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="px-1 text-xs text-slate-500">Laps, splits and pace or heart-rate charts are coming soon.</p>
    </div>
  );
}
