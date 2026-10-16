/**
 * Running dynamics: last 30 days vs the 30 days before, anchored on your most
 * recent run (so it still works if you have not run this week).
 * `better` says which direction is an improvement; null means "just a number".
 *
 * Tapping a tile (or its "i") opens a drawer with the full chart, a few stats
 * and what the metric means. The last tile is body weight (from daily metrics).
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { DEFAULT_RANGE, RANGES, filterRange, rolling, windowAvg } from '../lib/analysis.js';
import { dayLabel } from '../lib/glance.js';
import Drawer from './Drawer.jsx';
import LineChart from './LineChart.jsx';

const METRICS = [
  {
    key: 'cadence', label: 'Cadence', unit: 'spm', digits: 0, better: 'up',
    info: 'Steps per minute, both feet. A higher cadence usually means shorter, lighter steps and less braking. Most runners sit around 160–180 spm; small increases (5%) are easier to adopt than big jumps.',
  },
  {
    key: 'stride', label: 'Stride length', unit: 'cm', digits: 0, better: null,
    info: 'Distance covered per step. It grows naturally as you run faster, so compare runs at similar paces. Over-striding (reaching far ahead) costs energy, so longer is not automatically better.',
  },
  {
    key: 'gct', label: 'Ground contact', unit: 'ms', digits: 0, better: 'down',
    info: 'How long each foot stays on the ground per step. Shorter contact usually means a more elastic, efficient stride. Typical values are 200–300 ms and drop as pace increases.',
  },
  {
    key: 'vosc', label: 'Vertical oscillation', unit: 'cm', digits: 1, better: 'down',
    info: 'How much your torso bounces up and down per step. Less bounce means more energy goes forward. Typical values are 6–13 cm.',
  },
  {
    key: 'vratio', label: 'Vertical ratio', unit: '%', digits: 1, better: 'down',
    info: 'Vertical oscillation divided by stride length. It shows how much of each step is spent going up instead of forward. Lower is more efficient; under about 8% is good.',
  },
  {
    key: 'power', label: 'Power', unit: 'W', digits: 0, better: null,
    info: 'Running power estimated by your watch or pod. It reacts to hills and wind instantly, unlike heart rate. Compare it with pace: more speed for the same power means better efficiency.',
  },
  {
    key: 'te', label: 'Aerobic effect', unit: '', digits: 1, better: null,
    info: 'Garmin Training Effect (0–5): how much a run improved your aerobic fitness. 2–3 maintains, 3–4 improves, 4+ is highly improving. Above 5 for every run is overreaching.',
  },
];

const WEIGHT = {
  key: 'weight', label: 'Body weight', unit: 'kg', digits: 1, better: null, isWeight: true,
  info: 'From Garmin weigh-ins (Index scale or logged manually in Garmin Connect). If you have no recent weigh-ins, the weight in your Garmin profile is shown instead. Day-to-day changes are mostly water; the 7-day line is the useful trend.',
};

const DAY = 86_400_000;

function Delta({ delta, digits, better }) {
  if (delta == null) return null;
  const threshold = 0.5 * 10 ** -digits;
  if (Math.abs(delta) < threshold) return <span className="text-slate-500">–</span>;
  const up = delta > 0;
  const good = better === null ? null : (better === 'up') === up;
  const tone = good === null ? 'text-slate-400' : good ? 'text-emerald-400' : 'text-amber-400';
  return (
    <span className={tone}>
      {up ? '▲' : '▼'} {Math.abs(delta).toFixed(digits)}
    </span>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10" cy="6.25" r="1" fill="currentColor" />
    </svg>
  );
}

/** Weight points from daily metrics, oldest first, with the 30-day comparison. */
function weightSummary(days) {
  const pts = days.filter((d) => d.weight_kg != null).map((d) => ({ t: d.t, weight: d.weight_kg, source: d.weight_source }));
  if (pts.length === 0) return null;
  const last = pts[pts.length - 1];
  const before = [...pts].reverse().find((p) => p.t <= last.t - 30 * DAY);
  return { pts, last, cur: last.weight, delta: before ? last.weight - before.weight : null };
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-800/60 px-3 py-2">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function Detail({ metric, runs, weight }) {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const fmt = (v) => (v == null ? '–' : v.toFixed(metric.digits));
  const u = metric.unit ? ` ${metric.unit}` : '';

  let points;
  let avg;
  let stats;
  let note;
  if (metric.isWeight) {
    const all = weight?.pts ?? [];
    const get = (p) => p.weight;
    const shown = filterRange(all, range);
    points = shown.map((p) => ({ t: p.t, v: p.weight }));
    avg = rolling(all, shown, get, 7);
    const vals = all.map(get);
    stats = [
      { label: 'Latest', value: weight ? `${fmt(weight.cur)}${u}` : '–' },
      { label: 'vs 30 days ago', value: weight?.delta != null ? `${weight.delta > 0 ? '+' : ''}${fmt(weight.delta)}${u}` : '–' },
      { label: 'Lowest', value: vals.length ? `${fmt(Math.min(...vals))}${u}` : '–' },
      { label: 'Highest', value: vals.length ? `${fmt(Math.max(...vals))}${u}` : '–' },
    ];
    note = 'Dots are weigh-ins; the line is a 7-day rolling average.';
    if (weight?.last.source === 'profile') note = `No recent weigh-ins, showing your Garmin profile weight (${dayLabel(weight.last.t)}).`;
  } else {
    const get = (r) => r[metric.key];
    const withData = runs.filter((r) => get(r) != null);
    const shown = filterRange(withData, range);
    points = shown.map((r) => ({ t: r.t, v: get(r) }));
    avg = rolling(withData, shown, get, 28);
    const anchor = runs.length ? runs[runs.length - 1].t : 0;
    const cur = windowAvg(runs, get, anchor, 30);
    const prev = windowAvg(runs, get, anchor, 30, 30);
    const vals = withData.map(get);
    const best = metric.better === 'up' ? Math.max(...vals) : metric.better === 'down' ? Math.min(...vals) : null;
    stats = [
      { label: 'Last 30 days', value: cur != null ? `${fmt(cur)}${u}` : '–' },
      { label: 'Previous 30 days', value: prev != null ? `${fmt(prev)}${u}` : '–' },
      best != null
        ? { label: 'Best run', value: `${fmt(best)}${u}` }
        : { label: 'Range', value: vals.length ? `${fmt(Math.min(...vals))}–${fmt(Math.max(...vals))}` : '–' },
      { label: 'Runs with data', value: String(withData.length) },
    ];
    note = 'Dots are single runs; the line is a 4-week rolling average.';
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="flex gap-1 rounded-lg bg-slate-800 p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              title={r.name}
              onClick={() => setRange(r.key)}
              className={`rounded-md px-2.5 py-1 text-xs ${range === r.key ? 'bg-slate-600 text-white' : 'text-slate-400'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <LineChart
        points={points}
        avg={avg}
        emptyText={metric.isWeight ? 'No weigh-ins in this range.' : undefined}
        fmt={(v) => fmt(v)}
        higherIsUp={metric.better !== 'down'}
        color="#34d399"
      />
      <p className="text-[11px] text-slate-500">{note}</p>
      <div className="grid grid-cols-2 gap-2">
        {stats.map((s) => <Stat key={s.label} {...s} />)}
      </div>
      <div className="rounded-xl bg-slate-800/40 p-3">
        <div className="mb-1 text-xs font-medium text-slate-300">What it means</div>
        <p className="text-sm leading-relaxed text-slate-400">{metric.info}</p>
      </div>
    </div>
  );
}

export default function DynamicsCard({ runs, days = [] }) {
  const [openKey, setOpenKey] = useState(null);
  const close = useCallback(() => setOpenKey(null), []);
  const anchor = runs.length ? runs[runs.length - 1].t : 0;
  const latestVo2 = [...runs].reverse().find((r) => r.vo2max != null)?.vo2max;
  const weight = useMemo(() => weightSummary(days), [days]);

  const rows = METRICS.map((m) => {
    const cur = windowAvg(runs, (r) => r[m.key], anchor, 30);
    const prev = windowAvg(runs, (r) => r[m.key], anchor, 30, 30);
    return { ...m, cur, delta: cur != null && prev != null ? cur - prev : null };
  }).filter((m) => m.cur != null);
  if (weight) rows.push({ ...WEIGHT, cur: weight.cur, delta: weight.delta });

  const open = [...METRICS, WEIGHT].find((m) => m.key === openKey);
  const lastOpen = useRef(null); // keeps the content rendered while the drawer slides out
  if (open) lastOpen.current = open;
  const shownMetric = open ?? lastOpen.current;

  return (
    <section className="rounded-2xl bg-slate-900 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Running dynamics</h2>
        {latestVo2 != null && (
          <div className="text-right">
            <div className="text-sm font-semibold text-white">{Math.round(latestVo2)}</div>
            <div className="text-[11px] text-slate-400">VO₂max (Garmin)</div>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No running-dynamics data yet. Needs a watch or pod that records it.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {rows.map((m) => (
              <button
                key={m.key}
                onClick={() => setOpenKey(m.key)}
                className="relative rounded-xl bg-slate-800/60 p-3 text-left transition-colors active:bg-slate-800"
              >
                <span className="absolute right-2.5 top-2.5 text-slate-500" aria-label={`About ${m.label}`}>
                  <InfoIcon />
                </span>
                <div className="pr-5 text-[11px] text-slate-400">{m.label}</div>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="text-lg font-semibold text-white">{m.cur.toFixed(m.digits)}</span>
                  <span className="text-xs text-slate-400">{m.unit}</span>
                </div>
                <div className="text-[11px]">
                  {m.isWeight && m.delta == null ? (
                    <span className="text-slate-500">{weight.last.source === 'profile' ? 'Garmin profile' : dayLabel(weight.last.t)}</span>
                  ) : (
                    <Delta delta={m.delta} digits={m.digits} better={m.better} />
                  )}
                </div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Last 30 days of running, with the change versus the 30 days before. Green is an improvement. Tap a
            tile for details.
          </p>
        </>
      )}

      <Drawer open={!!open} onClose={close} title={shownMetric?.label ?? ''}>
        {shownMetric && <Detail key={shownMetric.key} metric={shownMetric} runs={runs} weight={weight} />}
      </Drawer>
    </section>
  );
}
