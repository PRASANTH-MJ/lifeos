import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, EmptyState, IconBadge, LoadingState, ProgressBar, ReminderCard, ScreenContainer, UpsellModal, useTabSwipeNavigation } from '@/components';
import { formatDisplayDate, todayKey } from '@/lib/date';
import {
  ACCOUNT_TYPE_LABELS,
  formatCurrency,
  formatCurrencyCompact,
  useAccounts,
  useFinanceBudgetPlans,
  useFinanceBudgets,
  useFinanceCategories,
  useFinanceSummary,
  useFinanceWeekSpend,
  useSpendingAnomalies,
  useSplitExpenses,
  useTransactions,
  type AccountType,
  type BudgetPlanProgress,
} from '@/modules/finance';
import { LIMIT_LABELS, useFreeTierGate } from '@/modules/premium';
import { useModuleReminders } from '@/modules/reminders';
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
  const swipeHandlers = useTabSwipeNavigation('/finance');
  const { accounts, accountsByType, netWorth, displayCurrency, loading, refresh } = useAccounts();
  const { transactions, loading: loadingTransactions, refresh: refreshTransactions } = useTransactions();
  const { budgets, setBudgets, refresh: refreshBudgets } = useFinanceBudgets();
  const { weekSpend, refresh: refreshWeekSpend } = useFinanceWeekSpend();
  const { anomalies } = useSpendingAnomalies();
  const { plans: budgetPlans, refresh: refreshBudgetPlans } = useFinanceBudgetPlans();
  const { categories } = useFinanceCategories();
  const { iOwe, owedToMe } = useSplitExpenses();
  const accountGate = useFreeTierGate('financeAccounts');
  const [showUpsell, setShowUpsell] = useState(false);
  const transactionGate = useFreeTierGate('financeTransactions');
  const [showTransactionUpsell, setShowTransactionUpsell] = useState(false);
  const { reminders, save: saveReminder, addReminder, removeReminder } = useModuleReminders('finance', 'Log your spending', "Don't forget to log today's transactions.");

  // Modal renders as a top-level overlay regardless of which tab is focused, so a sheet left
  // open here would otherwise keep floating over whichever tab you switch to next.
  useFocusEffect(
    useCallback(() => {
      return () => setShowUpsell(false);
    }, [])
  );
  const today = todayKey();
  const monthPrefix = today.slice(0, 7);
  const daysInMonth = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate();
  const { summary: monthSummary, refresh: refreshSummary } = useFinanceSummary(
    `${monthPrefix}-01`,
    `${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`
  );

  const refreshAll = async () => {
    await Promise.all([refresh(), refreshTransactions(), refreshBudgets(), refreshWeekSpend(), refreshSummary(), refreshBudgetPlans()]);
  };

  const onAddAccount = () => {
    if (accountGate.allowed) router.push('/finance/accounts/new');
    else setShowUpsell(true);
  };

  const onAddTransaction = () => {
    if (transactionGate.allowed) router.push('/finance-new');
    else setShowTransactionUpsell(true);
  };

  if (loading) {
    return (
      <View style={{ flex: 1 }} {...swipeHandlers}>
        <ScreenContainer>
          <LoadingState />
        </ScreenContainer>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }} {...swipeHandlers}>
    <ScreenContainer onRefresh={refreshAll}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable hitSlop={8} onPress={onAddAccount}>
              <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
            </Pressable>
          ),
        }}
      />
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
          Finance
        </Text>

        <Card tier="panel" glow style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Net worth
          </Text>
          <Text
            style={{
              color: netWorth >= 0 ? theme.colors.textPrimary : theme.colors.danger,
              fontSize: theme.typography.size['3xl'] * 1.5,
              fontWeight: theme.typography.weight.bold,
            }}>
            {formatCurrencyCompact(netWorth, displayCurrency)}
          </Text>
        </Card>

        {anomalies.length > 0 ? (
          <Card tier="panel" style={{ gap: theme.spacing.sm, borderColor: theme.colors.warning, borderWidth: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <IconBadge name="warning-outline" color={theme.colors.warning} size="sm" />
              <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                Unusual spending
              </Text>
            </View>
            {anomalies.slice(0, 3).map((anomaly) => (
              <Text key={anomaly.categoryId ?? 'uncategorized'} style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
                You&apos;ve spent {anomaly.ratio.toFixed(1)}x your usual on {anomaly.categoryName} this week.
              </Text>
            ))}
          </Card>
        ) : null}

        {budgets ? (
          <Card tier="panel" style={{ gap: theme.spacing.md }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Budgets
            </Text>
            <BudgetRow
              label="This week"
              icon="calendar-outline"
              spend={weekSpend}
              budget={budgets.weeklyBudget}
              currency={displayCurrency}
              onSetBudget={(v) => setBudgets({ weeklyBudget: v })}
            />
            <BudgetRow
              label="This month"
              icon="cash-outline"
              spend={monthSummary?.expense ?? 0}
              budget={budgets.monthlyBudget}
              currency={displayCurrency}
              onSetBudget={(v) => setBudgets({ monthlyBudget: v })}
            />
          </Card>
        ) : null}

        {budgetPlans.length > 0 ? (
          <Card tier="panel" style={{ gap: theme.spacing.md }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Category budgets
            </Text>
            {budgetPlans.map((plan) => (
              <CategoryBudgetRow
                key={plan.id}
                plan={plan}
                categoryName={categories.find((c) => c.id === plan.category_id)?.name ?? null}
                currency={displayCurrency}
              />
            ))}
          </Card>
        ) : null}

        {iOwe.length > 0 || owedToMe.length > 0 ? (
          <Link href="/finance/splits" asChild>
            <Pressable>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xl }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs }}>You owe</Text>
                  <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
                    {formatCurrency(iOwe.filter((s) => !s.settled).reduce((sum, s) => sum + s.amount, 0), displayCurrency)}
                  </Text>
                </View>
                <View style={{ width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: theme.colors.border }} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs }}>You&apos;re owed</Text>
                  <Text style={{ color: theme.colors.success, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
                    {formatCurrency(owedToMe.filter((s) => !s.settled).reduce((sum, s) => sum + s.amount, 0), displayCurrency)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
              </Card>
            </Pressable>
          </Link>
        ) : null}

        {accounts.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            title="No accounts yet"
            subtitle="Add a cash, bank, investment, or credit account to start tracking."
            ctaLabel="Add your first account"
            onPressCta={onAddAccount}
          />
        ) : (
          <View style={{ gap: theme.spacing.lg }}>
            {TYPE_ORDER.filter((type) => accountsByType.get(type)?.length).map((type) => (
              <View key={type} style={{ gap: theme.spacing.sm }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                  {ACCOUNT_TYPE_LABELS[type]}
                </Text>
                {(accountsByType.get(type) ?? []).map((account) => (
                  <Link key={account.id} href={{ pathname: '/finance/accounts/[id]', params: { id: account.id } }} asChild>
                    <Pressable>
                      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                        <IconBadge name={TYPE_ICON[type]} color={theme.colors.primary} />
                        <Text
                          style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                          {account.name}
                        </Text>
                        <Text
                          style={{
                            color: account.current_balance >= 0 ? theme.colors.success : theme.colors.danger,
                            fontSize: theme.typography.size.base,
                            fontWeight: theme.typography.weight.semibold,
                          }}>
                          {formatCurrency(account.current_balance, account.currency)}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
                      </Card>
                    </Pressable>
                  </Link>
                ))}
              </View>
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Pressable style={{ flex: 1 }} onPress={onAddTransaction}>
            <Card style={{ alignItems: 'center', gap: theme.spacing.sm }}>
              <IconBadge name="add-circle-outline" color={theme.colors.primary} size="lg" />
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                Add transaction
              </Text>
            </Card>
          </Pressable>
          <Link href="/finance/analytics" asChild>
            <Pressable style={{ flex: 1 }}>
              <Card style={{ alignItems: 'center', gap: theme.spacing.sm }}>
                <IconBadge name="pie-chart-outline" color={theme.colors.primary} size="lg" />
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                  Analytics
                </Text>
              </Card>
            </Pressable>
          </Link>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
          {[
            { href: '/finance/records' as const, icon: 'list-outline' as const, label: 'Records' },
            { href: '/finance/budgets' as const, icon: 'bar-chart-outline' as const, label: 'Budgets' },
            { href: '/finance/goals' as const, icon: 'flag-outline' as const, label: 'Goals' },
            { href: '/finance/debts' as const, icon: 'hand-left-outline' as const, label: 'Debts' },
            { href: '/finance/planned' as const, icon: 'time-outline' as const, label: 'Planned payments' },
            { href: '/finance/labels' as const, icon: 'pricetag-outline' as const, label: 'Labels' },
            { href: '/finance/splits' as const, icon: 'people-outline' as const, label: 'Splits' },
            { href: '/shopping' as const, icon: 'cart-outline' as const, label: 'Shopping list' },
          ].map((item) => (
            <Link key={item.href} href={item.href} asChild>
              <Pressable
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  borderRadius: theme.radius.full,
                  backgroundColor: theme.colors.surface,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}>
                <Ionicons name={item.icon} size={16} color={theme.colors.textSecondary} />
                <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                  {item.label}
                </Text>
              </Pressable>
            </Link>
          ))}
        </ScrollView>

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
                        <IconBadge
                          name={isTransfer ? 'swap-horizontal' : transaction.type === 'income' ? 'arrow-down-circle' : 'arrow-up-circle'}
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

        {reminders.map((reminder) => (
          <ReminderCard
            key={reminder.id}
            state={reminder}
            onSave={(next) => saveReminder(reminder.id, next)}
            onRemove={reminders.length > 1 ? () => removeReminder(reminder.id) : undefined}
            color={theme.colors.primary}
          />
        ))}
        <Button label={reminders.length > 0 ? 'Add another reminder' : 'Add a reminder'} variant="secondary" onPress={addReminder} />
      </View>

      <UpsellModal
        visible={showUpsell}
        resourceLabel={LIMIT_LABELS.financeAccounts}
        limit={accountGate.limit}
        onClose={() => setShowUpsell(false)}
      />
      <UpsellModal
        visible={showTransactionUpsell}
        resourceLabel={LIMIT_LABELS.financeTransactions}
        limit={transactionGate.limit}
        onClose={() => setShowTransactionUpsell(false)}
      />
    </ScreenContainer>
    </View>
  );
}

function BudgetRow({
  label,
  icon,
  spend,
  budget,
  currency,
  onSetBudget,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  spend: number;
  budget: number | null;
  currency: string;
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
    <Card style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <IconBadge name={icon} color={over ? theme.colors.danger : theme.colors.primary} size="sm" />
        <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
          {label}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ color: over ? theme.colors.danger : theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
            {formatCurrency(spend, currency)}
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
    </Card>
  );
}

/** Compact per-category progress bar for the hub — the full pacing/forecast breakdown stays on
 * the dedicated Budgets screen (finance/budgets), this is just enough to catch "I'm close to
 * blowing this one" at a glance without navigating away. */
function CategoryBudgetRow({ plan, categoryName, currency }: { plan: BudgetPlanProgress; categoryName: string | null; currency: string }) {
  const theme = useAppTheme();
  const ratio = plan.amount > 0 ? plan.spent / plan.amount : 0;
  const color = ratio >= 1 ? theme.colors.danger : ratio >= 0.8 ? theme.colors.warning : theme.colors.primary;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
          {categoryName ?? plan.name}
        </Text>
        <Text style={{ color, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold }}>
          {formatCurrency(plan.spent, currency)} / {formatCurrency(plan.amount, currency)}
        </Text>
      </View>
      <ProgressBar progress={ratio} color={color} height={6} />
    </View>
  );
}
