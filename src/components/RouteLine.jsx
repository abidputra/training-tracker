/**
 * The route as a dot-matrix drawing (no map): the GPS track rasterised onto a
 * dot grid, north up, proportions kept. Accent = track, white dot = start.
 * Nothing is downloaded and the route never leaves the device.
 *
 * `points` is [[lat, lon, elevation], ...]. "Download GPX" builds the file
 * from these points in the browser.
 */
import { useMemo } from 'react';
import { route } from '../lib/dots.js';
import DotGrid from './DotGrid.jsx';
import { Icon } from './ui.jsx';

function toGpx(points, name, startIso) {
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
  const pts = points
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map((p) => `<trkpt lat="${p[0]}" lon="${p[1]}">${Number.isFinite(p[2]) ? `<ele>${p[2]}</ele>` : ''}</trkpt>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Training Tracker" xmlns="http://www.topografix.com/GPX/1/1"><metadata><time>${esc(startIso)}</time></metadata><trk><name>${esc(name)}</name><trkseg>${pts}</trkseg></trk></gpx>`;
}

export default function RouteLine({ points, distance, name = 'Activity', start }) {
  const grid = useMemo(() => route(points, 36), [points]);
  if (!grid) return null;

  const download = () => {
    const url = URL.createObjectURL(new Blob([toGpx(points, name, start)], { type: 'application/gpx+xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^\w-]+/g, '_')}_${(start ?? '').slice(0, 10)}.gpx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex flex-col gap-4">
      <DotGrid grid={grid} className="w-full" label="Route of this activity" />
      <div className="flex items-center justify-between gap-3 text-xs text-muted">
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
      <button onClick={download} className="btn w-full">
        <Icon name="download" /> Download GPX
      </button>
    </div>
  );
}
