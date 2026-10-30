/**
 * Activity detail, laid out like Garmin's: headline numbers, then a details
 * list. The map (GPX) is left out on purpose. The full provider payload is
 * loaded here (`raw`), since the history list does not fetch it.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { activityKind, exerciseRows, exercisesOf, headlineStats, routeExpected, summaryRows } from '../lib/activityStats.js';
import { muscleLoad } from '../lib/muscles.js';
import { useRoute } from '../hooks/useRoute.js';
import { sportInfo } from '../lib/format.js';
import { supabase } from '../lib/supabase.js';
import RouteLine from './RouteLine.jsx';
import Spinner from './Spinner.jsx';

// The body figures are large: only download them when a workout has muscles to show.
const MuscleMap = lazy(() => import('./MuscleMap.jsx'));

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
  const exercises = useMemo(() => exerciseRows(activity, raw), [activity, raw]);
  const muscles = useMemo(() => muscleLoad(exercisesOf(activity, raw)), [activity, raw]);
  const hasMuscles = Object.keys(muscles.scores).length > 0;
  const isDistance = activityKind(activity) === 'distance';
  const wantsRoute = routeExpected(activity);
  const route = useRoute(activity.id, wantsRoute);

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

      {wantsRoute && route.status !== 'none' && (
        <section className="rounded-2xl bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-400">Route</h2>
          {route.status === 'loading' && (
            <p className="flex items-center gap-2 py-2 text-sm text-slate-500">
              <Spinner /> Loading route…
            </p>
          )}
          {route.status === 'error' && (
            <div className="flex items-center justify-between gap-3 py-1 text-sm">
              <span className="text-red-400">Could not load the route: {route.error}</span>
              <button
                onClick={route.retry}
                className="shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 text-slate-200 ring-1 ring-slate-700"
              >
                Try again
              </button>
            </div>
          )}
          {route.status === 'ready' && <RouteLine points={route.points} />}
        </section>
      )}

      {hasMuscles && (
        <section className="rounded-2xl bg-slate-900 p-4">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">Muscles worked</h2>
          <Suspense
            fallback={
              <p className="flex items-center gap-2 py-2 text-sm text-slate-500">
                <Spinner /> Loading…
              </p>
            }
          >
            <MuscleMap scores={muscles.scores} />
          </Suspense>
          {muscles.unmatchedSets > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              {muscles.unmatchedSets} of {muscles.matchedSets + muscles.unmatchedSets} sets are not included: Garmin
              could not identify those exercises.
            </p>
          )}
        </section>
      )}

      {exercises.length > 0 && (
        <section className="rounded-2xl bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-400">Exercises</h2>
          <ul className="divide-y divide-slate-800">
            {exercises.map((e, i) => (
              <li key={i} className="flex items-start justify-between gap-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="text-slate-100">{e.name}</div>
                  {e.detail && <div className="text-xs text-slate-400">{e.detail}</div>}
                </div>
                <div className="shrink-0 text-right text-xs tabular-nums text-slate-400">
                  {e.weight && <div>{e.weight}</div>}
                  {e.volume && <div className="text-slate-300">{e.volume}</div>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

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

      {isDistance && (
        <p className="px-1 text-xs text-slate-500">Laps, splits and pace or heart-rate charts are coming soon.</p>
      )}
    </div>
  );
}
