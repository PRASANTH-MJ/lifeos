import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { onLocalWrite } from '@/modules/sync';

/** All-time count of food_logs rows — the real per-user proxy for a club "food" challenge (see
 * modules/clubs/challengeProgress.ts's mealLogs metric): there's no separate "logged a meal
 * today" flag anywhere, so a running total of logged meals is the closest genuine counter this
 * data model already has, mirroring how a cardio "sessions" challenge counts cardioLogCount. */
export function useFoodLogCount() {
  const db = useSQLiteContext();
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM food_logs').then((row) => setCount(row?.c ?? 0));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // See onLocalWrite's doc comment (modules/sync/syncEngine.ts) — picks up a food_logs write made
  // through a different useFoodLogCount() instance (e.g. usePublicProfileStatsSync's, mounted
  // once at the root layout and never "focused" again by navigation).
  useEffect(() => {
    return onLocalWrite((table) => {
      if (table === 'food_logs') refresh();
    });
  }, [refresh]);

  return count;
}
