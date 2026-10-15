/**
 * App shell (single page).
 *   signed out  -> AuthForm
 *   signed in   -> analysis Dashboard (live) + Connections card
 *
 * Also finishes the Strava OAuth round trip: Strava redirects back to
 * "/?code=...&scope=...&state=..."; we verify `state`, send the code to the
 * backend /strava/connect (which holds the client secret), and clean the URL.
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { STRAVA_ENABLED, garminApi } from './lib/api.js';
import { useSession } from './hooks/useSession.js';
import { useActivities } from './hooks/useActivities.js';
import { useConnections } from './hooks/useConnections.js';
import AuthForm from './components/AuthForm.jsx';
import Connections from './components/Connections.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function App() {
  const session = useSession();
  const userId = session?.user?.id;
  const { activities, loading } = useActivities(userId);
  const { connections, reload } = useConnections(userId);
  const [notice, setNotice] = useState(null); // { type: 'info' | 'error', text }
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
    <div className="mx-auto max-w-md px-4 pb-16 pt-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Training</h1>
        <button onClick={() => supabase.auth.signOut()} className="text-sm text-slate-400">
          Sign out
        </button>
      </header>

      {notice && (
        <div
          onClick={() => setNotice(null)}
          className={`mb-4 rounded-xl px-4 py-3 text-sm ${
            notice.type === 'error' ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="space-y-6">
        <Dashboard
          activities={activities}
          loading={loading}
          hasConnection={Object.keys(connections).length > 0}
        />
        <Connections connections={connections} onNotice={setNotice} onChanged={reload} />
      </div>
    </div>
  );
}
