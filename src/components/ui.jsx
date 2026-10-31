/** Small shared pieces of the dot-matrix design: icons, headers, range pills, stat strips. */
import { RANGES } from '../lib/analysis.js';
import Count from './Count.jsx';

const PATHS = {
  sync: 'M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4',
  back: 'M15.5 5l-7 7 7 7', // x 8.5-15.5: centred on the 24 box
  metrics: 'M5 20V10M12 20V4M19 20v-7',
  history: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  run: 'M13 4.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M8 21l3-6 3 2 2-5-3-2-3 2-2 4M12 9l4 2',
  strength: 'M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12',
  close: 'M6 6l12 12M18 6L6 18',
  chevron: 'M8.5 5l7 7-7 7',
  share: 'M12 3v12M8 7l4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  ride: 'M2 17a3 3 0 1 0 6 0a3 3 0 1 0-6 0M16 17a3 3 0 1 0 6 0a3 3 0 1 0-6 0M5 17l4-8h6l4 8M9 9H6',
  swim: 'M2 19c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M2 14c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M14 6a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M7 11l4-3 3 2',
  hike: 'M3 19l6-11 4 6 2-3 6 8z',
};

export function Icon({ name, size = 18, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Round outlined icon button (back, sync...). */
export function CircleButton({ icon, label, onClick, spinning = false, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-strong bg-black text-white active:bg-neutral-900 disabled:opacity-70"
    >
      <Icon name={icon} size={18} className={spinning ? 'animate-spin' : ''} />
    </button>
  );
}

/** Section heading: optional accent number (desktop), Doto title, muted note on the right. */
export function SectionHead({ n, title, note, small = false }) {
  return (
    <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 lg:justify-start">
      <div className="flex items-baseline gap-4">
        {n && <span className="hidden text-xs text-accent lg:inline">{n}</span>}
        {small ? (
          <h2 className="eyebrow m-0 font-normal lg:font-dot lg:text-[28px] lg:font-bold lg:tracking-[0.04em] lg:text-white">{title}</h2>
        ) : (
          <h2 className="title m-0 lg:text-[28px]">{title}</h2>
        )}
      </div>
      {note && <span className="text-xs text-muted lg:tracking-[0.12em] lg:uppercase">{note}</span>}
    </div>
  );
}

/** 1M / 3M / YTD / 1Y / All. */
export function RangePills({ value, onChange, large = false }) {
  return (
    <div className="flex gap-1.5 lg:gap-2">
      {RANGES.map((r) => (
        <button
          key={r.key}
          title={r.name}
          aria-pressed={value === r.key}
          onClick={() => onChange(r.key)}
          className={`flex-1 rounded-full border text-center lg:flex-none lg:px-[22px] ${
            large ? 'py-[13px] text-[13px]' : 'py-3 text-xs lg:text-[13px]'
          } ${
            value === r.key ? 'border-accent bg-accent font-bold text-black' : 'border-line-strong text-white'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Big numbers for an activity / exercise header: [{ label, value, unit, accent, desktopOnly }].
 * Phones: one card with the numbers side by side. Desktop: one card per number
 * (and the `desktopOnly` ones too).
 */
export function StatStrip({ stats }) {
  const phone = stats.filter((s) => !s.desktopOnly);
  return (
    <>
      <div className="card grid grid-cols-3 gap-2 px-2 py-5 text-center lg:hidden">
        {phone.map((s) => (
          <div key={s.label} className="flex min-w-0 flex-col gap-2">
            <span className="text-xs tracking-[0.12em] text-muted uppercase">{s.label}</span>
            <span className={`num truncate ${String(s.value).length > 5 ? 'text-[22px]' : 'text-[30px]'} ${s.accent ? 'text-accent' : ''}`}>
              <Count text={s.value} />
            </span>
            {s.unit != null && <span className="text-xs text-muted">{s.unit}</span>}
          </div>
        ))}
      </div>
      <div className={`hidden gap-4 lg:grid ${stats.length > 3 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {stats.map((s) => (
          <div key={s.label} className="card flex min-w-0 flex-col gap-4 p-6">
            <span className="eyebrow">{s.label}</span>
            <div className="flex items-baseline gap-2.5">
              <span className={`num ${String(s.value).length > 6 ? 'text-[52px]' : 'text-[72px]'} leading-[0.9] ${s.accent ? 'text-accent' : ''}`}>
                <Count text={s.value} />
              </span>
              {s.unit && <span className="text-xs tracking-[0.12em] text-muted">{s.unit}</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** Splits "6.01 km" / "8:24 /km" into a big number and a small unit. */
export function splitUnit(text) {
  if (text == null) return { value: '–', unit: '' };
  const m = /^([−+\-]?[\d.,:]+)\s*(.*)$/.exec(String(text));
  return m ? { value: m[1], unit: m[2] } : { value: String(text), unit: '' };
}

/** Share: a round icon on phones, a labelled pill on desktop. Sits at the right of the title row. */
export function ShareButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Share"
      className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center gap-2.5 rounded-full border border-line-strong bg-black text-white active:bg-neutral-900 lg:w-auto lg:px-5 lg:text-[13px]"
    >
      <Icon name="share" />
      <span className="hidden lg:inline">Share</span>
    </button>
  );
}

/** Back button + title + subtitle row used by detail screens. */
export function DetailHeader({ title, sub, onBack, backLabel = 'Back', action }) {
  return (
    <div className="flex items-center gap-3.5 lg:gap-4">
      <CircleButton icon="back" label={backLabel} onClick={onBack} />
      <div className="min-w-0">
        <h1 className="m-0 font-dot text-[26px] leading-[1.1] font-bold break-words lg:text-[44px] lg:leading-[1.05] lg:font-black lg:tracking-[0.02em] lg:uppercase">
          {title}
        </h1>
        {sub && <p className="m-0 mt-1 text-xs text-muted lg:mt-1.5 lg:text-[13px]">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export const Note = ({ children, className = '' }) => (
  <p className={`m-0 text-xs leading-relaxed text-muted ${className}`}>{children}</p>
);

export const Empty = ({ children }) => <p className="py-8 text-center text-sm text-muted">{children}</p>;

/** "▲ 0:12" faster (white), "▼ 0:05" slower (accent), "–" unchanged or unknown; from analysis.changeOf. */
export function Change({ change, fmt, className = '' }) {
  const { dir, secs } = change;
  const [text, color] =
    dir === 'faster' ? [`▲ ${fmt(secs)}`, 'text-white'] : dir === 'slower' ? [`▼ ${fmt(secs)}`, 'text-accent'] : ['–', 'text-muted'];
  return <span className={`font-bold whitespace-nowrap ${color} ${className}`}>{text}</span>;
}
