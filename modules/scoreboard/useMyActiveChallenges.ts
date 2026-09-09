import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { auth, firestore } from '@/firebase/config';
import { todayKey } from '@/lib/date';
import { useClubs, type Challenge } from '@/modules/clubs';

export type MyActiveChallenge = {
  clubId: string;
  clubName: string;
  challenge: Challenge;
  /** The participant's cardioLogCount snapshot at join time — see modules/clubs/types.ts's
   * ChallengeParticipant; current progress is the caller's own cardioLogs.length minus this. */
  startCount: number;
};

const MAX_CLUBS_CHECKED = 20;

/**
 * One-time (not live) scan for the weekly recap card's "challenge progress" line — bounded to the
 * top clubs by member count from the existing public useClubs() listener, since there's no
 * reverse "my challenges across every club" index to query directly (a participant doc's id is
 * the joiner's uid, not a queryable field, so it can't be found via a collectionGroup where()).
 * Read-only against clubs/challenges/participants, exactly like the leaderboard screen — doesn't
 * touch any club/challenge write path.
 */
export function useMyActiveChallenges() {
  const myUid = auth.currentUser?.uid;
  const { clubs, loading: clubsLoading } = useClubs();
  const [activeChallenges, setActiveChallenges] = useState<MyActiveChallenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clubsLoading) return;
    if (!myUid || clubs.length === 0) {
      setActiveChallenges([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      const today = todayKey();
      const found: MyActiveChallenge[] = [];

      for (const club of clubs.slice(0, MAX_CLUBS_CHECKED)) {
        const challengesSnap = await getDocs(
          query(collection(firestore, 'clubs', club.id, 'challenges'), where('endDate', '>=', today))
        ).catch(() => null);
        if (!challengesSnap) continue;

        for (const challengeDoc of challengesSnap.docs) {
          const data = challengeDoc.data();
          const startDate = (data.startDate as string) ?? '';
          if (startDate > today) continue;

          const participantSnap = await getDoc(
            doc(firestore, 'clubs', club.id, 'challenges', challengeDoc.id, 'participants', myUid)
          ).catch(() => null);
          if (!participantSnap || !participantSnap.exists()) continue;

          const challenge: Challenge = {
            id: challengeDoc.id,
            clubId: club.id,
            title: (data.title as string) ?? '',
            description: (data.description as string) ?? null,
            metricType: data.metricType === 'distanceKm' ? 'distanceKm' : data.metricType === 'habitStreak' ? 'habitStreak' : 'sessions',
            goalSessions: (data.goalSessions as number) ?? 0,
            targetHabitName: (data.targetHabitName as string) ?? null,
            startDate,
            endDate: (data.endDate as string) ?? '',
            createdBy: (data.createdBy as string) ?? '',
            participantCount: (data.participantCount as number) ?? 0,
            teamMode: (data.teamMode as boolean) ?? false,
          };
          found.push({
            clubId: club.id,
            clubName: club.name,
            challenge,
            startCount: (participantSnap.data()?.startCount as number) ?? 0,
          });
        }
      }

      if (!cancelled) {
        setActiveChallenges(found);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clubsLoading, clubs, myUid]);

  return { activeChallenges, loading };
}
