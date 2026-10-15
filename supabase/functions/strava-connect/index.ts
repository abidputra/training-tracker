/**
 * strava-connect  |  POST { code, scope }  (JWT required)
 *
 * Finishes the Strava OAuth flow for the signed-in user:
 *   1. Browser sends the `code` (+ granted `scope`) from Strava's redirect.
 *   2. We exchange it for tokens using the client secret (never in the browser).
 *   3. Store the connection + tokens, then import the 50 most recent activities.
 *
 * Responses
 *   200 { ok, athlete_id, imported }
 *   400 bad input / missing activity scope
 *   409 this Strava account is already linked to another user
 */
import { corsHeaders, json } from "../_shared/cors.ts";
import { admin, getUserFromRequest } from "../_shared/supabase.ts";
import {
  exchangeCode,
  listRecentActivities,
  mapActivity,
  upsertActivities,
} from "../_shared/strava.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await getUserFromRequest(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  let body: { code?: string; scope?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body.code) return json({ error: "Missing code" }, 400);

  // The athlete can untick permissions on Strava's consent screen. Without an
  // activity scope we'd connect successfully but never see a single workout.
  const scopes = (body.scope ?? "").split(",");
  if (!scopes.includes("activity:read") && !scopes.includes("activity:read_all")) {
    return json({
      error: "Strava access to activities was not granted. Please reconnect " +
        "and keep the 'View data about your activities' box ticked.",
    }, 400);
  }

  try {
    const tokens = await exchangeCode(body.code);
    const athleteId = tokens.athlete?.id;
    if (!athleteId) throw new Error("Strava did not return an athlete id");

    // Upsert on (user_id, provider). The (provider, external_id) unique
    // constraint rejects an athlete already linked to a different user.
    const { data: conn, error: connErr } = await admin
      .from("connections")
      .upsert({
        user_id: user.id,
        provider: "strava",
        external_id: String(athleteId),
        status: "active",
        last_error: null,
      }, { onConflict: "user_id,provider" })
      .select("id")
      .single();

    if (connErr) {
      if (connErr.code === "23505") {
        return json({
          error: "This Strava account is already linked to another user.",
        }, 409);
      }
      throw new Error(connErr.message);
    }

    const { error: tokErr } = await admin.from("provider_tokens").upsert({
      connection_id: conn.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(tokens.expires_at * 1000).toISOString(),
    }, { onConflict: "connection_id" });
    if (tokErr) throw new Error(tokErr.message);

    // First import. Later activities arrive through the webhook.
    const recent = await listRecentActivities(tokens.access_token, 50);
    await upsertActivities(recent.map((a) => mapActivity(user.id, a)));
    await admin.from("connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", conn.id);

    return json({ ok: true, athlete_id: athleteId, imported: recent.length });
  } catch (e) {
    console.error("strava-connect failed:", (e as Error).message);
    return json({ error: "Could not connect Strava. Please try again." }, 500);
  }
});
