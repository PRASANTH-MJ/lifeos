import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { addDays, buildDailySeries, todayKey } from '@/lib/date';
import { webDb } from '@/db/webDb';

type TxRow = { date: string; amount: number; type: string };

/**
 * Web build of useFinanceDailySpend.ts — same exported shape. Reactive via Dexie's
 * useLiveQuery instead of expo-router's useFocusEffect, so the series updates automatically
 * on any write to finance_transactions from this tab or another.
 */
export function useFinanceDailySpend(days: number) {
  const start = addDays(todayKey(), -(days - 1));

  const rows = useLiveQuery(
    () =>
      webDb.finance_transactions
        .filter((row) => (row as TxRow).type === 'expense' && (row as TxRow).date >= start)
        .toArray() as unknown as Promise<TxRow[]>,
    [start]
  );

  const built = useMemo(() => {
    const byDate: Record<string, number> = {};
    for (const row of rows ?? []) {
      byDate[row.date] = (byDate[row.date] ?? 0) + row.amount;
    }
    return buildDailySeries(days, byDate);
  }, [rows, days]);

  const series = built;
  const total = useMemo(() => built.reduce((sum, point) => sum + point.value, 0), [built]);

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  return { series, total, refresh };
}
