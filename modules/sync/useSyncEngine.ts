import { useNetworkState } from 'expo-network';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/modules/auth/useAuth';
import { useProfile } from '@/modules/profile';
import { setSyncPremium, setSyncUid, startRealtimeSync, syncIfDue } from './syncEngine';

/** The single mount point for cross-device sync — everything else in modules/sync/ is either
 * called from individual hooks' insert/update/delete paths (pushLocalRow,
 * recordDeleteBeforeRemoving) or driven from here. Mount once near the root (see
 * app/_layout.tsx), alongside usePremium().
 *
 * Free-plan users keep the original opportunistic model: syncIfDue is cheap to call often since
 * it's a no-op unless the daily interval has actually elapsed (see syncEngine.ts).
 *
 * Premium users get an actual live listener (startRealtimeSync) instead — a write on another
 * device lands here within a second or two rather than waiting for this device's next
 * foreground/reconnect *and* a daily gate to both line up. syncIfDue(force=true) still runs once
 * up front to flush anything queued from before this session (e.g. offline edits, or a fresh
 * upgrade to premium) and to prime the sync cursor the live listener reads. */
export function useSyncEngine() {
  const db = useSQLiteContext();
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
      syncIfDue(db, uid, premium, true).catch(() => {});
      const unsubscribe = startRealtimeSync(db, uid);
      return unsubscribe;
    }

    syncIfDue(db, uid, premium).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, premium]);

  useEffect(() => {
    if (isOnline && !wasOnline.current && uid) {
      // Free plan keeps its gated cadence here (force=false — only actually runs if the
      // daily interval elapsed). Premium forces it (force=true): the mount-time force=true call
      // above is a one-shot outbox retry, but if that immediate push (or enqueue()'s own
      // fire-and-forget push) failed while offline, nothing else would retry it until the app is
      // fully restarted — the realtime listener only handles incoming changes, not outgoing. A
      // reconnect is exactly when a previously-failed push is most likely to now succeed.
      syncIfDue(db, uid, premium, premium).catch(() => {});
    }
    wasOnline.current = isOnline;
  }, [isOnline, uid, premium, db]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      // Same reasoning as the reconnect effect above: premium forces a retry every time the app
      // comes back to the foreground, not just once at launch, so a stuck outbox row (failed
      // immediate push, or a write made while backgrounded) doesn't sit until a full app restart.
      if (state === 'active' && uid) syncIfDue(db, uid, premium, premium).catch(() => {});
    });
    return () => subscription.remove();
  }, [uid, premium, db]);
}
