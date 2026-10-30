/** Header "Sync" button and the small "Synced 5 min ago" line under the page title. */
import { useEffect, useState } from 'react';
import { timeAgo } from '../lib/format.js';

const RefreshIcon = ({ spinning }) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={spinning ? 'animate-spin' : ''}
  >
    <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
    <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M3 21v-5h5" />
  </svg>
);

export default function SyncButton({ syncing, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={syncing}
      aria-label={syncing ? 'Syncing' : 'Sync all connections'}
      className="flex h-9 items-center gap-1.5 rounded-full bg-slate-800 px-3 text-sm text-slate-200 ring-1 ring-slate-700 active:bg-slate-700 disabled:opacity-70"
    >
      <RefreshIcon spinning={syncing} />
      {syncing ? 'Syncing…' : 'Sync'}
    </button>
  );
}

/** "Synced 5 min ago", re-rendered every 30 s so the wording stays honest. */
export function LastSynced({ iso }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!iso) return null;
  return <p className="text-[11px] text-slate-500">Synced {timeAgo(iso)}</p>;
}
