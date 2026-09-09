import { collection, doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';

import { auth, firestore, functions } from '@/firebase/config';
import type { Challenge, ChallengeMetricType, ChallengeParticipant } from './types';

function toChallenge(clubId: string, id: string, data: Record<string, unknown>): Challenge {
  return {
    id,
    clubId,
    title: (data.title as string) ?? '',
    description: (data.description as string) ?? null,
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

/** A single challenge's live doc, plus whether the signed-in user has joined and join()/leave()
 * actions — same optimistic-flip + callable shape as modules/clubs/useClub.ts's isMember/join/leave. */
export function useChallenge(clubId: string | null | undefined, challengeId: string | null | undefined) {
  const myUid = auth.currentUser?.uid;
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!clubId || !challengeId) {
      setChallenge(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(firestore, 'clubs', clubId, 'challenges', challengeId),
      (snap) => {
        const data = snap.data();
        setChallenge(data ? toChallenge(clubId, challengeId, data) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [clubId, challengeId]);

  useEffect(() => {
    if (!clubId || !challengeId || !myUid) {
      setHasJoined(false);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(firestore, 'clubs', clubId, 'challenges', challengeId, 'participants', myUid),
      (snap) => {
        const exists = snap.exists();
        setHasJoined(exists);
        setOptimistic((current) => (current === exists ? null : current));
      },
      () => {}
    );
    return unsubscribe;
  }, [clubId, challengeId, myUid]);

  const join = async () => {
    if (!clubId || !challengeId) return;
    setOptimistic(true);
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ clubId: string; challengeId: string }, { joined: boolean }>(functions, 'joinChallenge');
      await fn({ clubId, challengeId });
    } catch (err) {
      setOptimistic(null);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const leave = async () => {
    if (!clubId || !challengeId) return;
    setOptimistic(false);
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ clubId: string; challengeId: string }, { joined: boolean }>(functions, 'leaveChallenge');
      await fn({ clubId, challengeId });
    } catch (err) {
      setOptimistic(null);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return { challenge, loading, hasJoined: optimistic ?? hasJoined, submitting, join, leave };
}

/** Every participant's uid + join-time cardioLogCount snapshot — the leaderboard screen pairs
 * this with each uid's *current* cardioLogCount (via usePublicProfile) to compute progress. */
export function useChallengeParticipants(clubId: string | null | undefined, challengeId: string | null | undefined) {
  const [participants, setParticipants] = useState<ChallengeParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId || !challengeId) {
      setParticipants([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(firestore, 'clubs', clubId, 'challenges', challengeId, 'participants'),
      (snapshot) => {
        setParticipants(
          snapshot.docs.map((d) => ({ uid: d.id, startCount: (d.data().startCount as number) ?? 0, team: (d.data().team as ChallengeParticipant['team']) ?? null }))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [clubId, challengeId]);

  return { participants, loading };
}
