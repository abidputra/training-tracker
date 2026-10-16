/**
 * Pull-to-refresh for the installed PWA (standalone mode has no browser
 * reload, and iOS gives no native pull gesture there).
 *
 * Pull down while scrolled to the top; past THRESHOLD px, releasing calls
 * onRefresh(). Returns { pull, refreshing } for drawing the indicator.
 */
import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 70;
const MAX_PULL = 110;

export function usePullToRefresh(onRefresh) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef(null);
  const pullRef = useRef(0);
  const busy = useRef(false);
  const cb = useRef(onRefresh);
  cb.current = onRefresh;

  useEffect(() => {
    const set = (v) => {
      pullRef.current = v;
      setPull(v);
    };

    const onStart = (e) => {
      if (busy.current || window.scrollY > 0 || e.touches.length !== 1) return;
      start.current = e.touches[0].clientY;
    };
    const onMove = (e) => {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) {
        if (pullRef.current) set(0);
        return;
      }
      e.preventDefault(); // stop the page from rubber-banding while we track the pull
      set(Math.min(MAX_PULL, dy * 0.5));
    };
    const onEnd = async () => {
      if (start.current === null) return;
      start.current = null;
      if (pullRef.current < THRESHOLD) return set(0);
      busy.current = true;
      setRefreshing(true);
      set(THRESHOLD * 0.6);
      try {
        await cb.current();
      } finally {
        busy.current = false;
        setRefreshing(false);
        set(0);
      }
      return undefined;
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return { pull, refreshing, ready: pull >= THRESHOLD };
}
