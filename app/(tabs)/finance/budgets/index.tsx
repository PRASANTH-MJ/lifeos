import { Ionicons } from '@expo/vector-icons';
import { Link, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Card, EmptyState, LoadingState, RangeChip, ScreenContainer } from '@/components';
import { BUDGET_PERIOD_LABELS, BUDGET_STATUS_LABELS, formatCurrency, useFinanceBudgetPlans, useFinanceCategories, type BudgetPeriod, type BudgetStatus } from '@/modules/finance';
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
    Alert.alert('Delete budget?', 'This removes the budget plan.', [
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
            <Card style={{ gap: 4 }}>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Total spend</Text>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
                {formatCurrency(totalSpent)} of {formatCurrency(totalBudget)}
              </Text>
            </Card>
            <View style={{ gap: theme.spacing.md }}>
              {filtered.map((plan) => {
                const category = plan.category_id ? categories.find((c) => c.id === plan.category_id) : null;
                const progress = Math.min(plan.spent / plan.amount, 1);
                const forecastPercent = Math.round((plan.forecastSpend / plan.amount) * 100);
                return (
                  <Link key={plan.id} href={{ pathname: '/finance/budgets/[id]', params: { id: plan.id } }} asChild>
                    <Pressable>
                      <Card style={{ gap: theme.spacing.sm }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                            {plan.name}
                            {category ? ` · ${category.name}` : ''}
                          </Text>
                          <Pressable onPress={() => onDelete(plan.id)} hitSlop={8}>
                            <Ionicons name="trash-outline" size={16} color={theme.colors.textTertiary} />
                          </Pressable>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{formatCurrency(plan.spent)}</Text>
                          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>of {formatCurrency(plan.amount)}</Text>
                        </View>
                        <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
                          <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: STATUS_COLORS[plan.status] }} />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: STATUS_COLORS[plan.status] }} />
                            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs }}>{BUDGET_STATUS_LABELS[plan.status]}</Text>
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
