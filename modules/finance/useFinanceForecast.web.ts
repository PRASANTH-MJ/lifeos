import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { addDays, todayKey } from '@/lib/date';
import { webDb } from '@/db/webDb';

export type FinanceForecast = {
  startingBalance: number;
  expectedIncome: number;
  expectedSpending: number;
  endingBalance: number;
};

type AccountRow = { is_archived: number; current_balance: number };
type TransactionRow = { type: string; date: string; amount: number };

/** Web build of useFinanceForecast.ts — same exported shape. Reactive via Dexie's useLiveQuery
 * instead of expo-router's useFocusEffect: a write to finance_accounts or finance_transactions
 * from any tab automatically recomputes the forecast in every mounted useFinanceForecast()
 * instance. Projects net worth `days` forward by assuming the trailing `days` window's
 * income/expense totals repeat — a simple continuation forecast, not a schedule of known future
 * bills (Flowsy has no recurring-payment data model). */
export function useFinanceForecast(days: number) {
  const forecast = useLiveQuery<FinanceForecast>(async () => {
    const today = todayKey();
    const start = addDays(today, -(days - 1));

    const [accounts, transactions] = await Promise.all([
      webDb.finance_accounts.toArray() as unknown as Promise<AccountRow[]>,
      webDb.finance_transactions.toArray() as unknown as Promise<TransactionRow[]>,
    ]);

    const startingBalance = accounts
      .filter((a) => !a.is_archived)
      .reduce((sum, a) => sum + (a.current_balance ?? 0), 0);

    const inWindow = transactions.filter((t) => t.date >= start && t.date <= today);

    const expectedIncome = inWindow
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount ?? 0), 0);

    const expectedSpending = inWindow
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount ?? 0), 0);

    return {
      startingBalance,
      expectedIncome,
      expectedSpending,
      endingBalance: startingBalance + expectedIncome - expectedSpending,
    };
  }, [days]) ?? {
    startingBalance: 0,
    expectedIncome: 0,
    expectedSpending: 0,
    endingBalance: 0,
  };

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  return { forecast, refresh };
}
