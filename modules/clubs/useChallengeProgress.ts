import { useMemo } from 'react';

import { useProfilesByUids } from '@/modules/social';
import { metricProgress } from './challengeProgress';
import { useChallengeParticipants } from './useChallenge';
import type { Challenge, ChallengeParticipant, ChallengeTeam } from './types';
import type { PublicProfile } from '@/modules/social';

export type ChallengeProgressRow = { participant: ChallengeParticipant; profile: PublicProfile; progress: number };

/** One challenge's live per-participant progress, ranked and (when the challenge is team-mode)
 * summed per team — the exact computation challenge.tsx's leaderboard needs, factored out so a
 * compact "your club" preview card (see ActiveChallengeCard.tsx) can show the same real numbers
 * without re-deriving them differently. */
export function useChallengeProgress(clubId: string | null | undefined, challengeId: string | null | undefined, challenge: Challenge | null) {
  const { participants, loading: participantsLoading } = useChallengeParticipants(clubId, challengeId);
  const participantUids = useMemo(() => participants.map((p) => p.uid), [participants]);
  const { profiles, loading: profilesLoading } = useProfilesByUids(participantUids);

  const ranked = useMemo<ChallengeProgressRow[]>(() => {
    if (!challenge) return [];
    return participants
      .map((participant) => {
        const profile = profiles[participant.uid];
        const progress = profile ? metricProgress(profile, participant.startCount, challenge.metricType, challenge.targetHabitName) : 0;
        return { participant, profile, progress };
      })
      .filter((row): row is ChallengeProgressRow => !!row.profile)
      .sort((a, b) => b.progress - a.progress);
  }, [challenge, participants, profiles]);

  const teamTotals = useMemo(() => {
    const totals: Record<ChallengeTeam, number> = { A: 0, B: 0 };
    if (!challenge?.teamMode) return totals;
    for (const row of ranked) {
      if (row.participant.team) totals[row.participant.team] += row.progress;
    }
    return totals;
  }, [challenge, ranked]);

  const totalProgress = useMemo(() => ranked.reduce((sum, row) => sum + row.progress, 0), [ranked]);

  return { ranked, teamTotals, totalProgress, loading: participantsLoading || profilesLoading };
}
