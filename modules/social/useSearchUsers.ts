import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { firestore } from '@/firebase/config';

import type { PublicProfile } from './types';

const RESULT_LIMIT = 15;

/** Live-as-you-type username search — a prefix range query against `userPublicProfiles`
 * (readable by any signed-in user, see firestore.rules), ranked by follower count so the most
 * "findable" match for a given prefix surfaces first, Instagram-style, rather than an arbitrary
 * Firestore doc order. A direct client query rather than a Cloud Function callable (the old
 * findUserByUsername) — no cross-user check is needed for a read, so there's no reason to pay a
 * callable's cold-start latency for every keystroke. */
export function useSearchUsers(prefix: string) {
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const usernameLower = prefix.trim().toLowerCase();
    if (!usernameLower) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const q = query(
      collection(firestore, 'userPublicProfiles'),
      where('usernameLower', '>=', usernameLower),
      where('usernameLower', '<', usernameLower + ''),
      orderBy('usernameLower'),
      limit(RESULT_LIMIT)
    );
    getDocs(q)
      .then((snapshot) => {
        if (cancelled) return;
        const profiles = snapshot.docs.map((d) => {
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
        });
        profiles.sort((a, b) => b.followerCount - a.followerCount);
        setResults(profiles);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [prefix]);

  return { results, searching };
}
