/** Training pace table (recovery, Z2, easy, tempo, threshold, interval) with HR ranges. */
import { ZONES, hrAtFraction, paceAtFraction } from '../lib/analysis.js';
import { meter } from '../lib/dots.js';
import { paceSec } from '../lib/format.js';
import DotGrid from './DotGrid.jsx';
import { Note, SectionHead } from './ui.jsx';

// Desktop meter: zones light up progressively, 20 dots for the hardest.
const METERS = ZONES.map((_, i) => meter(Math.round(((i + 1) / ZONES.length) * 20) || 1, 20, { tail: true }));

export default function PaceTableCard({ fit }) {
  return (
    <section className="flex flex-col lg:card lg:gap-5 lg:p-7">
      <SectionHead n="03" title="Training Paces" />

      {!fit ? (
        <Note>Needs at least one run of 3 km or more in the last 90 days.</Note>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div className="card px-5 py-4 lg:border-0 lg:p-0">
            <div className="rule grid grid-cols-[1.1fr_1.2fr_1fr] gap-2 pb-2.5 text-xs tracking-[0.12em] text-muted lg:hidden">
              <span>ZONE</span>
              <span className="text-right">PACE /KM</span>
              {fit.maxHr && <span className="text-right">HR</span>}
            </div>
            {ZONES.map((z, i) => {
              const pace = `${paceSec(paceAtFraction(fit.vdot, z.lo))}–${paceSec(paceAtFraction(fit.vdot, z.hi))}`;
              const hr = fit.maxHr ? `${hrAtFraction(fit.maxHr, z.lo)}–${hrAtFraction(fit.maxHr, z.hi)}` : null;
              return (
                <div key={z.key}>
                  {/* phone: three-column table */}
                  <div className="grid grid-cols-[1.1fr_1.2fr_1fr] items-center gap-2 border-b border-dotted border-line py-3.5 text-[13px] lg:hidden">
                    <span>{z.key}</span>
                    <span className="text-right">{pace}</span>
                    {hr && <span className="text-right text-muted">{hr}</span>}
                  </div>
                  {/* desktop: numbered zone, dot meter, pace and HR */}
                  <div className="rule hidden flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 lg:flex">
                    <div className="flex min-w-[150px] items-baseline gap-3">
                      <span className="num text-[28px]">{String(i + 1).padStart(2, '0')}</span>
                      <span className="eyebrow">{z.key}</span>
                    </div>
                    <DotGrid grid={METERS[i]} style={{ gridTemplateColumns: 'repeat(20, 8px)' }} gap={2} />
                    <div className="min-w-[130px] text-right text-sm">
                      {pace} <span className="text-xs text-muted">/KM</span>
                      {hr && <div className="mt-1 text-xs text-muted">{hr} bpm</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Note>
            Derived from VDOT {fit.vdot.toFixed(1)}
            {fit.maxHr ? ` and your highest recorded HR (${fit.maxHr} bpm)` : ''}. Treat the HR column as a guide; use
            your own HR zones if you have tested them.
          </Note>
        </div>
      )}
    </section>
  );
}
