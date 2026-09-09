import { useLiveQuery } from 'dexie-react-hooks';

import { addDays, buildDailySeries, todayKey } from '@/lib/date';
import { webDb } from '@/db/webDb';

import { bucketValueSeries } from './bucketSeries';

type FinanceAccountRow = { current_balance: number; is_archived: number };
type FinanceTransactionRow = { date: string; type: string; amount: number };

/** Web build of useFinanceBalanceTrend.ts — same exported shape. Reconstructs a daily net-worth
 * series for the trailing `days` window by walking the known current net worth backward through
 * each day's net transaction delta — the DB only stores running account balances, not a
 * balance-history table. Reactive via Dexie's useLiveQuery: a write to finance_accounts or
 * finance_transactions from any tab re-runs this automatically, so no useFocusEffect/refresh
 * plumbing is needed. */
export function useFinanceBalanceTrend(days: number) {
  const result = useLiveQuery(async () => {
    const today = todayKey();
    const start = addDays(today, -(days - 1));

    const [accounts, transactions] = await Promise.all([
      webDb.finance_accounts.toArray() as unknown as Promise<FinanceAccountRow[]>,
      webDb.finance_transactions.toArray() as unknown as Promise<FinanceTransactionRow[]>,
    ]);

    const netWorthToday = accounts
      .filter((a) => !a.is_archived)
      .reduce((sum, a) => sum + (a.current_balance ?? 0), 0);

    const deltaByDate: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.date < start || tx.date > today) continue;
      const signed = tx.type === 'income' ? tx.amount : tx.type === 'expense' ? -tx.amount : 0;
      deltaByDate[tx.date] = (deltaByDate[tx.date] ?? 0) + signed;
    }

    const dailyDeltas = buildDailySeries(days, deltaByDate);
    const totalDelta = dailyDeltas.reduce((sum, point) => sum + point.value, 0);

    let cumulative = netWorthToday - totalDelta;
    const balanceSeries = dailyDeltas.map((point) => {
      cumulative += point.value;
      return { date: point.date, value: cumulative };
    });

    const series = bucketValueSeries(balanceSeries, 30, 'last');
    const startValue = balanceSeries[0]?.value ?? 0;
    const changePercent = startValue !== 0 ? ((netWorthToday - startValue) / Math.abs(startValue)) * 100 : 0;

    return { series, changePercent };
  }, [days]);

  const series = result?.series ?? [];
  const changePercent = result?.changePercent ?? 0;

  const refresh = async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  };

  return { series, changePercent, refresh };
}
