/**
 * Km splits and Laps of a run (lists from useSplits). Each row has a 16-dot pace
 * bar: faster = more dots (7:00 /km fills it, 11:00 /km leaves one). The latest km
 * and the hard (interval) laps are drawn in the accent.
 *
 * Phone: km splits as one table, laps as cards. Desktop: both as tables.
 */
import { meter } from '../lib/dots.js';
import { duration, paceSec } from '../lib/format.js';
import DotGrid from './DotGrid.jsx';

const FAST = 420; // s per km: full bar
const SLOW = 660; // s per km: one dot

const paceOf = (r) => r.time / (r.dist / 1000);
const bar = (pace, accent) =>
  meter(Math.max(1, Math.min(16, Math.round(((SLOW - pace) / (SLOW - FAST)) * 16))), 16, { lit: accent ? 'acc' : 'on' });
const hrOf = (r) => (r.hr ? String(r.hr) : '–');

const NAMES = { WARMUP: 'Warm-up', COOLDOWN: 'Cool-down', INTERVAL: 'Interval', RECOVERY: 'Recovery', REST: 'Rest' };
const WORKOUT = new Set(['WARMUP', 'COOLDOWN', 'INTERVAL', 'RECOVERY', 'REST']);

/** "Warm-up" / "Lap", and where the lap came from: Manual (lap button), Workout (a step) or Auto. */
function lapLabels(l) {
  const name = NAMES[l.intensity] ?? 'Lap';
  const type = l.trigger === 'MANUAL' ? 'Manual' : WORKOUT.has(l.intensity) ? 'Workout' : 'Auto';
  return { name, type };
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
            <DotGrid grid={bar(paceOf(k), i === splits.length - 1)} label={`${paceSec(paceOf(k))} per km`} className="w-full" />
            <span className="text-right font-bold tabular-nums">{paceSec(paceOf(k))}</span>
            <span className="text-right text-[#b5b5b5] tabular-nums">{hrOf(k)}</span>
          </div>
        ))}
      </div>
      <p className="m-0 text-xs text-muted lg:hidden">Pace in /km, heart rate in bpm.</p>
    </section>
  );
}

export function Laps({ laps }) {
  if (!laps.length) return null;
  const cols = 'lg:grid-cols-[28px_1.3fr_80px_64px_1fr_56px_44px] lg:gap-3.5';
  return (
    <section className="flex flex-col gap-3">
      <Title
        note={
          <>
            <span className="lg:hidden">From watch</span>
            <span className="hidden lg:inline">From watch · manual, interval and auto laps</span>
          </>
        }
      >
        Laps
      </Title>

      {/* phone: one card per lap */}
      <div className="flex flex-col gap-2 lg:hidden">
        {laps.map((l) => {
          const { name, type } = lapLabels(l);
          const pace = paceOf(l);
          return (
            <div key={l.n} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-black px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold">
                  {l.n} · {name}
                </span>
                <span className="text-xs text-muted">{type}</span>
              </div>
              <DotGrid grid={bar(pace, l.intensity === 'INTERVAL')} label={`${paceSec(pace)} per km`} className="w-full" />
              <div className="grid grid-cols-4 gap-2 text-[13px]">
                {[
                  ['Dist', `${(l.dist / 1000).toFixed(2)} km`],
                  ['Time', duration(l.time)],
                  ['Pace', paceSec(pace)],
                  ['Bpm', hrOf(l)],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted">{label}</span>
                    <span className="tabular-nums">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* desktop: one table */}
      <div className="card hidden px-6 py-1 lg:block">
        <div className={`rule grid ${cols} pt-[18px] pb-3 text-xs tracking-[0.12em] text-muted uppercase`}>
          <span>#</span>
          <span>Lap</span>
          <span className="text-right">Dist</span>
          <span className="text-right">Time</span>
          <span>Pace</span>
          <span className="text-right">/km</span>
          <span className="text-right">Bpm</span>
        </div>
        {laps.map((l) => {
          const { name, type } = lapLabels(l);
          const pace = paceOf(l);
          return (
            <div key={l.n} className={`grid ${cols} min-h-[52px] items-center border-b border-dotted border-line text-sm last:border-b-0`}>
              <span>{l.n}</span>
              <div className="flex flex-col gap-0.5">
                <span>{name}</span>
                <span className="text-xs text-muted">{type}</span>
              </div>
              <span className="text-right tabular-nums">{(l.dist / 1000).toFixed(2)} km</span>
              <span className="text-right tabular-nums">{duration(l.time)}</span>
              <DotGrid grid={bar(pace, l.intensity === 'INTERVAL')} label={`${paceSec(pace)} per km`} className="w-full" />
              <span className="text-right font-bold tabular-nums">{paceSec(pace)}</span>
              <span className="text-right text-[#b5b5b5] tabular-nums">{hrOf(l)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
