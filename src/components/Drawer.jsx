/**
 * Drawer. Phones: a bottom sheet that slides up (closes with a swipe down on
 * the grab handle). Desktop (`lg`): a side panel that slides in from the right,
 * full height; with `modal`, a centred dialog that fades in instead (the share
 * dialog), whose children draw their own title and close button. Both fade a backdrop, slide back out before unmounting, and close
 * on backdrop click, Esc or the ✕ button. Locks page scroll while open.
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

const DESKTOP = '(min-width: 1024px)'; // Tailwind `lg`

/** True from the `lg` breakpoint up; follows window resizes. */
function useDesktop() {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(DESKTOP).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(DESKTOP);
    if (!mq) return undefined;
    const update = () => setOn(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return on;
}

export default function Drawer({ open, onClose, title, children, modal = false }) {
  const desktop = useDesktop();
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
    if (desktop) return; // the side panel has no swipe handle
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
    <div
      className={`fixed inset-0 z-40 ${modal ? 'lg:flex lg:items-center lg:justify-center' : ''}`}
      data-no-ptr
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
        style={{ opacity: shown ? 1 : 0, transition: `opacity ${ms}ms ease-out` }}
      />
      <div
        ref={panel}
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[88vh] max-w-md flex-col rounded-t-[28px] border border-b-0 border-line-strong bg-black will-change-transform ${
          modal
            ? 'lg:relative lg:inset-auto lg:mx-0 lg:h-[800px] lg:max-h-[90vh] lg:w-[1080px] lg:max-w-[calc(100vw-80px)] lg:rounded-[28px] lg:border-b'
            : 'lg:inset-x-auto lg:inset-y-0 lg:right-0 lg:mx-0 lg:max-h-none lg:w-[560px] lg:max-w-[90vw] lg:rounded-none lg:rounded-l-3xl lg:border-b lg:border-r-0'
        }`}
        style={{
          // desktop: from the right; phone: from the bottom. Reduced motion: fade in place instead of sliding.
          transform: desktop
            ? modal
              ? reduce || shown ? 'none' : 'translateY(16px)'
              : reduce || shown ? 'none' : 'translateX(100%)'
            : reduce ? `translateY(${drag}px)` : shown ? `translateY(${drag}px)` : 'translateY(100%)',
          // reduced motion, or the centred dialog on desktop: fade instead of sliding in
          opacity: reduce || (desktop && modal) ? (shown ? 1 : 0) : 1,
          // no transition while a finger drags the sheet; it follows the finger 1:1
          transition: drag
            ? 'none'
            : reduce
              ? `opacity ${ms}ms ${ease}`
              : desktop && modal
                ? `transform ${ms}ms ${ease}, opacity ${ms}ms ${ease}`
                : `transform ${ms}ms ${ease}`,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div
          className={`cursor-grab touch-none px-5 pb-2 pt-3 lg:cursor-auto lg:touch-auto lg:px-8 lg:pt-8 ${modal ? 'lg:hidden' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line-strong lg:hidden" />
          <div className="flex items-center justify-between gap-3">
            <h3 className="title m-0" style={{ fontSize: desktop ? 30 : 24 }}>
              {title}
            </h3>
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
        <div className={`min-h-0 overflow-y-auto overscroll-contain px-5 pb-6 lg:flex-1 lg:px-8 lg:pb-8 ${modal ? 'lg:pt-8' : ''}`}>{children}</div>
      </div>
    </div>
  );
}
