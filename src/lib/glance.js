/**
 * Numbers for the "At a glance" cards. Pure functions over runs (from
 * getRuns) and daily wellness rows (from useDailyMetrics), both oldest first.
 */

const DAY = 86_400_000;

/** Local Monday 00:00 of the week containing `t`. */
function weekStart(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** Running km per calendar week (Mon–Sun), the last `weeks` weeks, oldest first. */
export function weeklyDistance(runs, weeks = 8, now = Date.now()) {
  const thisWeek = weekStart(now);
  const out = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const d = new Date(thisWeek);
    d.setDate(d.getDate() - 7 * i); // date math, so DST weeks stay aligned
    const lo = d.getTime();
    const end = new Date(lo);
    end.setDate(end.getDate() + 7);
    const km = runs.filter((r) => r.t >= lo && r.t < end.getTime()).reduce((s, r) => s + r.distance, 0) / 1000;
    out.push({ t: lo, v: km });
  }
  return out;
}

/** Mean run HR over the last `days` days before `now` (and the window before it). */
export function recentHr(runs, days = 7, now = Date.now()) {
  const avg = (lo, hi) => {
    const v = runs.filter((r) => r.t > lo && r.t <= hi && r.hr != null).map((r) => r.hr);
    return v.length ? { v: v.reduce((a, b) => a + b, 0) / v.length, n: v.length } : null;
  };
  return { cur: avg(now - days * DAY, now), prev: avg(now - 2 * days * DAY, now - days * DAY) };
}

/** Latest wellness row that has `key`, or null. */
export const latest = (days, key) => {
  for (let i = days.length - 1; i >= 0; i -= 1) if (days[i][key] != null) return days[i];
  return null;
};

/** The last `n` days that have `key`, as chart points. */
export const series = (days, key, n = 14) =>
  days.filter((d) => d[key] != null).slice(-n).map((d) => ({ t: d.t, v: d[key] }));

/** "Today" / "Yesterday" / "Mon 13 Oct" for a wellness row. */
export function dayLabel(t, now = Date.now()) {
  const diff = Math.round((startOfDay(now) - startOfDay(t)) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function startOfDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 27000 -> "7h 30m" */
export function hoursMinutes(s) {
  if (s == null) return '–';
  const m = Math.round(s / 60);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
