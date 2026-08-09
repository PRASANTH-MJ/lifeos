import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';

export type WaterLog = { id: number; amount_ml: number; date: string; created_at: string };

export function useWaterDay(dateKey: string) {
  const db = useSQLiteContext();
  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [goalMl, setGoalMl] = useState(2000);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [rows, prefRow] = await Promise.all([
      db.getAllAsync<WaterLog>('SELECT * FROM water_logs WHERE date = ? ORDER BY created_at ASC', [dateKey]),
      db.getFirstAsync<{ goal_ml: number }>('SELECT goal_ml FROM water_preferences WHERE id = 1'),
    ]);
    setLogs(rows);
    setGoalMl(prefRow?.goal_ml ?? 2000);
    setLoading(false);
  }, [db, dateKey]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const addLog = useCallback(
    async (amountMl: number) => {
      const now = new Date().toISOString();
      const result = await db.runAsync(
        'INSERT INTO water_logs (amount_ml, date, created_at, updated_at, sync_id) VALUES (?, ?, ?, ?, ?)',
        [amountMl, dateKey, now, now, Crypto.randomUUID()]
      );
      await pushLocalRow(db, 'water_logs', result.lastInsertRowId);
      await refresh();
    },
    [db, dateKey, refresh]
  );

  const removeLog = useCallback(
    async (id: number) => {
      await recordDeleteBeforeRemoving(db, 'water_logs', id);
      await db.runAsync('DELETE FROM water_logs WHERE id = ?', [id]);
      await refresh();
    },
    [db, refresh]
  );

  const setGoal = useCallback(
    async (nextGoalMl: number) => {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO water_preferences (id, goal_ml, updated_at) VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET goal_ml = excluded.goal_ml, updated_at = excluded.updated_at`,
        [nextGoalMl, now]
      );
      await pushLocalRow(db, 'water_preferences', 1);
      await refresh();
    },
    [db, refresh]
  );

  const totalMl = useMemo(() => logs.reduce((sum, l) => sum + l.amount_ml, 0), [logs]);

  return { logs, totalMl, goalMl, loading, addLog, removeLog, setGoal, refresh };
}
