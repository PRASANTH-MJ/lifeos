import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { addDays, buildDailySeries, todayKey } from '@/lib/date';

import { bucketRecordSeries } from './bucketSeries';
import type { SpendingPriority } from './types';

type PriorityTotals = Record<SpendingPriority, number>;

/** Expense totals split by each category's Must/Need/Want priority, for the trailing `days`
 * window — both a grand total per priority and a bucketed series for a stacked trend chart. */
export function useFinanceSpendingByPriority(days: number) {
  const db = useSQLiteContext();
  const [totals, setTotals] = useState<PriorityTotals>({ must: 0, need: 0, want: 0 });
  const [buckets, setBuckets] = useState<{ label: string; must: number; need: number; want: number }[]>([]);

  const refresh = useCallback(async () => {
    const today = todayKey();
    const start = addDays(today, -(days - 1));

    const rows = await db.getAllAsync<{ date: string; priority: SpendingPriority; total: number }>(
      `SELECT t.date as date, COALESCE(c.priority, 'need') as priority, SUM(t.amount) as total
       FROM finance_transactions t
       LEFT JOIN finance_categories c ON c.id = t.category_id
       WHERE t.type = 'expense' AND t.date >= ? AND t.date <= ?
       GROUP BY t.date, COALESCE(c.priority, 'need')`,
      [start, today]
    );

    const mustByDate: Record<string, number> = {};
    const needByDate: Record<string, number> = {};
    const wantByDate: Record<string, number> = {};
    const nextTotals: PriorityTotals = { must: 0, need: 0, want: 0 };
    for (const row of rows) {
      const byDate = row.priority === 'must' ? mustByDate : row.priority === 'want' ? wantByDate : needByDate;
      byDate[row.date] = row.total;
      nextTotals[row.priority] += row.total;
    }
    setTotals(nextTotals);

    const mustSeries = buildDailySeries(days, mustByDate);
    const needSeries = buildDailySeries(days, needByDate);
    const wantSeries = buildDailySeries(days, wantByDate);
    const combined = mustSeries.map((point, index) => ({
      date: point.date,
      values: { must: point.value, need: needSeries[index].value, want: wantSeries[index].value },
    }));
    setBuckets(bucketRecordSeries(combined, ['must', 'need', 'want'], 12));
  }, [db, days]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { totals, buckets, refresh };
}
