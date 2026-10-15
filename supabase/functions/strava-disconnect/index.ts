/**
 * strava-disconnect  |  POST {}  (JWT required)
 *
 * Revokes our Strava access (best effort), then deletes the user's Strava
 * connection, tokens and imported activities.
 */
import { corsHeaders, json } from "../_shared/cors.ts";
import { admin, getUserFromRequest } from "../_shared/supabase.ts";
import {
  deauthorize,
  getAccessToken,
  removeStravaConnection,
} from "../_shared/strava.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await getUserFromRequest(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data: conn } = await admin
    .from("connections")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "strava")
    .maybeSingle();
  if (!conn) return json({ ok: true }); // already disconnected

  // Best effort: even if revoking fails (token already dead), we still wipe
  // local data so the user is never stuck "connected".
  try {
    await deauthorize(await getAccessToken(conn.id));
  } catch (e) {
    console.warn("strava deauthorize skipped:", (e as Error).message);
  }

  await removeStravaConnection(conn.id, user.id);
  return json({ ok: true });
});
