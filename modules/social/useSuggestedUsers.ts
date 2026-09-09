import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { auth, firestore } from '@/firebase/config';

import { useFollowList } from './useFollowList';
import type { PublicProfile } from './types';

const CANDIDATE_POOL = 40;
const SUGGESTION_COUNT = 10;

/** "People to follow" for the feed's horizontal suggestion strip — the most-followed profiles
 * (userPublicProfiles is readable by any signed-in user, see firestore.rules), minus whoever the
 * viewer already follows and themself. There's no algorithmic ranking in v1 (see modules/social's
 * design notes) — this is intentionally just "popular accounts you don't already follow", not a
 * personalized recommendation engine. */
export function useSuggestedUsers() {
  const [candidates, setCandidates] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const myUid = auth.currentUser?.uid;
  const { uids: followingUids, loading: followingLoading } = useFollowList(myUid, 'following');

  useEffect(() => {
    setLoading(true);
    const q = query(collection(firestore, 'userPublicProfiles'), orderBy('followerCount', 'desc'), limit(CANDIDATE_POOL));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCandidates(
          snapshot.docs.map((d) => {
            const data = d.data();
            return {
              uid: d.id,
              displayName: data.displayName ?? '',
              avatarUrl: data.avatarUrl ?? null,
              usernameLower: data.usernameLower ?? '',
              bio: data.bio ?? null,
              isPrivate: !!data.isPrivate,
              isPro: !!data.isPro,
              habitStreak: data.habitStreak ?? 0,
              habitStreaks: data.habitStreaks ?? '[]',
              cardioLogCount: data.cardioLogCount ?? 0,
              cardioStreak: data.cardioStreak ?? 0,
              cardioDistanceKm: data.cardioDistanceKm ?? 0,
              workoutLogCount: data.workoutLogCount ?? 0,
              mealLogCount: data.mealLogCount ?? 0,
              waterGoalHitDays: data.waterGoalHitDays ?? 0,
              meditationLogCount: data.meditationLogCount ?? 0,
              breathingLogCount: data.breathingLogCount ?? 0,
              followerCount: data.followerCount ?? 0,
              followingCount: data.followingCount ?? 0,
              postCount: data.postCount ?? 0,
            };
          })
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  const excluded = new Set([myUid, ...followingUids]);
  const suggestions = candidates.filter((c) => !excluded.has(c.uid)).slice(0, SUGGESTION_COUNT);

  return { suggestions, loading: loading || followingLoading };
}
