/**
 * strava-webhook  |  public endpoint (deployed with verify_jwt = false)
 *
 * Strava calls this server-to-server:
 *
 *   GET   subscription handshake. Echo `hub.challenge` if `hub.verify_token`
 *         matches STRAVA_VERIFY_TOKEN.
 *   POST  event notification. Strava needs a 200 within 2 seconds, so we
 *         answer immediately and process in the background (waitUntil).
 *
 * Event payload (no metrics, only pointers!):
 *   { object_type: "activity"|"athlete", object_id, aspect_type:
 *     "create"|"update"|"delete", owner_id, subscription_id, updates }
 *
 * Handled:
 *   activity create/update  -> fetch full activity with the owner's token, upsert
 *   activity delete         -> delete local row
 *   athlete  deauthorized   -> wipe connection + data (required by Strava terms)
 *
 * Security: Strava does not sign webhooks. We (1) guard the handshake with a
 * verify token and (2) reject events whose subscription_id differs from
 * STRAVA_SUBSCRIPTION_ID (set it after creating the subscription).
 * Every event is also re-fetched from Strava with the user's own token, so a
 * forged event can't inject data, at worst it triggers a harmless re-fetch.
 */
import { admin } from "../_shared/supabase.ts";
import {
  fetchActivity,
  getAccessToken,
  mapActivity,
  removeStravaConnection,
  upsertActivities,
} from "../_shared/strava.ts";

// Provided by the Supabase Edge runtime.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

interface StravaEvent {
  object_type: "activity" | "athlete";
  object_id: number;
  aspect_type: "create" | "update" | "delete";
  owner_id: number;
  subscription_id: number;
  updates?: Record<string, string>;
}

/** Processes one event. Never throws (errors are logged). */
async function handleEvent(ev: StravaEvent): Promise<void> {
  try {
    // owner_id is the STRAVA athlete id -> map to our user via connections.
    const { data: conn } = await admin
      .from("connections")
      .select("id, user_id")
      .eq("provider", "strava")
      .eq("external_id", String(ev.owner_id))
      .maybeSingle();
    if (!conn) return; // unknown or already disconnected athlete

    if (ev.object_type === "athlete") {
      if (ev.updates?.authorized === "false") {
        await removeStravaConnection(conn.id, conn.user_id);
      }
      return;
    }
    if (ev.object_type !== "activity") return;

    const deleteLocal = () =>
      admin.from("activities").delete()
        .eq("user_id", conn.user_id)
        .eq("provider", "strava")
        .eq("external_id", String(ev.object_id));

    if (ev.aspect_type === "delete") {
      await deleteLocal();
      return;
    }

    // create / update: the payload only has an id, so fetch the real data.
    const token = await getAccessToken(conn.id);
    const res = await fetchActivity(token, ev.object_id);

    // 404/403 happens when an activity was made private (and we only have
    // activity:read) or deleted before we got to it. Drop our copy.
    if (res.status === 404 || res.status === 403) {
      await deleteLocal();
      return;
    }
    if (!res.ok) throw new Error(`Strava activity fetch failed (${res.status})`);

    await upsertActivities([mapActivity(conn.user_id, await res.json())]);
    await admin.from("connections")
      .update({ last_synced_at: new Date().toISOString(), last_error: null })
      .eq("id", conn.id);
  } catch (e) {
    console.error("webhook event failed:", (e as Error).message, ev);
  }
}

Deno.serve(async (req) => {
  // --- 1. Subscription handshake -------------------------------------------
  if (req.method === "GET") {
    const q = new URL(req.url).searchParams;
    const expected = Deno.env.get("STRAVA_VERIFY_TOKEN");
    if (
      expected && q.get("hub.mode") === "subscribe" &&
      q.get("hub.verify_token") === expected
    ) {
      return new Response(
        JSON.stringify({ "hub.challenge": q.get("hub.challenge") }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("Forbidden", { status: 403 });
  }

  // --- 2. Event notification -----------------------------------------------
  if (req.method === "POST") {
    let ev: StravaEvent;
    try {
      ev = await req.json();
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    const subId = Deno.env.get("STRAVA_SUBSCRIPTION_ID");
    if (subId && String(ev.subscription_id) !== subId) {
      return new Response("Forbidden", { status: 403 });
    }

    // Reply fast, work in the background.
    EdgeRuntime.waitUntil(handleEvent(ev));
    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  return new Response("Method Not Allowed", { status: 405 });
});
