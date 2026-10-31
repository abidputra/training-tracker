/**
 * First-run "Connect your app" sheet, shown once right after a new user's first
 * sign-in. Phones: a bottom sheet over the empty dashboard. Desktop: a centred
 * 560px dialog.
 *
 *   step 1  connect Garmin (the real GarminForm opens in place), or skip
 *   step 2  connected: points to Settings > Connections > Import all
 *
 * `onClose` is called for skip, done and Esc; `onSettings` for "Go to Settings".
 */
import { useEffect, useState } from 'react';
import GarminForm from './GarminForm.jsx';

// Dot-matrix check mark on a 9 x 7 grid, 2 dots thick: short stroke down-right, long stroke up-right.
const COLS = 9;
const ROWS = 7;
const LIT = new Set();
[[3, 1], [4, 2], [5, 3], [4, 4], [3, 5], [2, 6], [1, 7]].forEach(([r, c]) => {
  LIT.add(`${r},${c}`);
  LIT.add(`${r},${c + 1}`);
});

function Check() {
  const cells = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      cells.push(<div key={`${r},${c}`} className={`d ${LIT.has(`${r},${c}`) ? 'd-acc' : 'd-base'}`} />);
    }
  }
  return (
    <div role="img" aria-label="Check mark" className="grid w-max" style={{ gridTemplateColumns: `repeat(${COLS}, 14px)` }}>
      {cells}
    </div>
  );
}

const heading = 'm-0 font-dot text-[30px] leading-[1.05] font-black tracking-[0.02em] uppercase lg:text-[40px]';

export default function OnboardConnect({ onClose, onSettings, onConnected }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 lg:flex lg:items-center lg:justify-center" role="dialog" aria-modal="true" aria-label="Connect your app" data-no-ptr>
      <div className="absolute inset-0 bg-black/60 lg:bg-black/70" onClick={onClose} />
      <section className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[88vh] max-w-md flex-col gap-[18px] overflow-y-auto rounded-t-[28px] border border-b-0 border-line-strong bg-black px-5 pb-7 pt-3 lg:relative lg:inset-auto lg:mx-0 lg:max-h-[90vh] lg:w-[560px] lg:max-w-[calc(100vw-40px)] lg:gap-6 lg:rounded-[28px] lg:border-b lg:p-9">
        <div aria-hidden="true" className="h-1.5 w-12 flex-none self-center rounded-full bg-line-strong lg:hidden" />

        <div role="img" aria-label={`Step ${step} of 2`} className="flex items-center gap-2">
          <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${step === 1 ? 'bg-accent' : 'bg-line-strong'}`} />
          <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${step === 2 ? 'bg-accent' : 'bg-line-strong'}`} />
          <span className="ml-1 text-xs text-muted">Step {step} of 2</span>
        </div>

        {step === 1 ? (
          <div className="flex flex-col gap-4 lg:gap-[18px]">
            <h2 className={heading}>Connect your app</h2>
            <p className="m-0 text-sm leading-relaxed text-muted">
              Welcome! Link your watch account so your runs and strength sessions show up here. It takes about a minute.
            </p>
            <div className="card flex items-center justify-between gap-3 px-5 py-[18px]">
              <div className="flex flex-col gap-1">
                <span className="font-dot text-[28px] leading-none font-black">Garmin</span>
                <span className="text-xs text-muted">Runs and strength</span>
              </div>
              <span className="flex-none rounded-full border border-line-strong px-3 py-1.5 text-xs tracking-[0.1em] whitespace-nowrap text-muted uppercase">
                Not connected
              </span>
            </div>

            {form ? (
              <GarminForm
                onCancel={() => setForm(false)}
                onDone={() => {
                  onConnected();
                  setStep(2);
                }}
              />
            ) : (
              <div className="flex flex-col gap-2">
                <button onClick={() => setForm(true)} className="btn-primary min-h-[52px]">
                  Connect Garmin
                </button>
                <button onClick={onClose} className="flex min-h-12 items-center justify-center rounded-full text-[13px] text-muted">
                  Skip for now
                </button>
              </div>
            )}
            <p className="m-0 text-center text-xs leading-relaxed text-muted">You can connect any time in Settings.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 lg:gap-[18px]">
            <Check />
            <h2 className={heading}>Garmin connected</h2>
            <p className="m-0 text-sm leading-relaxed text-muted">
              Your latest activities will sync in a moment. To bring in your full history, open <b className="text-white">Settings</b>, go
              to <b className="text-white">Connections</b> and tap <b className="text-white">Import all</b>.
            </p>
            <div aria-hidden="true" className="card flex flex-col gap-3 px-5 py-4">
              <span className="eyebrow tracking-[0.14em]">Settings · Connections</span>
              <div className="flex items-center justify-between gap-3">
                <span className="font-dot text-[22px] font-black">Garmin</span>
                <span className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  Connected
                </span>
              </div>
              <div className="flex gap-2">
                <span className="flex min-h-11 items-center rounded-full border-2 border-accent px-[18px] text-[13px] font-bold">Import all</span>
                <span className="flex min-h-11 items-center rounded-full border border-line-strong px-[18px] text-[13px] text-muted">Disconnect</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={onSettings} className="btn-primary min-h-[52px]">
                Go to Settings
              </button>
              <button onClick={onClose} className="btn min-h-12">
                Done
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
