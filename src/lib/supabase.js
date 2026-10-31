/**
 * Browser Supabase client (anon key + the signed-in user's JWT).
 * Row Level Security guarantees a user can only read their own rows, and
 * provider tokens are not readable from here at all.
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loudly in dev instead of showing a confusing blank screen.
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local');
}

export const supabase = createClient(url ?? 'http://invalid', anonKey ?? 'invalid');

/**
 * A second client used ONLY to create an account. It keeps no session, so signing
 * up never signs the browser in (with email confirmation off, Supabase would
 * otherwise start a session at once): the new user is sent back to the sign-in
 * form instead. Own storageKey so it does not clash with the main client.
 */
export const supabaseSignup = createClient(url ?? 'http://invalid', anonKey ?? 'invalid', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'sb-signup' },
});
