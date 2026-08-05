import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { Card } from '@/components';
import { useAppTheme } from '@/theme';
import { correlationCoefficient, percentChange } from './AnalyticsService';
import type { DashboardData } from './useDashboard';
import { nearestMoodLabel } from './useDashboard';
import type { PreviousPeriodStats } from './usePreviousPeriodStats';

/**
 * Generates a handful of short, plain-language coaching lines from real computed data — every
 * claim here traces back to an actual comparison or correlation in `data`/`previous`, never a
 * fabricated goal or streak Flowsy doesn't actually track.
 */
export function generateActionableInsights(
  data: DashboardData,
  previous: PreviousPeriodStats | null,
  rangeLabel: string,
  spendTotal: number
): string[] {
  const insights: string[] = [];

  if (previous) {
    const taskChange = percentChange(data.tasksCompletedTotal, previous.tasksCompletedTotal);
    if (taskChange != null && Math.abs(taskChange) >= 10) {
      insights.push(
        `✅ You completed ${taskChange > 0 ? 'more' : 'fewer'} tasks this ${rangeLabel} (${taskChange > 0 ? '+' : ''}${Math.round(taskChange)}% vs last ${rangeLabel}).`
      );
    }

    if (data.avgMood != null && previous.avgMood != null) {
      const moodChange = data.avgMood - previous.avgMood;
      if (Math.abs(moodChange) >= 0.3) {
        insights.push(`${moodChange > 0 ? '🙂' : '😕'} Your average mood is ${moodChange > 0 ? 'up' : 'down'} vs last ${rangeLabel} (${nearestMoodLabel(data.avgMood)} now).`);
      }
    }

    const wellnessChange = percentChange(data.wellnessMinutesTotal, previous.wellnessMinutesTotal);
    if (wellnessChange != null && wellnessChange >= 20 && data.wellnessMinutesTotal > 0) {
      insights.push(`🧘 Meditation + breathing time is up ${Math.round(wellnessChange)}% vs last ${rangeLabel}.`);
    }

    const spendChange = percentChange(spendTotal, previous.spend);
    if (spendChange != null && Math.abs(spendChange) >= 15 && (spendTotal > 0 || previous.spend > 0)) {
      insights.push(`💰 Spending is ${spendChange > 0 ? 'up' : 'down'} ${Math.abs(Math.round(spendChange))}% vs last ${rangeLabel}.`);
    }
  }

  const habitTotal = data.habitStatusBreakdown.done + data.habitStatusBreakdown.fail;
  if (habitTotal >= 3) {
    const rate = Math.round((data.habitStatusBreakdown.done / habitTotal) * 100);
    if (rate >= 80) insights.push(`🔥 Strong habit consistency this ${rangeLabel} — ${rate}% of check-ins done.`);
    else if (rate <= 40) insights.push(`⚠️ Habit check-ins are low this ${rangeLabel} (${rate}% done) — worth a smaller target?`);
  }

  const correlation = correlationCoefficient(data.tasksSeries.map((p) => p.value), data.moodSeries.map((p) => p.value));
  if (Math.abs(correlation) >= 0.4 && data.tasksSeries.length >= 5) {
    insights.push(
      correlation > 0
        ? '🔗 Your mood tends to be higher on days you complete more tasks.'
        : '🔗 Your mood tends to be lower on days you complete more tasks — worth watching for overload.'
    );
  }

  if (insights.length === 0) {
    insights.push(`Keep logging — once there's a bit more history, insights for this ${rangeLabel} will show up here.`);
  }

  return insights.slice(0, 4);
}

export function ActionableInsights({ insights }: { insights: string[] }) {
  const theme = useAppTheme();
  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Ionicons name="sparkles" size={18} color={theme.colors.primary} />
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
          What's standing out
        </Text>
      </View>
      {insights.map((line, index) => (
        <Text key={index} style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, lineHeight: 20 }}>
          {line}
        </Text>
      ))}
    </Card>
  );
}
