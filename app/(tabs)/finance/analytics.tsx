import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import {
  BarPairChart,
  Card,
  Chip,
  DonutChart,
  EmptyState,
  IconBadge,
  LineChart,
  LoadingState,
  NamedBarChart,
  ScreenContainer,
  StackedBarChart,
  StatCard,
} from '@/components';
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  formatCurrency,
  formatCurrencyCompact,
  useAccounts,
  useFinanceBalanceTrend,
  useFinanceCashFlow,
  useFinanceCategories,
  useFinanceDebts,
  useFinanceForecast,
  useFinancePlannedPayments,
  useFinanceSpendingByPriority,
  useFinanceSummary,
  useNetWorthHistory,
  type SpendingPriority,
} from '@/modules/finance';
import { addDays, formatDisplayDate, todayKey } from '@/lib/date';
import { useAppTheme } from '@/theme';

const RANGE_OPTIONS = [
  { key: '7d', label: '7D', days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: '12w', label: '12W', days: 84 },
  { key: '6m', label: '6M', days: 182 },
  { key: '1y', label: '1Y', days: 365 },
] as const;
type RangeKey = (typeof RANGE_OPTIONS)[number]['key'];

const SECTIONS = [
  { key: 'balance', label: 'Balance' },
  { key: 'networth', label: 'Net Worth' },
  { key: 'cashflow', label: 'Cash-flow' },
  { key: 'spending', label: 'Spending' },
  { key: 'outlook', label: 'Outlook' },
] as const;
type SectionKey = (typeof SECTIONS)[number]['key'];

export default function FinanceAnalyticsScreen() {
  const theme = useAppTheme();
  const [section, setSection] = useState<SectionKey>('balance');
  const [range, setRange] = useState<RangeKey>('6m');
  const days = RANGE_OPTIONS.find((option) => option.key === range)!.days;

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
          Statistics
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
          {SECTIONS.map((option) => (
            <Chip key={option.key} label={option.label} selected={section === option.key} onPress={() => setSection(option.key)} />
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
          {RANGE_OPTIONS.map((option) => (
            <Chip key={option.key} label={option.label} selected={range === option.key} onPress={() => setRange(option.key)} />
          ))}
        </ScrollView>

        {section === 'balance' ? <BalanceSection days={days} /> : null}
        {section === 'networth' ? <NetWorthSection days={days} /> : null}
        {section === 'cashflow' ? <CashFlowSection days={days} /> : null}
        {section === 'spending' ? <SpendingSection days={days} /> : null}
        {section === 'outlook' ? <OutlookSection days={days} /> : null}
      </View>
    </ScreenContainer>
  );
}

function BalanceSection({ days }: { days: number }) {
  const theme = useAppTheme();
  const { accounts, netWorth, displayCurrency, loading } = useAccounts();
  const { series, changePercent, refresh } = useFinanceBalanceTrend(days);
  void refresh;

  if (loading) return <LoadingState />;

  const maxBalance = Math.max(...accounts.map((a) => Math.abs(a.current_balance)), 1);

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <Card tier="panel" style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <IconBadge name="trending-up-outline" color={theme.colors.primary} size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Balance Trend
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Do I have more money than before?</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>TODAY</Text>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
              {formatCurrencyCompact(netWorth, displayCurrency)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>vs past period</Text>
            <Text
              style={{
                color: changePercent >= 0 ? theme.colors.success : theme.colors.danger,
                fontSize: theme.typography.size.base,
                fontWeight: theme.typography.weight.semibold,
              }}>
              {changePercent >= 0 ? '+' : ''}
              {changePercent.toFixed(0)}%
            </Text>
          </View>
        </View>
        {series.length > 0 ? (
          <LineChart
            label=""
            data={series.map((p) => ({ date: p.label, value: p.value }))}
            color={theme.colors.primary}
            formatValue={(v) => formatCurrencyCompact(v, displayCurrency)}
          />
        ) : (
          <EmptyState icon="trending-up-outline" title="No balance history yet" />
        )}
      </Card>

      <Card tier="panel" style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <IconBadge name="wallet-outline" color={theme.colors.primary} size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Balance by Accounts
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>In which accounts do I have most of my money?</Text>
          </View>
        </View>
        {accounts.length === 0 ? (
          <EmptyState icon="wallet-outline" title="No accounts yet" />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {[...accounts]
              .sort((a, b) => b.current_balance - a.current_balance)
              .map((account) => (
                <View key={account.id} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                      {account.name}
                    </Text>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                      {formatCurrency(account.current_balance, account.currency)}
                    </Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
                    <View
                      style={{
                        width: `${(Math.abs(account.current_balance) / maxBalance) * 100}%`,
                        height: '100%',
                        backgroundColor: account.current_balance >= 0 ? theme.colors.success : theme.colors.danger,
                      }}
                    />
                  </View>
                </View>
              ))}
          </View>
        )}
      </Card>
    </View>
  );
}

function NetWorthSection({ days }: { days: number }) {
  const theme = useAppTheme();
  const { netWorth: accountsNetWorth, displayCurrency, loading: loadingAccounts } = useAccounts();
  const { debts, remainingById, loading: loadingDebts } = useFinanceDebts();
  const { snapshots, loading: loadingHistory, recordTodaySnapshot } = useNetWorthHistory(days);

  // "Outstanding debts" here means money owed — only the 'borrowed' side of finance_debts is a
  // liability against net worth; 'lent' money is a receivable that never left an account balance
  // in the first place, so it isn't subtracted a second time here.
  const outstandingDebt = debts
    .filter((debt) => debt.direction === 'borrowed' && !debt.is_closed)
    .reduce((sum, debt) => sum + (remainingById[debt.id] ?? debt.amount), 0);
  const netWorth = accountsNetWorth - outstandingDebt;
  const loading = loadingAccounts || loadingDebts;

  useEffect(() => {
    if (loading) return;
    recordTodaySnapshot(netWorth);
    // Only re-runs once loading finishes — recordTodaySnapshot itself no-ops if today's row
    // already exists, so this deliberately doesn't depend on `netWorth` changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  if (loading || loadingHistory) return <LoadingState />;

  const series = snapshots.map((snapshot) => ({ date: snapshot.date, value: snapshot.net_worth }));

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <Card tier="panel" style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <IconBadge name="analytics-outline" color={theme.colors.primary} size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Net Worth
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Accounts minus what I owe, over time</Text>
          </View>
        </View>
        <Text
          style={{
            color: netWorth >= 0 ? theme.colors.textPrimary : theme.colors.danger,
            fontSize: theme.typography.size['2xl'],
            fontWeight: theme.typography.weight.bold,
          }}>
          {formatCurrencyCompact(netWorth, displayCurrency)}
        </Text>
        {series.length > 1 ? (
          <LineChart label="" data={series} color={theme.colors.primary} formatValue={(v) => formatCurrencyCompact(v, displayCurrency)} />
        ) : (
          <EmptyState icon="analytics-outline" title="Building history" subtitle="Check back tomorrow — one point is recorded per day." />
        )}
      </Card>
    </View>
  );
}

function CashFlowSection({ days }: { days: number }) {
  const theme = useAppTheme();
  const { displayCurrency } = useAccounts();
  const { buckets, current, previous } = useFinanceCashFlow(days);

  const pctChange = (curr: number, prev: number) => (prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : curr !== 0 ? 100 : 0);

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <StatCard label="Income" value={formatCurrencyCompact(current.income, displayCurrency)} color={theme.colors.success} glass />
        <StatCard label="Expenses" value={formatCurrencyCompact(current.expense, displayCurrency)} color={theme.colors.danger} glass />
        <StatCard
          label="Cash flow"
          value={formatCurrencyCompact(current.cashFlow, displayCurrency)}
          color={current.cashFlow >= 0 ? theme.colors.success : theme.colors.danger}
          glass
        />
      </View>

      <Card tier="panel" style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <IconBadge name="swap-horizontal-outline" color={theme.colors.primary} size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Cash-flow
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Income vs. expenses per period</Text>
          </View>
        </View>
        {buckets.length > 0 && buckets.some((b) => b.income || b.expense) ? (
          <BarPairChart data={buckets} formatValue={(v) => formatCurrencyCompact(v, displayCurrency)} />
        ) : (
          <EmptyState icon="swap-horizontal-outline" title="No transactions in this range" />
        )}
      </Card>

      <Card tier="panel" style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <IconBadge name="repeat-outline" color={theme.colors.primary} size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Period to Period Comparison
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
              How am I doing versus the previous period of the same length?
            </Text>
          </View>
        </View>
        <ComparisonRow
          label="Income"
          curr={current.income}
          prev={previous.income}
          pct={pctChange(current.income, previous.income)}
          currency={displayCurrency}
          good
        />
        <ComparisonRow
          label="Expenses"
          curr={current.expense}
          prev={previous.expense}
          pct={pctChange(current.expense, previous.expense)}
          currency={displayCurrency}
          good={false}
        />
        <ComparisonRow
          label="Cash flow"
          curr={current.cashFlow}
          prev={previous.cashFlow}
          pct={pctChange(current.cashFlow, previous.cashFlow)}
          currency={displayCurrency}
          good
        />
      </Card>
    </View>
  );
}

function ComparisonRow({
  label,
  curr,
  prev,
  pct,
  currency,
  good,
}: {
  label: string;
  curr: number;
  prev: number;
  pct: number;
  currency: string;
  good: boolean;
}) {
  const theme = useAppTheme();
  const improved = good ? pct >= 0 : pct <= 0;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{label}</Text>
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>was {formatCurrencyCompact(prev, currency)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
          {formatCurrencyCompact(curr, currency)}
        </Text>
        <Text style={{ color: improved ? theme.colors.success : theme.colors.danger, fontSize: theme.typography.size.xs }}>
          {pct >= 0 ? '+' : ''}
          {pct.toFixed(0)}%
        </Text>
      </View>
    </View>
  );
}

function SpendingSection({ days }: { days: number }) {
  const theme = useAppTheme();
  const { displayCurrency } = useAccounts();
  const { totals, buckets } = useFinanceSpendingByPriority(days);
  const { categories } = useFinanceCategories();
  const today = todayKey();
  const start = addDays(today, -(days - 1));
  const { summary, loading } = useFinanceSummary(start, today);
  const [filter, setFilter] = useState<'all' | SpendingPriority>('all');

  const categoryPriority = useMemo(() => {
    const map: Record<string, SpendingPriority> = {};
    for (const category of categories) map[category.name] = category.priority;
    return map;
  }, [categories]);

  const filteredCategories = useMemo(() => {
    if (!summary) return [];
    if (filter === 'all') return summary.expenseByCategory;
    return summary.expenseByCategory.filter((c) => (categoryPriority[c.name] ?? 'need') === filter);
  }, [summary, filter, categoryPriority]);

  const filteredTotal = filteredCategories.reduce((sum, c) => sum + c.total, 0);
  const grandTotal = totals.must + totals.need + totals.want;

  if (loading || !summary) return <LoadingState />;

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <Card tier="panel" style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <IconBadge name="layers-outline" color={theme.colors.primary} size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              The Nature of Spending
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
              How much must I pay, need to pay, or just want to spend?
            </Text>
          </View>
        </View>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
          {formatCurrencyCompact(grandTotal, displayCurrency)}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
          {(['all', 'must', 'need', 'want'] as const).map((key) => (
            <Chip
              key={key}
              label={key === 'all' ? 'All' : PRIORITY_LABELS[key]}
              selected={filter === key}
              color={key === 'all' ? undefined : PRIORITY_COLORS[key]}
              onPress={() => setFilter(key)}
            />
          ))}
        </ScrollView>
        {buckets.length > 0 && grandTotal > 0 ? (
          <StackedBarChart data={buckets} colors={PRIORITY_COLORS} />
        ) : (
          <EmptyState icon="bar-chart-outline" title="No expenses in this range" />
        )}
      </Card>

      <Card tier="panel" style={{ gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <IconBadge name="pie-chart-outline" color={theme.colors.primary} size="sm" />
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            {filter === 'all' ? 'All categories' : `${PRIORITY_LABELS[filter]} categories`}
          </Text>
        </View>
        {filteredCategories.length === 0 ? (
          <EmptyState icon="pie-chart-outline" title="Nothing here" />
        ) : (
          <>
            <DonutChart
              segments={filteredCategories.map((c) => ({ value: c.total, color: c.color }))}
              centerLabel={formatCurrencyCompact(filteredTotal, displayCurrency)}
              centerSubLabel="total"
            />
            <View style={{ gap: theme.spacing.sm }}>
              {filteredCategories.map((category) => (
                <View key={category.name} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: category.color }} />
                      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{category.name}</Text>
                    </View>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                      {formatCurrency(category.total, displayCurrency)}
                    </Text>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
                    <View style={{ width: `${(category.total / filteredTotal) * 100}%`, height: '100%', backgroundColor: category.color }} />
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </Card>
    </View>
  );
}

function OutlookSection({ days }: { days: number }) {
  const theme = useAppTheme();
  const { displayCurrency } = useAccounts();
  const { forecast } = useFinanceForecast(days);
  const { plannedPayments } = useFinancePlannedPayments();

  const rangeEnd = addDays(todayKey(), days - 1);
  const upcoming = plannedPayments.filter((p) => p.next_date <= rangeEnd).sort((a, b) => a.next_date.localeCompare(b.next_date));
  const plannedIncome = upcoming.filter((p) => p.type === 'income').reduce((sum, p) => sum + p.amount, 0);
  const plannedExpense = upcoming.filter((p) => p.type === 'expense').reduce((sum, p) => sum + p.amount, 0);

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <Card tier="panel" style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <IconBadge name="calculator-outline" color={theme.colors.primary} size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Balance Forecast
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
              If the last period repeats, will I have enough money?
            </Text>
          </View>
        </View>
        <NamedBarChart
          formatValue={(v) => formatCurrencyCompact(v, displayCurrency)}
          bars={[
            { label: 'Starting balance', value: forecast.startingBalance, color: theme.colors.primary },
            { label: 'Expected income', value: forecast.expectedIncome, color: theme.colors.success },
            { label: 'Expected spending', value: forecast.expectedSpending, color: theme.colors.danger },
            {
              label: 'Ending balance',
              value: forecast.endingBalance,
              color: forecast.endingBalance >= forecast.startingBalance ? theme.colors.success : theme.colors.danger,
            },
          ]}
        />
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
          Based on your income and spending over the selected range, continued forward by the same length of time — a trend projection, not a bill
          calendar. See below for payments you&apos;ve actually scheduled.
        </Text>
      </Card>

      <Card tier="panel" style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <IconBadge name="time-outline" color={theme.colors.primary} size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
              Planned Payments
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>What's actually scheduled in this range?</Text>
          </View>
        </View>
        {upcoming.length === 0 ? (
          <EmptyState icon="time-outline" title="Nothing scheduled in this range" />
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
              <Text style={{ color: theme.colors.success, fontSize: theme.typography.size.sm }}>
                +{formatCurrencyCompact(plannedIncome, displayCurrency)} income
              </Text>
              <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm }}>
                -{formatCurrencyCompact(plannedExpense, displayCurrency)} expense
              </Text>
            </View>
            <View style={{ gap: theme.spacing.sm }}>
              {upcoming.map((payment) => (
                <View key={payment.id} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <IconBadge
                    name={payment.type === 'income' ? 'arrow-down-circle' : 'arrow-up-circle'}
                    color={payment.type === 'income' ? theme.colors.success : theme.colors.danger}
                    size="sm"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                      {payment.payee}
                    </Text>
                    <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{formatDisplayDate(payment.next_date)}</Text>
                  </View>
                  <Text
                    style={{
                      color: payment.type === 'income' ? theme.colors.success : theme.colors.danger,
                      fontSize: theme.typography.size.sm,
                      fontWeight: theme.typography.weight.semibold,
                    }}>
                    {payment.type === 'income' ? '+' : '-'}
                    {formatCurrencyCompact(payment.amount, displayCurrency)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Card>
    </View>
  );
}
