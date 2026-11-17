/**
 * Km splits and Laps of a run (lists from useSplits). Each row has a dot pace bar:
 * faster = more dots (7:00 /km fills it, 11:00 /km leaves one). The bar fills its column
 * and the dots keep a steady size, so a wide column gets more dots, not bigger ones. The latest km
 * and the hard (interval) laps are drawn in the accent.
 *
 * Phone: both as compact tables. Desktop: both as tables with a pace bar per row. The laps are one
 * card with a type filter and a total row.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { meter } from '../lib/dots.js';
import { duration, paceSec } from '../lib/format.js';
import { lapLabels, lapNames, lapTotal, paceLit } from '../lib/paceBar.js';
import DotGrid from './DotGrid.jsx';

const paceOf = (r) => r.time / (r.dist / 1000);
const DOT_PX = 14; // the size one dot is aimed at
const hrOf = (r) => (r.hr ? String(r.hr) : '–');

/** Pace bar that fits its column: as many dots as fit at DOT_PX, lit in proportion to the pace. */
function PaceBar({ pace, accent, label }) {
  const ref = useRef(null);
  const [n, setN] = useState(null); // unknown until measured (before the first paint)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => setN(Math.max(12, Math.min(60, Math.round(el.clientWidth / DOT_PX))));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const grid = useMemo(
    () => n && meter(Math.max(1, Math.round((paceLit(pace) / 16) * n)), n, { lit: accent ? 'acc' : 'on' }),
    [n, pace, accent],
  );
  return (
    <div ref={ref} className="w-full">
      {grid && <DotGrid grid={grid} label={label} className="w-full" />}
    </div>
  );
}

const Title = ({ children, note }) => (
  <div className="flex items-baseline justify-between gap-2">
    <h2 className="eyebrow m-0 font-normal lg:tracking-[0.14em]">{children}</h2>
    {note && <span className="text-xs text-muted">{note}</span>}
  </div>
);

export function KmSplits({ splits }) {
  if (!splits.length) return null;
  const cols = 'grid-cols-[20px_1fr_44px_36px] gap-2.5 lg:grid-cols-[28px_1fr_56px_44px] lg:gap-3.5';
  return (
    <section className="flex flex-col gap-3">
      <Title
        note={
          <>
            <span className="lg:hidden">Every 1 km</span>
            <span className="hidden lg:inline">Auto · every 1 km</span>
          </>
        }
      >
        Km splits
      </Title>
      <div className="card px-4 py-1 lg:px-6">
        <div className={`rule hidden ${cols} pt-[18px] pb-3 text-xs tracking-[0.12em] text-muted uppercase lg:grid`}>
          <span>Km</span>
          <span>Pace</span>
          <span className="text-right">/km</span>
          <span className="text-right">Bpm</span>
        </div>
        {splits.map((k, i) => (
          <div
            key={k.n}
            className={`grid ${cols} min-h-12 items-center border-b border-dotted border-line text-[13px] last:border-b-0 lg:min-h-[52px] lg:text-sm`}
          >
            <span>{k.n}</span>
            <PaceBar pace={paceOf(k)} accent={i === splits.length - 1} label={`${paceSec(paceOf(k))} per km`} />
            <span className="text-right font-bold tabular-nums">{paceSec(paceOf(k))}</span>
            <span className="text-right text-[#b5b5b5] tabular-nums">{hrOf(k)}</span>
          </div>
        ))}
      </div>
      <p className="m-0 text-xs text-muted lg:hidden">Pace in /km, heart rate in bpm.</p>
    </section>
  );
}

/** One pill of the lap type filter. */
const Pill = ({ on, onClick, children }) => (
  <button
    aria-pressed={on}
    onClick={onClick}
    className={`min-h-11 flex-none rounded-full border px-4 text-[13px] lg:px-[18px] ${
      on ? 'border-accent bg-accent font-bold text-black' : 'border-line-strong bg-black text-white'
    }`}
  >
    {children}
  </button>
);

/**
 * Laps as ONE card: a filter by lap type (when the workout has several: warm-up, interval,
 * recovery, cool-down...), the laps, and a total row for what is shown. Phone: a compact table;
 * desktop: the same with a pace bar per lap.
 */
export function Laps({ laps }) {
  const names = useMemo(() => lapNames(laps), [laps]);
  const [filter, setFilter] = useState('All');
  if (!laps.length) return null;
  const active = names.includes(filter) ? filter : 'All'; // a type that is gone falls back to All
  const shown = active === 'All' ? laps : laps.filter((l) => lapLabels(l).name === active);
  const total = lapTotal(shown);
  const filterable = names.length > 1;
  const phoneCols = 'grid-cols-[18px_minmax(0,1fr)_40px_44px_44px_30px] gap-1.5';
  const deskCols = 'lg:grid-cols-[28px_1.3fr_80px_64px_1fr_56px_44px] lg:gap-3.5';
  const totalLabel = `Total · ${shown.length} lap${shown.length === 1 ? '' : 's'}`;

  return (
    <section className="flex flex-col gap-3">
      <Title
        note={
          <>
            <span className="lg:hidden">From watch</span>
            <span className="hidden lg:inline">From watch · {filterable ? 'filter by lap type' : 'manual, interval and auto laps'}</span>
          </>
        }
      >
        Laps
      </Title>

      {filterable && (
        <div role="group" aria-label="Filter laps by type" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
          {['All', ...names].map((n) => (
            <Pill key={n} on={n === active} onClick={() => setFilter(n)}>
              {n}
            </Pill>
          ))}
        </div>
      )}

      {/* phone: a compact table */}
      <div className="card px-4 py-1 lg:hidden">
        <div className={`grid ${phoneCols} rule pt-3.5 pb-2 text-xs tracking-[0.06em] text-muted uppercase`}>
          <span>#</span>
          <span>Lap</span>
          <span className="text-right">Km</span>
          <span className="text-right">Time</span>
          <span className="text-right">/km</span>
          <span className="text-right">Bpm</span>
        </div>
        {shown.map((l) => (
          <div key={l.n} className={`grid ${phoneCols} min-h-12 items-center border-b border-dotted border-line text-[13px]`}>
            <span>{l.n}</span>
            <span className="truncate">{lapLabels(l).name}</span>
            <span className="text-right tabular-nums">{(l.dist / 1000).toFixed(2)}</span>
            <span className="text-right tabular-nums">{duration(l.time)}</span>
            <span className={`text-right font-bold tabular-nums ${l.intensity === 'INTERVAL' ? 'text-accent' : ''}`}>{paceSec(paceOf(l))}</span>
            <span className="text-right text-[#b5b5b5] tabular-nums">{hrOf(l)}</span>
          </div>
        ))}
        <div className={`grid ${phoneCols} min-h-[52px] items-center border-t border-[#666] text-[13px] font-bold`}>
          <span className="col-span-2">{totalLabel}</span>
          <span className="text-right tabular-nums">{(total.dist / 1000).toFixed(2)}</span>
          <span className="text-right tabular-nums">{duration(total.time)}</span>
          <span className="text-right tabular-nums">{paceSec(total.pace)}</span>
          <span className="text-right tabular-nums">{total.hr ?? '–'}</span>
        </div>
      </div>

      {/* desktop: one table with a pace bar per lap */}
      <div className="card hidden px-6 py-1 lg:block">
        <div className={`rule grid ${deskCols} pt-4 pb-2.5 text-xs tracking-[0.12em] text-muted uppercase`}>
          <span>#</span>
          <span>Lap</span>
          <span className="text-right">Dist</span>
          <span className="text-right">Time</span>
          <span>Pace</span>
          <span className="text-right">/km</span>
          <span className="text-right">Bpm</span>
        </div>
        {shown.map((l) => {
          const { name, type } = lapLabels(l);
          const pace = paceOf(l);
          return (
            <div key={l.n} className={`grid ${deskCols} min-h-[52px] items-center border-b border-dotted border-line text-sm`}>
              <span>{l.n}</span>
              <div className="flex flex-col gap-0.5">
                <span>{name}</span>
                <span className="text-xs text-muted">{type}</span>
              </div>
              <span className="text-right tabular-nums">{(l.dist / 1000).toFixed(2)} km</span>
              <span className="text-right tabular-nums">{duration(l.time)}</span>
              <PaceBar pace={pace} accent={l.intensity === 'INTERVAL'} label={`${paceSec(pace)} per km`} />
              <span className="text-right font-bold tabular-nums">{paceSec(pace)}</span>
              <span className="text-right text-[#b5b5b5] tabular-nums">{hrOf(l)}</span>
            </div>
          );
        })}
        <div className={`grid ${deskCols} min-h-14 items-center border-t border-[#666] text-sm font-bold`}>
          <span className="col-span-2">{totalLabel}</span>
          <span className="text-right tabular-nums">{(total.dist / 1000).toFixed(2)} km</span>
          <span className="text-right tabular-nums">{duration(total.time)}</span>
          {total.pace ? <PaceBar pace={total.pace} label={`${paceSec(total.pace)} per km, average`} /> : <span />}
          <span className="text-right tabular-nums">{paceSec(total.pace)}</span>
          <span className="text-right tabular-nums">{total.hr ?? '–'}</span>
        </div>
      </div>

      <p className="m-0 text-xs leading-relaxed text-muted">
        <span className="lg:hidden">Km and time are totals. Pace and bpm are averages. Interval pace is in the accent colour.</span>
        <span className="hidden lg:inline">Dist and time are totals. Pace and bpm are averages. Interval pace bars are in the accent colour.</span>
      </p>
    </section>
  );
}
