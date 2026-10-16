/**
 * Sticky row of pill buttons that jump to each page section. The pill of the
 * section currently in view is highlighted (and scrolled into the row).
 * Pills whose section is not on the page (e.g. no runs yet) are hidden.
 */
import { useEffect, useRef, useState } from 'react';

export default function SectionNav({ sections }) {
  const [active, setActive] = useState(sections[0]?.id);
  const [present, setPresent] = useState(sections.map((s) => s.id));
  const row = useRef(null);

  // Which sections exist (runs every render; only updates on change).
  useEffect(() => {
    const ids = sections.map((s) => s.id).filter((id) => document.getElementById(id));
    setPresent((prev) => (prev.join() === ids.join() ? prev : ids));
  });

  // Active = last section whose top has passed 30% of the screen; at the very
  // bottom the last section wins (it may be too short to ever reach the top).
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const els = present.map((id) => document.getElementById(id)).filter(Boolean);
      if (!els.length) return;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let cur = els[0];
      for (const el of els) if (el.getBoundingClientRect().top <= window.innerHeight * 0.3) cur = el;
      setActive(atBottom ? els[els.length - 1].id : cur.id);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [present]);

  useEffect(() => {
    const pill = row.current?.querySelector(`[data-id="${active}"]`);
    if (pill) row.current.scrollTo({ left: pill.offsetLeft - 16, behavior: 'smooth' });
  }, [active]);

  const go = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav
      className="sticky z-30 -mx-4 mb-4 bg-[#0f172a] py-1"
      style={{ top: 'var(--top-inset)' }}
    >
      <div
        ref={row}
        className="relative flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sections
          .filter((s) => present.includes(s.id))
          .map((s) => (
            <button
              key={s.id}
              data-id={s.id}
              onClick={() => go(s.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium ring-1 transition-colors ${
                active === s.id
                  ? 'bg-emerald-500 text-slate-950 ring-emerald-500'
                  : 'bg-slate-900 text-slate-300 ring-slate-700'
              }`}
            >
              {s.label}
            </button>
          ))}
      </div>
    </nav>
  );
}
