/**
 * Running dynamics: last 30 days vs the 30 days before, anchored on your most
 * recent run (so it still works if you have not run this week).
 * `better` says which direction is an improvement; null means "just a number".
 */
import { windowAvg } from '../lib/analysis.js';

const METRICS = [
  { key: 'cadence', label: 'Cadence', unit: 'spm', digits: 0, better: 'up' },
  { key: 'stride', label: 'Stride length', unit: 'cm', digits: 0, better: null },
  { key: 'gct', label: 'Ground contact', unit: 'ms', digits: 0, better: 'down' },
  { key: 'vosc', label: 'Vertical oscillation', unit: 'cm', digits: 1, better: 'down' },
  { key: 'vratio', label: 'Vertical ratio', unit: '%', digits: 1, better: 'down' },
  { key: 'power', label: 'Power', unit: 'W', digits: 0, better: null },
  { key: 'te', label: 'Aerobic effect', unit: '', digits: 1, better: null },
];

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

export default function DynamicsCard({ runs }) {
  const anchor = runs.length ? runs[runs.length - 1].t : 0;
  const latestVo2 = [...runs].reverse().find((r) => r.vo2max != null)?.vo2max;

  const rows = METRICS.map((m) => {
    const cur = windowAvg(runs, (r) => r[m.key], anchor, 30);
    const prev = windowAvg(runs, (r) => r[m.key], anchor, 30, 30);
    return { ...m, cur, delta: cur != null && prev != null ? cur - prev : null };
  }).filter((m) => m.cur != null);

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
              <div key={m.key} className="rounded-xl bg-slate-800/60 p-3">
                <div className="text-[11px] text-slate-400">{m.label}</div>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="text-lg font-semibold text-white">{m.cur.toFixed(m.digits)}</span>
                  <span className="text-xs text-slate-400">{m.unit}</span>
                </div>
                <div className="text-[11px]">
                  <Delta delta={m.delta} digits={m.digits} better={m.better} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Last 30 days of running, with the change versus the 30 days before. Green is an improvement.
          </p>
        </>
      )}
    </section>
  );
}
