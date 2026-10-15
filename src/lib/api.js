/**
 * Calls to our own backends, all authenticated with the user's Supabase JWT:
 *   - Supabase Edge Functions (Strava connect/disconnect)
 *   - Garmin service (connect, MFA, sync, disconnect)
 */
import { supabase } from './supabase.js';

const GARMIN_URL = (import.meta.env.VITE_GARMIN_API_URL ?? '').replace(/\/$/, '');

/** Garmin service call. Throws Error(message) with the server's `detail` on failure. */
export async function garminApi(path, { method = 'POST', body } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('You are signed out. Please sign in again.');

  let res;
  try {
    res = await fetch(`${GARMIN_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Could not reach the Garmin service.');
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
