import { Card, DonutChart, Legend, LoadingState, ScreenContainer, TrendChart } from '@/components';
import { formatDisplayDate } from '@/lib/date';
import { useFoodWeekAnalytics } from '@/modules/food';
import { useAppTheme } from '@/theme';
import { Text, View } from 'react-native';

export default function FoodAnalyticsScreen() {
  const theme = useAppTheme();
  const { days, totals, dailyAverageCalories, loading } = useFoodWeekAnalytics();

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const macroTotal = totals.protein + totals.carbs + totals.fat;

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Card style={{ gap: 4 }}>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Daily average</Text>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
            {dailyAverageCalories} cal
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
            {Math.round(totals.calories)} cal total over the last 7 days
          </Text>
        </Card>

        <Card>
          <TrendChart
            label="Calories per day (last 7 days)"
            data={days.map((d) => ({ date: formatDisplayDate(d.date), value: d.calories }))}
            color={theme.colors.moduleTasks}
          />
        </Card>

        <Card style={{ alignItems: 'center', gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Macros this week
          </Text>
          {macroTotal > 0 ? (
            <>
              <DonutChart
                segments={[
                  { value: totals.protein, color: theme.colors.success },
                  { value: totals.carbs, color: theme.colors.primary },
                  { value: totals.fat, color: theme.colors.warning },
                ]}
                centerLabel={`${Math.round(macroTotal)}g`}
                centerSubLabel="total"
              />
              <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
                <Legend color={theme.colors.success} label={`Protein ${Math.round(totals.protein)}g`} />
                <Legend color={theme.colors.primary} label={`Carbs ${Math.round(totals.carbs)}g`} />
                <Legend color={theme.colors.warning} label={`Fat ${Math.round(totals.fat)}g`} />
              </View>
            </>
          ) : (
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>No food logged this week yet.</Text>
          )}
        </Card>
      </View>
    </ScreenContainer>
  );
}
