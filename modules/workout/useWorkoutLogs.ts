import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { addDays, toDateKey, todayKey } from '@/lib/date';

type WorkoutLog = { id: number; workout_key: string; completed_at: string };

export function useWorkoutLogs() {
  const db = useSQLiteContext();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await db.getAllAsync<WorkoutLog>('SELECT * FROM workout_logs ORDER BY completed_at DESC LIMIT 60');
    setLogs(rows);
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const logCompletion = useCallback(
    async (workoutKey: string) => {
      await db.runAsync('INSERT INTO workout_logs (workout_key, completed_at) VALUES (?, ?)', [
        workoutKey,
        new Date().toISOString(),
      ]);
      await refresh();
    },
    [db, refresh]
  );

  const completedThisWeek = useMemo(() => {
    const weekAgo = addDays(todayKey(), -6);
    return logs.filter((log) => toDateKey(new Date(log.completed_at)) >= weekAgo).length;
  }, [logs]);

  return { logs, loading, logCompletion, completedThisWeek, refresh };
}
