/** Header "Sync" button and the small "Synced 5 min ago" line. */
import { useEffect, useState } from 'react';
import { timeAgo } from '../lib/format.js';
import { Icon } from './ui.jsx';

/** Round icon button on phones, a labelled pill on wide screens. */
export default function SyncButton({ syncing, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={syncing}
      aria-label={syncing ? 'Syncing' : 'Sync now'}
      className="flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-full border border-line-strong bg-black text-white active:bg-neutral-900 disabled:opacity-70 lg:w-auto lg:px-[18px] lg:text-xs lg:tracking-[0.12em] lg:uppercase"
    >
      <Icon name="sync" size={18} className={syncing ? 'animate-spin' : ''} />
      <span className="hidden lg:inline">{syncing ? 'Syncing…' : 'Sync'}</span>
    </button>
  );
}

/** "Synced 5 min ago", re-rendered every 30 s so the wording stays honest. */
export function LastSynced({ iso, className = '' }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!iso) return null;
  return <p className={`m-0 text-xs text-muted ${className}`}>Synced {timeAgo(iso)}</p>;
}
