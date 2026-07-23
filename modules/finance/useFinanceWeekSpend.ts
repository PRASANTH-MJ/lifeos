import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { addDays, todayKey, weekdayOf } from '@/lib/date';

export function useFinanceWeekSpend() {
  const db = useSQLiteContext();
  const [weekSpend, setWeekSpend] = useState(0);

  const refresh = useCallback(async () => {
    const today = todayKey();
    const weekStart = addDays(today, -weekdayOf(today));
    const weekEnd = addDays(weekStart, 6);
    const row = await db.getFirstAsync<{ total: number | null }>(
      "SELECT SUM(amount) as total FROM finance_transactions WHERE type = 'expense' AND date BETWEEN ? AND ?",
      [weekStart, weekEnd]
    );
    setWeekSpend(row?.total ?? 0);
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { weekSpend, refresh };
}
