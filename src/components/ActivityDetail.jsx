/**
 * Activity detail, laid out like Garmin's: headline numbers, the route (as a
 * dot drawing, no map) or the muscles worked, exercises, then a details list.
 * The full provider payload is loaded here (`raw`), since the history list
 * does not fetch it.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { activityKind, exerciseRows, exercisesOf, headlineStats, routeExpected, summaryRows } from '../lib/activityStats.js';
import { muscleLoad } from '../lib/muscles.js';
import { meter } from '../lib/dots.js';
import { useRoute } from '../hooks/useRoute.js';
import { sportInfo } from '../lib/format.js';
import { supabase } from '../lib/supabase.js';
import RouteLine from './RouteLine.jsx';
import DotGrid from './DotGrid.jsx';
import Spinner from './Spinner.jsx';
import { DetailHeader, StatStrip, splitUnit } from './ui.jsx';

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

  const headline = headlineStats(activity);
  // the "main" number in the accent: distance for a run, volume for a workout
  const accentLabel = isDistance ? 'Distance' : 'Volume';
  const stats = headline.map(([label, value]) => {
    const { value: v, unit } = splitUnit(value);
    return { label: label.toUpperCase(), value: v, unit: label === 'Time' ? 'min' : label === 'Sets' ? 'total' : unit, accent: label === accentLabel };
  });
  const topVolume = Math.max(0, ...exercises.map((e) => e.volumeG ?? 0));

  const loadingLine = (text) => (
    <p className="m-0 flex items-center gap-2 py-2 text-sm text-muted">
      <Spinner /> {text}
    </p>
  );
  const sectionTitle = (text, note) => (
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="eyebrow m-0 font-normal">{text}</h2>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );

  return (
    <div className="flex flex-col gap-7">
      <DetailHeader
        title={title}
        sub={
          <>
            {when} · <span className="capitalize">{info.label}</span> · {provider}
          </>
        }
        onBack={onBack}
        backLabel="Back to history"
      />

      <StatStrip stats={stats} />

      {wantsRoute && route.status !== 'none' && (
        <section className="flex flex-col gap-3">
          {sectionTitle('Route', 'GPS · GPX')}
          <div className="card p-5">
            {route.status === 'loading' && loadingLine('Loading route…')}
            {route.status === 'error' && (
              <div className="flex items-center justify-between gap-3 py-1 text-sm">
                <span className="text-accent">Could not load the route: {route.error}</span>
                <button onClick={route.retry} className="btn shrink-0">
                  Try again
                </button>
              </div>
            )}
            {route.status === 'ready' && (
              <RouteLine points={route.points} distance={headline[0]?.[1]} name={title} start={activity.start_time} />
            )}
          </div>
        </section>
      )}

      {hasMuscles && (
        <section className="flex flex-col gap-3">
          {sectionTitle('Muscles Worked')}
          <div className="card p-5">
            <Suspense fallback={loadingLine('Loading…')}>
              <MuscleMap scores={muscles.scores} />
            </Suspense>
            {muscles.unmatchedSets > 0 && (
              <p className="m-0 mt-3 text-xs text-muted">
                {muscles.unmatchedSets} of {muscles.matchedSets + muscles.unmatchedSets} sets are not included: Garmin
                could not identify those exercises.
              </p>
            )}
          </div>
        </section>
      )}

      {exercises.length > 0 && (
        <section className="flex flex-col gap-3">
          {sectionTitle('Exercises', topVolume ? 'Bar = share of volume' : null)}
          <div className="card px-5 py-1">
            {exercises.map((e, i) => (
              <div key={i} className={`flex flex-col gap-3 py-4 ${i < exercises.length - 1 ? 'rule' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm">{e.name}</span>
                    {e.detail && <span className="text-xs text-muted">{e.detail}</span>}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 text-right tabular-nums">
                    {e.weight && <span className="text-xs text-muted">{e.weight}</span>}
                    {e.volume && <span className="text-sm font-bold">{e.volume}</span>}
                  </div>
                </div>
                {topVolume > 0 && e.volumeG && (
                  <DotGrid
                    grid={meter(Math.max(1, (e.volumeG / topVolume) * 24), 24, { lit: e.volumeG === topVolume ? 'acc' : 'on' })}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        {sectionTitle('Details')}
        <div className="card px-5 py-1">
          {error && <p className="m-0 py-3 text-sm text-accent">Could not load details: {error}</p>}
          {!error && raw === undefined && loadingLine('Loading details…')}
          {raw !== undefined && rows.length === 0 && (
            <p className="m-0 py-3 text-sm text-muted">No further details for this activity.</p>
          )}
          <dl className="m-0">
            {rows.map(([label, value], i) => (
              <div
                key={label}
                className={`flex min-h-12 items-baseline justify-between gap-3 py-3 text-sm ${i < rows.length - 1 ? 'rule' : ''}`}
              >
                <dt className="text-[#b5b5b5]">{label}</dt>
                <dd className="m-0 text-right font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {isDistance && <p className="m-0 text-xs leading-relaxed text-muted">Laps, splits and pace or heart-rate charts are coming soon.</p>}
    </div>
  );
}
