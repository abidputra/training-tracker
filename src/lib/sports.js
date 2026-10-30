/**
 * Distance sports besides running (running has its own, richer analysis):
 * cycling, swimming, hiking. A sport gets a Metrics tab only when the account
 * has at least one such activity. To add another distance sport, add one entry
 * to DISTANCE_SPORTS and an icon in components/ui.jsx.
 *
 *   per100   pace is shown per 100 m (swimming)
 *   speed    speed in km/h instead of pace (cycling)
 *   minDist  shortest activity (m) that counts for the "fastest" record
 * Built from Activity History rows (useActivityHistory). Pure functions.
 */
export const DISTANCE_SPORTS = [
  { key: 'cycling', label: 'Cycling', icon: 'ride', test: /ride|cycl|bik/, speed: true, minDist: 5000 },
  { key: 'swimming', label: 'Swimming', icon: 'swim', test: /swim/, per100: true, minDist: 100 },
  { key: 'hiking', label: 'Hiking', icon: 'hike', test: /hik/, minDist: 1000 },
];

const typeOf = (a) => (a.sport_type ?? '').toLowerCase();

/** The sports (of DISTANCE_SPORTS) that `items` contains at least one activity of. */
export const sportsPresent = (items) => DISTANCE_SPORTS.filter((d) => items.some((a) => d.test.test(typeOf(a))));

/** One sport's activities with distance and time, oldest first, with pace / speed worked out. */
export function sportActs(items, def) {
  return items
    .filter((a) => def.test.test(typeOf(a)))
    .map((a) => {
      const distance = a.distance_m > 0 ? a.distance_m : 0;
      const time = a.moving_time_s > 0 ? a.moving_time_s : 0;
      const speed = a.avg_speed_mps > 0 ? a.avg_speed_mps : distance && time ? distance / time : 0;
      return {
        id: a.id,
        t: new Date(a.start_time).getTime(),
        activity: a,
        name: a.name,
        distance,
        time,
        speed,
        pace: speed ? (def.per100 ? 100 : 1000) / speed : null, // seconds per km (per 100 m for swimming)
        kmh: speed * 3.6,
        hr: a.avg_hr > 0 ? a.avg_hr : null,
        elevation: a.elevation_gain_m > 0 ? a.elevation_gain_m : 0,
      };
    })
    .filter((a) => a.distance > 0 && a.time > 0)
    .sort((a, b) => a.t - b.t);
}

/** Personal bests: [{ key, label, act, value }] for the ones that exist. */
export function sportRecords(acts, def) {
  const top = (list, f) => list.reduce((b, a) => (!b || f(a) > f(b) ? a : b), null);
  const out = [];
  const longest = top(acts, (a) => a.distance);
  if (longest) out.push({ key: 'distance', label: 'Longest', act: longest, value: longest.distance });
  const fastest = top(acts.filter((a) => a.distance >= def.minDist && a.speed > 0), (a) => a.speed);
  if (fastest) out.push({ key: 'speed', label: def.speed ? 'Fastest' : 'Best pace', act: fastest, value: def.speed ? fastest.kmh : fastest.pace });
  const time = top(acts, (a) => a.time);
  if (time) out.push({ key: 'time', label: 'Longest time', act: time, value: time.time });
  const climb = top(acts.filter((a) => a.elevation > 0), (a) => a.elevation);
  if (climb) out.push({ key: 'climb', label: 'Most climbing', act: climb, value: climb.elevation });
  return out;
}
