import { Text, View } from 'react-native';

import { Card, LoadingState, ScreenContainer, TrendChart } from '@/components';
import { formatDisplayDate } from '@/lib/date';
import { useWorkoutLogs, useWorkoutWeekAnalytics, computeWorkoutStreak } from '@/modules/workout';
import { useAppTheme } from '@/theme';

export default function WorkoutAnalyticsScreen() {
  const theme = useAppTheme();
  const { days, totalCount, totalMinutes, loading } = useWorkoutWeekAnalytics();
  const { logs } = useWorkoutLogs();
  const streak = computeWorkoutStreak(logs);

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <Card style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>This week</Text>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
              {totalCount} workout{totalCount === 1 ? '' : 's'}
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{totalMinutes} min total</Text>
          </Card>
          <Card style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Current streak</Text>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
              {streak} day{streak === 1 ? '' : 's'}
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>consecutive</Text>
          </Card>
        </View>

        <Card>
          <TrendChart
            label="Workouts per day (last 7 days)"
            data={days.map((d) => ({ date: formatDisplayDate(d.date), value: d.count }))}
            color={theme.colors.moduleTasks}
          />
        </Card>
      </View>
    </ScreenContainer>
  );
}
