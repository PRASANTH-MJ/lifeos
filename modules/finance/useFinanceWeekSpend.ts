import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { addDays, todayKey, weekdayOf } from '@/lib/date';

export function useFinanceWeekSpend() {
  const db = useSQLiteContext();
  const [weekSpend, setWeekSpend] = useState(0);

  const refresh = useCallback(async () => {
    const today = todayKey();
    const weekStart = addDays(today, -weekdayOf(today));
    const weekEnd = addDays(weekStart, 6);
    const row = await db.getFirstAsync<{ total: number | null }>(
      "SELECT SUM(amount) as total FROM finance_transactions WHERE type = 'expense' AND date >= ? AND date <= ?",
      [weekStart, weekEnd]
    );
    setWeekSpend(row?.total ?? 0);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { weekSpend, refresh };
}
