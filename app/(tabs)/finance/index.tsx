import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Card, EmptyState, LoadingState, ScreenContainer, StatCard } from '@/components';
import { formatDisplayDate, todayKey } from '@/lib/date';
import {
  ACCOUNT_TYPE_LABELS,
  formatCurrency,
  formatCurrencyCompact,
  useAccounts,
  useFinanceBudgets,
  useFinanceSummary,
  useFinanceWeekSpend,
  useTransactions,
  type AccountType,
} from '@/modules/finance';
import { useAppTheme } from '@/theme';

const TYPE_ORDER: AccountType[] = ['cash', 'general', 'investment', 'credit'];
const TYPE_ICON: Record<AccountType, keyof typeof Ionicons.glyphMap> = {
  cash: 'cash-outline',
  general: 'wallet-outline',
  investment: 'trending-up-outline',
  credit: 'card-outline',
};

export default function FinanceScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { accounts, accountsByType, netWorth, loading } = useAccounts();
  const { transactions, loading: loadingTransactions } = useTransactions();
  const { budgets, setBudgets } = useFinanceBudgets();
  const { weekSpend } = useFinanceWeekSpend();
  const today = todayKey();
  const monthPrefix = today.slice(0, 7);
  const daysInMonth = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate();
  const { summary: monthSummary } = useFinanceSummary(`${monthPrefix}-01`, `${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`);

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/finance/accounts/new" asChild>
              <Pressable hitSlop={8}>
                <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
              </Pressable>
            </Link>
          ),
        }}
      />
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
          Finance
        </Text>

        <StatCard label="Net worth" value={formatCurrencyCompact(netWorth)} color={netWorth >= 0 ? theme.colors.success : theme.colors.danger} />

        {budgets ? (
          <Card style={{ gap: theme.spacing.lg }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Budgets
            </Text>
            <BudgetRow label="This week" spend={weekSpend} budget={budgets.weeklyBudget} onSetBudget={(v) => setBudgets({ weeklyBudget: v })} />
            <BudgetRow
              label="This month"
              spend={monthSummary?.expense ?? 0}
              budget={budgets.monthlyBudget}
              onSetBudget={(v) => setBudgets({ monthlyBudget: v })}
            />
          </Card>
        ) : null}

        {accounts.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            title="No accounts yet"
            subtitle="Add a cash, bank, investment, or credit account to start tracking."
            ctaLabel="Add your first account"
            onPressCta={() => router.push('/finance/accounts/new')}
          />
        ) : (
          <View style={{ gap: theme.spacing.lg }}>
            {TYPE_ORDER.filter((type) => accountsByType.get(type)?.length).map((type) => (
              <View key={type} style={{ gap: theme.spacing.sm }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                  {ACCOUNT_TYPE_LABELS[type]}
                </Text>
                {(accountsByType.get(type) ?? []).map((account) => (
                  <Card key={account.id} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: theme.radius.md,
                        backgroundColor: theme.colors.primaryMuted,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Ionicons name={TYPE_ICON[type]} size={19} color={theme.colors.primary} />
                    </View>
                    <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                      {account.name}
                    </Text>
                    <Text
                      style={{
                        color: account.current_balance >= 0 ? theme.colors.textPrimary : theme.colors.danger,
                        fontSize: theme.typography.size.base,
                        fontWeight: theme.typography.weight.semibold,
                      }}>
                      {formatCurrency(account.current_balance, account.currency)}
                    </Text>
                  </Card>
                ))}
              </View>
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <Link href="/finance/new" asChild>
            <Pressable style={{ flex: 1 }}>
              <Card style={{ alignItems: 'center', gap: 4 }}>
                <Ionicons name="add-circle-outline" size={22} color={theme.colors.primary} />
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                  Add transaction
                </Text>
              </Card>
            </Pressable>
          </Link>
          <Link href="/finance/analytics" asChild>
            <Pressable style={{ flex: 1 }}>
              <Card style={{ alignItems: 'center', gap: 4 }}>
                <Ionicons name="pie-chart-outline" size={22} color={theme.colors.primary} />
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                  Analytics
                </Text>
              </Card>
            </Pressable>
          </Link>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            Recent transactions
          </Text>
          {!loadingTransactions && transactions.length === 0 ? (
            <EmptyState icon="receipt-outline" title="No transactions yet" />
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {transactions.slice(0, 10).map((transaction) => {
                const account = accounts.find((a) => a.id === transaction.account_id);
                const isTransfer = transaction.type === 'transfer';
                return (
                  <Link key={transaction.id} href={{ pathname: '/finance/[id]', params: { id: transaction.id } }} asChild>
                    <Pressable>
                      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                        <Ionicons
                          name={isTransfer ? 'swap-horizontal' : transaction.type === 'income' ? 'arrow-down-circle' : 'arrow-up-circle'}
                          size={22}
                          color={isTransfer ? theme.colors.primary : transaction.type === 'income' ? theme.colors.success : theme.colors.danger}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                            {isTransfer ? 'Transfer' : account?.name ?? 'Account'}
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
                          {transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : ''}
                          {formatCurrency(transaction.amount, account?.currency)}
                        </Text>
                      </Card>
                    </Pressable>
                  </Link>
                );
              })}
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
