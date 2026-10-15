/** Small display helpers for activity numbers. All inputs are raw SI units (meters, seconds, m/s). */

export const km = (m) => (m == null ? '–' : `${(m / 1000).toFixed(m >= 10000 ? 1 : 2)} km`);

export function duration(s) {
  if (s == null) return '–';
  const t = Math.round(s);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

/** Running pace as min/km from m/s. */
export function pace(mps) {
  if (!mps || mps <= 0) return '–';
  const secPerKm = 1000 / mps;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return s === 60 ? `${m + 1}:00 /km` : `${m}:${String(s).padStart(2, '0')} /km`;
}

/** Seconds per km -> "m:ss" (no unit). */
export function paceSec(s) {
  if (!s || s <= 0) return '–';
  let m = Math.floor(s / 60);
  let sec = Math.round(s % 60);
  if (sec === 60) {
    m += 1;
    sec = 0;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export const kmh = (mps) => (mps == null ? '–' : `${(mps * 3.6).toFixed(1)} km/h`);

export const shortDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/** "just now", "5 min ago", "3 h ago", "2 d ago" */
export function timeAgo(iso) {
  if (!iso) return 'never';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/** Human label + whether pace (running-like) or speed (cycling-like) is the useful metric. */
export function sportInfo(sportType = '') {
  const t = sportType.toLowerCase();
  if (/run|walk|hike/.test(t)) return { label: sportType.replace(/_/g, ' '), icon: '🏃', usePace: true };
  if (/ride|cycl|bike/.test(t)) return { label: sportType.replace(/_/g, ' '), icon: '🚴', usePace: false };
  if (/swim/.test(t)) return { label: 'swim', icon: '🏊', usePace: false };
  if (/weight|strength|workout|crossfit|yoga/.test(t)) return { label: sportType.replace(/_/g, ' '), icon: '🏋️', usePace: false };
  return { label: sportType ? sportType.replace(/_/g, ' ') : 'activity', icon: '⚡', usePace: false };
}
