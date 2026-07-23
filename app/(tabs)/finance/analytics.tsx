import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, DonutChart, EmptyState, LoadingState, ScreenContainer, StatCard } from '@/components';
import { monthLabel, todayKey } from '@/lib/date';
import { formatCurrency, formatCurrencyCompact, useFinanceSummary } from '@/modules/finance';
import { useAppTheme } from '@/theme';

export default function FinanceAnalyticsScreen() {
  const theme = useAppTheme();
  const today = todayKey();
  const [cursor, setCursor] = useState(() => {
    const [year, month] = today.split('-').map(Number);
    return { year, month: month - 1 };
  });

  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const { summary, loading } = useFinanceSummary(`${monthPrefix}-01`, `${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`);

  const onChangeMonth = (delta: number) => {
    setCursor((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  if (loading || !summary) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const total = summary.expenseByCategory.reduce((sum, c) => sum + c.total, 0);

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => onChangeMonth(-1)} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.textSecondary} />
          </Pressable>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
            {monthLabel(cursor.year, cursor.month)}
          </Text>
          <Pressable onPress={() => onChangeMonth(1)} hitSlop={8}>
            <Ionicons name="chevron-forward" size={22} color={theme.colors.textSecondary} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <StatCard label="Income" value={formatCurrencyCompact(summary.income)} color={theme.colors.success} />
          <StatCard label="Expenses" value={formatCurrencyCompact(summary.expense)} color={theme.colors.danger} />
          <StatCard label="Net" value={formatCurrencyCompact(summary.income - summary.expense)} color={summary.income >= summary.expense ? theme.colors.success : theme.colors.danger} />
        </View>

        {summary.expenseByCategory.length === 0 ? (
          <EmptyState icon="pie-chart-outline" title="No expenses this month" />
        ) : (
          <Card style={{ alignItems: 'center', gap: theme.spacing.lg }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold, alignSelf: 'flex-start' }}>
              Expenses by category
            </Text>
            <DonutChart
              segments={summary.expenseByCategory.map((c) => ({ value: c.total, color: c.color }))}
              centerLabel={formatCurrencyCompact(total)}
              centerSubLabel="total"
            />
            <View style={{ width: '100%', gap: theme.spacing.sm }}>
              {summary.expenseByCategory.map((category) => (
                <View key={category.name} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: category.color }} />
                      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{category.name}</Text>
                    </View>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                      {formatCurrency(category.total)}
                    </Text>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
                    <View style={{ width: `${(category.total / total) * 100}%`, height: '100%', backgroundColor: category.color }} />
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}
      </View>
    </ScreenContainer>
  );
}
