import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { Card, EmptyState, IconBadge, LoadingState, ScreenContainer } from '@/components';
import { findMealPlan, mealLabel, useMealPlans } from '@/modules/food';
import { useProfile } from '@/modules/profile';
import { useAppTheme } from '@/theme';

const MEAL_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'sunny-outline',
  lunch: 'restaurant-outline',
  dinner: 'moon-outline',
  snack: 'cafe-outline',
};

export default function MealPlanDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { plans, loading } = useMealPlans();
  const { profile } = useProfile();
  const plan = findMealPlan(plans, key ?? '');

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (!plan) {
    return (
      <ScreenContainer>
        <EmptyState icon="alert-circle-outline" title="Meal plan not found" />
      </ScreenContainer>
    );
  }

  if (!profile?.premium) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: plan.title }} />
        <EmptyState
          icon="lock-closed"
          title="This is a Pro meal plan"
          subtitle="Go Pro to unlock the full meal plan library."
          ctaLabel="Go Pro"
          onPressCta={() => router.push('/premium')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false}>
      <Stack.Screen options={{ title: plan.title }} />
      <ScrollView contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{plan.description}</Text>
        {plan.dailyCaloriesTarget ? (
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
            Target: ~{plan.dailyCaloriesTarget} kcal/day — a starting point, adjust to your own needs.
          </Text>
        ) : null}

        {plan.days.map((day) => {
          const dayTotal = day.items.reduce((sum, item) => sum + (item.calories ?? 0), 0);
          return (
            <Card key={day.key} tier="panel" style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
                  {day.title}
                </Text>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{dayTotal} kcal</Text>
              </View>
              {day.items.map((item, index) => (
                <Card key={`${item.meal}-${index}`} tier="elevated" style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <IconBadge name={MEAL_ICONS[item.meal] ?? 'restaurant-outline'} color={theme.colors.moduleTasks} size="sm" />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold, textTransform: 'uppercase' }}>
                      {mealLabel(item.meal)}
                    </Text>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                      {item.dishName}
                    </Text>
                    {item.calories != null ? (
                      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                        {item.calories} kcal · {item.proteinG}g protein · {item.carbsG}g carbs · {item.fatG}g fat
                      </Text>
                    ) : null}
                  </View>
                </Card>
              ))}
            </Card>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}
