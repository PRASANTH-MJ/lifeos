import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { addDays, buildDailySeries, todayKey } from '@/lib/date';

import { bucketRecordSeries } from './bucketSeries';

type PeriodTotals = { income: number; expense: number; cashFlow: number };

/** Income/expense buckets for the trailing `days` window, plus a same-length-window
 * period-over-period comparison (current vs. immediately preceding window). */
export function useFinanceCashFlow(days: number) {
  const db = useSQLiteContext();
  const [buckets, setBuckets] = useState<{ label: string; income: number; expense: number }[]>([]);
  const [current, setCurrent] = useState<PeriodTotals>({ income: 0, expense: 0, cashFlow: 0 });
  const [previous, setPrevious] = useState<PeriodTotals>({ income: 0, expense: 0, cashFlow: 0 });

  const refresh = useCallback(async () => {
    const today = todayKey();
    const currentStart = addDays(today, -(days - 1));
    const previousStart = addDays(currentStart, -days);

    const rows = await db.getAllAsync<{ date: string; type: 'income' | 'expense'; total: number }>(
      `SELECT date, type, SUM(amount) as total FROM finance_transactions
       WHERE type IN ('income', 'expense') AND date >= ? AND date <= ? GROUP BY date, type`,
      [previousStart, today]
    );

    const incomeByDate: Record<string, number> = {};
    const expenseByDate: Record<string, number> = {};
    let curIncome = 0;
    let curExpense = 0;
    let prevIncome = 0;
    let prevExpense = 0;
    for (const row of rows) {
      if (row.type === 'income') incomeByDate[row.date] = row.total;
      else expenseByDate[row.date] = row.total;

      if (row.date >= currentStart) {
        if (row.type === 'income') curIncome += row.total;
        else curExpense += row.total;
      } else {
        if (row.type === 'income') prevIncome += row.total;
        else prevExpense += row.total;
      }
    }

    const incomeSeries = buildDailySeries(days, incomeByDate);
    const expenseSeries = buildDailySeries(days, expenseByDate);
    const combined = incomeSeries.map((point, index) => ({
      date: point.date,
      values: { income: point.value, expense: expenseSeries[index].value },
    }));
    setBuckets(bucketRecordSeries(combined, ['income', 'expense'], 12));

    setCurrent({ income: curIncome, expense: curExpense, cashFlow: curIncome - curExpense });
    setPrevious({ income: prevIncome, expense: prevExpense, cashFlow: prevIncome - prevExpense });
  }, [db, days]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { buckets, current, previous, refresh };
}
