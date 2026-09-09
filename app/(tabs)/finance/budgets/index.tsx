import { Ionicons } from '@expo/vector-icons';
import { Link, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, EmptyState, IconBadge, LoadingState, ProgressBar, RangeChip, ScreenContainer, showAlert } from '@/components';
import {
  BUDGET_PERIOD_LABELS,
  BUDGET_STATUS_LABELS,
  formatCurrency,
  useAccounts,
  useFinanceBudgetPlans,
  useFinanceCategories,
  type BudgetPeriod,
  type BudgetStatus,
} from '@/modules/finance';
import { useAppTheme } from '@/theme';

const PERIODS: BudgetPeriod[] = ['weekly', 'monthly', 'yearly', 'one_time'];

const STATUS_COLORS: Record<BudgetStatus, string> = {
  on_track: '#34C759',
  trending_over: '#FF9500',
  over_budget: '#FF3B30',
};

export default function BudgetsScreen() {
  const theme = useAppTheme();
  const { plans, loading, removeBudgetPlan } = useFinanceBudgetPlans();
  const { categories } = useFinanceCategories();
  const { displayCurrency } = useAccounts();
  const [period, setPeriod] = useState<BudgetPeriod>('monthly');

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const filtered = plans.filter((p) => p.period === period);
  const totalBudget = filtered.reduce((sum, p) => sum + p.amount, 0);
  const totalSpent = filtered.reduce((sum, p) => sum + p.spent, 0);

  const onDelete = (planId: string) => {
    showAlert('Delete budget?', 'This removes the budget plan.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeBudgetPlan(planId) },
    ]);
  };

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/finance/budgets/new" asChild>
              <Pressable hitSlop={8}>
                <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
              </Pressable>
            </Link>
          ),
        }}
      />
      <View style={{ gap: theme.spacing.xl }}>
        <View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
            Budgets
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>Status as of today</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {PERIODS.map((option) => (
            <RangeChip key={option} label={BUDGET_PERIOD_LABELS[option]} selected={period === option} onPress={() => setPeriod(option)} />
          ))}
        </View>

        {filtered.length === 0 ? (
          <EmptyState
            icon="albums-outline"
            title={`No ${BUDGET_PERIOD_LABELS[period].toLowerCase()} budgets`}
            subtitle="Set a spending limit for a period, optionally scoped to one category."
          />
        ) : (
          <>
            <Card tier="panel" style={{ gap: 4 }}>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Total spend</Text>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
                {formatCurrency(totalSpent, displayCurrency)} of {formatCurrency(totalBudget, displayCurrency)}
              </Text>
            </Card>
            <View style={{ gap: theme.spacing.md }}>
              {filtered.map((plan) => {
                const category = plan.category_id ? categories.find((c) => c.id === plan.category_id) : null;
                const progress = Math.min(plan.spent / plan.amount, 1);
                const forecastPercent = Math.round((plan.forecastSpend / plan.amount) * 100);
                const statusColor = STATUS_COLORS[plan.status];
                return (
                  <Link key={plan.id} href={{ pathname: '/finance/budgets/[id]', params: { id: plan.id } }} asChild>
                    <Pressable>
                      <Card tier="elevated" style={{ gap: theme.spacing.sm }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                          <IconBadge name={(category?.icon as never) ?? 'albums-outline'} color={category?.color ?? theme.colors.primary} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                              {plan.name}
                            </Text>
                            {category ? (
                              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{category.name}</Text>
                            ) : null}
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                              {formatCurrency(plan.spent, displayCurrency)}
                            </Text>
                            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                              of {formatCurrency(plan.amount, displayCurrency)}
                            </Text>
                          </View>
                          <Pressable onPress={() => onDelete(plan.id)} hitSlop={8}>
                            <Ionicons name="trash-outline" size={16} color={theme.colors.textTertiary} />
                          </Pressable>
                        </View>
                        <ProgressBar progress={progress} color={statusColor} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View
                            style={{
                              paddingHorizontal: theme.spacing.sm,
                              paddingVertical: 3,
                              borderRadius: theme.radius.full,
                              backgroundColor: `${statusColor}22`,
                            }}>
                            <Text style={{ color: statusColor, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
                              {BUDGET_STATUS_LABELS[plan.status]}
                            </Text>
                          </View>
                          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                            Forecasted spend at end: {forecastPercent}%
                          </Text>
                        </View>
                      </Card>
                    </Pressable>
                  </Link>
                );
              })}
            </View>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}
