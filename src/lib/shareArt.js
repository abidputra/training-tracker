/**
 * Share images: the dot-matrix pieces of an activity (route map, summary card,
 * km splits, laps, big numbers, muscle map) drawn on a canvas at export size.
 * The preview in the share dialog is the same canvas, scaled down, so what you
 * see is exactly the PNG you download.
 *
 *   Transparent  no background; text is white, the accent marks highlights, and
 *                unlit dots are faint white so they still read on any photo.
 *   Solid        the same artwork on black with the dot grid behind it.
 *
 * `runAssets` / `strengthAssets` build the list of pieces an activity offers;
 * each piece is { id, name, size: [w, h], draw(ctx, w, h, pal) }. Browser only
 * (canvas), no React.
 */
import { body, meter, route as routeGrid } from './dots.js';
import { muscleLevels } from './muscles.js';
import { paceLit } from './paceBar.js';
import { paceSec } from './format.js';

const SQUARE = [1080, 1080];
const CARD = [1080, 1350];
const STAT = [1080, 540];

const DOTO = (weight, size) => `${weight} ${size}px Doto, "DotGothic16", "Space Mono", monospace`;
const MONO = (weight, size) => `${weight} ${size}px "Space Mono", ui-monospace, monospace`;
const DOT = 0.31; // lit dot radius as a share of its cell, like the on-screen dots (62% diameter)

/**
 * Canvas text needs the web fonts loaded; ask for the ones the images use. Gives up
 * after 3 s (offline, blocked fonts) so an export never hangs: the system monospace
 * is drawn instead.
 */
export async function loadShareFonts() {
  const load = Promise.all(
    ['900 100px Doto', '700 100px Doto', '400 20px "Space Mono"', '700 20px "Space Mono"'].map((f) => document.fonts.load(f)),
  ).catch(() => {});
  await Promise.race([load, new Promise((resolve) => setTimeout(resolve, 3000))]);
}

/** The accent mixed with white: pct = share of accent (0 = white, 1 = accent). */
function mix(hex, pct) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (shift) => Math.round(((n >> shift) & 255) * pct + 255 * (1 - pct));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

/** Colour of each dot kind (see lib/dots.js) for this export. */
function palette({ accent, solid }) {
  const unlit = solid ? '#2A2A2A' : 'rgba(255, 255, 255, 0.18)';
  return { accent, on: '#FFFFFF', acc: accent, dim: unlit, base: unlit, sel: unlit, l2: mix(accent, 0.35), l3: mix(accent, 0.7) };
}

/** Draws { cols, cells } across `w` px starting at (x, y); returns the height used. */
function drawGrid(ctx, grid, x, y, w, pal) {
  const cell = w / grid.cols;
  const rows = Math.ceil(grid.cells.length / grid.cols);
  for (let i = 0; i < grid.cells.length; i += 1) {
    const kind = grid.cells[i];
    if (kind === 'none') continue;
    ctx.fillStyle = pal[kind] ?? pal.dim;
    ctx.beginPath();
    ctx.arc(x + ((i % grid.cols) + 0.5) * cell, y + (Math.floor(i / grid.cols) + 0.5) * cell, cell * DOT, 0, Math.PI * 2);
    ctx.fill();
  }
  return rows * cell;
}

/** Text with letter spacing (ctx.letterSpacing is not in every browser). */
function spaced(ctx, str, x, y, spacing, align = 'left') {
  const chars = [...str];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + spacing;
  });
}

/** Largest font size (<= `size`) at which `str` fits in `maxW`. */
function fit(ctx, make, str, size, maxW) {
  let s = size;
  ctx.font = make(s);
  while (s > 20 && ctx.measureText(str).width > maxW) {
    s -= 4;
    ctx.font = make(s);
  }
  return s;
}

// ---- pieces ------------------------------------------------------------------

/** One big number with its label above and unit beside it (1080 x 540). */
function drawStat(ctx, w, h, pal, { label, value, unit, hot }) {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.font = MONO(400, 30);
  spaced(ctx, label.toUpperCase(), w / 2, h * 0.26, 5, 'center');

  const gap = unit ? 28 : 0;
  ctx.font = MONO(400, 34);
  const unitW = unit ? ctx.measureText(unit).width + unit.length * 3 : 0;
  const size = fit(ctx, (s) => DOTO(900, s), value, 270, w - 140 - unitW - gap);
  ctx.font = DOTO(900, size);
  const valueW = ctx.measureText(value).width;
  const x0 = (w - (valueW + gap + unitW)) / 2;
  const base = h * 0.7 + size * 0.1;
  ctx.textAlign = 'left';
  ctx.fillStyle = hot ? pal.accent : '#fff';
  ctx.fillText(value, x0, base);
  if (unit) {
    ctx.fillStyle = '#fff';
    ctx.font = MONO(400, 34);
    spaced(ctx, unit, x0 + valueW + gap, base, 3);
  }
}

/** A grid centred in the whole canvas (route map, muscle map: 1080 x 1080). */
function drawMap(ctx, w, h, pal, grid, share = 0.76) {
  const width = w * share;
  const cell = width / grid.cols;
  const height = Math.ceil(grid.cells.length / grid.cols) * cell;
  drawGrid(ctx, grid, (w - width) / 2, (h - height) / 2, width, pal);
}

/** Title + date, the map, then three big numbers (1080 x 1350). */
function drawSummary(ctx, w, h, pal, { title, date, grid, mapShare, stats }) {
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  const size = fit(ctx, (s) => DOTO(900, s), title.toUpperCase(), 64, w - 160);
  ctx.font = DOTO(900, size);
  spaced(ctx, title.toUpperCase(), w / 2, 140, 2, 'center');
  ctx.font = MONO(400, 28);
  spaced(ctx, date, w / 2, 192, 1, 'center');

  if (grid) {
    const width = w * mapShare;
    const cell = width / grid.cols;
    const height = Math.ceil(grid.cells.length / grid.cols) * cell;
    drawGrid(ctx, grid, (w - width) / 2, 250 + (560 - height) / 2, width, pal);
  }

  const colW = (w - 120) / stats.length;
  stats.forEach((s, i) => {
    const cx = 60 + colW * i + colW / 2;
    ctx.fillStyle = '#fff';
    ctx.font = MONO(400, 26);
    spaced(ctx, s.label.toUpperCase(), cx, 1010, 4, 'center');
    const valSize = fit(ctx, (z) => DOTO(900, z), s.value, 120, colW - 30);
    ctx.font = DOTO(900, valSize);
    ctx.fillStyle = s.hot ? pal.accent : '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(s.value, cx, 1010 + 40 + valSize);
    ctx.fillStyle = '#fff';
    ctx.font = MONO(400, 28);
    ctx.fillText(s.unit, cx, 1010 + 40 + valSize + 50);
  });
}

/** Km splits / laps: label, distance, pace bar, pace, heart rate (1080 x 1350). */
function drawTable(ctx, w, h, pal, { title, context, rows }) {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.font = DOTO(900, 58);
  spaced(ctx, title.toUpperCase(), 60, 118, 2);
  ctx.font = MONO(400, 24);
  spaced(ctx, context, w - 60, 112, 0, 'right');

  const top = 170;
  const bottom = h - 110;
  const rowH = Math.min(84, Math.floor((bottom - top) / Math.max(rows.length, 1)));
  const font = rowH >= 60 ? 28 : 24;
  const barX = 520;
  const barW = 300;
  rows.forEach((r, i) => {
    const mid = top + i * rowH + rowH / 2;
    ctx.fillStyle = '#fff';
    ctx.font = MONO(400, font);
    ctx.textAlign = 'left';
    ctx.fillText(r.a, 60, mid + font * 0.35);
    ctx.fillText(r.mid, 330, mid + font * 0.35);
    const grid = meter(paceLit(r.paceSec), 16, { lit: r.hot ? 'acc' : 'on' });
    drawGrid(ctx, grid, barX, mid - barW / 16 / 2, barW, pal);
    ctx.fillStyle = '#fff'; // drawGrid leaves the last dot colour behind
    ctx.font = MONO(700, font);
    ctx.textAlign = 'right';
    ctx.fillText(paceSec(r.paceSec), 930, mid + font * 0.35);
    ctx.font = MONO(400, font);
    ctx.fillText(r.hr ?? '–', w - 60, mid + font * 0.35);
  });
  ctx.fillStyle = '#fff';
  ctx.font = MONO(400, 24);
  ctx.textAlign = 'right';
  ctx.fillText('Pace /km · heart rate bpm', w - 60, h - 60);
}

// ---- the pieces an activity offers -----------------------------------------------

const km = (m) => `${(m / 1000).toFixed(2)} km`;

/**
 * Run pieces. Missing data hides its piece: no route (treadmill) = no map,
 * no splits/laps loaded = no tables.
 * `stats`: { distance, time, pace, hr } each { value, unit } (hr may be null).
 */
export function runAssets({ title, date, routePoints, splits, laps, stats }) {
  const map = routePoints?.length > 1 ? routeGrid(routePoints, 36) : null;
  const context = `${title} · ${date}`;
  const out = [];
  if (map) out.push({ id: 'map', name: 'Route map', size: SQUARE, draw: (c, w, h, p) => drawMap(c, w, h, p, map) });
  out.push({
    id: 'summary',
    name: 'Summary card',
    size: CARD,
    draw: (c, w, h, p) =>
      drawSummary(c, w, h, p, {
        title,
        date,
        grid: map,
        mapShare: 0.5,
        stats: [
          { label: 'Distance', ...stats.distance, hot: true },
          { label: 'Time', ...stats.time },
          { label: stats.paceLabel ?? 'Pace', ...stats.pace },
        ],
      }),
  });
  if (splits?.length) {
    const rows = splits.map((k, i) => ({
      a: String(k.n),
      mid: km(k.dist),
      paceSec: k.time / (k.dist / 1000),
      hr: k.hr ? String(k.hr) : null,
      hot: i === splits.length - 1,
    }));
    out.push({ id: 'splits', name: 'Km splits', size: CARD, draw: (c, w, h, p) => drawTable(c, w, h, p, { title: 'Km splits', context, rows }) });
  }
  if (laps?.length) {
    const rows = laps.map((l) => ({
      a: `${l.n} ${l.name}`,
      mid: km(l.dist),
      paceSec: l.time / (l.dist / 1000),
      hr: l.hr ? String(l.hr) : null,
      hot: l.intensity === 'INTERVAL',
    }));
    out.push({ id: 'laps', name: 'Laps', size: CARD, draw: (c, w, h, p) => drawTable(c, w, h, p, { title: 'Laps', context, rows }) });
  }
  const stat = (id, name, label, s, hot) => ({
    id,
    name,
    size: STAT,
    draw: (c, w, h, p) => drawStat(c, w, h, p, { label, value: s.value, unit: s.unit, hot }),
  });
  out.push(stat('distance', 'Total distance', 'Distance', stats.distance, true));
  out.push(stat('pace', `Avg ${(stats.paceLabel ?? 'Pace').toLowerCase()}`, `Avg ${(stats.paceLabel ?? 'Pace').toLowerCase()}`, stats.pace));
  out.push(stat('time', 'Time', 'Time', stats.time));
  if (stats.hr) out.push(stat('hr', 'Avg heart rate', 'Avg heart rate', stats.hr));
  return out;
}

/** Front and back muscle figures side by side, from { muscleId: weightedSets }. */
function muscleGrid(scores) {
  const levels = muscleLevels(scores, 4);
  const front = body('front', levels);
  const back = body('back', levels);
  const rows = front.cells.length / front.cols;
  const cols = front.cols * 2 + 2;
  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    cells.push(...front.cells.slice(r * front.cols, (r + 1) * front.cols), 'none', 'none');
    cells.push(...back.cells.slice(r * back.cols, (r + 1) * back.cols));
  }
  return { cols, cells };
}

/** Strength pieces. `stats`: { time, sets, volume } each { value, unit }. */
export function strengthAssets({ title, date, scores, stats }) {
  const map = scores && Object.keys(scores).length ? muscleGrid(scores) : null;
  const out = [];
  if (map) out.push({ id: 'map', name: 'Muscle map', size: SQUARE, draw: (c, w, h, p) => drawMap(c, w, h, p, map, 0.86) });
  out.push({
    id: 'summary',
    name: 'Summary card',
    size: CARD,
    draw: (c, w, h, p) =>
      drawSummary(c, w, h, p, {
        title,
        date,
        grid: map,
        mapShare: 0.7,
        stats: [
          { label: 'Time', ...stats.time },
          { label: 'Sets', ...stats.sets },
          { label: 'Volume', ...stats.volume, hot: true },
        ],
      }),
  });
  const stat = (id, name, label, s, hot) => ({
    id,
    name,
    size: STAT,
    draw: (c, w, h, p) => drawStat(c, w, h, p, { label, value: s.value, unit: s.unit, hot }),
  });
  if (stats.volume.value !== '–') out.push(stat('volume', 'Total volume', 'Volume', stats.volume, true));
  out.push(stat('sets', 'Sets', 'Sets', stats.sets));
  out.push(stat('time', 'Time', 'Time', stats.time));
  return out;
}

/** Any other activity (no distance, no sets): a summary card and one card per number. */
export function genericAssets({ title, date, stats }) {
  const out = [
    {
      id: 'summary',
      name: 'Summary card',
      size: CARD,
      draw: (c, w, h, p) => drawSummary(c, w, h, p, { title, date, grid: null, mapShare: 0, stats: stats.map((s, i) => ({ ...s, hot: i === 0 })) }),
    },
  ];
  stats.forEach((s, i) => {
    out.push({
      id: s.label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: s.label,
      size: STAT,
      draw: (c, w, h, p) => drawStat(c, w, h, p, { label: s.label, value: s.value, unit: s.unit, hot: i === 0 }),
    });
  });
  return out;
}

// ---- rendering --------------------------------------------------------------------

/** Paints `asset` onto `canvas` at its export size. */
export function paintAsset(canvas, asset, { solid, accent }) {
  const [w, h] = asset.size;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  if (solid) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2A2A2A'; // the app's dot-grid background
    for (let y = 18; y < h; y += 36) {
      for (let x = 18; x < w; x += 36) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  asset.draw(ctx, w, h, palette({ accent, solid }));
}

/** The user's accent colour as it is right now. */
export const currentAccent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#FF3B30';

/** A PNG Blob of `asset`. */
export function assetBlob(asset, opts) {
  const canvas = document.createElement('canvas');
  paintAsset(canvas, asset, opts);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the image.'))), 'image/png');
  });
}
