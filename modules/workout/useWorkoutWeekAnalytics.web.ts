import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';

import { webDb } from '@/db/webDb';
import { addDays, toDateKey, todayKey } from '@/lib/date';

type DayTotals = { date: string; count: number; minutes: number };

type LogRow = { completed_at: string; duration_seconds: number | null };

function buildDays(rows: LogRow[]): DayTotals[] {
  const today = todayKey();
  const start = addDays(today, -6);
  const byDate = new Map<string, DayTotals>();
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    byDate.set(date, { date, count: 0, minutes: 0 });
  }
  // Native query used `ORDER BY completed_at DESC LIMIT 200` before grouping; since grouping
  // here only bucket-sums by date (order doesn't affect the result), the LIMIT 200 is replicated
  // by sorting descending and slicing before the reduce below.
  const limited = [...rows].sort((a, b) => (a.completed_at < b.completed_at ? 1 : a.completed_at > b.completed_at ? -1 : 0)).slice(0, 200);
  for (const row of limited) {
    const date = toDateKey(new Date(row.completed_at));
    const entry = byDate.get(date);
    if (!entry) continue;
    entry.count += 1;
    entry.minutes += Math.round((row.duration_seconds ?? 0) / 60);
  }
  return Array.from(byDate.values());
}

/** Web build of useWorkoutWeekAnalytics.ts — same exported shape. Reactive via Dexie's
 * useLiveQuery instead of expo-router's useFocusEffect: any write to workout_logs from any tab
 * (or the sync engine) re-runs this query automatically. */
export function useWorkoutWeekAnalytics() {
  const rows = useLiveQuery(
    () => webDb.workout_logs.toArray() as unknown as Promise<LogRow[]>,
    []
  );

  const loading = rows === undefined;
  const days = buildDays(rows ?? []);

  const totalCount = days.reduce((sum, d) => sum + d.count, 0);
  const totalMinutes = days.reduce((sum, d) => sum + d.minutes, 0);

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab. Kept so
    // ported callers that do `await refresh()` don't need changing.
  }, []);

  return { days, totalCount, totalMinutes, loading, refresh };
}
