/**
 * Bottom-sheet drawer. Slides up with a fading backdrop and slides back down
 * before unmounting. Closes on backdrop tap, Esc, the ✕ button, or a swipe
 * down on the grab handle. Locks page scroll while open.
 */
import { useEffect, useRef, useState } from 'react';

const DURATION = 300; // ms, keep in sync with the duration-300 classes

export default function Drawer({ open, onClose, title, children }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [drag, setDrag] = useState(0);
  const dragStart = useRef(null);

  // mount -> next frame slide in; close -> slide out, then unmount
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), DURATION);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const onPointerDown = (e) => {
    dragStart.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (dragStart.current !== null) setDrag(Math.max(0, e.clientY - dragStart.current));
  };
  const onPointerUp = () => {
    if (dragStart.current === null) return;
    dragStart.current = null;
    if (drag > 100) onClose();
    setDrag(0);
  };

  return (
    <div className="fixed inset-0 z-40" data-no-ptr role="dialog" aria-modal="true" aria-label={title}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${shown ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[88vh] max-w-md flex-col rounded-t-3xl bg-slate-900 shadow-2xl ring-1 ring-slate-800 ${
          drag ? '' : 'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'
        }`}
        style={{
          transform: shown ? `translateY(${drag}px)` : 'translateY(100%)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div
          className="cursor-grab touch-none px-5 pb-2 pt-3"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-700" />
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <button
              onClick={onClose}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-300"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-6">{children}</div>
      </div>
    </div>
  );
}
