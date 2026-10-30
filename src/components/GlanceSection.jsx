/**
 * "At a Glance": swipeable carousel of headline numbers.
 *
 * To add or remove a card, edit CARDS below. Each entry's `build(ctx)` gets
 * { runs, days } and returns the card content, or null for "no data yet".
 * An optional `pick(i)` makes the chart tappable: it returns the
 * { value, sub, badge? } to show for point i (tap the same point again to reset).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { getRuns } from '../lib/analysis.js';
import { dayLabel, hoursMinutes, latest, recentHr, series, weeklyDistance } from '../lib/glance.js';
import { bars, columns } from '../lib/dots.js';
import DotGrid, { leaveBar, pickBar } from './DotGrid.jsx';

// Statuses worth flagging get the accent; the rest stay white.
const HRV_TONE = {
  BALANCED: { text: 'Balanced' },
  UNBALANCED: { text: 'Unbalanced' },
  LOW: { text: 'Low', alert: true },
  POOR: { text: 'Poor', alert: true },
};

const SLEEP_ALERT = new Set(['POOR']);

const title = (s) => s.charAt(0) + s.slice(1).toLowerCase();

function change(cur, prev, digits, unit) {
  if (prev == null) return null;
  const d = cur - prev;
  if (Math.abs(d) < 0.5 * 10 ** -digits) return `same as ${unit}`;
  return `${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(digits)} vs ${unit}`;
}

const CARDS = [
  {
    id: 'weekly-distance',
    label: 'Weekly run distance',
    empty: 'No runs yet.',
    build: ({ runs }) => {
      if (runs.length === 0) return null;
      const weeks = weeklyDistance(runs, 8);
      const cur = weeks[weeks.length - 1].v;
      const prev = weeks[weeks.length - 2].v;
      return {
        value: cur.toFixed(1),
        unit: 'km',
        sub: `This week · last week ${prev.toFixed(1)} km`,
        chart: { type: 'bars', points: weeks },
        foot: 'Mon–Sun, last 8 weeks · tap a bar',
        pick: (i) => {
          const w = weeks[i];
          const end = new Date(w.t);
          end.setDate(end.getDate() + 6);
          const fmt = (t) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
          const name = i === weeks.length - 1 ? 'This week' : i === weeks.length - 2 ? 'Last week' : `${fmt(w.t)} – ${fmt(end)}`;
          return { value: w.v.toFixed(1), sub: `${name} · ${w.n} run${w.n === 1 ? '' : 's'}` };
        },
      };
    },
  },
  {
    id: 'hrv',
    label: 'HRV status',
    empty: 'No HRV yet. Needs a Garmin watch worn overnight.',
    build: ({ days }) => {
      const d = latest(days, 'hrv_last_night');
      if (!d) return null;
      const tone = HRV_TONE[d.hrv_status];
      return {
        value: Math.round(d.hrv_last_night),
        unit: 'ms',
        badge: tone,
        sub:
          d.hrv_weekly_avg != null
            ? `7-day avg ${Math.round(d.hrv_weekly_avg)} ms${
                d.hrv_baseline_low != null ? ` · baseline ${Math.round(d.hrv_baseline_low)}–${Math.round(d.hrv_baseline_high)}` : ''
              }`
            : 'Last night average',
        chart: { type: 'columns', points: series(days, 'hrv_last_night', 14) },
        foot: `${dayLabel(d.t)} · last 14 nights`,
      };
    },
  },
  {
    id: 'sleep',
    label: 'Sleep score',
    empty: 'No sleep data yet.',
    build: ({ days }) => {
      const d = latest(days, 'sleep_score');
      if (!d) return null;
      const nights = days.filter((n) => n.sleep_score != null).slice(-14);
      const badge = (n) =>
        n.sleep_quality ? { text: title(n.sleep_quality), alert: SLEEP_ALERT.has(n.sleep_quality) } : null;
      const sub = (n) => `Slept ${hoursMinutes(n.sleep_seconds)}${n.resting_hr ? ` · resting HR ${Math.round(n.resting_hr)}` : ''}`;
      return {
        value: Math.round(d.sleep_score),
        unit: '/ 100',
        badge: badge(d),
        sub: sub(d),
        chart: { type: 'bars', points: series(days, 'sleep_score', 14) },
        foot: `${dayLabel(d.t)} · last 14 nights · tap a bar`,
        pick: (i) => {
          const n = nights[i];
          return { value: Math.round(n.sleep_score), sub: `${dayLabel(n.t)} · ${sub(n)}`, badge: badge(n) };
        },
      };
    },
  },
  {
    id: 'avg-hr',
    label: 'Avg heart rate',
    empty: 'No runs with heart rate in the last 7 days.',
    build: ({ runs }) => {
      const { cur, prev } = recentHr(runs, 7);
      if (!cur) return null;
      const hrRuns = runs.filter((r) => r.hr != null).slice(-12);
      return {
        value: Math.round(cur.v),
        unit: 'bpm',
        sub: change(Math.round(cur.v), prev && Math.round(prev.v), 0, 'prior 7 days') ?? `${cur.n} run${cur.n > 1 ? 's' : ''}`,
        chart: { type: 'columns', points: hrRuns.map((r) => ({ t: r.t, v: r.hr })) },
        foot: `Runs, last 7 days · ${cur.n} run${cur.n > 1 ? 's' : ''}`,
      };
    },
  },
];

/** Dot chart for a card: tappable bars (with `onPick`) or a column chart. */
function CardChart({ chart, selected, setSel, pickable }) {
  const pts = chart.points;
  const grid = useMemo(() => {
    if (!pts || pts.length < 2) return null;
    const vals = pts.map((p) => p.v);
    return chart.type === 'bars'
      ? bars(vals, 7, { w: vals.length > 10 ? 1 : 2, hi: selected ?? vals.length - 1 })
      : columns(vals, 6);
  }, [chart.type, pts, selected]);
  if (!grid) return null;
  const onColumn = pickable && grid.barAt ? (c, how) => pickBar(setSel, grid.barAt(c), how) : undefined;
  return <DotGrid grid={grid} onColumn={onColumn} onLeave={onColumn && leaveBar(setSel)} className="w-full lg:max-w-[260px]" />;
}

function Badge({ badge }) {
  if (!badge) return null;
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] tracking-[0.08em] uppercase ${
        badge.alert ? 'border-accent text-accent' : 'border-line-strong text-white'
      }`}
    >
      {badge.text}
    </span>
  );
}

function GlanceCard({ card, data }) {
  const [sel, setSel] = useState(null);
  useEffect(() => setSel(null), [data?.chart?.points?.length]); // new data shape: drop a stale pick
  const picked = data?.pick && sel != null ? data.pick(sel) : null;
  const value = picked?.value ?? data?.value;
  const sub = picked?.sub ?? data?.sub;
  const badge = picked && 'badge' in picked ? picked.badge : data?.badge;

  return (
    <div className="card flex h-full flex-col gap-3.5 p-5 lg:gap-5 lg:p-6">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">{card.label}</span>
        <Badge badge={badge} />
      </div>
      {data ? (
        <>
          <div className="flex items-baseline gap-2.5">
            <span className="num text-[64px] leading-[0.9] lg:text-[88px]">{value}</span>
            <span className="text-xs tracking-[0.12em] text-muted uppercase">{data.unit}</span>
          </div>
          <div className={`text-xs ${picked ? 'text-accent' : 'text-muted'}`}>{sub}</div>
          <div className="mt-auto flex flex-col gap-2.5">
            <CardChart
              chart={data.chart}
              selected={sel}
              setSel={setSel}
              pickable={!!data.pick}
            />
            <div className="text-xs text-muted">{data.foot}</div>
          </div>
        </>
      ) : (
        <p className="m-0 text-sm text-muted">{card.empty}</p>
      )}
    </div>
  );
}

export default function GlanceSection({ activities, days }) {
  const runs = useMemo(() => getRuns(activities), [activities]);
  const built = useMemo(() => CARDS.map((c) => ({ card: c, data: c.build({ runs, days }) })), [runs, days]);
  const scroller = useRef(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const el = scroller.current;
    const card = el?.firstElementChild;
    if (!card) return;
    setActive(Math.round(el.scrollLeft / (card.offsetWidth + 12)));
  };

  const goTo = (i) => {
    const el = scroller.current;
    const card = el?.children[i];
    if (card) el.scrollTo({ left: card.offsetLeft - 16, behavior: 'smooth' }); // 16 = px-4 gutter
  };

  return (
    <div>
      {/* phone: swipeable carousel; desktop: all cards in a row */}
      <div
        ref={scroller}
        onScroll={onScroll}
        className="no-scrollbar relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible lg:px-0"
      >
        {built.map(({ card, data }) => (
          <div key={card.id} className="w-[min(300px,80%)] shrink-0 snap-start lg:w-auto">
            <GlanceCard card={card} data={data} />
          </div>
        ))}
      </div>
      <div className="mt-3.5 flex justify-center gap-2 lg:hidden">
        {built.map(({ card }, i) => (
          <button
            key={card.id}
            aria-label={`Show ${card.label}`}
            onClick={() => goTo(i)}
            className={`h-2 w-2 rounded-full ${i === active ? 'bg-accent' : 'bg-line-strong'}`}
          />
        ))}
      </div>
    </div>
  );
}
