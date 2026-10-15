/**
 * One metric over time (pace or heart rate): a dot per run, a 4-week rolling
 * line, and a "last 4 weeks vs the 4 weeks before" summary.
 *
 * `allRuns` feeds the rolling line and the summary so they stay correct even
 * when the range selector narrows the dots shown in `runs`.
 */
import LineChart from './LineChart.jsx';
import { rolling, windowAvg } from '../lib/analysis.js';

export default function TrendCard({
  title,
  runs,
  allRuns,
  get,
  fmt, // (value, axis?) => string
  fmtDelta, // (delta) => string
  unit = '',
  higherIsUp,
  color,
}) {
  const points = runs.map((r) => ({ t: r.t, v: get(r) })).filter((p) => p.v != null);
  const avg = rolling(allRuns, runs.filter((r) => get(r) != null), get);

  const anchor = allRuns.length ? allRuns[allRuns.length - 1].t : 0;
  const cur = windowAvg(allRuns, get, anchor, 28);
  const prev = windowAvg(allRuns, get, anchor, 28, 28);

  return (
    <section className="rounded-2xl bg-slate-900 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">{title}</h2>
        {cur != null && (
          <div className="text-right">
            <div className="text-sm font-semibold text-white">
              {fmt(cur)} {unit}
            </div>
            <div className="text-[11px] text-slate-400">
              4-wk avg{prev != null ? ` · ${fmtDelta(cur - prev)} vs prev` : ''}
            </div>
          </div>
        )}
      </div>
      <LineChart points={points} avg={avg} fmt={fmt} higherIsUp={higherIsUp} color={color} />
      <p className="mt-2 text-[11px] text-slate-500">Dots are single runs; the line is a 4-week rolling average.</p>
    </section>
  );
}
