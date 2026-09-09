import { Text, View } from 'react-native';

import { Card, IconBadge, LoadingState, PremiumGate, ScreenContainer, TrendChart } from '@/components';
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
      <PremiumGate
        feature="workoutAnalytics"
        icon="bar-chart-outline"
        title="Advanced Insights is a Pro feature"
        message="See your weekly workout trend, streak, and totals in one place. Go Pro to unlock analytics across every module.">
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <Card style={{ flex: 1, gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <IconBadge name="calendar-outline" color={theme.colors.moduleTasks} size="sm" />
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>This week</Text>
            </View>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
              {totalCount} workout{totalCount === 1 ? '' : 's'}
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{totalMinutes} min total</Text>
          </Card>
          <Card style={{ flex: 1, gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <IconBadge name="flame" color={theme.colors.warning} size="sm" />
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>Current streak</Text>
            </View>
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
      </PremiumGate>
    </ScreenContainer>
  );
}
