import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { addDays, buildDailySeries, todayKey } from '@/lib/date';
import { useAuth } from '@/modules/auth';
import { fetchTransactions } from './api';

/** Day-by-day expense totals for the trailing `days` window (for trend charts). */
export function useFinanceDailySpend(days: number) {
  const { token } = useAuth();
  const [series, setSeries] = useState<{ date: string; value: number }[]>([]);
  const [total, setTotal] = useState(0);

  const refresh = useCallback(async () => {
    if (!token) return;
    const start = addDays(todayKey(), -(days - 1));
    const { transactions } = await fetchTransactions(token, { start });
    const byDate: Record<string, number> = {};
    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      byDate[t.date] = (byDate[t.date] ?? 0) + Number(t.amount);
    }
    const built = buildDailySeries(days, byDate);
    setSeries(built);
    setTotal(built.reduce((sum, point) => sum + point.value, 0));
  }, [token, days]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { series, total, refresh };
}
