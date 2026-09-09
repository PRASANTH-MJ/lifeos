import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, IconBadge } from '@/components';
import { addDays, todayKey } from '@/lib/date';
import { computeCardioStreak, useCardioLogs } from '@/modules/cardio';
import { useMindfulnessStreak } from '@/modules/mindfulness';
import { useSettings } from '@/modules/settings';
import { computeWorkoutStreak, useWorkoutLogs } from '@/modules/workout';
import { useAppTheme } from '@/theme';

import type { LifeScoreSnapshot } from './useLifeScore';
import { useMyActiveChallenges } from './useMyActiveChallenges';

const RECAP_INTERVAL_DAYS = 7;

function shouldShowRecap(lastShownAt: string | null): boolean {
  if (!lastShownAt) return true;
  return lastShownAt <= addDays(todayKey(), -RECAP_INTERVAL_DAYS);
}

type Props = {
  overall: number;
  snapshots: LifeScoreSnapshot[];
};

/**
 * A once-a-week "your week" rollup shown above the per-area breakdown — the overall score's
 * delta vs. 7 days ago (from the same snapshot history the per-area TrendIndicator already
 * reads), current streaks, and any active club-challenge progress. Purely a read-only summary:
 * the only write anywhere in here is the "last shown" marker (see useSettings), which is what
 * gates it back to once a week instead of every visit. Collapse is local/session-only; dismiss
 * persists the marker so it stays hidden until the next weekly window.
 */
export function WeeklyRecapCard({ overall, snapshots }: Props) {
  const theme = useAppTheme();
  const { settings, setLastWeeklyRecapShownAt } = useSettings();
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const { logs: cardioLogs } = useCardioLogs();
  const { logs: workoutLogs } = useWorkoutLogs();
  const mindfulnessStreak = useMindfulnessStreak();
  const { activeChallenges, loading: challengesLoading } = useMyActiveChallenges();

  const visible = settings != null && !dismissed && shouldShowRecap(settings.lastWeeklyRecapShownAt);
  if (!visible) return null;

  const weekAgoDate = addDays(todayKey(), -7);
  const weekAgoSnapshot = snapshots.find((snapshot) => snapshot.date === weekAgoDate);
  const delta = weekAgoSnapshot ? overall - weekAgoSnapshot.overall : null;

  const cardioStreak = computeCardioStreak(cardioLogs);
  const workoutStreak = computeWorkoutStreak(workoutLogs);

  const onDismiss = () => {
    setDismissed(true);
    setLastWeeklyRecapShownAt(todayKey());
  };

  return (
    <Card tier="elevated" glow style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <IconBadge name="calendar" color={theme.colors.primary} size="sm" />
        <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
          Your Week
        </Text>
        <Pressable onPress={() => setCollapsed((current) => !current)} hitSlop={8}>
          <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={18} color={theme.colors.textTertiary} />
        </Pressable>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Ionicons name="close" size={18} color={theme.colors.textTertiary} />
        </Pressable>
      </View>

      {!collapsed ? (
        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
              {overall}
            </Text>
            {delta != null ? (
              <Text
                style={{
                  color: delta === 0 ? theme.colors.textTertiary : delta > 0 ? theme.colors.success : theme.colors.danger,
                  fontSize: theme.typography.size.sm,
                  fontWeight: theme.typography.weight.semibold,
                }}>
                {delta > 0 ? '▲' : delta < 0 ? '▼' : '–'} {Math.abs(delta)} vs last week
              </Text>
            ) : (
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Overall balance</Text>
            )}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
            {cardioStreak > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="walk" size={14} color={theme.colors.warning} />
                <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs }}>{cardioStreak}d cardio streak</Text>
              </View>
            ) : null}
            {workoutStreak > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="barbell" size={14} color={theme.colors.warning} />
                <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs }}>{workoutStreak}d workout streak</Text>
              </View>
            ) : null}
            {mindfulnessStreak > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="leaf" size={14} color={theme.colors.warning} />
                <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs }}>{mindfulnessStreak}d mindfulness streak</Text>
              </View>
            ) : null}
          </View>

          {!challengesLoading && activeChallenges.length > 0 ? (
            <View style={{ gap: 4 }}>
              {activeChallenges.map((item) => {
                const progress = Math.max(0, cardioLogs.length - item.startCount);
                return (
                  <Text key={`${item.clubId}-${item.challenge.id}`} style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs }}>
                    🏆 {item.challenge.title}: {progress}/{item.challenge.goalSessions} sessions
                  </Text>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
