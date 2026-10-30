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
  let dot = 'bg-accent';
  let text = `Connected · synced ${timeAgo(conn?.last_synced_at)}`;
  if (!conn) [dot, text] = ['bg-line-strong', 'Not connected'];
  else if (conn.status === 'needs_reauth') [dot, text] = ['bg-white', 'Needs reconnect'];
  else if (conn.status === 'error') [dot, text] = ['bg-white', 'Sync issue, retrying'];
  return (
    <span className="flex items-center gap-2 text-xs">
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      {text}
    </span>
  );
}

/** Provider name and status on one line. */
const Header = ({ name, conn }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="font-dot text-[26px] font-black">{name}</div>
    <Badge conn={conn} />
  </div>
);

const btn = 'btn';
const btnPrimary = 'btn-primary';
const btnDanger = 'btn border-accent text-accent'; // disconnect: outlined, destructive

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
    <section className="flex flex-col gap-3.5">
      <h2 className="eyebrow m-0 font-normal">Connections</h2>
      <div className="card flex flex-col p-5">

      {/* Strava (hidden unless VITE_ENABLE_STRAVA=true) */}
      {STRAVA_ENABLED && (
      <div className="rule flex flex-col gap-4 pb-5">
        <Header name="Strava" conn={strava} />
        {!strava || strava.status === 'needs_reauth' ? (
          <button onClick={startStravaOAuth} className={btnPrimary}>
            {strava ? 'Reconnect' : 'Connect'}
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
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
              className={btnDanger}
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
      <div className={STRAVA_ENABLED ? 'pt-5' : ''}>
        <div className="flex flex-col gap-4">
          <Header name="Garmin" conn={garmin} />
          <div className="flex flex-wrap gap-2">
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
                  className={btnDanger}
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
      </div>
    </section>
  );
}
