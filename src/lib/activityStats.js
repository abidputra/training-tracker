/**
 * Builds the detail rows for one activity from its `activities` row plus the
 * full provider payload (`raw`, fetched on demand). Garmin and Strava name
 * their fields differently; rows with no value are dropped.
 */
import { duration, kmh, pace, sportInfo } from './format.js';

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const fmt = (v, f) => (v == null ? null : f(v));
const round = (v) => `${Math.round(v)}`;

/** [label, formatted value] pairs, in Garmin's order, with empty ones removed. */
export function summaryRows(activity, raw = {}) {
  const isStrava = activity.provider === 'strava';
  const r = raw ?? {};
  const usePace = sportInfo(activity.sport_type).usePace;
  // Strava reports cadence per leg for runs; Garmin already reports steps per minute.
  const cadence = isStrava
    ? fmt(num(r.average_cadence), (c) => `${round(c * 2)} spm`)
    : fmt(num(r.averageRunningCadenceInStepsPerMinute), (c) => `${round(c)} spm`);
  const maxSpeed = num(isStrava ? r.max_speed : r.maxSpeed);
  const power = num(isStrava ? r.average_watts : r.avgPower);

  const rows = [
    ['Elapsed time', fmt(activity.elapsed_time_s, duration)],
    ['Elevation gain', fmt(activity.elevation_gain_m, (m) => `${round(m)} m`)],
    ['Calories', fmt(activity.calories, (c) => `${round(c)} kcal`)],
    ['Avg heart rate', fmt(activity.avg_hr, (h) => `${round(h)} bpm`)],
    ['Max heart rate', fmt(activity.max_hr, (h) => `${round(h)} bpm`)],
    usePace
      ? ['Avg pace', fmt(activity.avg_speed_mps, pace)]
      : ['Avg speed', fmt(activity.avg_speed_mps, kmh)],
    usePace
      ? ['Best pace', fmt(maxSpeed, pace)]
      : ['Max speed', fmt(maxSpeed, kmh)],
    ['Avg cadence', cadence],
    ['Avg stride length', isStrava ? null : fmt(num(r.avgStrideLength), (c) => `${c.toFixed(0)} cm`)],
    ['Ground contact time', isStrava ? null : fmt(num(r.avgGroundContactTime), (t) => `${round(t)} ms`)],
    ['Vertical oscillation', isStrava ? null : fmt(num(r.avgVerticalOscillation), (c) => `${c.toFixed(1)} cm`)],
    ['Vertical ratio', isStrava ? null : fmt(num(r.avgVerticalRatio), (p) => `${p.toFixed(1)} %`)],
    ['Avg power', fmt(power, (w) => `${round(w)} W`)],
    ['Aerobic training effect', isStrava ? null : fmt(num(r.aerobicTrainingEffect), (te) => te.toFixed(1))],
    ['VO2max', isStrava ? null : fmt(num(r.vO2MaxValue), (v) => v.toFixed(1))],
  ];
  return rows.filter(([, value]) => value != null);
}

/** The three big numbers shown on a card and at the top of the detail view. */
export function headlineStats(activity) {
  const usePace = sportInfo(activity.sport_type).usePace;
  return [
    ['Distance', fmt(activity.distance_m, (m) => `${(m / 1000).toFixed(m >= 10000 ? 1 : 2)} km`)],
    ['Time', fmt(activity.moving_time_s, duration)],
    usePace
      ? ['Pace', fmt(activity.avg_speed_mps, pace)]
      : ['Speed', fmt(activity.avg_speed_mps, kmh)],
  ];
}
