import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { addDays, buildDailySeries, todayKey } from '@/lib/date';

import { bucketRecordSeries } from './bucketSeries';
import type { SpendingPriority } from './types';

type PriorityTotals = Record<SpendingPriority, number>;

type TransactionRow = { date: string; type: string; amount: number; category_id: number | null };
type CategoryRow = { id: number; priority: SpendingPriority | null };

/**
 * Web build of useFinanceSpendingByPriority.ts — same exported shape. The native version's
 * `SELECT ... GROUP BY t.date, COALESCE(c.priority, 'need')` (with a LEFT JOIN onto
 * finance_categories) becomes: fetch both tables, join category priority in JS via a Map, then
 * reduce into per-date/per-priority totals matching the SQL GROUP BY key exactly.
 *
 * Reactive via Dexie's useLiveQuery instead of the native useFocusEffect-based refresh: any
 * write to finance_transactions or finance_categories in any tab re-runs this automatically.
 */
export function useFinanceSpendingByPriority(days: number) {
  const result = useLiveQuery(async () => {
    const today = todayKey();
    const start = addDays(today, -(days - 1));

    const [transactions, categories] = await Promise.all([
      webDb.finance_transactions.toArray() as unknown as Promise<TransactionRow[]>,
      webDb.finance_categories.toArray() as unknown as Promise<CategoryRow[]>,
    ]);

    const priorityByCategoryId = new Map<number, SpendingPriority | null>();
    for (const category of categories) {
      priorityByCategoryId.set(category.id, category.priority);
    }

    // GROUP BY t.date, COALESCE(c.priority, 'need') -> accumulate directly into the per-date maps.
    const mustByDate: Record<string, number> = {};
    const needByDate: Record<string, number> = {};
    const wantByDate: Record<string, number> = {};
    const nextTotals: PriorityTotals = { must: 0, need: 0, want: 0 };

    for (const tx of transactions) {
      if (tx.type !== 'expense' || tx.date < start || tx.date > today) continue;
      const priority: SpendingPriority =
        (tx.category_id != null ? priorityByCategoryId.get(tx.category_id) : null) ?? 'need';
      const byDate = priority === 'must' ? mustByDate : priority === 'want' ? wantByDate : needByDate;
      byDate[tx.date] = (byDate[tx.date] ?? 0) + tx.amount;
      nextTotals[priority] += tx.amount;
    }

    const mustSeries = buildDailySeries(days, mustByDate);
    const needSeries = buildDailySeries(days, needByDate);
    const wantSeries = buildDailySeries(days, wantByDate);
    const combined = mustSeries.map((point, index) => ({
      date: point.date,
      values: { must: point.value, need: needSeries[index].value, want: wantSeries[index].value },
    }));

    return {
      totals: nextTotals,
      buckets: bucketRecordSeries(combined, ['must', 'need', 'want'], 12),
    };
  }, [days]);

  const totals = result?.totals ?? { must: 0, need: 0, want: 0 };
  const buckets = result?.buckets ?? [];

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  return { totals, buckets, refresh };
}
