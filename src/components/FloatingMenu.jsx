/**
 * Floating pill menu pinned to the bottom of the screen. Switches between the
 * top-level views. Settings is not in here: it is opened from the profile menu.
 */
export const VIEWS = [
  { key: 'metrics', label: 'Training Metric', icon: '📊' },
  { key: 'history', label: 'Activity History', icon: '🗂️' },
];

export default function FloatingMenu({ view, onChange }) {
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <div className="pointer-events-auto flex gap-1 rounded-full bg-slate-900/95 p-1.5 shadow-2xl ring-1 ring-slate-700 backdrop-blur">
        {VIEWS.map((v) => {
          const active = view === v.key;
          return (
            <button
              key={v.key}
              onClick={() => onChange(v.key)}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 active:bg-slate-800'
              }`}
            >
              <span aria-hidden="true">{v.icon}</span>
              {v.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
