import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { addDays, toDateKey, todayKey } from '@/lib/date';
import type { TimerLog } from './types';

export function useTimerLogs() {
  const db = useSQLiteContext();
  const [logs, setLogs] = useState<TimerLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await db.getAllAsync<TimerLog>('SELECT * FROM timer_logs ORDER BY completed_at DESC LIMIT 60');
    setLogs(rows);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logSession = useCallback(
    async (label: string | null, durationSeconds: number, habitId: number | null) => {
      await db.runAsync('INSERT INTO timer_logs (label, habit_id, duration_seconds, completed_at) VALUES (?, ?, ?, ?)', [
        label,
        habitId,
        Math.round(durationSeconds),
        new Date().toISOString(),
      ]);
      await refresh();
    },
    [db, refresh]
  );

  const totalMinutesThisWeek = useMemo(() => {
    const weekAgo = addDays(todayKey(), -6);
    const totalSeconds = logs
      .filter((log) => toDateKey(new Date(log.completed_at)) >= weekAgo)
      .reduce((sum, log) => sum + log.duration_seconds, 0);
    return Math.round(totalSeconds / 60);
  }, [logs]);

  return { logs, loading, logSession, totalMinutesThisWeek, refresh };
}
