import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { addDays, dateKeyToTimestamp, toDateKey, todayKey } from '@/lib/date';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';

type WorkoutLog = { id: number; workout_key: string; completed_at: string; duration_seconds: number | null };

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
    async (workoutKey: string, dateKey?: string, durationSeconds?: number) => {
      const completedAt = dateKey ? dateKeyToTimestamp(dateKey) : new Date().toISOString();
      const result = await db.runAsync(
        'INSERT INTO workout_logs (workout_key, completed_at, duration_seconds, sync_id, updated_at) VALUES (?, ?, ?, ?, ?)',
        [workoutKey, completedAt, durationSeconds ?? null, Crypto.randomUUID(), completedAt]
      );
      await pushLocalRow(db, 'workout_logs', result.lastInsertRowId);
      await refresh();
    },
    [db, refresh]
  );

  const removeLog = useCallback(
    async (id: number) => {
      await recordDeleteBeforeRemoving(db, 'workout_logs', id);
      await db.runAsync('DELETE FROM workout_logs WHERE id = ?', [id]);
      await refresh();
    },
    [db, refresh]
  );

  const completedThisWeek = useMemo(() => {
    const weekAgo = addDays(todayKey(), -6);
    return logs.filter((log) => toDateKey(new Date(log.completed_at)) >= weekAgo).length;
  }, [logs]);

  return { logs, loading, logCompletion, removeLog, completedThisWeek, refresh };
}
