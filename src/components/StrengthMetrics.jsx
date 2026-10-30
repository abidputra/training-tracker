/**
 * Strength metrics (the "Strength" sport tab): at a glance, records, exercises,
 * weekly trends and muscle split, all from Garmin's per-exercise summaries.
 * Tapping a record or an exercise opens ExerciseDetail (via `onExercise`).
 */
import { useMemo, useState } from 'react';
import { DEFAULT_RANGE } from '../lib/analysis.js';
import { bars, columns, meter } from '../lib/dots.js';
import { duration, shortDate } from '../lib/format.js';
import {
  exerciseHistory,
  kgNum,
  muscleSplit,
  rangeWeeks,
  recentExercises,
  records,
  strengthGlance,
  weekly,
} from '../lib/strength.js';
import DotGrid from './DotGrid.jsx';
import { Empty, Note, RangePills, SectionHead } from './ui.jsx';

const Anchor = ({ id, children }) => (
  <section id={id} className="flex scroll-mt-[calc(var(--top-inset)+4rem)] flex-col gap-3.5">
    {children}
  </section>
);

const fmtWeek = (t) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function GlanceCards({ glance }) {
  const [sel, setSel] = useState(null);
  const { weeks, week, lastWeek, month } = glance;
  const hi = sel ?? weeks.length - 1;
  const grid = useMemo(() => bars(weeks.map((w) => w.v), 7, { hi }), [weeks, hi]);
  const shown = weeks[hi];
  const name = hi === weeks.length - 1 ? 'This week' : hi === weeks.length - 2 ? 'Last week' : `Week of ${fmtWeek(shown.t)}`;

  return (
    <>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 lg:mx-0 lg:grid lg:grid-cols-2 lg:px-0">
        <div className="card flex w-[min(300px,80%)] shrink-0 snap-start flex-col gap-3.5 p-5 lg:w-auto">
          <div className="eyebrow">Weekly volume</div>
          <div className="flex items-baseline gap-2">
            <span className="num text-[64px] leading-[0.9]">{kgNum(shown.v)}</span>
            <span className="text-xs tracking-[0.12em] text-muted">KG</span>
          </div>
          <div className={`text-xs ${sel != null ? 'text-accent' : 'text-muted'}`}>
            {sel != null
              ? `${name} · ${shown.n} session${shown.n === 1 ? '' : 's'}`
              : `This week · last week ${kgNum(lastWeek.v)} kg`}
          </div>
          <DotGrid
            grid={grid}
            onColumn={(c) => {
              const b = grid.barAt(c);
              if (b != null) setSel((cur) => (cur === b ? null : b));
            }}
          />
          <div className="text-xs text-muted">Mon–Sun, last 8 weeks · tap a bar</div>
        </div>
        <div className="card flex w-[min(300px,80%)] shrink-0 snap-start flex-col gap-3.5 p-5 lg:w-auto">
          <div className="eyebrow">Sessions</div>
          <div className="flex items-baseline gap-2">
            <span className="num text-[64px] leading-[0.9]">{week.n}</span>
            <span className="text-xs tracking-[0.12em] text-muted">THIS WEEK</span>
          </div>
          <div className="text-xs text-muted">Last week {lastWeek.n} · last 30 days {month.sessions}</div>
          <DotGrid grid={bars(weeks.map((w) => w.n), 7)} />
          <div className="text-xs text-muted">Sessions per week, last 8 weeks</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Total sets', month.sets || '–', ''],
          ['Avg time', month.avgTime ? duration(month.avgTime) : '–', ''],
          ['Avg / rep · kg', month.perRep ? kgNum(month.perRep) : '–', ''],
        ].map(([label, value, unit]) => (
          <div key={label} className="rounded-2xl border border-line bg-black px-3 py-3.5">
            <div className="text-xs text-muted">{label}</div>
            <div className="num mt-1.5 text-[30px] leading-[1.1]">
              {value}
              {unit && <span className="font-mono text-xs font-normal text-muted">{unit}</span>}
            </div>
          </div>
        ))}
      </div>
      <Note>Sets, time and weight per rep: last 30 days.</Note>
    </>
  );
}

function WeeklyChart({ title, weeks, get, fmt, unit, note }) {
  const vals = weeks.map(get);
  const grid = bars(vals, 10, { w: weeks.length > 16 ? 1 : 2 });
  const latest = vals[vals.length - 1];
  const cur = vals.slice(-4).filter(Boolean);
  const prev = vals.slice(-8, -4).filter(Boolean);
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const d = avg(cur) != null && avg(prev) != null ? avg(cur) - avg(prev) : null;

  return (
    <div className="card flex flex-col gap-3.5 p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="eyebrow">{title}</span>
        <div className="text-right">
          <div className="num text-[30px]">
            {latest ? fmt(latest) : '–'} <span className="font-mono text-xs font-normal text-muted">{unit}</span>
          </div>
          {d != null && (
            <div className="mt-1 text-xs text-muted">
              4-wk avg {d >= 0 ? '+' : '−'}
              {fmt(Math.abs(d))} {unit.toLowerCase()} vs prev
            </div>
          )}
        </div>
      </div>
      <DotGrid grid={grid} label={`${title}, ${weeks.length} weeks`} />
      <div className="flex justify-between text-xs text-muted">
        <span>{weeks.length} wks ago</span>
        <span>This week</span>
      </div>
      {note && <Note>{note}</Note>}
    </div>
  );
}

export default function StrengthMetrics({ sessions, loading, error, onRetry, onExercise }) {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const glance = useMemo(() => strengthGlance(sessions), [sessions]);
  const history = useMemo(() => exerciseHistory(sessions), [sessions]);
  const recs = useMemo(() => records(history).slice(0, 5), [history]);
  const exercises = useMemo(() => recentExercises(history), [history]);
  const split = useMemo(() => muscleSplit(sessions), [sessions]);
  const weeks = useMemo(() => {
    const n = rangeWeeks(sessions, range);
    return n ? weekly(sessions, n, (s) => s.volume) : [];
  }, [sessions, range]);

  if (loading && sessions.length === 0) return <Empty>Loading…</Empty>;
  if (error && sessions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-sm">
        <p className="m-0 text-accent">Could not load workouts: {error}</p>
        <button onClick={() => onRetry().catch(() => {})} className="btn">
          Try again
        </button>
      </div>
    );
  }
  if (sessions.length === 0) return <Empty>No strength workouts yet. They appear here once synced from Garmin.</Empty>;

  const maxPct = split[0]?.pct ?? 1;

  return (
    <div className="flex flex-col gap-8">
      <Anchor id="glance">
        <SectionHead title="At a Glance" small />
        <GlanceCards glance={glance} />
      </Anchor>

      {recs.length > 0 && (
        <Anchor id="records">
          <SectionHead title="Records" note="Heaviest weight" />
          <div className="card px-5 py-1">
            {recs.map((r, i) => (
              <button
                key={r.name}
                onClick={() => onExercise(r.name)}
                className={`flex min-h-16 w-full items-center justify-between gap-3 py-3 text-left ${i < recs.length - 1 ? 'rule' : ''}`}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm">{r.name}</span>
                  <span className="text-xs text-muted">
                    {shortDate(r.t)}
                    {r.delta ? ` · +${kgNum(r.delta)} kg` : ' · first record'}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  {r.isNew && (
                    <span className="rounded-full border border-accent px-2 py-0.5 text-xs tracking-[0.1em] text-accent">NEW</span>
                  )}
                  <span className="num text-[30px]">
                    {kgNum(r.pr)}
                    <span className="font-mono text-xs font-normal text-muted"> kg</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Anchor>
      )}

      {exercises.length > 0 && (
        <Anchor id="exercises">
          <SectionHead title="Exercises" note="Last 30 days" />
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {exercises.map((e) => (
              <button
                key={e.name}
                onClick={() => onExercise(e.name)}
                className="flex flex-col gap-3 rounded-2xl border border-line bg-black p-4 text-left active:bg-neutral-950"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold">{e.name}</span>
                  {e.trend.length > 1 && (
                    <DotGrid grid={columns(e.trend, 4)} style={{ gridTemplateColumns: `repeat(${e.trend.length}, 8px)` }} />
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['Sets × reps', e.repsPerSet ? `${e.sets} × ${e.repsPerSet}` : `${e.sets} sets`],
                    ['Avg / rep', e.perRep ? `${kgNum(e.perRep)} kg` : '–'],
                    ['Volume', e.volume ? `${kgNum(e.volume)} kg` : '–'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted">{label}</span>
                      <span className="text-[13px]">{value}</span>
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </Anchor>
      )}

      <Anchor id="trends">
        <SectionHead title="Trends" note={`${weeks.length} weeks`} />
        <RangePills value={range} onChange={setRange} />
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <WeeklyChart
            title="Weekly Volume"
            weeks={weeks}
            get={(w) => w.v}
            fmt={kgNum}
            unit="KG"
          />
          <WeeklyChart
            title="Avg Weight per Rep"
            weeks={weeks}
            get={(w) => {
              const reps = w.sessions.reduce((a, s) => a + s.reps, 0);
              return reps ? w.v / reps : 0;
            }}
            fmt={kgNum}
            unit="KG"
            note="Total volume divided by total reps, across all exercises."
          />
        </div>
      </Anchor>

      {split.length > 0 && (
        <Anchor id="split">
          <SectionHead title="Muscle Split" note="Share of sets · 30 days" />
          <div className="card px-5 py-2">
            {split.map((g, i) => (
              <div key={g.name} className={`flex items-center justify-between gap-3 py-3.5 ${i < split.length - 1 ? 'rule' : ''}`}>
                <span className="w-[84px] shrink-0 text-[13px]">{g.name}</span>
                <DotGrid grid={meter((g.pct / maxPct) * 20)} style={{ gridTemplateColumns: 'repeat(20, 8px)' }} gap={2} />
                <span className="w-10 shrink-0 text-right text-[13px]">{Math.round(g.pct)}%</span>
              </div>
            ))}
          </div>
          <Note>Each set counts fully for the main muscles of the exercise and half for the helpers.</Note>
        </Anchor>
      )}
    </div>
  );
}
