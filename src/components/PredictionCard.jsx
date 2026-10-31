/** Race time predictions (5K / 10K / HM / FM) from your best recent effort, and how each moved in 30 days. */
import { RACES, changeOf, raceTime } from '../lib/analysis.js';
import { duration, km, paceSec, shortDate } from '../lib/format.js';
import { Change, Note, SectionHead } from './ui.jsx';

export default function PredictionCard({ fit, before }) {
  return (
    <section className="flex flex-col lg:card lg:gap-5 lg:p-7">
      <SectionHead
        n="02"
        title="Race Predictions"
        note={<span className="hidden lg:inline">▲ faster · ▼ slower · vs 30 days ago</span>}
      />

      {!fit ? (
        <Note>Needs at least one run of 3 km or more in the last 90 days.</Note>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div className="card px-5 py-2 lg:border-0 lg:p-0">
            {RACES.map((r, i) => {
              const t = raceTime(fit.vdot, r.meters);
              const change = changeOf(t, before && raceTime(before.vdot, r.meters));
              const last = i === RACES.length - 1;
              const pace = `${paceSec(t / (r.meters / 1000))}/km`;
              return (
                <div key={r.key} className={`flex items-center justify-between gap-2.5 py-3.5 lg:gap-4 lg:py-[18px] ${last ? 'lg:rule' : 'rule'}`}>
                  {/* phone: name over pace */}
                  <div className="flex min-w-0 flex-1 flex-col gap-1 lg:hidden">
                    <span className="text-[13px]">{r.key}</span>
                    <span className="text-xs text-muted">{pace}</span>
                  </div>
                  <span className="hidden w-40 text-sm tracking-[0.12em] uppercase lg:inline">{r.key}</span>
                  <span className={`num flex-none text-[28px] lg:w-[206px] lg:text-5xl ${last ? 'text-accent' : ''}`}>{duration(t)}</span>
                  <div className="flex w-20 flex-none flex-col items-end gap-1.5 text-right lg:gap-1">
                    <Change change={change} fmt={duration} className="text-xs lg:text-sm" />
                    <span className="hidden text-xs text-muted lg:inline">{pace}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <Note>
            Based on your best recent effort: {km(fit.run.distance)} in {duration(fit.run.time)} ({shortDate(fit.run.t)}),
            VDOT {fit.vdot.toFixed(1)}. Estimates assume you are trained for the distance, so the half and full
            marathon are the least certain.
            <span className="lg:hidden"> ▲ faster, ▼ slower, versus 30 days ago.</span>
          </Note>
        </div>
      )}
    </section>
  );
}
