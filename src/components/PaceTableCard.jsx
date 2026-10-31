/** Training pace table (recovery, Z2, easy, tempo, threshold, interval) with HR ranges and the change in 30 days. */
import { ZONES, changeOf, hrAtFraction, paceAtFraction } from '../lib/analysis.js';
import { duration, paceSec } from '../lib/format.js';
import { Change, Note, SectionHead } from './ui.jsx';

// phone: zone, pace, HR, change. desktop: wider, with the unit spelled out.
const PHONE = 'grid-cols-[80px_74px_64px_minmax(0,1fr)]';
const DESK = 'lg:grid-cols-[minmax(130px,1.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_72px]';

// A zone's change is how its middle pace moved since 30 days ago.
const mid = (z) => (z.lo + z.hi) / 2;

export default function PaceTableCard({ fit, before }) {
  return (
    <section className="flex flex-col lg:card lg:gap-5 lg:p-7">
      <SectionHead
        n="03"
        title="Training Paces"
        note={<span className="hidden lg:inline">▲ faster · ▼ slower · vs 30 days ago</span>}
      />

      {!fit ? (
        <Note>Needs at least one run of 3 km or more in the last 90 days.</Note>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div className="card px-5 py-4 lg:border-0 lg:p-0">
            <div className={`rule grid ${PHONE} gap-2 pb-2.5 text-xs tracking-[0.12em] text-muted lg:hidden`}>
              <span>ZONE</span>
              <span>PACE /KM</span>
              <span>{fit.maxHr ? 'HR' : ''}</span>
              <span className="text-right">30 D</span>
            </div>
            {ZONES.map((z, i) => {
              const pace = `${paceSec(paceAtFraction(fit.vdot, z.lo))}–${paceSec(paceAtFraction(fit.vdot, z.hi))}`;
              const hr = fit.maxHr ? `${hrAtFraction(fit.maxHr, z.lo)}–${hrAtFraction(fit.maxHr, z.hi)}` : null;
              const change = changeOf(paceAtFraction(fit.vdot, mid(z)), before && paceAtFraction(before.vdot, mid(z)));
              return (
                <div key={z.key}>
                  {/* phone: four-column table */}
                  <div className={`grid ${PHONE} items-center gap-2 border-b border-dotted border-line py-3.5 text-[13px] lg:hidden`}>
                    <span>{z.key}</span>
                    <span>{pace}</span>
                    <span className="whitespace-nowrap text-muted">{hr}</span>
                    <Change change={change} fmt={duration} className="text-right text-xs" />
                  </div>
                  {/* desktop: numbered zone, pace, HR and change */}
                  <div className={`rule hidden items-center gap-x-4 gap-y-2 py-3 lg:grid ${DESK}`}>
                    <div className="flex items-baseline gap-3">
                      <span className="num text-[28px]">{String(i + 1).padStart(2, '0')}</span>
                      <span className="eyebrow">{z.key}</span>
                    </div>
                    <div className="text-sm whitespace-nowrap">
                      {pace} <span className="text-xs text-muted">/KM</span>
                    </div>
                    <div className="text-sm whitespace-nowrap text-muted">
                      {hr && (
                        <>
                          {hr} <span className="text-xs">bpm</span>
                        </>
                      )}
                    </div>
                    <Change change={change} fmt={duration} className="text-right text-sm" />
                  </div>
                </div>
              );
            })}
          </div>
          <Note>
            Derived from VDOT {fit.vdot.toFixed(1)}
            {fit.maxHr ? ` and your highest recorded HR (${fit.maxHr} bpm)` : ''}. Treat the HR column as a guide; use
            your own HR zones if you have tested them.
            <span className="lg:hidden"> 30 D = pace change versus 30 days ago (▲ faster, ▼ slower).</span>
            <span className="hidden lg:inline"> Zones move with your VDOT.</span>
          </Note>
        </div>
      )}
    </section>
  );
}
