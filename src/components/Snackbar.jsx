/**
 * Bottom snackbar for app notices ({ type: 'info' | 'error', text }).
 * Sits above the floating menu. Auto-dismisses (errors stay a little longer); tap or ✕ closes it early.
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
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5.5rem)' }}
    >
      <div
        role={isError ? 'alert' : 'status'}
        onClick={onClose}
        className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border bg-black px-4 py-3.5 text-sm ${
          isError ? 'border-accent' : 'border-line-strong'
        }`}
      >
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isError ? 'bg-accent' : 'bg-white'}`} />
        <span className="flex-1">{notice.text}</span>
        <button aria-label="Dismiss" className="-mr-1 px-1 text-muted">
          ✕
        </button>
      </div>
    </div>
  );
}
