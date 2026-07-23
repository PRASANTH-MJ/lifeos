import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { addDays, todayKey, weekdayOf } from '@/lib/date';
import { useAuth } from '@/modules/auth';
import { fetchSummary } from './api';

export function useFinanceWeekSpend() {
  const { token } = useAuth();
  const [weekSpend, setWeekSpend] = useState(0);

  const refresh = useCallback(async () => {
    if (!token) return;
    const today = todayKey();
    const weekStart = addDays(today, -weekdayOf(today));
    const weekEnd = addDays(weekStart, 6);
    const summary = await fetchSummary(token, { start: weekStart, end: weekEnd });
    setWeekSpend(summary.expense);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { weekSpend, refresh };
}
