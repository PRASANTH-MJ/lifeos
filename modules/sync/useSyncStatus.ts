import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/modules/auth';
import { getLastSyncedAt, onSyncStatusChange } from './syncEngine';

/** Live "N changes pending" / "last synced" status for the Settings screen's Cloud Sync card.
 * Deliberately event-driven (subscribing to onSyncStatusChange) rather than polling on an
 * interval — every path that can change sync_outbox's row count or lastSyncedAt already runs
 * through enqueue/flushOutbox/syncIfDue in this same process (native: single app process; web:
 * single tab), so those call sites notifying this listener directly is both simpler and more
 * immediate than a timer that has to guess how often to re-check. */
export function useSyncStatus() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sync_outbox').then((row) => setPendingCount(row?.count ?? 0));
    if (uid) getLastSyncedAt(uid).then((ms) => setLastSyncedAt(ms ? new Date(ms) : null));
  }, [db, uid]);

  useEffect(() => {
    refresh();
    return onSyncStatusChange(refresh);
  }, [refresh]);

  return { pendingCount, lastSyncedAt };
}
