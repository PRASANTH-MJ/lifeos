import { useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { addDays, todayKey } from '@/lib/date';

type DayTotals = { date: string; calories: number; protein: number; carbs: number; fat: number };

type FoodLogRow = {
  date: string;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

/** Web build of useFoodWeekAnalytics.ts — same exported shape. Reactive via Dexie's
 * useLiveQuery instead of expo-router's useFocusEffect: a food_logs write in any tab
 * re-runs this query and updates every mounted instance automatically. */
export function useFoodWeekAnalytics() {
  const days = useLiveQuery(async () => {
    const today = todayKey();
    const start = addDays(today, -6);
    const rows = (await webDb.food_logs.toArray()) as unknown as FoodLogRow[];
    const inRange = rows.filter((row) => row.date >= start && row.date <= today);

    const byDate = new Map<string, DayTotals>();
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      byDate.set(date, { date, calories: 0, protein: 0, carbs: 0, fat: 0 });
    }
    for (const row of inRange) {
      const entry = byDate.get(row.date);
      if (!entry) continue;
      entry.calories += row.calories;
      entry.protein += row.protein_g ?? 0;
      entry.carbs += row.carbs_g ?? 0;
      entry.fat += row.fat_g ?? 0;
    }
    return Array.from(byDate.values());
  }, []);

  const loading = days === undefined;
  const resolvedDays = days ?? [];

  const totals = useMemo(
    () =>
      resolvedDays.reduce(
        (acc, d) => ({
          calories: acc.calories + d.calories,
          protein: acc.protein + d.protein,
          carbs: acc.carbs + d.carbs,
          fat: acc.fat + d.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [resolvedDays]
  );

  const dailyAverageCalories = resolvedDays.length > 0 ? Math.round(totals.calories / resolvedDays.length) : 0;

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  return { days: resolvedDays, totals, dailyAverageCalories, loading, refresh };
}
