/**
 * The "At a Glance" layout shared by every sport tab: on a phone a swipeable row of cards with
 * page dots under it, from `lg` up all the cards in a grid. `items` is [{ key, label, node }];
 * `cols` is the desktop column class (a full literal, so Tailwind can see it).
 */
import { useRef, useState } from 'react';

export default function GlanceCarousel({ items, cols = 'lg:grid-cols-4' }) {
  const scroller = useRef(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const el = scroller.current;
    const card = el?.firstElementChild;
    if (!card) return;
    setActive(Math.round(el.scrollLeft / (card.offsetWidth + 12)));
  };

  const goTo = (i) => {
    const el = scroller.current;
    const card = el?.children[i];
    if (card) el.scrollTo({ left: card.offsetLeft - 16, behavior: 'smooth' }); // 16 = px-4 gutter
  };

  return (
    <div>
      <div
        ref={scroller}
        onScroll={onScroll}
        className={`no-scrollbar relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid ${cols} lg:gap-4 lg:overflow-visible lg:px-0`}
      >
        {items.map(({ key, node }) => (
          <div key={key} className="w-[min(300px,80%)] shrink-0 snap-start lg:w-auto">
            {node}
          </div>
        ))}
      </div>
      <div className="mt-3.5 flex justify-center gap-2 lg:hidden">
        {items.map(({ key, label }, i) => (
          <button
            key={key}
            aria-label={`Show ${label}`}
            onClick={() => goTo(i)}
            className={`h-2 w-2 rounded-full ${i === active ? 'bg-accent' : 'bg-line-strong'}`}
          />
        ))}
      </div>
    </div>
  );
}
