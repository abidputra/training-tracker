/**
 * Desktop top bar (shown from the `lg` breakpoint; phones use the floating
 * menu and the compact header instead): wordmark, the three views as pills,
 * connected providers, last sync, and the controls passed as `children`
 * (sync button and profile menu).
 */
import { LastSynced } from './SyncButton.jsx';

const VIEWS = [
  { key: 'metrics', label: 'Metrics' },
  { key: 'history', label: 'History' },
  { key: 'settings', label: 'Settings' },
];

const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function TopBar({ view, onChange, lastSynced, connections, children }) {
  return (
    <header className="mb-10 hidden items-center justify-between gap-6 border-b border-dotted border-[#3a3a3a] py-6 lg:flex">
      <div className="flex items-center gap-8">
        <button
          onClick={() => onChange('metrics')}
          className="font-dot text-[22px] font-black tracking-[0.04em] whitespace-nowrap text-white uppercase"
        >
          AIO Training Tracker
        </button>
        <nav aria-label="Views" className="flex gap-2">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => onChange(v.key)}
              aria-current={view === v.key ? 'page' : undefined}
              className={view === v.key ? 'pill-on' : 'pill'}
            >
              {v.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4 text-xs tracking-[0.12em] uppercase">
        {Object.keys(connections).map((p) => (
          <span key={p} className="rounded-full border border-line-strong px-3.5 py-2">
            {title(p)}
          </span>
        ))}
        <LastSynced iso={lastSynced} className="tracking-[0.12em] uppercase" />
        {children}
      </div>
    </header>
  );
}
