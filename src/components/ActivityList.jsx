/**
 * Recent activities, newest first. This is the placeholder dashboard:
 * the real single-page layout (weekly mileage, trends, load...) comes later.
 * Running-like sports show pace, others show speed.
 */
import { duration, km, kmh, pace, shortDate, sportInfo } from '../lib/format.js';

function Activity({ a }) {
  const sport = sportInfo(a.sport_type);
  const stats = [
    km(a.distance_m),
    duration(a.moving_time_s),
    sport.usePace ? pace(a.avg_speed_mps) : kmh(a.avg_speed_mps),
    a.avg_hr ? `${Math.round(a.avg_hr)} bpm` : null,
  ].filter(Boolean);

  return (
    <li className="rounded-2xl bg-slate-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium text-white">
            <span className="mr-1.5">{sport.icon}</span>
            {a.name || sport.label}
          </div>
          <div className="text-xs text-slate-400">
            {shortDate(a.start_time)} · {sport.label}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            a.provider === 'strava' ? 'bg-orange-500/15 text-orange-300' : 'bg-sky-500/15 text-sky-300'
          }`}
        >
          {a.provider}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-300">
        {stats.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
    </li>
  );
}

export default function ActivityList({ activities, loading, hasConnection }) {
  if (loading) return <p className="py-8 text-center text-sm text-slate-500">Loading…</p>;
  if (activities.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        {hasConnection ? 'No activities yet. New ones appear here live.' : 'Connect Strava or Garmin to see your training.'}
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {activities.map((a) => (
        <Activity key={a.id} a={a} />
      ))}
    </ul>
  );
}
