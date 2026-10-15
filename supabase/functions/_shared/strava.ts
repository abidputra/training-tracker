/**
 * Shared Strava helpers: OAuth code exchange, token refresh, API calls and
 * row mapping. Used by strava-connect, strava-disconnect and strava-webhook.
 *
 * Strava base URLs are env-overridable because Strava announced a new API
 * host (https://api-v3.strava.com) for 2027. Switch with STRAVA_API_BASE
 * without touching code.
 */
import { admin } from "./supabase.ts";

const API_BASE = Deno.env.get("STRAVA_API_BASE") ??
  "https://www.strava.com/api/v3";
const OAUTH_BASE = Deno.env.get("STRAVA_OAUTH_BASE") ??
  "https://www.strava.com/oauth";
const CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET") ?? "";

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  /** Unix epoch seconds. */
  expires_at: number;
  athlete?: { id: number; firstname?: string; lastname?: string };
}

// deno-lint-ignore no-explicit-any
type StravaActivity = Record<string, any>;

/** POST to Strava's token endpoint (form-encoded, as Strava requires). */
function tokenRequest(params: Record<string, string>): Promise<Response> {
  return fetch(`${OAUTH_BASE}/token`, {
    method: "POST",
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      ...params,
    }),
  });
}

/** Exchanges the `code` from the OAuth redirect for tokens + athlete info. */
export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await tokenRequest({ code, grant_type: "authorization_code" });
  if (!res.ok) throw new Error(`Strava code exchange failed (${res.status})`);
  return await res.json();
}

/**
 * Returns a valid access token for a connection, refreshing it when it expires
 * within 5 minutes. Strava ROTATES refresh tokens, so the new refresh token is
 * always persisted. If the refresh is rejected the connection is flagged
 * `needs_reauth` so the UI can ask the user to reconnect.
 */
export async function getAccessToken(connectionId: string): Promise<string> {
  const { data, error } = await admin
    .from("provider_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("connection_id", connectionId)
    .single();
  if (error || !data) throw new Error("No Strava tokens stored");

  const msLeft = new Date(data.expires_at).getTime() - Date.now();
  if (msLeft > 5 * 60_000) return data.access_token;

  const res = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: data.refresh_token,
  });
  if (!res.ok) {
    if (res.status === 400 || res.status === 401) {
      await admin.from("connections").update({
        status: "needs_reauth",
        last_error: "Strava authorization expired or revoked",
      }).eq("id", connectionId);
    }
    throw new Error(`Strava token refresh failed (${res.status})`);
  }
  const t: TokenResponse = await res.json();
  await admin.from("provider_tokens").update({
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: new Date(t.expires_at * 1000).toISOString(),
  }).eq("connection_id", connectionId);
  return t.access_token;
}

/** Authenticated GET against the Strava API. Throws on rate limit (429). */
export async function stravaGet(path: string, accessToken: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 429) throw new Error("Strava rate limit hit (429)");
  return res;
}

/** Full detail for a single activity (includes calories). */
export function fetchActivity(accessToken: string, id: number | string) {
  return stravaGet(`/activities/${id}`, accessToken);
}

/** Most recent activities (summary representation). Used for the first import. */
export async function listRecentActivities(
  accessToken: string,
  perPage = 50,
): Promise<StravaActivity[]> {
  const res = await stravaGet(
    `/athlete/activities?per_page=${perPage}&page=1`,
    accessToken,
  );
  if (!res.ok) throw new Error(`Strava activity list failed (${res.status})`);
  return await res.json();
}

/** Maps a Strava activity to our normalized `activities` row. */
export function mapActivity(userId: string, a: StravaActivity) {
  return {
    user_id: userId,
    provider: "strava",
    external_id: String(a.id),
    name: a.name ?? null,
    sport_type: a.sport_type ?? a.type ?? null,
    start_time: a.start_date,
    distance_m: a.distance ?? null,
    moving_time_s: a.moving_time ?? null,
    elapsed_time_s: a.elapsed_time ?? null,
    elevation_gain_m: a.total_elevation_gain ?? null,
    avg_hr: a.average_heartrate ?? null,
    max_hr: a.max_heartrate ?? null,
    avg_speed_mps: a.average_speed ?? null,
    calories: a.calories ?? null,
    raw: a,
    updated_at: new Date().toISOString(),
  };
}

/** Idempotent insert/update keyed on (user_id, provider, external_id). */
export async function upsertActivities(
  rows: ReturnType<typeof mapActivity>[],
) {
  if (rows.length === 0) return;
  const { error } = await admin
    .from("activities")
    .upsert(rows, { onConflict: "user_id,provider,external_id" });
  if (error) throw new Error(`Upsert failed: ${error.message}`);
}

/**
 * Removes a Strava connection and all Strava data for that user.
 * Strava's API terms require deleting an athlete's data once they deauthorize,
 * so this runs on both user-initiated disconnect and the deauthorize webhook.
 * provider_tokens rows go away via ON DELETE CASCADE.
 */
export async function removeStravaConnection(
  connectionId: string,
  userId: string,
) {
  await admin.from("activities").delete()
    .eq("user_id", userId).eq("provider", "strava");
  await admin.from("connections").delete().eq("id", connectionId);
}

/** Tells Strava to revoke our access (used on user-initiated disconnect). */
export function deauthorize(accessToken: string) {
  return fetch(`${OAUTH_BASE}/deauthorize`, {
    method: "POST",
    body: new URLSearchParams({ access_token: accessToken }),
  });
}
