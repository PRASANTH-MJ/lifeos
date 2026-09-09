import { useEffect, useRef } from 'react';

import { showAlert } from '@/components';
import { onLocalEditOverwritten } from './syncEngine';

function humanizeTable(table: string): string {
  return table.replace(/_/g, ' ');
}

/** Mount once near the root (see useSyncEngine, app/_layout.tsx) alongside it. Surfaces the one
 * narrow case in mergeRemoteRecord's otherwise-silent last-write-wins that's actually likely to
 * confuse a user: their own very-recent edit getting clobbered by an incoming change from another
 * device. Deliberately a one-time notice per record per session (the `notified` set below), not a
 * full conflict-resolution UI — a device that's behind and catching up on old changes fires this
 * constantly during its first sync, and repeating the same toast for the same record on every
 * later re-merge would just be noise. */
export function useSyncConflictNotice(): void {
  const notified = useRef(new Set<string>());

  useEffect(() => {
    return onLocalEditOverwritten(({ table, syncId }) => {
      const key = `${table}__${syncId}`;
      if (notified.current.has(key)) return;
      notified.current.add(key);
      showAlert('Synced from another device', `A newer edit to your ${humanizeTable(table)} came in from another device and was applied.`);
    });
  }, []);
}
