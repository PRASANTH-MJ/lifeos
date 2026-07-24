import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { addDays, buildDailySeries, todayKey } from '@/lib/date';

/** Day-by-day expense totals for the trailing `days` window (for trend charts). */
export function useFinanceDailySpend(days: number) {
  const db = useSQLiteContext();
  const [series, setSeries] = useState<{ date: string; value: number }[]>([]);
  const [total, setTotal] = useState(0);

  const refresh = useCallback(async () => {
    const start = addDays(todayKey(), -(days - 1));
    const rows = await db.getAllAsync<{ date: string; total: number }>(
      "SELECT date, SUM(amount) as total FROM finance_transactions WHERE type = 'expense' AND date >= ? GROUP BY date",
      [start]
    );
    const byDate: Record<string, number> = {};
    for (const row of rows) {
      byDate[row.date] = row.total;
    }
    const built = buildDailySeries(days, byDate);
    setSeries(built);
    setTotal(built.reduce((sum, point) => sum + point.value, 0));
  }, [db, days]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { series, total, refresh };
}
