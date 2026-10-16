/**
 * Bottom snackbar for app notices ({ type: 'info' | 'error', text }).
 * Auto-dismisses (errors stay a little longer); tap or ✕ closes it early.
 * A new notice resets the timer.
 */
import { useEffect } from 'react';

export default function Snackbar({ notice, onClose }) {
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(onClose, notice.type === 'error' ? 8000 : 5000);
    return () => clearTimeout(t);
  }, [notice, onClose]);

  if (!notice) return null;
  const isError = notice.type === 'error';

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
    >
      <div
        role={isError ? 'alert' : 'status'}
        onClick={onClose}
        className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-lg shadow-black/40 ring-1 ${
          isError ? 'bg-red-950 text-red-200 ring-red-500/40' : 'bg-slate-800 text-slate-100 ring-emerald-500/40'
        }`}
      >
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isError ? 'bg-red-400' : 'bg-emerald-400'}`} />
        <span className="flex-1">{notice.text}</span>
        <button aria-label="Dismiss" className="-mr-1 px-1 text-slate-400">
          ✕
        </button>
      </div>
    </div>
  );
}
