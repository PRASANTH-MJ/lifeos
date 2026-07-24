import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import type { FinanceSummary } from './types';

export function useFinanceSummary(start?: string, end?: string) {
  const db = useSQLiteContext();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rangeStart = start ?? '1970-01-01';
      const rangeEnd = end ?? '9999-12-31';

      const [netWorthRow, incomeRow, expenseRow, byCategoryRows] = await Promise.all([
        db.getFirstAsync<{ total: number | null }>('SELECT SUM(current_balance) as total FROM finance_accounts WHERE is_archived = 0'),
        db.getFirstAsync<{ total: number | null }>(
          "SELECT SUM(amount) as total FROM finance_transactions WHERE type = 'income' AND date >= ? AND date <= ?",
          [rangeStart, rangeEnd]
        ),
        db.getFirstAsync<{ total: number | null }>(
          "SELECT SUM(amount) as total FROM finance_transactions WHERE type = 'expense' AND date >= ? AND date <= ?",
          [rangeStart, rangeEnd]
        ),
        db.getAllAsync<{ name: string; color: string; icon: string; total: number }>(
          `SELECT COALESCE(c.name, 'Uncategorized') as name, COALESCE(c.color, '#8E8E93') as color, COALESCE(c.icon, 'pricetag') as icon, SUM(t.amount) as total
           FROM finance_transactions t
           LEFT JOIN finance_categories c ON c.id = t.category_id
           WHERE t.type = 'expense' AND t.date >= ? AND t.date <= ?
           GROUP BY COALESCE(c.name, 'Uncategorized'), COALESCE(c.color, '#8E8E93'), COALESCE(c.icon, 'pricetag')
           ORDER BY total DESC`,
          [rangeStart, rangeEnd]
        ),
      ]);

      setSummary({
        netWorth: netWorthRow?.total ?? 0,
        income: incomeRow?.total ?? 0,
        expense: expenseRow?.total ?? 0,
        expenseByCategory: byCategoryRows,
      });
    } finally {
      setLoading(false);
    }
  }, [db, start, end]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { summary, loading, refresh };
}
