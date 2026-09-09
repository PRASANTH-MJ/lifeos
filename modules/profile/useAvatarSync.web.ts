import { useEffect } from 'react';

import { webDb } from '@/db/webDb';
import { useAuth } from '@/modules/auth/useAuth';
import { subscribeAvatarUrl } from './avatarSync';

/**
 * Web build of useAvatarSync.ts — same shape, mounted once near the root. Writing straight into
 * webDb.user_profile is enough for every useProfile() instance (any tab) to pick it up via its
 * useLiveQuery — no broadcast helper needed here the way the native version uses one for its
 * own tab's already-mounted screens.
 */
export function useAvatarSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    return subscribeAvatarUrl(user.uid, (url) => {
      if (!url) return;
      webDb.user_profile.update(1, { avatar_uri: url }).catch(() => {});
    });
  }, [user?.uid]);
}
