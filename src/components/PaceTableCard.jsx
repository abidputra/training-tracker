/** Training pace table (recovery, Z2, easy, tempo, threshold, interval) with HR ranges. */
import { ZONES, hrAtFraction, paceAtFraction } from '../lib/analysis.js';
import { paceSec } from '../lib/format.js';

export default function PaceTableCard({ fit }) {
  return (
    <section className="rounded-2xl bg-slate-900 p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">Training paces</h2>

      {!fit ? (
        <p className="text-sm text-slate-500">Needs at least one run of 3 km or more in the last 90 days.</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="pb-1 font-medium">Zone</th>
                <th className="pb-1 text-right font-medium">Pace /km</th>
                {fit.maxHr && <th className="pb-1 text-right font-medium">HR</th>}
              </tr>
            </thead>
            <tbody>
              {ZONES.map((z) => (
                <tr key={z.key} className="border-t border-slate-800">
                  <td className="py-2 text-slate-300">{z.key}</td>
                  <td className="py-2 text-right font-semibold text-white">
                    {paceSec(paceAtFraction(fit.vdot, z.lo))}–{paceSec(paceAtFraction(fit.vdot, z.hi))}
                  </td>
                  {fit.maxHr && (
                    <td className="py-2 text-right text-xs text-slate-400">
                      {hrAtFraction(fit.maxHr, z.lo)}–{hrAtFraction(fit.maxHr, z.hi)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Derived from VDOT {fit.vdot.toFixed(1)}
            {fit.maxHr ? ` and your highest recorded HR (${fit.maxHr} bpm)` : ''}. Treat the HR column as a guide;
            use your own HR zones if you have tested them.
          </p>
        </>
      )}
    </section>
  );
}
