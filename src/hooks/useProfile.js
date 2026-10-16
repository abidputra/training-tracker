/**
 * The signed-in user's profile row (username). Returns `profile` as undefined
 * while loading, then { username } (username is null for accounts created
 * before usernames existed).
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export function useProfile(userId) {
  const [profile, setProfile] = useState(undefined);

  const reload = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    setProfile(data ?? { username: null });
  }, [userId]);

  useEffect(() => {
    reload().catch((e) => console.error('loading profile failed:', e.message));
  }, [reload]);

  return { profile, reload };
}
