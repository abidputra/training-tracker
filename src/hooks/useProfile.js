/**
 * The signed-in user's profile row (username, accent). Returns `profile` as
 * undefined while loading, then { username, accent } (null when not set).
 * Selects `*` so the page still loads if the accent column is not migrated yet.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export function useProfile(userId) {
  const [profile, setProfile] = useState(undefined);

  const reload = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    setProfile({ username: null, accent: null, ...data });
  }, [userId]);

  useEffect(() => {
    reload().catch((e) => console.error('loading profile failed:', e.message));
  }, [reload]);

  return { profile, reload };
}
