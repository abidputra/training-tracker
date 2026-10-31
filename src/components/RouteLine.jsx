/**
 * The route as a dot-matrix drawing (no map): the GPS track rasterised onto a
 * dot grid, north up, proportions kept. Accent = track, white dot = start.
 * Nothing is downloaded and the route never leaves the device. Sharing the map
 * as an image is in the Share dialog.
 *
 * `points` is [[lat, lon, elevation], ...].
 */
import { useMemo } from 'react';
import { route } from '../lib/dots.js';
import DotGrid from './DotGrid.jsx';

export default function RouteLine({ points, distance }) {
  const grid = useMemo(() => route(points, 36), [points]);
  if (!grid) return null;

  return (
    <div className="flex flex-col gap-4">
      <DotGrid grid={grid} className="w-full" label="Route of this activity" />
      <div className="flex items-center justify-between gap-3 text-xs text-muted lg:justify-start lg:gap-6">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-white" />
          Start
        </span>
        {distance && (
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-accent" />
            {distance}
          </span>
        )}
      </div>
    </div>
  );
}
