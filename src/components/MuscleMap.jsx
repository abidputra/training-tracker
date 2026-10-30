/**
 * Muscle map: front and back figures with the worked muscles highlighted
 * (brighter = more weighted sets), a legend, and the hardest-worked muscle
 * groups as bars. Loaded lazily by ActivityDetail: the figure data is large.
 *
 * `scores` is { muscleId: weightedSets } from lib/muscles.js.
 */
import { useMemo } from 'react';
import Model from 'react-body-highlighter';
import { muscleLevels, rankedMuscles } from '../lib/muscles.js';

// light work -> hard work
const RAMP = ['#0f766e', '#10b981', '#34d399', '#a7f3d0'];
const BODY = '#1e293b'; // slate-800: muscles that were not worked
const TOP = 6; // muscle groups listed under the figures

export default function MuscleMap({ scores }) {
  const data = useMemo(
    () =>
      Object.entries(muscleLevels(scores, RAMP.length)).map(([muscle, level]) => ({
        name: muscle,
        muscles: [muscle],
        frequency: level, // the library adds this up per muscle, so it becomes the colour step
      })),
    [scores],
  );
  const ranked = useMemo(() => rankedMuscles(scores).slice(0, TOP), [scores]);

  return (
    <div>
      <div
        className="grid grid-cols-2 gap-3"
        role="img"
        aria-label={`Muscles worked, most to least: ${ranked.map((m) => m.label).join(', ')}`}
      >
        {[
          ['anterior', 'Front'],
          ['posterior', 'Back'],
        ].map(([type, label]) => (
          <figure key={type} className="text-center">
            <Model
              type={type}
              data={data}
              bodyColor={BODY}
              highlightedColors={RAMP}
              style={{ width: '100%', padding: 0 }}
              svgStyle={{ width: '100%', maxHeight: '15rem' }}
            />
            <figcaption className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">{label}</figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-slate-500">
        <span>Less</span>
        {RAMP.map((c) => (
          <span key={c} className="h-2.5 w-6 rounded-sm" style={{ background: c }} />
        ))}
        <span>More</span>
      </div>

      <ul className="mt-4 space-y-2">
        {ranked.map((m) => (
          <li key={m.label} className="flex items-center gap-3 text-sm">
            <span className="w-24 shrink-0 text-slate-300">{m.label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.max(6, Math.round(m.share * 100))}%`,
                  background: RAMP[Math.min(RAMP.length - 1, Math.ceil(m.share * RAMP.length) - 1)],
                }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
