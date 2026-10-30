/**
 * The header "Sync" button: syncs every connected first-party service at once
 * (SYNC_PROVIDERS in lib/api.js), then reloads the app's data and reports one
 * summary message (see lib/syncSummary.js for the rules).
 */
import { useCallback, useRef, useState } from 'react';
import { SYNC_PROVIDERS, garminApi } from '../lib/api.js';
import { planSync, summarizeSync } from '../lib/syncSummary.js';

export function useSyncAll(connections, onNotice, onSynced) {
  const [syncing, setSyncing] = useState(false);
  const running = useRef(false);

  const sync = useCallback(async () => {
    if (running.current) return;

    const { usable, notice } = planSync(SYNC_PROVIDERS, connections);
    if (notice) {
      onNotice(notice);
      return;
    }

    running.current = true;
    setSyncing(true);
    try {
      const results = await Promise.allSettled(usable.map((p) => garminApi(p.path)));
      await onSynced(); // pull the new rows in right away
      onNotice(summarizeSync(usable, results));
    } finally {
      running.current = false;
      setSyncing(false);
    }
  }, [connections, onNotice, onSynced]);

  return { syncing, sync };
}
