/**
 * Dot-matrix graphics as plain data: every builder returns { cols, cells },
 * a row-major list of cell kinds that components/DotGrid.jsx paints.
 *
 *   'on'   white dot        'acc'  accent dot (latest value / highlight)
 *   'dim'  unlit dot        'none' empty (gap between bars, outside a figure)
 *   'base' grey (unworked muscle)   'sel' lit-grey (selected column)
 *   'l2' / 'l3'  steps between white and the accent (muscle intensity)
 *
 * Pure functions, no React.
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Bar chart: each value a bar `w` dots wide with a one-dot gap, scaled from 0.
 * The `hi` bar (default: the last) is drawn in the accent.
 * `barAt(col)` maps a column back to its bar index (null on a gap).
 */
export function bars(input, rows, { w = 2, hi: hiIn, minSlots = 0 } = {}) {
  // Few values would stretch into a few huge dots: pad empty slots on the left so
  // the chart keeps its usual size, with the newest value at the right.
  const pad = Math.max(0, minSlots - input.length);
  const vals = [...Array(pad).fill(0), ...input];
  const hi = hiIn == null ? vals.length - 1 : hiIn + pad;
  const cols = Math.max(0, vals.length * (w + 1) - 1);
  const max = Math.max(0, ...vals);
  const hs = vals.map((v) => (max > 0 && v > 0 ? clamp(Math.ceil((v / max) * rows), 1, rows) : 0));
  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (c % (w + 1) === w) {
        cells.push('none');
        continue;
      }
      const b = Math.floor(c / (w + 1));
      cells.push(rows - r <= hs[b] ? (b === hi ? 'acc' : 'on') : 'dim');
    }
  }
  const barAt = (col) => (col % (w + 1) === w ? null : Math.floor(col / (w + 1)));
  return { cols, cells, barAt };
}

/** Column chart, one dot column per value, scaled min..max. Last column in the accent. */
export function columns(vals, rows) {
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const hs = vals.map((v) => 1 + Math.round(((v - min) / (max - min || 1)) * (rows - 1)));
  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < vals.length; c += 1) {
      cells.push(rows - r <= hs[c] ? (c === vals.length - 1 ? 'acc' : 'on') : 'dim');
    }
  }
  return { cols: vals.length, cells };
}

/** Single-row meter: `n` of `total` dots lit. `tail` paints the last lit dot in the accent. */
export function meter(n, total = 20, { lit = 'on', tail = false } = {}) {
  const k = clamp(Math.round(n), 0, total);
  const cells = Array.from({ length: total }, (_, i) => (i < k ? (tail && i === k - 1 ? 'acc' : lit) : 'dim'));
  return { cols: total, cells };
}

/**
 * Scatter of single values plus a rolling-average line, on a dot grid.
 * `points` and `avg` are { t, v }, oldest first. Time maps to columns, value
 * to rows (`invert` puts small values at the top, e.g. pace).
 * Returns the cells plus the axis bounds and, per column, the points in it
 * (so a tap on a column can show that run).
 */
export function scatter({ points, avg = [], cols, rows, invert = false, selCol = null }) {
  if (points.length === 0) return null;
  const vals = [...points, ...avg].map((p) => p.v);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  const span = max - min || 1;
  min -= span * 0.08;
  max += span * 0.08;

  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const colOf = (t) => (t1 === t0 ? Math.floor(cols / 2) : Math.round(((t - t0) / (t1 - t0)) * (cols - 1)));
  const rowOf = (v) => {
    const f = (v - min) / (max - min);
    return clamp(Math.round((invert ? f : 1 - f) * (rows - 1)), 0, rows - 1);
  };

  const cells = Array(rows * cols).fill('dim');
  if (selCol != null) for (let r = 0; r < rows; r += 1) cells[r * cols + selCol] = 'sel';

  const byCol = Array.from({ length: cols }, () => []);
  for (const p of points) {
    const c = colOf(p.t);
    byCol[c].push(p);
    cells[rowOf(p.v) * cols + c] = 'on';
  }
  // average line: one dot per column, linearly interpolated across columns with no run
  const avgCol = Array(cols).fill(null);
  for (const p of avg) avgCol[colOf(p.t)] = p.v;
  const known = avgCol.map((v, c) => (v == null ? null : c)).filter((c) => c != null);
  for (let i = 0; i < known.length; i += 1) {
    const a = known[i];
    const b = known[i + 1] ?? a;
    for (let c = a; c <= b; c += 1) {
      const v = b === a ? avgCol[a] : avgCol[a] + ((avgCol[b] - avgCol[a]) * (c - a)) / (b - a);
      cells[rowOf(v) * cols + c] = 'acc';
    }
  }

  // value at the top, middle and bottom row, for the axis labels
  const at = (u) => (invert ? min + u * (max - min) : max - u * (max - min));
  return { cols, cells, byCol, axis: [at(0), at(0.5), at(1)], t0, t1 };
}

/**
 * GPS track rasterised onto a dot grid, north up, proportions kept.
 * `points` is [[lat, lon, ...], ...]. Track in the accent, start in white.
 */
export function route(points, cols = 36, maxRows = 28) {
  const pts = points.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (pts.length < 2) return null;
  // Longitude degrees shrink with latitude; without this the shape looks stretched.
  const k = Math.cos((pts.reduce((a, p) => a + p[0], 0) / pts.length) * (Math.PI / 180));
  const xy = pts.map((p) => [p[1] * k, -p[0]]);
  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const dx = Math.max(Math.max(...xs) - minX, 1e-9);
  const dy = Math.max(Math.max(...ys) - minY, 1e-9);

  const pad = 2;
  const rows = clamp(Math.round(((cols - 2 * pad) * dy) / dx) + 2 * pad, 12, maxRows);
  const scale = Math.min((cols - 1 - 2 * pad) / dx, (rows - 1 - 2 * pad) / dy);
  const offX = (cols - 1 - dx * scale) / 2;
  const offY = (rows - 1 - dy * scale) / 2;
  const grid = xy.map(([x, y]) => [Math.round(offX + (x - minX) * scale), Math.round(offY + (y - minY) * scale)]);

  const cells = Array(rows * cols).fill('dim');
  for (let i = 0; i < grid.length - 1; i += 1) {
    const [x0, y0] = grid[i];
    const [x1, y1] = grid[i + 1];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= n; s += 1) {
      const x = Math.round(x0 + ((x1 - x0) * s) / n);
      const y = Math.round(y0 + ((y1 - y0) * s) / n);
      cells[y * cols + x] = 'acc';
    }
  }
  const [sx, sy] = grid[0];
  cells[sy * cols + sx] = 'on';
  return { cols, cells };
}

// --- Body figures for the muscle map ------------------------------------------
// A simple silhouette on a 24 x 38 grid; muscle regions are rough shapes, chosen
// to be readable at dot size, not anatomical. Ids are those of lib/muscles.js.

const GW = 24;
const GH = 38;
const CX = 11.5;
const SIDES = [-1, 1];

function seg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
const onArm = (x, y) => SIDES.some((s) => seg(x, y, CX + s * 7.6, 8, CX + s * 9.2, 24) <= 1.3);
const onLeg = (x, y) => SIDES.some((s) => seg(x, y, CX + s * 2.6, 24, CX + s * 3, 36.5) <= 1.9);

function inBody(x, y) {
  if (Math.hypot((x - CX) / 2.3, (y - 3) / 2.7) <= 1) return true; // head
  if (Math.abs(x - CX) <= 1 && y >= 5 && y <= 6.5) return true; // neck
  if (y > 6.5 && y <= 20 && Math.abs(x - CX) <= 6.2 - (y - 7) * 0.15) return true; // torso
  if (y > 20 && y <= 24.5 && Math.abs(x - CX) <= 5) return true; // hips
  return onArm(x, y) || onLeg(x, y);
}

const delt = (x, y) => SIDES.some((s) => Math.hypot(x - (CX + s * 7), y - 8.5) <= 2.2) && y <= 11;
const ax = (x) => Math.abs(x - CX);

/** Muscle id at a cell, front view. */
function frontMuscle(x, y) {
  if (delt(x, y)) return 'front-deltoids';
  if (onArm(x, y)) return y <= 16.5 ? 'biceps' : 'forearm';
  if (y > 6.5 && y < 8 && ax(x) >= 1.5 && ax(x) <= 4) return 'trapezius';
  if (y >= 8 && y <= 12.5 && ax(x) <= 5.2) return 'chest';
  if (y >= 13 && y <= 19.5) return ax(x) <= 2.2 ? 'abs' : 'obliques';
  if (y > 20 && y <= 24.5 && ax(x) >= 4) return 'abductors';
  if (onLeg(x, y)) {
    if (y <= 30 && ax(x) <= 1.6) return 'adductor';
    if (y <= 31) return 'quadriceps';
    return 'calves';
  }
  return null;
}

/** Muscle id at a cell, back view. */
function backMuscle(x, y) {
  if (delt(x, y)) return 'back-deltoids';
  if (onArm(x, y)) return y <= 16.5 ? 'triceps' : 'forearm';
  if (y > 6.5 && y < 10 && ax(x) <= 4) return 'trapezius';
  if (y >= 10 && y <= 14 && ax(x) <= 5.6) return 'upper-back';
  if (y > 14 && y <= 19.5 && ax(x) <= 3) return 'lower-back';
  if (y >= 20.5 && y <= 24.5 && ax(x) <= 4.8) return 'gluteal';
  if (onLeg(x, y)) return y <= 31 ? 'hamstring' : 'calves';
  return null;
}

const LEVEL = [null, 'on', 'l2', 'l3', 'acc'];

/** Front or back figure with each muscle lit by its level (1 = least .. 4 = most). */
export function body(view, levels) {
  const muscleAt = view === 'front' ? frontMuscle : backMuscle;
  const cells = [];
  for (let y = 0; y < GH; y += 1) {
    for (let x = 0; x < GW; x += 1) {
      if (!inBody(x, y)) cells.push('none');
      else cells.push(LEVEL[levels[muscleAt(x, y)] ?? 0] ?? 'base');
    }
  }
  return { cols: GW, cells };
}

/** Level kind for a share 0..1 of the hardest-worked muscle. */
export const levelKind = (share) => LEVEL[share >= 0.85 ? 4 : share >= 0.65 ? 3 : share >= 0.45 ? 2 : 1];
