import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { onLocalWrite } from '@/modules/sync';

/** Count of distinct days the signed-in user's total water intake met or passed their goal — the
 * real per-user proxy for a club "water" challenge (see modules/clubs/challengeProgress.ts's
 * waterGoalDays metric). Compares each day's logged total against the CURRENT goal_ml (there's no
 * per-day historical goal snapshot anywhere in this data model), so a day logged before the user
 * last changed their goal is judged against today's goal rather than whatever it was that day —
 * a reasonable best-effort approximation, not a perfectly historically-accurate count. */
export function useWaterGoalHitDays() {
  const db = useSQLiteContext();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const [rows, prefRow] = await Promise.all([
      db.getAllAsync<{ date: string; total: number }>('SELECT date, SUM(amount_ml) as total FROM water_logs GROUP BY date'),
      db.getFirstAsync<{ goal_ml: number }>('SELECT goal_ml FROM water_preferences WHERE id = 1'),
    ]);
    const goalMl = prefRow?.goal_ml ?? 2000;
    setCount(rows.filter((r) => r.total >= goalMl).length);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // See onLocalWrite's doc comment (modules/sync/syncEngine.ts) — picks up a water_logs (or a
  // goal-changing water_preferences) write made through a different useWaterGoalHitDays()
  // instance (e.g. usePublicProfileStatsSync's, mounted once at the root layout and never
  // "focused" again by navigation).
  useEffect(() => {
    return onLocalWrite((table) => {
      if (table === 'water_logs' || table === 'water_preferences') refresh();
    });
  }, [refresh]);

  return count;
}
