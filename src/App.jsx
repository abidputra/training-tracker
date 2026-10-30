/**
 * App shell (single page), three views:
 *   metrics  -> Running or Strength metrics (sport tabs), reached from the floating menu.
 *               Strength opens sub-pages in place: one exercise, or one workout.
 *   history  -> Activity History list, reached from the floating menu
 *   settings -> account settings + connections, reached from the profile icon
 *
 * Also finishes the Strava OAuth round trip: Strava redirects back to
 * "/?code=...&scope=...&state=..."; we verify `state`, send the code to the
 * backend /strava/connect (which holds the client secret), and clean the URL.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { applyAccent, cacheAccent, cachedAccent } from './lib/accent.js';
import { STRAVA_ENABLED, garminApi } from './lib/api.js';
import { strengthSessions } from './lib/strength.js';
import { useSession } from './hooks/useSession.js';
import { useActivities } from './hooks/useActivities.js';
import { useActivityHistory } from './hooks/useActivityHistory.js';
import { useConnections } from './hooks/useConnections.js';
import { useDailyMetrics } from './hooks/useDailyMetrics.js';
import { useProfile } from './hooks/useProfile.js';
import { useSyncAll } from './hooks/useSyncAll.js';
import { usePullToRefresh } from './hooks/usePullToRefresh.js';
import ActivityDetail from './components/ActivityDetail.jsx';
import ActivityHistory from './components/ActivityHistory.jsx';
import AuthForm from './components/AuthForm.jsx';
import Dashboard from './components/Dashboard.jsx';
import ExerciseDetail from './components/ExerciseDetail.jsx';
import FloatingMenu from './components/FloatingMenu.jsx';
import GlanceSection from './components/GlanceSection.jsx';
import ProfileMenu from './components/ProfileMenu.jsx';
import SectionNav from './components/SectionNav.jsx';
import Settings from './components/Settings.jsx';
import Snackbar from './components/Snackbar.jsx';
import Spinner from './components/Spinner.jsx';
import StrengthMetrics from './components/StrengthMetrics.jsx';
import SyncButton, { LastSynced } from './components/SyncButton.jsx';
import { Icon, SectionHead } from './components/ui.jsx';

// Sport tabs on the metrics view. Adding a sport = one entry here plus its page.
const SPORTS = [
  { key: 'running', label: 'Running', icon: 'run' },
  { key: 'strength', label: 'Strength', icon: 'strength' },
];

// Header pills per sport, in page order. Each id matches an element id on that page.
const SECTIONS = {
  running: [
    { id: 'glance', label: 'At a Glance' },
    { id: 'predictions', label: 'Race Predictions' },
    { id: 'paces', label: 'Training Paces' },
    { id: 'trends', label: 'Trends' },
    { id: 'dynamics', label: 'Running Dynamics' },
  ],
  strength: [
    { id: 'glance', label: 'At a Glance' },
    { id: 'records', label: 'Records' },
    { id: 'exercises', label: 'Exercises' },
    { id: 'trends', label: 'Trends' },
    { id: 'split', label: 'Muscle Split' },
  ],
};

const TITLES = { metrics: 'Training Metrics', history: 'Activity History' };

// "0.5.0" -> "0.5", "0.5.0-r1" -> "0.5r1", "0.5.1" -> "0.5.1"
const VERSION = __APP_VERSION__.replace(/\.0-r(\d+)$/, 'r$1').replace(/\.0$/, '');

export default function App() {
  const session = useSession();
  const userId = session?.user?.id;
  const [view, setView] = useState('metrics'); // 'metrics' | 'history' | 'settings'
  const { activities, loading, reload: reloadActivities } = useActivities(userId);
  const { connections, reload } = useConnections(userId);
  const { days, reload: reloadDays } = useDailyMetrics(userId);
  const { profile, reload: reloadProfile } = useProfile(userId);
  const [sport, setSport] = useState('running');
  const [sub, setSub] = useState(null); // strength sub-page: { exercise } | { activity, from }
  const strength = view === 'metrics' && sport === 'strength';
  // Strength metrics are built from the full activity list (it carries the exercise summaries).
  const history = useActivityHistory(userId, view === 'history' || strength);
  const sessions = useMemo(() => strengthSessions(history.items), [history.items]);
  const [notice, setNotice] = useState(null); // { type: 'info' | 'error', text }
  const [signingOut, setSigningOut] = useState(false);
  const clearNotice = useCallback(() => setNotice(null), []);

  const { reload: reloadHistory } = history;
  const refresh = useCallback(async () => {
    try {
      const jobs = [reloadActivities(), reload(), reloadDays()];
      if (view === 'history' || strength) jobs.push(reloadHistory());
      await Promise.all(jobs);
    } catch (e) {
      setNotice({ type: 'error', text: `Refresh failed: ${e.message}` });
    }
  }, [reloadActivities, reload, reloadDays, reloadHistory, view, strength]);
  const { pull, refreshing, ready } = usePullToRefresh(refresh);
  const { syncing, sync } = useSyncAll(connections, setNotice, refresh);
  // ISO timestamps sort as text, so the last one is the newest.
  const lastSynced = Object.values(connections).map((c) => c.last_synced_at).filter(Boolean).sort().pop();
  const stravaHandled = useRef(false); // StrictMode runs effects twice in dev

  // Accent colour belongs to the signed-in user: their cached choice on the first
  // paint, then whatever their profile says; the default when signed out.
  useEffect(() => {
    applyAccent(cachedAccent(userId));
  }, [userId]);
  const profileAccent = profile?.accent;
  useEffect(() => {
    if (!userId || profileAccent === undefined) return;
    applyAccent(profileAccent);
    if (profileAccent) cacheAccent(userId, profileAccent);
  }, [userId, profileAccent]);

  // every page change starts at the top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, sport, sub]);

  const changeView = (v) => {
    setSub(null);
    setView(v);
  };

  const signOut = async () => {
    setSigningOut(true);
    setView('metrics');
    await supabase.auth.signOut();
    setSigningOut(false);
  };

  // --- Strava OAuth return -----------------------------------------------------
  useEffect(() => {
    if (!STRAVA_ENABLED || !session || stravaHandled.current) return;
    const q = new URLSearchParams(window.location.search);
    const code = q.get('code');
    const state = q.get('state');
    if (!state || !(code || q.get('error'))) return;

    stravaHandled.current = true;
    window.history.replaceState({}, '', window.location.pathname); // drop code from the URL

    const expected = sessionStorage.getItem('strava_oauth_state');
    sessionStorage.removeItem('strava_oauth_state');
    if (!expected || state !== expected) {
      setNotice({ type: 'error', text: 'Strava login could not be verified. Please try again.' });
      return;
    }
    if (!code) {
      setNotice({ type: 'error', text: 'Strava connection was cancelled.' });
      return;
    }

    garminApi('/strava/connect', { body: { code, scope: q.get('scope') ?? '' } })
      .then((res) => {
        setNotice({
          type: 'info',
          text: `Strava connected, ${res.imported} activities imported. Older history is importing in the background.`,
        });
        reload();
      })
      .catch((e) => setNotice({ type: 'error', text: e.message }));
  }, [session, reload]);

  if (session === undefined) return null; // still restoring the session
  if (!session) return <AuthForm />;

  const inSettings = view === 'settings';
  const wide = view === 'metrics' && !sub; // desktop: the full-width dashboard

  const header = (
    <header className="mb-4 flex items-center justify-between gap-3 lg:mb-14 lg:flex-wrap lg:items-end lg:gap-6">
      <div className="min-w-0">
        {wide && (
          <div className="mb-3 hidden items-center gap-2.5 text-xs tracking-[0.14em] text-muted uppercase lg:flex">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            <span>Live{lastSynced ? ' · all sources synced' : ''}</span>
          </div>
        )}
        <h1
          className={`m-0 font-dot font-black tracking-[0.03em] uppercase ${
            view === 'history' ? 'text-[30px]' : 'text-2xl'
          } ${wide ? 'lg:text-[clamp(44px,8vw,112px)] lg:leading-[0.92]' : ''}`}
        >
          {wide ? (
            <>
              <span className="lg:hidden">Training Metrics</span>
              <span className="hidden lg:inline">
                All-in-One
                <br />
                Training Tracker
              </span>
            </>
          ) : (
            TITLES[view]
          )}
        </h1>
        <LastSynced iso={lastSynced} className="mt-1 lg:hidden" />
      </div>
      <div className="flex shrink-0 items-center gap-2 lg:gap-3">
        <LastSynced iso={lastSynced} className="hidden tracking-[0.12em] uppercase lg:block" />
        <SyncButton syncing={syncing} onClick={sync} />
        <ProfileMenu
          username={profile?.username}
          email={session.user.email}
          signingOut={signingOut}
          onSettings={() => changeView('settings')}
          onSignOut={signOut}
        />
      </div>
    </header>
  );

  const sportTabs = (
    <nav aria-label="Sport" className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:mb-8 lg:px-0">
      {SPORTS.map((s) => (
        <button
          key={s.key}
          onClick={() => setSport(s.key)}
          aria-current={sport === s.key ? 'page' : undefined}
          className={`flex items-center gap-2 ${sport === s.key ? 'pill-on' : 'pill'}`}
        >
          <Icon name={s.icon} />
          {s.label}
        </button>
      ))}
    </nav>
  );

  let metrics;
  if (sub?.exercise) {
    metrics = (
      <ExerciseDetail
        name={sub.exercise}
        sessions={sessions}
        onBack={() => setSub(null)}
        onOpenActivity={(a) => setSub({ activity: a, from: sub })}
      />
    );
  } else if (sub?.activity) {
    metrics = <ActivityDetail activity={sub.activity} onBack={() => setSub(sub.from ?? null)} />;
  } else {
    metrics = (
      <>
        {sportTabs}
        <SectionNav key={sport} sections={SECTIONS[sport]} />
        {sport === 'running' ? (
          <div className="flex flex-col gap-8 lg:gap-14">
            <section id="glance" className="scroll-mt-[calc(var(--top-inset)+4rem)]">
              <SectionHead n="01" title="At a Glance" />
              <GlanceSection activities={activities} days={days} />
            </section>
            <Dashboard
              activities={activities}
              days={days}
              loading={loading}
              hasConnection={Object.keys(connections).length > 0}
            />
          </div>
        ) : (
          <StrengthMetrics
            sessions={sessions}
            loading={history.loading}
            error={history.error}
            onRetry={reloadHistory}
            onExercise={(name) => setSub({ exercise: name })}
          />
        )}
      </>
    );
  }

  return (
    <div className={`mx-auto px-4 pb-28 pt-4 ${wide ? 'max-w-md lg:max-w-[1280px] lg:px-6 lg:pt-10' : view === 'history' ? 'max-w-md lg:max-w-4xl' : 'max-w-md'}`}>
      {/* pull-to-refresh indicator */}
      {!inSettings && (
        <div
          className="flex items-end justify-center overflow-hidden text-muted transition-[height] duration-150"
          style={{ height: pull }}
        >
          <div className="flex items-center gap-2 pb-2 text-xs">
            {refreshing ? (
              <>
                <Spinner /> Refreshing…
              </>
            ) : (
              <span>{ready ? 'Release to refresh' : 'Pull to refresh'}</span>
            )}
          </div>
        </div>
      )}

      {inSettings ? (
        <Settings
          session={session}
          profile={profile}
          connections={connections}
          onBack={() => changeView('metrics')}
          onNotice={setNotice}
          onProfileChanged={reloadProfile}
          onConnectionsChanged={reload}
        />
      ) : (
        <>
          {header}
          {view === 'metrics' && metrics}
          {view === 'history' && (
            <ActivityHistory
              items={history.items}
              loading={history.loading}
              error={history.error}
              onRetry={reloadHistory}
            />
          )}
        </>
      )}

      {!inSettings && <FloatingMenu view={view} onChange={changeView} />}

      <footer className="mt-10 text-center text-xs text-[#777] lg:tracking-[0.12em] lg:uppercase">
        AIO Training Tracker · v{VERSION}
      </footer>

      <Snackbar notice={notice} onClose={clearNotice} />
    </div>
  );
}
