/**
 * Paints a dot-matrix graphic from lib/dots.js ({ cols, cells }).
 * With `onColumn(col, how)`, pointer presses/moves report the column under the
 * pointer (for tappable bars and "read this run" on scatter charts). `how` is
 * { down, mouse }: `down` for a press, `mouse` for a mouse (hover) rather than
 * touch. A mouse moving reports the same column many times, so a handler must
 * not toggle on anything but a touch press (see `pickBar`).
 */
import { memo } from 'react';

function DotGrid({ grid, className = '', style, onColumn, onLeave, gap = 0, label }) {
  if (!grid) return null;
  const pick = (e, down) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * grid.cols);
    onColumn(Math.min(grid.cols - 1, Math.max(0, col)), { down, mouse: e.pointerType === 'mouse' });
  };
  const interactive = !!onColumn;

  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      className={`grid ${interactive ? 'cursor-pointer touch-pan-y select-none' : ''} ${className}`}
      style={{ gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`, gap, ...style }}
      onPointerDown={interactive ? (e) => pick(e, true) : undefined}
      onPointerMove={
        interactive
          ? (e) => {
              if (e.buttons || e.pointerType === 'mouse') pick(e, false); // mouse hover, or a finger dragging
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

/**
 * Selection rule for bar charts. Hover (mouse) and drag only ever SELECT the bar
 * under the pointer, so the chart cannot flicker back to the latest value; a
 * touch tap on the selected bar clears it. `setSel` is a state setter.
 */
export function pickBar(setSel, bar, how) {
  if (bar == null) return; // the gap between bars: keep what is selected
  setSel((cur) => (how.down && !how.mouse && cur === bar ? null : bar));
}

/** Mouse left the chart: back to the latest value. (A finger lifting must keep its pick.) */
export const leaveBar = (setSel) => (e) => {
  if (e.pointerType === 'mouse') setSel(null);
};

export default memo(DotGrid);
