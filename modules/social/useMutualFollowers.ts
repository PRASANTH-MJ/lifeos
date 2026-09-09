import { auth } from '@/firebase/config';

import { useFollowList } from './useFollowList';
import { useProfilesByUids } from './useProfilesByUids';
import type { PublicProfile } from './types';

/** People the signed-in user follows AND is followed by — the "mutuals" a feature like expense
 * splitting limits its picker to, since a one-directional follow doesn't guarantee the other
 * person actually knows/recognizes the viewer. */
export function useMutualFollowers() {
  const myUid = auth.currentUser?.uid;
  const { uids: followerUids, loading: loadingFollowers } = useFollowList(myUid, 'followers');
  const { uids: followingUids, loading: loadingFollowing } = useFollowList(myUid, 'following');

  const followingSet = new Set(followingUids);
  const mutualUids = followerUids.filter((uid) => followingSet.has(uid));
  const { profiles, loading: loadingProfiles } = useProfilesByUids(mutualUids);
  const mutuals: PublicProfile[] = mutualUids.map((uid) => profiles[uid]).filter((profile): profile is PublicProfile => !!profile);

  return { mutuals, loading: loadingFollowers || loadingFollowing || loadingProfiles };
}
