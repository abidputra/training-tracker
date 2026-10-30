/** Small shared pieces of the dot-matrix design: icons, headers, range pills, stat strips. */
import { RANGES } from '../lib/analysis.js';

const PATHS = {
  sync: 'M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4',
  back: 'M15 5l-7 7 7 7',
  metrics: 'M5 20V10M12 20V4M19 20v-7',
  history: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  run: 'M13 4.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M8 21l3-6 3 2 2-5-3-2-3 2-2 4M12 9l4 2',
  strength: 'M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12',
  close: 'M6 6l12 12M18 6L6 18',
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
        {small ? <h2 className="eyebrow m-0 font-normal">{title}</h2> : <h2 className="title m-0 lg:text-[28px]">{title}</h2>}
      </div>
      {note && <span className="text-xs text-muted lg:tracking-[0.12em] lg:uppercase">{note}</span>}
    </div>
  );
}

/** 1M / 3M / YTD / 1Y / All. */
export function RangePills({ value, onChange }) {
  return (
    <div className="flex gap-1.5">
      {RANGES.map((r) => (
        <button
          key={r.key}
          title={r.name}
          aria-pressed={value === r.key}
          onClick={() => onChange(r.key)}
          className={`flex-1 rounded-full border py-3 text-center text-xs ${
            value === r.key ? 'border-accent bg-accent font-bold text-black' : 'border-line-strong text-white'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

/** Three big numbers in a card (activity / exercise headers). [{ label, value, unit, accent }] */
export function StatStrip({ stats }) {
  return (
    <div className="card grid grid-cols-3 gap-2 px-2 py-5 text-center">
      {stats.map((s) => (
        <div key={s.label} className="flex min-w-0 flex-col gap-2">
          <span className="text-xs tracking-[0.12em] text-muted uppercase">{s.label}</span>
          <span className={`num truncate ${String(s.value).length > 5 ? 'text-[22px]' : 'text-[30px]'} ${s.accent ? 'text-accent' : ''}`}>
            {s.value}
          </span>
          {s.unit != null && <span className="text-xs text-muted">{s.unit}</span>}
        </div>
      ))}
    </div>
  );
}

/** Splits "6.01 km" / "8:24 /km" into a big number and a small unit. */
export function splitUnit(text) {
  if (text == null) return { value: '–', unit: '' };
  const m = /^([−+\-]?[\d.,:]+)\s*(.*)$/.exec(String(text));
  return m ? { value: m[1], unit: m[2] } : { value: String(text), unit: '' };
}

/** Back button + title + subtitle row used by detail screens. */
export function DetailHeader({ title, sub, onBack, backLabel = 'Back' }) {
  return (
    <div className="flex items-center gap-3.5">
      <CircleButton icon="back" label={backLabel} onClick={onBack} />
      <div className="min-w-0">
        <h1 className="m-0 font-dot text-[26px] leading-[1.1] font-bold break-words">{title}</h1>
        {sub && <p className="m-0 mt-1 text-xs text-muted">{sub}</p>}
      </div>
    </div>
  );
}

export const Note = ({ children, className = '' }) => (
  <p className={`m-0 text-xs leading-relaxed text-muted ${className}`}>{children}</p>
);

export const Empty = ({ children }) => <p className="py-8 text-center text-sm text-muted">{children}</p>;
