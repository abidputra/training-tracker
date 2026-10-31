/**
 * Calls to our own backends, all authenticated with the user's Supabase JWT:
 *   - Supabase Edge Functions (Strava connect/disconnect)
 *   - Garmin service (connect, MFA, sync, disconnect)
 */
import { supabase } from './supabase.js';

// Strava is built but switched off. Set VITE_ENABLE_STRAVA=true to show it again.
export const STRAVA_ENABLED = import.meta.env.VITE_ENABLE_STRAVA === 'true';

/**
 * First-party connections the header "Sync" button covers, one entry each. To
 * include a new connection later, add it here (its endpoint must answer like
 * /garmin/sync: { status, imported, error }).
 */
export const SYNC_PROVIDERS = [
  { key: 'garmin', label: 'Garmin', path: '/garmin/sync' },
  ...(STRAVA_ENABLED ? [{ key: 'strava', label: 'Strava', path: '/strava/sync' }] : []),
];

// Where the backend lives. UNSET falls back to the local service, so a deploy
// that forgot the variable still reaches the laptop instead of 404-ing on its
// own host. Set it to an https URL once the backend is hosted; an explicit
// empty string means "same origin".
const GARMIN_URL = (import.meta.env.VITE_GARMIN_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(GARMIN_URL);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Free hosting puts the service to sleep when idle, and waking takes up to a
 * minute. While it boots, the host answers without CORS headers, so the browser
 * reports a plain network error ("could not reach"). Poll /health, which only
 * succeeds once the real service is up, then the caller retries.
 */
async function wakeService() {
  const until = Date.now() + 75_000;
  while (Date.now() < until) {
    try {
      const res = await fetch(`${GARMIN_URL}/health`, { cache: 'no-store' });
      if (res.ok) return true;
    } catch {
      /* still starting */
    }
    await wait(3000);
  }
  return false;
}

/** Garmin service call. Throws Error(message) with the server's `detail` on failure. */
export async function garminApi(path, { method = 'POST', body } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('You are signed out. Please sign in again.');

  const send = () =>
    fetch(`${GARMIN_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });

  let res;
  try {
    res = await send();
  } catch {
    if (LOCAL) throw new Error('Could not reach the Garmin service on localhost:8000. Is it running?');
    // A pending MFA login lives in the service's memory, so a restart loses it: never retry that call.
    const woke = await wakeService();
    if (!woke || path === '/garmin/mfa') {
      throw new Error(
        woke
          ? 'The Garmin service restarted. Please start the connection again.'
          : 'The Garmin service is not responding. It sleeps when idle and can take a minute to start, try again shortly.',
      );
    }
    try {
      res = await send();
    } catch {
      throw new Error('Could not reach the Garmin service.');
    }
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || json.error || `Request failed (${res.status})`);
  return json;
}

/** Edge Function call (supabase-js attaches the JWT). Unwraps the JSON error message. */
export async function edgeFn(name, body = {}) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    try {
      const payload = await error.context.json();
      if (payload?.error) message = payload.error;
    } catch {
      /* keep generic message */
    }
    throw new Error(message);
  }
  return data;
}

/**
 * Starts Strava OAuth. A random `state` is kept in sessionStorage and checked
 * on return (CSRF protection). We ask for activity:read_all so private
 * activities are included.
 */
export function startStravaOAuth() {
  const state = crypto.randomUUID();
  sessionStorage.setItem('strava_oauth_state', state);
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_STRAVA_CLIENT_ID,
    redirect_uri: window.location.origin,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
    state,
  });
  window.location.href = `https://www.strava.com/oauth/authorize?${params}`;
}
