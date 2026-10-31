/**
 * Strength analysis from Garmin's per-exercise summaries (summarizedExerciseSets:
 * sets, reps, maxWeight and volume per exercise, weights in grams). Works on
 * Activity History rows (useActivityHistory). Pure functions, no React.
 *
 *   Avg / rep = volume / reps.   Record = heaviest maxWeight ever.
 * Per-set detail (reps x weight of each set) is not in the summary, so it is
 * not shown here.
 */
import { activityKind, exerciseName, exercisesOf } from './activityStats.js';
import { RANGES } from './analysis.js';
import { weekStart } from './glance.js';
import { muscleLoad } from './muscles.js';

const DAY = 86_400_000;
const num = (x) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0);
const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);

/** Grams -> "1,320" (kg, no unit). */
export const kgNum = (g) => {
  const k = g / 1000;
  return k.toLocaleString(undefined, { maximumFractionDigits: k < 100 ? 1 : 0 });
};

/** Strength-style sessions, oldest first: { id, t, activity, exercises, sets, reps, volume, time }. */
export function strengthSessions(items) {
  return items
    .filter((a) => activityKind(a) === 'sets')
    .map((a) => {
      const exercises = exercisesOf(a)
        .map((e) => ({
          name: exerciseName(e),
          category: e.category,
          subCategory: e.subCategory,
          sets: num(e.sets),
          reps: num(e.reps),
          maxWeight: num(e.maxWeight),
          volume: num(e.volume),
        }))
        .filter((e) => !/^unknown$/i.test(e.name));
      return {
        id: a.id,
        t: new Date(a.start_time).getTime(),
        activity: a,
        exercises,
        sets: num(a.sets) || sum(exercises, (e) => e.sets),
        reps: num(a.reps) || sum(exercises, (e) => e.reps),
        volume: sum(exercises, (e) => e.volume),
        time: num(a.duration) || num(a.elapsed_time_s) || num(a.moving_time_s),
      };
    })
    .sort((a, b) => a.t - b.t);
}

const inLast = (sessions, days, now = Date.now()) => sessions.filter((s) => s.t > now - days * DAY);

/** Sum of `get(session)` per Mon–Sun week, the last `weeks` weeks, oldest first ({ t, v, n }). */
export function weekly(sessions, weeks, get, now = Date.now()) {
  const thisWeek = weekStart(now);
  const out = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const d = new Date(thisWeek);
    d.setDate(d.getDate() - 7 * i);
    const lo = d.getTime();
    d.setDate(d.getDate() + 7);
    const inWeek = sessions.filter((s) => s.t >= lo && s.t < d.getTime());
    out.push({ t: lo, v: sum(inWeek, get), n: inWeek.length, sessions: inWeek });
  }
  return out;
}

/** Headline numbers: this week vs last, and 30-day averages. */
export function strengthGlance(sessions, now = Date.now()) {
  const weeks = weekly(sessions, 8, (s) => s.volume, now);
  const month = inLast(sessions, 30, now);
  const reps = sum(month, (s) => s.reps);
  const vol = sum(month, (s) => s.volume);
  const timed = month.filter((s) => s.time);
  return {
    weeks,
    week: weeks[weeks.length - 1],
    lastWeek: weeks[weeks.length - 2],
    month: {
      sessions: month.length,
      sets: sum(month, (s) => s.sets),
      avgTime: timed.length ? sum(timed, (s) => s.time) / timed.length : null,
      perRep: reps ? vol / reps : null,
    },
  };
}

/** Every exercise's history, oldest first: Map name -> [{ t, session, sets, reps, maxWeight, volume }]. */
export function exerciseHistory(sessions) {
  const map = new Map();
  for (const s of sessions) {
    for (const e of s.exercises) {
      if (!map.has(e.name)) map.set(e.name, []);
      map.get(e.name).push({ t: s.t, session: s, ...e });
    }
  }
  return map;
}

/**
 * Heaviest weight per exercise: { name, pr, t, delta, isNew }, latest record first.
 * `delta` is the gain over the best before it; `isNew` = set in the last 14 days.
 */
export function records(history, now = Date.now()) {
  const out = [];
  for (const [name, list] of history) {
    let best = 0;
    let prev = 0;
    let at = null;
    for (const h of list) {
      if (h.maxWeight > best) {
        prev = best;
        best = h.maxWeight;
        at = h.t;
      }
    }
    if (!best) continue; // bodyweight-only exercise
    out.push({ name, pr: best, t: at, delta: prev ? best - prev : null, isNew: at > now - 14 * DAY });
  }
  return out.sort((a, b) => b.t - a.t);
}

/** Exercises done in the last 30 days, most volume first. */
export function recentExercises(history, now = Date.now()) {
  const out = [];
  for (const [name, list] of history) {
    const month = list.filter((h) => h.t > now - 30 * DAY);
    if (!month.length) continue;
    const sets = sum(month, (h) => h.sets);
    const reps = sum(month, (h) => h.reps);
    const volume = sum(month, (h) => h.volume);
    out.push({
      name,
      sets,
      repsPerSet: sets ? Math.round(reps / sets) : null,
      perRep: reps && volume ? volume / reps : null,
      volume,
    });
  }
  return out.sort((a, b) => b.volume - a.volume || b.sets - a.sets);
}

/** Sessions in a RANGES window, counted back from the latest session. */
export function sessionsInRange(sessions, range) {
  const def = RANGES.find((r) => r.key === range);
  if (!def || def.key === 'all' || !sessions.length) return sessions;
  const latest = new Date(sessions[sessions.length - 1].t);
  const cutoff =
    def.key === 'ytd'
      ? new Date(latest.getFullYear(), 0, 1).getTime()
      : new Date(latest.getFullYear(), latest.getMonth() - def.months, latest.getDate()).getTime();
  return sessions.filter((s) => s.t >= cutoff);
}

/** Weeks to chart for a range: from the first session in it to this week, capped at a year. */
export function rangeWeeks(sessions, range, now = Date.now()) {
  const shown = sessionsInRange(sessions, range);
  if (!shown.length) return 0;
  return Math.min(52, Math.max(4, Math.ceil((weekStart(now) - weekStart(shown[0].t)) / (7 * DAY)) + 1));
}

const GROUPS = {
  Legs: ['quadriceps', 'hamstring', 'gluteal', 'calves', 'adductor', 'abductors'],
  Chest: ['chest'],
  Back: ['upper-back', 'lower-back', 'trapezius'],
  Shoulders: ['front-deltoids', 'back-deltoids'],
  Arms: ['biceps', 'triceps', 'forearm'],
  Core: ['abs', 'obliques'],
};

/** Share of weighted sets per body area over the last 30 days: [{ name, pct }], biggest first. */
export function muscleSplit(sessions, now = Date.now()) {
  const month = inLast(sessions, 30, now);
  const { scores } = muscleLoad(month.flatMap((s) => s.exercises));
  const groups = Object.entries(GROUPS).map(([name, ids]) => ({ name, v: sum(ids, (m) => scores[m] ?? 0) }));
  const total = sum(groups, (g) => g.v);
  if (!total) return [];
  return groups
    .filter((g) => g.v > 0)
    .map((g) => ({ name: g.name, pct: (g.v / total) * 100 }))
    .sort((a, b) => b.pct - a.pct);
}
