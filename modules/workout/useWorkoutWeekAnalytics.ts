import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { addDays, toDateKey, todayKey } from '@/lib/date';

type DayTotals = { date: string; count: number; minutes: number };

/** Last 7 days of workout completions, for a simple weekly progress view — mirrors the pattern
 * Food's useFoodWeekAnalytics() uses for its own weekly rollup. */
export function useWorkoutWeekAnalytics() {
  const db = useSQLiteContext();
  const [days, setDays] = useState<DayTotals[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const today = todayKey();
      const start = addDays(today, -6);
      const rows = await db.getAllAsync<{ completed_at: string; duration_seconds: number | null }>(
        'SELECT completed_at, duration_seconds FROM workout_logs ORDER BY completed_at DESC LIMIT 200'
      );
      const byDate = new Map<string, DayTotals>();
      for (let i = 0; i < 7; i++) {
        const date = addDays(start, i);
        byDate.set(date, { date, count: 0, minutes: 0 });
      }
      for (const row of rows) {
        const date = toDateKey(new Date(row.completed_at));
        const entry = byDate.get(date);
        if (!entry) continue;
        entry.count += 1;
        entry.minutes += Math.round((row.duration_seconds ?? 0) / 60);
      }
      setDays(Array.from(byDate.values()));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const totalCount = days.reduce((sum, d) => sum + d.count, 0);
  const totalMinutes = days.reduce((sum, d) => sum + d.minutes, 0);

  return { days, totalCount, totalMinutes, loading, refresh };
}
