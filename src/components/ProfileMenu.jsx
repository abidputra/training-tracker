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
        className="num flex h-11 w-11 items-center justify-center rounded-full bg-accent pt-[1px] pl-[1.5px] text-[22px] text-black active:opacity-80"
      >
        {initial}
      </button>

      {open && (
        <div className="card absolute right-0 top-[52px] z-40 w-60 overflow-hidden rounded-2xl border-line-strong">
          <div className="rule px-4 py-3.5">
            <div className="font-dot text-lg font-bold">Hi, {name}</div>
            <div className="truncate text-xs text-muted">{email}</div>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              onSettings();
            }}
            className="block min-h-12 w-full px-4 py-3 text-left text-sm text-white active:bg-neutral-900"
          >
            Settings
          </button>
          <button
            disabled={signingOut}
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex min-h-12 w-full items-center gap-2 px-4 py-3 text-left text-sm text-accent active:bg-neutral-900 disabled:opacity-50"
          >
            {signingOut && <Spinner />}
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
