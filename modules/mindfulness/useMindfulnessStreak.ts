import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { computeDailyStreak } from '@/lib/dailyStreak';
import { toDateKey } from '@/lib/date';

/** Consecutive-day streak ending today, counting a day if either meditation or breathing was
 * logged — the two screens are separate entry points into the same underlying habit. */
export function useMindfulnessStreak() {
  const db = useSQLiteContext();
  const [streak, setStreak] = useState(0);

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        db.getAllAsync<{ completed_at: string }>('SELECT completed_at FROM meditation_logs'),
        db.getAllAsync<{ completed_at: string }>('SELECT completed_at FROM breathing_logs'),
      ]).then(([meditation, breathing]) => {
        const dateKeys = [...meditation, ...breathing].map((row) => toDateKey(new Date(row.completed_at)));
        setStreak(computeDailyStreak(dateKeys));
      });
    }, [db])
  );

  return streak;
}
