/**
 * Muscle map: front and back dot figures with the worked muscles lit
 * (white = a little, accent = most weighted sets), a legend, and the
 * hardest-worked muscle groups as dot meters.
 *
 * `scores` is { muscleId: weightedSets } from lib/muscles.js.
 */
import { useMemo } from 'react';
import { body, levelKind, meter } from '../lib/dots.js';
import { muscleLevels, rankedMuscles } from '../lib/muscles.js';
import DotGrid from './DotGrid.jsx';

const TOP = 6; // muscle groups listed under the figures
const LEGEND = ['bg-white', 'bg-[color-mix(in_srgb,var(--accent)_35%,#fff)]', 'bg-[color-mix(in_srgb,var(--accent)_70%,#fff)]', 'bg-accent'];

export default function MuscleMap({ scores }) {
  const levels = useMemo(() => muscleLevels(scores, 4), [scores]);
  const ranked = useMemo(() => rankedMuscles(scores).slice(0, TOP), [scores]);
  const figures = useMemo(() => [['front', 'FRONT'], ['back', 'BACK']].map(([v, label]) => ({ label, grid: body(v, levels) })), [levels]);

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid grid-cols-2 gap-5 lg:gap-8 lg:px-10" role="img" aria-label={`Muscles worked, most to least: ${ranked.map((m) => m.label).join(', ')}`}>
        {figures.map((f) => (
          <figure key={f.label} className="m-0 flex flex-col items-center gap-2.5">
            <DotGrid grid={f.grid} className="w-full" />
            <figcaption className="text-xs tracking-[0.12em] text-muted">{f.label}</figcaption>
          </figure>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2.5 text-xs text-muted">
        <span>Less</span>
        {LEGEND.map((c) => (
          <span key={c} aria-hidden="true" className={`h-3 w-3 rounded-full ${c}`} />
        ))}
        <span>More</span>
      </div>

      <ul className="m-0 flex list-none flex-col p-0">
        {ranked.map((m) => (
          <li key={m.label} className="flex min-h-10 items-center gap-3 border-t border-dotted border-line lg:min-h-11 lg:gap-4">
            <span className="w-[88px] shrink-0 text-[13px]">{m.label}</span>
            <DotGrid grid={meter(Math.max(1, m.share * 20), 20, { lit: levelKind(m.share) })} className="min-w-0 flex-1" />
          </li>
        ))}
      </ul>
    </div>
  );
}
