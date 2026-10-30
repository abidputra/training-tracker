/**
 * Dot-matrix trend chart: one white dot per run, the rolling average as an
 * accent line. Touch/hover a column to read that run; the header line shows
 * the latest run otherwise.
 *
 * `higherIsUp=false` puts SMALL values at the top (use for pace, where a
 * smaller number of seconds per km is faster).
 */
import { useMemo, useState } from 'react';
import { scatter } from '../lib/dots.js';
import DotGrid from './DotGrid.jsx';

const dateLabel = (t) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function LineChart({ points, avg = [], fmt, higherIsUp = true, emptyText = 'No runs in this range.', cols = 36, rows = 20 }) {
  const [selCol, setSelCol] = useState(null);
  const base = useMemo(
    () => scatter({ points, avg, cols, rows, invert: !higherIsUp }),
    [points, avg, cols, rows, higherIsUp],
  );
  const grid = useMemo(
    () => (selCol == null ? base : scatter({ points, avg, cols, rows, invert: !higherIsUp, selCol })),
    [base, selCol, points, avg, cols, rows, higherIsUp],
  );

  if (!base) return <p className="py-10 text-center text-sm text-muted">{emptyText}</p>;

  // the run nearest to the touched column
  let sel = null;
  if (selCol != null) {
    for (let d = 0; d < cols && !sel; d += 1) {
      sel = base.byCol[selCol - d]?.at(-1) ?? base.byCol[selCol + d]?.at(-1) ?? null;
    }
  }
  const shown = sel ?? points[points.length - 1];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="text-xs text-muted">
        {sel ? dateLabel(shown.t) : `Latest · ${dateLabel(shown.t)}`}
        <span className="ml-2 text-white">{fmt(shown.v)}</span>
      </div>
      <div className="flex gap-2">
        <div className="flex w-10 shrink-0 flex-col justify-between text-xs text-muted">
          {base.axis.map((v, i) => (
            <span key={i}>{fmt(v, true)}</span>
          ))}
        </div>
        <DotGrid
          grid={grid}
          className="min-w-0 flex-1"
          onColumn={setSelCol}
          onLeave={() => setSelCol(null)}
          label={`Chart, ${points.length} values from ${dateLabel(base.t0)} to ${dateLabel(base.t1)}`}
        />
      </div>
      <div className="flex justify-between pl-12 text-xs text-muted">
        <span>{dateLabel(base.t0)}</span>
        {base.t1 !== base.t0 && <span>{dateLabel(base.t1)}</span>}
      </div>
    </div>
  );
}
