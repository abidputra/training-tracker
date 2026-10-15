/**
 * Running analysis. Pure functions, no React.
 *
 * Fitness model: Jack Daniels' VDOT. One race-equivalent effort gives a VDOT
 * number, which gives (a) predicted times at other distances and (b) training
 * paces as a fraction of VO2max. These are ESTIMATES from your recent best
 * effort, not lab values.
 */

const DAY = 86_400_000;
const RUN_TYPES = new Set(['running', 'treadmill_running', 'track_running', 'trail_running', 'virtual_run']);

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/** Normalises an `activities` row (aliased columns or full `raw`) into a run. */
function toRun(a) {
  const raw = a.raw ?? {};
  const speed = num(a.avg_speed_mps) ?? (a.distance_m && a.moving_time_s ? a.distance_m / a.moving_time_s : null);
  return {
    id: a.id,
    t: new Date(a.start_time).getTime(),
    name: a.name,
    distance: num(a.distance_m),
    time: num(a.moving_time_s),
    speed,
    pace: speed ? 1000 / speed : null, // seconds per km
    hr: num(a.avg_hr),
    maxHr: num(a.max_hr),
    cadence: num(a.cadence ?? raw.averageRunningCadenceInStepsPerMinute),
    stride: num(a.stride ?? raw.avgStrideLength), // cm
    vosc: num(a.vosc ?? raw.avgVerticalOscillation), // cm
    gct: num(a.gct ?? raw.avgGroundContactTime), // ms
    vratio: num(a.vratio ?? raw.avgVerticalRatio), // %
    power: num(a.power ?? raw.avgPower), // W
    vo2max: num(a.vo2max ?? raw.vO2MaxValue),
    te: num(a.te ?? raw.aerobicTrainingEffect),
  };
}

/** Running activities only, sanity-filtered, oldest first. */
export function getRuns(activities) {
  return activities
    .filter((a) => RUN_TYPES.has((a.sport_type ?? '').toLowerCase()))
    .map(toRun)
    .filter((r) => r.distance >= 1000 && r.speed >= 1.5 && r.speed <= 8 && !Number.isNaN(r.t))
    .sort((a, b) => a.t - b.t);
}

// --- Daniels VDOT ------------------------------------------------------------

const vo2AtVelocity = (v) => -4.6 + 0.182258 * v + 0.000104 * v * v; // v in m/min
const fractionOfMax = (min) => 0.8 + 0.1894393 * Math.exp(-0.012778 * min) + 0.2989558 * Math.exp(-0.1932605 * min);

export function vdot(meters, seconds) {
  const min = seconds / 60;
  return vo2AtVelocity(meters / min) / fractionOfMax(min);
}

/** Predicted race time (seconds) for `meters` at a given VDOT, by bisection. */
export function raceTime(vd, meters) {
  let lo = meters / 500; // minutes (500 m/min = unrealistically fast)
  let hi = meters / 50;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (vdot(meters, mid * 60) > vd) lo = mid; // too fast for this VDOT
    else hi = mid;
  }
  return ((lo + hi) / 2) * 60;
}

/** Pace (sec/km) at a fraction of VO2max (0.7 = 70%). */
export function paceAtFraction(vd, frac) {
  const target = 4.6 + frac * vd;
  const v = (-0.182258 + Math.sqrt(0.182258 ** 2 + 4 * 0.000104 * target)) / (2 * 0.000104); // m/min
  return (1000 / v) * 60;
}

/** Swain: %HRmax ~= 0.64 * %VO2max + 37. */
export const hrAtFraction = (maxHr, frac) => Math.round((maxHr * (0.64 * frac * 100 + 37)) / 100);

// --- Cards -------------------------------------------------------------------

export const RACES = [
  { key: '5K', meters: 5000 },
  { key: '10K', meters: 10000 },
  { key: 'Half marathon', meters: 21097.5 },
  { key: 'Marathon', meters: 42195 },
];

/** Best recent effort (>= 3 km, last 90 days of data) as a VDOT. Null if none. */
export function fitness(runs) {
  if (runs.length === 0) return null;
  const latest = runs[runs.length - 1].t;
  let best = null;
  for (const r of runs) {
    if (r.t < latest - 90 * DAY || r.distance < 3000 || !r.time) continue;
    const vd = vdot(r.distance, r.time);
    if (vd < 15 || vd > 85) continue;
    if (!best || vd > best.vdot) best = { vdot: vd, run: r };
  }
  if (!best) return null;
  const maxes = runs.filter((r) => r.t >= latest - 90 * DAY && r.maxHr >= 150 && r.maxHr <= 215).map((r) => r.maxHr);
  return { ...best, maxHr: maxes.length ? Math.max(...maxes) : null };
}

export const ZONES = [
  { key: 'Recovery', lo: 0.55, hi: 0.62 },
  { key: 'Z2', lo: 0.62, hi: 0.7 },
  { key: 'Easy', lo: 0.7, hi: 0.78 },
  { key: 'Tempo', lo: 0.8, hi: 0.85 },
  { key: 'Threshold', lo: 0.85, hi: 0.9 },
  { key: 'Interval', lo: 0.95, hi: 1.0 },
];

/** Mean of `get(run)` for runs in (anchor - (offset+days), anchor - offset] days. */
export function windowAvg(runs, get, anchor, days, offsetDays = 0) {
  const hi = anchor - offsetDays * DAY;
  const lo = hi - days * DAY;
  const vals = runs.filter((r) => r.t > lo && r.t <= hi).map(get).filter((v) => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Rolling mean (trailing `days`) of `get` evaluated at each point of `at`. */
export function rolling(runs, at, get, days = 28) {
  return at
    .map((r) => ({ t: r.t, v: windowAvg(runs, get, r.t, days) }))
    .filter((p) => p.v != null);
}

export function filterRange(runs, range) {
  if (range === 'all' || runs.length === 0) return runs;
  const weeks = range === '4w' ? 4 : 12;
  const cutoff = runs[runs.length - 1].t - weeks * 7 * DAY;
  return runs.filter((r) => r.t >= cutoff);
}
