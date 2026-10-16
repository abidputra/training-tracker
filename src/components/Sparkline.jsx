/**
 * Tiny trend graphic for summary cards: `bars` (e.g. weekly km) or `line`.
 * Points are { t, v }, oldest first. The last point is drawn highlighted,
 * or `selected` when given. With `onSelect`, bars are tappable (onSelect(i)).
 */
const W = 120;
const H = 36;

export default function Sparkline({ points, type = 'line', color = '#34d399', selected = null, onSelect }) {
  if (!points || points.length < 2) return <div style={{ height: H }} />;
  const vals = points.map((p) => p.v);
  const max = Math.max(...vals);
  const min = type === 'bars' ? 0 : Math.min(...vals);
  const span = max - min || 1;
  const y = (v) => H - 3 - ((v - min) / span) * (H - 6);

  if (type === 'bars') {
    const slot = W / points.length;
    const bw = Math.max(3, slot * 0.6);
    const hi = selected ?? points.length - 1;
    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={`h-9 w-full ${onSelect ? 'cursor-pointer' : ''}`}
        preserveAspectRatio="none"
        aria-hidden={onSelect ? undefined : 'true'}
      >
        {points.map((p, i) => {
          const h = Math.max(1.5, H - 3 - y(p.v) + 3);
          return (
            <g key={p.t}>
              <rect
                x={i * slot + (slot - bw) / 2}
                y={H - h}
                width={bw}
                height={h}
                rx="1.5"
                fill={color}
                opacity={i === hi ? 1 : 0.35}
                className="transition-opacity duration-150"
              />
              {onSelect && (
                // full-height hit area so short bars are easy to tap
                <rect x={i * slot} y="0" width={slot} height={H} fill="transparent" onClick={() => onSelect(i)} />
              )}
            </g>
          );
        })}
      </svg>
    );
  }

  const x = (i) => 3 + (i / (points.length - 1)) * (W - 6);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-9 w-full" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" opacity="0.8" />
      <circle cx={x(points.length - 1)} cy={y(last.v)} r="2.75" fill={color} />
    </svg>
  );
}
