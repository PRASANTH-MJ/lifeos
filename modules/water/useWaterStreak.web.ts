import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { computeDailyStreak } from '@/lib/dailyStreak';

type WaterLogRow = { date: string };

/**
 * Web build of useWaterStreak.ts — same return shape (a plain number). Reactive via Dexie's
 * useLiveQuery instead of expo-router's useFocusEffect, so the streak recomputes automatically
 * on any write to water_logs from any tab (or the sync engine), not just on screen focus.
 */
export function useWaterStreak() {
  const streak = useLiveQuery(async () => {
    const rows = (await webDb.water_logs.toArray()) as WaterLogRow[];
    const distinctDates = Array.from(new Set(rows.map((r) => r.date)));
    return computeDailyStreak(distinctDates);
  }, []);

  return streak ?? 0;
}
