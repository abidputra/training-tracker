/**
 * Landing page, shown to visitors who are not signed in.
 * "Get started" opens the sign-up form, "Sign in" opens the sign-in form (both are AuthForm,
 * reached through the two callbacks; App owns which one is showing).
 *
 * One layout for every width: phone is the base, `lg:` is the desktop board from the design.
 * Colours come from the --accent variable (the default red when signed out), so the page
 * follows the accent like the rest of the app. The dots, count-up and LED turn-on are the
 * app's own DotGrid and Count, so they respect reduced motion and play once when scrolled to.
 */
import Count from './Count.jsx';
import DotGrid from './DotGrid.jsx';
import { Icon } from './ui.jsx';
import {
  ARROW_ACROSS,
  ARROW_DOWN,
  HERO_BARS_DESKTOP,
  HERO_BARS_PHONE,
  ICONS,
  PREVIEW_BARS_DESKTOP,
  PREVIEW_BARS_PHONE,
} from '../lib/landingGrids.js';

const FEATURES = [
  { icon: 'bests', title: 'Personal bests', text: 'Your fastest 5K, 10K and more, updated after every run.' },
  { icon: 'trends', title: 'Trends', text: 'See pace, heart rate and distance move over weeks, not just days.' },
  {
    icon: 'predictions',
    title: 'Race predictions',
    text: 'What you could run a 5K, 10K, half or marathon today, from your recent training.',
  },
  { icon: 'metrics', title: 'Running metrics', text: 'Pace zones, cadence, stride and the rest of your running dynamics.' },
  { icon: 'strength', title: 'Strength and muscle map', text: 'Sets, volume and a body map that shows what you trained.' },
  { icon: 'install', title: 'Install as an app', text: 'Add it to your home screen. It opens like a native app, no store needed.' },
];

const COACH_STEPS = [
  { title: 'Link', text: "Enter your coach's ID." },
  { title: 'Plan', text: 'Your coach assigns your training plan.' },
  { title: 'Share', text: 'Choose the activities to send, with full metrics.' },
  { title: 'Analyze', text: 'Your coach sees analysis of what you shared, nothing else.' },
];

const COACH_SAMPLE = [
  { icon: 'run', name: 'Jakarta Running', when: 'Thu 29 Oct · 6.01 km', shared: true },
  { icon: 'strength', name: 'Strength', when: 'Wed 28 Oct · 20:41', shared: false },
  { icon: 'run', name: 'Long run', when: 'Sun 25 Oct · 9.40 km', shared: true },
];

const PREVIEW_STATS = [
  { label: 'Weekly distance', value: '42.3', unit: 'km', note: '▲ 6% vs usual' },
  { label: 'Avg heart rate', value: '154', unit: 'bpm', note: '▼ 2 bpm vs last week' },
  { label: '5K prediction', value: '26:40', unit: '', note: '▼ 0:35 in 30 days' },
  { label: 'Training load', value: '312', unit: '', note: '● OPTIMAL · usual 280' },
];

const STEPS = [
  { n: '01', title: 'Connect', text: 'Create an account and link your watch or training app.' },
  { n: '02', title: 'Sync', text: 'We pull your activities. The first sync takes a minute or two.' },
  { n: '03', title: 'See', text: 'Open your dashboard. New runs and lifts show up by themselves.' },
];

/** Dashed outline tag: SAMPLE DATA, COMING SOON. */
const Tag = ({ children }) => (
  <span className="rounded-full border border-dashed border-[#777] px-2.5 py-1 text-[11px] font-bold tracking-[0.08em] whitespace-nowrap text-[#b5b5b5]">
    {children}
  </span>
);

const Eyebrow = ({ children }) => <span className="eyebrow">{children}</span>;

/** Section opener: small label, big Doto title, optional line of text. */
function Heading({ label, title, text }) {
  return (
    <div className="flex max-w-[640px] flex-col gap-3">
      <Eyebrow>{label}</Eyebrow>
      <h2 className="m-0 font-dot text-[34px] leading-none font-black tracking-[0.02em] uppercase lg:text-[52px]">{title}</h2>
      {text && <p className="m-0 text-sm leading-[1.7] text-[#b5b5b5] lg:text-[15px]">{text}</p>}
    </div>
  );
}

/** Round accent button (primary) or plain underlined link (secondary). */
function Cta({ onStart, onSignIn, secondary = 'I already have an account' }) {
  return (
    <div className="flex flex-wrap items-center gap-5">
      <button
        type="button"
        onClick={onStart}
        className="inline-flex min-h-14 cursor-pointer items-center justify-center rounded-full border border-accent bg-accent px-8 text-sm font-bold text-black"
      >
        Get started
      </button>
      <button
        type="button"
        onClick={onSignIn}
        className="flex min-h-11 cursor-pointer items-center text-sm underline underline-offset-4"
      >
        {secondary}
      </button>
    </div>
  );
}

/** Tile with a title and a line of text, used for the source steps and the feature cards. */
const tile = 'box-border rounded-[20px] border border-line bg-black p-[22px]';
const tileTitle = 'font-dot text-[22px] leading-[1.1] font-bold tracking-[0.03em] uppercase';

export default function Landing({ onStart, onSignIn }) {
  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-16 px-5 pt-5 pb-8 lg:gap-24 lg:px-20 lg:pt-8 lg:pb-14">
      {/* top bar */}
      <header className="flex items-center justify-between lg:pb-6">
        <span className="font-dot text-xl leading-none font-black tracking-[0.04em] whitespace-nowrap uppercase lg:text-[22px]">
          Training Tracker
        </span>
        <nav aria-label="Page" className="flex items-center gap-7 text-[13px]">
          <a href="#features" className="hidden text-[#b5b5b5] lg:inline">
            Features
          </a>
          <a href="#how" className="hidden text-[#b5b5b5] lg:inline">
            How it works
          </a>
          <button
            type="button"
            onClick={onSignIn}
            className="flex min-h-11 cursor-pointer items-center px-1 underline underline-offset-4 lg:no-underline"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={onStart}
            className="hidden min-h-11 cursor-pointer items-center justify-center rounded-full border border-accent bg-accent px-5 font-bold text-black lg:inline-flex"
          >
            Get started
          </button>
        </nav>
      </header>

      {/* hero */}
      <section className="grid items-center gap-8 pt-4 lg:grid-cols-[7fr_5fr] lg:gap-14 lg:pt-10 lg:pb-6">
        <div className="flex flex-col items-start gap-[18px] lg:gap-6">
          <h1 className="m-0 font-dot text-[46px] leading-[0.98] font-black tracking-[0.01em] uppercase lg:text-[88px]">
            Your training,
            <br />
            on one place.
          </h1>
          <p className="m-0 max-w-[520px] text-[15px] leading-[1.7] text-[#c8c8c8] lg:text-[17px]">
            Training Tracker pulls your runs, lifts and other activities from the apps and watches you already use into one clean dashboard.
            Pace, trends, personal bests and muscle work, without the app-hopping.
          </p>
          <Cta onStart={onStart} onSignIn={onSignIn} />
          {/* <span className="text-xs text-muted">Free while we are small. Works on your phone and your laptop.</span> */}
        </div>

        <div className="flex flex-col gap-[18px] rounded-3xl border border-line bg-black p-5 lg:p-7">
          <div className="flex items-center justify-between">
            <Eyebrow>This week</Eyebrow>
            <Tag>SAMPLE DATA</Tag>
          </div>
          <div className="flex items-baseline gap-3">
            <Count text="42.3" className="font-dot text-[88px] leading-[0.9] font-black text-accent lg:text-[120px]" />
            <span className="text-sm tracking-[0.12em] text-muted">KM</span>
          </div>
          <div className="text-[13px] text-[#d0d0d0]">▲ 6% vs usual · 5 runs</div>
          <DotGrid
            grid={HERO_BARS_PHONE}
            label="Weekly distance, last 8 weeks, sample data"
            className="w-full lg:hidden"
          />
          <DotGrid
            grid={HERO_BARS_DESKTOP}
            label="Weekly distance, last 8 weeks, sample data"
            className="hidden w-full lg:grid"
          />
        </div>
      </section>

      {/* sources */}
      <section className="flex flex-col gap-7">
        <Heading
          label="Sources"
          title="Bring your data. Keep your apps."
          text="Connect once. Training Tracker reads your activities and never changes them."
        />
        <div className="flex flex-col items-center gap-3 lg:flex-row lg:gap-5">
          <div className={`${tile} flex min-w-0 flex-1 flex-col gap-3.5 max-lg:w-full`}>
            <span className={tileTitle}>1 · Connect</span>
            <div className="flex flex-wrap gap-2">
              {['YOUR WATCH', 'YOUR APPS'].map((s) => (
                <span
                  key={s}
                  className="inline-flex min-h-11 items-center rounded-full border border-[#555] px-5 text-[13px] font-bold tracking-[0.12em]"
                >
                  {s}
                </span>
              ))}
              <span className="inline-flex min-h-11 items-center rounded-full border border-dashed border-[#555] px-5 text-[13px] font-bold tracking-[0.12em]">
                + MORE
              </span>
            </div>
            <span className="text-[13px] leading-[1.7] text-[#b5b5b5]">Link the account you already use. One time, about a minute.</span>
          </div>
          <Arrow />
          <div className={`${tile} flex min-w-0 flex-1 flex-col gap-2.5 max-lg:w-full`}>
            <span className={tileTitle}>2 · Sync</span>
            <span className="text-[13px] leading-[1.7] text-[#b5b5b5]">New activities come in on their own. Nothing to export or upload.</span>
          </div>
          <Arrow />
          <div className={`${tile} flex min-w-0 flex-1 flex-col gap-2.5 border-accent max-lg:w-full`}>
            <span className={tileTitle}>3 · One page</span>
            <span className="text-[13px] leading-[1.7] text-[#b5b5b5]">Everything in one dashboard: runs, lifts, trends and records.</span>
          </div>
        </div>
        <span className="text-xs text-muted">More sources are on the way.</span>
      </section>

      {/* features */}
      <section id="features" className="flex scroll-mt-6 flex-col gap-7">
        <Heading
          label="Features"
          title="Built for people who like their numbers."
          text="Everything is made of the same dots you will see in the app."
        />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className={`${tile} flex flex-row items-center gap-[18px] lg:flex-col lg:items-stretch`}>
              <DotGrid grid={ICONS[f.icon]} className="w-[54px] flex-none" />
              <div className="flex flex-col gap-2">
                <span className={tileTitle}>{f.title}</span>
                <span className="text-[13px] leading-[1.7] text-[#b5b5b5]">{f.text}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* coach center */}
      <section className="flex flex-col gap-8">
        <div className="grid items-center gap-7 lg:grid-cols-[6fr_5fr] lg:gap-14">
          <div className="flex flex-col items-start gap-5">
            <div className="flex items-center gap-2.5">
              <Eyebrow>Coach Center</Eyebrow>
              <Tag>COMING SOON</Tag>
            </div>
            <h2 className="m-0 font-dot text-[34px] leading-none font-black tracking-[0.02em] uppercase lg:text-[52px]">
              Training with a coach? You decide what they see.
            </h2>
            <p className="m-0 text-sm leading-[1.7] text-[#b5b5b5] lg:text-[15px]">
              Link your coach with their Coach ID. They set your plan. You pick which activities to share, and they only ever see
              those.
            </p>
            <p className="m-0 text-[13px] leading-[1.7] text-muted">
              Are you a coach? Give your athletes your Coach ID and follow the training they share, in one place.
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-3xl border border-line bg-black p-5 lg:p-7">
            <div className="flex items-center justify-between gap-2">
              <Eyebrow>Shared with Coach Dimas</Eyebrow>
              <Tag>SAMPLE</Tag>
            </div>
            {COACH_SAMPLE.map((a) => (
              <div key={a.name + a.when} className="flex min-h-[60px] items-center gap-3 border-b border-dotted border-[#3a3a3a] py-2.5">
                <Icon name={a.icon} size={20} className="flex-none" />
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="text-sm font-bold">{a.name}</span>
                  <span className="text-xs text-[#b5b5b5]">{a.when}</span>
                </div>
                {a.shared ? (
                  <span className="rounded-full border border-[#777] px-2.5 py-1 text-[11px] font-bold tracking-[0.08em] whitespace-nowrap">
                    ✓ SHARED
                  </span>
                ) : (
                  <Tag>NOT SHARED</Tag>
                )}
              </div>
            ))}
            <div className="mt-2 flex items-start gap-3 rounded-[14px] border border-dashed border-[#555] px-3.5 py-3">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="mt-0.5 flex-none"
              >
                <path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              <span className="text-xs leading-[1.6] text-[#d0d0d0]">Your coach only sees what you share. Stop any time.</span>
            </div>
          </div>
        </div>

        <ol className="m-0 flex list-none flex-col gap-5 border-t border-dotted border-[#3a3a3a] p-0 pt-6 lg:flex-row lg:gap-6">
          {COACH_STEPS.map((s, i) => (
            <li key={s.title} className="flex min-w-0 flex-1 items-start gap-3">
              <span className="flex size-9 flex-none items-center justify-center rounded-full border border-[#555] bg-black font-dot text-lg leading-none font-black">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold">{s.title}</span>
                <span className="text-[13px] leading-[1.6] text-[#b5b5b5]">{s.text}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* preview */}
      <section className="flex flex-col gap-7">
        <Heading
          label="Preview"
          title="See it before you sign up."
          text="A look at the running dashboard with sample numbers. Yours fills in after the first sync."
        />
        <div className="flex flex-col gap-3.5 rounded-[28px] border border-line-strong bg-black p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <Eyebrow>Running · last 30 days</Eyebrow>
            <Tag>SAMPLE DATA</Tag>
          </div>
          <div className="grid gap-3 lg:grid-cols-[5fr_7fr]">
            <div className="grid grid-cols-2 content-start gap-3">
              {PREVIEW_STATS.map((s) => (
                <div key={s.label} className="box-border flex min-w-0 flex-col gap-2.5 rounded-[20px] border border-line p-[18px]">
                  <Eyebrow>{s.label}</Eyebrow>
                  <div className="flex items-baseline gap-2">
                    <Count text={s.value} className="font-dot text-[34px] leading-none font-black lg:text-[44px]" />
                    {s.unit && <span className="text-xs text-muted">{s.unit}</span>}
                  </div>
                  <span className="text-xs text-[#b5b5b5]">{s.note}</span>
                </div>
              ))}
            </div>
            <div className="box-border flex flex-col justify-between gap-3.5 rounded-[20px] border border-line p-[22px]">
              <Eyebrow>Weekly distance · 8 weeks</Eyebrow>
              <DotGrid
                grid={PREVIEW_BARS_PHONE}
                label="Weekly distance, last 8 weeks, sample data"
                className="w-full lg:hidden"
              />
              <DotGrid
                grid={PREVIEW_BARS_DESKTOP}
                label="Weekly distance, last 8 weeks, sample data"
                className="hidden w-full lg:grid"
              />
            </div>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="flex scroll-mt-6 flex-col gap-7">
        <Heading label="How it works" title="Three steps. Then it runs itself." />
        <ol className="m-0 flex list-none flex-col gap-8 p-0 lg:flex-row">
          {STEPS.map((s, i) => {
            const last = i === STEPS.length - 1;
            return (
              <li
                key={s.n}
                className={`flex min-w-0 flex-1 flex-col gap-2.5 border-t pt-[18px] ${last ? 'border-accent' : 'border-[#555]'}`}
              >
                <span
                  className={`font-dot text-[56px] leading-[0.9] font-black lg:text-[72px] ${last ? 'text-accent' : 'text-white'}`}
                >
                  {s.n}
                </span>
                <span className="font-dot text-2xl leading-[1.1] font-bold uppercase">{s.title}</span>
                <span className="text-[13px] leading-[1.7] text-[#b5b5b5]">{s.text}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* closing call to action */}
      <section className="box-border flex flex-col items-start justify-between gap-6 rounded-[28px] border border-line-strong bg-black p-7 lg:flex-row lg:items-center lg:p-12">
        <h2 className="m-0 font-dot text-[32px] leading-none font-black uppercase lg:text-[52px]">
          Ready to see
          <br />
          your training?
        </h2>
        <Cta onStart={onStart} onSignIn={onSignIn} secondary="Sign in" />
      </section>

      <footer className="flex flex-col gap-4 border-t border-dotted border-[#3a3a3a] pt-6 text-xs leading-[1.7] text-muted lg:flex-row lg:justify-between">
        <span className="max-w-[640px]">
          Your data stays yours. We only read your activities to build your dashboard. You can disconnect an account or delete
          everything at any time.
        </span>
      </footer>
    </div>
  );
}

/** The dots between source steps: across on desktop, down on phone. Decorative. */
function Arrow() {
  return (
    <>
      <DotGrid grid={ARROW_DOWN} className="w-3.5 flex-none lg:hidden" />
      <DotGrid grid={ARROW_ACROSS} className="hidden w-24 flex-none lg:grid" />
    </>
  );
}
