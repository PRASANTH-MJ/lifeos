import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/modules/auth';
import { useProfile } from '@/modules/profile';
import { getLastSyncedAt, syncIfDue } from './syncEngine.web';

/** Powers a manual "Sync now" action — available to every signed-in user regardless of plan, so
 * someone who needs their edits on another device right now isn't stuck waiting out the
 * daily interval gate (see syncEngine.web.ts) — premium additionally gets a live listener on top. Bypasses that interval
 * via syncIfDue's force flag; still perfectly safe to call often since a sync is just push-then-pull
 * of whatever's actually changed. */
export function useManualSync() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const uid = user?.uid ?? null;
  const premium = profile?.premium ?? false;
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshLastSyncedAt = useCallback(() => {
    if (!uid) return;
    getLastSyncedAt(uid).then(setLastSyncedAt);
  }, [uid]);

  useEffect(() => {
    refreshLastSyncedAt();
  }, [refreshLastSyncedAt]);

  const syncNow = useCallback(async () => {
    if (!uid) return;
    setSyncing(true);
    setError(null);
    try {
      await syncIfDue(uid, premium, /* force */ true);
      refreshLastSyncedAt();
    } catch {
      setError('Sync failed. Check your connection and try again.');
    } finally {
      setSyncing(false);
    }
  }, [uid, premium, refreshLastSyncedAt]);

  return { syncing, lastSyncedAt, error, syncNow };
}
