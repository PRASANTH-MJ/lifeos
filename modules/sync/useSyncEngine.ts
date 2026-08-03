import { useNetworkState } from 'expo-network';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/modules/auth/useAuth';
import { flushOutbox, setSyncUid, startSyncListener } from './syncEngine';

/** The single mount point for cross-device sync — everything else in modules/sync/ is either
 * called from individual hooks' insert/update/delete paths (pushLocalRow,
 * recordDeleteBeforeRemoving) or driven from here. Mount once near the root (see
 * app/_layout.tsx), alongside usePremium(). */
export function useSyncEngine() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const network = useNetworkState();
  const uid = user?.uid ?? null;
  const isOnline = network.isConnected !== false;
  const wasOnline = useRef(isOnline);

  useEffect(() => {
    setSyncUid(uid);
    if (!uid) return;

    flushOutbox(db).catch(() => {});
    const unsubscribe = startSyncListener(db, uid);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useEffect(() => {
    if (isOnline && !wasOnline.current && uid) {
      flushOutbox(db).catch(() => {});
    }
    wasOnline.current = isOnline;
  }, [isOnline, uid, db]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && uid) flushOutbox(db).catch(() => {});
    });
    return () => subscription.remove();
  }, [uid, db]);
}
