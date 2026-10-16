/**
 * Activity History: every imported activity as a card, newest first, grouped by
 * month. Tapping a card opens ActivityDetail. Cards show only the summary
 * columns, so the list stays light even with a long history.
 */
import { useMemo, useState } from 'react';
import { headlineStats } from '../lib/activityStats.js';
import { sportInfo } from '../lib/format.js';
import ActivityDetail from './ActivityDetail.jsx';

const monthLabel = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const dateLabel = (iso) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Items are already newest first, so consecutive items share a month. */
function groupByMonth(items) {
  const groups = [];
  for (const a of items) {
    const label = monthLabel(a.start_time);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(a);
    else groups.push({ label, items: [a] });
  }
  return groups;
}

function ActivityCard({ activity, onOpen }) {
  const info = sportInfo(activity.sport_type);
  const provider = activity.provider === 'strava' ? 'Strava' : 'Garmin';

  return (
    <button
      onClick={() => onOpen(activity)}
      className="w-full rounded-2xl bg-slate-900 p-4 text-left ring-1 ring-slate-800 active:bg-slate-800"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs capitalize text-slate-400">
            <span aria-hidden="true">{info.icon}</span>
            {info.label}
          </div>
          <div className="truncate font-medium text-white">{activity.name || info.label}</div>
        </div>
        <div className="shrink-0 text-right text-xs text-slate-400">
          <div>{dateLabel(activity.start_time)}</div>
          <div className="mt-1 inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
            {provider}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {headlineStats(activity).map(([label, value]) => (
          <div key={label}>
            <div className="text-[11px] text-slate-500">{label}</div>
            <div className="font-semibold tabular-nums text-slate-100">{value}</div>
          </div>
        ))}
      </div>
    </button>
  );
}

export default function ActivityHistory({ items, loading, error, onRetry }) {
  const [open, setOpen] = useState(null); // the activity whose detail is showing
  const groups = useMemo(() => groupByMonth(items), [items]);

  if (open) return <ActivityDetail activity={open} onBack={() => setOpen(null)} />;

  if (loading && items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">Loading…</p>;
  }
  if (error && items.length === 0) {
    return (
      <div className="space-y-3 py-8 text-center text-sm">
        <p className="text-red-400">Could not load activities: {error}</p>
        <button
          onClick={() => onRetry().catch(() => {})}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-slate-200 ring-1 ring-slate-700"
        >
          Try again
        </button>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        No activities yet. Connect Garmin in Settings to import your history.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">{items.length} activities</p>
      {groups.map((g) => (
        <section key={g.label}>
          <h2 className="mb-2 text-sm font-medium text-slate-300">{g.label}</h2>
          <div className="space-y-3">
            {g.items.map((a) => (
              <ActivityCard key={a.id} activity={a} onOpen={setOpen} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
