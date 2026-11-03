/**
 * Strength metrics (the "Strength" sport tab): at a glance, records, exercises,
 * weekly trends and muscle split, all from Garmin's per-exercise summaries.
 * Tapping a record or an exercise opens ExerciseDetail (via `onExercise`).
 *
 * Phones get cards and lists; from `lg` up the same data is laid out as a
 * 4-card glance row, record cards, an exercises table and a two-column split.
 */
import { useMemo, useState } from 'react';
import { DEFAULT_RANGE } from '../lib/analysis.js';
import { bars, meter } from '../lib/dots.js';
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
import DotGrid, { leaveBar, pickBar } from './DotGrid.jsx';
import { Empty, Icon, Note, Pager, RangePills, SectionHead } from './ui.jsx';
import Count from './Count.jsx';

const Anchor = ({ id, children }) => (
  <section id={id} className="flex scroll-mt-[calc(var(--top-inset)+4rem)] flex-col gap-3.5">
    {children}
  </section>
);

const fmtWeek = (t) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const EXERCISES_PER_PAGE = 10;
const sumOf = (list, f) => list.reduce((a, x) => a + f(x), 0);

/**
 * One glance card, the same on every screen size: label, big number with its unit, a line of
 * context, and optionally a bar chart (hover or tap a bar to read that week). `big` cards (the
 * two charts) are wider and carry a larger number on a phone; the small ones sit in a grid.
 */
function GlanceCard({ label, value, unit, accent, sub, subHot, chart, big, foot, className = '' }) {
  return (
    <div className={`card flex h-full flex-col justify-between gap-3.5 ${big ? 'p-5' : 'p-4'} lg:gap-5 lg:p-6 ${className}`}>
      <div className="eyebrow">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className={`num leading-[0.9] ${big ? 'text-[64px]' : 'text-[34px]'} lg:text-[72px] ${accent ? 'text-accent' : ''}`}>
          <Count text={value} />
        </span>
        <span className="text-xs tracking-[0.12em] text-muted uppercase">{unit}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        <div className={`text-xs ${subHot ? 'text-accent' : 'text-muted'}`}>{sub}</div>
        {chart}
        {foot && <div className="text-xs text-muted">{foot}</div>}
      </div>
    </div>
  );
}

/** The same six numbers on phone and desktop: two weekly charts, then four summary cards. */
function GlanceCards({ glance, top }) {
  const [sel, setSel] = useState(null); // the week picked on the volume chart
  const [selS, setSelS] = useState(null); // ... and on the sessions chart
  const { weeks, week, lastWeek, month } = glance;
  const hi = sel ?? weeks.length - 1;
  const hiS = selS ?? weeks.length - 1;
  const grid = useMemo(() => bars(weeks.map((w) => w.v), 7, { hi }), [weeks, hi]);
  const gridS = useMemo(() => bars(weeks.map((w) => w.n), 7, { hi: hiS }), [weeks, hiS]);
  const nameOf = (i) => (i === weeks.length - 1 ? 'This week' : i === weeks.length - 2 ? 'Last week' : `Week of ${fmtWeek(weeks[i].t)}`);
  const plural = (n) => `${n} session${n === 1 ? '' : 's'}`;
  const weekSets = sumOf(week.sessions, (s) => s.sets);

  const chartFor = (g, pick, leave) => (
    <DotGrid grid={g} onColumn={(c, how) => pickBar(pick, g.barAt(c), how)} onLeave={leaveBar(leave)} className="w-full lg:max-w-[200px]" />
  );

  return (
    // desktop: one grid of six cards (the two wrappers below dissolve); phone: a swipeable pair of charts, then a 2 x 2 grid
    <div className="lg:grid lg:grid-cols-3 lg:gap-4">
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 lg:contents">
        <div className="w-[min(300px,80%)] shrink-0 snap-start lg:w-auto">
          <GlanceCard
            big
            accent
            label="Weekly volume"
            value={kgNum(weeks[hi].v)}
            unit="kg"
            sub={sel != null ? `${nameOf(hi)} · ${plural(weeks[hi].n)}` : `This week · ${plural(week.n)} · last week ${kgNum(lastWeek.v)} kg`}
            subHot={sel != null}
            chart={chartFor(grid, setSel, setSel)}
            foot="Mon–Sun, last 8 weeks · tap a bar"
          />
        </div>
        <div className="w-[min(300px,80%)] shrink-0 snap-start lg:w-auto">
          <GlanceCard
            big
            label="Sessions"
            value={String(weeks[hiS].n)}
            unit={selS != null ? 'sessions' : 'this week'}
            sub={selS != null ? nameOf(hiS) : `Last week ${lastWeek.n} · last 30 days ${month.sessions}`}
            subHot={selS != null}
            chart={chartFor(gridS, setSelS, setSelS)}
            foot="Sessions per week, last 8 weeks · tap a bar"
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:contents">
        <GlanceCard
          label="Total sets"
          value={String(weekSets)}
          unit="this week"
          sub={week.n ? `Avg ${(weekSets / week.n).toFixed(1)} per session · ${month.sets} in 30 days` : `${month.sets} in the last 30 days`}
        />
        <GlanceCard
          label="Top lift"
          value={top ? kgNum(top.pr) : '–'}
          unit={top ? 'kg' : ''}
          sub={top ? `${top.name} · ${fmtWeek(top.t)}` : 'No weighted lifts yet'}
        />
        <GlanceCard label="Avg time" value={month.avgTime ? duration(month.avgTime) : '–'} unit="per session" sub="Last 30 days" />
        <GlanceCard label="Avg per rep" value={month.perRep ? kgNum(month.perRep) : '–'} unit="kg" sub="Last 30 days" />
      </div>
    </div>
  );
}

export function WeeklyChart({ title, weeks, get, fmt, unit, note }) {
  const vals = weeks.map(get);
  const grid = bars(vals, 10, { w: weeks.length > 16 ? 1 : 2, minSlots: 12 }); // few weeks: pad, never giant dots
  const latest = vals[vals.length - 1];
  const cur = vals.slice(-4).filter(Boolean);
  const prev = vals.slice(-8, -4).filter(Boolean);
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const d = avg(cur) != null && avg(prev) != null ? avg(cur) - avg(prev) : null;

  return (
    <div className="card flex flex-col gap-3.5 p-5 lg:gap-5 lg:p-7">
      <div className="flex items-start justify-between gap-2">
        <span className="eyebrow">{title}</span>
        <div className="text-right">
          <div className="num text-[30px] lg:text-[40px]">
            <Count text={latest ? fmt(latest) : '–'} /> <span className="font-mono text-xs font-normal text-muted">{unit}</span>
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
  const [allRecsOpen, setAllRecsOpen] = useState(false); // Records: latest 5, or every exercise
  const [exPage, setExPage] = useState(0); // Exercises: zero-based page
  const glance = useMemo(() => strengthGlance(sessions), [sessions]);
  const history = useMemo(() => exerciseHistory(sessions), [sessions]);
  const allRecs = useMemo(() => records(history), [history]);
  const recs = allRecsOpen ? allRecs : allRecs.slice(0, 5);
  const top = useMemo(() => [...allRecs].sort((a, b) => b.pr - a.pr)[0] ?? null, [allRecs]);
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
  const exPages = Math.ceil(exercises.length / EXERCISES_PER_PAGE);
  const exCur = Math.min(exPage, Math.max(0, exPages - 1)); // the list can shrink after a sync
  const exShown = exercises.slice(exCur * EXERCISES_PER_PAGE, (exCur + 1) * EXERCISES_PER_PAGE);
  const goExPage = (p) => {
    setExPage(p);
    // the lists differ in height: bring the top of the section back into view
    document.getElementById('exercises')?.scrollIntoView({ block: 'start' });
  };
  const statRows = (e) => [
    ['Sets × reps', e.repsPerSet ? `${e.sets} × ${e.repsPerSet}` : `${e.sets} sets`],
    ['Avg / rep', e.perRep ? `${kgNum(e.perRep)} kg` : '–'],
    ['Volume', e.volume ? `${kgNum(e.volume)} kg` : '–'],
  ];

  return (
    <div className="flex flex-col gap-8 lg:gap-14">
      <Anchor id="glance">
        <SectionHead n="01" title="At a Glance" small />
        <GlanceCards glance={glance} top={top} />
      </Anchor>

      {recs.length > 0 && (
        <Anchor id="records">
          <SectionHead n="02" title="Records" note="Heaviest weight" />
          {/* phone: list */}
          <div className="card px-5 py-1 lg:hidden">
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
                    <Count text={kgNum(r.pr)} />
                    <span className="font-mono text-xs font-normal text-muted"> kg</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
          {/* desktop: one card per record */}
          <div className="hidden gap-4 lg:grid lg:grid-cols-5">
            {recs.map((r) => (
              <button
                key={r.name}
                onClick={() => onExercise(r.name)}
                className="card flex flex-col gap-3.5 p-6 text-left active:bg-neutral-950"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px]">{r.name}</span>
                  {r.isNew && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-black">NEW</span>}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="num text-[56px] leading-[0.9]"><Count text={kgNum(r.pr)} /></span>
                  <span className="text-xs text-muted">kg</span>
                </div>
                <div className="text-xs text-muted">
                  {shortDate(r.t)}
                  {r.delta ? ` · +${kgNum(r.delta)} kg` : ' · first record'}
                </div>
              </button>
            ))}
          </div>
          {allRecs.length > 5 && (
            <button onClick={() => setAllRecsOpen((o) => !o)} aria-expanded={allRecsOpen} className="btn self-start">
              {allRecsOpen ? 'Show less' : 'View all'}
            </button>
          )}
        </Anchor>
      )}

      {exercises.length > 0 && (
        <Anchor id="exercises">
          <SectionHead n="03" title="Exercises" note="Last 30 days" />
          {/* phone: cards */}
          <div className="grid grid-cols-1 gap-2.5 lg:hidden">
            {exShown.map((e) => (
              <button
                key={e.name}
                onClick={() => onExercise(e.name)}
                className="flex flex-col gap-3 rounded-2xl border border-line bg-black p-4 text-left active:bg-neutral-950"
              >
                <span className="text-sm font-bold">{e.name}</span>
                <div className="grid grid-cols-3 gap-2">
                  {statRows(e).map(([label, value]) => (
                    <div key={label} className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted">{label}</span>
                      <span className="text-[13px]">{value}</span>
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
          {/* desktop: table */}
          <div className="card hidden px-7 py-1 lg:block">
            <div className="rule grid grid-cols-[2fr_1fr_1fr_1fr_24px] gap-5 pt-[18px] pb-3 text-xs tracking-[0.12em] text-muted uppercase">
              <span>Exercise</span>
              <span>Sets × reps</span>
              <span>Avg / rep</span>
              <span>Volume</span>
              <span />
            </div>
            {exShown.map((e) => {
              const [setsReps, avg, vol] = statRows(e).map((r) => r[1]);
              return (
                <button
                  key={e.name}
                  onClick={() => onExercise(e.name)}
                  className="grid min-h-[72px] w-full grid-cols-[2fr_1fr_1fr_1fr_24px] items-center gap-5 border-b border-dotted border-line text-left text-sm last:border-b-0"
                >
                  <span className="text-[15px]">{e.name}</span>
                  <span>{setsReps}</span>
                  <span>{avg}</span>
                  <span className="font-bold">{vol}</span>
                  <Icon name="chevron" className="text-muted" />
                </button>
              );
            })}
          </div>
          <Pager page={exCur} pages={exPages} onChange={goExPage} />
        </Anchor>
      )}

      <Anchor id="trends">
        <SectionHead n="04" title="Trends" note={`${weeks.length} weeks`} />
        <RangePills value={range} onChange={setRange} />
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2 lg:gap-4">
          <WeeklyChart title="Weekly Volume" weeks={weeks} get={(w) => w.v} fmt={kgNum} unit="KG" />
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
          <SectionHead n="05" title="Muscle Split" note="Share of sets · 30 days" />
          <div className="card px-5 py-2 lg:grid lg:grid-cols-2 lg:gap-x-14 lg:px-7">
            {split.map((g, i) => (
              <div
                key={g.name}
                className={`flex items-center justify-between gap-3 py-3.5 lg:min-h-16 lg:gap-4 lg:py-0 ${
                  i < split.length - 1 ? 'rule' : ''
                }`}
              >
                <span className="w-[84px] shrink-0 text-[13px] lg:w-24 lg:text-sm">{g.name}</span>
                <DotGrid grid={meter((g.pct / maxPct) * 20)} className="w-[180px] shrink-0 lg:w-auto lg:min-w-0 lg:flex-1 lg:shrink" />
                <span className="w-10 shrink-0 text-right text-[13px] lg:w-11 lg:text-sm lg:font-bold">{Math.round(g.pct)}%</span>
              </div>
            ))}
          </div>
          <Note>Each set counts fully for the main muscles of the exercise and half for the helpers.</Note>
        </Anchor>
      )}
    </div>
  );
}
