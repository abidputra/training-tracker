/**
 * App shell (single page), three views:
 *   metrics  -> Running, Strength and (when the account has them) Cycling, Swimming,
 *               Hiking metrics, chosen with the sport tabs; reached from the floating menu.
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
import { DISTANCE_SPORTS, sportsPresent } from './lib/sports.js';
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
import SportMetrics from './components/SportMetrics.jsx';
import StrengthMetrics from './components/StrengthMetrics.jsx';
import SyncButton, { LastSynced } from './components/SyncButton.jsx';
import TopBar from './components/TopBar.jsx';
import { Icon, SectionHead } from './components/ui.jsx';

// Always-on sport tabs on the metrics view. Distance sports (lib/sports.js) are added
// after these when the account has activities of that sport.
const SPORTS = [
  { key: 'running', label: 'Running', icon: 'run' },
  { key: 'strength', label: 'Strength', icon: 'strength' },
];

// Header pills per sport, in page order. Each id matches an element id on that page.
const DISTANCE_SECTIONS = [
  { id: 'glance', label: 'At a Glance' },
  { id: 'records', label: 'Personal Bests' },
  { id: 'trends', label: 'Trends' },
  { id: 'recent', label: 'Recent' },
];

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
  // Strength metrics are built from the full activity list (it carries the exercise summaries).
  // All activities are loaded up front: the Strength and sport tabs, and which of them exist, come from it.
  const history = useActivityHistory(userId, true);
  const sessions = useMemo(() => strengthSessions(history.items), [history.items]);
  const extraSports = useMemo(() => sportsPresent(history.items), [history.items]);
  const sportList = useMemo(() => [...SPORTS, ...extraSports], [extraSports]);
  // a tab that is gone (e.g. after disconnecting) falls back to Running
  const sportKey = sportList.some((s) => s.key === sport) ? sport : 'running';
  const sportDef = DISTANCE_SPORTS.find((d) => d.key === sportKey);
  const [notice, setNotice] = useState(null); // { type: 'info' | 'error', text }
  const [signingOut, setSigningOut] = useState(false);
  const clearNotice = useCallback(() => setNotice(null), []);

  const { reload: reloadHistory } = history;
  const refresh = useCallback(async () => {
    try {
      const jobs = [reloadActivities(), reload(), reloadDays()];
      jobs.push(reloadHistory());
      await Promise.all(jobs);
    } catch (e) {
      setNotice({ type: 'error', text: `Refresh failed: ${e.message}` });
    }
  }, [reloadActivities, reload, reloadDays, reloadHistory]);
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

  // sync button + profile menu: in the phone header and in the desktop top bar
  const controls = (
    <>
      <SyncButton syncing={syncing} onClick={sync} />
      <ProfileMenu
        username={profile?.username}
        email={session.user.email}
        signingOut={signingOut}
        onSettings={() => changeView('settings')}
        onSignOut={signOut}
      />
    </>
  );

  // desktop only: the big title above the running dashboard
  const hero = wide && sportKey === 'running' && (
    <div className="mb-14 hidden lg:block">
      <div className="mb-3 flex items-center gap-2.5 text-xs tracking-[0.14em] text-muted uppercase">
        <span className="h-2.5 w-2.5 rounded-full bg-accent" />
        <span>Live{lastSynced ? ' · all sources synced' : ''}</span>
      </div>
      <h1 className="m-0 font-dot text-[clamp(44px,8vw,112px)] leading-[0.92] font-black tracking-[0.02em] uppercase">
        Training Metrics
      </h1>
    </div>
  );

  const header = (
    <header className="mb-4 flex items-center justify-between gap-3 lg:hidden">
      <div className="min-w-0">
        <h1 className={`m-0 font-dot font-black tracking-[0.03em] uppercase ${view === 'history' ? 'text-[30px]' : 'text-2xl'}`}>
          {wide ? 'Training Metrics' : TITLES[view]}
        </h1>
        <LastSynced iso={lastSynced} className="mt-1" />
      </div>
      <div className="flex shrink-0 items-center gap-2">{controls}</div>
    </header>
  );

  const sportTabs = (
    <nav aria-label="Sport" className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:mb-8 lg:px-0">
      {sportList.map((s) => (
        <button
          key={s.key}
          onClick={() => setSport(s.key)}
          aria-current={sportKey === s.key ? 'page' : undefined}
          className={`flex items-center gap-2 ${sportKey === s.key ? 'pill-on' : 'pill'}`}
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
        {hero}
        <SectionNav key={sportKey} sections={SECTIONS[sportKey] ?? DISTANCE_SECTIONS} />
        {sportKey === 'running' ? (
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
        ) : sportKey === 'strength' ? (
          <StrengthMetrics
            sessions={sessions}
            loading={history.loading}
            error={history.error}
            onRetry={reloadHistory}
            onExercise={(name) => setSub({ exercise: name })}
          />
        ) : (
          <SportMetrics
            def={sportDef}
            items={history.items}
            loading={history.loading}
            error={history.error}
            onRetry={reloadHistory}
            onOpen={(a) => setSub({ activity: a, from: null })}
          />
        )}
      </>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-4 lg:max-w-[1280px] lg:px-6 lg:pb-16 lg:pt-4">
      <TopBar view={view} onChange={changeView} lastSynced={lastSynced} connections={connections}>
        {controls}
      </TopBar>

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
