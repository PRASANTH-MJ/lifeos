import { collection, documentId, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { firestore } from '@/firebase/config';
import type { PublicProfile } from './types';

// Firestore's `where(documentId(), 'in', ...)` caps out at 30 values per query — chunk into
// batches of that size so an arbitrarily large uid list still works, at the cost of one listener
// per 30 uids instead of one per single uid.
const CHUNK_SIZE = 30;

function toProfile(uid: string, data: Record<string, unknown>): PublicProfile {
  return {
    uid,
    displayName: (data.displayName as string) ?? '',
    avatarUrl: (data.avatarUrl as string) ?? null,
    usernameLower: (data.usernameLower as string) ?? '',
    bio: (data.bio as string) ?? null,
    isPrivate: !!data.isPrivate,
    isPro: !!data.isPro,
    habitStreak: (data.habitStreak as number) ?? 0,
    habitStreaks: (data.habitStreaks as string) ?? '[]',
    cardioLogCount: (data.cardioLogCount as number) ?? 0,
    cardioStreak: (data.cardioStreak as number) ?? 0,
    cardioDistanceKm: (data.cardioDistanceKm as number) ?? 0,
    workoutLogCount: (data.workoutLogCount as number) ?? 0,
    mealLogCount: (data.mealLogCount as number) ?? 0,
    waterGoalHitDays: (data.waterGoalHitDays as number) ?? 0,
    meditationLogCount: (data.meditationLogCount as number) ?? 0,
    breathingLogCount: (data.breathingLogCount as number) ?? 0,
    followerCount: (data.followerCount as number) ?? 0,
    followingCount: (data.followingCount as number) ?? 0,
    postCount: (data.postCount as number) ?? 0,
  };
}

/** Live profiles for a whole list of uids at once, keyed by uid — for screens that need every
 * profile in hand before rendering (a sorted leaderboard), where usePublicProfile's one-hook-
 * per-row shape can't produce a correct sort (each row would resolve independently, so anything
 * sorting by a profile field before they've all loaded sorts on stale/default data).
 *
 * One `where(documentId(), 'in', chunk)` listener per 30-uid chunk (Firestore's `in`-query cap),
 * NOT one onSnapshot per individual uid — a club with, say, 20 members used to open 20 separate
 * listeners here (and every other club screen mounting this hook multiplied that further); a club
 * under the 30-member chunk size now opens exactly one. Each chunk listener uses `docChanges()`
 * rather than re-mapping every doc in the chunk on every event, so a single member's profile
 * update only replaces that one entry's object reference — every other uid's PublicProfile object
 * keeps the same identity across the update, which lets a memoized per-row component (see
 * ClubActivityLeaderboardSection) skip re-rendering rows that didn't actually change. */
export function useProfilesByUids(uids: string[]) {
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const [loading, setLoading] = useState(true);
  // Sorted so the key (and therefore whether the effect resubscribes) reflects the *set* of uids,
  // not the incidental order Firestore happened to return them in.
  const key = [...uids].sort().join(',');

  useEffect(() => {
    if (uids.length === 0) {
      setProfiles({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const chunks: string[][] = [];
    for (let i = 0; i < uids.length; i += CHUNK_SIZE) chunks.push(uids.slice(i, i + CHUNK_SIZE));

    let pendingChunks = chunks.length;
    const initialized = new Set<number>();

    const unsubscribes = chunks.map((chunk, chunkIndex) => {
      const q = query(collection(firestore, 'userPublicProfiles'), where(documentId(), 'in', chunk));
      const markInitialized = () => {
        if (!initialized.has(chunkIndex)) {
          initialized.add(chunkIndex);
          pendingChunks = Math.max(0, pendingChunks - 1);
          if (pendingChunks === 0) setLoading(false);
        }
      };
      return onSnapshot(
        q,
        (snapshot) => {
          setProfiles((current) => {
            const next = { ...current };
            for (const change of snapshot.docChanges()) {
              if (change.type === 'removed') delete next[change.doc.id];
              else next[change.doc.id] = toProfile(change.doc.id, change.doc.data());
            }
            return next;
          });
          markInitialized();
        },
        () => markInitialized()
      );
    });
    return () => unsubscribes.forEach((unsub) => unsub());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { profiles, loading };
}
