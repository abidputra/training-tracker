/**
 * App shell (single page), three views:
 *   metrics  -> analysis Dashboard (live), reached from the floating menu
 *   history  -> Activity History list, reached from the floating menu
 *   settings -> account settings + connections, reached from the profile icon
 *
 * Also finishes the Strava OAuth round trip: Strava redirects back to
 * "/?code=...&scope=...&state=..."; we verify `state`, send the code to the
 * backend /strava/connect (which holds the client secret), and clean the URL.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { STRAVA_ENABLED, garminApi } from './lib/api.js';
import { useSession } from './hooks/useSession.js';
import { useActivities } from './hooks/useActivities.js';
import { useActivityHistory } from './hooks/useActivityHistory.js';
import { useConnections } from './hooks/useConnections.js';
import { useDailyMetrics } from './hooks/useDailyMetrics.js';
import { useProfile } from './hooks/useProfile.js';
import { usePullToRefresh } from './hooks/usePullToRefresh.js';
import ActivityHistory from './components/ActivityHistory.jsx';
import AuthForm from './components/AuthForm.jsx';
import Dashboard from './components/Dashboard.jsx';
import FloatingMenu from './components/FloatingMenu.jsx';
import GlanceSection from './components/GlanceSection.jsx';
import ProfileMenu from './components/ProfileMenu.jsx';
import SectionNav from './components/SectionNav.jsx';
import Settings from './components/Settings.jsx';
import Snackbar from './components/Snackbar.jsx';
import Spinner from './components/Spinner.jsx';

// Header pills, in page order. Each id matches an element id on the metrics page.
const SECTIONS = [
  { id: 'glance', label: 'At a Glance' },
  { id: 'predictions', label: 'Race Predictions' },
  { id: 'paces', label: 'Training Paces' },
  { id: 'trends', label: 'Trends' },
  { id: 'dynamics', label: 'Running Dynamics' },
];

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
  const history = useActivityHistory(userId, view === 'history');
  const [notice, setNotice] = useState(null); // { type: 'info' | 'error', text }
  const [signingOut, setSigningOut] = useState(false);
  const clearNotice = useCallback(() => setNotice(null), []);

  const { reload: reloadHistory } = history;
  const refresh = useCallback(async () => {
    try {
      const jobs = [reloadActivities(), reload(), reloadDays()];
      if (view === 'history') jobs.push(reloadHistory());
      await Promise.all(jobs);
    } catch (e) {
      setNotice({ type: 'error', text: `Refresh failed: ${e.message}` });
    }
  }, [reloadActivities, reload, reloadDays, reloadHistory, view]);
  const { pull, refreshing, ready } = usePullToRefresh(refresh);
  const stravaHandled = useRef(false); // StrictMode runs effects twice in dev

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

  return (
    <div className="mx-auto max-w-md px-4 pb-24 pt-4">
      {/* pull-to-refresh indicator */}
      {!inSettings && (
        <div
          className="flex items-end justify-center overflow-hidden text-slate-400 transition-[height] duration-150"
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
          onBack={() => setView('metrics')}
          onNotice={setNotice}
          onProfileChanged={reloadProfile}
          onConnectionsChanged={reload}
        />
      ) : (
        <>
          <header className="mb-2 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-white">{TITLES[view]}</h1>
            <ProfileMenu
              username={profile?.username}
              email={session.user.email}
              signingOut={signingOut}
              onSettings={() => setView('settings')}
              onSignOut={signOut}
            />
          </header>

          {view === 'metrics' && (
            <>
              <SectionNav sections={SECTIONS} />
              <div className="space-y-6">
                <section id="glance" className="scroll-mt-[calc(var(--top-inset)+3.5rem)]">
                  <h2 className="mb-2 text-sm font-medium text-slate-300">At a Glance</h2>
                  <GlanceSection activities={activities} days={days} />
                </section>
                <Dashboard
                  activities={activities}
                  days={days}
                  loading={loading}
                  hasConnection={Object.keys(connections).length > 0}
                />
              </div>
            </>
          )}

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

      {!inSettings && <FloatingMenu view={view} onChange={setView} />}

      <footer className="mt-10 text-center text-[11px] text-slate-600">Training Tracker · v{VERSION}</footer>

      <Snackbar notice={notice} onClose={clearNotice} />
    </div>
  );
}
