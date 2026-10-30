/** Race time predictions (5K / 10K / HM / FM) from your best recent effort. */
import { RACES, raceTime } from '../lib/analysis.js';
import { duration, km, paceSec, shortDate } from '../lib/format.js';
import { Note, SectionHead } from './ui.jsx';

export default function PredictionCard({ fit }) {
  return (
    <section className="flex flex-col lg:card lg:gap-5 lg:p-7">
      <SectionHead n="02" title="Race Predictions" />

      {!fit ? (
        <Note>Needs at least one run of 3 km or more in the last 90 days.</Note>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div className="card px-5 py-2 lg:border-0 lg:p-0">
            {RACES.map((r, i) => {
              const t = raceTime(fit.vdot, r.meters);
              const last = i === RACES.length - 1;
              return (
                <div key={r.key} className={`flex items-baseline justify-between gap-3 py-4 lg:py-[18px] ${last ? 'lg:rule' : 'rule'}`}>
                  <span className="w-28 text-[13px] lg:w-40 lg:text-sm lg:tracking-[0.12em] lg:uppercase">{r.key}</span>
                  <span className={`num text-[30px] lg:text-5xl ${last ? 'text-accent' : ''}`}>{duration(t)}</span>
                  <span className="w-[72px] text-right text-xs text-muted lg:w-20">{paceSec(t / (r.meters / 1000))}/km</span>
                </div>
              );
            })}
          </div>
          <Note>
            Based on your best recent effort: {km(fit.run.distance)} in {duration(fit.run.time)} ({shortDate(fit.run.t)}),
            VDOT {fit.vdot.toFixed(1)}. Estimates assume you are trained for the distance, so the half and full
            marathon are the least certain.
          </Note>
        </div>
      )}
    </section>
  );
}
