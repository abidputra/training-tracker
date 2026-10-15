/**
 * Tracks the Supabase auth session.
 * Returns: undefined while loading, null when signed out, or the session object.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export function useSession() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  return session;
}
