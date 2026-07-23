import { Ionicons } from '@expo/vector-icons';
import { Link, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Card, EmptyState, ScreenContainer, StatCard } from '@/components';
import { formatDisplayDate, monthLabel, todayKey } from '@/lib/date';
import { formatCurrency, formatCurrencyCompact, useFinanceBudgets, useFinanceMonth, useFinanceWeekSpend } from '@/modules/finance';
import { useAppTheme } from '@/theme';

export default function FinanceScreen() {
  const theme = useAppTheme();
  const today = todayKey();
  const [todayYear, todayMonthNum] = today.split('-').map(Number);
  const currentMonthIndex = todayMonthNum - 1;
  const [cursor, setCursor] = useState({ year: todayYear, month: currentMonthIndex });

  const { transactions, loading, totals, categoryBreakdown } = useFinanceMonth(cursor.year, cursor.month);
  const { totals: currentMonthTotals } = useFinanceMonth(todayYear, currentMonthIndex);
  const { weekSpend } = useFinanceWeekSpend();
  const { budgets, setBudgets } = useFinanceBudgets();

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

        {budgets ? (
          <Card style={{ gap: theme.spacing.lg }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Budgets
            </Text>
            <BudgetRow label="This week" spend={weekSpend} budget={budgets.weeklyBudget} onSetBudget={(v) => setBudgets({ weeklyBudget: v })} />
            <BudgetRow
              label="This month"
              spend={currentMonthTotals.expense}
              budget={budgets.monthlyBudget}
              onSetBudget={(v) => setBudgets({ monthlyBudget: v })}
            />
          </Card>
        ) : null}

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

function BudgetRow({
  label,
  spend,
  budget,
  onSetBudget,
}: {
  label: string;
  spend: number;
  budget: number | null;
  onSetBudget: (value: number | null) => void;
}) {
  const theme = useAppTheme();
  const [text, setText] = useState(budget != null ? String(budget) : '');
  const over = budget != null && spend > budget;
  const progress = budget ? Math.min(spend / budget, 1) : 0;

  const commit = () => {
    const parsed = Number(text);
    onSetBudget(text.trim() && !Number.isNaN(parsed) ? parsed : null);
  };

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ color: over ? theme.colors.danger : theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
            {formatCurrency(spend)}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>/</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            onBlur={commit}
            placeholder="no budget"
            placeholderTextColor={theme.colors.textTertiary}
            keyboardType="decimal-pad"
            style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, minWidth: 60, padding: 0 }}
          />
        </View>
      </View>
      {budget ? (
        <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
          <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: over ? theme.colors.danger : theme.colors.success }} />
        </View>
      ) : null}
    </View>
  );
}
