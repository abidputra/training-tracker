/**
 * Accent colour, per user. Chosen in Settings and stored on the user's profile
 * (profiles.accent), so it follows the account, never other users on the same
 * device. Applied as the --accent CSS variable, which every highlight reads.
 *
 * A per-user copy is cached in localStorage (`accent:<userId>`) only so the
 * colour is there on the first paint, before the profile has loaded. Signed
 * out, the default is used.
 */
import { useSyncExternalStore } from 'react';
import { supabase } from './supabase.js';

export const ACCENTS = [
  { id: 'red', name: 'Signal red', hex: '#FF3B30' },
  { id: 'orange', name: 'Orange', hex: '#FF6A1A' },
  { id: 'amber', name: 'Amber', hex: '#FFB020' },
  { id: 'lime', name: 'Acid lime', hex: '#C6FF3D' },
  { id: 'cyan', name: 'Cyan', hex: '#3DD9FF' },
  { id: 'white', name: 'Pure white', hex: '#FFFFFF' },
];
export const DEFAULT_ACCENT = ACCENTS[0];

const find = (id) => ACCENTS.find((a) => a.id === id) ?? DEFAULT_ACCENT;
const cacheKey = (userId) => `accent:${userId}`;
const listeners = new Set();
let current = DEFAULT_ACCENT;

/** Shows `id` (or the default) right away; does not save anything. */
export function applyAccent(id) {
  const next = find(id);
  if (next === current) return;
  current = next;
  document.documentElement.style.setProperty('--accent', next.hex);
  listeners.forEach((l) => l());
}

export function cachedAccent(userId) {
  try {
    return userId ? localStorage.getItem(cacheKey(userId)) : null;
  } catch {
    return null;
  }
}

export function cacheAccent(userId, id) {
  try {
    localStorage.setItem(cacheKey(userId), id);
  } catch {
    // private mode: the profile still has it
  }
}

/** Saves the user's choice to their profile. Applies it at once; reverts if the save fails. */
export async function saveAccent(userId, id) {
  const before = current.id;
  applyAccent(id);
  const { error } = await supabase.from('profiles').update({ accent: id }).eq('id', userId);
  if (error) {
    applyAccent(before);
    throw new Error(`Could not save the accent colour: ${error.message}`);
  }
  cacheAccent(userId, id);
}

export function useAccent() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
