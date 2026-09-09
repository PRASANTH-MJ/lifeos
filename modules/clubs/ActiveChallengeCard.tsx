import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, IconBadge, LoadingState, ProgressBar } from '@/components';
import { auth } from '@/firebase/config';
import { useAppTheme } from '@/theme';
import { goalUnitLabel } from './challengeProgress';
import { useChallengeProgress } from './useChallengeProgress';
import type { Challenge, ChallengeTeam } from './types';

function formatAmount(value: number, challenge: Challenge): string {
  return challenge.metricType === 'distanceKm' ? value.toFixed(1) : String(value);
}

/** A club's active challenge, shared between the discovery hub's compact "your club" preview
 * (`variant="compact"`) and the club detail screen's full card. Team-mode challenges show both
 * teams' totals (the same head-to-head framing as challenge.tsx's standings); an individual
 * challenge shows the signed-in member's own progress when they've joined, falling back to the
 * combined total of everyone's progress when they haven't (or aren't a participant yet) — never a
 * per-member number that isn't actually theirs. */
export function ActiveChallengeCard({ clubId, challenge, variant = 'full' }: { clubId: string; challenge: Challenge; variant?: 'compact' | 'full' }) {
  const theme = useAppTheme();
  const myUid = auth.currentUser?.uid;
  const { ranked, teamTotals, totalProgress, loading } = useChallengeProgress(clubId, challenge.id, challenge);
  const compact = variant === 'compact';

  const myRow = ranked.find((row) => row.participant.uid === myUid);
  const unit = goalUnitLabel(challenge.metricType);
  const goal = challenge.goalSessions;

  // Individual mode only — team mode renders its own per-team bars below instead of one combined
  // fraction, so the two teams read as head-to-head rather than a single blended number.
  const shown = myRow ? myRow.progress : totalProgress;
  const fraction = goal > 0 ? Math.min(shown / goal, 1) : 0;
  const progressLabel = `${formatAmount(shown, challenge)}/${goal} ${unit}${myRow ? '' : ' total'}`;

  return (
    <Link href={{ pathname: '/social/clubs/challenge', params: { clubId, challengeId: challenge.id } }} asChild>
      <Pressable>
        <Card style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <IconBadge name="trophy" color={theme.colors.warning} size={compact ? 'sm' : 'md'} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: theme.colors.textPrimary,
                  fontSize: compact ? theme.typography.size.sm : theme.typography.size.base,
                  fontWeight: theme.typography.weight.semibold,
                }}
                numberOfLines={1}>
                {challenge.title}
              </Text>
              {!compact && challenge.description ? (
                <Text numberOfLines={2} style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, marginTop: 2 }}>
                  {challenge.description}
                </Text>
              ) : null}
            </View>
            {challenge.teamMode ? (
              <View
                style={{
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: 2,
                  borderRadius: theme.radius.full,
                  backgroundColor: theme.colors.surfaceElevated,
                }}>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
                  Team vs. team
                </Text>
              </View>
            ) : null}
          </View>

          {loading ? (
            <LoadingState />
          ) : challenge.teamMode ? (
            <View style={{ gap: compact ? 4 : theme.spacing.xs }}>
              {(['A', 'B'] as ChallengeTeam[]).map((team) => {
                const otherTeam: ChallengeTeam = team === 'A' ? 'B' : 'A';
                const value = teamTotals[team];
                const teamFraction = goal > 0 ? Math.min(value / goal, 1) : 0;
                const isLeading = value > 0 && value > teamTotals[otherTeam];
                return (
                  <View key={team} style={{ gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
                          Team {team}
                        </Text>
                        {isLeading ? <Ionicons name="trophy" size={11} color={theme.colors.warning} /> : null}
                      </View>
                      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
                        {formatAmount(value, challenge)}/{goal} {unit}
                      </Text>
                    </View>
                    <ProgressBar
                      progress={teamFraction}
                      color={team === 'A' ? theme.colors.primary : theme.colors.warning}
                      height={compact ? 4 : 6}
                    />
                  </View>
                );
              })}
            </View>
          ) : (
            <>
              <ProgressBar progress={fraction} color={theme.colors.warning} height={compact ? 5 : 8} />
              <Text
                style={{
                  color: theme.colors.textPrimary,
                  fontSize: theme.typography.size.xs,
                  fontWeight: theme.typography.weight.semibold,
                }}>
                {progressLabel}
              </Text>
            </>
          )}
        </Card>
      </Pressable>
    </Link>
  );
}
