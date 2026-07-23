import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { addDays, toDateKey, todayKey } from '@/lib/date';
import type { BreathingLog } from './types';

export function useBreathingLogs() {
  const db = useSQLiteContext();
  const [logs, setLogs] = useState<BreathingLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await db.getAllAsync<BreathingLog>('SELECT * FROM breathing_logs ORDER BY completed_at DESC LIMIT 60');
    setLogs(rows);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logSession = useCallback(
    async (patternKey: string, durationSeconds: number, cycles: number) => {
      await db.runAsync(
        'INSERT INTO breathing_logs (pattern_key, duration_seconds, cycles, completed_at) VALUES (?, ?, ?, ?)',
        [patternKey, Math.round(durationSeconds), cycles, new Date().toISOString()]
      );
      await refresh();
    },
    [db, refresh]
  );

  const sessionsThisWeek = useMemo(() => {
    const weekAgo = addDays(todayKey(), -6);
    return logs.filter((log) => toDateKey(new Date(log.completed_at)) >= weekAgo).length;
  }, [logs]);

  return { logs, loading, logSession, sessionsThisWeek, refresh };
}
