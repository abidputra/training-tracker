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
