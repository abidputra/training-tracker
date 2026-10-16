/**
 * Tiny dependency-free SVG line chart: one dot per run plus an optional
 * smoothed line. Touch/hover a dot to read its value.
 *
 * `higherIsUp=false` puts SMALL values at the top (use for pace, where a
 * smaller number of seconds per km is faster).
 */
import { useState } from 'react';

const W = 320;
const H = 170;
const PAD = { l: 46, r: 10, t: 10, b: 22 };

const dateLabel = (t) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function LineChart({ points, avg = [], fmt, higherIsUp = true, color = '#34d399', emptyText = 'No runs in this range.' }) {
  const [sel, setSel] = useState(null);

  if (points.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">{emptyText}</p>;
  }

  const values = [...points, ...avg].map((p) => p.v);
  let min = Math.min(...values);
  let max = Math.max(...values);
  const span = max - min || 1;
  min -= span * 0.12;
  max += span * 0.12;

  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const tSpan = t1 - t0;
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const x = (t) => (tSpan === 0 ? PAD.l + innerW / 2 : PAD.l + ((t - t0) / tSpan) * innerW);
  const y = (v) => {
    const f = (v - min) / (max - min);
    return PAD.t + (higherIsUp ? 1 - f : f) * innerH;
  };
  const valueAt = (u) => (higherIsUp ? max - u * (max - min) : min + u * (max - min));

  const line = avg.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = points[0];
    for (const p of points) if (Math.abs(x(p.t) - px) < Math.abs(x(best.t) - px)) best = p;
    setSel(best);
  }

  const shown = sel ?? points[points.length - 1];

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs text-slate-400">
        <span>{sel ? dateLabel(shown.t) : `Latest · ${dateLabel(shown.t)}`}</span>
        <span className="text-sm font-medium text-white">{fmt(shown.v)}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair touch-pan-y select-none"
        onPointerMove={onMove}
        onPointerLeave={() => setSel(null)}
        role="img"
      >
        {[0, 0.5, 1].map((u) => {
          const yy = PAD.t + u * innerH;
          return (
            <g key={u}>
              <line x1={PAD.l} x2={W - PAD.r} y1={yy} y2={yy} stroke="#1e293b" strokeWidth="1" />
              <text x={PAD.l - 6} y={yy + 3} textAnchor="end" fontSize="9" fill="#64748b">
                {fmt(valueAt(u), true)}
              </text>
            </g>
          );
        })}
        <text x={PAD.l} y={H - 6} fontSize="9" fill="#64748b">{dateLabel(t0)}</text>
        {tSpan > 0 && (
          <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize="9" fill="#64748b">{dateLabel(t1)}</text>
        )}

        {/* crosshair on the dot being hovered / touched */}
        {sel && (
          <g pointerEvents="none">
            <line x1={PAD.l} x2={x(sel.t)} y1={y(sel.v)} y2={y(sel.v)} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
            <line x1={x(sel.t)} x2={x(sel.t)} y1={PAD.t} y2={H - PAD.b} stroke="#cbd5e1" strokeWidth="1" opacity="0.8" />
            <circle cx={x(sel.t)} cy={y(sel.v)} r="9" fill={color} opacity="0.25" />
          </g>
        )}

        {avg.length > 1 && <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />}
        {points.map((p) => (
          <circle
            key={p.t}
            cx={x(p.t)}
            cy={y(p.v)}
            r={p === sel ? 4.5 : 2.5}
            fill={color}
            opacity={p === sel ? 1 : 0.55}
            stroke={p === sel ? '#f8fafc' : 'none'}
            strokeWidth="1.5"
          />
        ))}
      </svg>
    </div>
  );
}
