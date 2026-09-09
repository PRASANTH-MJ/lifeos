import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { addDays, todayKey, weekdayOf } from '@/lib/date';

type TransactionRow = { type: string; date: string; amount: number };

/**
 * Web build of useFinanceWeekSpend.ts — same exported shape. Reactive via Dexie's useLiveQuery
 * instead of expo-router's useFocusEffect: any tab (or the sync engine) writing to
 * finance_transactions re-runs this query automatically, in every mounted instance, across tabs.
 */
export function useFinanceWeekSpend() {
  const weekSpend = useLiveQuery(async () => {
    const today = todayKey();
    const weekStart = addDays(today, -weekdayOf(today));
    const weekEnd = addDays(weekStart, 6);

    const rows = (await webDb.finance_transactions.toArray()) as TransactionRow[];
    const total = rows
      .filter((row) => row.type === 'expense' && row.date >= weekStart && row.date <= weekEnd)
      .reduce((sum, row) => sum + row.amount, 0);
    return total;
  }, []);

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  return { weekSpend: weekSpend ?? 0, refresh };
}
