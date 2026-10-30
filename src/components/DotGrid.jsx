/**
 * Paints a dot-matrix graphic from lib/dots.js ({ cols, cells }).
 * With `onColumn`, pointer presses/moves report the column under the pointer
 * (for tappable bars and "read this run" on scatter charts).
 */
import { memo } from 'react';

function DotGrid({ grid, className = '', style, onColumn, onLeave, gap = 0, label }) {
  if (!grid) return null;
  const pick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * grid.cols);
    onColumn(Math.min(grid.cols - 1, Math.max(0, col)));
  };
  const interactive = !!onColumn;

  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      className={`grid ${interactive ? 'cursor-pointer touch-pan-y select-none' : ''} ${className}`}
      style={{ gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`, gap, ...style }}
      onPointerDown={interactive ? pick : undefined}
      onPointerMove={
        interactive
          ? (e) => {
              if (e.buttons || e.pointerType === 'mouse') pick(e); // mouse hover, or a finger dragging
            }
          : undefined
      }
      onPointerLeave={onLeave}
    >
      {grid.cells.map((k, i) => (
        <div key={i} className={k === 'dim' ? 'd' : `d d-${k}`} />
      ))}
    </div>
  );
}

export default memo(DotGrid);
