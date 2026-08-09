import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { addDays, todayKey } from '@/lib/date';

type DayTotals = { date: string; calories: number; protein: number; carbs: number; fat: number };

/** Last 7 days of food totals, for a simple weekly calories/macros view within Food Tracker —
 * mirrors the pattern finance's useFinanceWeekSpend() uses for its own weekly rollups. */
export function useFoodWeekAnalytics() {
  const db = useSQLiteContext();
  const [days, setDays] = useState<DayTotals[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const today = todayKey();
      const start = addDays(today, -6);
      const rows = await db.getAllAsync<{ date: string; calories: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null }>(
        'SELECT date, calories, protein_g, carbs_g, fat_g FROM food_logs WHERE date >= ? AND date <= ?',
        [start, today]
      );
      const byDate = new Map<string, DayTotals>();
      for (let i = 0; i < 7; i++) {
        const date = addDays(start, i);
        byDate.set(date, { date, calories: 0, protein: 0, carbs: 0, fat: 0 });
      }
      for (const row of rows) {
        const entry = byDate.get(row.date);
        if (!entry) continue;
        entry.calories += row.calories;
        entry.protein += row.protein_g ?? 0;
        entry.carbs += row.carbs_g ?? 0;
        entry.fat += row.fat_g ?? 0;
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

  const totals = useMemo(
    () =>
      days.reduce(
        (acc, d) => ({
          calories: acc.calories + d.calories,
          protein: acc.protein + d.protein,
          carbs: acc.carbs + d.carbs,
          fat: acc.fat + d.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [days]
  );

  const dailyAverageCalories = days.length > 0 ? Math.round(totals.calories / days.length) : 0;

  return { days, totals, dailyAverageCalories, loading, refresh };
}
