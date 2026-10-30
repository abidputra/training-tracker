/**
 * Provider connections card: Garmin (+ Strava when VITE_ENABLE_STRAVA=true).
 * Statuses come from the live `connections` table:
 *   (no row)       -> not connected
 *   active         -> connected
 *   needs_reauth   -> session expired, user must reconnect
 *   error          -> temporary sync problem (retries automatically)
 */
import { useState } from 'react';
import { STRAVA_ENABLED, garminApi, startStravaOAuth } from '../lib/api.js';
import { timeAgo } from '../lib/format.js';
import GarminForm from './GarminForm.jsx';
import Spinner from './Spinner.jsx';

function Badge({ conn }) {
  if (!conn) return <span className="text-slate-500">Not connected</span>;
  if (conn.status === 'needs_reauth') return <span className="text-amber-400">Needs reconnect</span>;
  if (conn.status === 'error') return <span className="text-amber-400">Sync issue, retrying</span>;
  return <span className="text-emerald-400">Connected · synced {timeAgo(conn.last_synced_at)}</span>;
}

const btn = 'flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 disabled:opacity-50';
const btnPrimary = 'flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-slate-950 disabled:opacity-50';

/** Label with a spinner in front while `loading`. */
const Busy = ({ loading, children }) => (
  <>
    {loading && <Spinner />}
    {children}
  </>
);

export default function Connections({ connections, onNotice, onChanged }) {
  const [showGarmin, setShowGarmin] = useState(false);
  const [busy, setBusy] = useState(null); // 'garmin-all' | 'garmin-off' | 'strava-all' | 'strava-off'
  const strava = connections.strava;
  const garmin = connections.garmin;
  const garminNeedsLogin = !garmin || garmin.status === 'needs_reauth';

  async function run(key, fn, okText) {
    setBusy(key);
    try {
      await fn();
      if (okText) onNotice({ type: 'info', text: okText });
      onChanged();
    } catch (e) {
      onNotice({ type: 'error', text: e.message });
    } finally {
      setBusy(null);
    }
  }

  const confirmDisconnect = (name) =>
    window.confirm(`Disconnect ${name}? Its imported activities will be deleted from this app.`);

  return (
    <section className="rounded-2xl bg-slate-900 p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">Connections</h2>

      {/* Strava (hidden unless VITE_ENABLE_STRAVA=true) */}
      {STRAVA_ENABLED && (
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="font-medium text-white">Strava</div>
          <div className="text-xs"><Badge conn={strava} /></div>
        </div>
        {!strava || strava.status === 'needs_reauth' ? (
          <button onClick={startStravaOAuth} className={btnPrimary}>
            {strava ? 'Reconnect' : 'Connect'}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              disabled={!!busy}
              className={btn}
              title="Imports your entire Strava history in the background"
              onClick={() => run(
                'strava-all',
                () => garminApi('/strava/backfill'),
                'Importing your Strava history. Runs appear as they arrive, this can take a few minutes.',
              )}
            >
              <Busy loading={busy === 'strava-all'}>{busy === 'strava-all' ? 'Starting…' : 'Import all'}</Busy>
            </button>
            <button
              disabled={!!busy}
              className={btn}
              onClick={() => confirmDisconnect('Strava') &&
                run('strava-off', () => garminApi('/strava/disconnect', { method: 'DELETE' }), 'Strava disconnected.')}
            >
              <Busy loading={busy === 'strava-off'}>{busy === 'strava-off' ? 'Disconnecting…' : 'Disconnect'}</Busy>
            </button>
          </div>
        )}
      </div>
      )}

      {/* Garmin */}
      <div className={STRAVA_ENABLED ? 'pt-3' : ''}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium text-white">Garmin</div>
            <div className="text-xs"><Badge conn={garmin} /></div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {garminNeedsLogin ? (
              !showGarmin && (
                <button onClick={() => setShowGarmin(true)} className={btnPrimary}>
                  {garmin ? 'Log in again' : 'Connect'}
                </button>
              )
            ) : (
              <>
                <button
                  disabled={!!busy}
                  className={btn}
                  title="Imports your entire Garmin history in the background"
                  onClick={() => run(
                    'garmin-all',
                    () => garminApi('/garmin/backfill'),
                    'Importing your full history. Runs appear here as they arrive, this can take a few minutes.',
                  )}
                >
                  <Busy loading={busy === 'garmin-all'}>{busy === 'garmin-all' ? 'Starting…' : 'Import all'}</Busy>
                </button>
                <button
                  disabled={!!busy}
                  className={btn}
                  onClick={() => confirmDisconnect('Garmin') &&
                    run('garmin-off', () => garminApi('/garmin/disconnect', { method: 'DELETE' }), 'Garmin disconnected.')}
                >
                  <Busy loading={busy === 'garmin-off'}>{busy === 'garmin-off' ? 'Disconnecting…' : 'Disconnect'}</Busy>
                </button>
              </>
            )}
          </div>
        </div>

        {showGarmin && garminNeedsLogin && (
          <GarminForm
            onCancel={() => setShowGarmin(false)}
            onDone={(text) => {
              setShowGarmin(false);
              onNotice({ type: 'info', text });
              onChanged();
            }}
          />
        )}
      </div>
    </section>
  );
}
