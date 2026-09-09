import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';

type WaterLogRow = { date: string; amount_ml: number };

/** Web build of useWaterGoalHitDays.ts — same return shape and same "judge every day against the
 * current goal" approximation, reactive via Dexie's useLiveQuery. */
export function useWaterGoalHitDays() {
  const count = useLiveQuery(async () => {
    const [rawRows, rawPrefs] = await Promise.all([webDb.water_logs.toArray(), webDb.water_preferences.get(1)]);
    const rows = rawRows as unknown as WaterLogRow[];
    const prefs = rawPrefs as unknown as { goal_ml: number } | undefined;
    const goalMl = prefs?.goal_ml ?? 2000;
    const totalsByDate = new Map<string, number>();
    for (const row of rows) totalsByDate.set(row.date, (totalsByDate.get(row.date) ?? 0) + row.amount_ml);
    return Array.from(totalsByDate.values()).filter((total) => total >= goalMl).length;
  }, []);

  return count ?? 0;
}
