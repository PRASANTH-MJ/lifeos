import { useNetworkState } from 'expo-network';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/modules/auth/useAuth';
import { useProfile } from '@/modules/profile';
import { setSyncPremium, setSyncUid, startRealtimeSync, syncIfDue } from './syncEngine.web';

/**
 * Web build of useSyncEngine.ts — same shape and triggers, calling the Dexie-backed
 * syncEngine.web.ts (no `db` handle needed — webDb is a module singleton). Premium gets the same
 * live-listener treatment as native (see syncEngine.ts's startRealtimeSync doc comment); free
 * keeps the original opportunistic daily-gated model.
 */
export function useSyncEngine() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const network = useNetworkState();
  const uid = user?.uid ?? null;
  const premium = profile?.premium ?? false;
  const isOnline = network.isConnected !== false;
  const wasOnline = useRef(isOnline);

  useEffect(() => {
    setSyncUid(uid);
    setSyncPremium(premium);
    if (!uid) return;

    if (premium) {
      syncIfDue(uid, premium, true).catch(() => {});
      const unsubscribe = startRealtimeSync(uid);
      return unsubscribe;
    }

    syncIfDue(uid, premium).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, premium]);

  useEffect(() => {
    // Free plan keeps its gated cadence (force=false). Premium forces it (force=true) — see
    // useSyncEngine.ts's matching effect for why: the mount-time force=true call is a one-shot
    // outbox retry, and without this, a push that failed while offline would sit stuck until a
    // full page reload instead of retrying the moment connectivity actually returns.
    if (isOnline && !wasOnline.current && uid) {
      syncIfDue(uid, premium, premium).catch(() => {});
    }
    wasOnline.current = isOnline;
  }, [isOnline, uid, premium]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      // Same reasoning as above — premium forces a retry every time the tab regains focus, not
      // just once at load, so a stuck outbox row doesn't sit until the page is reloaded.
      if (state === 'active' && uid) syncIfDue(uid, premium, premium).catch(() => {});
    });
    return () => subscription.remove();
  }, [uid, premium]);
}
