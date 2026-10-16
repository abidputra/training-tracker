/**
 * "At a Glance": swipeable carousel of headline numbers.
 *
 * To add or remove a card, edit CARDS below. Each entry's `build(ctx)` gets
 * { runs, days } and returns the card content, or null for "no data yet".
 */
import { useMemo, useRef, useState } from 'react';
import { getRuns } from '../lib/analysis.js';
import { dayLabel, hoursMinutes, latest, recentHr, series, weeklyDistance } from '../lib/glance.js';
import Sparkline from './Sparkline.jsx';

const HRV_TONE = {
  BALANCED: { text: 'Balanced', className: 'bg-emerald-500/15 text-emerald-300' },
  UNBALANCED: { text: 'Unbalanced', className: 'bg-amber-500/15 text-amber-300' },
  LOW: { text: 'Low', className: 'bg-orange-500/15 text-orange-300' },
  POOR: { text: 'Poor', className: 'bg-red-500/15 text-red-300' },
};

const SLEEP_TONE = {
  EXCELLENT: 'bg-emerald-500/15 text-emerald-300',
  GOOD: 'bg-emerald-500/15 text-emerald-300',
  FAIR: 'bg-amber-500/15 text-amber-300',
  POOR: 'bg-red-500/15 text-red-300',
};

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
        spark: { type: 'bars', points: weeks, color: '#34d399' },
        foot: 'Mon–Sun, last 8 weeks',
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
        spark: { type: 'line', points: series(days, 'hrv_last_night', 14), color: '#a78bfa' },
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
      return {
        value: Math.round(d.sleep_score),
        unit: '/ 100',
        badge: d.sleep_quality ? { text: title(d.sleep_quality), className: SLEEP_TONE[d.sleep_quality] ?? 'bg-slate-700 text-slate-200' } : null,
        sub: `Slept ${hoursMinutes(d.sleep_seconds)}${d.resting_hr ? ` · resting HR ${Math.round(d.resting_hr)}` : ''}`,
        spark: { type: 'bars', points: series(days, 'sleep_score', 14), color: '#38bdf8' },
        foot: `${dayLabel(d.t)} · last 14 nights`,
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
        spark: { type: 'line', points: hrRuns.map((r) => ({ t: r.t, v: r.hr })), color: '#f87171' },
        foot: `Runs, last 7 days · ${cur.n} run${cur.n > 1 ? 's' : ''}`,
      };
    },
  },
];

function GlanceCard({ card, data }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-700 bg-slate-900 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{card.label}</span>
        {data?.badge && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${data.badge.className}`}>
            {data.badge.text}
          </span>
        )}
      </div>
      {data ? (
        <>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-3xl font-semibold text-white">{data.value}</span>
            <span className="text-sm text-slate-400">{data.unit}</span>
          </div>
          <div className="text-xs text-slate-400">{data.sub}</div>
          <div className="mt-auto pt-3">
            <Sparkline {...data.spark} />
            <div className="mt-1 text-[11px] text-slate-500">{data.foot}</div>
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-500">{card.empty}</p>
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
      <div
        ref={scroller}
        onScroll={onScroll}
        className="relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {built.map(({ card, data }) => (
          <div key={card.id} className="w-[80%] shrink-0 snap-start">
            <GlanceCard card={card} data={data} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-1.5">
        {built.map(({ card }, i) => (
          <button
            key={card.id}
            aria-label={`Show ${card.label}`}
            onClick={() => goTo(i)}
            className={`h-1.5 rounded-full transition-all ${i === active ? 'w-4 bg-slate-300' : 'w-1.5 bg-slate-700'}`}
          />
        ))}
      </div>
    </div>
  );
}
