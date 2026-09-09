import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { Avatar, Button, Card, EmptyState, GlowSurface, IconBadge, LoadingState, ProgressBar, ScreenContainer, UpdatesFeed, showAlert } from '@/components';
import { auth } from '@/firebase/config';
import { formatDisplayDate } from '@/lib/date';
import {
  goalUnitLabel,
  useChallenge,
  useChallengeProgress,
  useClub,
  useDeleteClubChallenge,
  type ChallengeMetricType,
  type ChallengeTeam,
} from '@/modules/clubs';
import { useAppTheme } from '@/theme';
import { withAlpha } from '@/theme/withAlpha';
import { hasCelebratedChallenge, markChallengeCelebrated } from '@/modules/clubs/challengeCelebration';

/** A modest per-metric visual variation for the completion badge (icon + color) — not a full
 * custom-badge-designer, just enough that a distance/session-count/streak challenge each feel
 * distinct at a glance. */
const CHALLENGE_BADGE: Record<ChallengeMetricType, { icon: keyof typeof Ionicons.glyphMap; color: (theme: ReturnType<typeof useAppTheme>) => string }> = {
  sessions: { icon: 'checkmark-done', color: (theme) => theme.colors.success },
  distanceKm: { icon: 'speedometer', color: (theme) => theme.colors.primary },
  habitStreak: { icon: 'flame', color: (theme) => theme.colors.warning },
  workoutSessions: { icon: 'barbell', color: (theme) => theme.colors.moduleTasks },
  mealLogs: { icon: 'restaurant', color: (theme) => theme.colors.success },
  waterGoalDays: { icon: 'water', color: (theme) => theme.colors.primary },
  meditationSessions: { icon: 'leaf', color: (theme) => theme.colors.moduleJournal },
  breathingSessions: { icon: 'cloudy', color: (theme) => theme.colors.moduleHabits },
};

/** Shown once, the first time the signed-in participant's own progress crosses the goal — gated
 * on a persisted per-challenge flag (see challengeCelebration.ts) so it never reappears on a later
 * visit, same shape as AppTourModal's one-time-ever flag. */
function ChallengeCompleteModal({ title, metricType, onDismiss }: { title: string; metricType: ChallengeMetricType; onDismiss: () => void }) {
  const theme = useAppTheme();
  const badge = CHALLENGE_BADGE[metricType];
  const badgeColor = badge.color(theme);
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={{ flex: 1, backgroundColor: theme.colors.overlay, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
        <GlowSurface color={badgeColor} intensity="lg" borderRadius={theme.radius.xl}>
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.xl,
              padding: theme.spacing.xl,
              width: '100%',
              gap: theme.spacing.md,
              alignItems: 'center',
            }}>
            <IconBadge name={badge.icon} color={badgeColor} size="lg" />
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold, textAlign: 'center' }}>
              Challenge complete!
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, textAlign: 'center' }}>
              You hit the goal for “{title}”. Nice work.
            </Text>
            <Button label="Nice!" onPress={onDismiss} glow />
          </View>
        </GlowSurface>
      </View>
    </Modal>
  );
}

const TEAM_LABELS: Record<ChallengeTeam, string> = { A: 'Team A', B: 'Team B' };

export default function ChallengeDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const myUid = auth.currentUser?.uid;
  const { clubId, challengeId } = useLocalSearchParams<{ clubId: string; challengeId: string }>();
  const { challenge, loading, hasJoined, submitting, join, leave } = useChallenge(clubId, challengeId);
  const { ranked, teamTotals, loading: progressLoading } = useChallengeProgress(clubId, challengeId, challenge);
  const { isAdmin } = useClub(clubId);
  const { deleteChallenge, submitting: deleting } = useDeleteClubChallenge();
  const [showCelebration, setShowCelebration] = useState(false);

  const confirmDelete = () => {
    showAlert('Delete this challenge?', 'This removes it and everyone’s progress for good — it cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteChallenge(clubId, challengeId)
            .then(() => router.back())
            .catch(() => showAlert('Could not delete the challenge', 'Please try again.'));
        },
      },
    ]);
  };

  const myProgress = myUid ? ranked.find((row) => row.participant.uid === myUid)?.progress : undefined;
  const myGoalReached = !!challenge && hasJoined && myProgress !== undefined && myProgress >= challenge.goalSessions;

  useEffect(() => {
    if (!myGoalReached || !challengeId) return;
    let cancelled = false;
    hasCelebratedChallenge(challengeId).then((already) => {
      if (!already && !cancelled) setShowCelebration(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myGoalReached, challengeId]);

  const dismissCelebration = () => {
    setShowCelebration(false);
    if (challengeId) markChallengeCelebrated(challengeId);
  };

  if (loading || !challenge) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Card tier="elevated" glow style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          <IconBadge name="trophy" color={theme.colors.warning} size="lg" />
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold, textAlign: 'center' }}>
            {challenge.title}
          </Text>
          {challenge.description ? (
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, textAlign: 'center' }}>{challenge.description}</Text>
          ) : null}
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
            {formatDisplayDate(challenge.startDate)} – {formatDisplayDate(challenge.endDate)} · {challenge.goalSessions} {goalUnitLabel(challenge.metricType)} goal
          </Text>
        </Card>

        <Button
          label={hasJoined ? 'Leave Challenge' : 'Join Challenge'}
          variant={hasJoined ? 'danger' : 'gradient'}
          onPress={hasJoined ? leave : join}
          loading={submitting}
        />

        {challenge.teamMode ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Team standings
            </Text>
            {progressLoading ? (
              <LoadingState />
            ) : (
              (['A', 'B'] as ChallengeTeam[]).map((team) => {
                const myTeam = ranked.find((row) => row.participant.uid === myUid)?.participant.team;
                const otherTeam: ChallengeTeam = team === 'A' ? 'B' : 'A';
                const isLeading = teamTotals[team] > 0 && teamTotals[team] > teamTotals[otherTeam];
                return (
                  <Card
                    key={team}
                    style={[
                      { gap: theme.spacing.sm },
                      myTeam === team && { backgroundColor: withAlpha(theme.colors.primary, 0.12), borderColor: theme.colors.primary },
                    ]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                        {TEAM_LABELS[team]}
                      </Text>
                      {myTeam === team ? (
                        <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
                          Your team
                        </Text>
                      ) : null}
                      {isLeading ? <Ionicons name="trophy" size={14} color={theme.colors.warning} /> : null}
                    </View>
                    <ProgressBar progress={Math.min(teamTotals[team] / challenge.goalSessions, 1)} color={team === 'A' ? theme.colors.primary : theme.colors.warning} height={6} />
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.bold }}>
                      {challenge.metricType === 'distanceKm' ? teamTotals[team].toFixed(1) : teamTotals[team]}/{challenge.goalSessions}
                    </Text>
                  </Card>
                );
              })
            )}
          </View>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Leaderboard
            </Text>
            {progressLoading ? (
              <LoadingState />
            ) : ranked.length === 0 ? (
              <EmptyState icon="trophy-outline" title="No one's joined yet" subtitle="Be the first to join and start the leaderboard." />
            ) : (
              ranked.map((row, index) => (
                <Card
                  key={row.participant.uid}
                  style={[
                    { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
                    row.participant.uid === myUid && {
                      backgroundColor: withAlpha(theme.colors.primary, 0.12),
                      borderColor: theme.colors.primary,
                    },
                  ]}>
                  <Text style={{ width: 20, color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.bold }}>
                    {index + 1}
                  </Text>
                  <Avatar url={row.profile!.avatarUrl} size="sm" color={theme.colors.textSecondary} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      numberOfLines={1}
                      style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                      @{row.profile!.usernameLower}
                    </Text>
                    <ProgressBar progress={Math.min(row.progress / challenge.goalSessions, 1)} color={theme.colors.warning} height={4} />
                  </View>
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.bold }}>
                    {challenge.metricType === 'distanceKm' ? row.progress.toFixed(1) : row.progress}/{challenge.goalSessions}
                  </Text>
                </Card>
              ))
            )}
          </View>
        )}

        <UpdatesFeed parentPath={`clubs/${clubId}/challenges/${challengeId}`} canPost={hasJoined} />

        {isAdmin ? <Button label="Delete Challenge" variant="danger" onPress={confirmDelete} loading={deleting} /> : null}
      </View>

      {showCelebration ? <ChallengeCompleteModal title={challenge.title} metricType={challenge.metricType} onDismiss={dismissCelebration} /> : null}
    </ScreenContainer>
  );
}
