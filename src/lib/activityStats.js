/**
 * What to show for one activity, chosen by what it actually has:
 *   distance  runs, rides, walks...   distance, time, pace/speed, dynamics
 *   sets      strength, yoga, pilates sets, reps, volume, exercise list
 *   general   anything else           time, heart rate, calories
 * Built from the `activities` row plus, in the detail view, the full provider
 * payload (`raw`). Garmin and Strava name fields differently; rows with no
 * (or a zero) value are dropped so a workout never shows "0.0 km/h".
 */
import { duration, kmh, pace, sportInfo } from './format.js';

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
/** The number if it is above zero, else null (Garmin reports 0, not null, for "none"). */
const pos = (x) => {
  const n = num(x);
  return n != null && n > 0 ? n : null;
};
const fmt = (v, f) => (v == null ? null : f(v));
const round = (v) => `${Math.round(v)}`;
const bpm = (h) => `${Math.round(h)} bpm`;
const kcal = (c) => `${Math.round(c)} kcal`;
const signed = (v) => `${v > 0 ? '+' : '−'}${Math.abs(Math.round(v))}`;
/** Garmin stores weights and volume in grams. */
const kg = (grams) => {
  const k = grams / 1000;
  return `${k.toLocaleString(undefined, { maximumFractionDigits: k < 100 ? 1 : 0 })} kg`;
};
const titleCase = (s) =>
  s.toLowerCase().split('_').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

/** Per-exercise summary Garmin keeps for strength-style activities. */
export function exercisesOf(activity, raw) {
  const list = raw?.summarizedExerciseSets ?? activity.exercises;
  return Array.isArray(list) ? list.filter((e) => e && typeof e === 'object') : [];
}

/** 'sets' | 'distance' | 'general' */
export function activityKind(activity) {
  if (pos(activity.sets) || exercisesOf(activity).length > 0) return 'sets';
  if (pos(activity.distance_m)) return 'distance';
  return 'general';
}

/**
 * Garmin activity that recorded GPS: worth asking for a route. `raw` is the activity's full
 * payload (undefined while it loads): Garmin only gives a start position when the watch had a
 * GPS fix, so treadmill runs, pool swims and the like have none and get no Route section.
 */
export function routeExpected(activity, raw) {
  return (
    activity.provider === 'garmin' &&
    activityKind(activity) === 'distance' &&
    !/treadmill|indoor|virtual/i.test(activity.sport_type ?? '') &&
    Number.isFinite(raw?.startLatitude) &&
    Number.isFinite(raw?.startLongitude)
  );
}

/** Garmin run/walk/hike with a distance: worth asking Garmin for its laps and km splits. */
export function splitsExpected(activity) {
  return activity.provider === 'garmin' && activityKind(activity) === 'distance' && sportInfo(activity.sport_type).usePace;
}

function setTotals(activity, raw) {
  const ex = exercisesOf(activity, raw);
  const sum = (key) => ex.reduce((a, e) => a + (num(e[key]) ?? 0), 0);
  return {
    sets: pos(raw?.totalSets ?? activity.sets) ?? pos(sum('sets')),
    reps: pos(raw?.totalReps ?? activity.reps) ?? pos(sum('reps')),
    volume: pos(sum('volume')), // grams
    heaviest: pos(Math.max(0, ...ex.map((e) => num(e.maxWeight) ?? 0))), // grams
  };
}

/** Distance sports use moving time; workouts use the timer time (what Garmin Connect shows). */
const timeOf = (a, kind) =>
  kind === 'distance' ? a.moving_time_s : (a.duration ?? a.elapsed_time_s ?? a.moving_time_s);

/** Up to three big numbers, for a card and the top of the detail view. */
export function headlineStats(activity) {
  const kind = activityKind(activity);
  const time = ['Time', fmt(timeOf(activity, kind), duration)];
  const calories = ['Calories', fmt(pos(activity.calories), kcal)];
  const avgHr = ['Avg HR', fmt(pos(activity.avg_hr), bpm)];

  if (kind === 'distance') {
    const usePace = sportInfo(activity.sport_type).usePace;
    return [
      ['Distance', fmt(activity.distance_m, (m) => `${(m / 1000).toFixed(m >= 10000 ? 1 : 2)} km`)],
      time,
      usePace ? ['Pace', fmt(activity.avg_speed_mps, pace)] : ['Speed', fmt(activity.avg_speed_mps, kmh)],
    ].map(([label, value]) => [label, value ?? '–']);
  }

  let candidates;
  if (kind === 'sets') {
    const t = setTotals(activity);
    candidates = [time, ['Sets', fmt(t.sets, round)], ['Volume', fmt(t.volume, kg)], ['Reps', fmt(t.reps, round)], calories, avgHr];
  } else {
    candidates = [time, avgHr, calories, ['Max HR', fmt(pos(activity.max_hr), bpm)]];
  }
  return candidates.filter(([, value]) => value != null).slice(0, 3);
}

function distanceRows(activity, r) {
  const isStrava = activity.provider === 'strava';
  const usePace = sportInfo(activity.sport_type).usePace;
  // Strava reports cadence per leg for runs; Garmin already reports steps per minute.
  const cadence = isStrava
    ? fmt(pos(r.average_cadence), (c) => `${round(c * 2)} spm`)
    : fmt(pos(r.averageRunningCadenceInStepsPerMinute), (c) => `${round(c)} spm`);
  const maxSpeed = pos(isStrava ? r.max_speed : r.maxSpeed);
  const power = pos(isStrava ? r.average_watts : r.avgPower);
  const garmin = (value, f) => (isStrava ? null : fmt(value, f));

  return [
    ['Elapsed time', fmt(activity.elapsed_time_s, duration)],
    ['Elevation gain', fmt(pos(activity.elevation_gain_m), (m) => `${round(m)} m`)],
    ['Calories', fmt(pos(activity.calories), kcal)],
    ['Avg heart rate', fmt(pos(activity.avg_hr), bpm)],
    ['Max heart rate', fmt(pos(activity.max_hr), bpm)],
    usePace ? ['Avg pace', fmt(pos(activity.avg_speed_mps), pace)] : ['Avg speed', fmt(pos(activity.avg_speed_mps), kmh)],
    usePace ? ['Best pace', fmt(maxSpeed, pace)] : ['Max speed', fmt(maxSpeed, kmh)],
    ['Avg cadence', cadence],
    ['Avg stride length', garmin(pos(r.avgStrideLength), (c) => `${c.toFixed(0)} cm`)],
    ['Ground contact time', garmin(pos(r.avgGroundContactTime), (t) => `${round(t)} ms`)],
    ['Vertical oscillation', garmin(pos(r.avgVerticalOscillation), (c) => `${c.toFixed(1)} cm`)],
    ['Vertical ratio', garmin(pos(r.avgVerticalRatio), (p) => `${p.toFixed(1)} %`)],
    ['Avg power', fmt(power, (w) => `${round(w)} W`)],
    ['Aerobic training effect', garmin(pos(r.aerobicTrainingEffect), (te) => te.toFixed(1))],
    ['VO2max', garmin(pos(r.vO2MaxValue), (v) => v.toFixed(1))],
  ];
}

function workoutRows(activity, r, kind) {
  const isStrava = activity.provider === 'strava';
  const t = setTotals(activity, r);
  const timer = timeOf(activity, kind);
  const elapsed = num(activity.elapsed_time_s);
  const garmin = (value, f) => (isStrava ? null : fmt(value, f));

  return [
    ['Total sets', fmt(t.sets, round)],
    ['Total reps', fmt(t.reps, round)],
    ['Total volume', fmt(t.volume, kg)],
    ['Heaviest weight', fmt(t.heaviest, kg)],
    // only when the watch was paused for a while
    ['Elapsed time', elapsed != null && timer != null && elapsed - timer > 60 ? duration(elapsed) : null],
    ['Calories', fmt(pos(activity.calories), kcal)],
    ['Avg heart rate', fmt(pos(activity.avg_hr), bpm)],
    ['Max heart rate', fmt(pos(activity.max_hr), bpm)],
    ['Aerobic training effect', garmin(pos(r.aerobicTrainingEffect), (te) => te.toFixed(1))],
    ['Anaerobic training effect', garmin(pos(r.anaerobicTrainingEffect), (te) => te.toFixed(1))],
    ['Body Battery impact', garmin(num(r.differenceBodyBattery) || null, signed)],
  ];
}

/** [label, formatted value] pairs, with empty ones removed. */
export function summaryRows(activity, raw = {}) {
  const r = raw ?? {};
  const kind = activityKind(activity);
  const rows = kind === 'distance' ? distanceRows(activity, r) : workoutRows(activity, r, kind);
  return rows.filter(([, value]) => value != null);
}

/** Display name of one Garmin exercise summary ("BARBELL_BENCH_PRESS" -> "Barbell Bench Press"). */
export const exerciseName = (e) => titleCase(String(e.subCategory || e.category || 'Exercise'));

/** One line per exercise for the detail view: name, sets/reps, heaviest and total weight. */
export function exerciseRows(activity, raw) {
  return exercisesOf(activity, raw).map((e) => ({
    name: exerciseName(e),
    volumeG: pos(e.volume),
    detail: [pos(e.sets) && `${round(e.sets)} sets`, pos(e.reps) && `${round(e.reps)} reps`].filter(Boolean).join(' · '),
    weight: fmt(pos(e.maxWeight), (g) => `max ${kg(g)}`),
    volume: fmt(pos(e.volume), (g) => `${kg(g)} total`),
  }));
}
