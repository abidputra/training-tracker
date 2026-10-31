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
import { Note, RangePills, SectionHead } from './ui.jsx';
import Count from './Count.jsx';

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

/** Change vs the previous 30 days. A decline is drawn in the accent, an improvement in white. */
function Delta({ delta, digits, better }) {
  if (delta == null) return null;
  const threshold = 0.5 * 10 ** -digits;
  if (Math.abs(delta) < threshold) return <span className="text-muted">–</span>;
  const up = delta > 0;
  const good = better === null ? null : (better === 'up') === up;
  const tone = good === null ? 'text-muted' : good ? 'text-white' : 'text-accent';
  return (
    <span className={`font-bold ${tone}`}>
      {up ? '▲' : '▼'} {Math.abs(delta).toFixed(digits)}
    </span>
  );
}

function InfoIcon() {
  return (
    <span
      aria-hidden="true"
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#666] text-[10px] leading-none text-muted"
    >
      i
    </span>
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
    <div className="rounded-[20px] border border-line-strong px-5 py-4">
      <div className="text-sm text-[#b5b5b5]">{label}</div>
      <div className="mt-2.5 text-lg font-bold">{value}</div>
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
    note = 'Dots are weigh-ins; the accent line is a 7-day rolling average.';
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
    note = 'Dots are single runs; the accent line is a 4-week rolling average.';
  }

  return (
    <div className="flex flex-col gap-4">
      <RangePills value={range} onChange={setRange} large />
      <LineChart
        large
        points={points}
        avg={avg}
        emptyText={metric.isWeight ? 'No weigh-ins in this range.' : undefined}
        fmt={(v) => fmt(v)}
        higherIsUp={metric.better !== 'down'}
      />
      <p className="m-0 text-sm leading-relaxed text-[#b5b5b5]">{note}</p>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => <Stat key={s.label} {...s} />)}
      </div>
      <div className="flex flex-col gap-3 rounded-[20px] border border-line-strong p-5">
        <div className="text-sm tracking-[0.14em] text-[#b5b5b5] uppercase">What it means</div>
        <p className="m-0 text-base leading-relaxed text-white">{metric.info}</p>
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
    <section>
      <SectionHead
        n="05"
        title="Running Dynamics"
        note={
          latestVo2 != null && (
            <>
              <span className="lg:hidden">VO₂max </span>
              <span className="hidden lg:inline">Last 30 days vs the 30 before · VO₂max </span>
              <span className="font-bold text-white">{Math.round(latestVo2)}</span> (Garmin)
            </>
          )
        }
      />

      {rows.length === 0 ? (
        <Note>No running-dynamics data yet. Needs a watch or pod that records it.</Note>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
            {rows.map((m) => (
              <button
                key={m.key}
                onClick={() => setOpenKey(m.key)}
                aria-label={`${m.label}: ${m.cur.toFixed(m.digits)} ${m.unit}. Details`}
                className="card flex min-h-[108px] flex-col justify-between gap-2.5 rounded-2xl p-4 text-left active:bg-neutral-950 lg:gap-4 lg:rounded-[20px] lg:p-6"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs text-muted lg:tracking-[0.12em] lg:uppercase">{m.label}</span>
                  <InfoIcon />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="num text-[34px] lg:text-[56px]"><Count text={m.cur.toFixed(m.digits)} /></span>
                  <span className="text-xs text-muted">{m.unit}</span>
                  <span className="ml-auto hidden text-xs lg:inline">
                    <Delta delta={m.delta} digits={m.digits} better={m.better} />
                  </span>
                </div>
                <div className="text-xs lg:hidden">
                  {m.isWeight && m.delta == null ? (
                    <span className="text-muted">{weight.last.source === 'profile' ? 'Garmin profile' : dayLabel(weight.last.t)}</span>
                  ) : (
                    <Delta delta={m.delta} digits={m.digits} better={m.better} />
                  )}
                </div>
              </button>
            ))}
          </div>
          <Note className="mt-3.5">
            Last 30 days of running, with the change versus the 30 days before. The accent marks a decline. Tap a tile
            for details.
          </Note>
        </>
      )}

      <Drawer open={!!open} onClose={close} title={shownMetric?.label ?? ''}>
        {shownMetric && <Detail key={shownMetric.key} metric={shownMetric} runs={runs} weight={weight} />}
      </Drawer>
    </section>
  );
}
