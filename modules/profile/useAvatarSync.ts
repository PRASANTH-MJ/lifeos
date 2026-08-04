import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';

import { useAuth } from '@/modules/auth/useAuth';
import { subscribeAvatarUrl } from './avatarSync';

/** Mounted once near the root (see app/_layout.tsx), alongside usePremium()/useSyncEngine() —
 * writes a remote avatar change straight into local SQLite; other useProfile() call sites just
 * read the resulting column on their next focus, same as every other synced value in this app.
 * Keeping this centralized avoids every screen that calls useProfile() opening its own redundant
 * Firestore listener for the same doc. */
export function useAvatarSync() {
  const db = useSQLiteContext();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    return subscribeAvatarUrl(user.uid, (url) => {
      if (url) db.runAsync('UPDATE user_profile SET avatar_uri = ? WHERE id = 1', [url]).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);
}
