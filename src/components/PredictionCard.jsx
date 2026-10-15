/** Race time predictions (5K / 10K / HM / FM) from your best recent effort. */
import { RACES, raceTime } from '../lib/analysis.js';
import { duration, km, paceSec, shortDate } from '../lib/format.js';

export default function PredictionCard({ fit }) {
  return (
    <section className="rounded-2xl bg-slate-900 p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">Race predictions</h2>

      {!fit ? (
        <p className="text-sm text-slate-500">Needs at least one run of 3 km or more in the last 90 days.</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <tbody>
              {RACES.map((r) => {
                const t = raceTime(fit.vdot, r.meters);
                return (
                  <tr key={r.key} className="border-b border-slate-800 last:border-0">
                    <td className="py-2 text-slate-300">{r.key}</td>
                    <td className="py-2 text-right font-semibold text-white">{duration(t)}</td>
                    <td className="py-2 pl-3 text-right text-xs text-slate-400">
                      {paceSec(t / (r.meters / 1000))} /km
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Based on your best recent effort: {km(fit.run.distance)} in {duration(fit.run.time)} (
            {shortDate(fit.run.t)}), VDOT {fit.vdot.toFixed(1)}. Estimates assume you are trained for the
            distance, so the half and full marathon are the least certain.
          </p>
        </>
      )}
    </section>
  );
}
