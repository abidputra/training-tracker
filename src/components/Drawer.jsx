/**
 * Bottom-sheet drawer. Slides up with a fading backdrop and slides back down
 * before unmounting. Closes on backdrop tap, Esc, the ✕ button, or a swipe
 * down on the grab handle. Locks page scroll while open.
 *
 * Motion: opening is a little slower and ends softly (strong ease-out), closing
 * is quicker and accelerates away, so the sheet never makes you wait. With
 * "reduce motion" on, the sheet only fades.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './ui.jsx';

const OPEN_MS = 380;
const CLOSE_MS = 220;
const EASE_OPEN = 'cubic-bezier(0.22, 1, 0.36, 1)'; // fast start, long soft landing
const EASE_CLOSE = 'cubic-bezier(0.4, 0, 1, 1)'; // accelerates out of view

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function Drawer({ open, onClose, title, children }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [drag, setDrag] = useState(0);
  const dragStart = useRef(null);
  const panel = useRef(null);

  // open -> mount; close -> slide out, then unmount
  useEffect(() => {
    if (open) {
      setMounted(true);
      return undefined;
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), CLOSE_MS);
    return () => clearTimeout(t);
  }, [open]);

  // Slide in. The sheet is first committed off-screen; reading its layout here
  // makes the browser compute that closed position BEFORE we flip `shown`, so the
  // change is always a transition. (Flipping it on a timer could skip the closed
  // frame when the content is slow to render, and the sheet just appeared.)
  useLayoutEffect(() => {
    if (!open || !mounted) return;
    panel.current?.getBoundingClientRect();
    setShown(true);
  }, [open, mounted]);

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

  const reduce = reducedMotion();
  const ms = shown ? OPEN_MS : CLOSE_MS;
  const ease = shown ? EASE_OPEN : EASE_CLOSE;

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
        className="absolute inset-0 bg-black/70"
        style={{ opacity: shown ? 1 : 0, transition: `opacity ${ms}ms ease-out` }}
      />
      <div
        ref={panel}
        className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[88vh] max-w-md flex-col rounded-t-3xl border border-b-0 border-line-strong bg-black will-change-transform"
        style={{
          // reduced motion: fade in place instead of sliding
          transform: reduce ? `translateY(${drag}px)` : shown ? `translateY(${drag}px)` : 'translateY(100%)',
          opacity: reduce ? (shown ? 1 : 0) : 1,
          // no transition while a finger drags the sheet; it follows the finger 1:1
          transition: drag ? 'none' : `${reduce ? 'opacity' : 'transform'} ${ms}ms ${ease}`,
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
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line-strong" />
          <div className="flex items-center justify-between gap-3">
            <h3 className="title m-0">{title}</h3>
            <button
              onClick={onClose}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Close"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-strong text-white"
            >
              <Icon name="close" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-6">{children}</div>
      </div>
    </div>
  );
}
