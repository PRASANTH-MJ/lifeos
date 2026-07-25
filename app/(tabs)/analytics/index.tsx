import { useState } from 'react';
import { Text, View } from 'react-native';

import { Card, Chip, DonutChart, LineChart, Legend, LoadingState, ScreenContainer, StatCard, TrendChart } from '@/components';
import { nearestMoodLabel, useAnalyticsDashboard } from '@/modules/analytics';
import { formatCurrency, formatCurrencyCompact, useFinanceBudgets, useFinanceDailySpend, useFinanceSummary, useFinanceWeekSpend } from '@/modules/finance';
import { todayKey } from '@/lib/date';
import { useAppTheme } from '@/theme';

const MEAL_LABELS: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

const RANGE_OPTIONS = [
  { key: 'day', label: 'Day', days: 1 },
  { key: 'week', label: 'Week', days: 7 },
  { key: 'month', label: 'Month', days: 30 },
  { key: 'year', label: 'Year', days: 365 },
] as const;
type RangeKey = (typeof RANGE_OPTIONS)[number]['key'];

export default function AnalyticsScreen() {
  const theme = useAppTheme();
  const [range, setRange] = useState<RangeKey>('week');
  const days = RANGE_OPTIONS.find((option) => option.key === range)!.days;
  const rangeLabel = RANGE_OPTIONS.find((option) => option.key === range)!.label.toLowerCase();

  const { data, loading } = useAnalyticsDashboard(days);

  const today = todayKey();
  const monthPrefix = today.slice(0, 7);
  const daysInMonth = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate();
  const { summary: currentMonthSummary } = useFinanceSummary(`${monthPrefix}-01`, `${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`);
  const { weekSpend } = useFinanceWeekSpend();
  const { series: spendSeries, total: spendTotal } = useFinanceDailySpend(days);
  const { budgets } = useFinanceBudgets();

  if (loading || !data) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const habitTotal = data.habitStatusBreakdown.done + data.habitStatusBreakdown.fail + data.habitStatusBreakdown.skip;
  const moodTotal = data.moodBreakdown.reduce((sum, m) => sum + m.count, 0);
  const maxMealCalories = Math.max(1, ...data.mealBreakdown.map((m) => m.calories));

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
            Insights
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>Across every module</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {RANGE_OPTIONS.map((option) => (
            <Chip key={option.key} label={option.label} selected={range === option.key} onPress={() => setRange(option.key)} />
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <StatCard label="Active habits" value={String(data.activeHabitsCount)} />
          <StatCard label="Tasks completed" value={String(data.tasksCompletedTotal)} color={theme.colors.moduleTasks} />
          <StatCard label="Overdue tasks" value={String(data.overdueTasksCount)} color={data.overdueTasksCount > 0 ? theme.colors.danger : theme.colors.success} />
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <StatCard label="Missed habits" value={String(data.habitStatusBreakdown.fail)} color={data.habitStatusBreakdown.fail > 0 ? theme.colors.danger : theme.colors.success} />
          <StatCard label="Avg mood" value={data.avgMood != null ? nearestMoodLabel(data.avgMood) : '—'} color={theme.colors.moduleJournal} />
          <StatCard label="Wellness min" value={String(data.wellnessMinutesTotal)} color={theme.colors.moduleJournal} />
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <StatCard label="Workouts" value={String(data.workoutsCompletedTotal)} color={theme.colors.moduleTasks} />
          <StatCard label="Workout min" value={String(data.workoutMinutesTotal)} color={theme.colors.moduleTasks} />
          <StatCard label="Spend" value={formatCurrencyCompact(spendTotal)} color={theme.colors.danger} />
        </View>

        <Card>
          <TrendChart label={`Habit completions / day (${rangeLabel})`} data={data.habitsSeries} color={theme.colors.moduleHabits} />
        </Card>
        <Card>
          <TrendChart label={`Tasks completed / day (${rangeLabel})`} data={data.tasksSeries} color={theme.colors.moduleTasks} />
        </Card>

        {habitTotal > 0 ? (
          <Card style={{ alignItems: 'center', gap: theme.spacing.md }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold, alignSelf: 'flex-start' }}>
              Habit check-ins ({rangeLabel})
            </Text>
            <DonutChart
              segments={[
                { value: data.habitStatusBreakdown.done, color: theme.colors.success },
                { value: data.habitStatusBreakdown.fail, color: theme.colors.danger },
                { value: data.habitStatusBreakdown.skip, color: theme.colors.textTertiary },
              ]}
              centerLabel={`${Math.round((data.habitStatusBreakdown.done / habitTotal) * 100)}%`}
              centerSubLabel="done"
            />
            <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
              <Legend color={theme.colors.success} label={`Done ${data.habitStatusBreakdown.done}`} />
              <Legend color={theme.colors.danger} label={`Fail ${data.habitStatusBreakdown.fail}`} />
              <Legend color={theme.colors.textTertiary} label={`Skip ${data.habitStatusBreakdown.skip}`} />
            </View>
          </Card>
        ) : null}

        <Card>
          <LineChart label="Mood tracker (1–5)" data={data.moodSeries} color={theme.colors.moduleJournal} formatValue={(v) => v.toFixed(1)} />
        </Card>

        {moodTotal > 0 ? (
          <Card style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Mood breakdown ({rangeLabel})
            </Text>
            {data.moodBreakdown.map((mood) => (
              <View key={mood.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{mood.label}</Text>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                  {mood.count}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        <Card>
          <TrendChart label="Meditation + breathing minutes / day" data={data.wellnessSeries} color={theme.colors.moduleJournal} />
        </Card>

        {budgets && (budgets.weeklyBudget != null || budgets.monthlyBudget != null) ? (
          <Card style={{ gap: theme.spacing.md }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Finance situation
            </Text>
            {budgets.weeklyBudget != null ? (
              <FinanceSituationRow label="This week" spend={weekSpend} budget={budgets.weeklyBudget} />
            ) : null}
            {budgets.monthlyBudget != null ? (
              <FinanceSituationRow label="This month" spend={currentMonthSummary?.expense ?? 0} budget={budgets.monthlyBudget} />
            ) : null}
          </Card>
        ) : null}

        <Card>
          <TrendChart label="Spending / day" data={spendSeries} color={theme.colors.danger} formatValue={(v) => formatCurrency(v)} />
        </Card>

        {data.mealBreakdown.length > 0 ? (
          <Card style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Calories by meal ({rangeLabel})
            </Text>
            {data.mealBreakdown.map((meal) => (
              <View key={meal.meal} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
                    {MEAL_LABELS[meal.meal] ?? meal.meal}
                  </Text>
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                    {meal.calories} cal
                  </Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
                  <View style={{ width: `${(meal.calories / maxMealCalories) * 100}%`, height: '100%', backgroundColor: theme.colors.primary }} />
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        <Card>
          <TrendChart label="Calories / day" data={data.caloriesSeries} color={theme.colors.primary} />
        </Card>
        <Card>
          <TrendChart label="Protein (g) / day" data={data.proteinSeries} color={theme.colors.moduleTasks} />
        </Card>
      </View>
    </ScreenContainer>
  );
}

function FinanceSituationRow({ label, spend, budget }: { label: string; spend: number; budget: number }) {
  const theme = useAppTheme();
  const over = spend > budget;
  const progress = Math.min(spend / budget, 1);
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{label}</Text>
        <Text style={{ color: over ? theme.colors.danger : theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
          {formatCurrency(spend)} / {formatCurrency(budget)}
        </Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
        <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: over ? theme.colors.danger : theme.colors.success }} />
      </View>
    </View>
  );
}
