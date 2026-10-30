/**
 * Metrics for a distance sport other than running (cycling, swimming, hiking; see
 * lib/sports.js): at a glance, personal bests, trends and the latest activities.
 * Built from Activity History rows. Tapping a record or an activity opens it.
 */
import { useMemo, useState } from 'react';
import { DEFAULT_RANGE } from '../lib/analysis.js';
import { headlineStats } from '../lib/activityStats.js';
import { bars } from '../lib/dots.js';
import { duration, paceSec, shortDate } from '../lib/format.js';
import { sportActs, sportRecords } from '../lib/sports.js';
import { rangeWeeks, sessionsInRange, weekly } from '../lib/strength.js';
import DotGrid from './DotGrid.jsx';
import { WeeklyChart } from './StrengthMetrics.jsx';
import TrendCard from './TrendCard.jsx';
import { Empty, Icon, Note, RangePills, SectionHead } from './ui.jsx';

const signed = (d, fmt) => `${d > 0 ? '+' : d < 0 ? '−' : ''}${fmt(Math.abs(d))}`;
const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);

const Anchor = ({ id, children }) => (
  <section id={id} className="flex scroll-mt-[calc(var(--top-inset)+4rem)] flex-col gap-3.5">
    {children}
  </section>
);

/** Distance in the sport's own unit: metres for swimming, km for the rest. */
const dist = (def, m) => (def.per100 ? { value: Math.round(m).toLocaleString(), unit: 'm' } : { value: (m / 1000).toFixed(m >= 10000 ? 1 : 2), unit: 'km' });

/** { value, unit } for a record. */
function recordValue(def, r) {
  if (r.key === 'distance') return dist(def, r.value);
  if (r.key === 'time') return { value: duration(r.value), unit: '' };
  if (r.key === 'climb') return { value: String(Math.round(r.value)), unit: 'm' };
  return def.speed ? { value: r.value.toFixed(1), unit: 'km/h' } : { value: paceSec(r.value), unit: def.per100 ? '/100m' : '/km' };
}

function GlanceCard({ label, value, unit, accent, chart, sub }) {
  return (
    <div className="card flex flex-col justify-between gap-4 p-5 lg:gap-5 lg:p-6">
      <div className="eyebrow">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className={`num text-[40px] leading-[0.9] lg:text-[72px] ${accent ? 'text-accent' : ''}`}>{value}</span>
        <span className="text-xs tracking-[0.12em] text-muted uppercase">{unit}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {chart && <DotGrid grid={chart} className="w-full max-w-[200px]" />}
        <div className="text-xs text-muted">{sub}</div>
      </div>
    </div>
  );
}

export default function SportMetrics({ def, items, loading, error, onRetry, onOpen }) {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const acts = useMemo(() => sportActs(items, def), [items, def]);
  const recs = useMemo(() => sportRecords(acts, def), [acts, def]);
  const weeks8 = useMemo(() => weekly(acts, 8, (a) => a.distance), [acts]);
  const weeks = useMemo(() => {
    const n = rangeWeeks(acts, range);
    return n ? weekly(acts, n, (a) => a.distance) : [];
  }, [acts, range]);
  const shown = useMemo(() => sessionsInRange(acts, range), [acts, range]);

  if (loading && items.length === 0) return <Empty>Loading…</Empty>;
  if (error && items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-sm">
        <p className="m-0 text-accent">Could not load activities: {error}</p>
        <button onClick={() => onRetry().catch(() => {})} className="btn">
          Try again
        </button>
      </div>
    );
  }
  if (acts.length === 0) return <Empty>No {def.label.toLowerCase()} activities with distance and time yet.</Empty>;

  const week = weeks8[weeks8.length - 1];
  const lastWeek = weeks8[weeks8.length - 2];
  const last4 = sum(weeks8.slice(-4), (w) => w.n);
  const weekTime = sum(week.sessions, (a) => a.time);
  const longest = recs.find((r) => r.key === 'distance');
  const wk = dist(def, week.v);
  const fmtKm = def.per100 ? (v) => Math.round(v).toLocaleString() : (v) => (v / 1000).toFixed(1);

  return (
    <div className="flex flex-col gap-8 lg:gap-14">
      <Anchor id="glance">
        <SectionHead n="01" title="At a Glance" small />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <GlanceCard
            label="Weekly Distance"
            value={wk.value}
            unit={wk.unit}
            accent
            chart={bars(weeks8.map((w) => w.v), 5)}
            sub={`This week · last week ${dist(def, lastWeek.v).value} ${wk.unit}`}
          />
          <GlanceCard label="Sessions" value={week.n} unit="this week" sub={`${last4} in the last 4 weeks`} />
          <GlanceCard
            label="Time"
            value={duration(weekTime)}
            unit="this week"
            sub={week.n ? `Avg ${duration(weekTime / week.n)} per session` : 'No sessions yet this week'}
          />
          <GlanceCard
            label="Longest"
            value={longest ? dist(def, longest.value).value : '–'}
            unit={longest ? wk.unit : ''}
            sub={longest ? `${shortDate(longest.act.t)}` : ''}
          />
        </div>
      </Anchor>

      {recs.length > 0 && (
        <Anchor id="records">
          <SectionHead n="02" title="Personal Bests" note="All time" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {recs.map((r) => {
              const v = recordValue(def, r);
              return (
                <button
                  key={r.key}
                  onClick={() => onOpen(r.act.activity)}
                  className="card flex flex-col gap-3 p-5 text-left active:bg-neutral-950 lg:gap-3.5 lg:p-6"
                >
                  <span className="eyebrow">{r.label}</span>
                  <div className="flex items-baseline gap-2">
                    <span className="num text-[34px] leading-[0.9] lg:text-[48px]">{v.value}</span>
                    <span className="text-xs text-muted">{v.unit}</span>
                  </div>
                  <span className="text-xs text-muted">{shortDate(r.act.t)}</span>
                </button>
              );
            })}
          </div>
        </Anchor>
      )}

      <Anchor id="trends">
        <SectionHead n="03" title="Trends" note={`${shown.length} activities`} />
        <RangePills value={range} onChange={setRange} />
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2 lg:gap-4">
          <WeeklyChart title="Weekly Distance" weeks={weeks} get={(w) => w.v} fmt={fmtKm} unit={def.per100 ? 'M' : 'KM'} />
          {def.speed ? (
            <TrendCard
              title="Speed"
              runs={shown}
              allRuns={acts}
              get={(a) => a.kmh}
              fmt={(v) => v.toFixed(1)}
              fmtDelta={(d) => `${signed(d, (x) => x.toFixed(1))} km/h`}
              unit="km/h"
              higherIsUp
            />
          ) : (
            <TrendCard
              title="Pace"
              runs={shown}
              allRuns={acts}
              get={(a) => a.pace}
              fmt={(v) => paceSec(v)}
              fmtDelta={(d) => `${signed(d, paceSec)} ${def.per100 ? '/100m' : '/km'}`}
              unit={def.per100 ? '/100m' : '/km'}
              higherIsUp={false}
            />
          )}
          {acts.some((a) => a.hr) && (
            <TrendCard
              title="Heart rate"
              runs={shown}
              allRuns={acts}
              get={(a) => a.hr}
              fmt={(v) => String(Math.round(v))}
              fmtDelta={(d) => `${signed(d, (x) => Math.round(x))} bpm`}
              unit="bpm"
              higherIsUp
            />
          )}
        </div>
      </Anchor>

      <Anchor id="recent">
        <SectionHead n="04" title="Recent" note={`Last ${Math.min(8, acts.length)}`} />
        <div className="card px-5 py-1 lg:px-7">
          {[...acts]
            .reverse()
            .slice(0, 8)
            .map((a, i, arr) => (
              <button
                key={a.id}
                onClick={() => onOpen(a.activity)}
                className={`flex min-h-16 w-full items-center justify-between gap-3 py-3 text-left lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_24px] lg:gap-5 ${
                  i < arr.length - 1 ? 'rule' : ''
                }`}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-sm">{a.name || def.label}</span>
                  <span className="text-xs text-muted">{shortDate(a.t)}</span>
                </div>
                <div className="flex shrink-0 gap-4 text-right text-sm lg:contents">
                  {headlineStats(a.activity).map(([label, value]) => (
                    <span key={label} className="font-bold tabular-nums lg:text-left">
                      {value}
                    </span>
                  ))}
                </div>
                <Icon name="chevron" className="hidden text-muted lg:block" />
              </button>
            ))}
        </div>
        <Note>Taps open the full activity.</Note>
      </Anchor>
    </div>
  );
}
