import { Ionicons } from '@expo/vector-icons';
import { Link, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, EmptyState, ScreenContainer, StatCard } from '@/components';
import { formatDisplayDate, monthLabel, todayKey } from '@/lib/date';
import { formatCurrency, formatCurrencyCompact, useFinanceMonth } from '@/modules/finance';
import { useAppTheme } from '@/theme';

export default function FinanceScreen() {
  const theme = useAppTheme();
  const today = todayKey();
  const [cursor, setCursor] = useState(() => {
    const [year, month] = today.split('-').map(Number);
    return { year, month: month - 1 };
  });

  const { transactions, loading, totals, categoryBreakdown } = useFinanceMonth(cursor.year, cursor.month);

  const onChangeMonth = (delta: number) => {
    setCursor((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/finance/new" asChild>
              <Pressable hitSlop={8}>
                <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
              </Pressable>
            </Link>
          ),
        }}
      />
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
          <StatCard label="Income" value={formatCurrencyCompact(totals.income)} color={theme.colors.success} />
          <StatCard label="Expenses" value={formatCurrencyCompact(totals.expense)} color={theme.colors.danger} />
          <StatCard label="Net" value={formatCurrencyCompact(totals.net)} color={totals.net >= 0 ? theme.colors.success : theme.colors.danger} />
        </View>

        {categoryBreakdown.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              By category
            </Text>
            <Card style={{ gap: theme.spacing.sm }}>
              {categoryBreakdown.map(({ category, total }) => (
                <View key={category} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{category}</Text>
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                    {formatCurrency(total)}
                  </Text>
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            Transactions
          </Text>
          {!loading && transactions.length === 0 ? (
            <EmptyState icon="cash-outline" title="No transactions this month" />
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {transactions.map((transaction) => (
                <Link key={transaction.id} href={{ pathname: '/finance/[id]', params: { id: String(transaction.id) } }} asChild>
                  <Pressable>
                    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                      <Ionicons
                        name={transaction.type === 'income' ? 'arrow-down-circle' : 'arrow-up-circle'}
                        size={22}
                        color={transaction.type === 'income' ? theme.colors.success : theme.colors.danger}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                          {transaction.category}
                        </Text>
                        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                          {formatDisplayDate(transaction.date)}
                          {transaction.note ? ` · ${transaction.note}` : ''}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: transaction.type === 'income' ? theme.colors.success : theme.colors.textPrimary,
                          fontSize: theme.typography.size.base,
                          fontWeight: theme.typography.weight.semibold,
                        }}>
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </Text>
                    </Card>
                  </Pressable>
                </Link>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}
