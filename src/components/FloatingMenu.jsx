/**
 * Floating pill menu pinned to the bottom of the screen. Switches between the
 * top-level views. Settings is not in here: it is opened from the profile menu.
 */
import { Icon } from './ui.jsx';

export const VIEWS = [
  { key: 'metrics', label: 'Metrics', icon: 'metrics' },
  { key: 'history', label: 'History', icon: 'history' },
];

export default function FloatingMenu({ view, onChange }) {
  return (
    <nav
      aria-label="Views"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:hidden"
    >
      <div className="pointer-events-auto flex w-full max-w-[358px] gap-1 rounded-full border border-line-strong bg-black p-1">
        {VIEWS.map((v) => {
          const active = view === v.key;
          return (
            <button
              key={v.key}
              onClick={() => onChange(v.key)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full text-[13px] ${
                active ? 'bg-accent font-bold text-black' : 'text-white active:bg-neutral-900'
              }`}
            >
              <Icon name={v.icon} />
              {v.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
