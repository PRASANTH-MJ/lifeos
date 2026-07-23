import { Text, View } from 'react-native';

import { Card, LoadingState, ScreenContainer, StatCard, TrendChart } from '@/components';
import { nearestMoodLabel, useAnalyticsDashboard } from '@/modules/analytics';
import { formatCurrency, formatCurrencyCompact } from '@/modules/finance';
import { useAppTheme } from '@/theme';

export default function AnalyticsScreen() {
  const theme = useAppTheme();
  const { data, loading } = useAnalyticsDashboard();

  if (loading || !data) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
            Insights
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>Last 14 days, across every module</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <StatCard label="Active habits" value={String(data.activeHabitsCount)} />
          <StatCard label="Tasks completed" value={String(data.tasksCompletedTotal)} color={theme.colors.moduleTasks} />
          <StatCard label="Avg mood" value={data.avgMood != null ? nearestMoodLabel(data.avgMood) : '—'} color={theme.colors.moduleJournal} />
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <StatCard label="Wellness min" value={String(data.wellnessMinutesTotal)} color={theme.colors.moduleJournal} />
          <StatCard label="Spend" value={formatCurrencyCompact(data.spendTotal)} color={theme.colors.danger} />
          <StatCard label="Avg cal/day" value={String(data.avgCaloriesPerDay)} color={theme.colors.primary} />
        </View>

        <Card>
          <TrendChart label="Habit completions / day" data={data.habitsSeries} color={theme.colors.moduleHabits} />
        </Card>
        <Card>
          <TrendChart label="Tasks completed / day" data={data.tasksSeries} color={theme.colors.moduleTasks} />
        </Card>
        <Card>
          <TrendChart label="Mood (1–5)" data={data.moodSeries} color={theme.colors.moduleJournal} formatValue={(v) => v.toFixed(1)} />
        </Card>
        <Card>
          <TrendChart label="Meditation + breathing minutes / day" data={data.wellnessSeries} color={theme.colors.moduleJournal} />
        </Card>
        <Card>
          <TrendChart label="Spending / day" data={data.spendSeries} color={theme.colors.danger} formatValue={(v) => formatCurrency(v)} />
        </Card>
        <Card>
          <TrendChart label="Calories / day" data={data.caloriesSeries} color={theme.colors.primary} />
        </Card>
      </View>
    </ScreenContainer>
  );
}
