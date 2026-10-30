/**
 * Decisions behind the header "Sync" button, kept free of React and network
 * code so they are easy to test.
 *
 * Each sync endpoint answers 200 with { status, imported, error }:
 *   status 'recent'  -> the server's 60 s cooldown said "just synced"
 *   error (non-null) -> the sync failed (e.g. Garmin asked to log in again)
 */

const list = (labels) => labels.join(' and ');

/**
 * Which providers to call. `connections` is keyed by provider key. A connection
 * that needs a new login is skipped. Returns { usable } or { notice } when
 * there is nothing to do.
 */
export function planSync(providers, connections) {
  const connected = providers.filter((p) => connections[p.key]);
  const usable = connected.filter((p) => connections[p.key].status !== 'needs_reauth');
  if (usable.length > 0) return { usable };
  return {
    notice: {
      type: 'error',
      text: connected.length
        ? `${connected[0].label} needs you to log in again. Open Settings.`
        : 'Nothing to sync yet. Connect Garmin in Settings.',
    },
  };
}

/** One message for the Promise.allSettled results of `usable`, in the same order. */
export function summarizeSync(usable, results) {
  const done = [];
  const failed = [];
  results.forEach((r, i) => {
    const { label } = usable[i];
    if (r.status === 'rejected') failed.push(`${label}: ${r.reason?.message ?? 'failed'}`);
    else if (r.value?.error) failed.push(`${label}: ${r.value.error}`);
    else if (r.value?.status !== 'recent') done.push(label);
  });

  if (failed.length) {
    return { type: 'error', text: `${done.length ? `Synced ${list(done)}. ` : ''}${failed.join(' · ')}` };
  }
  return { type: 'info', text: done.length ? `Synced ${list(done)}.` : 'Already synced a moment ago.' };
}
