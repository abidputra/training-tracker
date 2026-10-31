/**
 * A formatted figure ("5:32", "10.2", "1:07:23", "12,450") that counts up from zero the first
 * time it is seen, keeping its format all the way ("0:00" -> "5:32"). Text without digits ("–")
 * is shown as is. Once played, or with reduced motion, it is just the text.
 */
import { useEffect, useState } from 'react';
import { useReveal } from '../hooks/useReveal.js';

const DURATION = 1000;
const NUMBER = /\d+(?:\.\d+)?/g;
const ease = (t) => 1 - (1 - t) ** 3; // fast start, soft landing

/** `text` with every number scaled to fraction `p` of its value, in the same shape. */
function frame(text, p) {
  return text.replace(NUMBER, (token, offset) => {
    const dot = token.indexOf('.');
    const decimals = dot < 0 ? 0 : token.length - dot - 1;
    const out = (parseFloat(token) * p).toFixed(decimals);
    // groups after ":" or "," keep their width (1:07:23, 12,450), so the shape does not wobble
    const grouped = offset > 0 && /[:,]/.test(text[offset - 1]);
    return grouped ? out.padStart(token.length, '0') : out;
  });
}

export default function Count({ text, className = '', id }) {
  const s = text == null ? '' : String(text);
  const animated = /\d/.test(s);
  const [ref, phase] = useReveal(id ?? `count:${s}`, animated);
  const [p, setP] = useState(0);

  useEffect(() => {
    if (phase !== 'play') return undefined;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / DURATION);
      setP(ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const shown = phase === 'off' ? s : frame(s, phase === 'wait' ? 0 : p);
  return (
    <span ref={ref} className={className}>
      {shown}
    </span>
  );
}
