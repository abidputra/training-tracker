/**
 * Shared service-role Supabase client for Edge Functions.
 *
 * The service role bypasses RLS, so this client must NEVER be exposed to the
 * browser. It is used to read/write `provider_tokens`, `connections` and
 * `activities`.
 *
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by the
 * Supabase runtime. If your project no longer injects the service role key,
 * set it manually as a secret named SERVICE_ROLE_KEY (custom secrets can't
 * start with SUPABASE_).
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ?? "";

export const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Resolves the calling user from the `Authorization: Bearer <jwt>` header.
 * Returns null when missing or invalid.
 */
export async function getUserFromRequest(req: Request) {
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return null;
  return data.user;
}
