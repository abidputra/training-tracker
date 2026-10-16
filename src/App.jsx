/**
 * App shell (single page).
 *   signed out  -> AuthForm
 *   signed in   -> analysis Dashboard (live) + Connections card
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
import { useConnections } from './hooks/useConnections.js';
import { usePullToRefresh } from './hooks/usePullToRefresh.js';
import AuthForm from './components/AuthForm.jsx';
import Connections from './components/Connections.jsx';
import Dashboard from './components/Dashboard.jsx';
import Snackbar from './components/Snackbar.jsx';
import Spinner from './components/Spinner.jsx';

export default function App() {
  const session = useSession();
  const userId = session?.user?.id;
  const { activities, loading, reload: reloadActivities } = useActivities(userId);
  const { connections, reload } = useConnections(userId);
  const [notice, setNotice] = useState(null); // { type: 'info' | 'error', text }
  const [signingOut, setSigningOut] = useState(false);
  const clearNotice = useCallback(() => setNotice(null), []);

  const refresh = useCallback(async () => {
    try {
      await Promise.all([reloadActivities(), reload()]);
    } catch (e) {
      setNotice({ type: 'error', text: `Refresh failed: ${e.message}` });
    }
  }, [reloadActivities, reload]);
  const { pull, refreshing, ready } = usePullToRefresh(refresh);
  const stravaHandled = useRef(false); // StrictMode runs effects twice in dev

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

  return (
    <div className="mx-auto max-w-md px-4 pb-24 pt-4">
      {/* pull-to-refresh indicator */}
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

      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Training Metrics</h1>
        <button
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true);
            await supabase.auth.signOut();
            setSigningOut(false);
          }}
          className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 ring-1 ring-slate-700 active:bg-slate-700 disabled:opacity-50"
        >
          {signingOut && <Spinner />}
          Sign out
        </button>
      </header>

      <div className="space-y-6">
        <Dashboard
          activities={activities}
          loading={loading}
          hasConnection={Object.keys(connections).length > 0}
        />
        <Connections connections={connections} onNotice={setNotice} onChanged={reload} />
      </div>

      <Snackbar notice={notice} onClose={clearNotice} />
    </div>
  );
}
