/**
 * Analysis dashboard: cards computed from ALL your runs, not a feed of the
 * latest activity. The range selector only changes which dots the two trend
 * charts show; predictions and paces always use your recent best effort.
 */
import { useMemo, useState } from 'react';
import { DEFAULT_RANGE, RANGES, filterRange, fitness, fitnessBefore, getRuns } from '../lib/analysis.js';
import { paceSec } from '../lib/format.js';
import DynamicsCard from './DynamicsCard.jsx';
import PaceTableCard from './PaceTableCard.jsx';
import PredictionCard from './PredictionCard.jsx';
import TrendCard from './TrendCard.jsx';
import { Empty, RangePills, SectionHead } from './ui.jsx';

const signed = (d, fmt) => `${d > 0 ? '+' : d < 0 ? '−' : ''}${fmt(Math.abs(d))}`;

/** Anchor targets for the header pills (scroll-mt clears the sticky nav). */
const Anchor = ({ id, children, className = '' }) => (
  <div id={id} className={`scroll-mt-[calc(var(--top-inset)+4rem)] ${className}`}>
    {children}
  </div>
);

export default function Dashboard({ activities, days, loading, hasConnection }) {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const runs = useMemo(() => getRuns(activities), [activities]);
  const shown = useMemo(() => filterRange(runs, range), [runs, range]);
  const fit = useMemo(() => fitness(runs), [runs]);
  const before = useMemo(() => fitnessBefore(runs), [runs]); // 30 days earlier: the baseline for the change columns

  if (loading) return <Empty>Loading…</Empty>;
  if (runs.length === 0) {
    return (
      <Empty>
        {hasConnection ? 'No runs yet. They appear here once synced.' : 'Connect Garmin in Settings to see your analysis.'}
      </Empty>
    );
  }
  const rangeName = RANGES.find((r) => r.key === range)?.name;

  return (
    <div className="flex flex-col gap-8 lg:gap-14">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-6">
        <Anchor id="predictions"><PredictionCard fit={fit} before={before} /></Anchor>
        <Anchor id="paces"><PaceTableCard fit={fit} before={before} /></Anchor>
      </div>

      <Anchor id="trends" className="flex flex-col gap-3.5">
        <SectionHead
          n="04"
          title="Trends"
          note={
            <>
              {shown.length} runs<span className="hidden lg:inline"> · {rangeName}</span>
            </>
          }
        />
        <RangePills value={range} onChange={setRange} />
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2 lg:gap-6">
          <TrendCard
            title="Pace"
            runs={shown}
            allRuns={runs}
            get={(r) => r.pace}
            fmt={(v) => paceSec(v)}
            fmtDelta={(d) => `${signed(d, paceSec)} /km`}
            unit="/km"
            higherIsUp={false}
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
          />
        </div>
      </Anchor>

      <Anchor id="dynamics"><DynamicsCard runs={runs} days={days} /></Anchor>
    </div>
  );
}
