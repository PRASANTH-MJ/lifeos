import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { Card, EmptyState, IconBadge, LoadingState, ScreenContainer, UpsellModal } from '@/components';
import { useMealPlanSync, useMealPlans } from '@/modules/food';
import { healthGoalToContentGoal, useUserDetails } from '@/modules/onboarding';
import { useProfile } from '@/modules/profile';
import { useAppTheme } from '@/theme';

const GOAL_LABELS: Record<string, string> = {
  general: 'General',
  'weight-loss': 'Weight Loss',
  'muscle-building': 'Muscle Building',
};
const DIET_LABELS: Record<string, string> = { veg: 'Vegetarian', 'non-veg': 'Non-Vegetarian', mixed: 'Mixed' };
const BUDGET_LABELS: Record<string, string> = { budget: 'Budget', moderate: 'Moderate', premium: 'Premium' };

export default function MealPlansScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { plans, loading, refresh } = useMealPlans();
  const { syncing, error, syncNow } = useMealPlanSync();
  const { details } = useUserDetails();
  const { profile } = useProfile();
  const recommendedGoal = healthGoalToContentGoal(details?.healthGoal ?? null);
  const [showUpsell, setShowUpsell] = useState(false);

  const sorted = useMemo(
    () => [...plans].sort((a, b) => Number(b.goal === recommendedGoal) - Number(a.goal === recommendedGoal)),
    [plans, recommendedGoal]
  );

  const onRefresh = async () => {
    await syncNow();
    await refresh();
  };

  return (
    <ScreenContainer scroll={false}>
      <Stack.Screen options={{ title: 'Meal Plans' }} />
      {loading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.key}
          refreshControl={<RefreshControl refreshing={syncing} onRefresh={onRefresh} />}
          contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.xl }}
          ListHeaderComponent={
            error ? (
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, marginBottom: theme.spacing.sm }}>
                {error}
              </Text>
            ) : null
          }
          ListEmptyComponent={<EmptyState icon="restaurant-outline" title="No meal plans yet" subtitle="Pull down to sync." />}
          renderItem={({ item }) => {
            const recommended = item.goal === recommendedGoal;
            const locked = !profile?.premium;
            const onPress = () => {
              if (locked) setShowUpsell(true);
              else router.push({ pathname: '/food/plans/[key]', params: { key: item.key } });
            };
            return (
              <Pressable onPress={onPress}>
                <Card tier="elevated" style={{ gap: theme.spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                    <IconBadge name="restaurant-outline" color={theme.colors.moduleTasks} size="sm" />
                    <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.bold }}>
                      {item.title}
                    </Text>
                    {locked ? <Ionicons name="lock-closed" size={16} color={theme.colors.textTertiary} /> : null}
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                  </View>
                  {locked ? (
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: 3,
                        borderRadius: theme.radius.full,
                        backgroundColor: theme.colors.warningMuted,
                      }}>
                      <Text style={{ color: theme.colors.warning, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
                        Pro
                      </Text>
                    </View>
                  ) : recommended ? (
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: 3,
                        borderRadius: theme.radius.full,
                        backgroundColor: theme.colors.primaryMuted,
                      }}>
                      <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
                        Recommended for you
                      </Text>
                    </View>
                  ) : null}
                  <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{item.description}</Text>
                  <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                    {GOAL_LABELS[item.goal] ?? item.goal} · {DIET_LABELS[item.diet] ?? item.diet} · {BUDGET_LABELS[item.budgetTier] ?? item.budgetTier}
                    {item.dailyCaloriesTarget ? ` · ~${item.dailyCaloriesTarget} kcal/day` : ''}
                  </Text>
                </Card>
              </Pressable>
            );
          }}
        />
      )}
      <UpsellModal
        visible={showUpsell}
        message="Meal plans are a Pro feature. Go Pro to unlock the full meal plan library — your daily food logging stays free either way."
        onClose={() => setShowUpsell(false)}
      />
    </ScreenContainer>
  );
}
