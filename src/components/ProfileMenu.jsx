/**
 * Profile icon in the header. Tapping it opens a small menu with a greeting,
 * Settings and Sign out. Closes on an outside tap or Esc.
 */
import { useEffect, useRef, useState } from 'react';
import Spinner from './Spinner.jsx';

export default function ProfileMenu({ username, email, signingOut, onSettings, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const name = username ?? email?.split('@')[0] ?? 'there';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Profile menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-slate-950 ring-1 ring-slate-700 active:opacity-80"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-56 overflow-hidden rounded-xl bg-slate-900 shadow-2xl ring-1 ring-slate-800">
          <div className="border-b border-slate-800 px-4 py-3">
            <div className="font-medium text-white">Hi, {name}</div>
            <div className="truncate text-xs text-slate-500">{email}</div>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              onSettings();
            }}
            className="block w-full px-4 py-3 text-left text-sm text-slate-200 active:bg-slate-800"
          >
            Settings
          </button>
          <button
            disabled={signingOut}
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-red-400 active:bg-slate-800 disabled:opacity-50"
          >
            {signingOut && <Spinner />}
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
