/**
 * "Play once, when first seen": drives the entrance animation of charts (DotGrid) and big
 * numbers (Count). Returns [ref, phase] for the element to watch:
 *
 *   'off'   no animation: already played this session, reduced motion, or switched off
 *   'wait'  not on screen yet, so the element stays in its starting state
 *   'play'  just scrolled into view: animate now (back to 'off' when it has finished)
 *
 * `key` names what is being shown; once it has played it is remembered for the rest of the
 * session, so coming back to a tab does not replay it. Without a key it plays on every mount.
 */
import { useEffect, useRef, useState } from 'react';

const seen = new Set();
export const PLAY_MS = 2000; // longer than any animation, then the phase returns to 'off'

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function useReveal(key, enabled = true) {
  const ref = useRef(null);
  const [phase, setPhase] = useState(() => (enabled && !(key && seen.has(key)) && !reducedMotion() ? 'wait' : 'off'));

  // wait for the element to be on screen
  useEffect(() => {
    if (phase !== 'wait') return undefined;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setPhase('play');
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        setPhase('play');
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [phase]);

  // remember it, and leave the animation state once it is over
  useEffect(() => {
    if (phase !== 'play') return undefined;
    if (key) seen.add(key);
    const t = setTimeout(() => setPhase('off'), PLAY_MS);
    return () => clearTimeout(t);
  }, [phase, key]);

  return [ref, phase];
}
