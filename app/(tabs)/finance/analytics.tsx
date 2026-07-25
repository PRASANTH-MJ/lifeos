import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  BarPairChart,
  Card,
  Chip,
  DonutChart,
  EmptyState,
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
  useFinanceForecast,
  useFinanceSpendingByPriority,
  useFinanceSummary,
  type SpendingPriority,
} from '@/modules/finance';
import { addDays, todayKey } from '@/lib/date';
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

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {RANGE_OPTIONS.map((option) => (
            <Pressable key={option.key} style={{ flex: 1 }} onPress={() => setRange(option.key)}>
              <View
                style={{
                  alignItems: 'center',
                  paddingVertical: theme.spacing.sm,
                  borderRadius: theme.radius.md,
                  backgroundColor: range === option.key ? theme.colors.primaryMuted : theme.colors.surface,
                  borderWidth: 1,
                  borderColor: range === option.key ? theme.colors.primary : theme.colors.border,
                }}>
                <Text
                  style={{
                    color: range === option.key ? theme.colors.primary : theme.colors.textSecondary,
                    fontSize: theme.typography.size.sm,
                    fontWeight: theme.typography.weight.medium,
                  }}>
                  {option.label}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {section === 'balance' ? <BalanceSection days={days} /> : null}
        {section === 'cashflow' ? <CashFlowSection days={days} /> : null}
        {section === 'spending' ? <SpendingSection days={days} /> : null}
        {section === 'outlook' ? <OutlookSection days={days} /> : null}
      </View>
    </ScreenContainer>
  );
}

function BalanceSection({ days }: { days: number }) {
  const theme = useAppTheme();
  const { accounts, netWorth, loading } = useAccounts();
  const { series, changePercent, refresh } = useFinanceBalanceTrend(days);
  void refresh;

  if (loading) return <LoadingState />;

  const maxBalance = Math.max(...accounts.map((a) => Math.abs(a.current_balance)), 1);

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <Card style={{ gap: theme.spacing.md }}>
        <View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            Balance Trend
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Do I have more money than before?</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>TODAY</Text>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
              {formatCurrencyCompact(netWorth)}
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
          <LineChart label="" data={series.map((p) => ({ date: p.label, value: p.value }))} color={theme.colors.primary} formatValue={formatCurrencyCompact} />
        ) : (
          <EmptyState icon="trending-up-outline" title="No balance history yet" />
        )}
      </Card>

      <Card style={{ gap: theme.spacing.md }}>
        <View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            Balance by Accounts
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>In which accounts do I have most of my money?</Text>
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

function CashFlowSection({ days }: { days: number }) {
  const theme = useAppTheme();
  const { buckets, current, previous } = useFinanceCashFlow(days);

  const pctChange = (curr: number, prev: number) => (prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : curr !== 0 ? 100 : 0);

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <StatCard label="Income" value={formatCurrencyCompact(current.income)} color={theme.colors.success} />
        <StatCard label="Expenses" value={formatCurrencyCompact(current.expense)} color={theme.colors.danger} />
        <StatCard label="Cash flow" value={formatCurrencyCompact(current.cashFlow)} color={current.cashFlow >= 0 ? theme.colors.success : theme.colors.danger} />
      </View>

      <Card style={{ gap: theme.spacing.md }}>
        <View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            Cash-flow
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Income vs. expenses per period</Text>
        </View>
        {buckets.length > 0 && buckets.some((b) => b.income || b.expense) ? (
          <BarPairChart data={buckets} formatValue={formatCurrencyCompact} />
        ) : (
          <EmptyState icon="swap-horizontal-outline" title="No transactions in this range" />
        )}
      </Card>

      <Card style={{ gap: theme.spacing.md }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
          Period to Period Comparison
        </Text>
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
          How am I doing versus the previous period of the same length?
        </Text>
        <ComparisonRow label="Income" curr={current.income} prev={previous.income} pct={pctChange(current.income, previous.income)} good />
        <ComparisonRow label="Expenses" curr={current.expense} prev={previous.expense} pct={pctChange(current.expense, previous.expense)} good={false} />
        <ComparisonRow label="Cash flow" curr={current.cashFlow} prev={previous.cashFlow} pct={pctChange(current.cashFlow, previous.cashFlow)} good />
      </Card>
    </View>
  );
}

function ComparisonRow({ label, curr, prev, pct, good }: { label: string; curr: number; prev: number; pct: number; good: boolean }) {
  const theme = useAppTheme();
  const improved = good ? pct >= 0 : pct <= 0;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{label}</Text>
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>was {formatCurrencyCompact(prev)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
          {formatCurrencyCompact(curr)}
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
      <Card style={{ gap: theme.spacing.md }}>
        <View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            The Nature of Spending
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
            How much must I pay, need to pay, or just want to spend?
          </Text>
        </View>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
          {formatCurrencyCompact(grandTotal)}
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

      <Card style={{ gap: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
          {filter === 'all' ? 'All categories' : `${PRIORITY_LABELS[filter]} categories`}
        </Text>
        {filteredCategories.length === 0 ? (
          <EmptyState icon="pie-chart-outline" title="Nothing here" />
        ) : (
          <>
            <DonutChart segments={filteredCategories.map((c) => ({ value: c.total, color: c.color }))} centerLabel={formatCurrencyCompact(filteredTotal)} centerSubLabel="total" />
            <View style={{ gap: theme.spacing.sm }}>
              {filteredCategories.map((category) => (
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
  const { forecast } = useFinanceForecast(days);

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <Card style={{ gap: theme.spacing.md }}>
        <View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
            Balance Forecast
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
            If the last period repeats, will I have enough money?
          </Text>
        </View>
        <NamedBarChart
          formatValue={formatCurrencyCompact}
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
          Based on your income and spending over the selected range, continued forward by the same length of time. LifeOS doesn&apos;t yet track
          scheduled/recurring bills, so this is a trend projection, not a bill calendar.
        </Text>
      </Card>
    </View>
  );
}
