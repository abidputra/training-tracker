/**
 * Analysis dashboard: cards computed from ALL your runs, not a feed of the
 * latest activity. The range selector only changes which dots the two trend
 * charts show; predictions and paces always use your recent best effort.
 */
import { useMemo, useState } from 'react';
import { filterRange, fitness, getRuns } from '../lib/analysis.js';
import { paceSec } from '../lib/format.js';
import DynamicsCard from './DynamicsCard.jsx';
import PaceTableCard from './PaceTableCard.jsx';
import PredictionCard from './PredictionCard.jsx';
import TrendCard from './TrendCard.jsx';

const RANGES = [
  { key: '4w', label: '4 weeks' },
  { key: '12w', label: '12 weeks' },
  { key: 'all', label: 'All' },
];

const signed = (d, fmt) => `${d > 0 ? '+' : d < 0 ? '−' : ''}${fmt(Math.abs(d))}`;

export default function Dashboard({ activities, loading, hasConnection }) {
  const [range, setRange] = useState('12w');
  const runs = useMemo(() => getRuns(activities), [activities]);
  const shown = useMemo(() => filterRange(runs, range), [runs, range]);
  const fit = useMemo(() => fitness(runs), [runs]);

  if (loading) return <p className="py-8 text-center text-sm text-slate-500">Loading…</p>;
  if (runs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        {hasConnection ? 'No runs yet. They appear here once synced.' : 'Connect Strava or Garmin to see your analysis.'}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <PredictionCard fit={fit} />
      <PaceTableCard fit={fit} />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-300">Trends · {runs.length} runs</h2>
        <div className="flex gap-1 rounded-lg bg-slate-900 p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-md px-2.5 py-1 text-xs ${
                range === r.key ? 'bg-slate-700 text-white' : 'text-slate-400'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <TrendCard
        title="Pace"
        runs={shown}
        allRuns={runs}
        get={(r) => r.pace}
        fmt={(v) => paceSec(v)}
        fmtDelta={(d) => `${signed(d, paceSec)} /km`}
        unit="/km"
        higherIsUp={false}
        color="#38bdf8"
      />
      <TrendCard
        title="Heart rate"
        runs={shown}
        allRuns={runs}
        get={(r) => r.hr}
        fmt={(v) => String(Math.round(v))}
        fmtDelta={(d) => `${signed(d, (x) => Math.round(x))} bpm`}
        unit="bpm"
        higherIsUp
        color="#f87171"
      />

      <DynamicsCard runs={runs} />
    </div>
  );
}
