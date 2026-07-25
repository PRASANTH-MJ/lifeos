import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { addDays, todayKey } from '@/lib/date';

export type FinanceForecast = {
  startingBalance: number;
  expectedIncome: number;
  expectedSpending: number;
  endingBalance: number;
};

/** Projects net worth `days` forward by assuming the trailing `days` window's income/expense
 * totals repeat — a simple continuation forecast, not a schedule of known future bills (LifeOS
 * has no recurring-payment data model). */
export function useFinanceForecast(days: number) {
  const db = useSQLiteContext();
  const [forecast, setForecast] = useState<FinanceForecast>({
    startingBalance: 0,
    expectedIncome: 0,
    expectedSpending: 0,
    endingBalance: 0,
  });

  const refresh = useCallback(async () => {
    const today = todayKey();
    const start = addDays(today, -(days - 1));

    const [netWorthRow, incomeRow, expenseRow] = await Promise.all([
      db.getFirstAsync<{ total: number | null }>('SELECT SUM(current_balance) as total FROM finance_accounts WHERE is_archived = 0'),
      db.getFirstAsync<{ total: number | null }>(
        "SELECT SUM(amount) as total FROM finance_transactions WHERE type = 'income' AND date >= ? AND date <= ?",
        [start, today]
      ),
      db.getFirstAsync<{ total: number | null }>(
        "SELECT SUM(amount) as total FROM finance_transactions WHERE type = 'expense' AND date >= ? AND date <= ?",
        [start, today]
      ),
    ]);

    const startingBalance = netWorthRow?.total ?? 0;
    const expectedIncome = incomeRow?.total ?? 0;
    const expectedSpending = expenseRow?.total ?? 0;
    setForecast({
      startingBalance,
      expectedIncome,
      expectedSpending,
      endingBalance: startingBalance + expectedIncome - expectedSpending,
    });
  }, [db, days]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { forecast, refresh };
}
