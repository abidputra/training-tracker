/**
 * One exercise across sessions: record, weight per rep, 30-day volume, the
 * heaviest weight and volume per session. Built from Garmin's per-exercise summaries.
 */
import { useMemo, useState } from 'react';
import { DEFAULT_RANGE, filterRange } from '../lib/analysis.js';
import { bars } from '../lib/dots.js';
import { shortDate } from '../lib/format.js';
import { exerciseHistory, kgNum } from '../lib/strength.js';
import DotGrid from './DotGrid.jsx';
import { DetailHeader, Note, RangePills, StatStrip } from './ui.jsx';

const DAY = 86_400_000;
const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);

function SessionChart({ title, list, get, headline, sub }) {
  const vals = list.map(get);
  if (vals.length === 0 || !Math.max(...vals)) return null;
  const grid = bars(vals, 10, { w: vals.length > 16 ? 1 : 2, minSlots: 8 });
  return (
    <div className="card flex flex-col gap-3.5 p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="eyebrow">{title}</span>
        <div className="text-right">
          <div className="num text-[30px]">
            {headline} <span className="font-mono text-xs font-normal text-muted">KG</span>
          </div>
          {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
        </div>
      </div>
      <DotGrid grid={grid} label={`${title}, ${vals.length} sessions`} />
      <div className="flex justify-between text-xs text-muted">
        <span>{vals.length > 1 ? `${vals.length} sessions ago` : ''}</span>
        <span>{shortDate(list[list.length - 1].t)}</span>
      </div>
    </div>
  );
}

export default function ExerciseDetail({ name, sessions, onBack }) {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const list = useMemo(() => exerciseHistory(sessions).get(name) ?? [], [sessions, name]);
  const shown = useMemo(() => filterRange(list, range), [list, range]);

  if (list.length === 0) {
    return (
      <div className="flex flex-col gap-7">
        <DetailHeader title={name} onBack={onBack} backLabel="Back to strength metrics" />
        <Note>No sessions with this exercise.</Note>
      </div>
    );
  }

  const last = list[list.length - 1];
  const pr = Math.max(...list.map((h) => h.maxWeight));
  const month = list.filter((h) => h.t > Date.now() - 30 * DAY);
  const basis = month.length ? month : list;
  const reps = sum(basis, (h) => h.reps);
  const perRep = reps ? sum(basis, (h) => h.volume) / reps : null;
  const weighted = shown.filter((h) => h.maxWeight);
  const gain = weighted.length > 1 ? weighted[weighted.length - 1].maxWeight - weighted[0].maxWeight : null;

  return (
    <div className="flex flex-col gap-7">
      <DetailHeader
        title={name}
        sub={`Strength · ${list.length} session${list.length === 1 ? '' : 's'} · last ${shortDate(last.t)}`}
        onBack={onBack}
        backLabel="Back to strength metrics"
      />

      <StatStrip
        stats={[
          { label: 'RECORD', value: pr ? kgNum(pr) : '–', unit: pr ? 'kg' : '', accent: true },
          { label: 'AVG / REP', value: perRep ? kgNum(perRep) : '–', unit: perRep ? 'kg' : '' },
          { label: 'VOLUME 30D', value: kgNum(sum(month, (h) => h.volume)), unit: 'kg' },
        ]}
      />

      <section className="flex flex-col gap-3.5">
        <RangePills value={range} onChange={setRange} />
        <SessionChart
          title="Heaviest Weight"
          list={shown}
          get={(h) => h.maxWeight}
          headline={weighted.length ? kgNum(weighted[weighted.length - 1].maxWeight) : '–'}
          sub={gain != null ? `${gain >= 0 ? '+' : '−'}${kgNum(Math.abs(gain))} kg since first session in range` : null}
        />
        <SessionChart
          title="Volume per Session"
          list={shown}
          get={(h) => h.volume}
          headline={kgNum(last.volume)}
          sub="Latest session"
        />
        {shown.length === 0 && <Note>No sessions in this range.</Note>}
      </section>
    </div>
  );
}
