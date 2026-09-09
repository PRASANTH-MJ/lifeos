import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';

import { firestore, functions } from '@/firebase/config';
import type { Challenge, ChallengeMetricType } from './types';

function toChallenge(clubId: string, id: string, data: Record<string, unknown>): Challenge {
  return {
    id,
    clubId,
    title: (data.title as string) ?? '',
    description: (data.description as string) ?? null,
    // Older challenge docs predate metricType — they were all session-count challenges, so that's
    // the correct default rather than leaving it undefined.
    metricType: (data.metricType as ChallengeMetricType) ?? 'sessions',
    goalSessions: (data.goalSessions as number) ?? 0,
    targetHabitName: (data.targetHabitName as string) ?? null,
    startDate: (data.startDate as string) ?? '',
    endDate: (data.endDate as string) ?? '',
    createdBy: (data.createdBy as string) ?? '',
    participantCount: (data.participantCount as number) ?? 0,
    teamMode: (data.teamMode as boolean) ?? false,
  };
}

/** Every challenge in one club, newest first. */
export function useChallenges(clubId: string | null | undefined) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId) {
      setChallenges([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(firestore, 'clubs', clubId, 'challenges'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setChallenges(snapshot.docs.map((d) => toChallenge(clubId, d.id, d.data())));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [clubId]);

  return { challenges, loading };
}

/** Creates a challenge (title/description/session goal/date window) and auto-joins the creator —
 * see functions/index.js's createChallenge for why this needs a callable (pairs the challenge doc
 * with the creator's own participant doc, snapshotting their current cardioLogCount). */
export function useCreateChallenge() {
  const [submitting, setSubmitting] = useState(false);

  const createChallenge = async (
    clubId: string,
    values: {
      title: string;
      description: string;
      metricType: ChallengeMetricType;
      goalSessions: number;
      /** Required when metricType is 'habitStreak' — see types.ts's Challenge.targetHabitName. */
      targetHabitName?: string;
      startDate: string;
      endDate: string;
      teamMode?: boolean;
    }
  ): Promise<string> => {
    setSubmitting(true);
    try {
      const fn = httpsCallable<
        {
          clubId: string;
          title: string;
          description: string;
          metricType: ChallengeMetricType;
          goalSessions: number;
          targetHabitName?: string;
          startDate: string;
          endDate: string;
          teamMode?: boolean;
        },
        { challengeId: string }
      >(functions, 'createChallenge');
      const result = await fn({ clubId, ...values });
      return result.data.challengeId;
    } finally {
      setSubmitting(false);
    }
  };

  return { createChallenge, submitting };
}
