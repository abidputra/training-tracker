/**
 * The route as a plain line (no map): the track is projected to a flat drawing,
 * north up, scaled to fit with the right proportions. Green dot = start, red
 * ring = finish. Pure SVG, so nothing is downloaded and the route never leaves
 * the device.
 *
 * `points` is [[lat, lon, elevation], ...].
 */
import { useMemo } from 'react';

const W = 384;
const H = 224;
const PAD = 24;

/** Lat/lon -> drawing coordinates, or null when there is nothing to draw. */
function project(points) {
  const pts = points.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (pts.length < 2) return null;

  // Longitude degrees shrink with latitude; without this the shape looks stretched.
  const k = Math.cos((pts.reduce((a, p) => a + p[0], 0) / pts.length) * (Math.PI / 180));
  const xy = pts.map((p) => [p[1] * k, -p[0]]); // minus: north is up

  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const dx = Math.max(Math.max(...xs) - minX, 1e-9);
  const dy = Math.max(Math.max(...ys) - minY, 1e-9);

  const scale = Math.min((W - 2 * PAD) / dx, (H - 2 * PAD) / dy);
  const offX = (W - dx * scale) / 2;
  const offY = (H - dy * scale) / 2;
  return xy.map(([x, y]) => [offX + (x - minX) * scale, offY + (y - minY) * scale]);
}

export default function RouteLine({ points }) {
  const line = useMemo(() => project(points), [points]);
  if (!line) return null;

  const d = line.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [sx, sy] = line[0];
  const [ex, ey] = line[line.length - 1];
  const stroke = { fill: 'none', strokeLinejoin: 'round', strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke' };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full" role="img" aria-label="Route of this activity">
      <polyline points={d} stroke="#0f172a" strokeWidth="8" opacity="0.8" {...stroke} />
      <polyline points={d} stroke="#34d399" strokeWidth="3.5" {...stroke} />
      {/* finish first, start on top, so a loop (start = finish) shows both */}
      <circle cx={ex} cy={ey} r="7" fill="#ef4444" stroke="#f8fafc" strokeWidth="2" />
      <circle cx={sx} cy={sy} r="4" fill="#22c55e" stroke="#f8fafc" strokeWidth="1.5" />
    </svg>
  );
}
