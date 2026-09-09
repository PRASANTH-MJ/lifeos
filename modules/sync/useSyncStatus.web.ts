import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/modules/auth';
import { webDb } from '@/db/webDb';
import { getLastSyncedAt, onSyncStatusChange } from './syncEngine.web';

/** Web build of useSyncStatus.ts — same event-driven shape, Dexie's count() instead of a raw
 * SQL count. See that file's doc comment for why this subscribes rather than polls. */
export function useSyncStatus() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    webDb.sync_outbox.count().then(setPendingCount);
    if (uid) getLastSyncedAt(uid).then((ms) => setLastSyncedAt(ms ? new Date(ms) : null));
  }, [uid]);

  useEffect(() => {
    refresh();
    return onSyncStatusChange(refresh);
  }, [refresh]);

  return { pendingCount, lastSyncedAt };
}
