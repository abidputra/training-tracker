/**
 * Paints a dot-matrix graphic from lib/dots.js ({ cols, cells }).
 * With `onColumn(col, how)`, pointer presses/moves report the column under the
 * pointer (for tappable bars and "read this run" on scatter charts). `how` is
 * { down, mouse }: `down` for a press, `mouse` for a mouse (hover) rather than
 * touch. A mouse moving reports the same column many times, so a handler must
 * not toggle on anything but a touch press (see `pickBar`).
 */
import { memo, useMemo } from 'react';
import { useReveal } from '../hooks/useReveal.js';

// Dots that "switch on" in the entrance: the data itself. Unlit dots, the grey body outline and
// the selected column are just there from the start, like the unpowered LED board.
const LIT = new Set(['on', 'acc', 'l2', 'l3']);
const SWITCH_ON_MS = 1400; // the whole board, however many dots

/** A short name for what the grid shows, so a chart that already played is not played again. */
function signature(grid) {
  if (!grid) return null;
  let h = 5381;
  for (const k of grid.cells) for (let i = 0; i < k.length; i += 1) h = ((h * 33) ^ k.charCodeAt(i)) >>> 0;
  return `dots:${grid.cols}x${grid.cells.length}:${h}`;
}

function DotGrid({ grid, className = '', style, onColumn, onLeave, gap = 0, label, animate = true }) {
  const key = useMemo(() => (animate ? signature(grid) : null), [grid, animate]);
  const [ref, phase] = useReveal(key, animate && !!grid);
  if (!grid) return null;
  const playing = phase === 'play';
  const off = phase === 'wait'; // not on screen yet: the dots wait unlit

  // LED turn-on order: column by column from the left, each column from the bottom up (unless the grid brings its own)
  const delays = useMemo(() => {
    if (!playing) return null;
    let order = [];
    if (grid.order) {
      // the graphic knows its own order (a route: start to finish)
      order = grid.order.filter((i) => LIT.has(grid.cells[i]));
    } else {
      const rows = Math.ceil(grid.cells.length / grid.cols);
      for (let c = 0; c < grid.cols; c += 1) {
        for (let r = rows - 1; r >= 0; r -= 1) {
          const i = r * grid.cols + c;
          if (LIT.has(grid.cells[i])) order.push(i);
        }
      }
    }
    const step = Math.min(45, SWITCH_ON_MS / Math.max(1, order.length));
    const out = new Map();
    order.forEach((i, n) => out.set(i, Math.round(n * step)));
    return out;
  }, [playing, grid]);
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
      ref={ref}
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
      {grid.cells.map((k, i) => {
        const lit = LIT.has(k);
        const led = playing && lit ? ' led' : off && lit ? ' led-off' : '';
        return (
          <div
            key={i}
            className={`${k === 'dim' ? 'd' : `d d-${k}`}${led}`}
            style={playing && lit ? { animationDelay: `${delays?.get(i) ?? 0}ms` } : undefined}
          />
        );
      })}
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
