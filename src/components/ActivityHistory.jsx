/**
 * Activity History: every imported activity as a card, newest first, grouped by
 * month. A row of sport chips (with counts) narrows the list to one kind of
 * activity. Tapping a card opens ActivityDetail. Cards show only the summary
 * columns, so the list stays light even with a long history.
 */
import { useEffect, useMemo, useState } from 'react';
import { headlineStats } from '../lib/activityStats.js';
import { SPORT_FAMILIES, sportFamily, sportInfo } from '../lib/format.js';
import ActivityDetail from './ActivityDetail.jsx';
import { Empty } from './ui.jsx';

const monthLabel = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const dateLabel = (iso) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} at ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
};

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

/** Sticky chip row: "All" plus one chip per sport present, most frequent first. */
function SportFilter({ families, total, value, onChange }) {
  const chip = (key, label, count, active) => (
    <button key={key} onClick={() => onChange(key)} aria-pressed={active} className={active ? 'pill-on' : 'pill'}>
      {label} {count}
    </button>
  );

  return (
    <nav aria-label="Filter by sport" className="sticky z-30 -mx-4 mb-3 bg-black py-1" style={{ top: 'var(--top-inset)' }}>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-1">
        {chip('all', 'All', total, value === 'all')}
        {families.map((f) => chip(f.key, f.label, f.count, value === f.key))}
      </div>
    </nav>
  );
}

function ActivityCard({ activity, onOpen }) {
  const info = sportInfo(activity.sport_type);
  const provider = activity.provider === 'strava' ? 'STRAVA' : 'GARMIN';
  const isRun = sportFamily(activity.sport_type) === 'run';

  return (
    <button onClick={() => onOpen(activity)} className="card flex w-full flex-col gap-4 p-[18px] text-left active:bg-neutral-950">
      <div className="flex w-full items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-2 text-xs text-muted capitalize">
            <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${isRun ? 'bg-accent' : 'bg-white'}`} />
            {info.label}
          </div>
          <div className="font-dot text-2xl leading-[1.1] font-bold break-words">{activity.name || info.label}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 text-right">
          <span className="text-xs text-muted">{dateLabel(activity.start_time)}</span>
          <span className="rounded-full border border-line-strong px-2.5 py-0.5 text-xs tracking-[0.1em]">{provider}</span>
        </div>
      </div>

      <div className="grid w-full grid-cols-3 gap-2">
        {headlineStats(activity).map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1">
            <span className="text-xs text-muted">{label}</span>
            <span className="text-[15px] font-bold tabular-nums">{value}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

export default function ActivityHistory({ items, loading, error, onRetry }) {
  const [open, setOpen] = useState(null); // the activity whose detail is showing
  const [sport, setSport] = useState('all'); // 'all' or a sport family key

  // Sports present in the history, most frequent first.
  const families = useMemo(() => {
    const counts = {};
    for (const a of items) {
      const k = sportFamily(a.sport_type);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return SPORT_FAMILIES.filter((f) => counts[f.key])
      .map((f) => ({ ...f, count: counts[f.key] }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  // A sport that disappeared after a reload falls back to "All".
  const active = families.some((f) => f.key === sport) ? sport : 'all';
  const visible = useMemo(
    () => (active === 'all' ? items : items.filter((a) => sportFamily(a.sport_type) === active)),
    [items, active],
  );
  const groups = useMemo(() => groupByMonth(visible), [visible]);

  // opening or closing a detail starts at the top of the page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [open]);

  if (open) return <ActivityDetail activity={open} onBack={() => setOpen(null)} />;

  if (loading && items.length === 0) return <Empty>Loading…</Empty>;
  if (error && items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-sm">
        <p className="m-0 text-accent">Could not load activities: {error}</p>
        <button onClick={() => onRetry().catch(() => {})} className="btn">
          Try again
        </button>
      </div>
    );
  }
  if (items.length === 0) return <Empty>No activities yet. Connect Garmin in Settings to import your history.</Empty>;

  return (
    <div>
      {families.length > 1 && (
        <SportFilter families={families} total={items.length} value={active} onChange={setSport} />
      )}
      <div className="flex flex-col gap-5">
        <p className="m-0 text-xs text-muted">
          {active === 'all' ? `${items.length} activities` : `${visible.length} of ${items.length} activities`}
        </p>
        {groups.map((g) => (
          <section key={g.label} className="flex flex-col gap-3">
            <h2 className="title m-0 mt-2">{g.label}</h2>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {g.items.map((a) => (
                <ActivityCard key={a.id} activity={a} onOpen={setOpen} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
