import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { computeDailyStreak } from '@/lib/dailyStreak';

/** Consecutive-day streak ending today, from any day with at least one water log. */
export function useWaterStreak() {
  const db = useSQLiteContext();
  const [streak, setStreak] = useState(0);

  useFocusEffect(
    useCallback(() => {
      db.getAllAsync<{ date: string }>('SELECT DISTINCT date FROM water_logs').then((rows) => {
        setStreak(computeDailyStreak(rows.map((r) => r.date)));
      });
    }, [db])
  );

  return streak;
}
