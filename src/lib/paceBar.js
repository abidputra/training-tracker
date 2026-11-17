/**
 * Small pieces shared by the splits tables and the share images: the pace bar
 * scale and the lap names. Pure functions, no React.
 */

const FAST = 420; // s per km: the bar is full
const SLOW = 660; // s per km: one dot

/** Lit dots (1..16) of a 16-dot pace bar: faster = more dots. */
export const paceLit = (pace) => Math.max(1, Math.min(16, Math.round(((SLOW - pace) / (SLOW - FAST)) * 16)));

const NAMES = { WARMUP: 'Warm-up', COOLDOWN: 'Cool-down', INTERVAL: 'Interval', RECOVERY: 'Recovery', REST: 'Rest' };
const WORKOUT = new Set(['WARMUP', 'COOLDOWN', 'INTERVAL', 'RECOVERY', 'REST']);

/** "Warm-up" / "Lap", and where the lap came from: Manual (lap button), Workout (a step) or Auto. */
export function lapLabels(l) {
  const name = NAMES[l.intensity] ?? 'Lap';
  const type = l.trigger === 'MANUAL' ? 'Manual' : WORKOUT.has(l.intensity) ? 'Workout' : 'Auto';
  return { name, type };
}

/** Distinct lap names in the order they first appear: ["Warm-up", "Interval", "Recovery", "Cool-down"]. */
export const lapNames = (laps) => [...new Set(laps.map((l) => lapLabels(l).name))];

/**
 * Totals of a set of laps (all of them, or one type): distance in m and time in s are summed,
 * pace (s/km) is time over distance, and heart rate is the average weighted by lap time
 * (null when no lap has one).
 */
export function lapTotal(laps) {
  const dist = laps.reduce((a, l) => a + l.dist, 0);
  const time = laps.reduce((a, l) => a + l.time, 0);
  const withHr = laps.filter((l) => l.hr);
  const hrTime = withHr.reduce((a, l) => a + l.time, 0);
  return {
    dist,
    time,
    pace: dist > 0 ? time / (dist / 1000) : null,
    hr: hrTime > 0 ? Math.round(withHr.reduce((a, l) => a + l.hr * l.time, 0) / hrTime) : null,
  };
}
