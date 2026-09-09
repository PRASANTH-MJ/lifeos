import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Card, Chip, DonutChart, IconBadge, LineChart, Legend, LoadingState, OverlayChart, ScreenContainer, Sparkline, StatCard, TrendChart } from '@/components';
import {
  ActionableInsights,
  MetricGrid,
  generateActionableInsights,
  nearestMoodLabel,
  useAnalyticsDashboard,
  useCheckinTrends,
  usePreviousPeriodStats,
  type MetricDomain,
  type MetricTrend,
} from '@/modules/analytics';
import { formatCurrency, formatCurrencyCompact, useAccounts, useFinanceBudgets, useFinanceDailySpend, useFinanceSummary, useFinanceWeekSpend } from '@/modules/finance';
import { todayKey } from '@/lib/date';
import { useAppTheme } from '@/theme';

const MEAL_LABELS: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

const RANGE_OPTIONS = [
  { key: 'day', label: 'Day', days: 1 },
  { key: 'week', label: 'Week', days: 7 },
  { key: 'month', label: 'Month', days: 30 },
  { key: 'quarter', label: 'Quarter', days: 90 },
  { key: 'halfYear', label: 'Half Year', days: 182 },
  { key: 'year', label: 'Year', days: 365 },
] as const;
type RangeKey = (typeof RANGE_OPTIONS)[number]['key'];

const TREND_METRICS: { key: 'stress' | 'energy' | 'joy' | 'productivity'; label: string; color: string; invert?: boolean }[] = [
  { key: 'stress', label: 'Stress level', color: '#FF6259', invert: true },
  { key: 'energy', label: 'Energy this morning', color: '#F5A623' },
  { key: 'joy', label: 'How was today', color: '#3DDB6C' },
  { key: 'productivity', label: 'Productivity', color: '#3D8BFF' },
];

export default function AnalyticsScreen() {
  const theme = useAppTheme();
  const [range, setRange] = useState<RangeKey>('week');
  const days = RANGE_OPTIONS.find((option) => option.key === range)!.days;
  const rangeLabel = RANGE_OPTIONS.find((option) => option.key === range)!.label.toLowerCase();

  const { data, loading } = useAnalyticsDashboard(days);
  const { stats: previousStats } = usePreviousPeriodStats(days);
  const { trends } = useCheckinTrends(days);

  const today = todayKey();
  const monthPrefix = today.slice(0, 7);
  const daysInMonth = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate();
  const { summary: currentMonthSummary } = useFinanceSummary(`${monthPrefix}-01`, `${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`);
  const { weekSpend } = useFinanceWeekSpend();
  const { series: spendSeries, total: spendTotal } = useFinanceDailySpend(days);
  const { budgets } = useFinanceBudgets();
  const { displayCurrency } = useAccounts();

  const insights = useMemo(
    () => (data ? generateActionableInsights(data, previousStats, rangeLabel, spendTotal) : []),
    [data, previousStats, rangeLabel, spendTotal]
  );

  const domains: MetricDomain[] = useMemo(() => {
    if (!data) return [];
    return [
      {
        key: 'productivity',
        label: 'Productivity',
        color: theme.colors.moduleTasks,
        metrics: [
          { label: 'Active habits', value: String(data.activeHabitsCount), current: data.activeHabitsCount, previous: null },
          {
            label: 'Tasks completed',
            value: String(data.tasksCompletedTotal),
            current: data.tasksCompletedTotal,
            previous: previousStats?.tasksCompletedTotal ?? null,
          },
          {
            label: 'Overdue tasks',
            value: String(data.overdueTasksCount),
            current: data.overdueTasksCount,
            previous: null,
            invert: true,
          },
          {
            label: 'Missed habits',
            value: String(data.habitStatusBreakdown.fail),
            current: data.habitStatusBreakdown.fail,
            previous: previousStats?.missedHabits ?? null,
            invert: true,
          },
        ],
      },
      {
        key: 'wellness',
        label: 'Wellness',
        color: theme.colors.moduleJournal,
        metrics: [
          {
            label: 'Avg mood',
            value: data.avgMood != null ? nearestMoodLabel(data.avgMood) : '—',
            current: data.avgMood ?? 0,
            previous: previousStats?.avgMood ?? null,
          },
          {
            label: 'Wellness min',
            value: String(data.wellnessMinutesTotal),
            current: data.wellnessMinutesTotal,
            previous: previousStats?.wellnessMinutesTotal ?? null,
          },
          {
            label: 'Workouts',
            value: String(data.workoutsCompletedTotal),
            current: data.workoutsCompletedTotal,
            previous: previousStats?.workoutsCompletedTotal ?? null,
          },
          {
            label: 'Workout min',
            value: String(data.workoutMinutesTotal),
            current: data.workoutMinutesTotal,
            previous: previousStats?.workoutMinutesTotal ?? null,
          },
        ],
      },
      {
        key: 'finance',
        label: 'Finance',
        color: theme.colors.primary,
        metrics: [
          { label: 'Spend', value: formatCurrencyCompact(spendTotal, displayCurrency), current: spendTotal, previous: previousStats?.spend ?? null, invert: true },
        ],
      },
    ];
  }, [data, previousStats, spendTotal, displayCurrency, theme]);

  if (loading || !data) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const habitTotal = data.habitStatusBreakdown.done + data.habitStatusBreakdown.fail + data.habitStatusBreakdown.skip;
  const moodTotal = data.moodBreakdown.reduce((sum, m) => sum + m.count, 0);
  const maxMealCalories = Math.max(1, ...data.mealBreakdown.map((m) => m.calories));

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <View style={{ gap: theme.spacing.xl }}>
        <View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
            Insights
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>Across every module</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {RANGE_OPTIONS.map((option) => (
            <Chip key={option.key} label={option.label} selected={range === option.key} onPress={() => setRange(option.key)} />
          ))}
        </ScrollView>

        {trends ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <StatCard label="Check-ins" value={String(trends.stats.checkins)} color={theme.colors.moduleJournal} glass />
            <StatCard label="Habit logs" value={String(trends.stats.habitLogs)} color={theme.colors.moduleHabits} glass />
            <StatCard label="Reflections" value={String(trends.stats.reflections)} color={theme.colors.moduleTasks} glass />
          </View>
        ) : null}

        {trends ? (
          <Card tier="panel" style={{ gap: theme.spacing.lg }}>
            <ChartHeader icon="trending-up" color={theme.colors.primary} label="Trends" />
            {TREND_METRICS.map((metric) => (
              <TrendRow key={metric.key} label={metric.label} color={metric.color} invert={metric.invert} trend={trends[metric.key]} />
            ))}
          </Card>
        ) : null}

        <ActionableInsights insights={insights} />

        <MetricGrid domains={domains} />

        {data.tasksSeries.length >= 5 ? (
          <Card style={{ gap: theme.spacing.sm }}>
            <ChartHeader icon="analytics" color={theme.colors.moduleTasks} label="Mood vs. tasks completed" />
            <OverlayChart
              barSeries={data.tasksSeries}
              lineSeries={data.moodSeries}
              barColor={theme.colors.moduleTasks}
              lineColor={theme.colors.moduleJournal}
              barLabel="Tasks completed"
              lineLabel="Mood (1–5)"
            />
          </Card>
        ) : null}

        {budgets && (budgets.weeklyBudget != null || budgets.monthlyBudget != null) ? (
          <Card tier="panel" style={{ gap: theme.spacing.md }}>
            <ChartHeader icon="wallet" color={theme.colors.primary} label="Finance pacing" />
            {budgets.weeklyBudget != null ? (
              <FinanceSituationRow label="This week" spend={weekSpend} budget={budgets.weeklyBudget} currency={displayCurrency} />
            ) : null}
            {budgets.monthlyBudget != null ? (
              <FinanceSituationRow label="This month" spend={currentMonthSummary?.expense ?? 0} budget={budgets.monthlyBudget} currency={displayCurrency} />
            ) : null}
          </Card>
        ) : null}

        <ChartCard icon="flame" color={theme.colors.moduleHabits}>
          <TrendChart label={`Habit completions / day (${rangeLabel})`} data={data.habitsSeries} color={theme.colors.moduleHabits} />
        </ChartCard>
        <ChartCard icon="checkbox" color={theme.colors.moduleTasks}>
          <TrendChart label={`Tasks completed / day (${rangeLabel})`} data={data.tasksSeries} color={theme.colors.moduleTasks} />
        </ChartCard>

        {habitTotal > 0 ? (
          <Card style={{ alignItems: 'center', gap: theme.spacing.md }}>
            <ChartHeader icon="pie-chart" color={theme.colors.moduleHabits} label={`Habit check-ins (${rangeLabel})`} style={{ alignSelf: 'flex-start' }} />
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

        <ChartCard icon="happy" color={theme.colors.moduleJournal}>
          <LineChart label="Mood tracker (1–5)" data={data.moodSeries} color={theme.colors.moduleJournal} formatValue={(v) => v.toFixed(1)} />
        </ChartCard>

        {moodTotal > 0 ? (
          <Card style={{ gap: theme.spacing.sm }}>
            <ChartHeader icon="happy-outline" color={theme.colors.moduleJournal} label={`Mood breakdown (${rangeLabel})`} />
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

        <ChartCard icon="leaf" color={theme.colors.moduleJournal}>
          <TrendChart label="Meditation + breathing minutes / day" data={data.wellnessSeries} color={theme.colors.moduleJournal} />
        </ChartCard>

        <ChartCard icon="cash" color={theme.colors.danger}>
          <TrendChart label="Spending / day" data={spendSeries} color={theme.colors.danger} formatValue={(v) => formatCurrency(v, displayCurrency)} />
        </ChartCard>

        {data.mealBreakdown.length > 0 ? (
          <Card style={{ gap: theme.spacing.sm }}>
            <ChartHeader icon="restaurant" color={theme.colors.moduleTasks} label={`Calories by meal (${rangeLabel})`} />
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

        <ChartCard icon="flame-outline" color={theme.colors.primary}>
          <TrendChart label="Calories / day" data={data.caloriesSeries} color={theme.colors.primary} />
        </ChartCard>
        <ChartCard icon="nutrition" color={theme.colors.moduleTasks}>
          <TrendChart label="Protein (g) / day" data={data.proteinSeries} color={theme.colors.moduleTasks} />
        </ChartCard>
      </View>
    </ScreenContainer>
  );
}

function ChartHeader({
  icon,
  color,
  label,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }, style]}>
      <IconBadge name={icon} color={color} size="sm" />
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
        {label}
      </Text>
    </View>
  );
}

/** Wraps an existing chart component (TrendChart/LineChart/etc.) with a leading IconBadge, without
 * touching the chart itself — the chart keeps rendering its own internal label/value row. */
function ChartCard({ icon, color, children }: { icon: keyof typeof Ionicons.glyphMap; color: string; children: ReactNode }) {
  const theme = useAppTheme();
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md }}>
      <IconBadge name={icon} color={color} size="sm" />
      <View style={{ flex: 1 }}>{children}</View>
    </Card>
  );
}

function TrendRow({ label, color, invert, trend }: { label: string; color: string; invert?: boolean; trend: MetricTrend }) {
  const theme = useAppTheme();
  const delta = trend.average != null && trend.previousAverage != null ? trend.average - trend.previousAverage : null;
  const improved = delta == null ? null : invert ? delta <= 0 : delta >= 0;
  const deltaColor = improved == null ? theme.colors.textTertiary : improved ? theme.colors.success : theme.colors.danger;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{label}</Text>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
          {trend.average != null ? trend.average.toFixed(1) : '—'}
        </Text>
      </View>
      <Sparkline data={trend.series} color={color} />
      <Text style={{ color: deltaColor, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold, minWidth: 44, textAlign: 'right' }}>
        {delta != null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}` : '—'}
      </Text>
    </View>
  );
}

function FinanceSituationRow({ label, spend, budget, currency }: { label: string; spend: number; budget: number; currency: string }) {
  const theme = useAppTheme();
  const over = spend > budget;
  const progress = Math.min(spend / budget, 1);
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{label}</Text>
        <Text style={{ color: over ? theme.colors.danger : theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
          {formatCurrency(spend, currency)} / {formatCurrency(budget, currency)}
        </Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
        <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: over ? theme.colors.danger : theme.colors.success }} />
      </View>
    </View>
  );
}
