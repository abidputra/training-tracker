/**
 * Activity detail, laid out like Garmin's: headline numbers, the route (as a
 * dot drawing, no map) or the muscles worked, exercises, then a details list.
 * The full provider payload is loaded here (`raw`), since the history list
 * does not fetch it.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { activityKind, exerciseRows, exercisesOf, headlineStats, routeExpected, splitsExpected, summaryRows } from '../lib/activityStats.js';
import { muscleLoad } from '../lib/muscles.js';
import { lapLabels } from '../lib/paceBar.js';
import { genericAssets, runAssets, strengthAssets } from '../lib/shareArt.js';
import { meter } from '../lib/dots.js';
import { useRoute } from '../hooks/useRoute.js';
import { useSplits } from '../hooks/useSplits.js';
import { sportInfo } from '../lib/format.js';
import { supabase } from '../lib/supabase.js';
import RouteLine from './RouteLine.jsx';
import DotGrid from './DotGrid.jsx';
import ShareDialog from './ShareDialog.jsx';
import { KmSplits, Laps } from './Splits.jsx';
import Spinner from './Spinner.jsx';
import { DetailHeader, ShareButton, StatStrip, splitUnit } from './ui.jsx';

// The body figures are large: only download them when a workout has muscles to show.
const MuscleMap = lazy(() => import('./MuscleMap.jsx'));

export default function ActivityDetail({ activity, onBack }) {
  const [raw, setRaw] = useState(undefined); // undefined = still loading
  const [error, setError] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);

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
  const wantsRoute = routeExpected(activity, raw);
  const route = useRoute(activity.id, wantsRoute);
  const wantsSplits = splitsExpected(activity);
  const splits = useSplits(activity.id, wantsSplits);

  const headline = useMemo(() => headlineStats(activity), [activity]);
  // the "main" number in the accent: distance for a run, volume for a workout
  const accentLabel = isDistance ? 'Distance' : 'Volume';
  const stats = headline.map(([label, value]) => {
    const { value: v, unit } = splitUnit(value);
    return { label: label.toUpperCase(), value: v, unit: label === 'Time' ? 'min' : label === 'Sets' ? 'total' : unit, accent: label === accentLabel };
  });
  // desktop shows a fourth number for runs
  if (isDistance && activity.avg_hr > 0) {
    stats.push({ label: 'AVG HEART RATE', value: String(Math.round(activity.avg_hr)), unit: 'bpm', desktopOnly: true });
  }
  const topVolume = Math.max(0, ...exercises.map((e) => e.volumeG ?? 0));

  // The pieces the Share dialog offers. They follow what has loaded: the map needs the route,
  // the tables need the splits.
  const kind = activityKind(activity);
  const assets = useMemo(() => {
    const date = new Date(activity.start_time).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const get = (label) => headline.find(([l]) => l === label)?.[1];
    const num = (text) => splitUnit(text ?? '–');
    if (kind === 'distance') {
      const [distance, time, pace] = headline;
      const ready = splits.status === 'ready';
      return runAssets({
        title,
        date,
        routePoints: route.status === 'ready' ? route.points : null,
        splits: ready ? splits.splits : [],
        laps: ready ? splits.laps.map((l) => ({ ...l, name: lapLabels(l).name })) : [],
        stats: {
          distance: num(distance[1]),
          time: { value: time[1], unit: 'min' },
          pace: num(pace[1]),
          paceLabel: pace[0],
          hr: activity.avg_hr > 0 ? { value: String(Math.round(activity.avg_hr)), unit: 'bpm' } : null,
        },
      });
    }
    if (kind === 'sets') {
      return strengthAssets({
        title,
        date,
        scores: muscles.scores,
        stats: {
          time: { value: get('Time') ?? '–', unit: 'min' },
          sets: { value: num(get('Sets')).value, unit: 'total' },
          volume: num(get('Volume')),
        },
      });
    }
    return genericAssets({
      title,
      date,
      stats: headline.map(([label, value]) => ({ label, ...num(value) })),
    });
  }, [activity, kind, headline, title, route.status, route.points, splits.status, splits.splits, splits.laps, muscles.scores]);
  const fileBase = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'activity'}-${activity.start_time.slice(0, 10)}`;

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

  const routeSection = wantsRoute && route.status !== 'none' && (
    <section className="flex flex-col gap-3">
      {sectionTitle('Route', 'GPS')}
      <div className="card p-5 lg:p-7">
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
          <RouteLine points={route.points} distance={headline[0]?.[1]} />
        )}
      </div>
    </section>
  );

  const musclesSection = hasMuscles && (
    <section className="flex flex-col gap-3">
      {sectionTitle('Muscles Worked')}
      <div className="card p-5 lg:p-7">
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
  );

  const exercisesSection = exercises.length > 0 && (
    <section className="flex flex-col gap-3">
      {sectionTitle('Exercises', topVolume ? 'Bar = share of volume' : null)}
      <div className="card px-5 py-1 lg:px-7">
        {exercises.map((e, i) => (
          <div key={i} className={`flex flex-col gap-3 py-4 lg:gap-3.5 lg:py-5 ${i < exercises.length - 1 ? 'rule' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-sm lg:text-[15px]">{e.name}</span>
                {e.detail && <span className="text-xs text-muted">{e.detail}</span>}
              </div>
              <div className="flex shrink-0 flex-col gap-1 text-right tabular-nums">
                {e.weight && <span className="text-xs text-muted">{e.weight}</span>}
                {e.volume && <span className="text-sm font-bold lg:text-[15px]">{e.volume}</span>}
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
  );

  const detailsSection = (
    <section className="flex flex-col gap-3">
      {sectionTitle('Details')}
      <div className="card px-5 py-1 lg:px-6">
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
  );

  // Km splits and laps. On a phone they sit under the route; on desktop in a row of their own.
  const splitsBlock =
    wantsSplits && splits.status !== 'none' ? (
      splits.status === 'ready' ? (
        <>
          <KmSplits splits={splits.splits} />
          <Laps laps={splits.laps} />
        </>
      ) : (
        <section className="flex flex-col gap-3">
          {sectionTitle('Km splits & laps')}
          <div className="card p-5">
            {splits.status === 'loading' && loadingLine('Loading splits…')}
            {splits.status === 'error' && (
              <div className="flex items-center justify-between gap-3 py-1 text-sm">
                <span className="text-accent">Could not load splits: {splits.error}</span>
                <button onClick={splits.retry} className="btn shrink-0">
                  Try again
                </button>
              </div>
            )}
          </div>
        </section>
      )
    ) : null;

  const noRoute = isDistance && !routeSection;

  return (
    <div className="flex flex-col gap-7 lg:gap-10">
      <DetailHeader
        title={title}
        sub={
          <>
            {when} · <span className="capitalize">{info.label}</span> · {provider}
          </>
        }
        onBack={onBack}
        backLabel="Back to history"
        action={<ShareButton onClick={() => setShareOpen(true)} />}
      />

      <StatStrip stats={stats} />

      {noRoute ? (
        // a run without GPS (treadmill...): no map to anchor the page, so details sit beside the splits
        <div
          className={`grid grid-cols-1 gap-7 lg:items-start lg:gap-6 ${
            splitsBlock ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]' : 'lg:grid-cols-2'
          }`}
        >
          {splitsBlock && <div className="flex flex-col gap-7 lg:order-2">{splitsBlock}</div>}
          <div className="flex flex-col gap-7 lg:order-1">{detailsSection}</div>
        </div>
      ) : (
        <>
          {/* desktop: two columns (run: route | details, workout: muscles | exercises + details) */}
          <div
            className={`grid grid-cols-1 gap-7 lg:items-start lg:gap-6 ${
              isDistance ? 'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]' : 'lg:grid-cols-2'
            }`}
          >
            <div className="flex flex-col gap-7">
              {routeSection}
              {musclesSection}
              {splitsBlock && <div className="flex flex-col gap-7 lg:hidden">{splitsBlock}</div>}
            </div>
            <div className="flex flex-col gap-7">
              {exercisesSection}
              {detailsSection}
            </div>
          </div>

          {splitsBlock && (
            <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:items-start lg:gap-6">{splitsBlock}</div>
          )}
        </>
      )}

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} assets={assets} fileBase={fileBase} />
    </div>
  );
}
