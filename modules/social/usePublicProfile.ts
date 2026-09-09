import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { firestore } from '@/firebase/config';

import type { PublicProfile } from './types';

/** Live view of any user's public profile — `userPublicProfiles/{uid}` is readable by any
 * signed-in user (see firestore.rules), so this works the same for "my profile" and "someone
 * else's profile", using an onSnapshot listener for cross-user Firestore state with no local
 * SQLite table backing it. */
export function usePublicProfile(uid: string | null | undefined) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(firestore, 'userPublicProfiles', uid),
      (snap) => {
        if (!snap.exists()) {
          setProfile(null);
        } else {
          const data = snap.data();
          setProfile({
            uid,
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
          });
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [uid]);

  return { profile, loading };
}
