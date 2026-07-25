import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { addDays, buildDailySeries, todayKey } from '@/lib/date';

import { bucketValueSeries } from './bucketSeries';

/** Reconstructs a daily net-worth series for the trailing `days` window by walking the known
 * current net worth backward through each day's net transaction delta — the DB only stores
 * running account balances, not a balance-history table. */
export function useFinanceBalanceTrend(days: number) {
  const db = useSQLiteContext();
  const [series, setSeries] = useState<{ label: string; value: number }[]>([]);
  const [changePercent, setChangePercent] = useState(0);

  const refresh = useCallback(async () => {
    const today = todayKey();
    const start = addDays(today, -(days - 1));

    const [netWorthRow, deltaRows] = await Promise.all([
      db.getFirstAsync<{ total: number | null }>('SELECT SUM(current_balance) as total FROM finance_accounts WHERE is_archived = 0'),
      db.getAllAsync<{ date: string; delta: number }>(
        `SELECT date, SUM(CASE WHEN type = 'income' THEN amount WHEN type = 'expense' THEN -amount ELSE 0 END) as delta
         FROM finance_transactions WHERE date >= ? AND date <= ? GROUP BY date`,
        [start, today]
      ),
    ]);

    const netWorthToday = netWorthRow?.total ?? 0;
    const deltaByDate: Record<string, number> = {};
    for (const row of deltaRows) {
      deltaByDate[row.date] = row.delta;
    }
    const dailyDeltas = buildDailySeries(days, deltaByDate);
    const totalDelta = dailyDeltas.reduce((sum, point) => sum + point.value, 0);

    let cumulative = netWorthToday - totalDelta;
    const balanceSeries = dailyDeltas.map((point) => {
      cumulative += point.value;
      return { date: point.date, value: cumulative };
    });

    setSeries(bucketValueSeries(balanceSeries, 30, 'last'));
    const startValue = balanceSeries[0]?.value ?? 0;
    setChangePercent(startValue !== 0 ? ((netWorthToday - startValue) / Math.abs(startValue)) * 100 : 0);
  }, [db, days]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { series, changePercent, refresh };
}
