import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { computeDailyStreak } from '@/lib/dailyStreak';

type FoodLogRow = { date: string };

/**
 * Web build of useFoodStreak.ts — same return shape (a plain number). Reactive via Dexie's
 * useLiveQuery instead of expo-router's useFocusEffect: a food log written in any tab (or by
 * the sync engine) recomputes the streak in every mounted instance automatically.
 */
export function useFoodStreak() {
  const streak = useLiveQuery(async () => {
    const rows = (await webDb.food_logs.toArray()) as FoodLogRow[];
    const distinctDates = Array.from(new Set(rows.map((r) => r.date)));
    return computeDailyStreak(distinctDates);
  }, []);

  return streak ?? 0;
}
