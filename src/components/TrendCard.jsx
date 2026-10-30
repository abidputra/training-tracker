/**
 * One metric over time (pace or heart rate): a dot per run, a 4-week rolling
 * line, and a "last 4 weeks vs the 4 weeks before" summary.
 *
 * `allRuns` feeds the rolling line and the summary so they stay correct even
 * when the range selector narrows the dots shown in `runs`.
 */
import { useMemo } from 'react';
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
}) {
  // `get` is an inline arrow, so memo on the runs only
  const points = useMemo(() => runs.map((r) => ({ t: r.t, v: get(r) })).filter((p) => p.v != null), [runs]);
  const avg = useMemo(() => rolling(allRuns, runs.filter((r) => get(r) != null), get), [allRuns, runs]);

  const anchor = allRuns.length ? allRuns[allRuns.length - 1].t : 0;
  const cur = windowAvg(allRuns, get, anchor, 28);
  const prev = windowAvg(allRuns, get, anchor, 28, 28);

  return (
    <section className="card flex flex-col gap-3.5 p-5 lg:gap-4 lg:p-7">
      <div className="flex items-start justify-between gap-2">
        <h3 className="eyebrow m-0 font-normal">{title}</h3>
        {cur != null && (
          <div className="text-right">
            <div className="num text-[30px] lg:text-4xl">
              {fmt(cur)} <span className="font-mono text-xs font-normal text-muted uppercase">{unit}</span>
            </div>
            <div className="mt-1 text-xs text-muted">
              4-wk avg{prev != null ? ` ${fmtDelta(cur - prev)} vs prev` : ''}
            </div>
          </div>
        )}
      </div>
      <LineChart points={points} avg={avg} fmt={fmt} higherIsUp={higherIsUp} />
      <p className="m-0 text-xs leading-relaxed text-muted">Dots are single runs; the accent line is a 4-week rolling average.</p>
    </section>
  );
}
