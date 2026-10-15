/**
 * CORS helpers for functions called from the browser (strava-connect,
 * strava-disconnect). Set ALLOWED_ORIGIN to your PWA origin in production,
 * e.g. https://tracker.example.com. Defaults to "*" for local development.
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** JSON response with CORS headers. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
